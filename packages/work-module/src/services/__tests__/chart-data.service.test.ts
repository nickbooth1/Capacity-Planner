import { PrismaClient } from '@prisma/client';
import { ChartDataService } from '../chart-data.service';
import { WorkRequestStatus, Priority, AssetType } from '../../index';

jest.mock('@prisma/client');

describe('ChartDataService', () => {
  let service: ChartDataService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workRequest: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;

    service = new ChartDataService(mockPrisma);
  });

  describe('getStatusDistributionChart', () => {
    it('should generate status distribution pie chart', async () => {
      const mockData = [
        { status: WorkRequestStatus.SUBMITTED, _count: 30 },
        { status: WorkRequestStatus.APPROVED, _count: 20 },
        { status: WorkRequestStatus.IN_PROGRESS, _count: 15 },
        { status: WorkRequestStatus.COMPLETED, _count: 35 },
      ];

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockData);

      const result = await service.getStatusDistributionChart('org-123');

      expect(result.config.type).toBe('pie');
      expect(result.config.title).toBe('Work Request Status Distribution');
      expect(result.series[0].data).toHaveLength(4);
      expect(result.series[0].data[0].label).toBe('Submitted');
      expect(result.series[0].data[0].value).toBe(30);
    });
  });

  describe('getPriorityDistributionChart', () => {
    it('should generate priority distribution bar chart', async () => {
      const mockData = [
        { priority: Priority.CRITICAL, _count: 5 },
        { priority: Priority.HIGH, _count: 15 },
        { priority: Priority.MEDIUM, _count: 25 },
        { priority: Priority.LOW, _count: 10 },
      ];

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockData);

      const result = await service.getPriorityDistributionChart('org-123');

      expect(result.config.type).toBe('bar');
      expect(result.config.title).toBe('Work Requests by Priority');
      expect(result.series[0].data).toHaveLength(4);
      expect(result.series[0].data[0].label).toBe('Critical');
      expect(result.series[0].data[0].value).toBe(5);
    });
  });

  describe('getRequestVolumeTimeSeriesChart', () => {
    it('should generate time series line chart', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      const mockRequests = [
        { createdAt: new Date('2024-01-01'), status: WorkRequestStatus.SUBMITTED },
        { createdAt: new Date('2024-01-01'), status: WorkRequestStatus.APPROVED },
        { createdAt: new Date('2024-01-02'), status: WorkRequestStatus.SUBMITTED },
        { createdAt: new Date('2024-01-03'), status: WorkRequestStatus.COMPLETED },
      ];

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.getRequestVolumeTimeSeriesChart(
        'org-123',
        startDate,
        endDate,
        'day'
      );

      expect(result.config.type).toBe('line');
      expect(result.config.title).toBe('Request Volume Over Time');
      expect(result.series.length).toBeGreaterThan(1);
      expect(result.series[0].name).toBe('Total');
    });

    it('should group by week correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockRequests = Array.from({ length: 20 }, (_, i) => ({
        createdAt: new Date(2024, 0, i + 1),
        status: WorkRequestStatus.SUBMITTED,
      }));

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.getRequestVolumeTimeSeriesChart(
        'org-123',
        startDate,
        endDate,
        'week'
      );

      expect(result.config.xAxis?.type).toBe('datetime');
      expect(result.series[0].data.length).toBeLessThan(20); // Should be grouped by week
    });
  });

  describe('getAssetTypePerformanceChart', () => {
    it('should calculate completion rate by asset type', async () => {
      const mockAssetTypes = [
        { assetType: AssetType.STAND, _count: 50 },
        { assetType: AssetType.GATE, _count: 30 },
        { assetType: AssetType.RUNWAY, _count: 20 },
      ];

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockAssetTypes);

      // Mock completion counts
      mockPrisma.workRequest.count
        .mockResolvedValueOnce(40) // STAND completed
        .mockResolvedValueOnce(25) // GATE completed
        .mockResolvedValueOnce(18); // RUNWAY completed

      const result = await service.getAssetTypePerformanceChart('org-123', 'completion_rate');

      expect(result.config.type).toBe('gauge');
      expect(result.config.title).toBe('Completion Rate by Asset Type (%)');
      expect(result.series[0].data[0].value).toBe(80); // 40/50 * 100
      expect(result.series[0].data[1].value).toBe(83.33); // 25/30 * 100
    });

    it('should calculate average completion time', async () => {
      const mockAssetTypes = [{ assetType: AssetType.STAND, _count: 10 }];

      const mockCompletedRequests = [
        {
          submissionDate: new Date('2024-01-01'),
          completedDate: new Date('2024-01-03'),
        },
        {
          submissionDate: new Date('2024-01-05'),
          completedDate: new Date('2024-01-08'),
        },
      ];

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockAssetTypes);
      mockPrisma.workRequest.findMany.mockResolvedValue(mockCompletedRequests);

      const result = await service.getAssetTypePerformanceChart('org-123', 'avg_time');

      expect(result.config.type).toBe('bar');
      expect(result.config.yAxis?.title).toBe('Days');
      expect(result.series[0].data[0].value).toBe(2.5); // Average of 2 and 3 days
    });
  });

  describe('getCostAnalysisChart', () => {
    it('should generate cost distribution by category', async () => {
      const mockCostData = [
        { category: 'routine', _sum: { estimatedTotalCost: 25000 } },
        { category: 'corrective', _sum: { estimatedTotalCost: 35000 } },
        { category: 'preventive', _sum: { estimatedTotalCost: 20000 } },
      ];

      mockPrisma.workRequest.groupBy.mockResolvedValue(mockCostData);

      const result = await service.getCostAnalysisChart('org-123', 'category');

      expect(result.config.type).toBe('donut');
      expect(result.config.title).toBe('Cost Distribution by Category');
      expect(result.series[0].data).toHaveLength(3);
      expect(result.series[0].data[0].value).toBe(35000); // Should be sorted by value
    });

    it('should generate cost trend by month', async () => {
      const mockRequests = [
        { createdAt: new Date('2024-01-15'), estimatedTotalCost: 5000 },
        { createdAt: new Date('2024-01-20'), estimatedTotalCost: 3000 },
        { createdAt: new Date('2024-02-10'), estimatedTotalCost: 7000 },
      ];

      mockPrisma.workRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.getCostAnalysisChart('org-123', 'month');

      expect(result.config.type).toBe('area');
      expect(result.config.title).toBe('Cost Trend by Month');
      expect(result.series[0].data[0].value).toBe(8000); // January total
      expect(result.series[0].data[1].value).toBe(7000); // February total
    });
  });

  describe('getSLAComplianceGauge', () => {
    it('should calculate SLA compliance rate', async () => {
      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      mockPrisma.workRequest.count
        .mockResolvedValueOnce(100) // Total with deadlines
        .mockResolvedValueOnce(92); // Completed on time

      const result = await service.getSLAComplianceGauge('org-123', period);

      expect(result.config.type).toBe('gauge');
      expect(result.config.title).toBe('SLA Compliance Rate');
      expect(result.series[0].data[0].value).toBe(92);
      expect(result.series[0].data[0].metadata.total).toBe(100);
      expect(result.series[0].data[0].metadata.onTime).toBe(92);
    });

    it('should handle zero requests', async () => {
      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      mockPrisma.workRequest.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const result = await service.getSLAComplianceGauge('org-123', period);

      expect(result.series[0].data[0].value).toBe(100); // Default to 100% when no data
    });
  });
});
