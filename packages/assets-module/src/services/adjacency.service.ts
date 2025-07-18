import { PrismaClient, StandAdjacency } from '@prisma/client';

export interface AdjacencyCreateRequest {
  standId: string;
  adjacentStandId: string;
  distance: number;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  operationalConstraints?: string[];
  notes?: string;
}

export interface AdjacencyUpdateRequest {
  distance?: number;
  impactLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  operationalConstraints?: string[];
  notes?: string;
}

export interface AdjacencyInfo {
  standId: string;
  adjacentStands: Array<{
    standId: string;
    standIdentifier: string;
    distance: number;
    impactLevel: string;
    operationalConstraints: string[];
  }>;
}

export class AdjacencyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create adjacency relationship
   */
  async createAdjacency(
    organizationId: string,
    request: AdjacencyCreateRequest,
    userId: string
  ): Promise<StandAdjacency> {
    // Validate stands exist and belong to organization
    const [stand1, stand2] = await Promise.all([
      this.prisma.stand.findFirst({
        where: { id: request.standId, organizationId },
      }),
      this.prisma.stand.findFirst({
        where: { id: request.adjacentStandId, organizationId },
      }),
    ]);

    if (!stand1 || !stand2) {
      throw new Error('One or both stands not found');
    }

    // Check if adjacency already exists
    const existingAdjacency = await this.prisma.standAdjacency.findFirst({
      where: {
        standId: request.standId,
        adjacentStandId: request.adjacentStandId,
      },
    });

    if (existingAdjacency) {
      throw new Error('Adjacency relationship already exists');
    }

    // Create bidirectional adjacency
    const [adjacency1, adjacency2] = await Promise.all([
      this.prisma.standAdjacency.create({
        data: {
          standId: request.standId,
          adjacentStandId: request.adjacentStandId,
          distance: request.distance,
          impactLevel: request.impactLevel,
          operationalConstraints: request.operationalConstraints || [],
          notes: request.notes,
          createdBy: userId,
        },
      }),
      this.prisma.standAdjacency.create({
        data: {
          standId: request.adjacentStandId,
          adjacentStandId: request.standId,
          distance: request.distance,
          impactLevel: request.impactLevel,
          operationalConstraints: request.operationalConstraints || [],
          notes: request.notes,
          createdBy: userId,
        },
      }),
    ]);

    return adjacency1;
  }

  /**
   * Update adjacency relationship
   */
  async updateAdjacency(
    adjacencyId: string,
    organizationId: string,
    updates: AdjacencyUpdateRequest,
    userId: string
  ): Promise<StandAdjacency> {
    // Find the adjacency
    const adjacency = await this.prisma.standAdjacency.findFirst({
      where: {
        id: adjacencyId,
        stand: { organizationId },
      },
    });

    if (!adjacency) {
      throw new Error('Adjacency not found');
    }

    // Update both directions
    const [updatedAdjacency1, updatedAdjacency2] = await Promise.all([
      this.prisma.standAdjacency.update({
        where: { id: adjacencyId },
        data: {
          ...updates,
          updatedBy: userId,
        },
      }),
      this.prisma.standAdjacency.updateMany({
        where: {
          standId: adjacency.adjacentStandId,
          adjacentStandId: adjacency.standId,
        },
        data: {
          ...updates,
          updatedBy: userId,
        },
      }),
    ]);

    return updatedAdjacency1;
  }

  /**
   * Delete adjacency relationship
   */
  async deleteAdjacency(adjacencyId: string, organizationId: string): Promise<void> {
    // Find the adjacency
    const adjacency = await this.prisma.standAdjacency.findFirst({
      where: {
        id: adjacencyId,
        stand: { organizationId },
      },
    });

    if (!adjacency) {
      throw new Error('Adjacency not found');
    }

    // Delete both directions
    await Promise.all([
      this.prisma.standAdjacency.delete({
        where: { id: adjacencyId },
      }),
      this.prisma.standAdjacency.deleteMany({
        where: {
          standId: adjacency.adjacentStandId,
          adjacentStandId: adjacency.standId,
        },
      }),
    ]);
  }

  /**
   * Get adjacency information for a stand
   */
  async getAdjacencyInfo(standId: string, organizationId: string): Promise<AdjacencyInfo> {
    const adjacencies = await this.prisma.standAdjacency.findMany({
      where: {
        standId,
        stand: { organizationId },
      },
      include: {
        adjacentStand: {
          select: {
            id: true,
            identifier: true,
          },
        },
      },
    });

    const adjacentStands = adjacencies.map((adj) => ({
      standId: adj.adjacentStandId,
      standIdentifier: adj.adjacentStand.identifier,
      distance: adj.distance,
      impactLevel: adj.impactLevel,
      operationalConstraints: adj.operationalConstraints as string[],
    }));

    return {
      standId,
      adjacentStands,
    };
  }

  /**
   * Get adjacency network for visualization
   */
  async getAdjacencyNetwork(organizationId: string): Promise<{
    nodes: Array<{
      id: string;
      identifier: string;
      type: 'stand';
      properties?: any;
    }>;
    edges: Array<{
      source: string;
      target: string;
      distance: number;
      impactLevel: string;
      operationalConstraints: string[];
    }>;
  }> {
    const [stands, adjacencies] = await Promise.all([
      this.prisma.stand.findMany({
        where: { organizationId },
        select: {
          id: true,
          identifier: true,
          dimensions: true,
          infrastructure: true,
        },
      }),
      this.prisma.standAdjacency.findMany({
        where: {
          stand: { organizationId },
        },
      }),
    ]);

    const nodes = stands.map((stand) => ({
      id: stand.id,
      identifier: stand.identifier,
      type: 'stand' as const,
      properties: {
        dimensions: stand.dimensions,
        infrastructure: stand.infrastructure,
      },
    }));

    const edges = adjacencies.map((adj) => ({
      source: adj.standId,
      target: adj.adjacentStandId,
      distance: adj.distance,
      impactLevel: adj.impactLevel,
      operationalConstraints: adj.operationalConstraints as string[],
    }));

    return { nodes, edges };
  }

  /**
   * Find adjacent stands (simple list)
   */
  async findAdjacentStands(
    originalStandId: string,
    organizationId: string,
    filters?: {
      minDistance?: number;
      maxImpactLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    }
  ): Promise<
    Array<{
      standId: string;
      standIdentifier: string;
      distance: number;
      impactLevel: string;
      operationalConstraints: string[];
      notes?: string;
    }>
  > {
    const impactLevels = ['LOW', 'MEDIUM', 'HIGH'];
    const maxImpactIndex = filters?.maxImpactLevel
      ? impactLevels.indexOf(filters.maxImpactLevel)
      : 2;

    const adjacencies = await this.prisma.standAdjacency.findMany({
      where: {
        standId: originalStandId,
        stand: { organizationId },
        ...(filters?.minDistance && {
          distance: { gte: filters.minDistance },
        }),
        impactLevel: {
          in: impactLevels.slice(0, maxImpactIndex + 1),
        },
      },
      include: {
        adjacentStand: {
          select: {
            id: true,
            identifier: true,
          },
        },
      },
      orderBy: { distance: 'asc' },
    });

    return adjacencies.map((adj) => ({
      standId: adj.adjacentStandId,
      standIdentifier: adj.adjacentStand.identifier,
      distance: adj.distance,
      impactLevel: adj.impactLevel,
      operationalConstraints: adj.operationalConstraints as string[],
      notes: adj.notes,
    }));
  }
}
