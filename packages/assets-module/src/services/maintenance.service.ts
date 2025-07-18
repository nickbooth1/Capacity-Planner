import { PrismaClient, StandMaintenanceRecord } from '@prisma/client';
import { MaintenanceRepository } from '../repositories/maintenance.repository';

export interface MaintenanceScheduleRequest {
  standId: string;
  type: string;
  description?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedCost?: number;
  requiredSkills?: string[];
  requiredEquipment?: string[];
}

export interface MaintenanceUpdateRequest {
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
  actualStart?: Date;
  actualEnd?: Date;
  completionNotes?: string;
  actualCost?: number;
}

export interface MaintenanceNotification {
  type: 'SCHEDULED' | 'STARTED' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  recordId: string;
  standId: string;
  standIdentifier: string;
  message: string;
  timestamp: Date;
  recipients: string[];
}

export interface MaintenanceImpactAnalysis {
  affectedStands: string[];
  capacityReduction: number;
  alternativeStands: string[];
  estimatedRevenueLoss: number;
  operationalConstraints: string[];
}

export class MaintenanceService {
  private repository: MaintenanceRepository;
  private notificationListeners: Array<(notification: MaintenanceNotification) => void> = [];

  constructor(private prisma: PrismaClient) {
    this.repository = new MaintenanceRepository(prisma);
  }

  /**
   * Schedule new maintenance
   */
  async scheduleMaintenance(
    organizationId: string,
    request: MaintenanceScheduleRequest,
    userId: string
  ) {
    // Check for scheduling conflicts
    const conflict = await this.repository.checkSchedulingConflicts(
      request.standId,
      request.scheduledStart,
      request.scheduledEnd
    );

    if (conflict) {
      throw new Error(
        `Scheduling conflict detected. Stand has ${conflict.conflictingRecords.length} conflicting maintenance records.`
      );
    }

    // Create maintenance record
    const record = await this.repository.create({
      standId: request.standId,
      type: request.type,
      description: request.description,
      scheduledStart: request.scheduledStart,
      scheduledEnd: request.scheduledEnd,
      status: 'SCHEDULED',
      priority: request.priority,
      estimatedCost: request.estimatedCost,
      requiredSkills: request.requiredSkills,
      requiredEquipment: request.requiredEquipment,
      createdBy: userId,
    });

    // Analyze impact
    const impactAnalysis = await this.analyzeMaintenanceImpact(
      request.standId,
      request.scheduledStart,
      request.scheduledEnd
    );

    // Send notification
    await this.sendNotification({
      type: 'SCHEDULED',
      recordId: record.id,
      standId: record.standId,
      standIdentifier: record.stand?.identifier || 'Unknown',
      message: `Maintenance scheduled for ${request.type} from ${request.scheduledStart.toISOString()} to ${request.scheduledEnd.toISOString()}`,
      timestamp: new Date(),
      recipients: [], // Would be populated based on organization settings
    });

    return {
      record,
      impactAnalysis,
    };
  }

  /**
   * Update maintenance record
   */
  async updateMaintenance(
    recordId: string,
    organizationId: string,
    updates: MaintenanceUpdateRequest,
    userId: string
  ) {
    const currentRecord = await this.repository.findById(recordId, organizationId);
    if (!currentRecord) {
      throw new Error(`Maintenance record with ID ${recordId} not found`);
    }

    // Check for scheduling conflicts if dates are being updated
    if (
      updates.status === 'SCHEDULED' &&
      currentRecord.scheduledStart &&
      currentRecord.scheduledEnd
    ) {
      const conflict = await this.repository.checkSchedulingConflicts(
        currentRecord.standId,
        currentRecord.scheduledStart,
        currentRecord.scheduledEnd,
        recordId
      );

      if (conflict) {
        throw new Error(
          `Scheduling conflict detected. Stand has ${conflict.conflictingRecords.length} conflicting maintenance records.`
        );
      }
    }

    // Update record
    const updatedRecord = await this.repository.update(recordId, organizationId, {
      ...updates,
      updatedBy: userId,
    });

    // Send appropriate notification
    if (updates.status) {
      const notificationType = this.getNotificationTypeForStatus(updates.status);
      if (notificationType) {
        await this.sendNotification({
          type: notificationType,
          recordId: updatedRecord.id,
          standId: updatedRecord.standId,
          standIdentifier: updatedRecord.stand?.identifier || 'Unknown',
          message: `Maintenance ${updates.status.toLowerCase()}: ${updatedRecord.type}`,
          timestamp: new Date(),
          recipients: [],
        });
      }
    }

    return updatedRecord;
  }

  /**
   * Get maintenance schedule for date range
   */
  async getMaintenanceSchedule(organizationId: string, startDate: Date, endDate: Date) {
    const schedule = await this.repository.getSchedule(organizationId, startDate, endDate);

    // Add impact analysis for each maintenance record
    const enrichedSchedule = await Promise.all(
      schedule.map(async (item) => {
        const impactAnalyses = await Promise.all(
          item.records.map(async (record) => {
            const impact = await this.analyzeMaintenanceImpact(
              item.standId,
              record.scheduledStart,
              record.scheduledEnd
            );
            return {
              recordId: record.id,
              impact,
            };
          })
        );

        return {
          ...item,
          impactAnalyses,
        };
      })
    );

    return enrichedSchedule;
  }

  /**
   * Get maintenance history for a stand
   */
  async getMaintenanceHistory(standId: string, organizationId: string, limit: number = 20) {
    return await this.repository.getHistoryForStand(standId, organizationId, limit);
  }

  /**
   * Get maintenance statistics
   */
  async getMaintenanceStatistics(organizationId: string, startDate?: Date, endDate?: Date) {
    const stats = await this.repository.getStatistics(organizationId, startDate, endDate);

    // Add derived metrics
    const completionRate = (stats.byStatus.COMPLETED / (stats.totalRecords || 1)) * 100;
    const onTimeRate = await this.calculateOnTimeCompletionRate(organizationId, startDate, endDate);

    return {
      ...stats,
      completionRate,
      onTimeRate,
      costEfficiency: {
        averageActualVsEstimated: await this.calculateCostEfficiency(
          organizationId,
          startDate,
          endDate
        ),
      },
    };
  }

  /**
   * Get upcoming maintenance alerts
   */
  async getUpcomingMaintenanceAlerts(organizationId: string, daysBefore: number = 7) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysBefore);

    const upcomingRecords = await this.repository.query({
      organizationId,
      status: 'SCHEDULED',
      scheduledAfter: startDate,
      scheduledBefore: endDate,
    });

    return upcomingRecords.map((record) => ({
      recordId: record.id,
      standId: record.standId,
      standIdentifier: record.stand?.identifier || 'Unknown',
      type: record.type,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      priority: record.priority,
      daysUntilStart: Math.ceil(
        (record.scheduledStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));
  }

  /**
   * Analyze maintenance impact on operations
   */
  private async analyzeMaintenanceImpact(
    standId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MaintenanceImpactAnalysis> {
    // Get stand information
    const stand = await this.prisma.stand.findUnique({
      where: { id: standId },
      include: {
        adjacencies: {
          include: {
            adjacentStand: true,
          },
        },
      },
    });

    if (!stand) {
      throw new Error(`Stand with ID ${standId} not found`);
    }

    // Find alternative stands with similar capabilities
    const alternativeStands = await this.prisma.stand.findMany({
      where: {
        organizationId: stand.organizationId,
        id: { not: standId },
        // Add capability matching logic here
      },
      take: 5,
    });

    // Calculate capacity reduction (simplified)
    const maintenanceDurationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const capacityReduction = Math.min((maintenanceDurationHours / 24) * 100, 100);

    // Get affected adjacent stands
    const affectedStands = stand.adjacencies
      .filter((adj) => adj.impactLevel === 'HIGH')
      .map((adj) => adj.adjacentStandId);

    return {
      affectedStands,
      capacityReduction,
      alternativeStands: alternativeStands.map((s) => s.id),
      estimatedRevenueLoss: capacityReduction * 1000, // Simplified calculation
      operationalConstraints: [
        'Reduced taxiway capacity',
        'Increased ground traffic',
        'Potential delays',
      ],
    };
  }

  /**
   * Calculate on-time completion rate
   */
  private async calculateOnTimeCompletionRate(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const whereClause: any = {
      stand: { organizationId },
      status: 'COMPLETED',
      actualEnd: { not: null },
    };

    if (startDate || endDate) {
      whereClause.scheduledStart = {};
      if (startDate) whereClause.scheduledStart.gte = startDate;
      if (endDate) whereClause.scheduledStart.lte = endDate;
    }

    const completedRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: whereClause,
      select: {
        scheduledEnd: true,
        actualEnd: true,
      },
    });

    if (completedRecords.length === 0) return 0;

    const onTimeRecords = completedRecords.filter(
      (record) => record.actualEnd && record.actualEnd <= record.scheduledEnd
    );

    return (onTimeRecords.length / completedRecords.length) * 100;
  }

  /**
   * Calculate cost efficiency
   */
  private async calculateCostEfficiency(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const whereClause: any = {
      stand: { organizationId },
      status: 'COMPLETED',
      estimatedCost: { not: null },
      actualCost: { not: null },
    };

    if (startDate || endDate) {
      whereClause.scheduledStart = {};
      if (startDate) whereClause.scheduledStart.gte = startDate;
      if (endDate) whereClause.scheduledStart.lte = endDate;
    }

    const records = await this.prisma.standMaintenanceRecord.findMany({
      where: whereClause,
      select: {
        estimatedCost: true,
        actualCost: true,
      },
    });

    if (records.length === 0) return 0;

    const efficiency = records.reduce((sum, record) => {
      const efficiency = (record.estimatedCost! / record.actualCost!) * 100;
      return sum + Math.min(efficiency, 200); // Cap at 200% to avoid outliers
    }, 0);

    return efficiency / records.length;
  }

  /**
   * Send maintenance notification
   */
  private async sendNotification(notification: MaintenanceNotification) {
    // Publish to listeners
    this.notificationListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in maintenance notification listener:', error);
      }
    });
  }

  /**
   * Get notification type for status
   */
  private getNotificationTypeForStatus(status: string): MaintenanceNotification['type'] | null {
    switch (status) {
      case 'SCHEDULED':
        return 'SCHEDULED';
      case 'IN_PROGRESS':
        return 'STARTED';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return null;
    }
  }

  /**
   * Add notification listener
   */
  addNotificationListener(listener: (notification: MaintenanceNotification) => void) {
    this.notificationListeners.push(listener);
  }

  /**
   * Remove notification listener
   */
  removeNotificationListener(listener: (notification: MaintenanceNotification) => void) {
    const index = this.notificationListeners.indexOf(listener);
    if (index > -1) {
      this.notificationListeners.splice(index, 1);
    }
  }
}
