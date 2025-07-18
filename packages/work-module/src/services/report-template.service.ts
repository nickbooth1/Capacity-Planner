import { PrismaClient } from '@prisma/client';
import { ReportTemplate, ReportSection } from './reporting.service';

export interface ReportTemplateDefinition {
  id: string;
  name: string;
  type: 'operational' | 'executive' | 'compliance' | 'custom';
  description: string;
  sections: ReportSection[];
  format: 'pdf' | 'excel' | 'html';
  defaultSchedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
  };
}

export class ReportTemplateService {
  private templates: Map<string, ReportTemplateDefinition>;

  constructor(private prisma: PrismaClient) {
    this.templates = new Map();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Operational Report Template
    this.templates.set('operational-daily', {
      id: 'operational-daily',
      name: 'Daily Operational Report',
      type: 'operational',
      description:
        'Daily summary of work request operations including pending items, completions, and resource utilization',
      sections: [
        {
          title: 'Executive Summary',
          type: 'text',
          config: {
            template: 'daily-summary',
          },
        },
        {
          title: 'Key Performance Indicators',
          type: 'metrics',
          config: {
            metrics: [
              'completion_rate',
              'avg_resolution_time',
              'pending_approvals',
              'overdue_requests',
            ],
          },
        },
        {
          title: 'Request Volume - Last 7 Days',
          type: 'chart',
          config: {
            chartType: 'line',
            metric: 'requests',
            groupBy: 'day',
            period: 7,
          },
        },
        {
          title: 'Status Distribution',
          type: 'chart',
          config: {
            chartType: 'pie',
            metric: 'status_distribution',
          },
        },
        {
          title: 'Priority Breakdown',
          type: 'chart',
          config: {
            chartType: 'bar',
            metric: 'priority_distribution',
          },
        },
        {
          title: 'Pending Approvals',
          type: 'table',
          config: {
            dataType: 'pending_approvals',
            columns: ['id', 'title', 'priority', 'requestor', 'waiting_time'],
            limit: 20,
          },
        },
        {
          title: 'Overdue Work Requests',
          type: 'table',
          config: {
            dataType: 'overdue_requests',
            columns: ['id', 'title', 'priority', 'deadline', 'days_overdue'],
            limit: 15,
          },
        },
      ],
      format: 'pdf',
      defaultSchedule: {
        frequency: 'daily',
        time: '06:00',
      },
    });

    // Executive Report Template
    this.templates.set('executive-weekly', {
      id: 'executive-weekly',
      name: 'Weekly Executive Report',
      type: 'executive',
      description:
        'High-level summary for executives with trends, forecasts, and strategic metrics',
      sections: [
        {
          title: 'Executive Overview',
          type: 'text',
          config: {
            template: 'executive-summary',
          },
        },
        {
          title: 'Strategic KPIs',
          type: 'metrics',
          config: {
            metrics: [
              'completion_rate',
              'cost_variance',
              'resource_utilization',
              'customer_satisfaction',
            ],
            showTrend: true,
            showTarget: true,
          },
        },
        {
          title: 'Request Volume Trend - 12 Weeks',
          type: 'chart',
          config: {
            chartType: 'area',
            metric: 'requests',
            groupBy: 'week',
            period: 84, // 12 weeks
            showForecast: true,
          },
        },
        {
          title: 'Cost Analysis',
          type: 'chart',
          config: {
            chartType: 'combo',
            metrics: ['estimated_costs', 'actual_costs'],
            groupBy: 'week',
            period: 84,
          },
        },
        {
          title: 'Performance by Asset Type',
          type: 'chart',
          config: {
            chartType: 'grouped-bar',
            metric: 'completion_rate',
            groupBy: 'asset_type',
            period: 7,
          },
        },
        {
          title: 'Department Performance',
          type: 'table',
          config: {
            dataType: 'department_performance',
            columns: ['department', 'total_requests', 'completed', 'completion_rate', 'avg_time'],
            sortBy: 'completion_rate',
            sortOrder: 'desc',
          },
        },
        {
          title: 'Forecast - Next 4 Weeks',
          type: 'chart',
          config: {
            chartType: 'line',
            metric: 'forecast',
            forecastPeriods: 4,
            showConfidenceInterval: true,
          },
        },
      ],
      format: 'pdf',
      defaultSchedule: {
        frequency: 'weekly',
        dayOfWeek: 1, // Monday
        time: '08:00',
      },
    });

    // Compliance Report Template
    this.templates.set('compliance-monthly', {
      id: 'compliance-monthly',
      name: 'Monthly Compliance Report',
      type: 'compliance',
      description:
        'Detailed compliance metrics including audit trails, regulatory requirements, and process adherence',
      sections: [
        {
          title: 'Compliance Summary',
          type: 'text',
          config: {
            template: 'compliance-summary',
          },
        },
        {
          title: 'Regulatory Compliance Metrics',
          type: 'metrics',
          config: {
            metrics: [
              'regulatory_compliance_rate',
              'audit_findings',
              'corrective_actions',
              'sla_compliance',
            ],
          },
        },
        {
          title: 'SLA Performance',
          type: 'chart',
          config: {
            chartType: 'gauge',
            metric: 'sla_compliance',
            targets: {
              green: 95,
              yellow: 85,
              red: 0,
            },
          },
        },
        {
          title: 'Approval Process Compliance',
          type: 'chart',
          config: {
            chartType: 'stacked-bar',
            metrics: ['approved_on_time', 'approved_late', 'pending_approval'],
            groupBy: 'month',
            period: 180,
          },
        },
        {
          title: 'Audit Trail Summary',
          type: 'table',
          config: {
            dataType: 'audit_summary',
            columns: ['action_type', 'count', 'success_rate', 'failure_reasons'],
            period: 30,
          },
        },
        {
          title: 'Security Events',
          type: 'table',
          config: {
            dataType: 'security_events',
            columns: ['timestamp', 'event_type', 'actor', 'result', 'ip_address'],
            limit: 100,
          },
        },
        {
          title: 'Data Retention Compliance',
          type: 'metrics',
          config: {
            metrics: ['records_retained', 'records_purged', 'retention_compliance_rate'],
          },
        },
        {
          title: 'Process Violations',
          type: 'table',
          config: {
            dataType: 'process_violations',
            columns: ['date', 'violation_type', 'severity', 'corrective_action', 'status'],
            period: 30,
          },
        },
      ],
      format: 'excel',
      defaultSchedule: {
        frequency: 'monthly',
        dayOfMonth: 1,
        time: '09:00',
      },
    });

    // Asset Performance Report
    this.templates.set('asset-performance', {
      id: 'asset-performance',
      name: 'Asset Performance Report',
      type: 'custom',
      description: 'Detailed analysis of work requests by asset type and individual assets',
      sections: [
        {
          title: 'Asset Overview',
          type: 'text',
          config: {
            template: 'asset-summary',
          },
        },
        {
          title: 'Asset Utilization',
          type: 'chart',
          config: {
            chartType: 'heatmap',
            metric: 'asset_utilization',
            groupBy: 'asset_type',
          },
        },
        {
          title: 'Maintenance Frequency by Asset',
          type: 'chart',
          config: {
            chartType: 'bar',
            metric: 'maintenance_frequency',
            groupBy: 'asset_code',
            limit: 20,
          },
        },
        {
          title: 'Asset Downtime Analysis',
          type: 'table',
          config: {
            dataType: 'asset_downtime',
            columns: ['asset_code', 'asset_name', 'total_downtime', 'incidents', 'mtbf', 'mttr'],
          },
        },
        {
          title: 'Cost by Asset Type',
          type: 'chart',
          config: {
            chartType: 'treemap',
            metric: 'costs_by_asset_type',
          },
        },
      ],
      format: 'excel',
    });

    // Cost Analysis Report
    this.templates.set('cost-analysis', {
      id: 'cost-analysis',
      name: 'Cost Analysis Report',
      type: 'custom',
      description:
        'Comprehensive cost analysis including budget variance, cost trends, and forecasting',
      sections: [
        {
          title: 'Cost Summary',
          type: 'text',
          config: {
            template: 'cost-summary',
          },
        },
        {
          title: 'Budget vs Actual',
          type: 'chart',
          config: {
            chartType: 'waterfall',
            metrics: ['budget', 'actual', 'variance'],
          },
        },
        {
          title: 'Cost Trend Analysis',
          type: 'chart',
          config: {
            chartType: 'line',
            metric: 'costs',
            groupBy: 'month',
            period: 365,
            showTrendLine: true,
          },
        },
        {
          title: 'Cost by Category',
          type: 'chart',
          config: {
            chartType: 'donut',
            metric: 'cost_by_category',
          },
        },
        {
          title: 'Top Cost Drivers',
          type: 'table',
          config: {
            dataType: 'cost_drivers',
            columns: ['category', 'total_cost', 'percentage', 'year_over_year_change'],
            limit: 15,
          },
        },
        {
          title: 'Cost Forecast',
          type: 'chart',
          config: {
            chartType: 'area',
            metric: 'cost_forecast',
            forecastPeriods: 6,
            showConfidenceInterval: true,
          },
        },
      ],
      format: 'excel',
    });
  }

  async getTemplate(templateId: string): Promise<ReportTemplate | null> {
    const template = this.templates.get(templateId);
    if (!template) return null;

    // Convert to ReportTemplate format
    return {
      ...template,
      schedule: template.defaultSchedule
        ? {
            ...template.defaultSchedule,
            recipients: [],
            enabled: false,
          }
        : undefined,
    };
  }

  async getAllTemplates(): Promise<ReportTemplateDefinition[]> {
    return Array.from(this.templates.values());
  }

  async getTemplatesByType(type: string): Promise<ReportTemplateDefinition[]> {
    return Array.from(this.templates.values()).filter((t) => t.type === type);
  }

  async createCustomTemplate(
    organizationId: string,
    template: Omit<ReportTemplateDefinition, 'id'>
  ): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const templateId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTemplate: ReportTemplateDefinition = {
        ...template,
        id: templateId,
      };

      // In a real implementation, save to database
      this.templates.set(templateId, newTemplate);

      return {
        success: true,
        templateId,
      };
    } catch (error) {
      console.error('Error creating custom template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<ReportTemplateDefinition>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = this.templates.get(templateId);
      if (!existing) {
        throw new Error('Template not found');
      }

      const updated = {
        ...existing,
        ...updates,
        id: templateId, // Ensure ID doesn't change
      };

      this.templates.set(templateId, updated);

      return { success: true };
    } catch (error) {
      console.error('Error updating template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Don't allow deletion of default templates
      const defaultTemplates = ['operational-daily', 'executive-weekly', 'compliance-monthly'];
      if (defaultTemplates.includes(templateId)) {
        throw new Error('Cannot delete default templates');
      }

      this.templates.delete(templateId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
