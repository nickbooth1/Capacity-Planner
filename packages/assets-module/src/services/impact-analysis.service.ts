import { PrismaClient } from '@prisma/client';
import { AdjacencyService } from './adjacency.service';
import { MaintenanceService } from './maintenance.service';
import { EventEmitter } from 'events';

export interface ImpactAnalysisRequest {
  standId: string;
  impactType: 'MAINTENANCE' | 'CLOSURE' | 'RESTRICTION' | 'CAPACITY_CHANGE';
  startTime: Date;
  endTime: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description?: string;
  affectedOperations?: string[];
}

export interface MultiStandImpactAnalysis {
  primaryStand: {
    standId: string;
    identifier: string;
    directImpact: StandImpact;
  };
  secondaryStands: Array<{
    standId: string;
    identifier: string;
    distance: number;
    impactLevel: string;
    cascadingImpact: StandImpact;
  }>;
  totalImpact: {
    capacityReduction: number;
    revenueImpact: number;
    operationalComplexity: number;
    riskScore: number;
  };
  mitigationOptions: MitigationOption[];
  timeline: ImpactTimeline[];
}

export interface StandImpact {
  capacityReduction: number; // percentage
  revenueImpact: number; // currency
  operationalConstraints: string[];
  alternativeStands: string[];
  riskFactors: string[];
  mitigationCost: number;
}

export interface TemporalImpactModel {
  timeSlots: Array<{
    startTime: Date;
    endTime: Date;
    impactLevel: number; // 0-100
    affectedOperations: string[];
    resourceRequirements: string[];
  }>;
  peakImpactTime: Date;
  totalDuration: number; // hours
  recoveryTime: number; // hours
}

export interface MitigationOption {
  id: string;
  type: 'ALTERNATIVE_STAND' | 'OPERATIONAL_CHANGE' | 'RESOURCE_ALLOCATION' | 'DELAY_IMPACT';
  description: string;
  cost: number;
  effectiveness: number; // 0-100
  implementationTime: number; // hours
  requiredResources: string[];
  sideEffects: string[];
}

export interface ImpactTimeline {
  timestamp: Date;
  event: string;
  impactLevel: number;
  affectedStands: string[];
  mitigationActions: string[];
}

export interface ImpactNotification {
  id: string;
  type: 'IMPACT_DETECTED' | 'IMPACT_ESCALATED' | 'MITIGATION_REQUIRED' | 'IMPACT_RESOLVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  standId: string;
  standIdentifier: string;
  description: string;
  timestamp: Date;
  recipients: string[];
  actions: string[];
  metadata: any;
}

export interface ImpactMetrics {
  totalImpacts: number;
  averageImpactDuration: number;
  costPerImpact: number;
  mitigationEffectiveness: number;
  responseTime: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  trends: Array<{
    period: string;
    impactCount: number;
    averageCost: number;
  }>;
}

export class ImpactAnalysisService extends EventEmitter {
  private adjacencyService: AdjacencyService;
  private maintenanceService: MaintenanceService;
  private notificationListeners: Set<(notification: ImpactNotification) => void> = new Set();

  constructor(private prisma: PrismaClient) {
    super();
    this.adjacencyService = new AdjacencyService(prisma);
    this.maintenanceService = new MaintenanceService(prisma);
  }

  /**
   * Perform comprehensive multi-stand impact analysis
   */
  async analyzeMultiStandImpact(
    organizationId: string,
    request: ImpactAnalysisRequest
  ): Promise<MultiStandImpactAnalysis> {
    // Get primary stand information
    const primaryStand = await this.prisma.stand.findUnique({
      where: { id: request.standId },
      include: {
        adjacencies: {
          include: {
            adjacentStand: true,
          },
        },
        maintenanceRecords: {
          where: {
            status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          },
          orderBy: { scheduledStart: 'asc' },
        },
      },
    });

    if (!primaryStand || primaryStand.organizationId !== organizationId) {
      throw new Error('Stand not found');
    }

    // Calculate direct impact on primary stand
    const directImpact = await this.calculateStandImpact(primaryStand, request);

    // Calculate cascading impacts on adjacent stands
    const secondaryStands = await this.calculateCascadingImpacts(primaryStand.adjacencies, request);

    // Calculate total impact
    const totalImpact = this.calculateTotalImpact(
      directImpact,
      secondaryStands.map((s) => s.cascadingImpact)
    );

    // Generate mitigation options
    const mitigationOptions = await this.generateMitigationOptions(
      primaryStand,
      secondaryStands,
      request
    );

    // Create impact timeline
    const timeline = this.createImpactTimeline(request, directImpact, secondaryStands);

    const result: MultiStandImpactAnalysis = {
      primaryStand: {
        standId: primaryStand.id,
        identifier: primaryStand.identifier,
        directImpact,
      },
      secondaryStands,
      totalImpact,
      mitigationOptions,
      timeline,
    };

    // Send impact notification
    await this.sendImpactNotification({
      id: `impact-${Date.now()}`,
      type: 'IMPACT_DETECTED',
      priority: this.mapSeverityToPriority(request.severity),
      standId: request.standId,
      standIdentifier: primaryStand.identifier,
      description: `${request.impactType} impact detected with ${request.severity} severity`,
      timestamp: new Date(),
      recipients: [], // Would be populated based on organization settings
      actions: mitigationOptions.slice(0, 3).map((m) => m.description),
      metadata: {
        impactType: request.impactType,
        severity: request.severity,
        totalImpact,
      },
    });

    return result;
  }

  /**
   * Create temporal impact model
   */
  async createTemporalImpactModel(
    standId: string,
    organizationId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TemporalImpactModel> {
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const timeSlots: TemporalImpactModel['timeSlots'] = [];

    // Create hourly time slots
    let currentTime = new Date(startTime);
    while (currentTime < endTime) {
      const slotEnd = new Date(Math.min(currentTime.getTime() + 60 * 60 * 1000, endTime.getTime()));

      const impactLevel = this.calculateTimeSlotImpact(currentTime, slotEnd, standId);

      timeSlots.push({
        startTime: new Date(currentTime),
        endTime: new Date(slotEnd),
        impactLevel,
        affectedOperations: this.getAffectedOperations(currentTime, standId),
        resourceRequirements: this.getResourceRequirements(currentTime, standId),
      });

      currentTime = slotEnd;
    }

    // Find peak impact time
    const peakSlot = timeSlots.reduce((max, slot) =>
      slot.impactLevel > max.impactLevel ? slot : max
    );

    // Calculate recovery time (simplified)
    const recoveryTime = duration * 0.2; // 20% of impact duration

    return {
      timeSlots,
      peakImpactTime: peakSlot.startTime,
      totalDuration: duration,
      recoveryTime,
    };
  }

  /**
   * Generate mitigation suggestions
   */
  async generateMitigationSuggestions(
    standId: string,
    organizationId: string,
    impactAnalysis: MultiStandImpactAnalysis
  ): Promise<MitigationOption[]> {
    const suggestions: MitigationOption[] = [];

    // Alternative stand suggestions
    const alternativeStands = await this.findAlternativeStands(
      standId,
      organizationId,
      impactAnalysis.primaryStand.directImpact
    );

    alternativeStands.forEach((alt, index) => {
      suggestions.push({
        id: `alt-stand-${index}`,
        type: 'ALTERNATIVE_STAND',
        description: `Use stand ${alt.identifier} as alternative`,
        cost: alt.switchingCost,
        effectiveness: alt.suitabilityScore,
        implementationTime: 2,
        requiredResources: ['Ground crew', 'Coordination'],
        sideEffects: alt.limitations,
      });
    });

    // Operational change suggestions
    if (impactAnalysis.totalImpact.capacityReduction > 50) {
      suggestions.push({
        id: 'reduce-operations',
        type: 'OPERATIONAL_CHANGE',
        description: 'Reduce operations during peak impact hours',
        cost: impactAnalysis.totalImpact.revenueImpact * 0.3,
        effectiveness: 70,
        implementationTime: 1,
        requiredResources: ['Operations team'],
        sideEffects: ['Reduced capacity', 'Potential delays'],
      });
    }

    // Resource allocation suggestions
    if (impactAnalysis.secondaryStands.length > 2) {
      suggestions.push({
        id: 'additional-resources',
        type: 'RESOURCE_ALLOCATION',
        description: 'Deploy additional ground support resources',
        cost: 5000,
        effectiveness: 60,
        implementationTime: 4,
        requiredResources: ['Additional staff', 'Equipment'],
        sideEffects: ['Increased operational costs'],
      });
    }

    // Delay impact suggestions
    suggestions.push({
      id: 'delay-impact',
      type: 'DELAY_IMPACT',
      description: 'Reschedule impact to off-peak hours',
      cost: 2000,
      effectiveness: 80,
      implementationTime: 8,
      requiredResources: ['Scheduling coordination'],
      sideEffects: ['Delayed resolution', 'Scheduling conflicts'],
    });

    return suggestions.sort((a, b) => b.effectiveness - a.effectiveness);
  }

  /**
   * Implement real-time impact notifications
   */
  async setupRealTimeNotifications(
    organizationId: string,
    thresholds: {
      capacityReduction: number;
      revenueImpact: number;
      riskScore: number;
    }
  ): Promise<void> {
    // Set up monitoring for real-time impacts
    setInterval(async () => {
      await this.monitorActiveImpacts(organizationId, thresholds);
    }, 60000); // Check every minute

    // Set up maintenance-based impact detection
    this.maintenanceService.addNotificationListener((notification) => {
      if (notification.type === 'STARTED') {
        this.handleMaintenanceImpact(notification, organizationId);
      }
    });
  }

  /**
   * Generate scheduled impact reports
   */
  async generateScheduledReport(
    organizationId: string,
    reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: ImpactMetrics;
    detailedAnalysis: Array<{
      standId: string;
      impactCount: number;
      averageImpact: number;
      costImpact: number;
      trends: string[];
    }>;
    recommendations: string[];
  }> {
    const impacts = await this.getHistoricalImpacts(organizationId, startDate, endDate);

    const summary = this.calculateImpactMetrics(impacts);
    const detailedAnalysis = this.generateDetailedAnalysis(impacts);
    const recommendations = this.generateReportRecommendations(summary, detailedAnalysis);

    return {
      summary,
      detailedAnalysis,
      recommendations,
    };
  }

  /**
   * Set up alert thresholds
   */
  async setupAlertThresholds(
    organizationId: string,
    thresholds: {
      capacityReduction: { warning: number; critical: number };
      revenueImpact: { warning: number; critical: number };
      cascadingImpacts: { warning: number; critical: number };
    }
  ): Promise<void> {
    // Store thresholds in database or cache
    await this.prisma.standCapabilitySnapshot.create({
      data: {
        standId: 'system-config',
        capabilities: {
          impactThresholds: thresholds,
        },
        userId: 'system',
      },
    });

    // Set up monitoring with these thresholds
    this.setupThresholdMonitoring(organizationId, thresholds);
  }

  /**
   * Add impact metrics for monitoring
   */
  getImpactMetrics(organizationId: string): Promise<ImpactMetrics> {
    return this.calculateOrganizationImpactMetrics(organizationId);
  }

  // Private helper methods

  private async calculateStandImpact(
    stand: any,
    request: ImpactAnalysisRequest
  ): Promise<StandImpact> {
    const baseCapacityReduction = this.getBaseCapacityReduction(request);
    const revenueImpact = this.calculateRevenueImpact(stand, baseCapacityReduction);
    const operationalConstraints = this.getOperationalConstraints(request);
    const alternativeStands = await this.findNearbyStands(stand.id, stand.organizationId);
    const riskFactors = this.identifyRiskFactors(stand, request);
    const mitigationCost = this.calculateMitigationCost(request);

    return {
      capacityReduction: baseCapacityReduction,
      revenueImpact,
      operationalConstraints,
      alternativeStands: alternativeStands.map((s) => s.id),
      riskFactors,
      mitigationCost,
    };
  }

  private async calculateCascadingImpacts(
    adjacencies: any[],
    request: ImpactAnalysisRequest
  ): Promise<
    Array<{
      standId: string;
      identifier: string;
      distance: number;
      impactLevel: string;
      cascadingImpact: StandImpact;
    }>
  > {
    const results = [];

    for (const adjacency of adjacencies) {
      const cascadingImpact = await this.calculateCascadingImpact(adjacency, request);

      results.push({
        standId: adjacency.adjacentStandId,
        identifier: adjacency.adjacentStand.identifier,
        distance: adjacency.distance,
        impactLevel: adjacency.impactLevel,
        cascadingImpact,
      });
    }

    return results;
  }

  private async calculateCascadingImpact(
    adjacency: any,
    request: ImpactAnalysisRequest
  ): Promise<StandImpact> {
    const impactMultiplier = this.getImpactMultiplier(adjacency.impactLevel);
    const distanceMultiplier = this.getDistanceMultiplier(adjacency.distance);

    const baseImpact = this.getBaseCapacityReduction(request);
    const cascadingReduction = baseImpact * impactMultiplier * distanceMultiplier;

    return {
      capacityReduction: cascadingReduction,
      revenueImpact: cascadingReduction * 500, // Simplified calculation
      operationalConstraints: adjacency.operationalConstraints,
      alternativeStands: [],
      riskFactors: [`Cascading impact from ${adjacency.impactLevel} adjacent stand`],
      mitigationCost: cascadingReduction * 100,
    };
  }

  private calculateTotalImpact(directImpact: StandImpact, cascadingImpacts: StandImpact[]) {
    const totalCapacityReduction =
      directImpact.capacityReduction +
      cascadingImpacts.reduce((sum, impact) => sum + impact.capacityReduction, 0);

    const totalRevenueImpact =
      directImpact.revenueImpact +
      cascadingImpacts.reduce((sum, impact) => sum + impact.revenueImpact, 0);

    const operationalComplexity = (cascadingImpacts.length + 1) * 10;
    const riskScore = Math.min(totalCapacityReduction + operationalComplexity, 100);

    return {
      capacityReduction: totalCapacityReduction,
      revenueImpact: totalRevenueImpact,
      operationalComplexity,
      riskScore,
    };
  }

  private async generateMitigationOptions(
    primaryStand: any,
    secondaryStands: any[],
    request: ImpactAnalysisRequest
  ): Promise<MitigationOption[]> {
    // Implementation would generate context-specific mitigation options
    return [];
  }

  private createImpactTimeline(
    request: ImpactAnalysisRequest,
    directImpact: StandImpact,
    secondaryStands: any[]
  ): ImpactTimeline[] {
    const timeline: ImpactTimeline[] = [];

    // Add initial impact event
    timeline.push({
      timestamp: request.startTime,
      event: `${request.impactType} begins`,
      impactLevel: directImpact.capacityReduction,
      affectedStands: [request.standId],
      mitigationActions: [],
    });

    // Add cascading impacts
    secondaryStands.forEach((stand, index) => {
      const delay = index * 30 * 60 * 1000; // 30 minutes delay between cascading impacts
      timeline.push({
        timestamp: new Date(request.startTime.getTime() + delay),
        event: `Cascading impact on stand ${stand.identifier}`,
        impactLevel: stand.cascadingImpact.capacityReduction,
        affectedStands: [stand.standId],
        mitigationActions: [],
      });
    });

    // Add resolution event
    timeline.push({
      timestamp: request.endTime,
      event: `${request.impactType} ends`,
      impactLevel: 0,
      affectedStands: [request.standId],
      mitigationActions: ['Normal operations resumed'],
    });

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async sendImpactNotification(notification: ImpactNotification): Promise<void> {
    // Send to all registered listeners
    this.notificationListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in impact notification listener:', error);
      }
    });

    // Emit event for real-time updates
    this.emit('impactNotification', notification);
  }

  private getBaseCapacityReduction(request: ImpactAnalysisRequest): number {
    const severityMultipliers = {
      LOW: 0.1,
      MEDIUM: 0.3,
      HIGH: 0.6,
      CRITICAL: 0.9,
    };

    const typeMultipliers = {
      MAINTENANCE: 0.5,
      CLOSURE: 1.0,
      RESTRICTION: 0.3,
      CAPACITY_CHANGE: 0.4,
    };

    return severityMultipliers[request.severity] * typeMultipliers[request.impactType] * 100;
  }

  private calculateRevenueImpact(stand: any, capacityReduction: number): number {
    // Simplified revenue calculation
    const baseRevenue = 10000; // per day
    const duration = 24; // hours
    return (baseRevenue / 24) * duration * (capacityReduction / 100);
  }

  private getOperationalConstraints(request: ImpactAnalysisRequest): string[] {
    const constraints = [];

    if (request.impactType === 'MAINTENANCE') {
      constraints.push('Reduced ground operations', 'Equipment restrictions');
    }

    if (request.severity === 'HIGH' || request.severity === 'CRITICAL') {
      constraints.push('Emergency protocols active', 'Increased coordination required');
    }

    return constraints;
  }

  private async findNearbyStands(standId: string, organizationId: string): Promise<any[]> {
    return await this.prisma.stand.findMany({
      where: {
        organizationId,
        id: { not: standId },
      },
      take: 3,
    });
  }

  private identifyRiskFactors(stand: any, request: ImpactAnalysisRequest): string[] {
    const factors = [];

    if (request.severity === 'CRITICAL') {
      factors.push('Critical severity impact');
    }

    if (stand.adjacencies.length > 3) {
      factors.push('High adjacency count');
    }

    return factors;
  }

  private calculateMitigationCost(request: ImpactAnalysisRequest): number {
    const baseCosts = {
      MAINTENANCE: 5000,
      CLOSURE: 15000,
      RESTRICTION: 3000,
      CAPACITY_CHANGE: 8000,
    };

    return baseCosts[request.impactType] || 5000;
  }

  private getImpactMultiplier(impactLevel: string): number {
    const multipliers = { LOW: 0.1, MEDIUM: 0.3, HIGH: 0.6 };
    return multipliers[impactLevel as keyof typeof multipliers] || 0.1;
  }

  private getDistanceMultiplier(distance: number): number {
    if (distance < 50) return 0.8;
    if (distance < 100) return 0.5;
    if (distance < 200) return 0.3;
    return 0.1;
  }

  private calculateTimeSlotImpact(startTime: Date, endTime: Date, standId: string): number {
    // Simplified impact calculation based on time of day
    const hour = startTime.getHours();

    // Higher impact during peak hours
    if (hour >= 7 && hour <= 9) return 80; // Morning peak
    if (hour >= 17 && hour <= 19) return 85; // Evening peak
    if (hour >= 10 && hour <= 16) return 60; // Daytime
    return 30; // Off-peak
  }

  private getAffectedOperations(time: Date, standId: string): string[] {
    const hour = time.getHours();
    const operations = [];

    if (hour >= 6 && hour <= 22) {
      operations.push('Aircraft movements', 'Ground support');
    }
    if (hour >= 7 && hour <= 19) {
      operations.push('Passenger operations', 'Cargo handling');
    }

    return operations;
  }

  private getResourceRequirements(time: Date, standId: string): string[] {
    return ['Ground crew', 'Coordination staff', 'Equipment'];
  }

  private async findAlternativeStands(
    standId: string,
    organizationId: string,
    impact: StandImpact
  ): Promise<any[]> {
    // Mock implementation - would find suitable alternatives
    return [];
  }

  private mapSeverityToPriority(severity: string): ImpactNotification['priority'] {
    const mapping = {
      LOW: 'LOW' as const,
      MEDIUM: 'MEDIUM' as const,
      HIGH: 'HIGH' as const,
      CRITICAL: 'CRITICAL' as const,
    };
    return mapping[severity as keyof typeof mapping] || 'LOW';
  }

  private async monitorActiveImpacts(organizationId: string, thresholds: any): Promise<void> {
    // Implementation would monitor for threshold breaches
  }

  private async handleMaintenanceImpact(notification: any, organizationId: string): Promise<void> {
    // Implementation would handle maintenance-triggered impacts
  }

  private async getHistoricalImpacts(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Implementation would fetch historical impact data
    return [];
  }

  private calculateImpactMetrics(impacts: any[]): ImpactMetrics {
    // Implementation would calculate comprehensive metrics
    return {
      totalImpacts: impacts.length,
      averageImpactDuration: 0,
      costPerImpact: 0,
      mitigationEffectiveness: 0,
      responseTime: 0,
      byType: {},
      bySeverity: {},
      trends: [],
    };
  }

  private generateDetailedAnalysis(impacts: any[]): any[] {
    // Implementation would generate detailed analysis
    return [];
  }

  private generateReportRecommendations(summary: ImpactMetrics, analysis: any[]): string[] {
    // Implementation would generate recommendations
    return [];
  }

  private setupThresholdMonitoring(organizationId: string, thresholds: any): void {
    // Implementation would set up threshold monitoring
  }

  private async calculateOrganizationImpactMetrics(organizationId: string): Promise<ImpactMetrics> {
    // Implementation would calculate organization-wide metrics
    return {
      totalImpacts: 0,
      averageImpactDuration: 0,
      costPerImpact: 0,
      mitigationEffectiveness: 0,
      responseTime: 0,
      byType: {},
      bySeverity: {},
      trends: [],
    };
  }

  /**
   * Add notification listener
   */
  addNotificationListener(listener: (notification: ImpactNotification) => void): void {
    this.notificationListeners.add(listener);
  }

  /**
   * Remove notification listener
   */
  removeNotificationListener(listener: (notification: ImpactNotification) => void): void {
    this.notificationListeners.delete(listener);
  }
}
