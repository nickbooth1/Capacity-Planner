import { PrismaClient } from '@prisma/client';
import { StandCapabilities } from '../types';

export enum AuditEventType {
  CAPABILITY_CREATED = 'capability_created',
  CAPABILITY_UPDATED = 'capability_updated',
  CAPABILITY_DELETED = 'capability_deleted',
  CAPABILITY_VALIDATED = 'capability_validated',
  TEMPLATE_APPLIED = 'template_applied',
  TEMPLATE_CREATED = 'template_created',
  TEMPLATE_UPDATED = 'template_updated',
  TEMPLATE_DELETED = 'template_deleted',
  MAINTENANCE_SCHEDULED = 'maintenance_scheduled',
  MAINTENANCE_COMPLETED = 'maintenance_completed',
  MAINTENANCE_CANCELLED = 'maintenance_cancelled',
  ADJACENCY_CREATED = 'adjacency_created',
  ADJACENCY_UPDATED = 'adjacency_updated',
  ADJACENCY_DELETED = 'adjacency_deleted',
  SECURITY_VIOLATION = 'security_violation',
  ACCESS_DENIED = 'access_denied',
  FIELD_ACCESSED = 'field_accessed',
  ENCRYPTION_FAILURE = 'encryption_failure',
  VALIDATION_FAILURE = 'validation_failure',
  COMPLIANCE_CHECK = 'compliance_check',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AuditEvent {
  id?: string;
  organizationId: string;
  userId: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  resource: string; // e.g., 'stand', 'template', 'maintenance_record'
  resourceId: string;
  action: string; // e.g., 'create', 'update', 'delete', 'validate'
  details: any; // Event-specific details
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    sessionId?: string;
    apiVersion?: string;
  };
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface AuditQuery {
  organizationId: string;
  userId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  resource?: string;
  resourceId?: string;
  action?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  successRate: number;
  topUsers: Array<{ userId: string; eventCount: number }>;
  topResources: Array<{ resource: string; eventCount: number }>;
  recentEvents: AuditEvent[];
}

export class AuditService {
  private prisma: PrismaClient;
  private eventBuffer: AuditEvent[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, bufferSize: number = 100) {
    this.prisma = prisma;
    this.bufferSize = bufferSize;
    this.startBufferFlushTimer();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Add to buffer
    this.eventBuffer.push(auditEvent);

    // Flush buffer if it's full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Log capability change event
   */
  async logCapabilityChange(
    organizationId: string,
    userId: string,
    standId: string,
    action: 'create' | 'update' | 'delete',
    previousCapabilities?: StandCapabilities,
    newCapabilities?: StandCapabilities,
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    const eventType =
      action === 'create'
        ? AuditEventType.CAPABILITY_CREATED
        : action === 'update'
          ? AuditEventType.CAPABILITY_UPDATED
          : AuditEventType.CAPABILITY_DELETED;

    const changes: any = {};
    if (previousCapabilities && newCapabilities) {
      // Calculate what changed
      changes.changedFields = this.calculateChangedFields(previousCapabilities, newCapabilities);
    }

    await this.logEvent({
      organizationId,
      userId,
      eventType,
      severity: AuditSeverity.MEDIUM,
      resource: 'stand',
      resourceId: standId,
      action,
      details: {
        previousCapabilities,
        newCapabilities,
        ...changes,
      },
      metadata,
      success: true,
    });
  }

  /**
   * Log template application event
   */
  async logTemplateApplication(
    organizationId: string,
    userId: string,
    templateId: string,
    standIds: string[],
    applicationResult: {
      successful: number;
      failed: number;
      results: any[];
    },
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    await this.logEvent({
      organizationId,
      userId,
      eventType: AuditEventType.TEMPLATE_APPLIED,
      severity: applicationResult.failed > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      resource: 'template',
      resourceId: templateId,
      action: 'apply',
      details: {
        standIds,
        applicationResult,
      },
      metadata,
      success: applicationResult.failed === 0,
    });
  }

  /**
   * Log validation event
   */
  async logValidation(
    organizationId: string,
    userId: string,
    standId: string,
    validationResult: {
      isValid: boolean;
      errors: any[];
      warnings: any[];
    },
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    await this.logEvent({
      organizationId,
      userId,
      eventType: AuditEventType.CAPABILITY_VALIDATED,
      severity: !validationResult.isValid ? AuditSeverity.HIGH : AuditSeverity.LOW,
      resource: 'stand',
      resourceId: standId,
      action: 'validate',
      details: {
        validationResult,
      },
      metadata,
      success: validationResult.isValid,
    });
  }

  /**
   * Log maintenance event
   */
  async logMaintenance(
    organizationId: string,
    userId: string,
    standId: string,
    maintenanceRecordId: string,
    action: 'schedule' | 'complete' | 'cancel',
    details: any,
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    const eventType =
      action === 'schedule'
        ? AuditEventType.MAINTENANCE_SCHEDULED
        : action === 'complete'
          ? AuditEventType.MAINTENANCE_COMPLETED
          : AuditEventType.MAINTENANCE_CANCELLED;

    await this.logEvent({
      organizationId,
      userId,
      eventType,
      severity: AuditSeverity.MEDIUM,
      resource: 'maintenance_record',
      resourceId: maintenanceRecordId,
      action,
      details: {
        standId,
        ...details,
      },
      metadata,
      success: true,
    });
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    organizationId: string,
    userId: string,
    violationType: string,
    details: any,
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    await this.logEvent({
      organizationId,
      userId,
      eventType: AuditEventType.SECURITY_VIOLATION,
      severity: AuditSeverity.CRITICAL,
      resource: 'security',
      resourceId: 'system',
      action: violationType,
      details,
      metadata,
      success: false,
    });
  }

  /**
   * Log access denial
   */
  async logAccessDenial(
    organizationId: string,
    userId: string,
    resource: string,
    resourceId: string,
    action: string,
    reason: string,
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    await this.logEvent({
      organizationId,
      userId,
      eventType: AuditEventType.ACCESS_DENIED,
      severity: AuditSeverity.HIGH,
      resource,
      resourceId,
      action,
      details: {
        reason,
      },
      metadata,
      success: false,
    });
  }

  /**
   * Log field access
   */
  async logFieldAccess(
    organizationId: string,
    userId: string,
    fieldPath: string,
    action: 'read' | 'write',
    success: boolean,
    details?: any,
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    await this.logEvent({
      organizationId,
      userId,
      eventType: AuditEventType.FIELD_ACCESSED,
      severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      resource: 'field',
      resourceId: fieldPath,
      action,
      details,
      metadata,
      success,
    });
  }

  /**
   * Log ICAO compliance check
   */
  async logComplianceCheck(
    organizationId: string,
    userId: string,
    standId: string,
    complianceResult: {
      isCompliant: boolean;
      violations: any[];
      recommendations: any[];
    },
    metadata?: AuditEvent['metadata']
  ): Promise<void> {
    await this.logEvent({
      organizationId,
      userId,
      eventType: AuditEventType.COMPLIANCE_CHECK,
      severity: !complianceResult.isCompliant ? AuditSeverity.HIGH : AuditSeverity.LOW,
      resource: 'stand',
      resourceId: standId,
      action: 'compliance_check',
      details: {
        complianceResult,
      },
      metadata,
      success: complianceResult.isCompliant,
    });
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<{
    events: AuditEvent[];
    totalCount: number;
  }> {
    const where: any = {
      organizationId: query.organizationId,
    };

    if (query.userId) where.userId = query.userId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.severity) where.severity = query.severity;
    if (query.resource) where.resource = query.resource;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.action) where.action = query.action;
    if (query.success !== undefined) where.success = query.success;
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = query.startDate;
      if (query.endDate) where.timestamp.lte = query.endDate;
    }

    const [events, totalCount] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 100,
        skip: query.offset || 0,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      events: events as AuditEvent[],
      totalCount,
    };
  }

  /**
   * Get audit statistics
   */
  async getStatistics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditStatistics> {
    const where: any = {
      organizationId,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [
      totalEvents,
      eventsByType,
      eventsBySeverity,
      successCount,
      topUsers,
      topResources,
      recentEvents,
    ] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.groupBy({
        by: ['eventType'],
        where,
        _count: { eventType: true },
      }),
      this.prisma.auditEvent.groupBy({
        by: ['severity'],
        where,
        _count: { severity: true },
      }),
      this.prisma.auditEvent.count({ where: { ...where, success: true } }),
      this.prisma.auditEvent.groupBy({
        by: ['userId'],
        where,
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
      this.prisma.auditEvent.groupBy({
        by: ['resource'],
        where,
        _count: { resource: true },
        orderBy: { _count: { resource: 'desc' } },
        take: 10,
      }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
    ]);

    // Process results
    const eventsByTypeMap: Record<AuditEventType, number> = {} as any;
    Object.values(AuditEventType).forEach((type) => {
      eventsByTypeMap[type] = 0;
    });
    eventsByType.forEach((stat) => {
      eventsByTypeMap[stat.eventType as AuditEventType] = stat._count.eventType;
    });

    const eventsBySeverityMap: Record<AuditSeverity, number> = {} as any;
    Object.values(AuditSeverity).forEach((severity) => {
      eventsBySeverityMap[severity] = 0;
    });
    eventsBySeverity.forEach((stat) => {
      eventsBySeverityMap[stat.severity as AuditSeverity] = stat._count.severity;
    });

    return {
      totalEvents,
      eventsByType: eventsByTypeMap,
      eventsBySeverity: eventsBySeverityMap,
      successRate: totalEvents > 0 ? (successCount / totalEvents) * 100 : 0,
      topUsers: topUsers.map((u) => ({
        userId: u.userId,
        eventCount: u._count.userId,
      })),
      topResources: topResources.map((r) => ({
        resource: r.resource,
        eventCount: r._count.resource,
      })),
      recentEvents: recentEvents as AuditEvent[],
    };
  }

  /**
   * Export audit events
   */
  async exportEvents(query: AuditQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const result = await this.queryEvents({
      ...query,
      limit: undefined, // Export all matching events
      offset: undefined,
    });

    if (format === 'csv') {
      const header =
        'timestamp,userId,eventType,severity,resource,resourceId,action,success,errorMessage\n';
      const rows = result.events
        .map(
          (event) =>
            `${event.timestamp.toISOString()},${event.userId},${event.eventType},${event.severity},${event.resource},${event.resourceId},${event.action},${event.success},${event.errorMessage || ''}`
        )
        .join('\n');
      return header + rows;
    }

    return JSON.stringify(result.events, null, 2);
  }

  /**
   * Flush event buffer to database
   */
  async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.prisma.auditEvent.createMany({
        data: events.map((event) => ({
          organizationId: event.organizationId,
          userId: event.userId,
          eventType: event.eventType,
          severity: event.severity,
          resource: event.resource,
          resourceId: event.resourceId,
          action: event.action,
          details: event.details,
          metadata: event.metadata || {},
          timestamp: event.timestamp,
          success: event.success,
          errorMessage: event.errorMessage,
        })),
      });
    } catch (error) {
      console.error('Failed to flush audit events:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Start automatic buffer flushing
   */
  private startBufferFlushTimer(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(async () => {
      await this.flushBuffer();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Stop automatic buffer flushing
   */
  stopBufferFlushTimer(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Calculate changed fields between two capability objects
   */
  private calculateChangedFields(
    previous: StandCapabilities,
    current: StandCapabilities
  ): string[] {
    const changes: string[] = [];

    const compareObjects = (obj1: any, obj2: any, path: string = '') => {
      for (const key in obj1) {
        if (obj1.hasOwnProperty(key)) {
          const fullPath = path ? `${path}.${key}` : key;

          if (obj2.hasOwnProperty(key)) {
            if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
              if (obj1[key] !== null && obj2[key] !== null) {
                compareObjects(obj1[key], obj2[key], fullPath);
              } else if (obj1[key] !== obj2[key]) {
                changes.push(fullPath);
              }
            } else if (obj1[key] !== obj2[key]) {
              changes.push(fullPath);
            }
          } else {
            changes.push(fullPath);
          }
        }
      }

      for (const key in obj2) {
        if (obj2.hasOwnProperty(key) && !obj1.hasOwnProperty(key)) {
          const fullPath = path ? `${path}.${key}` : key;
          changes.push(fullPath);
        }
      }
    };

    compareObjects(previous, current);
    return changes;
  }

  /**
   * Cleanup old audit events
   */
  async cleanupOldEvents(organizationId: string, retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditEvent.deleteMany({
      where: {
        organizationId,
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get audit event by ID
   */
  async getEventById(eventId: string, organizationId: string): Promise<AuditEvent | null> {
    const event = await this.prisma.auditEvent.findFirst({
      where: {
        id: eventId,
        organizationId,
      },
    });

    return event as AuditEvent | null;
  }

  /**
   * Destructor - cleanup resources
   */
  destroy(): void {
    this.stopBufferFlushTimer();
  }
}
