import { StandCapabilities } from '../types';
import { EncryptionService } from './encryption.service';

export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

export enum FieldSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  RESTRICTED = 'restricted',
  CONFIDENTIAL = 'confidential',
}

export interface UserContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  accessLevel: AccessLevel;
}

export interface FieldAccessRule {
  fieldPath: string;
  sensitivity: FieldSensitivity;
  requiredPermissions: string[];
  requiredRole?: string;
  maskingStrategy?: 'partial' | 'full' | 'hash';
}

export interface AccessAuditLog {
  userId: string;
  organizationId: string;
  fieldPath: string;
  action: 'read' | 'write' | 'mask' | 'deny';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

export class FieldAccessService {
  private encryptionService: EncryptionService;
  private accessRules: Map<string, FieldAccessRule>;
  private auditLogs: AccessAuditLog[] = [];

  constructor(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
    this.accessRules = new Map();
    this.initializeAccessRules();
  }

  /**
   * Initialize field access rules
   */
  private initializeAccessRules(): void {
    const rules: FieldAccessRule[] = [
      // Public fields - accessible to all users
      {
        fieldPath: 'dimensions.length',
        sensitivity: FieldSensitivity.PUBLIC,
        requiredPermissions: [],
      },
      {
        fieldPath: 'dimensions.width',
        sensitivity: FieldSensitivity.PUBLIC,
        requiredPermissions: [],
      },
      {
        fieldPath: 'dimensions.icaoCategory',
        sensitivity: FieldSensitivity.PUBLIC,
        requiredPermissions: [],
      },
      {
        fieldPath: 'aircraftCompatibility.supportedAircraftTypes',
        sensitivity: FieldSensitivity.PUBLIC,
        requiredPermissions: [],
      },
      {
        fieldPath: 'groundSupport.hasPowerSupply',
        sensitivity: FieldSensitivity.PUBLIC,
        requiredPermissions: [],
      },
      {
        fieldPath: 'groundSupport.hasJetbridge',
        sensitivity: FieldSensitivity.PUBLIC,
        requiredPermissions: [],
      },

      // Internal fields - require capability_read permission
      {
        fieldPath: 'operationalConstraints.operatingHours',
        sensitivity: FieldSensitivity.INTERNAL,
        requiredPermissions: ['capability_read'],
      },
      {
        fieldPath: 'operationalConstraints.weatherLimitations',
        sensitivity: FieldSensitivity.INTERNAL,
        requiredPermissions: ['capability_read'],
      },
      {
        fieldPath: 'environmentalFeatures.deIcingCapability',
        sensitivity: FieldSensitivity.INTERNAL,
        requiredPermissions: ['capability_read'],
      },
      {
        fieldPath: 'infrastructure.lightingType',
        sensitivity: FieldSensitivity.INTERNAL,
        requiredPermissions: ['capability_read'],
      },
      {
        fieldPath: 'infrastructure.pavementType',
        sensitivity: FieldSensitivity.INTERNAL,
        requiredPermissions: ['capability_read'],
      },

      // Restricted fields - require specific permissions
      {
        fieldPath: 'operationalConstraints.noiseRestrictions',
        sensitivity: FieldSensitivity.RESTRICTED,
        requiredPermissions: ['capability_read', 'noise_data_access'],
        maskingStrategy: 'partial',
      },
      {
        fieldPath: 'operationalConstraints.securityRequirements',
        sensitivity: FieldSensitivity.RESTRICTED,
        requiredPermissions: ['capability_read', 'security_data_access'],
        maskingStrategy: 'partial',
      },
      {
        fieldPath: 'infrastructure.securitySystemDetails',
        sensitivity: FieldSensitivity.RESTRICTED,
        requiredPermissions: ['capability_read', 'security_data_access'],
        maskingStrategy: 'full',
      },
      {
        fieldPath: 'infrastructure.fireSuppressionDetails',
        sensitivity: FieldSensitivity.RESTRICTED,
        requiredPermissions: ['capability_read', 'safety_data_access'],
        maskingStrategy: 'partial',
      },

      // Confidential fields - require admin or specific high-level permissions
      {
        fieldPath: 'maintenanceAccess',
        sensitivity: FieldSensitivity.CONFIDENTIAL,
        requiredPermissions: ['maintenance_management'],
        requiredRole: 'admin',
        maskingStrategy: 'full',
      },
      {
        fieldPath: 'cost',
        sensitivity: FieldSensitivity.CONFIDENTIAL,
        requiredPermissions: ['financial_data_access'],
        maskingStrategy: 'full',
      },
      {
        fieldPath: 'contractorDetails',
        sensitivity: FieldSensitivity.CONFIDENTIAL,
        requiredPermissions: ['contractor_data_access'],
        maskingStrategy: 'partial',
      },
    ];

    rules.forEach((rule) => {
      this.accessRules.set(rule.fieldPath, rule);
    });
  }

  /**
   * Check if user has access to a specific field
   */
  hasFieldAccess(
    fieldPath: string,
    userContext: UserContext,
    action: 'read' | 'write' = 'read'
  ): boolean {
    const rule = this.accessRules.get(fieldPath);

    // If no rule exists, default to internal access
    if (!rule) {
      return (
        this.hasPermission(userContext, ['capability_read']) ||
        userContext.accessLevel === AccessLevel.ADMIN
      );
    }

    // Check role requirement
    if (rule.requiredRole && userContext.role !== rule.requiredRole) {
      return false;
    }

    // Check permissions
    if (rule.requiredPermissions.length > 0) {
      if (!this.hasPermission(userContext, rule.requiredPermissions)) {
        return false;
      }
    }

    // Admin users have access to everything
    if (userContext.accessLevel === AccessLevel.ADMIN) {
      return true;
    }

    // Check access level for write operations
    if (action === 'write' && userContext.accessLevel === AccessLevel.READ) {
      return false;
    }

    return true;
  }

  /**
   * Filter capabilities based on user permissions
   */
  filterCapabilities(capabilities: StandCapabilities, userContext: UserContext): StandCapabilities {
    const filteredCapabilities = { ...capabilities };

    // Process each field recursively
    this.filterObjectFields(filteredCapabilities, '', userContext);

    return filteredCapabilities;
  }

  /**
   * Filter object fields recursively
   */
  private filterObjectFields(obj: any, basePath: string, userContext: UserContext): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fieldPath = basePath ? `${basePath}.${key}` : key;
        const value = obj[key];

        if (!this.hasFieldAccess(fieldPath, userContext, 'read')) {
          // Remove field entirely if no access
          delete obj[key];
          this.logAccess(userContext, fieldPath, 'deny', false, 'Insufficient permissions');
        } else {
          const rule = this.accessRules.get(fieldPath);
          if (rule && rule.maskingStrategy) {
            // Apply masking
            obj[key] = this.applyMasking(value, rule.maskingStrategy);
            this.logAccess(userContext, fieldPath, 'mask', true);
          } else {
            this.logAccess(userContext, fieldPath, 'read', true);
          }

          // Recursively filter nested objects
          if (typeof value === 'object' && value !== null) {
            this.filterObjectFields(value, fieldPath, userContext);
          }
        }
      }
    }
  }

  /**
   * Apply masking to sensitive values
   */
  private applyMasking(value: any, strategy: 'partial' | 'full' | 'hash'): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (strategy) {
      case 'full':
        return '[REDACTED]';

      case 'partial':
        if (typeof value === 'string') {
          if (value.length <= 4) {
            return '*'.repeat(value.length);
          }
          return (
            value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
          );
        }
        if (typeof value === 'number') {
          return '***';
        }
        if (Array.isArray(value)) {
          return value.map((item) => this.applyMasking(item, strategy));
        }
        if (typeof value === 'object') {
          const masked: any = {};
          for (const key in value) {
            if (value.hasOwnProperty(key)) {
              masked[key] = this.applyMasking(value[key], strategy);
            }
          }
          return masked;
        }
        return '[PARTIAL]';

      case 'hash':
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
        return hash.substring(0, 8) + '...';

      default:
        return value;
    }
  }

  /**
   * Check if user has required permissions
   */
  private hasPermission(userContext: UserContext, requiredPermissions: string[]): boolean {
    if (userContext.accessLevel === AccessLevel.ADMIN) {
      return true;
    }

    return requiredPermissions.every((permission) => userContext.permissions.includes(permission));
  }

  /**
   * Log access attempts
   */
  private logAccess(
    userContext: UserContext,
    fieldPath: string,
    action: 'read' | 'write' | 'mask' | 'deny',
    success: boolean,
    reason?: string
  ): void {
    const log: AccessAuditLog = {
      userId: userContext.userId,
      organizationId: userContext.organizationId,
      fieldPath,
      action,
      timestamp: new Date(),
      success,
      reason,
    };

    this.auditLogs.push(log);

    // Keep only last 10000 logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  /**
   * Get access audit logs
   */
  getAuditLogs(
    organizationId: string,
    filters?: {
      userId?: string;
      fieldPath?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      success?: boolean;
    }
  ): AccessAuditLog[] {
    let logs = this.auditLogs.filter((log) => log.organizationId === organizationId);

    if (filters) {
      if (filters.userId) {
        logs = logs.filter((log) => log.userId === filters.userId);
      }
      if (filters.fieldPath) {
        logs = logs.filter((log) => log.fieldPath.includes(filters.fieldPath!));
      }
      if (filters.action) {
        logs = logs.filter((log) => log.action === filters.action);
      }
      if (filters.startDate) {
        logs = logs.filter((log) => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter((log) => log.timestamp <= filters.endDate!);
      }
      if (filters.success !== undefined) {
        logs = logs.filter((log) => log.success === filters.success);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get field access summary for a user
   */
  getFieldAccessSummary(userContext: UserContext): {
    publicFields: string[];
    internalFields: string[];
    restrictedFields: string[];
    confidentialFields: string[];
    deniedFields: string[];
  } {
    const summary = {
      publicFields: [] as string[],
      internalFields: [] as string[],
      restrictedFields: [] as string[],
      confidentialFields: [] as string[],
      deniedFields: [] as string[],
    };

    for (const [fieldPath, rule] of this.accessRules) {
      const hasAccess = this.hasFieldAccess(fieldPath, userContext, 'read');

      if (hasAccess) {
        switch (rule.sensitivity) {
          case FieldSensitivity.PUBLIC:
            summary.publicFields.push(fieldPath);
            break;
          case FieldSensitivity.INTERNAL:
            summary.internalFields.push(fieldPath);
            break;
          case FieldSensitivity.RESTRICTED:
            summary.restrictedFields.push(fieldPath);
            break;
          case FieldSensitivity.CONFIDENTIAL:
            summary.confidentialFields.push(fieldPath);
            break;
        }
      } else {
        summary.deniedFields.push(fieldPath);
      }
    }

    return summary;
  }

  /**
   * Add custom access rule
   */
  addAccessRule(rule: FieldAccessRule): void {
    this.accessRules.set(rule.fieldPath, rule);
  }

  /**
   * Remove access rule
   */
  removeAccessRule(fieldPath: string): void {
    this.accessRules.delete(fieldPath);
  }

  /**
   * Get all access rules
   */
  getAllAccessRules(): Map<string, FieldAccessRule> {
    return new Map(this.accessRules);
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * Export audit logs
   */
  exportAuditLogs(organizationId: string, format: 'json' | 'csv' = 'json'): string {
    const logs = this.getAuditLogs(organizationId);

    if (format === 'csv') {
      const header = 'timestamp,userId,fieldPath,action,success,reason\n';
      const rows = logs
        .map(
          (log) =>
            `${log.timestamp.toISOString()},${log.userId},${log.fieldPath},${log.action},${log.success},${log.reason || ''}`
        )
        .join('\n');
      return header + rows;
    }

    return JSON.stringify(logs, null, 2);
  }
}
