import {
  MaintenanceService,
  MaintenanceScheduleRequest,
  MaintenanceUpdateRequest,
} from './maintenance.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  stand: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  standMaintenanceRecord: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock MaintenanceRepository
jest.mock('../repositories/maintenance.repository', () => ({
  MaintenanceRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
    checkSchedulingConflicts: jest.fn(),
    getSchedule: jest.fn(),
    getHistoryForStand: jest.fn(),
    getStatistics: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let mockRepository: any;

  const organizationId = 'test-org-id';
  const standId = 'test-stand-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaintenanceService(mockPrisma);
    mockRepository = (service as any).repository;
  });

  describe('scheduleMaintenance', () => {
    it('should schedule maintenance successfully', async () => {
      const request: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'ROUTINE',
        description: 'Routine maintenance',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'MEDIUM',
        estimatedCost: 1000,
        requiredSkills: ['ELECTRICAL'],
        requiredEquipment: ['LIFT'],
      };

      const mockRecord = {
        id: 'maintenance-1',
        standId: 'stand-1',
        type: 'ROUTINE',
        status: 'SCHEDULED',
        scheduledStart: request.scheduledStart,
        scheduledEnd: request.scheduledEnd,
        priority: 'MEDIUM',
        stand: {
          id: 'stand-1',
          identifier: 'A01',
          organizationId,
        },
      };

      const mockImpactAnalysis = {
        affectedStands: ['stand-2'],
        capacityReduction: 30,
        alternativeStands: ['stand-3', 'stand-4'],
        estimatedRevenueLoss: 5000,
        operationalConstraints: ['Reduced taxiway capacity'],
      };

      mockRepository.checkSchedulingConflicts.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockRecord);

      // Mock the impact analysis
      const mockStand = {
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [
          {
            adjacentStandId: 'stand-2',
            impactLevel: 'HIGH',
          },
        ],
      };

      const mockAlternativeStands = [{ id: 'stand-3' }, { id: 'stand-4' }];

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(mockStand);
      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue(mockAlternativeStands);

      const result = await service.scheduleMaintenance(organizationId, request, userId);

      expect(result.record).toEqual(mockRecord);
      expect(result.impactAnalysis).toEqual(mockImpactAnalysis);

      expect(mockRepository.checkSchedulingConflicts).toHaveBeenCalledWith(
        request.standId,
        request.scheduledStart,
        request.scheduledEnd
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        standId: request.standId,
        type: request.type,
        description: request.description,
        scheduledStart: request.scheduledStart,
        scheduledEnd: request.scheduledEnd,
        status: 'SCHEDULED',
        priority: request.priority,
        estimatedCost: request.estimatedCost,
        requiredSkills: request.requiredSkills,
        requiredEquipment: request.requiredEquipment,
        createdBy: userId,
      });
    });

    it('should throw error when scheduling conflict exists', async () => {
      const request: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'ROUTINE',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'MEDIUM',
      };

      const mockConflict = {
        conflictingRecords: [
          {
            id: 'conflict-1',
            type: 'INSPECTION',
            scheduledStart: new Date('2024-01-01T09:00:00Z'),
            scheduledEnd: new Date('2024-01-01T11:00:00Z'),
            priority: 'HIGH',
          },
        ],
        severity: 'HIGH',
        recommendations: ['Reschedule to avoid conflict'],
      };

      mockRepository.checkSchedulingConflicts.mockResolvedValue(mockConflict);

      await expect(service.scheduleMaintenance(organizationId, request, userId)).rejects.toThrow(
        'Scheduling conflict detected. Stand has 1 conflicting maintenance records.'
      );
    });

    it('should send notification after scheduling', async () => {
      const request: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'ROUTINE',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'MEDIUM',
      };

      const mockRecord = {
        id: 'maintenance-1',
        standId: 'stand-1',
        type: 'ROUTINE',
        status: 'SCHEDULED',
        stand: {
          id: 'stand-1',
          identifier: 'A01',
        },
      };

      mockRepository.checkSchedulingConflicts.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockRecord);

      // Mock stand data for impact analysis
      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue({
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [],
      });
      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue([]);

      const mockListener = jest.fn();
      service.addNotificationListener(mockListener);

      await service.scheduleMaintenance(organizationId, request, userId);

      expect(mockListener).toHaveBeenCalledWith({
        type: 'SCHEDULED',
        recordId: 'maintenance-1',
        standId: 'stand-1',
        standIdentifier: 'A01',
        message: expect.stringContaining('Maintenance scheduled for ROUTINE'),
        timestamp: expect.any(Date),
        recipients: [],
      });
    });
  });

  describe('updateMaintenance', () => {
    it('should update maintenance record successfully', async () => {
      const recordId = 'maintenance-1';
      const updates: MaintenanceUpdateRequest = {
        status: 'IN_PROGRESS',
        actualStart: new Date('2024-01-01T10:00:00Z'),
        completionNotes: 'Work in progress',
      };

      const mockCurrentRecord = {
        id: recordId,
        standId: 'stand-1',
        type: 'ROUTINE',
        status: 'SCHEDULED',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        stand: {
          id: 'stand-1',
          identifier: 'A01',
        },
      };

      const mockUpdatedRecord = {
        ...mockCurrentRecord,
        ...updates,
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockCurrentRecord);
      mockRepository.update.mockResolvedValue(mockUpdatedRecord);

      const result = await service.updateMaintenance(recordId, organizationId, updates, userId);

      expect(result).toEqual(mockUpdatedRecord);
      expect(mockRepository.update).toHaveBeenCalledWith(recordId, organizationId, {
        ...updates,
        updatedBy: userId,
      });
    });

    it('should throw error when record not found', async () => {
      const recordId = 'non-existent';
      const updates: MaintenanceUpdateRequest = {
        status: 'COMPLETED',
      };

      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateMaintenance(recordId, organizationId, updates, userId)
      ).rejects.toThrow(`Maintenance record with ID ${recordId} not found`);
    });

    it('should check for conflicts when rescheduling', async () => {
      const recordId = 'maintenance-1';
      const updates: MaintenanceUpdateRequest = {
        status: 'SCHEDULED',
      };

      const mockCurrentRecord = {
        id: recordId,
        standId: 'stand-1',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        stand: {
          id: 'stand-1',
          identifier: 'A01',
        },
      };

      const mockConflict = {
        conflictingRecords: [
          {
            id: 'conflict-1',
            type: 'INSPECTION',
            scheduledStart: new Date('2024-01-01T09:00:00Z'),
            scheduledEnd: new Date('2024-01-01T11:00:00Z'),
            priority: 'HIGH',
          },
        ],
        severity: 'HIGH',
        recommendations: ['Reschedule to avoid conflict'],
      };

      mockRepository.findById.mockResolvedValue(mockCurrentRecord);
      mockRepository.checkSchedulingConflicts.mockResolvedValue(mockConflict);

      await expect(
        service.updateMaintenance(recordId, organizationId, updates, userId)
      ).rejects.toThrow(
        'Scheduling conflict detected. Stand has 1 conflicting maintenance records.'
      );
    });

    it('should send notification on status change', async () => {
      const recordId = 'maintenance-1';
      const updates: MaintenanceUpdateRequest = {
        status: 'COMPLETED',
        actualEnd: new Date('2024-01-01T11:45:00Z'),
      };

      const mockCurrentRecord = {
        id: recordId,
        standId: 'stand-1',
        type: 'ROUTINE',
        status: 'IN_PROGRESS',
        stand: {
          id: 'stand-1',
          identifier: 'A01',
        },
      };

      const mockUpdatedRecord = {
        ...mockCurrentRecord,
        ...updates,
        status: 'COMPLETED',
      };

      mockRepository.findById.mockResolvedValue(mockCurrentRecord);
      mockRepository.update.mockResolvedValue(mockUpdatedRecord);

      const mockListener = jest.fn();
      service.addNotificationListener(mockListener);

      await service.updateMaintenance(recordId, organizationId, updates, userId);

      expect(mockListener).toHaveBeenCalledWith({
        type: 'COMPLETED',
        recordId,
        standId: 'stand-1',
        standIdentifier: 'A01',
        message: 'Maintenance completed: ROUTINE',
        timestamp: expect.any(Date),
        recipients: [],
      });
    });
  });

  describe('getMaintenanceSchedule', () => {
    it('should return enriched maintenance schedule', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      const mockSchedule = [
        {
          standId: 'stand-1',
          standIdentifier: 'A01',
          records: [
            {
              id: 'maintenance-1',
              type: 'ROUTINE',
              scheduledStart: new Date('2024-01-15T10:00:00Z'),
              scheduledEnd: new Date('2024-01-15T12:00:00Z'),
              status: 'SCHEDULED',
              priority: 'MEDIUM',
            },
          ],
        },
      ];

      mockRepository.getSchedule.mockResolvedValue(mockSchedule);

      // Mock stand data for impact analysis
      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue({
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [],
      });
      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getMaintenanceSchedule(organizationId, startDate, endDate);

      expect(result).toEqual([
        {
          ...mockSchedule[0],
          impactAnalyses: [
            {
              recordId: 'maintenance-1',
              impact: {
                affectedStands: [],
                capacityReduction: expect.any(Number),
                alternativeStands: [],
                estimatedRevenueLoss: expect.any(Number),
                operationalConstraints: expect.any(Array),
              },
            },
          ],
        },
      ]);

      expect(mockRepository.getSchedule).toHaveBeenCalledWith(organizationId, startDate, endDate);
    });
  });

  describe('getMaintenanceHistory', () => {
    it('should return maintenance history for stand', async () => {
      const mockHistory = [
        {
          id: 'maintenance-1',
          type: 'ROUTINE',
          status: 'COMPLETED',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          actualStart: new Date('2024-01-01T10:00:00Z'),
          actualEnd: new Date('2024-01-01T11:45:00Z'),
        },
      ];

      mockRepository.getHistoryForStand.mockResolvedValue(mockHistory);

      const result = await service.getMaintenanceHistory(standId, organizationId, 20);

      expect(result).toEqual(mockHistory);
      expect(mockRepository.getHistoryForStand).toHaveBeenCalledWith(standId, organizationId, 20);
    });
  });

  describe('getMaintenanceStatistics', () => {
    it('should return comprehensive maintenance statistics', async () => {
      const mockStats = {
        totalRecords: 25,
        byStatus: {
          SCHEDULED: 5,
          IN_PROGRESS: 2,
          COMPLETED: 15,
          CANCELLED: 1,
          POSTPONED: 2,
        },
        byType: {
          ROUTINE: 10,
          INSPECTION: 8,
          REPAIR: 5,
          EMERGENCY: 2,
        },
        byPriority: {
          LOW: 8,
          MEDIUM: 12,
          HIGH: 4,
          URGENT: 1,
        },
      };

      mockRepository.getStatistics.mockResolvedValue(mockStats);

      // Mock completion rate calculation
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([
        {
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          actualEnd: new Date('2024-01-01T11:45:00Z'),
        },
        {
          scheduledEnd: new Date('2024-01-02T16:00:00Z'),
          actualEnd: new Date('2024-01-02T16:30:00Z'),
        },
      ]);

      const result = await service.getMaintenanceStatistics(organizationId);

      expect(result).toEqual({
        ...mockStats,
        completionRate: 60, // 15 completed / 25 total * 100
        onTimeRate: 50, // 1 on time / 2 total * 100
        costEfficiency: {
          averageActualVsEstimated: 0, // No data with both costs
        },
      });
    });
  });

  describe('getUpcomingMaintenanceAlerts', () => {
    it('should return upcoming maintenance alerts', async () => {
      const mockUpcomingRecords = [
        {
          id: 'maintenance-1',
          standId: 'stand-1',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-05T10:00:00Z'),
          scheduledEnd: new Date('2024-01-05T12:00:00Z'),
          priority: 'MEDIUM',
          stand: {
            id: 'stand-1',
            identifier: 'A01',
          },
        },
      ];

      mockRepository.query.mockResolvedValue(mockUpcomingRecords);

      const result = await service.getUpcomingMaintenanceAlerts(organizationId, 7);

      expect(result).toEqual([
        {
          recordId: 'maintenance-1',
          standId: 'stand-1',
          standIdentifier: 'A01',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-05T10:00:00Z'),
          scheduledEnd: new Date('2024-01-05T12:00:00Z'),
          priority: 'MEDIUM',
          daysUntilStart: expect.any(Number),
        },
      ]);
    });
  });

  describe('notification listeners', () => {
    it('should add and remove notification listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.addNotificationListener(listener1);
      service.addNotificationListener(listener2);

      expect((service as any).notificationListeners).toHaveLength(2);

      service.removeNotificationListener(listener1);
      expect((service as any).notificationListeners).toHaveLength(1);
      expect((service as any).notificationListeners).toContain(listener2);
    });

    it('should handle listener errors gracefully', async () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const workingListener = jest.fn();

      service.addNotificationListener(faultyListener);
      service.addNotificationListener(workingListener);

      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

      // Trigger notification by scheduling maintenance
      const request: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'ROUTINE',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'MEDIUM',
      };

      mockRepository.checkSchedulingConflicts.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'maintenance-1',
        standId: 'stand-1',
        type: 'ROUTINE',
        stand: { id: 'stand-1', identifier: 'A01' },
      });

      // Mock impact analysis
      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue({
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [],
      });
      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue([]);

      await service.scheduleMaintenance(organizationId, request, userId);

      expect(faultyListener).toHaveBeenCalled();
      expect(workingListener).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error in maintenance notification listener:',
        expect.any(Error)
      );

      mockConsoleError.mockRestore();
    });
  });

  describe('private helper methods', () => {
    it('should calculate on-time completion rate correctly', async () => {
      const mockRecords = [
        {
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          actualEnd: new Date('2024-01-01T11:45:00Z'), // On time
        },
        {
          scheduledEnd: new Date('2024-01-02T16:00:00Z'),
          actualEnd: new Date('2024-01-02T16:30:00Z'), // Late
        },
        {
          scheduledEnd: new Date('2024-01-03T14:00:00Z'),
          actualEnd: new Date('2024-01-03T13:30:00Z'), // Early (on time)
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await (service as any).calculateOnTimeCompletionRate(organizationId);

      expect(result).toBeCloseTo(66.67, 2); // 2 on time out of 3 total
    });

    it('should calculate cost efficiency correctly', async () => {
      const mockRecords = [
        {
          estimatedCost: 1000,
          actualCost: 950, // 95% efficiency
        },
        {
          estimatedCost: 500,
          actualCost: 600, // 83.33% efficiency
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await (service as any).calculateCostEfficiency(organizationId);

      expect(result).toBeCloseTo(89.17, 2); // Average of 95% and 83.33%
    });

    it('should analyze maintenance impact correctly', async () => {
      const mockStand = {
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [
          {
            adjacentStandId: 'stand-2',
            impactLevel: 'HIGH',
          },
        ],
      };

      const mockAlternativeStands = [{ id: 'stand-3' }, { id: 'stand-4' }];

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(mockStand);
      (mockPrisma.stand.findMany as jest.Mock).mockResolvedValue(mockAlternativeStands);

      const result = await (service as any).analyzeMaintenanceImpact(
        'stand-1',
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z')
      );

      expect(result).toEqual({
        affectedStands: ['stand-2'],
        capacityReduction: expect.any(Number),
        alternativeStands: ['stand-3', 'stand-4'],
        estimatedRevenueLoss: expect.any(Number),
        operationalConstraints: [
          'Reduced taxiway capacity',
          'Increased ground traffic',
          'Potential delays',
        ],
      });
    });
  });
});
