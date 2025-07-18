import { Stand } from '@prisma/client';
import { StandCapabilityRepository } from '../repositories/stand-capability.repository';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';
import { StandCache } from '../cache/stand-cache';
import { getPrismaClient } from '../config/database.config';
import {
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
  PaginatedResult,
  StandCapabilities,
} from '../types';

export class StandCRUDOptimizedService {
  private repository: StandCapabilityRepository;
  private cache: StandCache;
  private prisma: ReturnType<typeof getPrismaClient>;

  constructor(private validationEngine: CapabilityValidationEngine) {
    this.prisma = getPrismaClient();
    this.repository = new StandCapabilityRepository(this.prisma);
    this.cache = new StandCache();
  }

  /**
   * Create a new stand with validation
   */
  async createStand(
    organizationId: string,
    data: CreateStandRequest,
    userId: string
  ): Promise<Stand> {
    // Check if code already exists
    const existingStand = await this.repository.existsByCode(data.code, organizationId);
    if (existingStand) {
      throw new Error(`Stand with code '${data.code}' already exists`);
    }

    // Validate capabilities if provided
    if (this.hasCapabilityData(data)) {
      const capabilities = this.extractCapabilities(data);
      const validationResult = await this.validationEngine.validate(capabilities);

      if (!validationResult.valid) {
        throw new Error(
          `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    // Create the stand
    const stand = await this.repository.create(organizationId, data, userId);

    // Cache the new stand
    await this.cache.setStand(stand, organizationId);

    // Invalidate list caches and stats
    await this.cache.invalidateListCaches(organizationId);
    await this.cache.invalidateStats(organizationId);

    // Publish event (if event system is available)
    await this.publishStandEvent('created', stand, userId);

    return stand;
  }

  /**
   * Update an existing stand with validation and optimistic locking
   */
  async updateStand(
    standId: string,
    organizationId: string,
    data: UpdateStandRequest,
    userId: string
  ): Promise<Stand> {
    // Validate code uniqueness if code is being updated
    if (data.code) {
      const existingStand = await this.repository.existsByCode(data.code, organizationId, standId);
      if (existingStand) {
        throw new Error(`Stand with code '${data.code}' already exists`);
      }
    }

    // Get current stand (try cache first)
    let currentStand = await this.cache.getStand(standId, organizationId);
    if (!currentStand) {
      currentStand = await this.repository.findById(standId, organizationId);
      if (!currentStand) {
        throw new Error('Stand not found');
      }
    }

    // Validate capabilities if provided
    if (this.hasCapabilityData(data)) {
      const capabilities = this.extractCapabilities(data);
      const validationResult = await this.validationEngine.validate(capabilities);

      if (!validationResult.valid) {
        throw new Error(
          `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    try {
      // Update the stand (optimistic locking will throw if version doesn't match)
      const updatedStand = await this.repository.update(standId, organizationId, data, userId);

      // Update cache
      await this.cache.setStand(updatedStand, organizationId);

      // Invalidate list caches and stats
      await this.cache.invalidateListCaches(organizationId);
      await this.cache.invalidateStats(organizationId);

      // Publish event
      await this.publishStandEvent('updated', updatedStand, userId);

      return updatedStand;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new Error('Stand was modified by another user. Please refresh and try again.');
      }
      throw error;
    }
  }

  /**
   * Delete a stand (soft delete)
   */
  async deleteStand(standId: string, organizationId: string, userId: string): Promise<void> {
    // Check if stand exists (try cache first)
    let stand = await this.cache.getStand(standId, organizationId);
    if (!stand) {
      stand = await this.repository.findById(standId, organizationId);
      if (!stand) {
        throw new Error('Stand not found');
      }
    }

    // Soft delete the stand
    await this.repository.softDelete(standId, organizationId, userId);

    // Invalidate caches
    await this.cache.invalidateStand(standId, organizationId);

    // Publish event
    await this.publishStandEvent('deleted', stand, userId);
  }

  /**
   * Get a stand by ID with caching
   */
  async getStandById(
    standId: string,
    organizationId: string,
    includeDeleted: boolean = false
  ): Promise<Stand | null> {
    // Try cache first (only for non-deleted stands)
    if (!includeDeleted) {
      const cachedStand = await this.cache.getStand(standId, organizationId);
      if (cachedStand) {
        return cachedStand;
      }
    }

    // Fetch from database
    const stand = await this.repository.findById(standId, organizationId, includeDeleted);

    // Cache the result if found and not deleted
    if (stand && !includeDeleted) {
      await this.cache.setStand(stand, organizationId);
    }

    return stand;
  }

  /**
   * Get all stands with pagination, filtering, and caching
   */
  async getStands(
    organizationId: string,
    filters: StandFilters = {},
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedResult<Stand>> {
    // Try cache first
    const cachedResult = await this.cache.getStandList(organizationId, filters, page, pageSize);
    if (cachedResult) {
      return cachedResult;
    }

    // Fetch from database with optimized query
    const result = await this.repository.findAll(organizationId, filters, page, pageSize);

    // Cache the result
    await this.cache.setStandList(result, organizationId, filters, page, pageSize);

    return result;
  }

  /**
   * Get stand statistics with caching
   */
  async getStandStats(organizationId: string): Promise<{
    total: number;
    operational: number;
    maintenance: number;
    closed: number;
    byTerminal: Record<string, number>;
  }> {
    // Try cache first
    const cachedStats = await this.cache.getStats(organizationId);
    if (cachedStats) {
      return cachedStats;
    }

    // Use optimized queries with aggregation
    const [statusCounts, terminalCounts, totalCount] = await Promise.all([
      // Get counts by status
      this.prisma.stand.groupBy({
        by: ['status'],
        where: {
          organizationId,
          isDeleted: false,
        },
        _count: {
          status: true,
        },
      }),
      // Get counts by terminal
      this.prisma.stand.groupBy({
        by: ['terminal'],
        where: {
          organizationId,
          isDeleted: false,
        },
        _count: {
          terminal: true,
        },
      }),
      // Get total count
      this.prisma.stand.count({
        where: {
          organizationId,
          isDeleted: false,
        },
      }),
    ]);

    // Process the results
    const byStatus = { operational: 0, maintenance: 0, closed: 0 };
    statusCounts.forEach((item) => {
      if (item.status in byStatus) {
        byStatus[item.status as keyof typeof byStatus] = item._count.status;
      }
    });

    const byTerminal: Record<string, number> = {};
    terminalCounts.forEach((item) => {
      const terminal = item.terminal || 'Unassigned';
      byTerminal[terminal] = item._count.terminal;
    });

    const stats = {
      total: totalCount,
      operational: byStatus.operational,
      maintenance: byStatus.maintenance,
      closed: byStatus.closed,
      byTerminal,
    };

    // Cache the stats
    await this.cache.setStats(stats, organizationId);

    return stats;
  }

  /**
   * Bulk create stands with batch processing
   */
  async bulkCreateStands(
    organizationId: string,
    stands: CreateStandRequest[],
    userId: string
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    const results = {
      created: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < stands.length; i += batchSize) {
      const batch = stands.slice(i, i + batchSize);

      // Validate all stands in the batch
      const validStands: CreateStandRequest[] = [];
      for (const stand of batch) {
        try {
          // Check for duplicate codes
          const exists = await this.repository.existsByCode(stand.code, organizationId);
          if (exists) {
            results.failed++;
            results.errors.push(`Stand with code '${stand.code}' already exists`);
            continue;
          }

          // Validate capabilities
          if (this.hasCapabilityData(stand)) {
            const capabilities = this.extractCapabilities(stand);
            const validationResult = await this.validationEngine.validate(capabilities);

            if (!validationResult.valid) {
              results.failed++;
              results.errors.push(
                `Stand ${stand.code}: ${validationResult.errors.map((e) => e.message).join(', ')}`
              );
              continue;
            }
          }

          validStands.push(stand);
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Stand ${stand.code}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Bulk create valid stands
      if (validStands.length > 0) {
        try {
          await this.prisma.stand.createMany({
            data: validStands.map((stand) => ({
              organizationId,
              code: stand.code,
              name: stand.name,
              terminal: stand.terminal,
              status: stand.status || 'operational',
              dimensions: stand.dimensions || {},
              aircraftCompatibility: stand.aircraftCompatibility || {},
              groundSupport: stand.groundSupport || {},
              operationalConstraints: stand.operationalConstraints || {},
              environmentalFeatures: stand.environmentalFeatures || {},
              infrastructure: stand.infrastructure || {},
              geometry: stand.geometry,
              latitude: stand.latitude,
              longitude: stand.longitude,
              metadata: stand.metadata || {},
              createdBy: userId,
              updatedBy: userId,
            })),
          });

          results.created += validStands.length;
        } catch (error) {
          results.failed += validStands.length;
          results.errors.push(
            `Batch creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    // Clear caches after bulk operation
    await this.cache.clearOrganizationCache(organizationId);

    return results;
  }

  /**
   * Warm cache with frequently accessed stands
   */
  async warmCache(organizationId: string, limit: number = 100): Promise<void> {
    // Get most recently accessed stands
    const recentStands = await this.prisma.stand.findMany({
      where: {
        organizationId,
        isDeleted: false,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    // Warm the cache
    await this.cache.warmCache(recentStands, organizationId);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    cacheInfo: any;
    metrics: any;
  }> {
    const cacheInfo = await this.cache.getCacheInfo();
    const metrics = this.cache.getMetrics();

    return {
      cacheInfo,
      metrics,
    };
  }

  /**
   * Check if the request contains capability data
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
   * Extract capabilities from request data
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
   * Publish stand events (placeholder - integrate with actual event system)
   */
  private async publishStandEvent(
    action: 'created' | 'updated' | 'deleted',
    stand: Stand,
    userId: string
  ): Promise<void> {
    // This would integrate with the actual event publishing system
    console.log(`Stand ${action}:`, {
      standId: stand.id,
      code: stand.code,
      organizationId: stand.organizationId,
      userId,
      timestamp: new Date(),
    });
  }
}
