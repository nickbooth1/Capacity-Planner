import { PrismaClient } from '@prisma/client';
import { MaintenanceRepository } from '../repositories/maintenance.repository';
import { MaintenanceScheduleRequest } from './maintenance.service';

export interface SchedulingConflict {
  conflictingRecords: Array<{
    id: string;
    type: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    priority: string;
  }>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export interface ResourceRequirement {
  type: 'SKILL' | 'EQUIPMENT' | 'CERTIFICATION';
  name: string;
  required: boolean;
  alternatives?: string[];
}

export interface SchedulingWindow {
  start: Date;
  end: Date;
  standId: string;
  available: boolean;
  conflicts: string[];
  score: number; // Higher is better
}

export interface OptimizedSchedule {
  standId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  priority: number;
  resourceAllocation: ResourceAllocation[];
  conflicts: SchedulingConflict[];
  alternatives: SchedulingWindow[];
}

export interface ResourceAllocation {
  resourceId: string;
  resourceType: 'TECHNICIAN' | 'EQUIPMENT' | 'TOOL';
  allocatedFrom: Date;
  allocatedTo: Date;
  cost: number;
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
}

export class MaintenanceSchedulerService {
  private repository: MaintenanceRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new MaintenanceRepository(prisma);
  }

  /**
   * Detect scheduling conflicts
   */
  async detectSchedulingConflicts(
    standId: string,
    startDate: Date,
    endDate: Date,
    excludeRecordId?: string
  ): Promise<SchedulingConflict | null> {
    const conflictingRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        standId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        id: excludeRecordId ? { not: excludeRecordId } : undefined,
        OR: [
          // New maintenance starts during existing maintenance
          {
            scheduledStart: { lte: startDate },
            scheduledEnd: { gte: startDate },
          },
          // New maintenance ends during existing maintenance
          {
            scheduledStart: { lte: endDate },
            scheduledEnd: { gte: endDate },
          },
          // New maintenance completely contains existing maintenance
          {
            scheduledStart: { gte: startDate },
            scheduledEnd: { lte: endDate },
          },
          // Existing maintenance completely contains new maintenance
          {
            scheduledStart: { lte: startDate },
            scheduledEnd: { gte: endDate },
          },
        ],
      },
      select: {
        id: true,
        type: true,
        scheduledStart: true,
        scheduledEnd: true,
        priority: true,
      },
    });

    if (conflictingRecords.length === 0) {
      return null;
    }

    // Determine conflict severity
    const highPriorityConflicts = conflictingRecords.filter(
      (record) => record.priority === 'HIGH' || record.priority === 'URGENT'
    );

    let severity: SchedulingConflict['severity'];
    if (highPriorityConflicts.length > 0) {
      severity = 'CRITICAL';
    } else if (conflictingRecords.length > 2) {
      severity = 'HIGH';
    } else if (conflictingRecords.length > 1) {
      severity = 'MEDIUM';
    } else {
      severity = 'LOW';
    }

    // Generate recommendations
    const recommendations = this.generateConflictRecommendations(
      conflictingRecords,
      startDate,
      endDate
    );

    return {
      conflictingRecords,
      severity,
      recommendations,
    };
  }

  /**
   * Find optimal scheduling windows
   */
  async findOptimalSchedulingWindows(
    standId: string,
    duration: number, // in hours
    preferredStart?: Date,
    preferredEnd?: Date,
    constraints?: {
      businessHours?: boolean;
      weekendsOnly?: boolean;
      maintenanceWindows?: Array<{ start: string; end: string }>;
    }
  ): Promise<SchedulingWindow[]> {
    const searchStart = preferredStart || new Date();
    const searchEnd = preferredEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Get existing maintenance records for the stand
    const existingRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        standId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledStart: { gte: searchStart },
        scheduledEnd: { lte: searchEnd },
      },
      orderBy: { scheduledStart: 'asc' },
    });

    const windows: SchedulingWindow[] = [];
    let currentTime = new Date(searchStart);

    // Generate potential windows
    while (currentTime < searchEnd) {
      const windowEnd = new Date(currentTime.getTime() + duration * 60 * 60 * 1000);

      // Check if window meets constraints
      if (this.meetsConstraints(currentTime, windowEnd, constraints)) {
        // Check for conflicts
        const conflicts = existingRecords.filter((record) =>
          this.isTimeOverlapping(currentTime, windowEnd, record.scheduledStart, record.scheduledEnd)
        );

        const score = this.calculateWindowScore(currentTime, windowEnd, conflicts, preferredStart);

        windows.push({
          start: new Date(currentTime),
          end: new Date(windowEnd),
          standId,
          available: conflicts.length === 0,
          conflicts: conflicts.map((c) => c.id),
          score,
        });
      }

      // Move to next potential window (1 hour increments)
      currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000);
    }

    // Sort by score (highest first)
    return windows.sort((a, b) => b.score - a.score);
  }

  /**
   * Optimize maintenance schedule using constraint satisfaction
   */
  async optimizeSchedule(
    organizationId: string,
    requests: MaintenanceScheduleRequest[]
  ): Promise<OptimizedSchedule[]> {
    const optimizedSchedules: OptimizedSchedule[] = [];

    // Sort requests by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const request of sortedRequests) {
      const duration =
        (request.scheduledEnd.getTime() - request.scheduledStart.getTime()) / (1000 * 60 * 60);

      // Find optimal windows
      const windows = await this.findOptimalSchedulingWindows(
        request.standId,
        duration,
        request.scheduledStart,
        request.scheduledEnd
      );

      if (windows.length === 0) {
        continue;
      }

      const bestWindow = windows[0];

      // Check resource allocation
      const resourceAllocation = await this.allocateResources(
        request,
        bestWindow.start,
        bestWindow.end
      );

      // Detect conflicts
      const conflicts = await this.detectSchedulingConflicts(
        request.standId,
        bestWindow.start,
        bestWindow.end
      );

      optimizedSchedules.push({
        standId: request.standId,
        scheduledStart: bestWindow.start,
        scheduledEnd: bestWindow.end,
        priority: this.getPriorityValue(request.priority),
        resourceAllocation,
        conflicts: conflicts ? [conflicts] : [],
        alternatives: windows.slice(1, 4), // Top 3 alternatives
      });
    }

    return optimizedSchedules;
  }

  /**
   * Allocate resources for maintenance
   */
  async allocateResources(
    request: MaintenanceScheduleRequest,
    startTime: Date,
    endTime: Date
  ): Promise<ResourceAllocation[]> {
    const allocations: ResourceAllocation[] = [];

    // Allocate technicians based on required skills
    if (request.requiredSkills && request.requiredSkills.length > 0) {
      for (const skill of request.requiredSkills) {
        const allocation = await this.allocateTechnician(skill, startTime, endTime);
        if (allocation) {
          allocations.push(allocation);
        }
      }
    }

    // Allocate equipment
    if (request.requiredEquipment && request.requiredEquipment.length > 0) {
      for (const equipment of request.requiredEquipment) {
        const allocation = await this.allocateEquipment(equipment, startTime, endTime);
        if (allocation) {
          allocations.push(allocation);
        }
      }
    }

    return allocations;
  }

  /**
   * Handle priority-based scheduling
   */
  async handlePriorityScheduling(
    organizationId: string,
    urgentRequest: MaintenanceScheduleRequest
  ): Promise<{
    scheduledTime: Date;
    preemptedRecords: string[];
    adjustedRecords: string[];
  }> {
    if (urgentRequest.priority !== 'URGENT') {
      throw new Error('Priority scheduling only available for URGENT requests');
    }

    const duration =
      (urgentRequest.scheduledEnd.getTime() - urgentRequest.scheduledStart.getTime()) /
      (1000 * 60 * 60);

    // Find conflicting records
    const conflictingRecords = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        standId: urgentRequest.standId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        OR: [
          {
            scheduledStart: { lte: urgentRequest.scheduledStart },
            scheduledEnd: { gte: urgentRequest.scheduledStart },
          },
          {
            scheduledStart: { lte: urgentRequest.scheduledEnd },
            scheduledEnd: { gte: urgentRequest.scheduledEnd },
          },
        ],
      },
      orderBy: { priority: 'asc' },
    });

    const preemptedRecords: string[] = [];
    const adjustedRecords: string[] = [];

    // Handle preemption based on priority
    for (const record of conflictingRecords) {
      if (record.priority === 'LOW' || record.priority === 'MEDIUM') {
        // Preempt lower priority maintenance
        await this.prisma.standMaintenanceRecord.update({
          where: { id: record.id },
          data: { status: 'POSTPONED' },
        });
        preemptedRecords.push(record.id);
      } else {
        // Try to adjust timing for same/higher priority
        const newStart = new Date(urgentRequest.scheduledEnd.getTime() + 60 * 60 * 1000); // 1 hour buffer
        const newEnd = new Date(
          newStart.getTime() + (record.scheduledEnd.getTime() - record.scheduledStart.getTime())
        );

        await this.prisma.standMaintenanceRecord.update({
          where: { id: record.id },
          data: {
            scheduledStart: newStart,
            scheduledEnd: newEnd,
          },
        });
        adjustedRecords.push(record.id);
      }
    }

    return {
      scheduledTime: urgentRequest.scheduledStart,
      preemptedRecords,
      adjustedRecords,
    };
  }

  /**
   * Generate maintenance reports
   */
  async generateMaintenanceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      totalScheduled: number;
      totalCompleted: number;
      totalCost: number;
      averageDuration: number;
      onTimeRate: number;
    };
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    costAnalysis: {
      budgetVariance: number;
      costPerHour: number;
      mostExpensiveType: string;
    };
    recommendations: string[];
  }> {
    const records = await this.prisma.standMaintenanceRecord.findMany({
      where: {
        stand: { organizationId },
        scheduledStart: { gte: startDate },
        scheduledEnd: { lte: endDate },
      },
      include: {
        stand: true,
      },
    });

    const completed = records.filter((r) => r.status === 'COMPLETED');
    const totalCost = completed.reduce((sum, r) => sum + (r.actualCost || 0), 0);
    const totalDuration = completed.reduce((sum, r) => {
      if (r.actualStart && r.actualEnd) {
        return sum + (r.actualEnd.getTime() - r.actualStart.getTime());
      }
      return sum;
    }, 0);

    const onTimeRecords = completed.filter(
      (r) => r.actualEnd && r.scheduledEnd && r.actualEnd <= r.scheduledEnd
    );

    // Group by type
    const byType: Record<string, number> = {};
    records.forEach((r) => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });

    // Group by priority
    const byPriority: Record<string, number> = {};
    records.forEach((r) => {
      byPriority[r.priority] = (byPriority[r.priority] || 0) + 1;
    });

    // Cost analysis
    const estimatedCost = records.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);
    const budgetVariance = ((totalCost - estimatedCost) / estimatedCost) * 100;
    const costPerHour = totalCost / (totalDuration / (1000 * 60 * 60));

    const costByType: Record<string, number> = {};
    completed.forEach((r) => {
      costByType[r.type] = (costByType[r.type] || 0) + (r.actualCost || 0);
    });
    const mostExpensiveType =
      Object.entries(costByType).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    // Generate recommendations
    const recommendations: string[] = [];
    if (budgetVariance > 20) {
      recommendations.push('Consider reviewing cost estimation methods');
    }
    if (onTimeRecords.length / completed.length < 0.8) {
      recommendations.push('Review scheduling practices to improve on-time completion');
    }
    if (byPriority.URGENT > records.length * 0.1) {
      recommendations.push('High number of urgent maintenance - consider preventive maintenance');
    }

    return {
      summary: {
        totalScheduled: records.length,
        totalCompleted: completed.length,
        totalCost,
        averageDuration: totalDuration / completed.length / (1000 * 60 * 60),
        onTimeRate: (onTimeRecords.length / completed.length) * 100,
      },
      byType,
      byPriority,
      costAnalysis: {
        budgetVariance,
        costPerHour,
        mostExpensiveType,
      },
      recommendations,
    };
  }

  // Private helper methods
  private generateConflictRecommendations(
    conflicts: Array<{ type: string; scheduledStart: Date; scheduledEnd: Date; priority: string }>,
    requestStart: Date,
    requestEnd: Date
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length === 1) {
      const conflict = conflicts[0];
      if (conflict.priority === 'LOW') {
        recommendations.push('Consider rescheduling the conflicting low-priority maintenance');
      } else {
        recommendations.push('Schedule before or after the conflicting maintenance window');
      }
    } else {
      recommendations.push('Multiple conflicts detected - consider alternative time slots');
      recommendations.push('Review maintenance scheduling to avoid clustering');
    }

    return recommendations;
  }

  private meetsConstraints(
    start: Date,
    end: Date,
    constraints?: {
      businessHours?: boolean;
      weekendsOnly?: boolean;
      maintenanceWindows?: Array<{ start: string; end: string }>;
    }
  ): boolean {
    if (!constraints) return true;

    // Business hours constraint (8 AM to 6 PM)
    if (constraints.businessHours) {
      const startHour = start.getHours();
      const endHour = end.getHours();
      if (startHour < 8 || endHour > 18) {
        return false;
      }
    }

    // Weekends only constraint
    if (constraints.weekendsOnly) {
      const startDay = start.getDay();
      const endDay = end.getDay();
      if (startDay !== 0 && startDay !== 6 && endDay !== 0 && endDay !== 6) {
        return false;
      }
    }

    // Maintenance windows constraint
    if (constraints.maintenanceWindows) {
      const timeString = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
      const inWindow = constraints.maintenanceWindows.some(
        (window) => timeString >= window.start && timeString <= window.end
      );
      if (!inWindow) {
        return false;
      }
    }

    return true;
  }

  private isTimeOverlapping(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  private calculateWindowScore(
    start: Date,
    end: Date,
    conflicts: Array<{ id: string }>,
    preferredStart?: Date
  ): number {
    let score = 100;

    // Penalize conflicts
    score -= conflicts.length * 30;

    // Prefer times closer to preferred start
    if (preferredStart) {
      const timeDiff = Math.abs(start.getTime() - preferredStart.getTime());
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      score -= daysDiff * 5;
    }

    // Prefer business hours
    const startHour = start.getHours();
    if (startHour >= 8 && startHour <= 17) {
      score += 20;
    }

    // Prefer weekdays
    const dayOfWeek = start.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      score += 10;
    }

    return Math.max(score, 0);
  }

  private getPriorityValue(priority: string): number {
    const priorityMap = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return priorityMap[priority as keyof typeof priorityMap] || 1;
  }

  private async allocateTechnician(
    skill: string,
    startTime: Date,
    endTime: Date
  ): Promise<ResourceAllocation | null> {
    // This would integrate with a resource management system
    // For now, return a mock allocation
    return {
      resourceId: `tech-${skill}-001`,
      resourceType: 'TECHNICIAN',
      allocatedFrom: startTime,
      allocatedTo: endTime,
      cost: 100, // per hour
      availability: 'AVAILABLE',
    };
  }

  private async allocateEquipment(
    equipment: string,
    startTime: Date,
    endTime: Date
  ): Promise<ResourceAllocation | null> {
    // This would integrate with equipment management system
    // For now, return a mock allocation
    return {
      resourceId: `equip-${equipment}-001`,
      resourceType: 'EQUIPMENT',
      allocatedFrom: startTime,
      allocatedTo: endTime,
      cost: 50, // per hour
      availability: 'AVAILABLE',
    };
  }
}
