import { PrismaClient, Stand } from '@prisma/client';
import { StandCapabilityRepository } from '../repositories/stand-capability.repository';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import {
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
  PaginatedResult,
  StandCapabilities,
} from '../types';
import {
  StandSecurityService,
  SecurityContext,
  SecuredStandData,
} from '../security/stand-security.service';
import { AuditService, AuditEventType, AuditSeverity } from '../security/audit.service';
import { FieldAccessService } from '../security/field-access.service';
import { EncryptionService } from '../security/encryption.service';

export interface SecureStandOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  securityViolations?: string[];
  recommendations?: string[];
  auditTrail?: string;
}

export class SecureStandCRUDService {
  private repository: StandCapabilityRepository;
  private securityService: StandSecurityService;
  private auditService: AuditService;
  private fieldAccessService: FieldAccessService;
  private encryptionService: EncryptionService;

  constructor(
    private prisma: PrismaClient,
    private validationEngine: CapabilityValidationEngine,
    encryptionKey?: string
  ) {
    this.repository = new StandCapabilityRepository(prisma);
    this.encryptionService = new EncryptionService(encryptionKey);
    this.fieldAccessService = new FieldAccessService(this.encryptionService);
    this.auditService = new AuditService(prisma);
    this.securityService = new StandSecurityService(
      prisma,
      this.auditService,
      this.fieldAccessService,
      this.encryptionService
    );
  }

  /**
   * Create a new stand with comprehensive security
   */
  async createStand(
    securityContext: SecurityContext,
    data: CreateStandRequest
  ): Promise<SecureStandOperationResult<Stand>> {
    try {
      // 1. Validate security permissions
      const securityValidation = await this.securityService.validateCreateSecurity(
        securityContext,
        data
      );

      if (!securityValidation.isValid) {
        await this.auditService.logSecurityViolation(
          securityContext.organizationId,
          securityContext.userId,
          'unauthorized_create_attempt',
          {
            violations: securityValidation.violations,
            standCode: data.code,
          },
          {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            requestId: securityContext.requestId,
          }
        );

        return {
          success: false,
          error: 'Security validation failed',
          securityViolations: securityValidation.violations,
          recommendations: securityValidation.recommendations,
        };
      }

      // 2. Check if code already exists
      const existingStand = await this.repository.existsByCode(
        data.code,
        securityContext.organizationId
      );

      if (existingStand) {
        await this.auditService.logEvent({
          organizationId: securityContext.organizationId,
          userId: securityContext.userId,
          eventType: AuditEventType.VALIDATION_FAILURE,
          severity: AuditSeverity.MEDIUM,
          resource: 'stand',
          resourceId: 'new',
          action: 'create',
          details: { reason: 'duplicate_code', code: data.code },
          metadata: {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            requestId: securityContext.requestId,
          },
          success: false,
          errorMessage: `Stand with code '${data.code}' already exists`,
        });

        return {
          success: false,
          error: `Stand with code '${data.code}' already exists`,
        };
      }

      // 3. Validate capabilities if provided
      if (this.hasCapabilityData(data)) {
        const capabilities = this.extractCapabilities(data);
        const validationResult = await this.validationEngine.validate(capabilities);

        if (!validationResult.valid) {
          await this.auditService.logValidation(
            securityContext.organizationId,
            securityContext.userId,
            'new',
            {
              isValid: false,
              errors: validationResult.errors,
              warnings: validationResult.warnings || [],
            },
            {
              ipAddress: securityContext.ipAddress,
              userAgent: securityContext.userAgent,
              requestId: securityContext.requestId,
            }
          );

          return {
            success: false,
            error: `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`,
          };
        }
      }

      // 4. Prepare data with encryption
      const preparedData = await this.securityService.prepareCreateData(securityContext, data);

      // 5. Create the stand within a transaction
      const stand = await this.prisma.$transaction(async (tx) => {
        // Create the stand
        const newStand = await this.repository.create(
          securityContext.organizationId,
          preparedData,
          securityContext.userId
        );

        // Log capability creation
        if (this.hasCapabilityData(data)) {
          await this.auditService.logCapabilityChange(
            securityContext.organizationId,
            securityContext.userId,
            newStand.id,
            'create',
            undefined,
            this.extractCapabilities(data),
            {
              ipAddress: securityContext.ipAddress,
              userAgent: securityContext.userAgent,
              requestId: securityContext.requestId,
            }
          );
        }

        return newStand;
      });

      // 6. Log successful creation
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.CAPABILITY_CREATED,
        severity: AuditSeverity.MEDIUM,
        resource: 'stand',
        resourceId: stand.id,
        action: 'create',
        details: { code: stand.code, name: stand.name },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
          sessionId: securityContext.sessionId,
        },
        success: true,
      });

      return {
        success: true,
        data: stand,
        recommendations: securityValidation.recommendations,
        auditTrail: stand.id,
      };
    } catch (error) {
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.SECURITY_VIOLATION,
        severity: AuditSeverity.HIGH,
        resource: 'stand',
        resourceId: 'new',
        action: 'create',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Update an existing stand with security validation
   */
  async updateStand(
    securityContext: SecurityContext,
    standId: string,
    data: UpdateStandRequest
  ): Promise<SecureStandOperationResult<Stand>> {
    try {
      // 1. Validate security permissions
      const securityValidation = await this.securityService.validateUpdateSecurity(
        securityContext,
        standId,
        data
      );

      if (!securityValidation.isValid) {
        await this.auditService.logSecurityViolation(
          securityContext.organizationId,
          securityContext.userId,
          'unauthorized_update_attempt',
          {
            violations: securityValidation.violations,
            standId,
          },
          {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            requestId: securityContext.requestId,
          }
        );

        return {
          success: false,
          error: 'Security validation failed',
          securityViolations: securityValidation.violations,
          recommendations: securityValidation.recommendations,
        };
      }

      // 2. Get current stand for validation
      const currentStand = await this.repository.findById(standId, securityContext.organizationId);

      if (!currentStand) {
        await this.auditService.logAccessDenial(
          securityContext.organizationId,
          securityContext.userId,
          'stand',
          standId,
          'update',
          'Stand not found',
          {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            requestId: securityContext.requestId,
          }
        );

        return {
          success: false,
          error: 'Stand not found',
        };
      }

      // 3. Validate code uniqueness if code is being updated
      if (data.code && data.code !== currentStand.code) {
        const existingStand = await this.repository.existsByCode(
          data.code,
          securityContext.organizationId,
          standId
        );

        if (existingStand) {
          return {
            success: false,
            error: `Stand with code '${data.code}' already exists`,
          };
        }
      }

      // 4. Validate capabilities if provided
      if (this.hasCapabilityData(data)) {
        const capabilities = this.extractCapabilities(data);
        const validationResult = await this.validationEngine.validate(capabilities);

        if (!validationResult.valid) {
          await this.auditService.logValidation(
            securityContext.organizationId,
            securityContext.userId,
            standId,
            {
              isValid: false,
              errors: validationResult.errors,
              warnings: validationResult.warnings || [],
            },
            {
              ipAddress: securityContext.ipAddress,
              userAgent: securityContext.userAgent,
              requestId: securityContext.requestId,
            }
          );

          return {
            success: false,
            error: `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`,
          };
        }
      }

      // 5. Prepare data with encryption
      const preparedData = await this.securityService.prepareUpdateData(
        securityContext,
        standId,
        data
      );

      // 6. Update within transaction
      const updatedStand = await this.prisma.$transaction(async (tx) => {
        // Capture previous capabilities
        const previousCapabilities = this.hasStandCapabilities(currentStand)
          ? this.extractStandCapabilities(currentStand)
          : undefined;

        // Update the stand
        const stand = await this.repository.update(
          standId,
          securityContext.organizationId,
          preparedData,
          securityContext.userId
        );

        // Log capability changes
        if (this.hasCapabilityData(data) || previousCapabilities) {
          await this.auditService.logCapabilityChange(
            securityContext.organizationId,
            securityContext.userId,
            standId,
            'update',
            previousCapabilities,
            this.extractCapabilities(data),
            {
              ipAddress: securityContext.ipAddress,
              userAgent: securityContext.userAgent,
              requestId: securityContext.requestId,
            }
          );
        }

        return stand;
      });

      // 7. Log successful update
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.CAPABILITY_UPDATED,
        severity: AuditSeverity.MEDIUM,
        resource: 'stand',
        resourceId: standId,
        action: 'update',
        details: { updatedFields: Object.keys(data) },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
          sessionId: securityContext.sessionId,
        },
        success: true,
      });

      return {
        success: true,
        data: updatedStand,
        recommendations: securityValidation.recommendations,
        auditTrail: standId,
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return {
          success: false,
          error: 'Stand was modified by another user. Please refresh and try again.',
        };
      }

      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.SECURITY_VIOLATION,
        severity: AuditSeverity.HIGH,
        resource: 'stand',
        resourceId: standId,
        action: 'update',
        details: { error: error.message },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        },
        success: false,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * Delete a stand with security validation
   */
  async deleteStand(
    securityContext: SecurityContext,
    standId: string
  ): Promise<SecureStandOperationResult<void>> {
    try {
      // 1. Validate delete permissions
      const securityValidation = await this.securityService.validateDeleteSecurity(
        securityContext,
        standId
      );

      if (!securityValidation.isValid) {
        await this.auditService.logSecurityViolation(
          securityContext.organizationId,
          securityContext.userId,
          'unauthorized_delete_attempt',
          {
            violations: securityValidation.violations,
            standId,
          },
          {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            requestId: securityContext.requestId,
          }
        );

        return {
          success: false,
          error: 'Security validation failed',
          securityViolations: securityValidation.violations,
          recommendations: securityValidation.recommendations,
        };
      }

      // 2. Check if stand exists
      const stand = await this.repository.findById(standId, securityContext.organizationId);

      if (!stand) {
        return {
          success: false,
          error: 'Stand not found',
        };
      }

      // 3. Soft delete the stand
      await this.repository.softDelete(
        standId,
        securityContext.organizationId,
        securityContext.userId
      );

      // 4. Log successful deletion
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.CAPABILITY_DELETED,
        severity: AuditSeverity.HIGH,
        resource: 'stand',
        resourceId: standId,
        action: 'delete',
        details: { code: stand.code, name: stand.name },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
          sessionId: securityContext.sessionId,
        },
        success: true,
      });

      return {
        success: true,
        recommendations: securityValidation.recommendations,
        auditTrail: standId,
      };
    } catch (error) {
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.SECURITY_VIOLATION,
        severity: AuditSeverity.CRITICAL,
        resource: 'stand',
        resourceId: standId,
        action: 'delete',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get a stand by ID with field-level security
   */
  async getStandById(
    securityContext: SecurityContext,
    standId: string,
    includeCapabilities: boolean = true
  ): Promise<SecureStandOperationResult<SecuredStandData>> {
    try {
      // Get the stand
      const stand = await this.repository.findById(standId, securityContext.organizationId);

      if (!stand) {
        await this.auditService.logAccessDenial(
          securityContext.organizationId,
          securityContext.userId,
          'stand',
          standId,
          'read',
          'Stand not found',
          {
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent,
            requestId: securityContext.requestId,
          }
        );

        return {
          success: false,
          error: 'Stand not found',
        };
      }

      // Apply field-level security
      const securedData = await this.securityService.secureStandData(
        securityContext,
        stand,
        includeCapabilities
      );

      return {
        success: true,
        data: securedData,
        auditTrail: standId,
      };
    } catch (error) {
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.ACCESS_DENIED,
        severity: AuditSeverity.HIGH,
        resource: 'stand',
        resourceId: standId,
        action: 'read',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get all stands with field-level security
   */
  async getStands(
    securityContext: SecurityContext,
    filters: StandFilters = {},
    page: number = 1,
    pageSize: number = 50,
    includeCapabilities: boolean = false
  ): Promise<SecureStandOperationResult<PaginatedResult<SecuredStandData>>> {
    try {
      // Get stands with pagination
      const result = await this.repository.findAll(
        securityContext.organizationId,
        filters,
        page,
        pageSize
      );

      // Apply field-level security to each stand
      const securedStands = await Promise.all(
        result.data.map((stand) =>
          this.securityService.secureStandData(securityContext, stand, includeCapabilities)
        )
      );

      // Log bulk access
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.FIELD_ACCESSED,
        severity: AuditSeverity.LOW,
        resource: 'stand',
        resourceId: 'bulk',
        action: 'list',
        details: {
          filters,
          page,
          pageSize,
          resultCount: result.data.length,
          includeCapabilities,
        },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        },
        success: true,
      });

      return {
        success: true,
        data: {
          data: securedStands,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      };
    } catch (error) {
      await this.auditService.logEvent({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: AuditEventType.ACCESS_DENIED,
        severity: AuditSeverity.HIGH,
        resource: 'stand',
        resourceId: 'bulk',
        action: 'list',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStatistics(
    securityContext: SecurityContext,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    // Only admins can view security statistics
    if (securityContext.accessLevel !== 'admin') {
      await this.auditService.logAccessDenial(
        securityContext.organizationId,
        securityContext.userId,
        'security',
        'statistics',
        'read',
        'Insufficient permissions',
        {
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          requestId: securityContext.requestId,
        }
      );

      throw new Error('Insufficient permissions to view security statistics');
    }

    return await this.securityService.getSecurityStatistics(
      securityContext.organizationId,
      startDate,
      endDate
    );
  }

  /**
   * Helper methods
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

  private extractStandCapabilities(stand: Stand): StandCapabilities {
    return {
      dimensions: (stand.dimensions as any) || {},
      aircraftCompatibility: (stand.aircraftCompatibility as any) || {},
      groundSupport: (stand.groundSupport as any) || {},
      operationalConstraints: (stand.operationalConstraints as any) || {},
      environmentalFeatures: (stand.environmentalFeatures as any) || {},
      infrastructure: (stand.infrastructure as any) || {},
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.securityService.destroy();
    await this.auditService.flushBuffer();
  }
}
