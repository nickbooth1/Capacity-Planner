import { StandCapabilityRepository } from './stand-capability.repository';
import { PrismaClient } from '@prisma/client';
import { StandCapabilities, ICAOAircraftCategory } from '../types';
import { ValidationCache } from '../cache/validation-cache';
import { MetricsService } from '../monitoring/metrics.service';

// Mock dependencies
jest.mock('../cache/validation-cache');
jest.mock('../monitoring/metrics.service');

// Mock Prisma Client
const mockPrisma = {
  stand: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  standCapabilitySnapshot: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
} as unknown as PrismaClient;

describe('StandCapabilityRepository', () => {
  let repository: StandCapabilityRepository;
  const organizationId = 'test-org-id';
  const standId = 'test-stand-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new StandCapabilityRepository(mockPrisma);
  });

  describe('findByIdWithCapabilities', () => {
    it('should return stand with capabilities', async () => {
      const mockStand = {
        id: standId,
        identifier: 'A01',
        organizationId,
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: ICAOAircraftCategory.C,
        },
        aircraftCompatibility: {
          maxWingspan: 36,
          maxLength: 40,
        },
        groundSupport: {
          hasPowerSupply: true,
          powerSupplyType: ['400Hz'],
        },
        operationalConstraints: null,
        environmentalFeatures: null,
        infrastructure: null,
        maintenanceRecords: [],
        adjacencies: [],
        capabilitySnapshots: [],
      };

      (mockPrisma.stand.findFirst as jest.Mock).mockResolvedValue(mockStand);

      const result = await repository.findByIdWithCapabilities(standId, organizationId);

      expect(result).toEqual({
        ...mockStand,
        capabilities: {
          dimensions: mockStand.dimensions,
          aircraftCompatibility: mockStand.aircraftCompatibility,
          groundSupport: mockStand.groundSupport,
          operationalConstraints: null,
          environmentalFeatures: null,
          infrastructure: null,
        },
      });

      expect(mockPrisma.stand.findFirst).toHaveBeenCalledWith({
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
    });

    it('should return null if stand not found', async () => {
      (mockPrisma.stand.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByIdWithCapabilities(standId, organizationId);

      expect(result).toBeNull();
    });
  });

  describe('updateCapabilities', () => {
    it('should update stand capabilities and create snapshot', async () => {
      const capabilities: Partial<StandCapabilities> = {
        dimensions: {
          length: 70,
          width: 50,
          icaoCategory: ICAOAircraftCategory.D,
        },
        groundSupport: {
          hasPowerSupply: true,
          powerSupplyType: ['400Hz', '28VDC'],
        },
      };

      const mockUpdatedStand = {
        id: standId,
        identifier: 'A01',
        organizationId,
        dimensions: capabilities.dimensions,
        aircraftCompatibility: null,
        groundSupport: capabilities.groundSupport,
        operationalConstraints: null,
        environmentalFeatures: null,
        infrastructure: null,
        maintenanceRecords: [],
        adjacencies: [],
      };

      (mockPrisma.stand.update as jest.Mock).mockResolvedValue(mockUpdatedStand);
      (mockPrisma.standCapabilitySnapshot.create as jest.Mock).mockResolvedValue({});

      const result = await repository.updateCapabilities(
        standId,
        organizationId,
        capabilities,
        userId
      );

      expect(mockPrisma.stand.update).toHaveBeenCalledWith({
        where: {
          id: standId,
          organizationId,
        },
        data: {
          dimensions: capabilities.dimensions,
          groundSupport: capabilities.groundSupport,
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
        },
      });

      expect(mockPrisma.standCapabilitySnapshot.create).toHaveBeenCalledWith({
        data: {
          standId,
          capabilities,
          changeType: 'UPDATE',
          changedFields: ['dimensions', 'groundSupport'],
          userId,
        },
      });

      expect(result).toEqual({
        ...mockUpdatedStand,
        capabilities: {
          dimensions: capabilities.dimensions,
          aircraftCompatibility: null,
          groundSupport: capabilities.groundSupport,
          operationalConstraints: null,
          environmentalFeatures: null,
          infrastructure: null,
        },
      });
    });
  });

  describe('bulkUpdateCapabilities', () => {
    it('should update multiple stands in batches', async () => {
      const operations = [
        {
          standId: 'stand-1',
          capabilities: {
            dimensions: {
              length: 60,
              width: 45,
            },
          },
        },
        {
          standId: 'stand-2',
          capabilities: {
            groundSupport: {
              hasPowerSupply: true,
            },
          },
        },
      ];

      // Mock successful updates
      (mockPrisma.stand.update as jest.Mock)
        .mockResolvedValueOnce({
          id: 'stand-1',
          dimensions: operations[0].capabilities.dimensions,
          maintenanceRecords: [],
          adjacencies: [],
        })
        .mockResolvedValueOnce({
          id: 'stand-2',
          groundSupport: operations[1].capabilities.groundSupport,
          maintenanceRecords: [],
          adjacencies: [],
        });

      (mockPrisma.standCapabilitySnapshot.create as jest.Mock).mockResolvedValue({});

      const result = await repository.bulkUpdateCapabilities(operations, organizationId, userId);

      expect(result).toEqual({
        updated: 2,
        failed: 0,
        errors: [],
      });

      expect(mockPrisma.stand.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.standCapabilitySnapshot.create).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during bulk update', async () => {
      const operations = [
        {
          standId: 'stand-1',
          capabilities: {
            dimensions: {
              length: 60,
              width: 45,
            },
          },
        },
        {
          standId: 'stand-2',
          capabilities: {
            groundSupport: {
              hasPowerSupply: true,
            },
          },
        },
      ];

      // Mock one success, one failure
      (mockPrisma.stand.update as jest.Mock)
        .mockResolvedValueOnce({
          id: 'stand-1',
          maintenanceRecords: [],
          adjacencies: [],
        })
        .mockRejectedValueOnce(new Error('Database error'));

      (mockPrisma.standCapabilitySnapshot.create as jest.Mock).mockResolvedValue({});

      const result = await repository.bulkUpdateCapabilities(operations, organizationId, userId);

      expect(result).toEqual({
        updated: 1,
        failed: 1,
        errors: [
          {
            standId: 'stand-2',
            error: 'Database error',
          },
        ],
      });
    });
  });

  describe('queryByCapabilities', () => {
    it('should query stands with capability filters', async () => {
      const filters = {
        organizationId,
        icaoCategory: ICAOAircraftCategory.C,
        hasJetbridge: true,
        minLength: 50,
        maxLength: 80,
        limit: 20,
      };

      const mockStands = [
        {
          id: 'stand-1',
          identifier: 'A01',
          dimensions: {
            length: 60,
            width: 45,
            icaoCategory: ICAOAircraftCategory.C,
          },
          infrastructure: {
            hasJetbridge: true,
          },
          maintenanceRecords: [],
          adjacencies: [],
        },
      ];

      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue(mockStands);

      const result = await repository.queryByCapabilities(filters);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockStands[0],
        capabilities: {
          dimensions: mockStands[0].dimensions,
          aircraftCompatibility: undefined,
          groundSupport: undefined,
          operationalConstraints: undefined,
          environmentalFeatures: undefined,
          infrastructure: mockStands[0].infrastructure,
        },
      });
    });
  });

  describe('getCapabilityStatistics', () => {
    it('should return capability statistics for organization', async () => {
      (mockPrisma.stand.groupBy as jest.Mock).mockResolvedValue([
        { organizationId, _count: { id: 10 } },
      ]);

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([
          { category: 'C', count: 5 },
          { category: 'D', count: 3 },
          { category: 'E', count: 2 },
        ])
        .mockResolvedValueOnce([{ count: 6 }]) // jetbridge
        .mockResolvedValueOnce([{ count: 8 }]) // ground power
        .mockResolvedValueOnce([{ count: 4 }]); // deicing

      const result = await repository.getCapabilityStatistics(organizationId);

      expect(result).toEqual({
        totalStands: 10,
        byIcaoCategory: {
          C: 5,
          D: 3,
          E: 2,
        },
        withJetbridge: 6,
        withGroundPower: 8,
        withDeicing: 4,
      });
    });
  });
});
