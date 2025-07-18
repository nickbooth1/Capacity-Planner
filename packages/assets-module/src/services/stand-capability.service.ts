import { PrismaClient } from '@prisma/client';
import { StandCapabilityRepository } from '../repositories/stand-capability.repository';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import { StandCapabilities, ValidationResult } from '../types';

export interface CapabilityUpdateEvent {
  standId: string;
  organizationId: string;
  capabilities: Partial<StandCapabilities>;
  userId: string;
  timestamp: Date;
  validationResult: ValidationResult;
}

export interface CapabilityUpdateOptions {
  validateBeforeUpdate?: boolean;
  skipCache?: boolean;
  createSnapshot?: boolean;
}

export interface CapabilityRollbackOptions {
  snapshotId: string;
  userId: string;
  reason?: string;
}

export class StandCapabilityService {
  private repository: StandCapabilityRepository;
  private validationEngine: CapabilityValidationEngine;
  private eventListeners: Array<(event: CapabilityUpdateEvent) => void> = [];

  constructor(private prisma: PrismaClient) {
    this.repository = new StandCapabilityRepository(prisma);
    this.validationEngine = new CapabilityValidationEngine();
  }

  /**
   * Get stand capabilities by ID
   */
  async getCapabilities(standId: string, organizationId: string) {
    const stand = await this.repository.findByIdWithCapabilities(standId, organizationId);

    if (!stand) {
      throw new Error(`Stand with ID ${standId} not found`);
    }

    return {
      stand,
      capabilities: stand.capabilities,
    };
  }

  /**
   * Update stand capabilities with validation
   */
  async updateCapabilities(
    standId: string,
    organizationId: string,
    capabilities: Partial<StandCapabilities>,
    userId: string,
    options: CapabilityUpdateOptions = {}
  ) {
    const { validateBeforeUpdate = true, skipCache = false, createSnapshot = true } = options;

    // Get current capabilities
    const currentStand = await this.repository.findByIdWithCapabilities(standId, organizationId);
    if (!currentStand) {
      throw new Error(`Stand with ID ${standId} not found`);
    }

    // Merge new capabilities with existing ones
    const mergedCapabilities: StandCapabilities = {
      ...currentStand.capabilities,
      ...capabilities,
    };

    // Validate if requested
    let validationResult: ValidationResult | null = null;
    if (validateBeforeUpdate) {
      const validationResponse = await this.validationEngine.validate(mergedCapabilities, {
        useCache: !skipCache,
      });
      validationResult = validationResponse.result;

      if (!validationResult.isValid) {
        throw new Error(
          `Capability validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    // Update capabilities
    const updatedStand = await this.repository.updateCapabilities(
      standId,
      organizationId,
      capabilities,
      createSnapshot ? userId : undefined
    );

    // Clear validation cache for this stand
    if (!skipCache) {
      await this.validationEngine.invalidateCache(updatedStand.capabilities!);
    }

    // Publish event
    const event: CapabilityUpdateEvent = {
      standId,
      organizationId,
      capabilities,
      userId,
      timestamp: new Date(),
      validationResult: validationResult || {
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
        timestamp: new Date(),
      },
    };

    this.publishEvent(event);

    return {
      stand: updatedStand,
      validationResult,
    };
  }

  /**
   * Bulk update capabilities for multiple stands
   */
  async bulkUpdateCapabilities(
    operations: Array<{
      standId: string;
      capabilities: Partial<StandCapabilities>;
    }>,
    organizationId: string,
    userId: string,
    options: CapabilityUpdateOptions = {}
  ) {
    const { validateBeforeUpdate = true, skipCache = false } = options;

    const results: Array<{
      standId: string;
      success: boolean;
      error?: string;
      validationResult?: ValidationResult;
    }> = [];

    // Validate all operations first if requested
    if (validateBeforeUpdate) {
      for (const operation of operations) {
        try {
          const currentStand = await this.repository.findByIdWithCapabilities(
            operation.standId,
            organizationId
          );

          if (!currentStand) {
            results.push({
              standId: operation.standId,
              success: false,
              error: 'Stand not found',
            });
            continue;
          }

          const mergedCapabilities: StandCapabilities = {
            ...currentStand.capabilities,
            ...operation.capabilities,
          };

          const validationResponse = await this.validationEngine.validate(mergedCapabilities, {
            useCache: !skipCache,
          });

          if (!validationResponse.result.isValid) {
            results.push({
              standId: operation.standId,
              success: false,
              error: `Validation failed: ${validationResponse.result.errors.map((e) => e.message).join(', ')}`,
              validationResult: validationResponse.result,
            });
          } else {
            results.push({
              standId: operation.standId,
              success: true,
              validationResult: validationResponse.result,
            });
          }
        } catch (error) {
          results.push({
            standId: operation.standId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // If any validations failed, return without updating
      const failedOperations = results.filter((r) => !r.success);
      if (failedOperations.length > 0) {
        return {
          totalOperations: operations.length,
          successful: 0,
          failed: failedOperations.length,
          results,
        };
      }
    }

    // Perform bulk update
    const bulkResult = await this.repository.bulkUpdateCapabilities(
      operations,
      organizationId,
      userId
    );

    // Clear cache for updated stands
    if (!skipCache) {
      const clearCachePromises = operations.map(async (operation) => {
        try {
          const stand = await this.repository.findByIdWithCapabilities(
            operation.standId,
            organizationId
          );
          if (stand?.capabilities) {
            await this.validationEngine.invalidateCache(stand.capabilities);
          }
        } catch (error) {
          console.error(`Failed to clear cache for stand ${operation.standId}:`, error);
        }
      });

      await Promise.all(clearCachePromises);
    }

    // Publish events for successful updates
    const successfulOperations = operations.filter(
      (op) => !bulkResult.errors.some((e) => e.standId === op.standId)
    );

    for (const operation of successfulOperations) {
      const event: CapabilityUpdateEvent = {
        standId: operation.standId,
        organizationId,
        capabilities: operation.capabilities,
        userId,
        timestamp: new Date(),
        validationResult: results.find((r) => r.standId === operation.standId)
          ?.validationResult || {
          isValid: true,
          errors: [],
          warnings: [],
          icaoCompliant: true,
          timestamp: new Date(),
        },
      };

      this.publishEvent(event);
    }

    return {
      totalOperations: operations.length,
      successful: bulkResult.updated,
      failed: bulkResult.failed,
      results: bulkResult.errors.map((error) => ({
        standId: error.standId,
        success: false,
        error: error.error,
      })),
    };
  }

  /**
   * Validate stand capabilities
   */
  async validateCapabilities(
    capabilities: StandCapabilities,
    options: { useCache?: boolean; performanceTracking?: boolean } = {}
  ) {
    const { useCache = true, performanceTracking = false } = options;

    return await this.validationEngine.validate(capabilities, {
      useCache,
      performanceTracking,
    });
  }

  /**
   * Query stands by capabilities
   */
  async queryByCapabilities(filters: {
    organizationId?: string;
    icaoCategory?: string;
    hasJetbridge?: boolean;
    minLength?: number;
    maxLength?: number;
    minWidth?: number;
    maxWidth?: number;
    groundSupportType?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.repository.queryByCapabilities(filters);
  }

  /**
   * Get capability statistics
   */
  async getCapabilityStatistics(organizationId: string) {
    const stats = await this.repository.getCapabilityStatistics(organizationId);

    // Add validation cache metrics
    const cacheMetrics = this.validationEngine.getCacheMetrics();

    return {
      ...stats,
      validationMetrics: {
        cacheHitRate: cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses) || 0,
        totalValidations: cacheMetrics.hits + cacheMetrics.misses,
        cacheErrors: cacheMetrics.errors,
      },
    };
  }

  /**
   * Get capability history for a stand
   */
  async getCapabilityHistory(standId: string, organizationId: string, limit: number = 20) {
    return await this.repository.getCapabilityHistory(standId, organizationId, limit);
  }

  /**
   * Rollback to previous capability configuration
   */
  async rollbackCapabilities(
    standId: string,
    organizationId: string,
    options: CapabilityRollbackOptions
  ) {
    const { snapshotId, userId, reason } = options;

    // Get the snapshot
    const snapshots = await this.repository.getCapabilityHistory(standId, organizationId, 100);
    const snapshot = snapshots.find((s) => s.id === snapshotId);

    if (!snapshot) {
      throw new Error(`Snapshot with ID ${snapshotId} not found`);
    }

    // Apply the snapshot capabilities
    const result = await this.updateCapabilities(
      standId,
      organizationId,
      snapshot.capabilities,
      userId,
      { validateBeforeUpdate: true }
    );

    // Create a rollback snapshot
    await this.prisma.standCapabilitySnapshot.create({
      data: {
        standId,
        capabilities: snapshot.capabilities,
        changeType: 'ROLLBACK',
        changedFields: Object.keys(snapshot.capabilities),
        userId,
        metadata: {
          originalSnapshotId: snapshotId,
          reason,
        },
      },
    });

    return result;
  }

  /**
   * Clear validation cache
   */
  async clearValidationCache() {
    await this.validationEngine.clearCache();
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: CapabilityUpdateEvent) => void) {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: CapabilityUpdateEvent) => void) {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Publish event to all listeners
   */
  private publishEvent(event: CapabilityUpdateEvent) {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in capability update event listener:', error);
      }
    });
  }
}
