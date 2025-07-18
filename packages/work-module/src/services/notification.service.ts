import { PrismaClient } from '@prisma/client';
import {
  WorkRequestStatus,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from '../index';

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  subject: string;
  body: string;
  variables: string[];
  channels: NotificationChannel[];
  isActive: boolean;
}

export interface NotificationRecipient {
  id: string;
  email: string;
  name: string;
  role: string;
  preferences: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  priorities: NotificationPriority[];
  workTypes: string[];
  quietHours?: {
    start: string;
    end: string;
  };
}

export interface NotificationContext {
  workRequestId: string;
  workRequestTitle: string;
  workRequestPriority: string;
  workRequestType: string;
  assetCode: string;
  requestorName: string;
  requestorEmail: string;
  organizationId: string;
  currentStatus: WorkRequestStatus;
  previousStatus?: WorkRequestStatus;
  approverName?: string;
  comments?: string;
  estimatedCost?: number;
  deadline?: Date;
  [key: string]: any;
}

export class NotificationService {
  private templates: Map<NotificationType, NotificationTemplate> = new Map();

  constructor(private prisma: PrismaClient) {
    this.initializeTemplates();
  }

  async sendStatusChangeNotification(
    workRequestId: string,
    fromStatus: WorkRequestStatus,
    toStatus: WorkRequestStatus,
    context: Partial<NotificationContext> = {}
  ): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
    try {
      // Get work request details
      const workRequest = await this.prisma.workRequest.findUnique({
        where: { id: workRequestId },
        include: {
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!workRequest) {
        return {
          success: false,
          sentCount: 0,
          failedCount: 1,
          errors: ['Work request not found'],
        };
      }

      // Build notification context
      const notificationContext: NotificationContext = {
        workRequestId: workRequest.id,
        workRequestTitle: workRequest.title,
        workRequestPriority: workRequest.priority,
        workRequestType: workRequest.workType,
        assetCode: workRequest.assetCode,
        requestorName: workRequest.requestorName,
        requestorEmail: workRequest.requestorEmail,
        organizationId: workRequest.organizationId,
        currentStatus: toStatus,
        previousStatus: fromStatus,
        estimatedCost: workRequest.estimatedTotalCost,
        deadline: workRequest.deadline,
        ...context,
      };

      // Determine notification type based on status change
      const notificationType = this.getNotificationTypeForStatusChange(fromStatus, toStatus);

      // Get recipients for this notification
      const recipients = await this.getRecipientsForNotification(
        notificationType,
        workRequest,
        notificationContext
      );

      // Send notifications
      const results = await this.sendNotifications(
        notificationType,
        recipients,
        notificationContext
      );

      return results;
    } catch (error) {
      console.error('Error sending status change notification:', error);
      return {
        success: false,
        sentCount: 0,
        failedCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async sendApprovalNotification(
    workRequestId: string,
    approverId: string,
    approverName: string,
    context: Partial<NotificationContext> = {}
  ): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
    try {
      const workRequest = await this.prisma.workRequest.findUnique({
        where: { id: workRequestId },
      });

      if (!workRequest) {
        return {
          success: false,
          sentCount: 0,
          failedCount: 1,
          errors: ['Work request not found'],
        };
      }

      const notificationContext: NotificationContext = {
        workRequestId: workRequest.id,
        workRequestTitle: workRequest.title,
        workRequestPriority: workRequest.priority,
        workRequestType: workRequest.workType,
        assetCode: workRequest.assetCode,
        requestorName: workRequest.requestorName,
        requestorEmail: workRequest.requestorEmail,
        organizationId: workRequest.organizationId,
        currentStatus: workRequest.status,
        approverName,
        estimatedCost: workRequest.estimatedTotalCost,
        deadline: workRequest.deadline,
        ...context,
      };

      // Get approver information
      const approver = await this.getApproverInfo(approverId);
      const recipients = [approver];

      // Send approval request notification
      const results = await this.sendNotifications(
        NotificationType.APPROVAL_REQUEST,
        recipients,
        notificationContext
      );

      return results;
    } catch (error) {
      console.error('Error sending approval notification:', error);
      return {
        success: false,
        sentCount: 0,
        failedCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async sendReminderNotification(
    workRequestId: string,
    reminderType: 'approval_timeout' | 'deadline_approaching' | 'overdue',
    context: Partial<NotificationContext> = {}
  ): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
    try {
      const workRequest = await this.prisma.workRequest.findUnique({
        where: { id: workRequestId },
        include: {
          approvals: {
            where: { status: 'pending' },
          },
        },
      });

      if (!workRequest) {
        return {
          success: false,
          sentCount: 0,
          failedCount: 1,
          errors: ['Work request not found'],
        };
      }

      const notificationContext: NotificationContext = {
        workRequestId: workRequest.id,
        workRequestTitle: workRequest.title,
        workRequestPriority: workRequest.priority,
        workRequestType: workRequest.workType,
        assetCode: workRequest.assetCode,
        requestorName: workRequest.requestorName,
        requestorEmail: workRequest.requestorEmail,
        organizationId: workRequest.organizationId,
        currentStatus: workRequest.status,
        estimatedCost: workRequest.estimatedTotalCost,
        deadline: workRequest.deadline,
        ...context,
      };

      let recipients: NotificationRecipient[] = [];
      let notificationType: NotificationType;

      switch (reminderType) {
        case 'approval_timeout':
          notificationType = NotificationType.APPROVAL_TIMEOUT;
          recipients = await this.getPendingApprovers(workRequest.approvals);
          break;
        case 'deadline_approaching':
          notificationType = NotificationType.DEADLINE_REMINDER;
          recipients = await this.getStakeholders(workRequest);
          break;
        case 'overdue':
          notificationType = NotificationType.OVERDUE_ALERT;
          recipients = await this.getManagers(workRequest.organizationId);
          break;
      }

      const results = await this.sendNotifications(
        notificationType,
        recipients,
        notificationContext
      );

      return results;
    } catch (error) {
      console.error('Error sending reminder notification:', error);
      return {
        success: false,
        sentCount: 0,
        failedCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async sendBulkNotification(
    notificationType: NotificationType,
    recipients: NotificationRecipient[],
    context: NotificationContext
  ): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
    return await this.sendNotifications(notificationType, recipients, context);
  }

  private async sendNotifications(
    notificationType: NotificationType,
    recipients: NotificationRecipient[],
    context: NotificationContext
  ): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
    const template = this.templates.get(notificationType);
    if (!template) {
      return {
        success: false,
        sentCount: 0,
        failedCount: recipients.length,
        errors: [`No template found for notification type: ${notificationType}`],
      };
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        // Check recipient preferences
        if (!this.shouldSendNotification(recipient, notificationType, context)) {
          continue;
        }

        // Render template with context
        const renderedSubject = this.renderTemplate(template.subject, context);
        const renderedBody = this.renderTemplate(template.body, context);

        // Send via preferred channels
        const channelResults = await this.sendViaChannels(
          recipient,
          template.channels,
          renderedSubject,
          renderedBody,
          context
        );

        if (channelResults.success) {
          sentCount++;
        } else {
          failedCount++;
          errors.push(`Failed to send to ${recipient.email}: ${channelResults.error}`);
        }

        // Store notification record
        await this.storeNotificationRecord(
          context.workRequestId,
          recipient.id,
          notificationType,
          renderedSubject,
          renderedBody,
          channelResults.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          channelResults.error
        );
      } catch (error) {
        failedCount++;
        errors.push(
          `Error sending to ${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      success: sentCount > 0,
      sentCount,
      failedCount,
      errors,
    };
  }

  private async sendViaChannels(
    recipient: NotificationRecipient,
    channels: NotificationChannel[],
    subject: string,
    body: string,
    context: NotificationContext
  ): Promise<{ success: boolean; error?: string }> {
    // Try channels in order of preference
    for (const channel of channels) {
      try {
        switch (channel) {
          case NotificationChannel.EMAIL:
            if (recipient.preferences.email) {
              await this.sendEmail(recipient.email, subject, body, context);
              return { success: true };
            }
            break;
          case NotificationChannel.SMS:
            if (recipient.preferences.sms) {
              await this.sendSMS(recipient.id, body, context);
              return { success: true };
            }
            break;
          case NotificationChannel.PUSH:
            if (recipient.preferences.push) {
              await this.sendPushNotification(recipient.id, subject, body, context);
              return { success: true };
            }
            break;
          case NotificationChannel.IN_APP:
            if (recipient.preferences.inApp) {
              await this.sendInAppNotification(recipient.id, subject, body, context);
              return { success: true };
            }
            break;
        }
      } catch (error) {
        console.error(`Error sending via ${channel}:`, error);
        continue;
      }
    }

    return { success: false, error: 'No available channels' };
  }

  private async sendEmail(
    email: string,
    subject: string,
    body: string,
    context: NotificationContext
  ): Promise<void> {
    // This would integrate with an email service (SendGrid, AWS SES, etc.)
    console.log(`Sending email to ${email}: ${subject}`);

    // Mock implementation
    if (process.env.NODE_ENV === 'development') {
      console.log('Email Body:', body);
    }
  }

  private async sendSMS(
    userId: string,
    message: string,
    context: NotificationContext
  ): Promise<void> {
    // This would integrate with an SMS service (Twilio, AWS SNS, etc.)
    console.log(`Sending SMS to user ${userId}: ${message}`);
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    context: NotificationContext
  ): Promise<void> {
    // This would integrate with a push notification service (Firebase, etc.)
    console.log(`Sending push notification to user ${userId}: ${title}`);
  }

  private async sendInAppNotification(
    userId: string,
    title: string,
    body: string,
    context: NotificationContext
  ): Promise<void> {
    // This would store the notification in the database for in-app display
    console.log(`Storing in-app notification for user ${userId}: ${title}`);
  }

  private shouldSendNotification(
    recipient: NotificationRecipient,
    notificationType: NotificationType,
    context: NotificationContext
  ): boolean {
    // Check if recipient wants this type of notification
    if (
      !recipient.preferences.priorities.includes(
        this.getNotificationPriority(notificationType, context)
      )
    ) {
      return false;
    }

    // Check if recipient wants notifications for this work type
    if (
      recipient.preferences.workTypes.length > 0 &&
      !recipient.preferences.workTypes.includes(context.workRequestType)
    ) {
      return false;
    }

    // Check quiet hours
    if (recipient.preferences.quietHours) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = this.parseTime(recipient.preferences.quietHours.start);
      const endTime = this.parseTime(recipient.preferences.quietHours.end);

      if (startTime <= endTime) {
        if (currentTime >= startTime && currentTime <= endTime) {
          return false;
        }
      } else {
        if (currentTime >= startTime || currentTime <= endTime) {
          return false;
        }
      }
    }

    return true;
  }

  private getNotificationTypeForStatusChange(
    fromStatus: WorkRequestStatus,
    toStatus: WorkRequestStatus
  ): NotificationType {
    switch (toStatus) {
      case WorkRequestStatus.SUBMITTED:
        return NotificationType.SUBMITTED;
      case WorkRequestStatus.APPROVED:
        return NotificationType.APPROVED;
      case WorkRequestStatus.REJECTED:
        return NotificationType.REJECTED;
      case WorkRequestStatus.IN_PROGRESS:
        return NotificationType.IN_PROGRESS;
      case WorkRequestStatus.COMPLETED:
        return NotificationType.COMPLETED;
      case WorkRequestStatus.CANCELLED:
        return NotificationType.CANCELLED;
      default:
        return NotificationType.STATUS_CHANGED;
    }
  }

  private getNotificationPriority(
    notificationType: NotificationType,
    context: NotificationContext
  ): NotificationPriority {
    // High priority for critical work or urgent notifications
    if (
      context.workRequestPriority === 'critical' ||
      [NotificationType.APPROVAL_TIMEOUT, NotificationType.OVERDUE_ALERT].includes(notificationType)
    ) {
      return NotificationPriority.HIGH;
    }

    // Normal priority for most notifications
    return NotificationPriority.NORMAL;
  }

  private renderTemplate(template: string, context: NotificationContext): string {
    let rendered = template;

    // Replace template variables
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });

    return rendered;
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  private async getRecipientsForNotification(
    notificationType: NotificationType,
    workRequest: any,
    context: NotificationContext
  ): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = [];

    // Always notify the requestor
    recipients.push({
      id: workRequest.requestedBy,
      email: workRequest.requestorEmail,
      name: workRequest.requestorName,
      role: 'Requestor',
      preferences: await this.getUserNotificationPreferences(workRequest.requestedBy),
    });

    // Add additional recipients based on notification type
    switch (notificationType) {
      case NotificationType.SUBMITTED:
        // Notify managers and supervisors
        const managers = await this.getManagers(workRequest.organizationId);
        recipients.push(...managers);
        break;
      case NotificationType.APPROVED:
      case NotificationType.REJECTED:
        // Notify stakeholders
        const stakeholders = await this.getStakeholders(workRequest);
        recipients.push(...stakeholders);
        break;
    }

    return recipients;
  }

  private async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    // This would fetch from user preferences table
    // For now, return default preferences
    return {
      email: true,
      sms: false,
      push: true,
      inApp: true,
      priorities: [NotificationPriority.HIGH, NotificationPriority.NORMAL],
      workTypes: [], // Empty means all work types
      quietHours: {
        start: '22:00',
        end: '06:00',
      },
    };
  }

  private async getApproverInfo(approverId: string): Promise<NotificationRecipient> {
    // This would fetch from user service
    return {
      id: approverId,
      email: `${approverId}@company.com`,
      name: `Approver ${approverId}`,
      role: 'Approver',
      preferences: await this.getUserNotificationPreferences(approverId),
    };
  }

  private async getPendingApprovers(approvals: any[]): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = [];

    for (const approval of approvals) {
      recipients.push(await this.getApproverInfo(approval.approverId));
    }

    return recipients;
  }

  private async getStakeholders(workRequest: any): Promise<NotificationRecipient[]> {
    // This would fetch stakeholders based on work request context
    return [];
  }

  private async getManagers(organizationId: string): Promise<NotificationRecipient[]> {
    // This would fetch managers for the organization
    return [];
  }

  private async storeNotificationRecord(
    workRequestId: string,
    recipientId: string,
    notificationType: NotificationType,
    subject: string,
    body: string,
    status: NotificationStatus,
    error?: string
  ): Promise<void> {
    await this.prisma.workRequestNotification.create({
      data: {
        workRequestId,
        recipientId,
        recipientEmail: `${recipientId}@company.com`, // TODO: Get actual email
        notificationType,
        subject,
        body,
        priority: NotificationPriority.NORMAL,
        status,
        errorMessage: error,
        channel: NotificationChannel.EMAIL,
        templateId: null,
        variables: {},
        retryCount: 0,
      },
    });
  }

  private initializeTemplates(): void {
    this.templates.set(NotificationType.SUBMITTED, {
      id: 'submitted',
      type: NotificationType.SUBMITTED,
      subject: 'Work Request Submitted: {{workRequestTitle}}',
      body: `
        Your work request has been submitted successfully.
        
        Request ID: {{workRequestId}}
        Title: {{workRequestTitle}}
        Asset: {{assetCode}}
        Priority: {{workRequestPriority}}
        Estimated Cost: ${{ estimatedCost }}
        
        You will receive updates as your request progresses through the approval process.
      `,
      variables: [
        'workRequestId',
        'workRequestTitle',
        'assetCode',
        'workRequestPriority',
        'estimatedCost',
      ],
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      isActive: true,
    });

    this.templates.set(NotificationType.APPROVED, {
      id: 'approved',
      type: NotificationType.APPROVED,
      subject: 'Work Request Approved: {{workRequestTitle}}',
      body: `
        Your work request has been approved.
        
        Request ID: {{workRequestId}}
        Title: {{workRequestTitle}}
        Asset: {{assetCode}}
        Approved by: {{approverName}}
        
        Work can now proceed as scheduled.
      `,
      variables: ['workRequestId', 'workRequestTitle', 'assetCode', 'approverName'],
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.IN_APP],
      isActive: true,
    });

    this.templates.set(NotificationType.REJECTED, {
      id: 'rejected',
      type: NotificationType.REJECTED,
      subject: 'Work Request Rejected: {{workRequestTitle}}',
      body: `
        Your work request has been rejected.
        
        Request ID: {{workRequestId}}
        Title: {{workRequestTitle}}
        Asset: {{assetCode}}
        Rejected by: {{approverName}}
        Comments: {{comments}}
        
        Please review the comments and resubmit if appropriate.
      `,
      variables: ['workRequestId', 'workRequestTitle', 'assetCode', 'approverName', 'comments'],
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.IN_APP],
      isActive: true,
    });

    this.templates.set(NotificationType.APPROVAL_REQUEST, {
      id: 'approval_request',
      type: NotificationType.APPROVAL_REQUEST,
      subject: 'Approval Required: {{workRequestTitle}}',
      body: `
        A work request requires your approval.
        
        Request ID: {{workRequestId}}
        Title: {{workRequestTitle}}
        Asset: {{assetCode}}
        Requestor: {{requestorName}}
        Priority: {{workRequestPriority}}
        Estimated Cost: ${{ estimatedCost }}
        
        Please review and approve or reject this request.
      `,
      variables: [
        'workRequestId',
        'workRequestTitle',
        'assetCode',
        'requestorName',
        'workRequestPriority',
        'estimatedCost',
      ],
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.IN_APP],
      isActive: true,
    });

    // Add more templates as needed...
  }
}
