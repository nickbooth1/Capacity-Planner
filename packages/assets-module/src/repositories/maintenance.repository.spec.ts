import { MaintenanceRepository } from './maintenance.repository';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  standMaintenanceRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  stand: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('MaintenanceRepository', () => {
  let repository: MaintenanceRepository;

  const organizationId = 'test-org-id';
  const standId = 'test-stand-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new MaintenanceRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create a new maintenance record', async () => {
      const createData = {
        standId: 'stand-1',
        type: 'ROUTINE',
        description: 'Routine maintenance',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        status: 'SCHEDULED' as const,
        priority: 'MEDIUM' as const,
        estimatedCost: 1000,
        requiredSkills: ['ELECTRICAL'],
        requiredEquipment: ['LIFT'],
        createdBy: userId,
      };

      const mockResult = {
        id: 'maintenance-1',
        ...createData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.standMaintenanceRecord.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.create(createData);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.standMaintenanceRecord.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          stand: {
            select: {
              id: true,
              identifier: true,
              organizationId: true,
            },
          },
        },
      });
    });
  });

  describe('findById', () => {
    it('should find maintenance record by ID', async () => {
      const recordId = 'maintenance-1';
      const mockRecord = {
        id: recordId,
        standId: 'stand-1',
        type: 'ROUTINE',
        status: 'SCHEDULED',
        stand: {
          id: 'stand-1',
          identifier: 'A01',
          organizationId,
        },
      };

      (mockPrisma.standMaintenanceRecord.findFirst as jest.Mock).mockResolvedValue(mockRecord);

      const result = await repository.findById(recordId, organizationId);

      expect(result).toEqual(mockRecord);
      expect(mockPrisma.standMaintenanceRecord.findFirst).toHaveBeenCalledWith({
        where: {
          id: recordId,
          stand: { organizationId },
        },
        include: {
          stand: {
            select: {
              id: true,
              identifier: true,
              organizationId: true,
            },
          },
        },
      });
    });

    it('should return null when record not found', async () => {
      const recordId = 'non-existent';

      (mockPrisma.standMaintenanceRecord.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById(recordId, organizationId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update maintenance record', async () => {
      const recordId = 'maintenance-1';
      const updateData = {
        status: 'IN_PROGRESS' as const,
        actualStart: new Date('2024-01-01T10:00:00Z'),
        updatedBy: userId,
      };

      const mockUpdatedRecord = {
        id: recordId,
        standId: 'stand-1',
        type: 'ROUTINE',
        ...updateData,
        updatedAt: new Date(),
      };

      (mockPrisma.standMaintenanceRecord.update as jest.Mock).mockResolvedValue(mockUpdatedRecord);

      const result = await repository.update(recordId, organizationId, updateData);

      expect(result).toEqual(mockUpdatedRecord);
      expect(mockPrisma.standMaintenanceRecord.update).toHaveBeenCalledWith({
        where: {
          id: recordId,
          stand: { organizationId },
        },
        data: updateData,
        include: {
          stand: {
            select: {
              id: true,
              identifier: true,
              organizationId: true,
            },
          },
        },
      });
    });
  });

  describe('query', () => {
    it('should query maintenance records with filters', async () => {
      const filters = {
        organizationId,
        status: 'SCHEDULED' as const,
        standId: 'stand-1',
        scheduledAfter: new Date('2024-01-01T00:00:00Z'),
        scheduledBefore: new Date('2024-01-31T23:59:59Z'),
        priority: 'HIGH' as const,
      };

      const mockRecords = [
        {
          id: 'maintenance-1',
          standId: 'stand-1',
          type: 'ROUTINE',
          status: 'SCHEDULED',
          priority: 'HIGH',
          scheduledStart: new Date('2024-01-15T10:00:00Z'),
          stand: {
            id: 'stand-1',
            identifier: 'A01',
            organizationId,
          },
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await repository.query(filters);

      expect(result).toEqual(mockRecords);
      expect(mockPrisma.standMaintenanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          stand: { organizationId },
          status: 'SCHEDULED',
          standId: 'stand-1',
          scheduledStart: {
            gte: filters.scheduledAfter,
            lte: filters.scheduledBefore,
          },
          priority: 'HIGH',
        },
        include: {
          stand: {
            select: {
              id: true,
              identifier: true,
              organizationId: true,
            },
          },
        },
        orderBy: { scheduledStart: 'asc' },
      });
    });

    it('should handle empty filters', async () => {
      const filters = { organizationId };

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.query(filters);

      expect(result).toEqual([]);
      expect(mockPrisma.standMaintenanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          stand: { organizationId },
        },
        include: {
          stand: {
            select: {
              id: true,
              identifier: true,
              organizationId: true,
            },
          },
        },
        orderBy: { scheduledStart: 'asc' },
      });
    });
  });

  describe('checkSchedulingConflicts', () => {
    it('should detect scheduling conflicts', async () => {
      const conflictingRecords = [
        {
          id: 'conflict-1',
          type: 'INSPECTION',
          scheduledStart: new Date('2024-01-01T09:00:00Z'),
          scheduledEnd: new Date('2024-01-01T11:00:00Z'),
          priority: 'HIGH',
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(
        conflictingRecords
      );

      const result = await repository.checkSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z')
      );

      expect(result).toEqual({
        conflictingRecords,
        severity: 'CRITICAL',
        recommendations: expect.any(Array),
      });
    });

    it('should return null when no conflicts exist', async () => {
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.checkSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z')
      );

      expect(result).toBeNull();
    });

    it('should exclude specific record when checking conflicts', async () => {
      const excludeRecordId = 'exclude-me';

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      await repository.checkSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z'),
        excludeRecordId
      );

      expect(mockPrisma.standMaintenanceRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: excludeRecordId },
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('getSchedule', () => {
    it('should get maintenance schedule for date range', async () => {
      const mockSchedule = [
        {
          standId: 'stand-1',
          standIdentifier: 'A01',
          records: [
            {
              id: 'maintenance-1',
              type: 'ROUTINE',
              scheduledStart: new Date('2024-01-01T10:00:00Z'),
              scheduledEnd: new Date('2024-01-01T12:00:00Z'),
              status: 'SCHEDULED',
              priority: 'MEDIUM',
            },
          ],
        },
      ];

      // Mock the complex query that groups by stand
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'maintenance-1',
          standId: 'stand-1',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          status: 'SCHEDULED',
          priority: 'MEDIUM',
          stand: {
            id: 'stand-1',
            identifier: 'A01',
          },
        },
      ]);

      const result = await repository.getSchedule(
        organizationId,
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T23:59:59Z')
      );

      expect(result).toEqual(mockSchedule);
    });
  });

  describe('getHistoryForStand', () => {
    it('should get maintenance history for a specific stand', async () => {
      const mockHistory = [
        {
          id: 'maintenance-1',
          type: 'ROUTINE',
          status: 'COMPLETED',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          actualStart: new Date('2024-01-01T10:00:00Z'),
          actualEnd: new Date('2024-01-01T11:45:00Z'),
          estimatedCost: 1000,
          actualCost: 950,
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await repository.getHistoryForStand(standId, organizationId, 20);

      expect(result).toEqual(mockHistory);
      expect(mockPrisma.standMaintenanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          standId,
          stand: { organizationId },
        },
        orderBy: { scheduledStart: 'desc' },
        take: 20,
        include: {
          stand: {
            select: {
              id: true,
              identifier: true,
              organizationId: true,
            },
          },
        },
      });
    });
  });

  describe('getStatistics', () => {
    it('should get maintenance statistics', async () => {
      const mockCounts = {
        SCHEDULED: 5,
        IN_PROGRESS: 2,
        COMPLETED: 15,
        CANCELLED: 1,
        POSTPONED: 2,
      };

      const mockTypeCounts = {
        ROUTINE: 10,
        INSPECTION: 8,
        REPAIR: 5,
        EMERGENCY: 2,
      };

      const mockPriorityCounts = {
        LOW: 8,
        MEDIUM: 12,
        HIGH: 4,
        URGENT: 1,
      };

      // Mock the count queries
      (mockPrisma.standMaintenanceRecord.count as jest.Mock)
        .mockResolvedValueOnce(25) // totalRecords
        .mockResolvedValueOnce(5) // SCHEDULED
        .mockResolvedValueOnce(2) // IN_PROGRESS
        .mockResolvedValueOnce(15) // COMPLETED
        .mockResolvedValueOnce(1) // CANCELLED
        .mockResolvedValueOnce(2) // POSTPONED
        .mockResolvedValueOnce(10) // ROUTINE
        .mockResolvedValueOnce(8) // INSPECTION
        .mockResolvedValueOnce(5) // REPAIR
        .mockResolvedValueOnce(2) // EMERGENCY
        .mockResolvedValueOnce(8) // LOW
        .mockResolvedValueOnce(12) // MEDIUM
        .mockResolvedValueOnce(4) // HIGH
        .mockResolvedValueOnce(1); // URGENT

      const result = await repository.getStatistics(organizationId);

      expect(result).toEqual({
        totalRecords: 25,
        byStatus: mockCounts,
        byType: mockTypeCounts,
        byPriority: mockPriorityCounts,
      });
    });

    it('should handle date range filters in statistics', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      (mockPrisma.standMaintenanceRecord.count as jest.Mock).mockResolvedValue(0);

      await repository.getStatistics(organizationId, startDate, endDate);

      // Verify that date filters are applied to all count queries
      expect(mockPrisma.standMaintenanceRecord.count).toHaveBeenCalledWith({
        where: {
          stand: { organizationId },
          scheduledStart: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete maintenance record', async () => {
      const recordId = 'maintenance-1';

      (mockPrisma.standMaintenanceRecord.delete as jest.Mock).mockResolvedValue({
        id: recordId,
      });

      await repository.delete(recordId, organizationId);

      expect(mockPrisma.standMaintenanceRecord.delete).toHaveBeenCalledWith({
        where: {
          id: recordId,
          stand: { organizationId },
        },
      });
    });
  });
});
