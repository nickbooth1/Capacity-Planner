import { PrismaClient, Stand, Prisma } from '@prisma/client';
import {
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
  PaginatedResult,
  StandCapabilities,
} from '../types';

export class StandCapabilityOptimizedRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new stand with optimized insert
   */
  async create(organizationId: string, data: CreateStandRequest, userId: string): Promise<Stand> {
    return await this.prisma.stand.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        terminal: data.terminal,
        status: data.status || 'operational',
        dimensions: data.dimensions || Prisma.JsonNull,
        aircraftCompatibility: data.aircraftCompatibility || Prisma.JsonNull,
        groundSupport: data.groundSupport || Prisma.JsonNull,
        operationalConstraints: data.operationalConstraints || Prisma.JsonNull,
        environmentalFeatures: data.environmentalFeatures || Prisma.JsonNull,
        infrastructure: data.infrastructure || Prisma.JsonNull,
        geometry: data.geometry || Prisma.JsonNull,
        latitude: data.latitude,
        longitude: data.longitude,
        metadata: data.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  /**
   * Update a stand with optimistic locking
   */
  async update(
    standId: string,
    organizationId: string,
    data: UpdateStandRequest,
    userId: string
  ): Promise<Stand> {
    const updateData: Prisma.StandUpdateInput = {
      updatedBy: userId,
      updatedAt: new Date(),
      version: { increment: 1 },
    };

    // Only include fields that are being updated
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
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find a stand by ID with selective field loading
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
   * Find all stands with optimized pagination and filtering
   */
  async findAll(
    organizationId: string,
    filters: StandFilters = {},
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedResult<Stand>> {
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.StandWhereInput = {
      organizationId,
      isDeleted: filters.includeDeleted ? undefined : false,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.terminal) {
      where.terminal = filters.terminal;
    }

    if (filters.aircraftCategory) {
      where.aircraftCompatibility = {
        path: ['compatibleCategories'],
        array_contains: [filters.aircraftCategory],
      };
    }

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Execute count and data queries in parallel
    const [total, data] = await Promise.all([
      this.prisma.stand.count({ where }),
      this.prisma.stand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ terminal: 'asc' }, { code: 'asc' }],
      }),
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
   * Check if a stand code already exists
   */
  async existsByCode(code: string, organizationId: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.StandWhereInput = {
      code,
      organizationId,
      isDeleted: false,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.stand.count({ where });
    return count > 0;
  }

  /**
   * Get capability statistics with optimized aggregation
   */
  async getCapabilityStatistics(organizationId: string): Promise<{
    byIcaoCategory: Record<string, number>;
    withJetbridge: number;
    withGroundPower: number;
    byTerminal: Record<string, number>;
  }> {
    // Use raw queries for complex JSON aggregations
    const [icaoStats, jetbridgeCount, groundPowerCount] = await Promise.all([
      // Get ICAO category distribution
      this.prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
        SELECT 
          jsonb_array_elements_text(aircraft_compatibility->'compatibleCategories') as category,
          COUNT(*) as count
        FROM assets."Stand"
        WHERE organization_id = ${organizationId}
          AND is_deleted = false
          AND aircraft_compatibility->'compatibleCategories' IS NOT NULL
        GROUP BY category
      `,

      // Count stands with jetbridge
      this.prisma.stand.count({
        where: {
          organizationId,
          isDeleted: false,
          groundSupport: {
            path: ['hasJetbridge'],
            equals: true,
          },
        },
      }),

      // Count stands with ground power
      this.prisma.stand.count({
        where: {
          organizationId,
          isDeleted: false,
          groundSupport: {
            path: ['hasPowerSupply'],
            equals: true,
          },
        },
      }),
    ]);

    // Process ICAO statistics
    const byIcaoCategory: Record<string, number> = {};
    icaoStats.forEach((stat) => {
      byIcaoCategory[stat.category] = Number(stat.count);
    });

    // Get terminal distribution (already optimized in getStandStats)
    const terminalStats = await this.prisma.stand.groupBy({
      by: ['terminal'],
      where: {
        organizationId,
        isDeleted: false,
      },
      _count: {
        terminal: true,
      },
    });

    const byTerminal: Record<string, number> = {};
    terminalStats.forEach((stat) => {
      const terminal = stat.terminal || 'Unassigned';
      byTerminal[terminal] = stat._count.terminal;
    });

    return {
      byIcaoCategory,
      withJetbridge: jetbridgeCount,
      withGroundPower: groundPowerCount,
      byTerminal,
    };
  }

  /**
   * Query stands by capabilities with optimized filtering
   */
  async queryByCapabilities(params: {
    organizationId: string;
    icaoCategory?: string;
    hasJetbridge?: boolean;
    minLength?: number;
    maxLength?: number;
    minWidth?: number;
    maxWidth?: number;
    groundSupportType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Stand[]> {
    const where: Prisma.StandWhereInput = {
      organizationId: params.organizationId,
      isDeleted: false,
    };

    // Build dynamic where conditions for JSON fields
    const andConditions: Prisma.StandWhereInput[] = [];

    if (params.icaoCategory) {
      andConditions.push({
        aircraftCompatibility: {
          path: ['compatibleCategories'],
          array_contains: [params.icaoCategory],
        },
      });
    }

    if (params.hasJetbridge !== undefined) {
      andConditions.push({
        groundSupport: {
          path: ['hasJetbridge'],
          equals: params.hasJetbridge,
        },
      });
    }

    if (params.minLength !== undefined) {
      andConditions.push({
        dimensions: {
          path: ['length'],
          gte: params.minLength,
        },
      });
    }

    if (params.maxLength !== undefined) {
      andConditions.push({
        dimensions: {
          path: ['length'],
          lte: params.maxLength,
        },
      });
    }

    if (params.minWidth !== undefined) {
      andConditions.push({
        dimensions: {
          path: ['width'],
          gte: params.minWidth,
        },
      });
    }

    if (params.maxWidth !== undefined) {
      andConditions.push({
        dimensions: {
          path: ['width'],
          lte: params.maxWidth,
        },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return await this.prisma.stand.findMany({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      orderBy: [{ terminal: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * Create database indexes for optimized queries
   */
  async createIndexes(): Promise<void> {
    // These would be better placed in a migration file, but here for reference
    const indexQueries = [
      // Index for organization and soft delete queries
      `CREATE INDEX IF NOT EXISTS idx_stand_org_deleted ON assets."Stand" (organization_id, is_deleted)`,

      // Index for code lookups
      `CREATE INDEX IF NOT EXISTS idx_stand_org_code ON assets."Stand" (organization_id, code) WHERE is_deleted = false`,

      // Index for status filtering
      `CREATE INDEX IF NOT EXISTS idx_stand_org_status ON assets."Stand" (organization_id, status) WHERE is_deleted = false`,

      // Index for terminal grouping
      `CREATE INDEX IF NOT EXISTS idx_stand_org_terminal ON assets."Stand" (organization_id, terminal) WHERE is_deleted = false`,

      // GIN indexes for JSONB fields
      `CREATE INDEX IF NOT EXISTS idx_stand_dimensions ON assets."Stand" USING GIN (dimensions)`,
      `CREATE INDEX IF NOT EXISTS idx_stand_aircraft_compat ON assets."Stand" USING GIN (aircraft_compatibility)`,
      `CREATE INDEX IF NOT EXISTS idx_stand_ground_support ON assets."Stand" USING GIN (ground_support)`,

      // Composite index for common queries
      `CREATE INDEX IF NOT EXISTS idx_stand_org_terminal_code ON assets."Stand" (organization_id, terminal, code) WHERE is_deleted = false`,
    ];

    // Execute index creation
    for (const query of indexQueries) {
      try {
        await this.prisma.$executeRawUnsafe(query);
      } catch (error) {
        console.error(`Failed to create index: ${query}`, error);
      }
    }
  }

  /**
   * Analyze and optimize queries
   */
  async analyzeQueries(): Promise<void> {
    // Analyze tables for query optimizer
    await this.prisma.$executeRaw`ANALYZE assets."Stand"`;
  }
}
