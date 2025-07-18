import { PrismaClient, Stand } from '@prisma/client';
import { StandCapabilities, CreateStandRequest, UpdateStandRequest } from '../types';
import { AuditService, AuditEventType, AuditSeverity } from './audit.service';
import { FieldAccessService, UserContext, AccessLevel } from './field-access.service';
import { EncryptionService } from './encryption.service';

export interface SecurityContext extends UserContext {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
}

export interface SecuredStandData {
  stand: Stand;
  capabilities?: StandCapabilities;
  accessLevel: AccessLevel;
  maskedFields: string[];
  encryptedFields: string[];
}

export interface SecurityValidationResult {
  isValid: boolean;
  violations: string[];
  recommendations: string[];
}

export class StandSecurityService {
  private auditService: AuditService;
  private fieldAccessService: FieldAccessService;
  private encryptionService: EncryptionService;

  constructor(
    private prisma: PrismaClient,
    auditService?: AuditService,
    fieldAccessService?: FieldAccessService,
    encryptionService?: EncryptionService
  ) {
    this.encryptionService = encryptionService || new EncryptionService();
    this.fieldAccessService = fieldAccessService || new FieldAccessService(this.encryptionService);
    this.auditService = auditService || new AuditService(prisma);
  }

  /**
   * Set RLS session variables for secure database access
   */
  async setRLSContext(context: SecurityContext): Promise<void> {
    const permissions = context.permissions.join(',');

    await this.prisma.$executeRawUnsafe(
      'SELECT assets.set_session_variables($1, $2, $3, $4)',
      context.organizationId,
      context.userId,
      context.role,
      permissions
    );

    // Log session setup
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType: AuditEventType.FIELD_ACCESSED,
      severity: AuditSeverity.LOW,
      resource: 'session',
      resourceId: 'rls_context',
      action: 'setup',
      details: { role: context.role, permissions: context.permissions },
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        sessionId: context.sessionId,
      },
      success: true,
    });
  }

  /**
   * Validate security for stand creation
   */
  async validateCreateSecurity(
    context: SecurityContext,
    data: CreateStandRequest
  ): Promise<SecurityValidationResult> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check if user has permission to create stands
    if (
      !context.permissions.includes('capability_management') &&
      context.accessLevel !== AccessLevel.ADMIN
    ) {
      violations.push('User lacks capability_management permission');
    }

    // Check for sensitive data in public fields
    if (data.code && this.containsSensitiveData(data.code)) {
      violations.push('Stand code contains potentially sensitive information');
    }

    // Validate field-level access for capabilities
    if (this.hasCapabilityData(data)) {
      const fieldViolations = this.validateFieldAccess(context, data, 'write');
      violations.push(...fieldViolations);
    }

    // Security recommendations
    if (data.operationalConstraints?.securityRequirements) {
      recommendations.push('Consider encrypting security requirements');
    }

    if (data.infrastructure?.securitySystemDetails) {
      recommendations.push('Ensure security system details are properly classified');
    }

    // Log validation attempt
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType: AuditEventType.VALIDATION_FAILURE,
      severity: violations.length > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
      resource: 'stand',
      resourceId: 'new',
      action: 'validate_create_security',
      details: { violations, recommendations },
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: violations.length === 0,
    });

    return {
      isValid: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Validate security for stand update
   */
  async validateUpdateSecurity(
    context: SecurityContext,
    standId: string,
    data: UpdateStandRequest
  ): Promise<SecurityValidationResult> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check if user has permission to update stands
    if (
      !context.permissions.includes('capability_management') &&
      context.accessLevel !== AccessLevel.ADMIN
    ) {
      violations.push('User lacks capability_management permission');
    }

    // Validate field-level access
    if (this.hasCapabilityData(data)) {
      const fieldViolations = this.validateFieldAccess(context, data, 'write');
      violations.push(...fieldViolations);
    }

    // Check for unauthorized field modifications
    const sensitiveFields = ['maintenanceAccess', 'cost', 'contractorDetails'];
    for (const field of sensitiveFields) {
      if (field in data && !this.fieldAccessService.hasFieldAccess(field, context, 'write')) {
        violations.push(`Unauthorized attempt to modify ${field}`);
      }
    }

    // Log validation attempt
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType:
        violations.length > 0
          ? AuditEventType.SECURITY_VIOLATION
          : AuditEventType.CAPABILITY_VALIDATED,
      severity: violations.length > 0 ? AuditSeverity.HIGH : AuditSeverity.LOW,
      resource: 'stand',
      resourceId: standId,
      action: 'validate_update_security',
      details: { violations, recommendations },
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: violations.length === 0,
    });

    return {
      isValid: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Prepare stand data for creation with encryption
   */
  async prepareCreateData(
    context: SecurityContext,
    data: CreateStandRequest
  ): Promise<CreateStandRequest> {
    const preparedData = { ...data };

    // Encrypt sensitive fields if present
    if (this.hasCapabilityData(data)) {
      const capabilities = this.extractCapabilities(data);
      const encryptionResult = this.encryptionService.encryptCapabilities(capabilities);

      if (encryptionResult.success && encryptionResult.data) {
        // Update the prepared data with encrypted capabilities
        const encryptedCapabilities = encryptionResult.data;
        preparedData.dimensions = encryptedCapabilities.dimensions;
        preparedData.aircraftCompatibility = encryptedCapabilities.aircraftCompatibility;
        preparedData.groundSupport = encryptedCapabilities.groundSupport;
        preparedData.operationalConstraints = encryptedCapabilities.operationalConstraints;
        preparedData.environmentalFeatures = encryptedCapabilities.environmentalFeatures;
        preparedData.infrastructure = encryptedCapabilities.infrastructure;
      } else {
        throw new Error(`Encryption failed: ${encryptionResult.error}`);
      }
    }

    // Log data preparation
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType: AuditEventType.FIELD_ACCESSED,
      severity: AuditSeverity.MEDIUM,
      resource: 'stand',
      resourceId: 'new',
      action: 'prepare_create_data',
      details: { encrypted: true },
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    return preparedData;
  }

  /**
   * Prepare stand data for update with encryption
   */
  async prepareUpdateData(
    context: SecurityContext,
    standId: string,
    data: UpdateStandRequest
  ): Promise<UpdateStandRequest> {
    const preparedData = { ...data };

    // Encrypt sensitive fields if present
    if (this.hasCapabilityData(data)) {
      const capabilities = this.extractCapabilities(data);
      const encryptionResult = this.encryptionService.encryptCapabilities(capabilities);

      if (encryptionResult.success && encryptionResult.data) {
        const encryptedCapabilities = encryptionResult.data;
        if (data.dimensions) preparedData.dimensions = encryptedCapabilities.dimensions;
        if (data.aircraftCompatibility)
          preparedData.aircraftCompatibility = encryptedCapabilities.aircraftCompatibility;
        if (data.groundSupport) preparedData.groundSupport = encryptedCapabilities.groundSupport;
        if (data.operationalConstraints)
          preparedData.operationalConstraints = encryptedCapabilities.operationalConstraints;
        if (data.environmentalFeatures)
          preparedData.environmentalFeatures = encryptedCapabilities.environmentalFeatures;
        if (data.infrastructure) preparedData.infrastructure = encryptedCapabilities.infrastructure;
      } else {
        throw new Error(`Encryption failed: ${encryptionResult.error}`);
      }
    }

    return preparedData;
  }

  /**
   * Secure stand data for retrieval
   */
  async secureStandData(
    context: SecurityContext,
    stand: Stand,
    includeCapabilities: boolean = true
  ): Promise<SecuredStandData> {
    const maskedFields: string[] = [];
    const encryptedFields: string[] = [];
    let capabilities: StandCapabilities | undefined;

    if (includeCapabilities && this.hasStandCapabilities(stand)) {
      // Extract and decrypt capabilities
      const rawCapabilities = this.extractStandCapabilities(stand);
      const decryptionResult = this.encryptionService.decryptCapabilities(rawCapabilities);

      if (decryptionResult.success && decryptionResult.data) {
        capabilities = decryptionResult.data;

        // Track encrypted fields
        if (rawCapabilities.operationalConstraints?.noiseRestrictions) {
          encryptedFields.push('operationalConstraints.noiseRestrictions');
        }
        if (rawCapabilities.operationalConstraints?.securityRequirements) {
          encryptedFields.push('operationalConstraints.securityRequirements');
        }
        if (rawCapabilities.infrastructure?.securitySystemDetails) {
          encryptedFields.push('infrastructure.securitySystemDetails');
        }
        if (rawCapabilities.infrastructure?.fireSuppressionDetails) {
          encryptedFields.push('infrastructure.fireSuppressionDetails');
        }
        if ((rawCapabilities as any).maintenanceAccess) {
          encryptedFields.push('maintenanceAccess');
        }

        // Apply field-level access control
        capabilities = this.fieldAccessService.filterCapabilities(capabilities, context);

        // Track masked fields from audit logs
        const recentLogs = this.fieldAccessService.getAuditLogs(context.organizationId, {
          userId: context.userId,
          action: 'mask',
          startDate: new Date(Date.now() - 60000), // Last minute
        });

        maskedFields.push(...recentLogs.map((log) => log.fieldPath));
      }
    }

    // Log data access
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType: AuditEventType.FIELD_ACCESSED,
      severity: AuditSeverity.LOW,
      resource: 'stand',
      resourceId: stand.id,
      action: 'retrieve',
      details: {
        maskedFields,
        encryptedFields,
        includeCapabilities,
      },
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    return {
      stand,
      capabilities,
      accessLevel: context.accessLevel,
      maskedFields,
      encryptedFields,
    };
  }

  /**
   * Validate delete permission
   */
  async validateDeleteSecurity(
    context: SecurityContext,
    standId: string
  ): Promise<SecurityValidationResult> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Only admins can delete stands
    if (context.accessLevel !== AccessLevel.ADMIN) {
      violations.push('Only administrators can delete stands');
    }

    // Check if stand has dependencies
    const [adjacencies, maintenanceRecords] = await Promise.all([
      this.prisma.standAdjacency.count({ where: { standId } }),
      this.prisma.standMaintenanceRecord.count({ where: { standId } }),
    ]);

    if (adjacencies > 0) {
      recommendations.push(
        `Stand has ${adjacencies} adjacency relationships that will be affected`
      );
    }

    if (maintenanceRecords > 0) {
      recommendations.push(
        `Stand has ${maintenanceRecords} maintenance records that will be preserved`
      );
    }

    // Log validation attempt
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType:
        violations.length > 0 ? AuditEventType.ACCESS_DENIED : AuditEventType.CAPABILITY_VALIDATED,
      severity: violations.length > 0 ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      resource: 'stand',
      resourceId: standId,
      action: 'validate_delete_security',
      details: { violations, recommendations },
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: violations.length === 0,
    });

    return {
      isValid: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Log stand access for audit
   */
  async logStandAccess(
    context: SecurityContext,
    standId: string,
    action: string,
    success: boolean,
    details?: any
  ): Promise<void> {
    await this.auditService.logEvent({
      organizationId: context.organizationId,
      userId: context.userId,
      eventType: success ? AuditEventType.FIELD_ACCESSED : AuditEventType.ACCESS_DENIED,
      severity: success ? AuditSeverity.LOW : AuditSeverity.HIGH,
      resource: 'stand',
      resourceId: standId,
      action,
      details,
      metadata: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        sessionId: context.sessionId,
      },
      success,
    });
  }

  /**
   * Validate field access permissions
   */
  private validateFieldAccess(context: UserContext, data: any, action: 'read' | 'write'): string[] {
    const violations: string[] = [];
    const checkFields = (obj: any, basePath: string = '') => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
          const fieldPath = basePath ? `${basePath}.${key}` : key;

          if (!this.fieldAccessService.hasFieldAccess(fieldPath, context, action)) {
            violations.push(`No ${action} access to field: ${fieldPath}`);
          }

          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            checkFields(obj[key], fieldPath);
          }
        }
      }
    };

    checkFields(data);
    return violations;
  }

  /**
   * Check if data contains sensitive information
   */
  private containsSensitiveData(value: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /private/i,
      /confidential/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(value));
  }

  /**
   * Check if request has capability data
   */
  private hasCapabilityData(data: CreateStandRequest | UpdateStandRequest): boolean {
    return !!(
      data.dimensions ||
      data.aircraftCompatibility ||
      data.groundSupport ||
      data.operationalConstraints ||
      data.environmentalFeatures ||
      data.infrastructure
    );
  }

  /**
   * Check if stand has capabilities
   */
  private hasStandCapabilities(stand: Stand): boolean {
    return !!(
      stand.dimensions ||
      stand.aircraftCompatibility ||
      stand.groundSupport ||
      stand.operationalConstraints ||
      stand.environmentalFeatures ||
      stand.infrastructure
    );
  }

  /**
   * Extract capabilities from request
   */
  private extractCapabilities(data: CreateStandRequest | UpdateStandRequest): StandCapabilities {
    return {
      dimensions: data.dimensions || {},
      aircraftCompatibility: data.aircraftCompatibility || {},
      groundSupport: data.groundSupport || {},
      operationalConstraints: data.operationalConstraints || {},
      environmentalFeatures: data.environmentalFeatures || {},
      infrastructure: data.infrastructure || {},
    };
  }

  /**
   * Extract capabilities from stand
   */
  private extractStandCapabilities(stand: Stand): any {
    return {
      dimensions: stand.dimensions,
      aircraftCompatibility: stand.aircraftCompatibility,
      groundSupport: stand.groundSupport,
      operationalConstraints: stand.operationalConstraints,
      environmentalFeatures: stand.environmentalFeatures,
      infrastructure: stand.infrastructure,
    };
  }

  /**
   * Get security statistics
   */
  async getSecurityStatistics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const statistics = await this.auditService.getStatistics(organizationId, startDate, endDate);

    const fieldAccessLogs = this.fieldAccessService.getAuditLogs(organizationId, {
      startDate,
      endDate,
    });

    return {
      audit: statistics,
      fieldAccess: {
        totalAccess: fieldAccessLogs.length,
        deniedAccess: fieldAccessLogs.filter((log) => log.action === 'deny').length,
        maskedFields: fieldAccessLogs.filter((log) => log.action === 'mask').length,
        successRate:
          fieldAccessLogs.length > 0
            ? (fieldAccessLogs.filter((log) => log.success).length / fieldAccessLogs.length) * 100
            : 100,
      },
    };
  }

  /**
   * Cleanup and destroy service
   */
  destroy(): void {
    this.auditService.destroy();
  }
}
