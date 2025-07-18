import { PrismaClient } from '@prisma/client';
import { ReportingService, ReportPeriod } from '../reporting.service';
import { WorkRequestStatus, Priority, WorkType, AssetType } from '../../index';

jest.mock('@prisma/client');

describe('ReportingService', () => {
  let service: ReportingService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      workRequestApproval: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    } as any;

    service = new ReportingService(mockPrisma);
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance metrics correctly', async () => {
      const period: ReportPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        periodType: 'monthly',
      };

      // Mock total requests
      mockPrisma.workRequest.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(5); // overdue

      // Mock completed requests for resolution time
      mockPrisma.workRequest.findMany.mockResolvedValue([
        {
          submissionDate: new Date('2024-01-01'),
          completedDate: new Date('2024-01-03'),
        },
        {
          submissionDate: new Date('2024-01-05'),
          completedDate: new Date('2024-01-08'),
        },
      ]);

      // Mock approval times
      mockPrisma.workRequestApproval.aggregate.mockResolvedValue({
        _avg: { decisionDate: new Date('2024-01-02').getTime() },
      });

      // Mock cost data
      mockPrisma.workRequest.aggregate.mockResolvedValue({
        _sum: {
          estimatedTotalCost: 50000,
          actualCost: 48000,
        },
      });

      const result = await service.getPerformanceMetrics('org-123', period);

      expect(result.success).toBe(true);
      expect(result.metrics?.totalRequests).toBe(100);
      expect(result.metrics?.completedRequests).toBe(80);
      expect(result.metrics?.completionRate).toBe(80);
      expect(result.metrics?.overdueRequests).toBe(5);
    });

    it('should handle empty data gracefully', async () => {
      const period: ReportPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        periodType: 'monthly',
      };

      mockPrisma.workRequest.count.mockResolvedValue(0);
      mockPrisma.workRequest.findMany.mockResolvedValue([]);
      mockPrisma.workRequest.aggregate.mockResolvedValue({
        _sum: { estimatedTotalCost: null, actualCost: null },
      });

      const result = await service.getPerformanceMetrics('org-123', period);

      expect(result.success).toBe(true);
      expect(result.metrics?.totalRequests).toBe(0);
      expect(result.metrics?.completionRate).toBe(0);
      expect(result.metrics?.costVariance).toBe(0);
    });
  });

  describe('getKPIMetrics', () => {
    it('should calculate KPIs with targets', async () => {
      const period: ReportPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        periodType: 'monthly',
      };

      // Mock current metrics
      jest.spyOn(service, 'getPerformanceMetrics').mockResolvedValue({
        success: true,
        metrics: {
          totalRequests: 100,
          completedRequests: 85,
          completionRate: 85,
          averageResolutionTime: 3.5,
          averageApprovalTime: 1.2,
          onTimeCompletionRate: 92,
          overdueRequests: 5,
          costVariance: 2.5,
          resourceUtilization: 78,
          customerSatisfactionScore: 4.2,
        },
      });

      const result = await service.getKPIMetrics('org-123', period);

      expect(result.success).toBe(true);
      expect(result.kpis).toHaveLength(10);

      const completionRateKPI = result.kpis?.find((kpi) => kpi.name === 'Completion Rate');
      expect(completionRateKPI?.value).toBe(85);
      expect(completionRateKPI?.target).toBe(90);
      expect(completionRateKPI?.status).toBe('warning');
    });
  });

  describe('getTrendAnalysis', () => {
    it('should analyze trends over time', async () => {
      const metric = 'request_volume';
      const periods = 12;

      // Mock monthly data
      const mockData = Array.from({ length: periods }, (_, i) => ({
        period: new Date(2024, i, 1).toISOString(),
        _count: 100 + Math.random() * 20,
      }));

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockData as any);

      const result = await service.getTrendAnalysis('org-123', metric, 'month', periods);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(periods);
      expect(result.trend).toBeDefined();
      expect(['increasing', 'decreasing', 'stable']).toContain(result.trend);
    });

    it('should handle cost trends', async () => {
      const mockData = Array.from({ length: 6 }, (_, i) => ({
        period: new Date(2024, i, 1).toISOString(),
        _sum: { estimatedTotalCost: 10000 + i * 1000 },
      }));

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockData as any);

      const result = await service.getTrendAnalysis('org-123', 'cost', 'month', 6);

      expect(result.success).toBe(true);
      expect(result.data?.[0].value).toBe(10000);
      expect(result.data?.[5].value).toBe(15000);
      expect(result.trend).toBe('increasing');
    });
  });

  describe('getForecast', () => {
    it('should generate forecast based on historical data', async () => {
      // Mock historical data with upward trend
      const historicalData = Array.from({ length: 12 }, (_, i) => ({
        period: new Date(2023, i, 1).toISOString(),
        _count: 100 + i * 5,
      }));

      mockPrisma.workRequest.groupBy.mockResolvedValue(historicalData as any);

      const result = await service.getForecast('org-123', 'request_volume', 'month', 3);

      expect(result.success).toBe(true);
      expect(result.forecast).toHaveLength(3);
      expect(result.forecast?.[0].value).toBeGreaterThan(150); // Should be higher than last historical
      expect(result.forecast?.[0].confidence).toBeDefined();
    });

    it('should handle insufficient data for forecasting', async () => {
      mockPrisma.workRequest.groupBy.mockResolvedValue([]);

      const result = await service.getForecast('org-123', 'request_volume', 'month', 3);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient historical data');
    });
  });

  describe('generateReport', () => {
    it('should generate a complete report', async () => {
      const period: ReportPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        periodType: 'monthly',
      };

      // Mock all necessary data
      jest.spyOn(service, 'getPerformanceMetrics').mockResolvedValue({
        success: true,
        metrics: {
          totalRequests: 100,
          completedRequests: 85,
          completionRate: 85,
          averageResolutionTime: 3.5,
          averageApprovalTime: 1.2,
          onTimeCompletionRate: 92,
          overdueRequests: 5,
          costVariance: 2.5,
          resourceUtilization: 78,
        },
      });

      jest.spyOn(service, 'getKPIMetrics').mockResolvedValue({
        success: true,
        kpis: [],
      });

      const result = await service.generateReport('org-123', 'operational-daily', period);

      expect(result.success).toBe(true);
      expect(result.report?.templateId).toBe('operational-daily');
      expect(result.report?.period).toEqual(period);
      expect(result.report?.data).toHaveProperty('performanceMetrics');
    });
  });

  describe('comparePerformance', () => {
    it('should compare two periods', async () => {
      const currentPeriod: ReportPeriod = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
        periodType: 'monthly',
      };

      const previousPeriod: ReportPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        periodType: 'monthly',
      };

      // Mock metrics for both periods
      const currentMetrics = {
        totalRequests: 120,
        completedRequests: 100,
        completionRate: 83.33,
      };

      const previousMetrics = {
        totalRequests: 100,
        completedRequests: 85,
        completionRate: 85,
      };

      jest
        .spyOn(service, 'getPerformanceMetrics')
        .mockResolvedValueOnce({ success: true, metrics: currentMetrics as any })
        .mockResolvedValueOnce({ success: true, metrics: previousMetrics as any });

      const result = await service.comparePerformance('org-123', currentPeriod, previousPeriod);

      expect(result.success).toBe(true);
      expect(result.comparison?.totalRequests.current).toBe(120);
      expect(result.comparison?.totalRequests.previous).toBe(100);
      expect(result.comparison?.totalRequests.change).toBe(20);
      expect(result.comparison?.totalRequests.percentageChange).toBe(20);
    });
  });
});
