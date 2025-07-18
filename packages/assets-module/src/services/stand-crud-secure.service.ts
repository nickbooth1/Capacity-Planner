import { PrismaClient } from '@prisma/client';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import { AuditService, AuditContext } from './audit.service';
import { EncryptionService } from './encryption.service';
import { SecurityValidator } from '../utils/security-validation';
import {
  CreateStandRequest,
  UpdateStandRequest,
  Stand,
  StandFilters,
  PaginatedResponse,
} from '../types/stand-capabilities';

export interface SecureServiceContext extends AuditContext {
  permissions: string[];
}

export class StandCRUDSecureService {
  private auditService: AuditService;
  private encryptionService: EncryptionService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly validationEngine: CapabilityValidationEngine
  ) {
    this.auditService = new AuditService(prisma);
    this.encryptionService = new EncryptionService();
  }

  /**
   * Create a new stand with security checks
   */
  async createStand(context: SecureServiceContext, data: CreateStandRequest): Promise<Stand> {
    try {
      // Validate permissions
      if (
        !context.permissions.includes('stands.create') &&
        !context.permissions.includes('admin')
      ) {
        await this.auditService.logAccessDenied(
          context,
          'stand',
          'create',
          'Missing stands.create permission'
        );
        throw new Error('Insufficient permissions to create stands');
      }

      // Validate and sanitize input
      const codeValidation = SecurityValidator.validateStandCode(data.code);
      if (!codeValidation.valid) {
        throw new Error(codeValidation.error);
      }
      data.code = codeValidation.sanitized;

      // Validate name
      data.name = SecurityValidator.sanitizeString(data.name);
      if (data.name.length < 1 || data.name.length > 100) {
        throw new Error('Stand name must be between 1 and 100 characters');
      }

      // Validate terminal if provided
      if (data.terminal) {
        const terminalValidation = SecurityValidator.validateTerminal(data.terminal);
        if (!terminalValidation.valid) {
          throw new Error(terminalValidation.error);
        }
        data.terminal = terminalValidation.sanitized;
      }

      // Validate JSON fields
      const jsonFields = [
        'dimensions',
        'aircraftCompatibility',
        'groundSupport',
        'operationalConstraints',
        'environmentalFeatures',
        'infrastructure',
      ];

      for (const field of jsonFields) {
        if (data[field as keyof CreateStandRequest]) {
          const validation = SecurityValidator.validateJsonData(
            data[field as keyof CreateStandRequest]
          );
          if (!validation.valid) {
            throw new Error(`Invalid ${field}: ${validation.error}`);
          }
        }
      }

      // Check for duplicate
      const existing = await this.prisma.stand.findFirst({
        where: {
          organizationId: context.organizationId,
          code: data.code,
          isDeleted: false,
        },
      });

      if (existing) {
        throw new Error(`Stand with code ${data.code} already exists`);
      }

      // Build capability data
      const capabilityData = {
        dimensions: data.dimensions || {},
        aircraftCompatibility: data.aircraftCompatibility || {},
        groundSupport: data.groundSupport || {},
        operationalConstraints: data.operationalConstraints || {},
        environmentalFeatures: data.environmentalFeatures || {},
        infrastructure: data.infrastructure || {},
      };

      // Validate capabilities
      const validationResult = await this.validationEngine.validate(capabilityData);
      if (!validationResult.isValid) {
        await this.auditService.logValidationFailure(
          context,
          'stand',
          'new',
          validationResult.errors
        );
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Encrypt sensitive fields
      const encryptedData = await this.encryptionService.encryptStandData({
        ...data,
        metadata: data.metadata || {},
      });

      // Create stand with transaction
      const stand = await this.prisma.$transaction(async (tx) => {
        // Create stand
        const created = await tx.stand.create({
          data: {
            organizationId: context.organizationId,
            code: data.code,
            name: data.name,
            terminal: data.terminal,
            status: data.status || 'operational',
            dimensions: capabilityData.dimensions,
            aircraftCompatibility: capabilityData.aircraftCompatibility,
            groundSupport: capabilityData.groundSupport,
            operationalConstraints: capabilityData.operationalConstraints,
            environmentalFeatures: capabilityData.environmentalFeatures,
            infrastructure: capabilityData.infrastructure,
            geometry: data.geometry,
            latitude: data.latitude,
            longitude: data.longitude,
            metadata: encryptedData.metadata,
            createdBy: context.userId,
            updatedBy: context.userId,
          },
        });

        // Create capability snapshot
        await tx.standCapabilitySnapshot.create({
          data: {
            standId: created.id,
            organizationId: context.organizationId,
            snapshotType: 'manual',
            previousCapabilities: {},
            newCapabilities: capabilityData,
            changedFields: Object.keys(capabilityData),
            validationResults: validationResult,
            reason: 'Initial creation',
            createdBy: context.userId,
          },
        });

        return created;
      });

      // Log audit event
      await this.auditService.logStandCreated(context, stand.id, stand);

      // Decrypt sensitive fields before returning
      return this.encryptionService.decryptStandData(stand);
    } catch (error: any) {
      // Log security event for suspicious activity
      if (this.isSecurityThreat(error.message)) {
        await this.auditService.logSecurityEvent(context, 'suspicious_input', 'high', {
          action: 'create_stand',
          error: error.message,
          input: { code: data.code },
        });
      }

      throw error;
    }
  }

  /**
   * Update a stand with security checks
   */
  async updateStand(
    context: SecureServiceContext,
    standId: string,
    data: UpdateStandRequest
  ): Promise<Stand> {
    try {
      // Validate permissions
      if (
        !context.permissions.includes('stands.update') &&
        !context.permissions.includes('admin')
      ) {
        await this.auditService.logAccessDenied(
          context,
          'stand',
          'update',
          'Missing stands.update permission'
        );
        throw new Error('Insufficient permissions to update stands');
      }

      // Validate stand ID (UUID format)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(standId)) {
        throw new Error('Invalid stand ID format');
      }

      // Get existing stand
      const existing = await this.prisma.stand.findFirst({
        where: {
          id: standId,
          organizationId: context.organizationId,
          isDeleted: false,
        },
      });

      if (!existing) {
        throw new Error('Stand not found');
      }

      // Check version for optimistic locking
      if (data.version !== existing.version) {
        throw new Error('Stand has been modified by another user');
      }

      // Validate and sanitize updates
      const updates: any = {};

      if (data.code !== undefined) {
        const codeValidation = SecurityValidator.validateStandCode(data.code);
        if (!codeValidation.valid) {
          throw new Error(codeValidation.error);
        }
        updates.code = codeValidation.sanitized;
      }

      if (data.name !== undefined) {
        updates.name = SecurityValidator.sanitizeString(data.name);
      }

      if (data.terminal !== undefined) {
        const terminalValidation = SecurityValidator.validateTerminal(data.terminal);
        if (!terminalValidation.valid) {
          throw new Error(terminalValidation.error);
        }
        updates.terminal = terminalValidation.sanitized;
      }

      // Validate capability updates
      const capabilityFields = [
        'dimensions',
        'aircraftCompatibility',
        'groundSupport',
        'operationalConstraints',
        'environmentalFeatures',
        'infrastructure',
      ];

      const capabilityUpdates: any = {};
      for (const field of capabilityFields) {
        if (data[field as keyof UpdateStandRequest] !== undefined) {
          const validation = SecurityValidator.validateJsonData(
            data[field as keyof UpdateStandRequest]
          );
          if (!validation.valid) {
            throw new Error(`Invalid ${field}: ${validation.error}`);
          }
          updates[field] = data[field as keyof UpdateStandRequest];
          capabilityUpdates[field] = data[field as keyof UpdateStandRequest];
        }
      }

      // Validate merged capabilities
      if (Object.keys(capabilityUpdates).length > 0) {
        const mergedCapabilities = {
          dimensions: updates.dimensions || existing.dimensions,
          aircraftCompatibility: updates.aircraftCompatibility || existing.aircraftCompatibility,
          groundSupport: updates.groundSupport || existing.groundSupport,
          operationalConstraints: updates.operationalConstraints || existing.operationalConstraints,
          environmentalFeatures: updates.environmentalFeatures || existing.environmentalFeatures,
          infrastructure: updates.infrastructure || existing.infrastructure,
        };

        const validationResult = await this.validationEngine.validate(mergedCapabilities);
        if (!validationResult.isValid) {
          await this.auditService.logValidationFailure(
            context,
            'stand',
            standId,
            validationResult.errors
          );
          throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Encrypt sensitive fields
      if (data.metadata) {
        const encrypted = await this.encryptionService.encryptFields({ metadata: data.metadata }, [
          'metadata',
        ]);
        updates.metadata = encrypted.metadata;
      }

      // Update with transaction
      const updated = await this.prisma.$transaction(async (tx) => {
        // Update stand
        const result = await tx.stand.update({
          where: { id: standId },
          data: {
            ...updates,
            version: { increment: 1 },
            updatedBy: context.userId,
          },
        });

        // Create capability snapshot if capabilities changed
        if (Object.keys(capabilityUpdates).length > 0) {
          await tx.standCapabilitySnapshot.create({
            data: {
              standId: result.id,
              organizationId: context.organizationId,
              snapshotType: 'manual',
              previousCapabilities: {
                dimensions: existing.dimensions,
                aircraftCompatibility: existing.aircraftCompatibility,
                groundSupport: existing.groundSupport,
                operationalConstraints: existing.operationalConstraints,
                environmentalFeatures: existing.environmentalFeatures,
                infrastructure: existing.infrastructure,
              },
              newCapabilities: capabilityUpdates,
              changedFields: Object.keys(capabilityUpdates),
              reason: 'Manual update',
              createdBy: context.userId,
            },
          });
        }

        // Log status change if applicable
        if (updates.status && updates.status !== existing.status) {
          await tx.standStatusHistory.create({
            data: {
              standId: result.id,
              fromStatus: existing.status,
              toStatus: updates.status,
              reason: 'Manual update',
              changedBy: context.userId,
            },
          });
        }

        return result;
      });

      // Log audit event
      await this.auditService.logStandUpdated(context, standId, updates, existing);

      // Decrypt sensitive fields before returning
      return this.encryptionService.decryptStandData(updated);
    } catch (error: any) {
      // Log security event for suspicious activity
      if (this.isSecurityThreat(error.message)) {
        await this.auditService.logSecurityEvent(context, 'suspicious_update', 'high', {
          action: 'update_stand',
          standId,
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Delete (soft) a stand with security checks
   */
  async deleteStand(
    context: SecureServiceContext,
    standId: string,
    reason?: string
  ): Promise<void> {
    // Validate permissions
    if (!context.permissions.includes('stands.delete') && !context.permissions.includes('admin')) {
      await this.auditService.logAccessDenied(
        context,
        'stand',
        'delete',
        'Missing stands.delete permission'
      );
      throw new Error('Insufficient permissions to delete stands');
    }

    // Validate stand ID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(standId)) {
      throw new Error('Invalid stand ID format');
    }

    const stand = await this.prisma.stand.findFirst({
      where: {
        id: standId,
        organizationId: context.organizationId,
        isDeleted: false,
      },
    });

    if (!stand) {
      throw new Error('Stand not found');
    }

    // Soft delete
    await this.prisma.stand.update({
      where: { id: standId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: context.userId,
        updatedBy: context.userId,
      },
    });

    // Log audit event
    await this.auditService.logStandDeleted(context, standId, stand.code, reason);
  }

  /**
   * Get stands with security filtering
   */
  async getStands(
    context: SecureServiceContext,
    filters: StandFilters
  ): Promise<PaginatedResponse<Stand>> {
    // Validate permissions
    if (!context.permissions.includes('stands.read') && !context.permissions.includes('admin')) {
      await this.auditService.logAccessDenied(
        context,
        'stand',
        'read',
        'Missing stands.read permission'
      );
      throw new Error('Insufficient permissions to view stands');
    }

    // Validate pagination
    const paginationValidation = SecurityValidator.validatePagination(
      filters.page || 1,
      filters.pageSize || 50
    );

    if (!paginationValidation.valid) {
      throw new Error(paginationValidation.error);
    }

    const page = paginationValidation.page;
    const pageSize = paginationValidation.pageSize;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {
      organizationId: context.organizationId,
      isDeleted: false,
    };

    // Apply filters with validation
    if (filters.search) {
      const search = SecurityValidator.sanitizeString(filters.search);
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      if (!['operational', 'maintenance', 'closed'].includes(filters.status)) {
        throw new Error('Invalid status filter');
      }
      where.status = filters.status;
    }

    if (filters.terminal) {
      where.terminal = SecurityValidator.sanitizeString(filters.terminal);
    }

    // Get data with count
    const [stands, total] = await Promise.all([
      this.prisma.stand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: filters.sortBy
          ? { [filters.sortBy]: filters.sortOrder || 'asc' }
          : { createdAt: 'desc' },
      }),
      this.prisma.stand.count({ where }),
    ]);

    // Decrypt sensitive fields
    const decryptedStands = await Promise.all(
      stands.map((stand) => this.encryptionService.decryptStandData(stand))
    );

    // Log data export if large result set
    if (total > 100) {
      await this.auditService.logDataExport(context, 'stand', 'json', total, filters);
    }

    return {
      data: decryptedStands,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Check if error message indicates security threat
   */
  private isSecurityThreat(message: string): boolean {
    const threatPatterns = [
      /sql.*injection/i,
      /xss/i,
      /script.*tag/i,
      /invalid.*character/i,
      /suspicious.*pattern/i,
    ];

    return threatPatterns.some((pattern) => pattern.test(message));
  }
}
