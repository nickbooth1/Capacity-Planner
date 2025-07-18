import { PrismaClient } from '@prisma/client';
import { WorkRequestStatus, Priority, WorkType, AssetType } from '../index';

export interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
  metadata?: any;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartConfiguration {
  type: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'scatter' | 'heatmap' | 'gauge' | 'treemap';
  title?: string;
  subtitle?: string;
  xAxis?: {
    title?: string;
    type?: 'category' | 'datetime' | 'numeric';
  };
  yAxis?: {
    title?: string;
    min?: number;
    max?: number;
  };
  legend?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right';
  };
  colors?: string[];
}

export interface ChartData {
  config: ChartConfiguration;
  series: ChartSeries[];
  metadata?: any;
}

export class ChartDataService {
  constructor(private prisma: PrismaClient) {}

  async getStatusDistributionChart(organizationId: string, filters?: any): Promise<ChartData> {
    const where = { organizationId, ...filters };

    const statusCounts = await this.prisma.workRequest.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const data: ChartDataPoint[] = statusCounts.map((item) => ({
      label: this.formatStatusLabel(item.status as WorkRequestStatus),
      value: item._count,
      metadata: { status: item.status },
    }));

    return {
      config: {
        type: 'pie',
        title: 'Work Request Status Distribution',
        colors: this.getStatusColors(),
      },
      series: [
        {
          name: 'Status',
          data,
        },
      ],
    };
  }

  async getPriorityDistributionChart(organizationId: string, filters?: any): Promise<ChartData> {
    const where = { organizationId, ...filters };

    const priorityCounts = await this.prisma.workRequest.groupBy({
      by: ['priority'],
      where,
      _count: true,
      orderBy: {
        priority: 'asc',
      },
    });

    const data: ChartDataPoint[] = priorityCounts.map((item) => ({
      label: this.formatPriorityLabel(item.priority as Priority),
      value: item._count,
      metadata: { priority: item.priority },
    }));

    return {
      config: {
        type: 'bar',
        title: 'Work Requests by Priority',
        xAxis: { title: 'Priority' },
        yAxis: { title: 'Count' },
        colors: this.getPriorityColors(),
      },
      series: [
        {
          name: 'Count',
          data,
        },
      ],
    };
  }

  async getRequestVolumeTimeSeriesChart(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<ChartData> {
    const requests = await this.prisma.workRequest.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by time period
    const grouped = this.groupByTimePeriod(requests, groupBy);

    // Create series for total and by status
    const totalSeries: ChartDataPoint[] = [];
    const statusSeries: { [key: string]: ChartDataPoint[] } = {};

    Object.entries(grouped).forEach(([period, items]) => {
      totalSeries.push({
        label: period,
        value: items.length,
      });

      // Group by status
      const statusCounts: { [key: string]: number } = {};
      items.forEach((item) => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });

      Object.entries(statusCounts).forEach(([status, count]) => {
        if (!statusSeries[status]) {
          statusSeries[status] = [];
        }
        statusSeries[status].push({
          label: period,
          value: count,
        });
      });
    });

    const series: ChartSeries[] = [
      {
        name: 'Total',
        data: totalSeries,
        color: '#3B82F6',
      },
    ];

    // Add status series
    Object.entries(statusSeries).forEach(([status, data]) => {
      series.push({
        name: this.formatStatusLabel(status as WorkRequestStatus),
        data,
        color: this.getStatusColor(status as WorkRequestStatus),
      });
    });

    return {
      config: {
        type: 'line',
        title: 'Request Volume Over Time',
        xAxis: {
          title: this.capitalizeFirst(groupBy),
          type: 'datetime',
        },
        yAxis: { title: 'Number of Requests' },
      },
      series,
    };
  }

  async getAssetTypePerformanceChart(
    organizationId: string,
    metric: 'count' | 'completion_rate' | 'avg_time'
  ): Promise<ChartData> {
    const assetTypes = await this.prisma.workRequest.groupBy({
      by: ['assetType'],
      where: { organizationId },
      _count: true,
    });

    const data: ChartDataPoint[] = [];

    for (const assetType of assetTypes) {
      let value: number;

      switch (metric) {
        case 'count':
          value = assetType._count;
          break;
        case 'completion_rate':
          const completed = await this.prisma.workRequest.count({
            where: {
              organizationId,
              assetType: assetType.assetType,
              status: WorkRequestStatus.COMPLETED,
            },
          });
          value = assetType._count > 0 ? (completed / assetType._count) * 100 : 0;
          break;
        case 'avg_time':
          const completedRequests = await this.prisma.workRequest.findMany({
            where: {
              organizationId,
              assetType: assetType.assetType,
              status: WorkRequestStatus.COMPLETED,
              completedDate: { not: null },
              submissionDate: { not: null },
            },
            select: {
              submissionDate: true,
              completedDate: true,
            },
          });

          if (completedRequests.length > 0) {
            const times = completedRequests.map((req) => {
              const start = new Date(req.submissionDate!).getTime();
              const end = new Date(req.completedDate!).getTime();
              return (end - start) / (1000 * 60 * 60 * 24); // Days
            });
            value = times.reduce((sum, t) => sum + t, 0) / times.length;
          } else {
            value = 0;
          }
          break;
        default:
          value = 0;
      }

      data.push({
        label: this.formatAssetTypeLabel(assetType.assetType as AssetType),
        value: Math.round(value * 100) / 100,
        metadata: { assetType: assetType.assetType },
      });
    }

    const titles: { [key: string]: string } = {
      count: 'Work Requests by Asset Type',
      completion_rate: 'Completion Rate by Asset Type (%)',
      avg_time: 'Average Completion Time by Asset Type (Days)',
    };

    return {
      config: {
        type: metric === 'completion_rate' ? 'gauge' : 'bar',
        title: titles[metric],
        xAxis: { title: 'Asset Type' },
        yAxis: {
          title:
            metric === 'completion_rate' ? 'Percentage' : metric === 'avg_time' ? 'Days' : 'Count',
          max: metric === 'completion_rate' ? 100 : undefined,
        },
      },
      series: [
        {
          name: this.capitalizeFirst(metric.replace('_', ' ')),
          data,
        },
      ],
    };
  }

  async getCostAnalysisChart(
    organizationId: string,
    groupBy: 'category' | 'asset_type' | 'department' | 'month'
  ): Promise<ChartData> {
    let groupByField: string;

    switch (groupBy) {
      case 'category':
        groupByField = 'category';
        break;
      case 'asset_type':
        groupByField = 'assetType';
        break;
      case 'department':
        groupByField = 'department';
        break;
      default:
        groupByField = 'category';
    }

    if (groupBy === 'month') {
      // Special handling for time-based grouping
      const requests = await this.prisma.workRequest.findMany({
        where: {
          organizationId,
          estimatedTotalCost: { not: null },
        },
        select: {
          createdAt: true,
          estimatedTotalCost: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const grouped = this.groupByTimePeriod(requests, 'month');
      const data: ChartDataPoint[] = [];

      Object.entries(grouped).forEach(([period, items]) => {
        const totalCost = items.reduce((sum, item) => sum + (item.estimatedTotalCost || 0), 0);
        data.push({
          label: period,
          value: Math.round(totalCost),
        });
      });

      return {
        config: {
          type: 'area',
          title: 'Cost Trend by Month',
          xAxis: { title: 'Month', type: 'datetime' },
          yAxis: { title: 'Total Cost ($)' },
        },
        series: [
          {
            name: 'Cost',
            data,
          },
        ],
      };
    } else {
      // Regular grouping
      const groups = await this.prisma.workRequest.groupBy({
        by: [groupByField],
        where: {
          organizationId,
          estimatedTotalCost: { not: null },
        },
        _sum: {
          estimatedTotalCost: true,
        },
      });

      const data: ChartDataPoint[] = groups
        .filter((group) => group._sum.estimatedTotalCost !== null)
        .map((group) => ({
          label: this.formatLabel(group[groupByField], groupBy),
          value: Math.round(group._sum.estimatedTotalCost || 0),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10

      return {
        config: {
          type: groupBy === 'department' ? 'treemap' : 'donut',
          title: `Cost Distribution by ${this.capitalizeFirst(groupBy.replace('_', ' '))}`,
          colors: this.getCostColors(),
        },
        series: [
          {
            name: 'Cost',
            data,
          },
        ],
      };
    }
  }

  async getSLAComplianceGauge(
    organizationId: string,
    period: { startDate: Date; endDate: Date }
  ): Promise<ChartData> {
    const total = await this.prisma.workRequest.count({
      where: {
        organizationId,
        createdAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
        deadline: { not: null },
      },
    });

    const onTime = await this.prisma.workRequest.count({
      where: {
        organizationId,
        createdAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
        deadline: { not: null },
        status: WorkRequestStatus.COMPLETED,
        // In practice, you'd compare completedDate <= deadline
      },
    });

    const complianceRate = total > 0 ? (onTime / total) * 100 : 100;

    return {
      config: {
        type: 'gauge',
        title: 'SLA Compliance Rate',
        colors: ['#EF4444', '#F59E0B', '#10B981'], // Red, Yellow, Green
      },
      series: [
        {
          name: 'Compliance',
          data: [
            {
              label: 'SLA Compliance',
              value: Math.round(complianceRate),
              metadata: {
                total,
                onTime,
                late: total - onTime,
              },
            },
          ],
        },
      ],
    };
  }

  // Helper methods
  private groupByTimePeriod(
    items: any[],
    period: 'day' | 'week' | 'month'
  ): { [key: string]: any[] } {
    const grouped: { [key: string]: any[] } = {};

    items.forEach((item) => {
      const date = new Date(item.createdAt);
      let key: string;

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = date.toISOString().substring(0, 7);
          break;
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    return grouped;
  }

  private formatStatusLabel(status: WorkRequestStatus): string {
    const labels: { [key: string]: string } = {
      [WorkRequestStatus.DRAFT]: 'Draft',
      [WorkRequestStatus.SUBMITTED]: 'Submitted',
      [WorkRequestStatus.UNDER_REVIEW]: 'Under Review',
      [WorkRequestStatus.APPROVED]: 'Approved',
      [WorkRequestStatus.REJECTED]: 'Rejected',
      [WorkRequestStatus.CANCELLED]: 'Cancelled',
      [WorkRequestStatus.IN_PROGRESS]: 'In Progress',
      [WorkRequestStatus.COMPLETED]: 'Completed',
    };
    return labels[status] || status;
  }

  private formatPriorityLabel(priority: Priority): string {
    const labels: { [key: string]: string } = {
      [Priority.CRITICAL]: 'Critical',
      [Priority.HIGH]: 'High',
      [Priority.MEDIUM]: 'Medium',
      [Priority.LOW]: 'Low',
    };
    return labels[priority] || priority;
  }

  private formatAssetTypeLabel(assetType: AssetType): string {
    const labels: { [key: string]: string } = {
      [AssetType.STAND]: 'Stand',
      [AssetType.AIRFIELD]: 'Airfield',
      [AssetType.BAGGAGE]: 'Baggage',
      [AssetType.TERMINAL]: 'Terminal',
      [AssetType.GATE]: 'Gate',
      [AssetType.RUNWAY]: 'Runway',
      [AssetType.TAXIWAY]: 'Taxiway',
    };
    return labels[assetType] || assetType;
  }

  private formatLabel(value: any, type: string): string {
    if (!value) return 'Unknown';

    switch (type) {
      case 'category':
      case 'department':
        return this.capitalizeFirst(value.toString().replace(/_/g, ' '));
      case 'asset_type':
        return this.formatAssetTypeLabel(value as AssetType);
      default:
        return value.toString();
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private getStatusColors(): string[] {
    return [
      '#6B7280', // Draft - Gray
      '#3B82F6', // Submitted - Blue
      '#F59E0B', // Under Review - Yellow
      '#10B981', // Approved - Green
      '#EF4444', // Rejected - Red
      '#6B7280', // Cancelled - Gray
      '#8B5CF6', // In Progress - Purple
      '#059669', // Completed - Dark Green
    ];
  }

  private getStatusColor(status: WorkRequestStatus): string {
    const colors: { [key: string]: string } = {
      [WorkRequestStatus.DRAFT]: '#6B7280',
      [WorkRequestStatus.SUBMITTED]: '#3B82F6',
      [WorkRequestStatus.UNDER_REVIEW]: '#F59E0B',
      [WorkRequestStatus.APPROVED]: '#10B981',
      [WorkRequestStatus.REJECTED]: '#EF4444',
      [WorkRequestStatus.CANCELLED]: '#6B7280',
      [WorkRequestStatus.IN_PROGRESS]: '#8B5CF6',
      [WorkRequestStatus.COMPLETED]: '#059669',
    };
    return colors[status] || '#6B7280';
  }

  private getPriorityColors(): string[] {
    return [
      '#EF4444', // Critical - Red
      '#F59E0B', // High - Orange
      '#3B82F6', // Medium - Blue
      '#10B981', // Low - Green
    ];
  }

  private getCostColors(): string[] {
    return [
      '#1E40AF', // Dark Blue
      '#2563EB', // Blue
      '#3B82F6', // Light Blue
      '#60A5FA', // Lighter Blue
      '#93BBFC', // Very Light Blue
      '#C3DDFD', // Pale Blue
      '#E0E7FF', // Very Pale Blue
      '#EDE9FE', // Indigo Tint
      '#DDD6FE', // Light Indigo
      '#C4B5FD', // Pale Indigo
    ];
  }
}
