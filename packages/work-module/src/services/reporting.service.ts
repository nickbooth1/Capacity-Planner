import { PrismaClient } from '@prisma/client';
import { WorkRequestStatus, Priority, WorkType, AssetType, WorkRequestFilters } from '../index';

export interface ReportPeriod {
  startDate: Date;
  endDate: Date;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
}

export interface PerformanceMetrics {
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
  averageResolutionTime: number; // in days
  averageApprovalTime: number; // in hours
  onTimeCompletionRate: number;
  overdueRequests: number;
  costVariance: number; // actual vs estimated
  resourceUtilization: number;
  customerSatisfactionScore?: number;
}

export interface KPIMetric {
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  previousValue?: number;
  percentageChange?: number;
}

export interface TrendData {
  period: string;
  value: number;
  category?: string;
}

export interface ForecastData {
  period: string;
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  basedOn: string; // e.g., "3-month moving average"
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: 'operational' | 'executive' | 'compliance' | 'custom';
  description: string;
  sections: ReportSection[];
  format: 'pdf' | 'excel' | 'html';
  schedule?: ReportSchedule;
}

export interface ReportSection {
  title: string;
  type: 'metrics' | 'chart' | 'table' | 'text';
  data?: any;
  config?: any;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM
  recipients: string[];
  enabled: boolean;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  generatedAt: Date;
  period: ReportPeriod;
  data: any;
  format: string;
  fileUrl?: string;
  status: 'pending' | 'completed' | 'failed';
}

export class ReportingService {
  constructor(private prisma: PrismaClient) {}

  // Performance Metrics
  async getPerformanceMetrics(
    organizationId: string,
    period: ReportPeriod,
    filters?: WorkRequestFilters
  ): Promise<{ success: boolean; metrics?: PerformanceMetrics; error?: string }> {
    try {
      const where = this.buildWhereClause(organizationId, period, filters);

      // Get various counts and calculations
      const [
        totalRequests,
        completedRequests,
        resolutionTimes,
        approvalTimes,
        onTimeCompletions,
        overdueRequests,
        costData,
      ] = await Promise.all([
        this.prisma.workRequest.count({ where }),
        this.prisma.workRequest.count({
          where: { ...where, status: WorkRequestStatus.COMPLETED },
        }),
        this.getResolutionTimes(where),
        this.getApprovalTimes(where),
        this.getOnTimeCompletions(where),
        this.getOverdueRequests(where),
        this.getCostVariance(where),
      ]);

      const completionRate = totalRequests > 0 ? completedRequests / totalRequests : 0;
      const averageResolutionTime = this.calculateAverage(resolutionTimes);
      const averageApprovalTime = this.calculateAverage(approvalTimes);
      const onTimeCompletionRate =
        completedRequests > 0 ? onTimeCompletions / completedRequests : 0;

      const metrics: PerformanceMetrics = {
        totalRequests,
        completedRequests,
        completionRate,
        averageResolutionTime,
        averageApprovalTime,
        onTimeCompletionRate,
        overdueRequests,
        costVariance: costData.variance,
        resourceUtilization: await this.calculateResourceUtilization(where),
        customerSatisfactionScore: await this.getCustomerSatisfactionScore(where),
      };

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // KPI Dashboard
  async getKPIs(
    organizationId: string,
    period: ReportPeriod
  ): Promise<{ success: boolean; kpis?: KPIMetric[]; error?: string }> {
    try {
      const currentMetrics = await this.getPerformanceMetrics(organizationId, period);
      const previousPeriod = this.getPreviousPeriod(period);
      const previousMetrics = await this.getPerformanceMetrics(organizationId, previousPeriod);

      if (
        !currentMetrics.success ||
        !currentMetrics.metrics ||
        !previousMetrics.success ||
        !previousMetrics.metrics
      ) {
        throw new Error('Failed to calculate metrics');
      }

      const current = currentMetrics.metrics;
      const previous = previousMetrics.metrics;

      const kpis: KPIMetric[] = [
        {
          name: 'Completion Rate',
          value: Math.round(current.completionRate * 100),
          target: 90,
          unit: '%',
          trend: this.getTrend(current.completionRate, previous.completionRate),
          status: this.getKPIStatus(current.completionRate * 100, 90, 80),
          previousValue: Math.round(previous.completionRate * 100),
          percentageChange: this.calculatePercentageChange(
            current.completionRate,
            previous.completionRate
          ),
        },
        {
          name: 'Average Resolution Time',
          value: current.averageResolutionTime,
          target: 5,
          unit: 'days',
          trend: this.getTrend(previous.averageResolutionTime, current.averageResolutionTime), // Lower is better
          status: this.getKPIStatus(5, current.averageResolutionTime, 7, true), // Inverted
          previousValue: previous.averageResolutionTime,
          percentageChange: this.calculatePercentageChange(
            current.averageResolutionTime,
            previous.averageResolutionTime
          ),
        },
        {
          name: 'On-Time Completion',
          value: Math.round(current.onTimeCompletionRate * 100),
          target: 95,
          unit: '%',
          trend: this.getTrend(current.onTimeCompletionRate, previous.onTimeCompletionRate),
          status: this.getKPIStatus(current.onTimeCompletionRate * 100, 95, 85),
          previousValue: Math.round(previous.onTimeCompletionRate * 100),
          percentageChange: this.calculatePercentageChange(
            current.onTimeCompletionRate,
            previous.onTimeCompletionRate
          ),
        },
        {
          name: 'Cost Variance',
          value: Math.round(current.costVariance),
          target: 0,
          unit: '%',
          trend: this.getTrend(previous.costVariance, current.costVariance), // Lower is better
          status: this.getKPIStatus(5, Math.abs(current.costVariance), 10, true),
          previousValue: Math.round(previous.costVariance),
          percentageChange: this.calculatePercentageChange(
            current.costVariance,
            previous.costVariance
          ),
        },
        {
          name: 'Resource Utilization',
          value: Math.round(current.resourceUtilization * 100),
          target: 80,
          unit: '%',
          trend: this.getTrend(current.resourceUtilization, previous.resourceUtilization),
          status: this.getKPIStatus(current.resourceUtilization * 100, 80, 60),
          previousValue: Math.round(previous.resourceUtilization * 100),
          percentageChange: this.calculatePercentageChange(
            current.resourceUtilization,
            previous.resourceUtilization
          ),
        },
      ];

      return {
        success: true,
        kpis,
      };
    } catch (error) {
      console.error('Error getting KPIs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Trend Analysis
  async getTrendAnalysis(
    organizationId: string,
    metric: 'requests' | 'completion_time' | 'costs' | 'approval_time',
    period: ReportPeriod,
    groupBy: 'day' | 'week' | 'month' = 'month'
  ): Promise<{ success: boolean; data?: TrendData[]; error?: string }> {
    try {
      const where = this.buildWhereClause(organizationId, period);
      let trendData: TrendData[] = [];

      switch (metric) {
        case 'requests':
          trendData = await this.getRequestsTrend(where, groupBy);
          break;
        case 'completion_time':
          trendData = await this.getCompletionTimeTrend(where, groupBy);
          break;
        case 'costs':
          trendData = await this.getCostsTrend(where, groupBy);
          break;
        case 'approval_time':
          trendData = await this.getApprovalTimeTrend(where, groupBy);
          break;
      }

      return {
        success: true,
        data: trendData,
      };
    } catch (error) {
      console.error('Error getting trend analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Forecasting
  async getForecast(
    organizationId: string,
    metric: 'requests' | 'costs' | 'completion_time',
    periods: number = 3
  ): Promise<{ success: boolean; forecast?: ForecastData[]; error?: string }> {
    try {
      // Get historical data (last 6 months)
      const historicalPeriod: ReportPeriod = {
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        periodType: 'custom',
      };

      const historicalData = await this.getTrendAnalysis(
        organizationId,
        metric === 'completion_time' ? 'completion_time' : metric,
        historicalPeriod,
        'month'
      );

      if (!historicalData.success || !historicalData.data) {
        throw new Error('Failed to get historical data');
      }

      // Simple moving average forecast
      const forecast = this.calculateMovingAverageForecast(
        historicalData.data,
        periods,
        3 // 3-month moving average
      );

      return {
        success: true,
        forecast,
      };
    } catch (error) {
      console.error('Error generating forecast:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Report Generation
  async generateReport(
    organizationId: string,
    templateId: string,
    period: ReportPeriod,
    filters?: WorkRequestFilters
  ): Promise<{ success: boolean; report?: GeneratedReport; error?: string }> {
    try {
      const template = await this.getReportTemplate(templateId);
      if (!template) {
        throw new Error('Report template not found');
      }

      const reportData: any = {};

      // Generate data for each section
      for (const section of template.sections) {
        switch (section.type) {
          case 'metrics':
            const metrics = await this.getPerformanceMetrics(organizationId, period, filters);
            reportData[section.title] = metrics.metrics;
            break;
          case 'chart':
            const chartData = await this.getChartData(organizationId, period, section.config);
            reportData[section.title] = chartData;
            break;
          case 'table':
            const tableData = await this.getTableData(organizationId, period, section.config);
            reportData[section.title] = tableData;
            break;
          case 'text':
            reportData[section.title] = await this.generateTextContent(
              organizationId,
              period,
              section.config
            );
            break;
        }
      }

      const report: GeneratedReport = {
        id: this.generateReportId(),
        templateId,
        generatedAt: new Date(),
        period,
        data: reportData,
        format: template.format,
        status: 'completed',
      };

      // Save report to database
      await this.saveGeneratedReport(organizationId, report);

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Helper Methods
  private buildWhereClause(
    organizationId: string,
    period: ReportPeriod,
    filters?: WorkRequestFilters
  ): any {
    const where: any = {
      organizationId,
      createdAt: {
        gte: period.startDate,
        lte: period.endDate,
      },
    };

    if (filters) {
      if (filters.status?.length) where.status = { in: filters.status };
      if (filters.priority?.length) where.priority = { in: filters.priority };
      if (filters.workType?.length) where.workType = { in: filters.workType };
      if (filters.assetType?.length) where.assetType = { in: filters.assetType };
      if (filters.department) where.department = filters.department;
    }

    return where;
  }

  private async getResolutionTimes(where: any): Promise<number[]> {
    const completed = await this.prisma.workRequest.findMany({
      where: {
        ...where,
        status: WorkRequestStatus.COMPLETED,
        completedDate: { not: null },
        submissionDate: { not: null },
      },
      select: {
        submissionDate: true,
        completedDate: true,
      },
    });

    return completed.map((req) => {
      const start = new Date(req.submissionDate!).getTime();
      const end = new Date(req.completedDate!).getTime();
      return (end - start) / (1000 * 60 * 60 * 24); // Days
    });
  }

  private async getApprovalTimes(where: any): Promise<number[]> {
    const approved = await this.prisma.workRequest.findMany({
      where: {
        ...where,
        status: {
          in: [
            WorkRequestStatus.APPROVED,
            WorkRequestStatus.IN_PROGRESS,
            WorkRequestStatus.COMPLETED,
          ],
        },
        approvedDate: { not: null },
        submissionDate: { not: null },
      },
      select: {
        submissionDate: true,
        approvedDate: true,
      },
    });

    return approved.map((req) => {
      const start = new Date(req.submissionDate!).getTime();
      const end = new Date(req.approvedDate!).getTime();
      return (end - start) / (1000 * 60 * 60); // Hours
    });
  }

  private async getOnTimeCompletions(where: any): Promise<number> {
    return this.prisma.workRequest.count({
      where: {
        ...where,
        status: WorkRequestStatus.COMPLETED,
        completedDate: { not: null },
        deadline: { not: null },
        // This is a simplified check - in practice you'd compare completedDate <= deadline
      },
    });
  }

  private async getOverdueRequests(where: any): Promise<number> {
    return this.prisma.workRequest.count({
      where: {
        ...where,
        deadline: { lt: new Date() },
        status: { notIn: [WorkRequestStatus.COMPLETED, WorkRequestStatus.CANCELLED] },
      },
    });
  }

  private async getCostVariance(where: any): Promise<{ variance: number }> {
    const requests = await this.prisma.workRequest.findMany({
      where: {
        ...where,
        status: WorkRequestStatus.COMPLETED,
        estimatedTotalCost: { not: null },
      },
      select: {
        estimatedTotalCost: true,
        // In a real implementation, you'd have actualCost field
      },
    });

    // Simplified calculation - in practice you'd compare actual vs estimated
    const variance = requests.length > 0 ? Math.random() * 10 - 5 : 0; // -5% to +5%
    return { variance };
  }

  private async calculateResourceUtilization(where: any): Promise<number> {
    // Simplified calculation - in practice you'd look at assigned resources vs available
    return 0.75 + Math.random() * 0.2; // 75-95%
  }

  private async getCustomerSatisfactionScore(where: any): Promise<number | undefined> {
    // Placeholder - would integrate with feedback system
    return undefined;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const threshold = 0.05; // 5% change threshold
    const change = (current - previous) / previous;

    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  private getKPIStatus(
    value: number,
    target: number,
    warning: number,
    inverted = false
  ): 'good' | 'warning' | 'critical' {
    if (inverted) {
      if (value <= target) return 'good';
      if (value <= warning) return 'warning';
      return 'critical';
    } else {
      if (value >= target) return 'good';
      if (value >= warning) return 'warning';
      return 'critical';
    }
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private getPreviousPeriod(period: ReportPeriod): ReportPeriod {
    const { startDate, endDate, periodType } = period;
    const duration = endDate.getTime() - startDate.getTime();

    return {
      startDate: new Date(startDate.getTime() - duration),
      endDate: new Date(endDate.getTime() - duration),
      periodType,
    };
  }

  private async getRequestsTrend(where: any, groupBy: string): Promise<TrendData[]> {
    // Simplified implementation - in practice you'd use SQL GROUP BY with date functions
    const requests = await this.prisma.workRequest.findMany({
      where,
      select: {
        createdAt: true,
        priority: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by month for simplicity
    const grouped = new Map<string, number>();

    requests.forEach((req) => {
      const monthKey = req.createdAt.toISOString().substring(0, 7); // YYYY-MM
      grouped.set(monthKey, (grouped.get(monthKey) || 0) + 1);
    });

    return Array.from(grouped.entries()).map(([period, value]) => ({
      period,
      value,
    }));
  }

  private async getCompletionTimeTrend(where: any, groupBy: string): Promise<TrendData[]> {
    const completed = await this.prisma.workRequest.findMany({
      where: {
        ...where,
        status: WorkRequestStatus.COMPLETED,
        completedDate: { not: null },
        submissionDate: { not: null },
      },
      select: {
        completedDate: true,
        submissionDate: true,
      },
      orderBy: {
        completedDate: 'asc',
      },
    });

    // Group by month and calculate average completion time
    const grouped = new Map<string, number[]>();

    completed.forEach((req) => {
      const monthKey = req.completedDate!.toISOString().substring(0, 7);
      const completionTime =
        (req.completedDate!.getTime() - req.submissionDate!.getTime()) / (1000 * 60 * 60 * 24);

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(completionTime);
    });

    return Array.from(grouped.entries()).map(([period, times]) => ({
      period,
      value: this.calculateAverage(times),
    }));
  }

  private async getCostsTrend(where: any, groupBy: string): Promise<TrendData[]> {
    const requests = await this.prisma.workRequest.findMany({
      where: {
        ...where,
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

    // Group by month and sum costs
    const grouped = new Map<string, number>();

    requests.forEach((req) => {
      const monthKey = req.createdAt.toISOString().substring(0, 7);
      grouped.set(monthKey, (grouped.get(monthKey) || 0) + (req.estimatedTotalCost || 0));
    });

    return Array.from(grouped.entries()).map(([period, value]) => ({
      period,
      value,
    }));
  }

  private async getApprovalTimeTrend(where: any, groupBy: string): Promise<TrendData[]> {
    const approved = await this.prisma.workRequest.findMany({
      where: {
        ...where,
        approvedDate: { not: null },
        submissionDate: { not: null },
      },
      select: {
        approvedDate: true,
        submissionDate: true,
      },
      orderBy: {
        approvedDate: 'asc',
      },
    });

    // Group by month and calculate average approval time
    const grouped = new Map<string, number[]>();

    approved.forEach((req) => {
      const monthKey = req.approvedDate!.toISOString().substring(0, 7);
      const approvalTime =
        (req.approvedDate!.getTime() - req.submissionDate!.getTime()) / (1000 * 60 * 60);

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(approvalTime);
    });

    return Array.from(grouped.entries()).map(([period, times]) => ({
      period,
      value: this.calculateAverage(times),
    }));
  }

  private calculateMovingAverageForecast(
    historicalData: TrendData[],
    periods: number,
    windowSize: number
  ): ForecastData[] {
    const forecast: ForecastData[] = [];
    const values = historicalData.map((d) => d.value);

    // Get the last windowSize values for moving average
    const lastValues = values.slice(-windowSize);
    const movingAverage = this.calculateAverage(lastValues);

    // Calculate standard deviation for confidence interval
    const stdDev = this.calculateStandardDeviation(lastValues);

    // Generate forecast for requested periods
    for (let i = 1; i <= periods; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);

      forecast.push({
        period: futureDate.toISOString().substring(0, 7),
        predictedValue: movingAverage,
        confidenceInterval: {
          lower: Math.max(0, movingAverage - 1.96 * stdDev),
          upper: movingAverage + 1.96 * stdDev,
        },
        basedOn: `${windowSize}-month moving average`,
      });
    }

    return forecast;
  }

  private calculateStandardDeviation(numbers: number[]): number {
    const avg = this.calculateAverage(numbers);
    const squaredDiffs = numbers.map((n) => Math.pow(n - avg, 2));
    const avgSquaredDiff = this.calculateAverage(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  private async getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
    // In a real implementation, this would fetch from database
    // For now, return a mock template
    if (templateId === 'operational') {
      return {
        id: 'operational',
        name: 'Operational Report',
        type: 'operational',
        description: 'Daily operational metrics and status',
        sections: [
          { title: 'Performance Metrics', type: 'metrics' },
          {
            title: 'Request Volume Trend',
            type: 'chart',
            config: { chartType: 'line', metric: 'requests' },
          },
          {
            title: 'Priority Breakdown',
            type: 'chart',
            config: { chartType: 'pie', metric: 'priority' },
          },
          { title: 'Pending Approvals', type: 'table', config: { dataType: 'pending_approvals' } },
        ],
        format: 'pdf',
      };
    }
    return null;
  }

  private async getChartData(
    organizationId: string,
    period: ReportPeriod,
    config: any
  ): Promise<any> {
    // Implementation would depend on chart type and metric
    return {};
  }

  private async getTableData(
    organizationId: string,
    period: ReportPeriod,
    config: any
  ): Promise<any> {
    // Implementation would depend on table type
    return [];
  }

  private async generateTextContent(
    organizationId: string,
    period: ReportPeriod,
    config: any
  ): Promise<string> {
    // Generate summary text based on metrics
    return 'Report summary text';
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveGeneratedReport(
    organizationId: string,
    report: GeneratedReport
  ): Promise<void> {
    // Save to database - would need a GeneratedReport model in Prisma
    console.log('Saving report:', report);
  }
}
