import { PrismaClient } from '@prisma/client';
import { ReportingService, ReportPeriod, GeneratedReport } from './reporting.service';
import { ReportTemplateService } from './report-template.service';
import { NotificationService } from './notification.service';

export interface ScheduledReport {
  id: string;
  organizationId: string;
  templateId: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  schedule: {
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    dayOfQuarter?: number; // 1-90 for quarterly
    time: string; // HH:MM format
    timezone: string;
  };
  recipients: ReportRecipient[];
  filters?: any; // WorkRequestFilters
  format: 'pdf' | 'excel' | 'html';
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportRecipient {
  email: string;
  name: string;
  type: 'to' | 'cc' | 'bcc';
}

export interface ReportExecution {
  id: string;
  scheduledReportId: string;
  executedAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  reportId?: string;
  emailsSent: number;
  duration?: number; // in ms
}

export class ScheduledReportService {
  private reportingService: ReportingService;
  private templateService: ReportTemplateService;
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.reportingService = new ReportingService(prisma);
    this.templateService = new ReportTemplateService(prisma);
    this.notificationService = new NotificationService(prisma);
  }

  async createScheduledReport(
    organizationId: string,
    userId: string,
    data: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'>
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      // Validate template exists
      const template = await this.templateService.getTemplate(data.templateId);
      if (!template) {
        throw new Error('Report template not found');
      }

      // Calculate next run time
      const nextRunAt = this.calculateNextRunTime(data.frequency, data.schedule);

      const scheduledReport: ScheduledReport = {
        id: this.generateScheduledReportId(),
        organizationId,
        ...data,
        nextRunAt,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // In a real implementation, save to database
      await this.saveScheduledReport(scheduledReport);

      return {
        success: true,
        reportId: scheduledReport.id,
      };
    } catch (error) {
      console.error('Error creating scheduled report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async executeScheduledReport(
    scheduledReportId: string
  ): Promise<{ success: boolean; execution?: ReportExecution; error?: string }> {
    const startTime = Date.now();
    const execution: ReportExecution = {
      id: this.generateExecutionId(),
      scheduledReportId,
      executedAt: new Date(),
      status: 'running',
      emailsSent: 0,
    };

    try {
      // Get scheduled report details
      const scheduledReport = await this.getScheduledReport(scheduledReportId);
      if (!scheduledReport) {
        throw new Error('Scheduled report not found');
      }

      // Calculate report period based on frequency
      const period = this.calculateReportPeriod(scheduledReport.frequency);

      // Generate the report
      const generatedReport = await this.reportingService.generateReport(
        scheduledReport.organizationId,
        scheduledReport.templateId,
        period,
        scheduledReport.filters
      );

      if (!generatedReport.success || !generatedReport.report) {
        throw new Error(generatedReport.error || 'Failed to generate report');
      }

      // Send report to recipients
      const emailResult = await this.sendReportEmails(scheduledReport, generatedReport.report);

      // Update execution status
      execution.status = 'completed';
      execution.reportId = generatedReport.report.id;
      execution.emailsSent = emailResult.sentCount;
      execution.duration = Date.now() - startTime;

      // Update last run time and calculate next run
      await this.updateScheduledReportAfterRun(scheduledReportId);

      return {
        success: true,
        execution,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.duration = Date.now() - startTime;

      console.error('Error executing scheduled report:', error);
      return {
        success: false,
        execution,
        error: execution.error,
      };
    }
  }

  async getScheduledReports(
    organizationId: string,
    filters?: {
      enabled?: boolean;
      frequency?: string;
      templateId?: string;
    }
  ): Promise<{ success: boolean; reports?: ScheduledReport[]; error?: string }> {
    try {
      // In a real implementation, fetch from database
      const reports: ScheduledReport[] = [];

      return {
        success: true,
        reports,
      };
    } catch (error) {
      console.error('Error getting scheduled reports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateScheduledReport(
    reportId: string,
    updates: Partial<ScheduledReport>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // If schedule changed, recalculate next run time
      if (updates.frequency || updates.schedule) {
        const report = await this.getScheduledReport(reportId);
        if (report) {
          updates.nextRunAt = this.calculateNextRunTime(
            updates.frequency || report.frequency,
            updates.schedule || report.schedule
          );
        }
      }

      // Update in database
      await this.updateScheduledReportInDB(reportId, updates);

      return { success: true };
    } catch (error) {
      console.error('Error updating scheduled report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteScheduledReport(reportId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from database
      await this.deleteScheduledReportFromDB(reportId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting scheduled report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getReportExecutions(
    scheduledReportId: string,
    limit: number = 10
  ): Promise<{ success: boolean; executions?: ReportExecution[]; error?: string }> {
    try {
      // In a real implementation, fetch from database
      const executions: ReportExecution[] = [];

      return {
        success: true,
        executions,
      };
    } catch (error) {
      console.error('Error getting report executions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async runScheduledReportsForTime(
    currentTime: Date
  ): Promise<{ success: boolean; executed: number; failed: number }> {
    try {
      // Find all reports due to run
      const dueReports = await this.getDueReports(currentTime);

      let executed = 0;
      let failed = 0;

      // Execute each due report
      for (const report of dueReports) {
        const result = await this.executeScheduledReport(report.id);
        if (result.success) {
          executed++;
        } else {
          failed++;
        }
      }

      return {
        success: true,
        executed,
        failed,
      };
    } catch (error) {
      console.error('Error running scheduled reports:', error);
      return {
        success: false,
        executed: 0,
        failed: 0,
      };
    }
  }

  private calculateNextRunTime(frequency: string, schedule: ScheduledReport['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;

      case 'weekly':
        const targetDay = schedule.dayOfWeek || 1; // Default Monday
        nextRun.setDate(nextRun.getDate() + ((targetDay - nextRun.getDay() + 7) % 7));
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        break;

      case 'monthly':
        const targetDate = schedule.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;

      case 'quarterly':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const targetQuarterDay = schedule.dayOfQuarter || 1;
        nextRun.setMonth(currentQuarter * 3);
        nextRun.setDate(targetQuarterDay);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 3);
        }
        break;
    }

    return nextRun;
  }

  private calculateReportPeriod(frequency: string): ReportPeriod {
    const endDate = new Date();
    const startDate = new Date();

    switch (frequency) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
    }

    return {
      startDate,
      endDate,
      periodType: frequency as any,
    };
  }

  private async sendReportEmails(
    scheduledReport: ScheduledReport,
    generatedReport: GeneratedReport
  ): Promise<{ success: boolean; sentCount: number }> {
    let sentCount = 0;

    for (const recipient of scheduledReport.recipients) {
      try {
        await this.notificationService.sendNotification(scheduledReport.organizationId, {
          type: 'report',
          priority: 'normal',
          recipient: {
            id: recipient.email,
            email: recipient.email,
            name: recipient.name,
          },
          subject: `${scheduledReport.name} - ${new Date().toLocaleDateString()}`,
          template: 'report-email',
          data: {
            reportName: scheduledReport.name,
            reportDescription: scheduledReport.description,
            reportUrl: this.getReportUrl(generatedReport.id),
            generatedAt: generatedReport.generatedAt,
          },
          attachments:
            scheduledReport.format !== 'html'
              ? [
                  {
                    filename: `${scheduledReport.name.replace(/\s+/g, '_')}_${generatedReport.generatedAt.toISOString().split('T')[0]}.${scheduledReport.format}`,
                    content: generatedReport.data,
                    contentType: this.getContentType(scheduledReport.format),
                  },
                ]
              : undefined,
        });
        sentCount++;
      } catch (error) {
        console.error(`Failed to send report to ${recipient.email}:`, error);
      }
    }

    return {
      success: sentCount > 0,
      sentCount,
    };
  }

  private getReportUrl(reportId: string): string {
    // In a real implementation, this would generate a secure URL
    return `${process.env.APP_URL}/reports/${reportId}`;
  }

  private getContentType(format: string): string {
    switch (format) {
      case 'pdf':
        return 'application/pdf';
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'html':
        return 'text/html';
      default:
        return 'application/octet-stream';
    }
  }

  private generateScheduledReportId(): string {
    return `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Database operations (placeholders)
  private async saveScheduledReport(report: ScheduledReport): Promise<void> {
    // Save to database
    console.log('Saving scheduled report:', report);
  }

  private async getScheduledReport(id: string): Promise<ScheduledReport | null> {
    // Fetch from database
    return null;
  }

  private async updateScheduledReportInDB(
    id: string,
    updates: Partial<ScheduledReport>
  ): Promise<void> {
    // Update in database
    console.log('Updating scheduled report:', id, updates);
  }

  private async deleteScheduledReportFromDB(id: string): Promise<void> {
    // Delete from database
    console.log('Deleting scheduled report:', id);
  }

  private async updateScheduledReportAfterRun(id: string): Promise<void> {
    const report = await this.getScheduledReport(id);
    if (report) {
      const nextRunAt = this.calculateNextRunTime(report.frequency, report.schedule);
      await this.updateScheduledReportInDB(id, {
        lastRunAt: new Date(),
        nextRunAt,
      });
    }
  }

  private async getDueReports(currentTime: Date): Promise<ScheduledReport[]> {
    // In a real implementation, query database for reports where nextRunAt <= currentTime
    return [];
  }
}
