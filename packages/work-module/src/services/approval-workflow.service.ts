import { PrismaClient } from '@prisma/client';
import {
  WorkRequestStatus,
  Priority,
  WorkType,
  ApprovalLevel,
  ApprovalStatus,
  ApprovalEntry,
  ApprovalChainEntry,
  ApproverInfo,
} from '../index';

export interface ApprovalRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  conditions: ApprovalCondition[];
  approvers: ApprovalStep[];
  isActive: boolean;
  priority: number;
}

export interface ApprovalCondition {
  field: string;
  operator: 'equals' | 'in' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface ApprovalStep {
  level: ApprovalLevel;
  approvers: string[]; // User IDs
  requiredApprovals: number;
  timeoutHours?: number;
  canDelegate: boolean;
  isParallel: boolean;
  order: number;
}

export interface ApprovalDecision {
  decision: 'approve' | 'reject' | 'delegate';
  comments?: string;
  conditions?: string;
  delegatedTo?: string;
}

export class ApprovalWorkflowService {
  constructor(private prisma: PrismaClient) {}

  async initializeApprovalWorkflow(
    workRequestId: string,
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean; data?: ApprovalChainEntry[]; error?: string }> {
    try {
      // Get work request details
      const workRequest = await this.prisma.workRequest.findUnique({
        where: { id: workRequestId },
      });

      if (!workRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      // Determine approval rules based on work request criteria
      const approvalRules = await this.getApplicableApprovalRules(workRequest, organizationId);

      if (approvalRules.length === 0) {
        // No approval required
        return {
          success: true,
          data: [],
        };
      }

      // Create approval chain
      const approvalChain = await this.createApprovalChain(workRequestId, approvalRules, userId);

      // Update work request to require approval
      await this.prisma.workRequest.update({
        where: { id: workRequestId },
        data: {
          approvalRequired: true,
          approvalLevel: this.determineApprovalLevel(approvalRules),
          currentApproverId: approvalChain[0]?.approverId || null,
          approvalDeadline: this.calculateApprovalDeadline(approvalRules),
        },
      });

      return {
        success: true,
        data: approvalChain,
      };
    } catch (error) {
      console.error('Error initializing approval workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async processApprovalDecision(
    workRequestId: string,
    approverId: string,
    decision: ApprovalDecision
  ): Promise<{
    success: boolean;
    data?: { nextApprover?: ApproverInfo; workRequestStatus: WorkRequestStatus };
    error?: string;
  }> {
    try {
      // Get current approval record
      const currentApproval = await this.prisma.workRequestApproval.findFirst({
        where: {
          workRequestId,
          approverId,
          status: ApprovalStatus.PENDING,
        },
      });

      if (!currentApproval) {
        return {
          success: false,
          error: 'No pending approval found for this user',
        };
      }

      // Update approval record
      const updatedApproval = await this.prisma.workRequestApproval.update({
        where: { id: currentApproval.id },
        data: {
          status:
            decision.decision === 'approve'
              ? ApprovalStatus.APPROVED
              : decision.decision === 'reject'
                ? ApprovalStatus.REJECTED
                : ApprovalStatus.DELEGATED,
          decisionDate: new Date(),
          comments: decision.comments,
          conditions: decision.conditions,
          delegatedTo: decision.delegatedTo,
        },
      });

      // Handle delegation
      if (decision.decision === 'delegate' && decision.delegatedTo) {
        await this.delegateApproval(currentApproval.id, decision.delegatedTo, approverId);
      }

      // Check if this approval step is complete
      const approvalStepComplete = await this.isApprovalStepComplete(
        workRequestId,
        currentApproval.sequenceOrder
      );

      let nextApprover: ApproverInfo | undefined;
      let workRequestStatus: WorkRequestStatus;

      if (decision.decision === 'reject') {
        // Rejection - update work request status
        workRequestStatus = WorkRequestStatus.REJECTED;
        await this.updateWorkRequestStatus(workRequestId, workRequestStatus, approverId);
      } else if (approvalStepComplete) {
        // Check if there are more approval steps
        const nextApprovalStep = await this.getNextApprovalStep(
          workRequestId,
          currentApproval.sequenceOrder
        );

        if (nextApprovalStep) {
          // Move to next approval step
          nextApprover = await this.getApproverInfo(nextApprovalStep.approverId);
          workRequestStatus = WorkRequestStatus.UNDER_REVIEW;

          await this.prisma.workRequest.update({
            where: { id: workRequestId },
            data: {
              currentApproverId: nextApprovalStep.approverId,
            },
          });
        } else {
          // All approvals complete - approve the request
          workRequestStatus = WorkRequestStatus.APPROVED;
          await this.updateWorkRequestStatus(workRequestId, workRequestStatus, approverId);
        }
      } else {
        // Current step not complete, stay in review
        workRequestStatus = WorkRequestStatus.UNDER_REVIEW;
      }

      return {
        success: true,
        data: {
          nextApprover,
          workRequestStatus,
        },
      };
    } catch (error) {
      console.error('Error processing approval decision:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getApprovalChain(
    workRequestId: string
  ): Promise<{ success: boolean; data?: ApprovalChainEntry[]; error?: string }> {
    try {
      const approvals = await this.prisma.workRequestApproval.findMany({
        where: { workRequestId },
        orderBy: { sequenceOrder: 'asc' },
      });

      const approvalChain: ApprovalChainEntry[] = approvals.map((approval) => ({
        id: approval.id,
        approverId: approval.approverId,
        approverName: approval.approverName,
        approverRole: approval.approverRole,
        approvalLevel: approval.approvalLevel,
        sequenceOrder: approval.sequenceOrder,
        status: approval.status,
        decisionDate: approval.decisionDate,
        comments: approval.comments,
        conditions: approval.conditions,
        delegatedTo: approval.delegatedTo,
        isRequired: approval.isRequired,
        timeoutDate: approval.timeoutDate,
      }));

      return {
        success: true,
        data: approvalChain,
      };
    } catch (error) {
      console.error('Error getting approval chain:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getPendingApprovals(
    organizationId: string,
    approverId?: string
  ): Promise<{ success: boolean; data?: ApprovalEntry[]; error?: string }> {
    try {
      const whereClause: any = {
        workRequest: {
          organizationId,
        },
        status: ApprovalStatus.PENDING,
      };

      if (approverId) {
        whereClause.approverId = approverId;
      }

      const pendingApprovals = await this.prisma.workRequestApproval.findMany({
        where: whereClause,
        include: {
          workRequest: {
            select: {
              id: true,
              title: true,
              priority: true,
              workType: true,
              assetCode: true,
              requestorName: true,
              submissionDate: true,
              estimatedTotalCost: true,
            },
          },
        },
        orderBy: [{ workRequest: { priority: 'desc' } }, { timeoutDate: 'asc' }],
      });

      const approvalEntries: ApprovalEntry[] = pendingApprovals.map((approval) => ({
        id: approval.id,
        workRequestId: approval.workRequestId,
        workRequestTitle: approval.workRequest.title,
        workRequestPriority: approval.workRequest.priority,
        workRequestType: approval.workRequest.workType,
        assetCode: approval.workRequest.assetCode,
        requestorName: approval.workRequest.requestorName,
        submissionDate: approval.workRequest.submissionDate,
        estimatedCost: approval.workRequest.estimatedTotalCost,
        approverId: approval.approverId,
        approverName: approval.approverName,
        approverRole: approval.approverRole,
        approvalLevel: approval.approvalLevel,
        sequenceOrder: approval.sequenceOrder,
        status: approval.status,
        isRequired: approval.isRequired,
        timeoutDate: approval.timeoutDate,
        createdAt: approval.createdAt,
      }));

      return {
        success: true,
        data: approvalEntries,
      };
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getApprovalStatistics(
    organizationId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const whereClause: any = {
        workRequest: {
          organizationId,
        },
      };

      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.start,
          lte: dateRange.end,
        };
      }

      const [totalApprovals, approvalsByStatus, approvalsByLevel, averageApprovalTime] =
        await Promise.all([
          this.prisma.workRequestApproval.count({ where: whereClause }),
          this.prisma.workRequestApproval.groupBy({
            by: ['status'],
            where: whereClause,
            _count: { id: true },
          }),
          this.prisma.workRequestApproval.groupBy({
            by: ['approvalLevel'],
            where: whereClause,
            _count: { id: true },
          }),
          this.calculateAverageApprovalTime(organizationId, dateRange),
        ]);

      const statistics = {
        totalApprovals,
        byStatus: approvalsByStatus.reduce(
          (acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
          },
          {} as Record<string, number>
        ),
        byLevel: approvalsByLevel.reduce(
          (acc, item) => {
            acc[item.approvalLevel] = item._count.id;
            return acc;
          },
          {} as Record<string, number>
        ),
        averageApprovalTimeHours: averageApprovalTime,
      };

      return {
        success: true,
        data: statistics,
      };
    } catch (error) {
      console.error('Error getting approval statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getApplicableApprovalRules(
    workRequest: any,
    organizationId: string
  ): Promise<ApprovalRule[]> {
    // This would typically fetch from a database table
    // For now, return hardcoded rules based on work request criteria
    const rules: ApprovalRule[] = [];

    // Rule 1: High priority or critical requests require elevated approval
    if (workRequest.priority === Priority.HIGH || workRequest.priority === Priority.CRITICAL) {
      rules.push({
        id: 'high-priority-rule',
        organizationId,
        name: 'High Priority Approval',
        description: 'High and critical priority requests require manager approval',
        conditions: [
          { field: 'priority', operator: 'in', value: [Priority.HIGH, Priority.CRITICAL] },
        ],
        approvers: [
          {
            level: ApprovalLevel.ELEVATED,
            approvers: ['manager-1', 'manager-2'],
            requiredApprovals: 1,
            timeoutHours: 24,
            canDelegate: true,
            isParallel: false,
            order: 1,
          },
        ],
        isActive: true,
        priority: 1,
      });
    }

    // Rule 2: High cost requests require financial approval
    if (workRequest.estimatedTotalCost && workRequest.estimatedTotalCost > 10000) {
      rules.push({
        id: 'high-cost-rule',
        organizationId,
        name: 'High Cost Approval',
        description: 'Requests over $10,000 require financial approval',
        conditions: [{ field: 'estimatedTotalCost', operator: 'greater_than', value: 10000 }],
        approvers: [
          {
            level: ApprovalLevel.EXECUTIVE,
            approvers: ['finance-manager'],
            requiredApprovals: 1,
            timeoutHours: 48,
            canDelegate: false,
            isParallel: false,
            order: 2,
          },
        ],
        isActive: true,
        priority: 2,
      });
    }

    // Rule 3: Emergency work requires immediate approval
    if (workRequest.workType === WorkType.EMERGENCY) {
      rules.push({
        id: 'emergency-rule',
        organizationId,
        name: 'Emergency Work Approval',
        description: 'Emergency work requires immediate supervisor approval',
        conditions: [{ field: 'workType', operator: 'equals', value: WorkType.EMERGENCY }],
        approvers: [
          {
            level: ApprovalLevel.STANDARD,
            approvers: ['supervisor-1', 'supervisor-2'],
            requiredApprovals: 1,
            timeoutHours: 2,
            canDelegate: true,
            isParallel: true,
            order: 1,
          },
        ],
        isActive: true,
        priority: 0,
      });
    }

    return rules.sort((a, b) => a.priority - b.priority);
  }

  private async createApprovalChain(
    workRequestId: string,
    approvalRules: ApprovalRule[],
    userId: string
  ): Promise<ApprovalChainEntry[]> {
    const approvalChain: ApprovalChainEntry[] = [];
    let sequenceOrder = 1;

    for (const rule of approvalRules) {
      for (const step of rule.approvers) {
        for (const approverId of step.approvers) {
          const approverInfo = await this.getApproverInfo(approverId);

          const approval = await this.prisma.workRequestApproval.create({
            data: {
              workRequestId,
              approverId,
              approverName: approverInfo.name,
              approverRole: approverInfo.role,
              approvalLevel: step.level,
              sequenceOrder,
              status: ApprovalStatus.PENDING,
              isRequired: true,
              timeoutDate: step.timeoutHours
                ? new Date(Date.now() + step.timeoutHours * 60 * 60 * 1000)
                : null,
            },
          });

          approvalChain.push({
            id: approval.id,
            approverId: approval.approverId,
            approverName: approval.approverName,
            approverRole: approval.approverRole,
            approvalLevel: approval.approvalLevel,
            sequenceOrder: approval.sequenceOrder,
            status: approval.status,
            isRequired: approval.isRequired,
            timeoutDate: approval.timeoutDate,
          });
        }

        if (!step.isParallel) {
          sequenceOrder++;
        }
      }

      if (rule.approvers.some((step) => step.isParallel)) {
        sequenceOrder++;
      }
    }

    return approvalChain;
  }

  private async getApproverInfo(approverId: string): Promise<ApproverInfo> {
    // This would typically fetch from a user service
    // For now, return mock data
    return {
      id: approverId,
      name: `Approver ${approverId}`,
      role: 'Manager',
      email: `${approverId}@company.com`,
      department: 'Operations',
    };
  }

  private determineApprovalLevel(approvalRules: ApprovalRule[]): ApprovalLevel {
    const levels = approvalRules.flatMap((rule) => rule.approvers.map((step) => step.level));

    if (levels.includes(ApprovalLevel.EXECUTIVE)) {
      return ApprovalLevel.EXECUTIVE;
    } else if (levels.includes(ApprovalLevel.ELEVATED)) {
      return ApprovalLevel.ELEVATED;
    } else {
      return ApprovalLevel.STANDARD;
    }
  }

  private calculateApprovalDeadline(approvalRules: ApprovalRule[]): Date {
    const maxTimeoutHours = Math.max(
      ...approvalRules.flatMap((rule) => rule.approvers.map((step) => step.timeoutHours || 24))
    );

    return new Date(Date.now() + maxTimeoutHours * 60 * 60 * 1000);
  }

  private async isApprovalStepComplete(
    workRequestId: string,
    sequenceOrder: number
  ): Promise<boolean> {
    const stepApprovals = await this.prisma.workRequestApproval.findMany({
      where: {
        workRequestId,
        sequenceOrder,
        isRequired: true,
      },
    });

    return stepApprovals.every((approval) => approval.status === ApprovalStatus.APPROVED);
  }

  private async getNextApprovalStep(
    workRequestId: string,
    currentSequenceOrder: number
  ): Promise<any> {
    return await this.prisma.workRequestApproval.findFirst({
      where: {
        workRequestId,
        sequenceOrder: { gt: currentSequenceOrder },
        status: ApprovalStatus.PENDING,
      },
      orderBy: { sequenceOrder: 'asc' },
    });
  }

  private async delegateApproval(
    approvalId: string,
    delegatedTo: string,
    delegatedBy: string
  ): Promise<void> {
    const delegateInfo = await this.getApproverInfo(delegatedTo);

    await this.prisma.workRequestApproval.update({
      where: { id: approvalId },
      data: {
        approverId: delegatedTo,
        approverName: delegateInfo.name,
        approverRole: delegateInfo.role,
        status: ApprovalStatus.PENDING,
        delegatedTo: null,
        decisionDate: null,
      },
    });
  }

  private async updateWorkRequestStatus(
    workRequestId: string,
    status: WorkRequestStatus,
    userId: string
  ): Promise<void> {
    await this.prisma.workRequest.update({
      where: { id: workRequestId },
      data: {
        status,
        updatedBy: userId,
        ...(status === WorkRequestStatus.APPROVED && { approvedDate: new Date() }),
      },
    });
  }

  private async calculateAverageApprovalTime(
    organizationId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<number> {
    // This would calculate the average time between submission and approval
    // For now, return a mock value
    return 18.5; // hours
  }
}
