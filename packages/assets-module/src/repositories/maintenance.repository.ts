import { PrismaClient, StandMaintenanceRecord } from '@prisma/client';

export interface MaintenanceRecordWithStand extends StandMaintenanceRecord {
  stand?: {
    id: string;
    identifier: string;
    organizationId: string;
  };
}

export interface MaintenanceQueryFilters {
  organizationId?: string;
  standId?: string;
  status?: string;
  type?: string;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface MaintenanceScheduleConflict {
  standId: string;
  conflictingRecords: Array<{
    id: string;
    type: string;
    scheduledStart: Date;
    scheduledEnd: Date;
  }>;
}

export class MaintenanceRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new maintenance record
   */
  async create(
    data: Omit<StandMaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MaintenanceRecordWithStand> {
    const record = await this.prisma.standMaintenanceRecord.create({
      data,
      include: {
        stand: {
          select: {
            id: true,
            identifier: true,
            organizationId: true,
          },
        },
      },
    });

    return record as MaintenanceRecordWithStand;
  }

  /**
   * Update maintenance record
   */
  async update(
    id: string,
    organizationId: string,
    data: Partial<Omit<StandMaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<MaintenanceRecordWithStand> {
    const record = await this.prisma.standMaintenanceRecord.update({
      where: {
        id,
        stand: {
          organizationId,
        },
      },
      data,
      include: {
        stand: {
          select: {
            id: true,
            identifier: true,
            organizationId: true,
          },
        },
      },
    });

    return record as MaintenanceRecordWithStand;
  }

  /**
   * Find maintenance record by ID
   */
  async findById(id: string, organizationId: string): Promise<MaintenanceRecordWithStand | null> {
    const record = await this.prisma.standMaintenanceRecord.findFirst({
      where: {
        id,
        stand: {
          organizationId,
        },
      },
      include: {
        stand: {
          select: {
            id: true,
            identifier: true,
            organizationId: true,
          },
        },
      },
    });

    return record as MaintenanceRecordWithStand | null;
  }

  /**
   * Query maintenance records with filters
   */
  async query(filters: MaintenanceQueryFilters): Promise<MaintenanceRecordWithStand[]> {
    const whereClause: any = {};

    if (filters.organizationId) {
      whereClause.stand = {
        organizationId: filters.organizationId,
      };
    }

    if (filters.standId) {
      whereClause.standId = filters.standId;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.type) {
      whereClause.type = filters.type;
    }

    if (filters.scheduledAfter || filters.scheduledBefore) {
      whereClause.scheduledStart = {};
      if (filters.scheduledAfter) {
        whereClause.scheduledStart.gte = filters.scheduledAfter;
      }
      if (filters.scheduledBefore) {
        whereClause.scheduledStart.lte = filters.scheduledBefore;
      }
    }

    const records = await this.prisma.standMaintenanceRecord.findMany({
      where: whereClause,
      include: {
        stand: {
          select: {
            id: true,
            identifier: true,
            organizationId: true,
          },
        },
      },
      skip: filters.offset || 0,
      take: filters.limit || 50,
      orderBy: {
        scheduledStart: 'asc',
      },
    });

    return records as MaintenanceRecordWithStand[];
  }

  /**
   * Get maintenance history for a stand
   */
  async getHistoryForStand(
    standId: string,
    organizationId: string,
    limit: number = 20
  ): Promise<MaintenanceRecordWithStand[]> {
    const records = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        standId,
        stand: {
          organizationId,
        },
      },
      include: {
        stand: {
          select: {
            id: true,
            identifier: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        scheduledStart: 'desc',
      },
      take: limit,
    });

    return records as MaintenanceRecordWithStand[];
  }

  /**
   * Check for scheduling conflicts
   */
  async checkSchedulingConflicts(
    standId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    excludeRecordId?: string
  ): Promise<MaintenanceScheduleConflict | null> {
    const whereClause: any = {
      standId,
      status: {
        in: ['SCHEDULED', 'IN_PROGRESS'],
      },
      OR: [
        {
          // New maintenance overlaps with existing start time
          scheduledStart: {
            lte: scheduledEnd,
          },
          scheduledEnd: {
            gte: scheduledStart,
          },
        },
      ],
    };

    if (excludeRecordId) {
      whereClause.id = {
        not: excludeRecordId,
      };
    }

    const conflictingRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
        scheduledStart: true,
        scheduledEnd: true,
      },
    });

    if (conflictingRecords.length > 0) {
      return {
        standId,
        conflictingRecords,
      };
    }

    return null;
  }

  /**
   * Get maintenance statistics for organization
   */
  async getStatistics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalRecords: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    avgDuration: number;
    upcomingMaintenance: number;
  }> {
    const whereClause: any = {
      stand: {
        organizationId,
      },
    };

    if (startDate || endDate) {
      whereClause.scheduledStart = {};
      if (startDate) {
        whereClause.scheduledStart.gte = startDate;
      }
      if (endDate) {
        whereClause.scheduledStart.lte = endDate;
      }
    }

    const totalRecords = await this.prisma.standMaintenanceRecord.count({
      where: whereClause,
    });

    const statusStats = await this.prisma.standMaintenanceRecord.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    const typeStats = await this.prisma.standMaintenanceRecord.groupBy({
      by: ['type'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    // Calculate average duration for completed maintenance
    const completedRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        ...whereClause,
        status: 'COMPLETED',
        actualStart: {
          not: null,
        },
        actualEnd: {
          not: null,
        },
      },
      select: {
        actualStart: true,
        actualEnd: true,
      },
    });

    const avgDuration =
      completedRecords.length > 0
        ? completedRecords.reduce((sum, record) => {
            if (record.actualStart && record.actualEnd) {
              return sum + (record.actualEnd.getTime() - record.actualStart.getTime());
            }
            return sum;
          }, 0) /
          completedRecords.length /
          (1000 * 60 * 60) // Convert to hours
        : 0;

    const upcomingMaintenance = await this.prisma.standMaintenanceRecord.count({
      where: {
        stand: {
          organizationId,
        },
        status: 'SCHEDULED',
        scheduledStart: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      },
    });

    const byStatus: Record<string, number> = {};
    statusStats.forEach((stat) => {
      byStatus[stat.status] = stat._count.id;
    });

    const byType: Record<string, number> = {};
    typeStats.forEach((stat) => {
      byType[stat.type] = stat._count.id;
    });

    return {
      totalRecords,
      byStatus,
      byType,
      avgDuration,
      upcomingMaintenance,
    };
  }

  /**
   * Get maintenance schedule for date range
   */
  async getSchedule(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      date: string;
      standId: string;
      standIdentifier: string;
      records: Array<{
        id: string;
        type: string;
        status: string;
        scheduledStart: Date;
        scheduledEnd: Date;
        description?: string;
      }>;
    }>
  > {
    const records = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        stand: {
          organizationId,
        },
        scheduledStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        stand: {
          select: {
            id: true,
            identifier: true,
          },
        },
      },
      orderBy: {
        scheduledStart: 'asc',
      },
    });

    // Group by date and stand
    const scheduleMap = new Map<string, Map<string, any>>();

    records.forEach((record) => {
      const dateKey = record.scheduledStart.toISOString().split('T')[0];
      const standKey = record.standId;

      if (!scheduleMap.has(dateKey)) {
        scheduleMap.set(dateKey, new Map());
      }

      const dateMap = scheduleMap.get(dateKey)!;
      if (!dateMap.has(standKey)) {
        dateMap.set(standKey, {
          standId: record.standId,
          standIdentifier: record.stand!.identifier,
          records: [],
        });
      }

      dateMap.get(standKey)!.records.push({
        id: record.id,
        type: record.type,
        status: record.status,
        scheduledStart: record.scheduledStart,
        scheduledEnd: record.scheduledEnd,
        description: record.description,
      });
    });

    // Convert to array format
    const schedule: Array<{
      date: string;
      standId: string;
      standIdentifier: string;
      records: Array<{
        id: string;
        type: string;
        status: string;
        scheduledStart: Date;
        scheduledEnd: Date;
        description?: string;
      }>;
    }> = [];

    for (const [date, dateMap] of scheduleMap) {
      for (const [standId, standData] of dateMap) {
        schedule.push({
          date,
          ...standData,
        });
      }
    }

    return schedule;
  }
}
