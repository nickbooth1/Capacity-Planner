import { prisma } from './prisma';

interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  changes?: any;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
}

export async function createAuditLog(entry: AuditLogEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changes: entry.changes || null,
        performedBy: entry.performedBy,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        organizationId: entry.organizationId,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - we don't want audit failures to break operations
  }
}

export async function getAuditLogs(filters?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  try {
    const where: any = {};

    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.action) where.action = filters.action;
    if (filters?.performedBy) where.performedBy = filters.performedBy;
    if (filters?.organizationId) where.organizationId = filters.organizationId;

    if (filters?.startDate || filters?.endDate) {
      where.performedAt = {};
      if (filters.startDate) where.performedAt.gte = filters.startDate;
      if (filters.endDate) where.performedAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs: logs || [], total: total || 0 };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { logs: [], total: 0 };
  }
}
