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

export class StandCRUDService {
  private repository: StandCapabilityRepository;

  constructor(
    private prisma: PrismaClient,
    private validationEngine: CapabilityValidationEngine
  ) {
    this.repository = new StandCapabilityRepository(prisma);
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

    // Get current stand for validation
    const currentStand = await this.repository.findById(standId, organizationId);
    if (!currentStand) {
      throw new Error('Stand not found');
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
    // Check if stand exists
    const stand = await this.repository.findById(standId, organizationId);
    if (!stand) {
      throw new Error('Stand not found');
    }

    // Soft delete the stand
    await this.repository.softDelete(standId, organizationId, userId);

    // Publish event
    await this.publishStandEvent('deleted', stand, userId);
  }

  /**
   * Get a stand by ID
   */
  async getStandById(
    standId: string,
    organizationId: string,
    includeDeleted: boolean = false
  ): Promise<Stand | null> {
    return await this.repository.findById(standId, organizationId, includeDeleted);
  }

  /**
   * Get all stands with pagination and filtering
   */
  async getStands(
    organizationId: string,
    filters: StandFilters = {},
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedResult<Stand>> {
    return await this.repository.findAll(organizationId, filters, page, pageSize);
  }

  /**
   * Get stand statistics
   */
  async getStandStats(organizationId: string): Promise<{
    total: number;
    operational: number;
    maintenance: number;
    closed: number;
    byTerminal: Record<string, number>;
  }> {
    const [allStands, stats] = await Promise.all([
      this.repository.findAll(organizationId, {}, 1, 1000), // Get all for stats
      this.repository.getCapabilityStatistics(organizationId),
    ]);

    const byStatus = { operational: 0, maintenance: 0, closed: 0 };
    const byTerminal: Record<string, number> = {};

    allStands.data.forEach((stand) => {
      // Count by status
      if (stand.status in byStatus) {
        byStatus[stand.status as keyof typeof byStatus]++;
      }

      // Count by terminal
      const terminal = stand.terminal || 'Unassigned';
      byTerminal[terminal] = (byTerminal[terminal] || 0) + 1;
    });

    return {
      total: allStands.total,
      operational: byStatus.operational,
      maintenance: byStatus.maintenance,
      closed: byStatus.closed,
      byTerminal,
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
