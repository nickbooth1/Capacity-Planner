import { Request, Response, NextFunction } from 'express';

export interface FieldAccessConfig {
  resource: string;
  fields: {
    [fieldName: string]: {
      read?: string[]; // Required permissions to read
      write?: string[]; // Required permissions to write
      mask?: boolean; // Mask field value if no permission
    };
  };
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    permissions: string[];
  };
}

export class FieldAccessControl {
  private configs: Map<string, FieldAccessConfig> = new Map();

  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs(): void {
    // Stand resource field access configuration
    this.configs.set('stand', {
      resource: 'stand',
      fields: {
        // Basic fields - readable by all
        id: { read: ['stands.read'] },
        code: { read: ['stands.read'], write: ['stands.update'] },
        name: { read: ['stands.read'], write: ['stands.update'] },
        terminal: { read: ['stands.read'], write: ['stands.update'] },
        status: { read: ['stands.read'], write: ['stands.update'] },

        // Dimensional data - readable by all, writable with permission
        dimensions: { read: ['stands.read'], write: ['stands.update'] },
        aircraftCompatibility: { read: ['stands.read'], write: ['stands.update'] },

        // Operational data - requires additional permissions
        groundSupport: {
          read: ['stands.read', 'stands.operations'],
          write: ['stands.update', 'stands.operations'],
        },
        operationalConstraints: {
          read: ['stands.read', 'stands.operations'],
          write: ['stands.update', 'stands.operations'],
        },

        // Environmental data - restricted access
        environmentalFeatures: {
          read: ['stands.read', 'stands.environmental'],
          write: ['stands.update', 'stands.environmental'],
        },

        // Infrastructure data - restricted access
        infrastructure: {
          read: ['stands.read', 'stands.infrastructure'],
          write: ['stands.update', 'stands.infrastructure'],
        },

        // Location data - may be sensitive
        latitude: {
          read: ['stands.read', 'stands.location'],
          write: ['stands.update', 'stands.location'],
          mask: true,
        },
        longitude: {
          read: ['stands.read', 'stands.location'],
          write: ['stands.update', 'stands.location'],
          mask: true,
        },
        geometry: {
          read: ['stands.read', 'stands.location'],
          write: ['stands.update', 'stands.location'],
        },

        // Metadata - admin only
        metadata: {
          read: ['stands.read', 'admin'],
          write: ['stands.update', 'admin'],
        },

        // Audit fields - read-only, restricted
        createdAt: { read: ['stands.read'] },
        updatedAt: { read: ['stands.read'] },
        createdBy: { read: ['stands.read', 'audit.read'] },
        updatedBy: { read: ['stands.read', 'audit.read'] },

        // Soft delete fields - admin only
        isDeleted: { read: ['admin'], write: ['admin'] },
        deletedAt: { read: ['admin'], write: ['admin'] },
        deletedBy: { read: ['admin'], write: ['admin'] },

        // Version field - internal
        version: { read: ['stands.read'] },
      },
    });

    // Stand import job field access
    this.configs.set('standImportJob', {
      resource: 'standImportJob',
      fields: {
        id: { read: ['stands.import'] },
        organizationId: { read: ['stands.import'] },
        filename: { read: ['stands.import'] },
        fileUrl: { read: ['stands.import', 'admin'], mask: true },
        status: { read: ['stands.import'] },
        totalRows: { read: ['stands.import'] },
        processedRows: { read: ['stands.import'] },
        successRows: { read: ['stands.import'] },
        errorRows: { read: ['stands.import'] },
        errors: { read: ['stands.import'] },
        startedAt: { read: ['stands.import'] },
        completedAt: { read: ['stands.import'] },
        createdBy: { read: ['stands.import', 'audit.read'] },
        createdAt: { read: ['stands.import'] },
      },
    });

    // Audit event field access
    this.configs.set('auditEvent', {
      resource: 'auditEvent',
      fields: {
        id: { read: ['audit.read'] },
        organizationId: { read: ['audit.read'] },
        userId: { read: ['audit.read'] },
        eventType: { read: ['audit.read'] },
        severity: { read: ['audit.read'] },
        resource: { read: ['audit.read'] },
        resourceId: { read: ['audit.read'] },
        action: { read: ['audit.read'] },
        details: { read: ['audit.read', 'admin'], mask: true },
        metadata: { read: ['audit.read', 'admin'], mask: true },
        timestamp: { read: ['audit.read'] },
        success: { read: ['audit.read'] },
        errorMessage: { read: ['audit.read'] },
      },
    });
  }

  private hasPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
    // Admin always has access
    if (userPermissions.includes('admin')) {
      return true;
    }

    // Check if user has any of the required permissions
    return requiredPermissions.some((permission) => userPermissions.includes(permission));
  }

  public filterReadFields(resource: string, data: any, userPermissions: string[]): any {
    const config = this.configs.get(resource);
    if (!config) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.filterReadFields(resource, item, userPermissions));
    }

    const filtered: any = {};

    for (const [field, value] of Object.entries(data)) {
      const fieldConfig = config.fields[field];

      if (!fieldConfig) {
        // Field not in config, include by default
        filtered[field] = value;
        continue;
      }

      if (fieldConfig.read && !this.hasPermission(userPermissions, fieldConfig.read)) {
        // No read permission
        if (fieldConfig.mask) {
          filtered[field] = '***'; // Masked value
        }
        // Otherwise, omit the field
      } else {
        filtered[field] = value;
      }
    }

    return filtered;
  }

  public filterWriteFields(
    resource: string,
    data: any,
    userPermissions: string[]
  ): { allowed: any; denied: string[] } {
    const config = this.configs.get(resource);
    if (!config) {
      return { allowed: data, denied: [] };
    }

    const allowed: any = {};
    const denied: string[] = [];

    for (const [field, value] of Object.entries(data)) {
      const fieldConfig = config.fields[field];

      if (!fieldConfig || !fieldConfig.write) {
        // Field not restricted for write, allow it
        allowed[field] = value;
        continue;
      }

      if (this.hasPermission(userPermissions, fieldConfig.write)) {
        allowed[field] = value;
      } else {
        denied.push(field);
      }
    }

    return { allowed, denied };
  }

  public middleware(resource: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const originalJson = res.json.bind(res);
      const userPermissions = req.user?.permissions || [];

      // Override res.json to filter response data
      res.json = (body: any) => {
        if (body && typeof body === 'object') {
          // Filter based on resource type
          if (body.data) {
            body.data = this.filterReadFields(resource, body.data, userPermissions);
          } else if (body.success && body.stand) {
            body.stand = this.filterReadFields(resource, body.stand, userPermissions);
          } else if (Array.isArray(body)) {
            body = this.filterReadFields(resource, body, userPermissions);
          }
        }
        return originalJson(body);
      };

      // Filter request body for write operations
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        if (req.body) {
          const { allowed, denied } = this.filterWriteFields(resource, req.body, userPermissions);

          if (denied.length > 0) {
            // Log denied fields for audit
            console.warn(
              `User ${req.user?.id} denied write access to fields: ${denied.join(', ')}`
            );

            // Optionally return error if critical fields are denied
            const criticalFields = ['code', 'name']; // Define critical fields
            const deniedCritical = denied.filter((field) => criticalFields.includes(field));

            if (deniedCritical.length > 0) {
              return res.status(403).json({
                success: false,
                error: `Insufficient permissions to modify fields: ${deniedCritical.join(', ')}`,
              });
            }
          }

          req.body = allowed;
        }
      }

      next();
    };
  }
}

export const fieldAccessControl = new FieldAccessControl();
