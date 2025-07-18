import {
  MaintenanceSchedulerService,
  SchedulingConflict,
  SchedulingWindow,
  OptimizedSchedule,
} from './maintenance-scheduler.service';
import { MaintenanceScheduleRequest } from './maintenance.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  standMaintenanceRecord: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  stand: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock MaintenanceRepository
jest.mock('../repositories/maintenance.repository', () => ({
  MaintenanceRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
    checkSchedulingConflicts: jest.fn(),
  })),
}));

describe('MaintenanceSchedulerService', () => {
  let service: MaintenanceSchedulerService;
  let mockRepository: any;

  const organizationId = 'test-org-id';
  const standId = 'test-stand-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaintenanceSchedulerService(mockPrisma);
    mockRepository = (service as any).repository;
  });

  describe('detectSchedulingConflicts', () => {
    it('should return null when no conflicts exist', async () => {
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.detectSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z')
      );

      expect(result).toBeNull();
    });

    it('should detect scheduling conflicts and return appropriate severity', async () => {
      const conflictingRecords = [
        {
          id: 'record-1',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-01T09:00:00Z'),
          scheduledEnd: new Date('2024-01-01T11:00:00Z'),
          priority: 'HIGH',
        },
        {
          id: 'record-2',
          type: 'INSPECTION',
          scheduledStart: new Date('2024-01-01T11:30:00Z'),
          scheduledEnd: new Date('2024-01-01T13:00:00Z'),
          priority: 'MEDIUM',
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(
        conflictingRecords
      );

      const result = await service.detectSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z')
      );

      expect(result).toEqual({
        conflictingRecords,
        severity: 'CRITICAL', // HIGH priority conflict makes it CRITICAL
        recommendations: expect.any(Array),
      });
    });

    it('should exclude specific record when provided', async () => {
      const excludeId = 'exclude-record';

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      await service.detectSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z'),
        excludeId
      );

      expect(mockPrisma.standMaintenanceRecord.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: excludeId },
        }),
        select: expect.any(Object),
      });
    });

    it('should determine correct severity based on conflict count and priority', async () => {
      const lowPriorityConflicts = [
        {
          id: 'record-1',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-01T09:00:00Z'),
          scheduledEnd: new Date('2024-01-01T11:00:00Z'),
          priority: 'LOW',
        },
        {
          id: 'record-2',
          type: 'CLEANING',
          scheduledStart: new Date('2024-01-01T11:30:00Z'),
          scheduledEnd: new Date('2024-01-01T13:00:00Z'),
          priority: 'LOW',
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(
        lowPriorityConflicts
      );

      const result = await service.detectSchedulingConflicts(
        standId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:00:00Z')
      );

      expect(result?.severity).toBe('MEDIUM'); // 2 conflicts = MEDIUM
    });
  });

  describe('findOptimalSchedulingWindows', () => {
    it('should find available scheduling windows without conflicts', async () => {
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findOptimalSchedulingWindows(
        standId,
        2, // 2 hours duration
        new Date('2024-01-01T08:00:00Z'),
        new Date('2024-01-01T18:00:00Z')
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatchObject({
        start: expect.any(Date),
        end: expect.any(Date),
        standId,
        available: true,
        conflicts: [],
        score: expect.any(Number),
      });
    });

    it('should identify conflicts and score windows appropriately', async () => {
      const existingRecords = [
        {
          id: 'record-1',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(existingRecords);

      const result = await service.findOptimalSchedulingWindows(
        standId,
        2, // 2 hours duration
        new Date('2024-01-01T08:00:00Z'),
        new Date('2024-01-01T18:00:00Z')
      );

      // Find window that overlaps with existing record
      const conflictingWindow = result.find(
        (window) =>
          window.start <= existingRecords[0].scheduledEnd &&
          window.end >= existingRecords[0].scheduledStart
      );

      if (conflictingWindow) {
        expect(conflictingWindow.available).toBe(false);
        expect(conflictingWindow.conflicts).toContain('record-1');
      }
    });

    it('should respect business hours constraint', async () => {
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findOptimalSchedulingWindows(
        standId,
        2,
        new Date('2024-01-01T06:00:00Z'),
        new Date('2024-01-01T20:00:00Z'),
        { businessHours: true }
      );

      // All windows should be within business hours (8 AM - 6 PM)
      result.forEach((window) => {
        expect(window.start.getHours()).toBeGreaterThanOrEqual(8);
        expect(window.end.getHours()).toBeLessThanOrEqual(18);
      });
    });

    it('should respect weekends only constraint', async () => {
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findOptimalSchedulingWindows(
        standId,
        2,
        new Date('2024-01-01T08:00:00Z'), // Monday
        new Date('2024-01-07T18:00:00Z'), // Sunday
        { weekendsOnly: true }
      );

      // All windows should be on weekends (Saturday = 6, Sunday = 0)
      result.forEach((window) => {
        const day = window.start.getDay();
        expect(day === 0 || day === 6).toBe(true);
      });
    });

    it('should sort windows by score in descending order', async () => {
      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findOptimalSchedulingWindows(
        standId,
        2,
        new Date('2024-01-01T08:00:00Z'),
        new Date('2024-01-01T18:00:00Z')
      );

      // Verify windows are sorted by score (highest first)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].score).toBeLessThanOrEqual(result[i - 1].score);
      }
    });
  });

  describe('optimizeSchedule', () => {
    it('should optimize schedule for multiple requests by priority', async () => {
      const requests: MaintenanceScheduleRequest[] = [
        {
          standId: 'stand-1',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          priority: 'LOW',
        },
        {
          standId: 'stand-2',
          type: 'URGENT_REPAIR',
          scheduledStart: new Date('2024-01-01T11:00:00Z'),
          scheduledEnd: new Date('2024-01-01T13:00:00Z'),
          priority: 'URGENT',
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.optimizeSchedule(organizationId, requests);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);

      // Verify URGENT request is processed first (higher priority)
      expect(result[0].standId).toBe('stand-2');
      expect(result[1].standId).toBe('stand-1');
    });

    it('should include resource allocation in optimized schedule', async () => {
      const requests: MaintenanceScheduleRequest[] = [
        {
          standId: 'stand-1',
          type: 'ROUTINE',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          priority: 'MEDIUM',
          requiredSkills: ['ELECTRICAL'],
          requiredEquipment: ['LIFT'],
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.optimizeSchedule(organizationId, requests);

      expect(result[0].resourceAllocation).toBeInstanceOf(Array);
      expect(result[0].resourceAllocation.length).toBeGreaterThan(0);
      expect(result[0].resourceAllocation[0]).toMatchObject({
        resourceId: expect.any(String),
        resourceType: expect.any(String),
        allocatedFrom: expect.any(Date),
        allocatedTo: expect.any(Date),
        cost: expect.any(Number),
        availability: expect.any(String),
      });
    });
  });

  describe('allocateResources', () => {
    it('should allocate technicians based on required skills', async () => {
      const request: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'ELECTRICAL',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'MEDIUM',
        requiredSkills: ['ELECTRICAL', 'HYDRAULICS'],
      };

      const result = await service.allocateResources(
        request,
        request.scheduledStart,
        request.scheduledEnd
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2); // One for each skill

      const electricalTech = result.find((r) => r.resourceId.includes('ELECTRICAL'));
      const hydraulicsTech = result.find((r) => r.resourceId.includes('HYDRAULICS'));

      expect(electricalTech).toBeDefined();
      expect(hydraulicsTech).toBeDefined();
      expect(electricalTech?.resourceType).toBe('TECHNICIAN');
      expect(hydraulicsTech?.resourceType).toBe('TECHNICIAN');
    });

    it('should allocate equipment based on requirements', async () => {
      const request: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'MECHANICAL',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'HIGH',
        requiredEquipment: ['LIFT', 'COMPRESSOR'],
      };

      const result = await service.allocateResources(
        request,
        request.scheduledStart,
        request.scheduledEnd
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2); // One for each equipment

      const lift = result.find((r) => r.resourceId.includes('LIFT'));
      const compressor = result.find((r) => r.resourceId.includes('COMPRESSOR'));

      expect(lift).toBeDefined();
      expect(compressor).toBeDefined();
      expect(lift?.resourceType).toBe('EQUIPMENT');
      expect(compressor?.resourceType).toBe('EQUIPMENT');
    });
  });

  describe('handlePriorityScheduling', () => {
    it('should handle urgent maintenance scheduling with preemption', async () => {
      const urgentRequest: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'URGENT_REPAIR',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'URGENT',
      };

      const conflictingRecords = [
        {
          id: 'record-1',
          scheduledStart: new Date('2024-01-01T09:00:00Z'),
          scheduledEnd: new Date('2024-01-01T11:00:00Z'),
          priority: 'LOW',
        },
        {
          id: 'record-2',
          scheduledStart: new Date('2024-01-01T11:30:00Z'),
          scheduledEnd: new Date('2024-01-01T13:00:00Z'),
          priority: 'HIGH',
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(
        conflictingRecords
      );
      (mockPrisma.standMaintenanceRecord.update as jest.Mock).mockResolvedValue({});

      const result = await service.handlePriorityScheduling(organizationId, urgentRequest);

      expect(result).toEqual({
        scheduledTime: urgentRequest.scheduledStart,
        preemptedRecords: ['record-1'], // LOW priority should be preempted
        adjustedRecords: ['record-2'], // HIGH priority should be adjusted
      });

      // Verify LOW priority record was postponed
      expect(mockPrisma.standMaintenanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: { status: 'POSTPONED' },
      });

      // Verify HIGH priority record was rescheduled
      expect(mockPrisma.standMaintenanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-2' },
        data: {
          scheduledStart: expect.any(Date),
          scheduledEnd: expect.any(Date),
        },
      });
    });

    it('should throw error for non-urgent requests', async () => {
      const nonUrgentRequest: MaintenanceScheduleRequest = {
        standId: 'stand-1',
        type: 'ROUTINE',
        scheduledStart: new Date('2024-01-01T10:00:00Z'),
        scheduledEnd: new Date('2024-01-01T12:00:00Z'),
        priority: 'MEDIUM',
      };

      await expect(
        service.handlePriorityScheduling(organizationId, nonUrgentRequest)
      ).rejects.toThrow('Priority scheduling only available for URGENT requests');
    });
  });

  describe('generateMaintenanceReport', () => {
    it('should generate comprehensive maintenance report', async () => {
      const mockRecords = [
        {
          id: 'record-1',
          type: 'ROUTINE',
          priority: 'MEDIUM',
          status: 'COMPLETED',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          actualStart: new Date('2024-01-01T10:00:00Z'),
          actualEnd: new Date('2024-01-01T12:00:00Z'),
          estimatedCost: 1000,
          actualCost: 1200,
          stand: { id: 'stand-1' },
        },
        {
          id: 'record-2',
          type: 'INSPECTION',
          priority: 'HIGH',
          status: 'COMPLETED',
          scheduledStart: new Date('2024-01-02T14:00:00Z'),
          scheduledEnd: new Date('2024-01-02T16:00:00Z'),
          actualStart: new Date('2024-01-02T14:00:00Z'),
          actualEnd: new Date('2024-01-02T15:30:00Z'),
          estimatedCost: 500,
          actualCost: 450,
          stand: { id: 'stand-2' },
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await service.generateMaintenanceReport(
        organizationId,
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T23:59:59Z')
      );

      expect(result).toEqual({
        summary: {
          totalScheduled: 2,
          totalCompleted: 2,
          totalCost: 1650,
          averageDuration: 1.75, // Average hours
          onTimeRate: 100, // Both completed on time
        },
        byType: {
          ROUTINE: 1,
          INSPECTION: 1,
        },
        byPriority: {
          MEDIUM: 1,
          HIGH: 1,
        },
        costAnalysis: {
          budgetVariance: 10, // (1650 - 1500) / 1500 * 100
          costPerHour: expect.any(Number),
          mostExpensiveType: 'ROUTINE',
        },
        recommendations: expect.any(Array),
      });
    });

    it('should generate appropriate recommendations based on metrics', async () => {
      const mockRecords = [
        {
          id: 'record-1',
          type: 'ROUTINE',
          priority: 'URGENT',
          status: 'COMPLETED',
          scheduledStart: new Date('2024-01-01T10:00:00Z'),
          scheduledEnd: new Date('2024-01-01T12:00:00Z'),
          actualStart: new Date('2024-01-01T10:00:00Z'),
          actualEnd: new Date('2024-01-01T14:00:00Z'), // Late completion
          estimatedCost: 1000,
          actualCost: 1500, // 50% over budget
          stand: { id: 'stand-1' },
        },
        {
          id: 'record-2',
          type: 'INSPECTION',
          priority: 'URGENT',
          status: 'COMPLETED',
          scheduledStart: new Date('2024-01-02T14:00:00Z'),
          scheduledEnd: new Date('2024-01-02T16:00:00Z'),
          actualStart: new Date('2024-01-02T14:00:00Z'),
          actualEnd: new Date('2024-01-02T18:00:00Z'), // Late completion
          estimatedCost: 500,
          actualCost: 800, // 60% over budget
          stand: { id: 'stand-2' },
        },
      ];

      (mockPrisma.standMaintenanceRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await service.generateMaintenanceReport(
        organizationId,
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T23:59:59Z')
      );

      expect(result.recommendations).toContain('Consider reviewing cost estimation methods');
      expect(result.recommendations).toContain(
        'Review scheduling practices to improve on-time completion'
      );
      expect(result.recommendations).toContain(
        'High number of urgent maintenance - consider preventive maintenance'
      );
    });
  });
});
