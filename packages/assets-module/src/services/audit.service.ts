import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

export interface AuditContext {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditEventData {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource: string;
  resourceId: string;
  action: string;
  details?: any;
  metadata?: any;
  success?: boolean;
  errorMessage?: string;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log an audit event
   */
  async logEvent(context: AuditContext, event: AuditEventData): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          eventType: event.eventType,
          severity: event.severity,
          resource: event.resource,
          resourceId: event.resourceId,
          action: event.action,
          details: event.details || {},
          metadata: {
            ...event.metadata,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            sessionId: context.sessionId,
          },
          success: event.success ?? true,
          errorMessage: event.errorMessage,
        },
      });
    } catch (error) {
      // Log to console if database write fails
      console.error('Failed to write audit event:', error);
      console.error('Audit event data:', { context, event });
    }
  }

  /**
   * Log a stand creation event
   */
  async logStandCreated(context: AuditContext, standId: string, standData: any): Promise<void> {
    await this.logEvent(context, {
      eventType: 'stand.created',
      severity: 'low',
      resource: 'stand',
      resourceId: standId,
      action: 'create',
      details: {
        code: standData.code,
        name: standData.name,
        terminal: standData.terminal,
        status: standData.status,
      },
    });
  }

  /**
   * Log a stand update event
   */
  async logStandUpdated(
    context: AuditContext,
    standId: string,
    changes: any,
    previousData?: any
  ): Promise<void> {
    const changedFields = Object.keys(changes);
    const severity = this.calculateUpdateSeverity(changedFields);

    await this.logEvent(context, {
      eventType: 'stand.updated',
      severity,
      resource: 'stand',
      resourceId: standId,
      action: 'update',
      details: {
        changedFields,
        changes: this.sanitizeChanges(changes),
        previousValues: previousData ? this.sanitizeChanges(previousData) : undefined,
      },
    });
  }

  /**
   * Log a stand deletion event
   */
  async logStandDeleted(
    context: AuditContext,
    standId: string,
    standCode: string,
    reason?: string
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: 'stand.deleted',
      severity: 'high',
      resource: 'stand',
      resourceId: standId,
      action: 'delete',
      details: {
        code: standCode,
        reason,
        deletionType: 'soft',
      },
    });
  }

  /**
   * Log a bulk import event
   */
  async logBulkImport(
    context: AuditContext,
    importJobId: string,
    results: {
      totalRows: number;
      successRows: number;
      errorRows: number;
      errors?: any[];
    }
  ): Promise<void> {
    const severity = results.errorRows > 0 ? 'medium' : 'low';

    await this.logEvent(context, {
      eventType: 'stand.bulk_import',
      severity,
      resource: 'standImportJob',
      resourceId: importJobId,
      action: 'import',
      details: {
        totalRows: results.totalRows,
        successRows: results.successRows,
        errorRows: results.errorRows,
        successRate: ((results.successRows / results.totalRows) * 100).toFixed(2) + '%',
        errors: results.errors?.slice(0, 10), // Limit error details
      },
    });
  }

  /**
   * Log an access denied event
   */
  async logAccessDenied(
    context: AuditContext,
    resource: string,
    action: string,
    reason: string
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: 'access.denied',
      severity: 'medium',
      resource,
      resourceId: 'N/A',
      action,
      details: {
        reason,
        attemptedAt: new Date().toISOString(),
      },
      success: false,
      errorMessage: reason,
    });
  }

  /**
   * Log a data export event
   */
  async logDataExport(
    context: AuditContext,
    resource: string,
    format: string,
    recordCount: number,
    filters?: any
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: 'data.exported',
      severity: 'medium',
      resource,
      resourceId: 'bulk',
      action: 'export',
      details: {
        format,
        recordCount,
        filters: this.sanitizeFilters(filters),
        exportId: this.generateExportId(context, resource),
      },
    });
  }

  /**
   * Log a validation failure
   */
  async logValidationFailure(
    context: AuditContext,
    resource: string,
    resourceId: string,
    errors: any[]
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: 'validation.failed',
      severity: 'low',
      resource,
      resourceId,
      action: 'validate',
      details: {
        errors: errors.slice(0, 10), // Limit error details
        errorCount: errors.length,
      },
      success: false,
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    context: AuditContext,
    eventType: string,
    severity: 'medium' | 'high' | 'critical',
    details: any
  ): Promise<void> {
    await this.logEvent(context, {
      eventType: `security.${eventType}`,
      severity,
      resource: 'system',
      resourceId: 'security',
      action: eventType,
      details,
    });
  }

  /**
   * Calculate severity based on changed fields
   */
  private calculateUpdateSeverity(changedFields: string[]): 'low' | 'medium' | 'high' {
    const highSeverityFields = ['status', 'operationalConstraints', 'infrastructure'];
    const mediumSeverityFields = ['dimensions', 'aircraftCompatibility', 'groundSupport'];

    if (changedFields.some((field) => highSeverityFields.includes(field))) {
      return 'high';
    }
    if (changedFields.some((field) => mediumSeverityFields.includes(field))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Sanitize sensitive data from changes
   */
  private sanitizeChanges(data: any): any {
    const sanitized = { ...data };

    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.apiKey;
    delete sanitized.token;

    return sanitized;
  }

  /**
   * Sanitize filter data
   */
  private sanitizeFilters(filters: any): any {
    if (!filters) return {};

    const sanitized = { ...filters };

    // Remove sensitive filter values
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.apiKey) sanitized.apiKey = '***';

    return sanitized;
  }

  /**
   * Generate unique export ID
   */
  private generateExportId(context: AuditContext, resource: string): string {
    const data = `${context.userId}-${context.organizationId}-${resource}-${Date.now()}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Query audit events
   */
  async queryEvents(
    organizationId: string,
    filters: {
      userId?: string;
      resource?: string;
      resourceId?: string;
      eventType?: string;
      severity?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]> {
    const where: any = { organizationId };

    if (filters.userId) where.userId = filters.userId;
    if (filters.resource) where.resource = filters.resource;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.severity) where.severity = filters.severity;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return this.prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(organizationId: string, startDate: Date, endDate: Date): Promise<any> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Aggregate statistics
    const stats = {
      totalEvents: events.length,
      byEventType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byResource: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      failedOperations: events.filter((e) => !e.success).length,
    };

    events.forEach((event) => {
      stats.byEventType[event.eventType] = (stats.byEventType[event.eventType] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      stats.byResource[event.resource] = (stats.byResource[event.resource] || 0) + 1;
      stats.byUser[event.userId] = (stats.byUser[event.userId] || 0) + 1;
    });

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      stats,
      topUsers: Object.entries(stats.byUser)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count })),
      criticalEvents: events.filter((e) => e.severity === 'critical'),
      securityEvents: events.filter((e) => e.eventType.startsWith('security.')),
    };
  }
}
