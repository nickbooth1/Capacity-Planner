import {
  ImpactAnalysisService,
  ImpactAnalysisRequest,
  MultiStandImpactAnalysis,
  ImpactNotification,
} from './impact-analysis.service';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

// Mock PrismaClient
const mockPrisma = {
  stand: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  standCapabilitySnapshot: {
    create: jest.fn(),
  },
  standMaintenanceRecord: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock AdjacencyService
jest.mock('./adjacency.service', () => ({
  AdjacencyService: jest.fn().mockImplementation(() => ({
    getAdjacencyImpactAnalysis: jest.fn(),
    findAlternativeStands: jest.fn(),
  })),
}));

// Mock MaintenanceService
jest.mock('./maintenance.service', () => ({
  MaintenanceService: jest.fn().mockImplementation(() => ({
    addNotificationListener: jest.fn(),
  })),
}));

describe('ImpactAnalysisService', () => {
  let service: ImpactAnalysisService;
  let mockAdjacencyService: any;
  let mockMaintenanceService: any;

  const organizationId = 'test-org-id';
  const standId = 'test-stand-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImpactAnalysisService(mockPrisma);
    mockAdjacencyService = (service as any).adjacencyService;
    mockMaintenanceService = (service as any).maintenanceService;
  });

  describe('analyzeMultiStandImpact', () => {
    it('should perform comprehensive multi-stand impact analysis', async () => {
      const request: ImpactAnalysisRequest = {
        standId: 'stand-1',
        impactType: 'MAINTENANCE',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        severity: 'HIGH',
        description: 'Routine maintenance',
      };

      const mockStand = {
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [
          {
            adjacentStandId: 'stand-2',
            distance: 50,
            impactLevel: 'MEDIUM',
            operationalConstraints: [],
            adjacentStand: {
              id: 'stand-2',
              identifier: 'A02',
            },
          },
        ],
        maintenanceRecords: [],
      };

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(mockStand);

      const result = await service.analyzeMultiStandImpact(organizationId, request);

      expect(result).toMatchObject({
        primaryStand: {
          standId: 'stand-1',
          identifier: 'A01',
          directImpact: expect.objectContaining({
            capacityReduction: expect.any(Number),
            revenueImpact: expect.any(Number),
            operationalConstraints: expect.any(Array),
            alternativeStands: expect.any(Array),
            riskFactors: expect.any(Array),
            mitigationCost: expect.any(Number),
          }),
        },
        secondaryStands: expect.arrayContaining([
          expect.objectContaining({
            standId: 'stand-2',
            identifier: 'A02',
            distance: 50,
            impactLevel: 'MEDIUM',
            cascadingImpact: expect.any(Object),
          }),
        ]),
        totalImpact: expect.objectContaining({
          capacityReduction: expect.any(Number),
          revenueImpact: expect.any(Number),
          operationalComplexity: expect.any(Number),
          riskScore: expect.any(Number),
        }),
        mitigationOptions: expect.any(Array),
        timeline: expect.any(Array),
      });
    });

    it('should throw error if stand not found', async () => {
      const request: ImpactAnalysisRequest = {
        standId: 'non-existent-stand',
        impactType: 'CLOSURE',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        severity: 'CRITICAL',
      };

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.analyzeMultiStandImpact(organizationId, request)).rejects.toThrow(
        'Stand not found'
      );
    });

    it('should throw error if stand belongs to different organization', async () => {
      const request: ImpactAnalysisRequest = {
        standId: 'stand-1',
        impactType: 'MAINTENANCE',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        severity: 'HIGH',
      };

      const mockStand = {
        id: 'stand-1',
        identifier: 'A01',
        organizationId: 'different-org-id',
        adjacencies: [],
        maintenanceRecords: [],
      };

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(mockStand);

      await expect(service.analyzeMultiStandImpact(organizationId, request)).rejects.toThrow(
        'Stand not found'
      );
    });

    it('should send impact notification after analysis', async () => {
      const request: ImpactAnalysisRequest = {
        standId: 'stand-1',
        impactType: 'MAINTENANCE',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        severity: 'HIGH',
      };

      const mockStand = {
        id: 'stand-1',
        identifier: 'A01',
        organizationId,
        adjacencies: [],
        maintenanceRecords: [],
      };

      (mockPrisma.stand.findUnique as jest.Mock).mockResolvedValue(mockStand);

      const mockListener = jest.fn();
      service.addNotificationListener(mockListener);

      await service.analyzeMultiStandImpact(organizationId, request);

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'IMPACT_DETECTED',
          priority: 'HIGH',
          standId: 'stand-1',
          standIdentifier: 'A01',
          description: 'MAINTENANCE impact detected with HIGH severity',
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('createTemporalImpactModel', () => {
    it('should create temporal impact model with hourly time slots', async () => {
      const result = await service.createTemporalImpactModel(
        standId,
        organizationId,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T14:00:00Z')
      );

      expect(result).toMatchObject({
        timeSlots: expect.arrayContaining([
          expect.objectContaining({
            startTime: expect.any(Date),
            endTime: expect.any(Date),
            impactLevel: expect.any(Number),
            affectedOperations: expect.any(Array),
            resourceRequirements: expect.any(Array),
          }),
        ]),
        peakImpactTime: expect.any(Date),
        totalDuration: 4, // 4 hours
        recoveryTime: 0.8, // 20% of 4 hours
      });

      expect(result.timeSlots.length).toBe(4); // 4 hourly slots
    });

    it('should identify peak impact time correctly', async () => {
      const result = await service.createTemporalImpactModel(
        standId,
        organizationId,
        new Date('2024-01-01T08:00:00Z'), // Peak morning hour
        new Date('2024-01-01T10:00:00Z')
      );

      // Peak impact should be during morning rush hour
      expect(result.peakImpactTime.getHours()).toBe(8);

      // Find the slot with highest impact
      const peakSlot = result.timeSlots.reduce((max, slot) =>
        slot.impactLevel > max.impactLevel ? slot : max
      );

      expect(peakSlot.impactLevel).toBeGreaterThan(0);
    });

    it('should handle different time periods correctly', async () => {
      // Test off-peak hours
      const offPeakResult = await service.createTemporalImpactModel(
        standId,
        organizationId,
        new Date('2024-01-01T02:00:00Z'), // 2 AM
        new Date('2024-01-01T04:00:00Z') // 4 AM
      );

      // Test peak hours
      const peakResult = await service.createTemporalImpactModel(
        standId,
        organizationId,
        new Date('2024-01-01T08:00:00Z'), // 8 AM
        new Date('2024-01-01T10:00:00Z') // 10 AM
      );

      // Peak hours should have higher impact
      const avgOffPeakImpact =
        offPeakResult.timeSlots.reduce((sum, slot) => sum + slot.impactLevel, 0) /
        offPeakResult.timeSlots.length;
      const avgPeakImpact =
        peakResult.timeSlots.reduce((sum, slot) => sum + slot.impactLevel, 0) /
        peakResult.timeSlots.length;

      expect(avgPeakImpact).toBeGreaterThan(avgOffPeakImpact);
    });
  });

  describe('generateMitigationSuggestions', () => {
    it('should generate comprehensive mitigation suggestions', async () => {
      const mockImpactAnalysis: MultiStandImpactAnalysis = {
        primaryStand: {
          standId: 'stand-1',
          identifier: 'A01',
          directImpact: {
            capacityReduction: 60,
            revenueImpact: 15000,
            operationalConstraints: ['Reduced capacity'],
            alternativeStands: ['stand-2', 'stand-3'],
            riskFactors: ['High impact'],
            mitigationCost: 5000,
          },
        },
        secondaryStands: [
          {
            standId: 'stand-2',
            identifier: 'A02',
            distance: 50,
            impactLevel: 'HIGH',
            cascadingImpact: {
              capacityReduction: 20,
              revenueImpact: 5000,
              operationalConstraints: [],
              alternativeStands: [],
              riskFactors: [],
              mitigationCost: 2000,
            },
          },
          {
            standId: 'stand-3',
            identifier: 'A03',
            distance: 75,
            impactLevel: 'MEDIUM',
            cascadingImpact: {
              capacityReduction: 10,
              revenueImpact: 2500,
              operationalConstraints: [],
              alternativeStands: [],
              riskFactors: [],
              mitigationCost: 1000,
            },
          },
        ],
        totalImpact: {
          capacityReduction: 90,
          revenueImpact: 22500,
          operationalComplexity: 30,
          riskScore: 85,
        },
        mitigationOptions: [],
        timeline: [],
      };

      const result = await service.generateMitigationSuggestions(
        standId,
        organizationId,
        mockImpactAnalysis
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Should include operational change suggestion (capacity reduction > 50%)
      const operationalChange = result.find((option) => option.type === 'OPERATIONAL_CHANGE');
      expect(operationalChange).toBeDefined();
      expect(operationalChange?.description).toContain(
        'Reduce operations during peak impact hours'
      );

      // Should include resource allocation suggestion (multiple secondary stands)
      const resourceAllocation = result.find((option) => option.type === 'RESOURCE_ALLOCATION');
      expect(resourceAllocation).toBeDefined();
      expect(resourceAllocation?.description).toContain(
        'Deploy additional ground support resources'
      );

      // Should include delay impact suggestion
      const delayImpact = result.find((option) => option.type === 'DELAY_IMPACT');
      expect(delayImpact).toBeDefined();
      expect(delayImpact?.description).toContain('Reschedule impact to off-peak hours');

      // Results should be sorted by effectiveness
      for (let i = 1; i < result.length; i++) {
        expect(result[i].effectiveness).toBeLessThanOrEqual(result[i - 1].effectiveness);
      }
    });

    it('should include alternative stand suggestions', async () => {
      const mockImpactAnalysis: MultiStandImpactAnalysis = {
        primaryStand: {
          standId: 'stand-1',
          identifier: 'A01',
          directImpact: {
            capacityReduction: 30,
            revenueImpact: 8000,
            operationalConstraints: [],
            alternativeStands: ['stand-2'],
            riskFactors: [],
            mitigationCost: 3000,
          },
        },
        secondaryStands: [],
        totalImpact: {
          capacityReduction: 30,
          revenueImpact: 8000,
          operationalComplexity: 10,
          riskScore: 40,
        },
        mitigationOptions: [],
        timeline: [],
      };

      // Mock alternative stands
      const mockAlternativeStands = [
        {
          identifier: 'B01',
          switchingCost: 2000,
          suitabilityScore: 85,
          limitations: ['Limited equipment access'],
        },
        {
          identifier: 'B02',
          switchingCost: 1500,
          suitabilityScore: 90,
          limitations: ['Distance from terminal'],
        },
      ];

      // Mock the findAlternativeStands method
      service['findAlternativeStands'] = jest.fn().mockResolvedValue(mockAlternativeStands);

      const result = await service.generateMitigationSuggestions(
        standId,
        organizationId,
        mockImpactAnalysis
      );

      const alternativeStandSuggestions = result.filter(
        (option) => option.type === 'ALTERNATIVE_STAND'
      );
      expect(alternativeStandSuggestions).toHaveLength(2);

      expect(alternativeStandSuggestions[0]).toMatchObject({
        type: 'ALTERNATIVE_STAND',
        description: 'Use stand B01 as alternative',
        cost: 2000,
        effectiveness: 85,
        implementationTime: 2,
        requiredResources: ['Ground crew', 'Coordination'],
        sideEffects: ['Limited equipment access'],
      });
    });
  });

  describe('setupRealTimeNotifications', () => {
    it('should setup real-time monitoring with thresholds', async () => {
      const thresholds = {
        capacityReduction: 50,
        revenueImpact: 10000,
        riskScore: 70,
      };

      // Mock setInterval to avoid actual timers in tests
      const originalSetInterval = global.setInterval;
      const mockSetInterval = jest.fn();
      global.setInterval = mockSetInterval;

      await service.setupRealTimeNotifications(organizationId, thresholds);

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // 1 minute
      );

      // Verify maintenance service listener was added
      expect(mockMaintenanceService.addNotificationListener).toHaveBeenCalledWith(
        expect.any(Function)
      );

      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });
  });

  describe('generateScheduledReport', () => {
    it('should generate comprehensive scheduled report', async () => {
      const mockImpacts = [
        {
          standId: 'stand-1',
          impactType: 'MAINTENANCE',
          severity: 'HIGH',
          cost: 5000,
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          standId: 'stand-2',
          impactType: 'CLOSURE',
          severity: 'CRITICAL',
          cost: 8000,
          timestamp: new Date('2024-01-02T14:00:00Z'),
        },
      ];

      // Mock the getHistoricalImpacts method
      service['getHistoricalImpacts'] = jest.fn().mockResolvedValue(mockImpacts);

      const result = await service.generateScheduledReport(
        organizationId,
        'WEEKLY',
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-07T23:59:59Z')
      );

      expect(result).toMatchObject({
        summary: expect.objectContaining({
          totalImpacts: expect.any(Number),
          averageImpactDuration: expect.any(Number),
          costPerImpact: expect.any(Number),
          mitigationEffectiveness: expect.any(Number),
          responseTime: expect.any(Number),
          byType: expect.any(Object),
          bySeverity: expect.any(Object),
          trends: expect.any(Array),
        }),
        detailedAnalysis: expect.any(Array),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('setupAlertThresholds', () => {
    it('should setup alert thresholds and monitoring', async () => {
      const thresholds = {
        capacityReduction: { warning: 30, critical: 60 },
        revenueImpact: { warning: 5000, critical: 15000 },
        cascadingImpacts: { warning: 2, critical: 5 },
      };

      (mockPrisma.standCapabilitySnapshot.create as jest.Mock).mockResolvedValue({
        id: 'threshold-config-1',
      });

      await service.setupAlertThresholds(organizationId, thresholds);

      expect(mockPrisma.standCapabilitySnapshot.create).toHaveBeenCalledWith({
        data: {
          standId: 'system-config',
          capabilities: {
            impactThresholds: thresholds,
          },
          userId: 'system',
        },
      });
    });
  });

  describe('getImpactMetrics', () => {
    it('should return impact metrics for organization', async () => {
      const result = await service.getImpactMetrics(organizationId);

      expect(result).toMatchObject({
        totalImpacts: expect.any(Number),
        averageImpactDuration: expect.any(Number),
        costPerImpact: expect.any(Number),
        mitigationEffectiveness: expect.any(Number),
        responseTime: expect.any(Number),
        byType: expect.any(Object),
        bySeverity: expect.any(Object),
        trends: expect.any(Array),
      });
    });
  });

  describe('notification listeners', () => {
    it('should add and remove notification listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.addNotificationListener(listener1);
      service.addNotificationListener(listener2);

      expect((service as any).notificationListeners.size).toBe(2);

      service.removeNotificationListener(listener1);
      expect((service as any).notificationListeners.size).toBe(1);

      service.removeNotificationListener(listener2);
      expect((service as any).notificationListeners.size).toBe(0);
    });

    it('should handle notification listener errors gracefully', async () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const workingListener = jest.fn();

      service.addNotificationListener(faultyListener);
      service.addNotificationListener(workingListener);

      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

      // Trigger notification
      const notification: ImpactNotification = {
        id: 'test-notification',
        type: 'IMPACT_DETECTED',
        priority: 'HIGH',
        standId: 'stand-1',
        standIdentifier: 'A01',
        description: 'Test notification',
        timestamp: new Date(),
        recipients: [],
        actions: [],
        metadata: {},
      };

      await (service as any).sendImpactNotification(notification);

      expect(faultyListener).toHaveBeenCalled();
      expect(workingListener).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error in impact notification listener:',
        expect.any(Error)
      );

      mockConsoleError.mockRestore();
    });
  });

  describe('EventEmitter integration', () => {
    it('should emit impact notification events', async () => {
      const mockListener = jest.fn();
      service.on('impactNotification', mockListener);

      const notification: ImpactNotification = {
        id: 'test-notification',
        type: 'IMPACT_DETECTED',
        priority: 'HIGH',
        standId: 'stand-1',
        standIdentifier: 'A01',
        description: 'Test notification',
        timestamp: new Date(),
        recipients: [],
        actions: [],
        metadata: {},
      };

      await (service as any).sendImpactNotification(notification);

      expect(mockListener).toHaveBeenCalledWith(notification);
    });
  });
});
