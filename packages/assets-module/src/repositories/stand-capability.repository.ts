import { PrismaClient, Stand } from '@prisma/client';
import {
  StandCapabilities,
  StandCapabilitySnapshot,
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
  PaginatedResult,
} from '../types';

export interface StandWithCapabilities extends Stand {
  capabilities?: StandCapabilities;
}

export interface BulkUpdateOperation {
  standId: string;
  capabilities: Partial<StandCapabilities>;
}

export interface BulkUpdateResult {
  updated: number;
  failed: number;
  errors: Array<{ standId: string; error: string }>;
}

export interface CapabilityQueryFilters {
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
}

export class StandCapabilityRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find stand by ID with capabilities
   */
  async findByIdWithCapabilities(
    standId: string,
    organizationId: string
  ): Promise<StandWithCapabilities | null> {
    const stand = await this.prisma.stand.findFirst({
      where: {
        id: standId,
        organizationId,
      },
      include: {
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        adjacencies: {
          include: {
            adjacentStand: true,
          },
        },
        capabilitySnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!stand) {
      return null;
    }

    // Combine JSONB capabilities into a single object
    const capabilities: StandCapabilities = {
      dimensions: stand.dimensions as any,
      aircraftCompatibility: stand.aircraftCompatibility as any,
      groundSupport: stand.groundSupport as any,
      operationalConstraints: stand.operationalConstraints as any,
      environmentalFeatures: stand.environmentalFeatures as any,
      infrastructure: stand.infrastructure as any,
    };

    return {
      ...stand,
      capabilities,
    };
  }

  /**
   * Update stand capabilities
   */
  async updateCapabilities(
    standId: string,
    organizationId: string,
    capabilities: Partial<StandCapabilities>,
    userId?: string
  ): Promise<StandWithCapabilities> {
    const updateData: any = {};

    // Map capability types to database fields
    if (capabilities.dimensions) {
      updateData.dimensions = capabilities.dimensions;
    }
    if (capabilities.aircraftCompatibility) {
      updateData.aircraftCompatibility = capabilities.aircraftCompatibility;
    }
    if (capabilities.groundSupport) {
      updateData.groundSupport = capabilities.groundSupport;
    }
    if (capabilities.operationalConstraints) {
      updateData.operationalConstraints = capabilities.operationalConstraints;
    }
    if (capabilities.environmentalFeatures) {
      updateData.environmentalFeatures = capabilities.environmentalFeatures;
    }
    if (capabilities.infrastructure) {
      updateData.infrastructure = capabilities.infrastructure;
    }

    // Update the stand
    const updatedStand = await this.prisma.stand.update({
      where: {
        id: standId,
        organizationId,
      },
      data: updateData,
      include: {
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        adjacencies: {
          include: {
            adjacentStand: true,
          },
        },
      },
    });

    // Create capability snapshot
    if (userId) {
      await this.createCapabilitySnapshot(standId, capabilities, userId);
    }

    // Combine capabilities for response
    const combinedCapabilities: StandCapabilities = {
      dimensions: updatedStand.dimensions as any,
      aircraftCompatibility: updatedStand.aircraftCompatibility as any,
      groundSupport: updatedStand.groundSupport as any,
      operationalConstraints: updatedStand.operationalConstraints as any,
      environmentalFeatures: updatedStand.environmentalFeatures as any,
      infrastructure: updatedStand.infrastructure as any,
    };

    return {
      ...updatedStand,
      capabilities: combinedCapabilities,
    };
  }

  /**
   * Bulk update capabilities for multiple stands
   */
  async bulkUpdateCapabilities(
    operations: BulkUpdateOperation[],
    organizationId: string,
    userId?: string
  ): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      const batchPromises = batch.map(async (operation) => {
        try {
          await this.updateCapabilities(
            operation.standId,
            organizationId,
            operation.capabilities,
            userId
          );
          result.updated++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            standId: operation.standId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      await Promise.all(batchPromises);
    }

    return result;
  }

  /**
   * Query stands by capability filters
   */
  async queryByCapabilities(filters: CapabilityQueryFilters): Promise<StandWithCapabilities[]> {
    const whereClause: any = {};

    if (filters.organizationId) {
      whereClause.organizationId = filters.organizationId;
    }

    // JSONB queries for capabilities
    if (filters.icaoCategory) {
      whereClause.dimensions = {
        path: ['icaoCategory'],
        equals: filters.icaoCategory,
      };
    }

    if (filters.hasJetbridge !== undefined) {
      whereClause.infrastructure = {
        path: ['hasJetbridge'],
        equals: filters.hasJetbridge,
      };
    }

    if (filters.minLength || filters.maxLength) {
      const lengthFilter: any = {};
      if (filters.minLength) {
        lengthFilter.gte = filters.minLength;
      }
      if (filters.maxLength) {
        lengthFilter.lte = filters.maxLength;
      }
      whereClause.dimensions = {
        ...whereClause.dimensions,
        path: ['length'],
        ...lengthFilter,
      };
    }

    if (filters.minWidth || filters.maxWidth) {
      const widthFilter: any = {};
      if (filters.minWidth) {
        widthFilter.gte = filters.minWidth;
      }
      if (filters.maxWidth) {
        widthFilter.lte = filters.maxWidth;
      }
      whereClause.dimensions = {
        ...whereClause.dimensions,
        path: ['width'],
        ...widthFilter,
      };
    }

    if (filters.groundSupportType) {
      whereClause.groundSupport = {
        path: ['powerSupplyType'],
        array_contains: [filters.groundSupportType],
      };
    }

    const stands = await this.prisma.stand.findMany({
      where: whereClause,
      include: {
        maintenanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        adjacencies: {
          include: {
            adjacentStand: true,
          },
        },
      },
      skip: filters.offset || 0,
      take: filters.limit || 50,
      orderBy: {
        identifier: 'asc',
      },
    });

    return stands.map((stand) => ({
      ...stand,
      capabilities: {
        dimensions: stand.dimensions as any,
        aircraftCompatibility: stand.aircraftCompatibility as any,
        groundSupport: stand.groundSupport as any,
        operationalConstraints: stand.operationalConstraints as any,
        environmentalFeatures: stand.environmentalFeatures as any,
        infrastructure: stand.infrastructure as any,
      },
    }));
  }

  /**
   * Get capability history for a stand
   */
  async getCapabilityHistory(
    standId: string,
    organizationId: string,
    limit: number = 20
  ): Promise<StandCapabilitySnapshot[]> {
    const snapshots = await this.prisma.standCapabilitySnapshot.findMany({
      where: {
        standId,
        stand: {
          organizationId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      standId: snapshot.standId,
      capabilities: snapshot.capabilities as StandCapabilities,
      changeType: snapshot.changeType,
      changedFields: snapshot.changedFields as string[],
      userId: snapshot.userId,
      createdAt: snapshot.createdAt,
    }));
  }

  /**
   * Create a capability snapshot for audit trail
   */
  private async createCapabilitySnapshot(
    standId: string,
    capabilities: Partial<StandCapabilities>,
    userId: string
  ): Promise<void> {
    const changedFields = Object.keys(capabilities);

    await this.prisma.standCapabilitySnapshot.create({
      data: {
        standId,
        capabilities: capabilities as any,
        changeType: 'UPDATE',
        changedFields,
        userId,
      },
    });
  }

  /**
   * Get capability statistics for organization
   */
  async getCapabilityStatistics(organizationId: string): Promise<{
    totalStands: number;
    byIcaoCategory: Record<string, number>;
    withJetbridge: number;
    withGroundPower: number;
    withDeicing: number;
  }> {
    const stats = await this.prisma.stand.groupBy({
      by: ['organizationId'],
      where: {
        organizationId,
      },
      _count: {
        id: true,
      },
    });

    // Use raw SQL for more complex JSONB aggregations
    const icaoStats = (await this.prisma.$queryRaw`
      SELECT 
        dimensions->>'icaoCategory' as category,
        COUNT(*) as count
      FROM stands 
      WHERE organization_id = ${organizationId}
        AND dimensions->>'icaoCategory' IS NOT NULL
      GROUP BY dimensions->>'icaoCategory'
    `) as Array<{ category: string; count: number }>;

    const jetbridgeCount = (await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM stands 
      WHERE organization_id = ${organizationId}
        AND (infrastructure->>'hasJetbridge')::boolean = true
    `) as Array<{ count: number }>;

    const groundPowerCount = (await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM stands 
      WHERE organization_id = ${organizationId}
        AND (ground_support->>'hasPowerSupply')::boolean = true
    `) as Array<{ count: number }>;

    const deicingCount = (await this.prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM stands 
      WHERE organization_id = ${organizationId}
        AND (ground_support->>'hasDeicing')::boolean = true
    `) as Array<{ count: number }>;

    const byIcaoCategory: Record<string, number> = {};
    icaoStats.forEach((stat) => {
      byIcaoCategory[stat.category] = Number(stat.count);
    });

    return {
      totalStands: stats[0]?._count.id || 0,
      byIcaoCategory,
      withJetbridge: Number(jetbridgeCount[0]?.count || 0),
      withGroundPower: Number(groundPowerCount[0]?.count || 0),
      withDeicing: Number(deicingCount[0]?.count || 0),
    };
  }

  // CRUD Operations

  /**
   * Create a new stand
   */
  async create(organizationId: string, data: CreateStandRequest, userId: string): Promise<Stand> {
    return await this.prisma.stand.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        terminal: data.terminal,
        status: data.status || 'operational',
        dimensions: data.dimensions || {},
        aircraftCompatibility: data.aircraftCompatibility || {},
        groundSupport: data.groundSupport || {},
        operationalConstraints: data.operationalConstraints || {},
        environmentalFeatures: data.environmentalFeatures || {},
        infrastructure: data.infrastructure || {},
        geometry: data.geometry,
        latitude: data.latitude,
        longitude: data.longitude,
        metadata: data.metadata || {},
        createdBy: userId,
      },
    });
  }

  /**
   * Update an existing stand with optimistic locking
   */
  async update(
    standId: string,
    organizationId: string,
    data: UpdateStandRequest,
    userId: string
  ): Promise<Stand> {
    const updateData: any = {
      updatedBy: userId,
      version: { increment: 1 },
    };

    // Only update fields that are provided
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.terminal !== undefined) updateData.terminal = data.terminal;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dimensions !== undefined) updateData.dimensions = data.dimensions;
    if (data.aircraftCompatibility !== undefined)
      updateData.aircraftCompatibility = data.aircraftCompatibility;
    if (data.groundSupport !== undefined) updateData.groundSupport = data.groundSupport;
    if (data.operationalConstraints !== undefined)
      updateData.operationalConstraints = data.operationalConstraints;
    if (data.environmentalFeatures !== undefined)
      updateData.environmentalFeatures = data.environmentalFeatures;
    if (data.infrastructure !== undefined) updateData.infrastructure = data.infrastructure;
    if (data.geometry !== undefined) updateData.geometry = data.geometry;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    return await this.prisma.stand.update({
      where: {
        id: standId,
        organizationId,
        version: data.version, // Optimistic locking
        isDeleted: false,
      },
      data: updateData,
    });
  }

  /**
   * Soft delete a stand
   */
  async softDelete(standId: string, organizationId: string, userId: string): Promise<void> {
    await this.prisma.stand.update({
      where: {
        id: standId,
        organizationId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });
  }

  /**
   * Find all stands with pagination and filtering
   */
  async findAll(
    organizationId: string,
    filters: StandFilters = {},
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedResult<Stand>> {
    const whereClause: any = {
      organizationId,
      isDeleted: filters.includeDeleted ? undefined : false,
    };

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.terminal) {
      whereClause.terminal = filters.terminal;
    }

    if (filters.aircraftCategory) {
      whereClause.dimensions = {
        path: ['icaoCategory'],
        equals: filters.aircraftCategory,
      };
    }

    if (filters.search) {
      whereClause.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stand.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stand.count({ where: whereClause }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Find a stand by ID for CRUD operations
   */
  async findById(
    standId: string,
    organizationId: string,
    includeDeleted: boolean = false
  ): Promise<Stand | null> {
    return await this.prisma.stand.findFirst({
      where: {
        id: standId,
        organizationId,
        isDeleted: includeDeleted ? undefined : false,
      },
    });
  }

  /**
   * Check if a stand code exists (for uniqueness validation)
   */
  async existsByCode(code: string, organizationId: string, excludeId?: string): Promise<boolean> {
    const stand = await this.prisma.stand.findFirst({
      where: {
        code,
        organizationId,
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return stand !== null;
  }
}
