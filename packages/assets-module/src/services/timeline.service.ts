import { PrismaClient } from '../db/client';
import { SecurityContext } from '@capacity-planner/shared-kernel';

export interface TimelineDataPoint {
  timestamp: Date;
  status: string;
  events: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  type: 'status_change' | 'maintenance_start' | 'maintenance_end';
  time: Date;
  status?: string;
  previousStatus?: string;
  reason?: string;
  changedBy?: string;
  metadata?: any;
}

export interface TimelineQuery {
  standId: string;
  start: Date;
  end: Date;
  granularity?: 'minute' | 'hour' | 'day';
}

export interface BulkTimelineQuery {
  standIds?: string[];
  start: Date;
  end: Date;
  granularity?: 'minute' | 'hour' | 'day';
}

export class TimelineService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly context: SecurityContext
  ) {}

  /**
   * Get timeline data for a single stand
   */
  async getStandTimeline(query: TimelineQuery) {
    const { standId, start, end, granularity = 'hour' } = query;

    // Verify stand belongs to user's organization
    const stand = await this.prisma.stand.findFirst({
      where: {
        id: standId,
        organizationId: this.context.organizationId,
        isDeleted: false,
      },
    });

    if (!stand) {
      throw new Error('Stand not found');
    }

    // Get status history
    const statusHistory = await this.prisma.standStatusHistory.findMany({
      where: {
        standId,
        organizationId: this.context.organizationId,
        changedAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { changedAt: 'asc' },
      include: {
        changedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get maintenance records
    const maintenanceRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        standId,
        organizationId: this.context.organizationId,
        OR: [
          {
            scheduledStartTime: {
              gte: start,
              lte: end,
            },
          },
          {
            scheduledEndTime: {
              gte: start,
              lte: end,
            },
          },
          {
            AND: [{ scheduledStartTime: { lte: start } }, { scheduledEndTime: { gte: end } }],
          },
        ],
      },
      orderBy: { scheduledStartTime: 'asc' },
    });

    // Generate timeline data points
    const timelineData = this.generateTimelineData(
      statusHistory,
      maintenanceRecords,
      start,
      end,
      granularity
    );

    return {
      standId,
      dateRange: { start, end },
      granularity,
      statusHistory,
      maintenanceRecords,
      timelineData,
    };
  }

  /**
   * Get timeline data for multiple stands
   */
  async getBulkTimeline(query: BulkTimelineQuery) {
    const { standIds, start, end, granularity = 'hour' } = query;

    // Get all stands if no specific IDs provided
    let targetStands: string[];
    if (standIds && standIds.length > 0) {
      // Verify all stands belong to organization
      const stands = await this.prisma.stand.findMany({
        where: {
          id: { in: standIds },
          organizationId: this.context.organizationId,
          isDeleted: false,
        },
        select: { id: true },
      });
      targetStands = stands.map((s) => s.id);
    } else {
      // Get all stands for organization
      const stands = await this.prisma.stand.findMany({
        where: {
          organizationId: this.context.organizationId,
          isDeleted: false,
        },
        select: { id: true },
      });
      targetStands = stands.map((s) => s.id);
    }

    // Get timeline data for all stands in parallel
    const timelinePromises = targetStands.map((standId) =>
      this.getStandTimeline({ standId, start, end, granularity })
    );

    const timelineResults = await Promise.all(timelinePromises);

    return {
      dateRange: { start, end },
      stands: timelineResults.reduce(
        (acc, result) => {
          acc[result.standId] = result;
          return acc;
        },
        {} as Record<string, any>
      ),
    };
  }

  /**
   * Get detailed stand information including history and maintenance
   */
  async getStandDetails(standId: string) {
    const stand = await this.prisma.stand.findFirst({
      where: {
        id: standId,
        organizationId: this.context.organizationId,
        isDeleted: false,
      },
      include: {
        maintenanceRecords: {
          orderBy: { scheduledStartTime: 'desc' },
          take: 10,
        },
        adjacentStands: {
          include: {
            adjacentStand: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
          },
        },
        capabilitySnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20,
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!stand) {
      throw new Error('Stand not found');
    }

    return stand;
  }

  /**
   * Generate timeline data points for visualization
   */
  private generateTimelineData(
    statusHistory: any[],
    maintenanceRecords: any[],
    startDate: Date,
    endDate: Date,
    granularity: string
  ): TimelineDataPoint[] {
    const dataPoints: TimelineDataPoint[] = [];
    const interval = this.getIntervalFromGranularity(granularity);

    let currentTime = new Date(startDate);
    let currentStatus = 'operational'; // Default status

    // Sort all events by time
    const allEvents: TimelineEvent[] = [
      ...statusHistory.map((s) => ({
        id: s.id,
        type: 'status_change' as const,
        time: s.changedAt,
        status: s.status,
        previousStatus: s.previousStatus,
        reason: s.reason,
        changedBy: s.changedByUser?.name || 'System',
        metadata: s.metadata,
      })),
      ...maintenanceRecords.map((m) => ({
        id: m.id,
        type: 'maintenance_start' as const,
        time: m.scheduledStartTime,
        reason: m.description,
        metadata: {
          maintenanceType: m.maintenanceType,
          priority: m.priority,
          estimatedDuration: m.estimatedDurationHours,
        },
      })),
      ...maintenanceRecords.map((m) => ({
        id: m.id,
        type: 'maintenance_end' as const,
        time: m.scheduledEndTime,
        reason: m.description,
        metadata: {
          maintenanceType: m.maintenanceType,
          actualDuration: m.actualDurationHours,
        },
      })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Find initial status before the start date
    const priorStatusChange = statusHistory
      .filter((s) => new Date(s.changedAt) < startDate)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0];

    if (priorStatusChange) {
      currentStatus = priorStatusChange.status;
    }

    while (currentTime <= endDate) {
      // Find events within this time interval
      const eventsAtTime = allEvents.filter(
        (e) =>
          new Date(e.time) <= currentTime &&
          new Date(e.time) > new Date(currentTime.getTime() - interval)
      );

      // Update status based on events
      eventsAtTime.forEach((event) => {
        if (event.type === 'status_change' && event.status) {
          currentStatus = event.status;
        }
      });

      // Check if we're in a maintenance window
      const inMaintenance = maintenanceRecords.some(
        (m) =>
          new Date(m.scheduledStartTime) <= currentTime &&
          new Date(m.scheduledEndTime) >= currentTime
      );

      if (inMaintenance && currentStatus !== 'maintenance') {
        currentStatus = 'maintenance';
      }

      dataPoints.push({
        timestamp: new Date(currentTime),
        status: currentStatus,
        events: eventsAtTime,
      });

      currentTime = new Date(currentTime.getTime() + interval);
    }

    return dataPoints;
  }

  private getIntervalFromGranularity(granularity: string): number {
    const intervals = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
    };
    return intervals[granularity as keyof typeof intervals] || intervals.hour;
  }
}
