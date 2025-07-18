import { PrismaClient } from '@prisma/client';

export interface AuditEvent {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  timestamp: Date;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
}

export interface AuditQuery {
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  result?: 'success' | 'failure';
  page?: number;
  pageSize?: number;
}

export interface AuditTrailConfig {
  retentionDays: number;
  enableEncryption: boolean;
  enableCompression: boolean;
  sensitiveFields: string[];
}

export class AuditTrailService {
  private config: AuditTrailConfig = {
    retentionDays: 365, // 1 year default
    enableEncryption: true,
    enableCompression: true,
    sensitiveFields: ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn', 'bankAccount'],
  };

  constructor(
    private prisma: PrismaClient,
    config?: Partial<AuditTrailConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async logEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp'>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      // Sanitize sensitive data
      const sanitizedEvent = this.sanitizeSensitiveData(event);

      // Create audit event
      const auditEvent = await this.prisma.auditTrail.create({
        data: {
          organizationId: sanitizedEvent.organizationId,
          entityType: sanitizedEvent.entityType,
          entityId: sanitizedEvent.entityId,
          action: sanitizedEvent.action,
          actorId: sanitizedEvent.actorId,
          actorName: sanitizedEvent.actorName,
          actorEmail: sanitizedEvent.actorEmail,
          actorRole: sanitizedEvent.actorRole,
          changes: sanitizedEvent.changes || {},
          metadata: sanitizedEvent.metadata || {},
          ipAddress: sanitizedEvent.ipAddress,
          userAgent: sanitizedEvent.userAgent,
          sessionId: sanitizedEvent.sessionId,
          result: sanitizedEvent.result,
          errorMessage: sanitizedEvent.errorMessage,
        },
      });

      return {
        success: true,
        eventId: auditEvent.id,
      };
    } catch (error) {
      console.error('Error logging audit event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async logWorkRequestEvent(
    workRequestId: string,
    action: string,
    actor: { id: string; name: string; email: string; role: string },
    changes?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      organizationId: metadata?.organizationId || 'unknown',
      entityType: 'WorkRequest',
      entityId: workRequestId,
      action,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      changes,
      metadata,
      result: 'success',
    });
  }

  async logSecurityEvent(
    action: string,
    actor: { id: string; name: string; email: string; role: string },
    metadata: Record<string, any>,
    result: 'success' | 'failure',
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      organizationId: metadata.organizationId || 'unknown',
      entityType: 'Security',
      entityId: metadata.resourceId || 'system',
      action,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      metadata,
      result,
      errorMessage,
    });
  }

  async queryEvents(
    query: AuditQuery
  ): Promise<{ success: boolean; data?: { events: AuditEvent[]; total: number }; error?: string }> {
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 50;
      const skip = (page - 1) * pageSize;

      const where: any = {};

      if (query.organizationId) where.organizationId = query.organizationId;
      if (query.entityType) where.entityType = query.entityType;
      if (query.entityId) where.entityId = query.entityId;
      if (query.actorId) where.actorId = query.actorId;
      if (query.action) where.action = query.action;
      if (query.result) where.result = query.result;

      if (query.startDate || query.endDate) {
        where.timestamp = {};
        if (query.startDate) where.timestamp.gte = query.startDate;
        if (query.endDate) where.timestamp.lte = query.endDate;
      }

      const [events, total] = await Promise.all([
        this.prisma.auditTrail.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: pageSize,
        }),
        this.prisma.auditTrail.count({ where }),
      ]);

      return {
        success: true,
        data: {
          events: events.map(this.mapToAuditEvent),
          total,
        },
      };
    } catch (error) {
      console.error('Error querying audit events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit: number = 100
  ): Promise<{ success: boolean; data?: AuditEvent[]; error?: string }> {
    try {
      const events = await this.prisma.auditTrail.findMany({
        where: {
          entityType,
          entityId,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return {
        success: true,
        data: events.map(this.mapToAuditEvent),
      };
    } catch (error) {
      console.error('Error getting entity history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async generateComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    options: {
      includeSecurityEvents?: boolean;
      includeDataAccess?: boolean;
      includeSystemChanges?: boolean;
      format?: 'json' | 'csv';
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const eventTypes: string[] = [];

      if (options.includeSecurityEvents !== false) {
        eventTypes.push('Security');
      }
      if (options.includeDataAccess) {
        eventTypes.push('DataAccess');
      }
      if (options.includeSystemChanges) {
        eventTypes.push('SystemChange');
      }

      const events = await this.prisma.auditTrail.findMany({
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
          ...(eventTypes.length > 0 && { entityType: { in: eventTypes } }),
        },
        orderBy: { timestamp: 'asc' },
      });

      const report = {
        organizationId,
        reportPeriod: {
          start: startDate,
          end: endDate,
        },
        generatedAt: new Date(),
        summary: {
          totalEvents: events.length,
          byType: this.groupByField(events, 'entityType'),
          byAction: this.groupByField(events, 'action'),
          byResult: this.groupByField(events, 'result'),
          byActor: this.groupByField(events, 'actorId', 'actorName'),
        },
        events: events.map(this.mapToAuditEvent),
      };

      if (options.format === 'csv') {
        return {
          success: true,
          data: this.convertToCSV(report.events),
        };
      }

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      console.error('Error generating compliance report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cleanupOldEvents(
    daysToKeep?: number
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const retentionDays = daysToKeep || this.config.retentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.auditTrail.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      return {
        success: true,
        deletedCount: result.count,
      };
    } catch (error) {
      console.error('Error cleaning up old audit events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private sanitizeSensitiveData(event: any): any {
    const sanitized = { ...event };

    // Sanitize changes
    if (sanitized.changes) {
      sanitized.changes = this.sanitizeObject(sanitized.changes);
    }

    // Sanitize metadata
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeObject(sanitized.metadata);
    }

    return sanitized;
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.sensitiveFields.some((sensitive) =>
      lowerFieldName.includes(sensitive.toLowerCase())
    );
  }

  private mapToAuditEvent(dbEvent: any): AuditEvent {
    return {
      id: dbEvent.id,
      organizationId: dbEvent.organizationId,
      entityType: dbEvent.entityType,
      entityId: dbEvent.entityId,
      action: dbEvent.action,
      actorId: dbEvent.actorId,
      actorName: dbEvent.actorName,
      actorEmail: dbEvent.actorEmail,
      actorRole: dbEvent.actorRole,
      timestamp: dbEvent.timestamp,
      changes: dbEvent.changes,
      metadata: dbEvent.metadata,
      ipAddress: dbEvent.ipAddress,
      userAgent: dbEvent.userAgent,
      sessionId: dbEvent.sessionId,
      result: dbEvent.result,
      errorMessage: dbEvent.errorMessage,
    };
  }

  private groupByField(
    events: any[],
    field: string,
    displayField?: string
  ): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const event of events) {
      const key = displayField ? `${event[field]} (${event[displayField]})` : event[field];
      grouped[key] = (grouped[key] || 0) + 1;
    }

    return grouped;
  }

  private convertToCSV(events: AuditEvent[]): string {
    if (events.length === 0) return '';

    const headers = [
      'Timestamp',
      'Organization ID',
      'Entity Type',
      'Entity ID',
      'Action',
      'Actor ID',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Result',
      'Error Message',
      'IP Address',
      'User Agent',
    ];

    const rows = events.map((event) => [
      event.timestamp.toISOString(),
      event.organizationId,
      event.entityType,
      event.entityId,
      event.action,
      event.actorId,
      event.actorName,
      event.actorEmail,
      event.actorRole,
      event.result,
      event.errorMessage || '',
      event.ipAddress || '',
      event.userAgent || '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
  }
}
