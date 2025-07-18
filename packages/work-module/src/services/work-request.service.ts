import { PrismaClient } from '@prisma/client';
import {
  WorkRequest,
  CreateWorkRequestRequest,
  UpdateWorkRequestRequest,
  WorkRequestFilters,
  WorkRequestSummary,
  GetWorkRequestsResponse,
  ValidationResponse,
  ValidationResult,
  WorkRequestStatus,
  Priority,
  Urgency,
  WorkType,
  AssetType,
  ImpactLevel,
} from '../index';

export class WorkRequestService {
  constructor(private prisma: PrismaClient) {}

  async createWorkRequest(
    organizationId: string,
    userId: string,
    data: CreateWorkRequestRequest
  ): Promise<{
    success: boolean;
    data?: WorkRequest;
    error?: string;
    validationResults?: ValidationResult[];
  }> {
    try {
      // Validate the request data
      const validation = await this.validateWorkRequest(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Validation failed',
          validationResults: validation.validationResults,
        };
      }

      // Get user information for requestor fields
      const user = await this.getUserInfo(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Get asset information
      const asset = await this.getAssetInfo(data.assetId, data.assetType || AssetType.STAND);
      if (!asset) {
        return {
          success: false,
          error: 'Asset not found or not accessible',
        };
      }

      // Create the work request
      const workRequest = await this.prisma.workRequest.create({
        data: {
          organizationId,
          assetId: data.assetId,
          assetType: data.assetType || AssetType.STAND,
          assetSchema: 'assets', // Default for now
          assetCode: asset.code,
          assetName: asset.name,
          assetLocation: asset.location,
          assetMetadata: asset.metadata || {},
          workType: data.workType,
          category: data.category,
          priority: data.priority,
          urgency: data.urgency,
          impactLevel: data.impactLevel,
          title: data.title,
          description: data.description,
          locationDetails: data.locationDetails,
          safetyConsiderations: data.safetyConsiderations,
          requestedStartDate: data.requestedStartDate,
          requestedEndDate: data.requestedEndDate,
          estimatedDurationMinutes: data.estimatedDurationMinutes,
          deadline: data.deadline,
          preferredTimeWindows: data.preferredTimeWindows || [],
          blackoutPeriods: data.blackoutPeriods || [],
          seasonalConstraints: data.seasonalConstraints || {},
          estimatedPersonnelCount: data.estimatedPersonnelCount,
          requiredSkills: data.requiredSkills || [],
          requiredEquipment: data.requiredEquipment || [],
          estimatedMaterialsCost: data.estimatedMaterialsCost,
          budgetCode: data.budgetCode,
          estimatedTotalCost: data.estimatedTotalCost,
          costCenter: data.costCenter,
          purchaseOrderNumber: data.purchaseOrderNumber,
          vendorInformation: data.vendorInformation || {},
          requestedBy: userId,
          requestorName: user.name,
          requestorEmail: user.email,
          requestorPhone: user.phone,
          department: user.department,
          primaryContactId: data.primaryContactId,
          secondaryContactId: data.secondaryContactId,
          regulatoryApprovalRequired: data.regulatoryApprovalRequired || false,
          regulatoryReference: data.regulatoryReference,
          complianceNotes: data.complianceNotes,
          templateId: data.templateId,
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
          status: WorkRequestStatus.DRAFT,
        },
        include: {
          statusHistory: true,
          comments: true,
          approvals: true,
          attachmentFiles: true,
          standAssociations: true,
          assetAssociations: true,
        },
      });

      // Create initial status history entry
      await this.prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: workRequest.id,
          fromStatus: null,
          toStatus: WorkRequestStatus.DRAFT,
          reason: 'Work request created',
          changedBy: userId,
          changedByName: user.name,
          metadata: {},
        },
      });

      // Create stand association if it's a stand
      if (data.assetType === AssetType.STAND || !data.assetType) {
        await this.prisma.workRequestStandAssociation.create({
          data: {
            workRequestId: workRequest.id,
            standId: data.assetId,
            standCode: asset.code,
            associationType: 'primary',
            impactLevel: data.impactLevel,
            specificAreas: [],
            constraints: {},
            createdBy: userId,
          },
        });
      }

      return {
        success: true,
        data: this.mapPrismaToWorkRequest(workRequest),
      };
    } catch (error) {
      console.error('Error creating work request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async updateWorkRequest(
    id: string,
    userId: string,
    data: UpdateWorkRequestRequest
  ): Promise<{
    success: boolean;
    data?: WorkRequest;
    error?: string;
    validationResults?: ValidationResult[];
  }> {
    try {
      // Check if work request exists and user has permission
      const existingRequest = await this.prisma.workRequest.findUnique({
        where: { id },
        include: { statusHistory: true },
      });

      if (!existingRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      // Check version for optimistic locking
      if (existingRequest.version !== data.version) {
        return {
          success: false,
          error: 'Work request has been modified by another user. Please refresh and try again.',
        };
      }

      // Validate the update data
      const validation = await this.validateWorkRequest(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Validation failed',
          validationResults: validation.validationResults,
        };
      }

      // Update the work request
      const updatedRequest = await this.prisma.workRequest.update({
        where: { id },
        data: {
          ...data,
          version: { increment: 1 },
          updatedBy: userId,
        },
        include: {
          statusHistory: true,
          comments: true,
          approvals: true,
          attachmentFiles: true,
          standAssociations: true,
          assetAssociations: true,
        },
      });

      return {
        success: true,
        data: this.mapPrismaToWorkRequest(updatedRequest),
      };
    } catch (error) {
      console.error('Error updating work request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getWorkRequest(
    id: string,
    userId: string
  ): Promise<{ success: boolean; data?: WorkRequest; error?: string }> {
    try {
      const workRequest = await this.prisma.workRequest.findUnique({
        where: { id },
        include: {
          statusHistory: {
            orderBy: { changedAt: 'desc' },
          },
          comments: {
            orderBy: { commentedAt: 'desc' },
          },
          approvals: {
            orderBy: { sequenceOrder: 'asc' },
          },
          attachmentFiles: true,
          standAssociations: true,
          assetAssociations: true,
        },
      });

      if (!workRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      return {
        success: true,
        data: this.mapPrismaToWorkRequest(workRequest),
      };
    } catch (error) {
      console.error('Error fetching work request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getWorkRequests(
    organizationId: string,
    userId: string,
    filters: WorkRequestFilters = {},
    page: number = 1,
    pageSize: number = 25
  ): Promise<GetWorkRequestsResponse> {
    try {
      const whereClause = this.buildWhereClause(organizationId, userId, filters);
      const skip = (page - 1) * pageSize;

      const [requests, total] = await Promise.all([
        this.prisma.workRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            urgency: true,
            workType: true,
            assetType: true,
            assetCode: true,
            assetName: true,
            assetLocation: true,
            requestedStartDate: true,
            estimatedTotalCost: true,
            requestorName: true,
            department: true,
            submissionDate: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.workRequest.count({ where: whereClause }),
      ]);

      return {
        success: true,
        data: {
          requests: requests.map(this.mapToWorkRequestSummary),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      };
    } catch (error) {
      console.error('Error fetching work requests:', error);
      return {
        success: false,
        data: {
          requests: [],
          pagination: { page, pageSize, total: 0, totalPages: 0 },
        },
      };
    }
  }

  async validateWorkRequest(data: Partial<CreateWorkRequestRequest>): Promise<ValidationResponse> {
    const validationResults: ValidationResult[] = [];

    // Required field validation
    if (!data.title || data.title.trim().length < 5) {
      validationResults.push({
        field: 'title',
        message: 'Title must be at least 5 characters long',
        severity: 'error',
      });
    }

    if (!data.description || data.description.trim().length < 20) {
      validationResults.push({
        field: 'description',
        message: 'Description must be at least 20 characters long',
        severity: 'error',
      });
    }

    if (!data.requestedStartDate) {
      validationResults.push({
        field: 'requestedStartDate',
        message: 'Requested start date is required',
        severity: 'error',
      });
    } else if (new Date(data.requestedStartDate) <= new Date()) {
      validationResults.push({
        field: 'requestedStartDate',
        message: 'Requested start date must be in the future',
        severity: 'error',
      });
    }

    // Date range validation
    if (data.requestedEndDate && data.requestedStartDate) {
      if (new Date(data.requestedEndDate) <= new Date(data.requestedStartDate)) {
        validationResults.push({
          field: 'requestedEndDate',
          message: 'End date must be after start date',
          severity: 'error',
        });
      }
    }

    // Business rule validation
    if (data.priority === Priority.CRITICAL && data.urgency === Urgency.ROUTINE) {
      validationResults.push({
        field: 'urgency',
        message: 'Critical priority requests cannot have routine urgency',
        severity: 'error',
      });
    }

    // Cost validation
    if (data.estimatedTotalCost && data.estimatedTotalCost < 0) {
      validationResults.push({
        field: 'estimatedTotalCost',
        message: 'Estimated total cost cannot be negative',
        severity: 'error',
      });
    }

    if (data.estimatedMaterialsCost && data.estimatedMaterialsCost < 0) {
      validationResults.push({
        field: 'estimatedMaterialsCost',
        message: 'Estimated materials cost cannot be negative',
        severity: 'error',
      });
    }

    return {
      isValid: validationResults.filter((r) => r.severity === 'error').length === 0,
      validationResults,
      warnings: validationResults.filter((r) => r.severity === 'warning'),
      suggestions: validationResults.filter((r) => r.severity === 'info'),
    };
  }

  private buildWhereClause(organizationId: string, userId: string, filters: WorkRequestFilters) {
    const where: any = {
      organizationId,
      ...(filters.status && { status: { in: filters.status } }),
      ...(filters.priority && { priority: { in: filters.priority } }),
      ...(filters.workType && { workType: { in: filters.workType } }),
      ...(filters.assetType && { assetType: { in: filters.assetType } }),
      ...(filters.assetId && { assetId: filters.assetId }),
      ...(filters.requestedBy && { requestedBy: filters.requestedBy }),
      ...(filters.department && { department: filters.department }),
    };

    // Search functionality
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { assetCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async getUserInfo(userId: string) {
    // This would typically fetch from a user service
    // For now, return mock data
    return {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      department: 'Maintenance',
    };
  }

  private async getAssetInfo(assetId: string, assetType: AssetType) {
    // This would typically fetch from the assets module
    // For now, return mock data
    return {
      code: 'A01',
      name: 'Stand A01',
      location: 'Terminal 1',
      metadata: {},
    };
  }

  private mapPrismaToWorkRequest(prismaRequest: any): WorkRequest {
    return {
      id: prismaRequest.id,
      organizationId: prismaRequest.organizationId,
      assetId: prismaRequest.assetId,
      assetType: prismaRequest.assetType,
      assetSchema: prismaRequest.assetSchema,
      assetCode: prismaRequest.assetCode,
      assetName: prismaRequest.assetName,
      assetLocation: prismaRequest.assetLocation,
      assetMetadata: prismaRequest.assetMetadata,
      workType: prismaRequest.workType,
      category: prismaRequest.category,
      priority: prismaRequest.priority,
      urgency: prismaRequest.urgency,
      impactLevel: prismaRequest.impactLevel,
      title: prismaRequest.title,
      description: prismaRequest.description,
      locationDetails: prismaRequest.locationDetails,
      safetyConsiderations: prismaRequest.safetyConsiderations,
      requestedStartDate: prismaRequest.requestedStartDate,
      requestedEndDate: prismaRequest.requestedEndDate,
      estimatedDurationMinutes: prismaRequest.estimatedDurationMinutes,
      deadline: prismaRequest.deadline,
      preferredTimeWindows: prismaRequest.preferredTimeWindows,
      blackoutPeriods: prismaRequest.blackoutPeriods,
      seasonalConstraints: prismaRequest.seasonalConstraints,
      estimatedPersonnelCount: prismaRequest.estimatedPersonnelCount,
      requiredSkills: prismaRequest.requiredSkills,
      requiredEquipment: prismaRequest.requiredEquipment,
      estimatedMaterialsCost: prismaRequest.estimatedMaterialsCost,
      budgetCode: prismaRequest.budgetCode,
      estimatedTotalCost: prismaRequest.estimatedTotalCost,
      costCenter: prismaRequest.costCenter,
      purchaseOrderNumber: prismaRequest.purchaseOrderNumber,
      vendorInformation: prismaRequest.vendorInformation,
      requestedBy: prismaRequest.requestedBy,
      requestorName: prismaRequest.requestorName,
      requestorEmail: prismaRequest.requestorEmail,
      requestorPhone: prismaRequest.requestorPhone,
      department: prismaRequest.department,
      primaryContactId: prismaRequest.primaryContactId,
      secondaryContactId: prismaRequest.secondaryContactId,
      approvalRequired: prismaRequest.approvalRequired,
      approvalLevel: prismaRequest.approvalLevel,
      currentApproverId: prismaRequest.currentApproverId,
      approvalDeadline: prismaRequest.approvalDeadline,
      status: prismaRequest.status,
      statusReason: prismaRequest.statusReason,
      submissionDate: prismaRequest.submissionDate,
      reviewStartedDate: prismaRequest.reviewStartedDate,
      approvedDate: prismaRequest.approvedDate,
      completedDate: prismaRequest.completedDate,
      regulatoryApprovalRequired: prismaRequest.regulatoryApprovalRequired,
      regulatoryReference: prismaRequest.regulatoryReference,
      complianceNotes: prismaRequest.complianceNotes,
      attachments: prismaRequest.attachments,
      relatedDocuments: prismaRequest.relatedDocuments,
      version: prismaRequest.version,
      isTemplate: prismaRequest.isTemplate,
      templateId: prismaRequest.templateId,
      metadata: prismaRequest.metadata,
      createdAt: prismaRequest.createdAt,
      updatedAt: prismaRequest.updatedAt,
      createdBy: prismaRequest.createdBy,
      updatedBy: prismaRequest.updatedBy,
      statusHistory: prismaRequest.statusHistory,
      comments: prismaRequest.comments,
      notifications: prismaRequest.notifications,
      approvals: prismaRequest.approvals,
      attachmentFiles: prismaRequest.attachmentFiles,
      standAssociations: prismaRequest.standAssociations,
      assetAssociations: prismaRequest.assetAssociations,
    };
  }

  private mapToWorkRequestSummary(prismaRequest: any): WorkRequestSummary {
    return {
      id: prismaRequest.id,
      title: prismaRequest.title,
      status: prismaRequest.status,
      priority: prismaRequest.priority,
      urgency: prismaRequest.urgency,
      workType: prismaRequest.workType,
      assetType: prismaRequest.assetType,
      assetCode: prismaRequest.assetCode,
      assetName: prismaRequest.assetName,
      assetLocation: prismaRequest.assetLocation,
      requestedStartDate: prismaRequest.requestedStartDate,
      estimatedTotalCost: prismaRequest.estimatedTotalCost,
      requestorName: prismaRequest.requestorName,
      department: prismaRequest.department,
      submissionDate: prismaRequest.submissionDate,
      createdAt: prismaRequest.createdAt,
      updatedAt: prismaRequest.updatedAt,
    };
  }

  async deleteWorkRequest(
    id: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if work request exists and user has permission
      const existingRequest = await this.prisma.workRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      // Only allow deletion of draft or cancelled requests
      if (!['draft', 'cancelled'].includes(existingRequest.status)) {
        return {
          success: false,
          error: 'Only draft or cancelled work requests can be deleted',
        };
      }

      // Soft delete by updating status to deleted
      await this.prisma.workRequest.update({
        where: { id },
        data: {
          status: 'deleted',
          statusReason: reason || 'Work request deleted',
          updatedBy: userId,
        },
      });

      // Add status history entry
      await this.prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: id,
          fromStatus: existingRequest.status,
          toStatus: 'deleted',
          reason: reason || 'Work request deleted',
          changedBy: userId,
          changedByName: 'System', // TODO: Get actual user name
          metadata: {},
        },
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting work request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async bulkUpdateStatus(
    requestIds: string[],
    newStatus: WorkRequestStatus,
    userId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    data?: { processedCount: number; successCount: number; failures: any[] };
    error?: string;
  }> {
    try {
      const results = {
        processedCount: requestIds.length,
        successCount: 0,
        failures: [] as any[],
      };

      for (const requestId of requestIds) {
        try {
          const result = await this.updateWorkRequestStatus(requestId, newStatus, userId, reason);
          if (result.success) {
            results.successCount++;
          } else {
            results.failures.push({
              requestId,
              error: result.error,
            });
          }
        } catch (error) {
          results.failures.push({
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Error in bulk update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async updateWorkRequestStatus(
    id: string,
    newStatus: WorkRequestStatus,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; data?: WorkRequest; error?: string }> {
    try {
      const existingRequest = await this.prisma.workRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      // Validate status transition
      const validTransition = this.isValidStatusTransition(existingRequest.status, newStatus);
      if (!validTransition) {
        return {
          success: false,
          error: `Invalid status transition from ${existingRequest.status} to ${newStatus}`,
        };
      }

      // Update the work request
      const updatedRequest = await this.prisma.workRequest.update({
        where: { id },
        data: {
          status: newStatus,
          statusReason: reason,
          updatedBy: userId,
          ...(newStatus === WorkRequestStatus.SUBMITTED && { submissionDate: new Date() }),
          ...(newStatus === WorkRequestStatus.UNDER_REVIEW && { reviewStartedDate: new Date() }),
          ...(newStatus === WorkRequestStatus.APPROVED && { approvedDate: new Date() }),
          ...(newStatus === WorkRequestStatus.COMPLETED && { completedDate: new Date() }),
        },
        include: {
          statusHistory: true,
          comments: true,
          approvals: true,
          attachmentFiles: true,
          standAssociations: true,
          assetAssociations: true,
        },
      });

      // Add status history entry
      await this.prisma.workRequestStatusHistory.create({
        data: {
          workRequestId: id,
          fromStatus: existingRequest.status,
          toStatus: newStatus,
          reason: reason || `Status changed to ${newStatus}`,
          changedBy: userId,
          changedByName: 'System', // TODO: Get actual user name
          metadata: {},
        },
      });

      return {
        success: true,
        data: this.mapPrismaToWorkRequest(updatedRequest),
      };
    } catch (error) {
      console.error('Error updating work request status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['under_review', 'cancelled'],
      under_review: ['approved', 'rejected', 'cancelled'],
      approved: ['in_progress', 'cancelled'],
      rejected: ['draft', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: ['draft'],
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  async duplicateWorkRequest(
    id: string,
    userId: string,
    modifications?: Partial<CreateWorkRequestRequest>
  ): Promise<{ success: boolean; data?: WorkRequest; error?: string }> {
    try {
      const existingRequest = await this.prisma.workRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      // Create new request data based on existing request
      const newRequestData: CreateWorkRequestRequest = {
        assetId: existingRequest.assetId,
        assetType: existingRequest.assetType,
        workType: existingRequest.workType,
        category: existingRequest.category,
        priority: existingRequest.priority,
        urgency: existingRequest.urgency,
        impactLevel: existingRequest.impactLevel,
        title: `Copy of ${existingRequest.title}`,
        description: existingRequest.description,
        locationDetails: existingRequest.locationDetails,
        safetyConsiderations: existingRequest.safetyConsiderations,
        requestedStartDate: new Date(), // Reset to current date
        requestedEndDate: existingRequest.requestedEndDate,
        estimatedDurationMinutes: existingRequest.estimatedDurationMinutes,
        deadline: existingRequest.deadline,
        preferredTimeWindows: existingRequest.preferredTimeWindows,
        blackoutPeriods: existingRequest.blackoutPeriods,
        seasonalConstraints: existingRequest.seasonalConstraints,
        estimatedPersonnelCount: existingRequest.estimatedPersonnelCount,
        requiredSkills: existingRequest.requiredSkills,
        requiredEquipment: existingRequest.requiredEquipment,
        estimatedMaterialsCost: existingRequest.estimatedMaterialsCost,
        budgetCode: existingRequest.budgetCode,
        estimatedTotalCost: existingRequest.estimatedTotalCost,
        costCenter: existingRequest.costCenter,
        purchaseOrderNumber: existingRequest.purchaseOrderNumber,
        vendorInformation: existingRequest.vendorInformation,
        primaryContactId: existingRequest.primaryContactId,
        secondaryContactId: existingRequest.secondaryContactId,
        regulatoryApprovalRequired: existingRequest.regulatoryApprovalRequired,
        regulatoryReference: existingRequest.regulatoryReference,
        complianceNotes: existingRequest.complianceNotes,
        metadata: existingRequest.metadata,
        ...modifications,
      };

      // Create the duplicated request
      return await this.createWorkRequest(existingRequest.organizationId, userId, newRequestData);
    } catch (error) {
      console.error('Error duplicating work request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Comment System Methods
  async addComment(
    workRequestId: string,
    userId: string,
    comment: string,
    commentType: string = 'general',
    isInternal: boolean = false,
    parentCommentId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const workRequest = await this.prisma.workRequest.findUnique({
        where: { id: workRequestId },
      });

      if (!workRequest) {
        return {
          success: false,
          error: 'Work request not found',
        };
      }

      const user = await this.getUserInfo(userId);

      const newComment = await this.prisma.workRequestComment.create({
        data: {
          workRequestId,
          parentCommentId,
          commentText: comment,
          commentType,
          isInternal,
          isSystemGenerated: false,
          mentionedUsers: [], // TODO: Extract @mentions from comment text
          attachments: [],
          commentedBy: userId,
          commenterName: user.name,
        },
        include: {
          parentComment: true,
          replies: true,
        },
      });

      return {
        success: true,
        data: newComment,
      };
    } catch (error) {
      console.error('Error adding comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getComments(
    workRequestId: string,
    includeInternal: boolean = false
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const whereClause: any = { workRequestId };

      if (!includeInternal) {
        whereClause.isInternal = false;
      }

      const comments = await this.prisma.workRequestComment.findMany({
        where: whereClause,
        include: {
          parentComment: true,
          replies: {
            where: includeInternal ? {} : { isInternal: false },
          },
        },
        orderBy: { commentedAt: 'desc' },
      });

      return {
        success: true,
        data: comments,
      };
    } catch (error) {
      console.error('Error fetching comments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async updateComment(
    commentId: string,
    userId: string,
    newText: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const existingComment = await this.prisma.workRequestComment.findUnique({
        where: { id: commentId },
      });

      if (!existingComment) {
        return {
          success: false,
          error: 'Comment not found',
        };
      }

      if (existingComment.commentedBy !== userId) {
        return {
          success: false,
          error: 'You can only edit your own comments',
        };
      }

      const updatedComment = await this.prisma.workRequestComment.update({
        where: { id: commentId },
        data: {
          commentText: newText,
          editedAt: new Date(),
          editedBy: userId,
        },
      });

      return {
        success: true,
        data: updatedComment,
      };
    } catch (error) {
      console.error('Error updating comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async deleteComment(
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existingComment = await this.prisma.workRequestComment.findUnique({
        where: { id: commentId },
        include: { replies: true },
      });

      if (!existingComment) {
        return {
          success: false,
          error: 'Comment not found',
        };
      }

      if (existingComment.commentedBy !== userId) {
        return {
          success: false,
          error: 'You can only delete your own comments',
        };
      }

      if (existingComment.replies && existingComment.replies.length > 0) {
        return {
          success: false,
          error: 'Cannot delete comment with replies',
        };
      }

      await this.prisma.workRequestComment.delete({
        where: { id: commentId },
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting comment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Bulk Operations
  async bulkDelete(
    requestIds: string[],
    userId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    data?: { processedCount: number; successCount: number; failures: any[] };
    error?: string;
  }> {
    try {
      const results = {
        processedCount: requestIds.length,
        successCount: 0,
        failures: [] as any[],
      };

      for (const requestId of requestIds) {
        try {
          const result = await this.deleteWorkRequest(requestId, userId, reason);
          if (result.success) {
            results.successCount++;
          } else {
            results.failures.push({
              requestId,
              error: result.error,
            });
          }
        } catch (error) {
          results.failures.push({
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      console.error('Error in bulk delete:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async exportWorkRequests(
    filters: WorkRequestFilters,
    organizationId: string,
    userId: string,
    format: 'csv' | 'json' | 'excel' = 'csv'
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const whereClause = this.buildWhereClause(organizationId, userId, filters);

      const workRequests = await this.prisma.workRequest.findMany({
        where: whereClause,
        include: {
          standAssociations: true,
          assetAssociations: true,
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
          approvals: {
            where: { status: 'approved' },
            orderBy: { decisionDate: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      let exportData: any;

      switch (format) {
        case 'csv':
          exportData = this.convertToCSV(workRequests);
          break;
        case 'json':
          exportData = workRequests;
          break;
        case 'excel':
          // TODO: Implement Excel export
          exportData = workRequests;
          break;
      }

      return {
        success: true,
        data: exportData,
      };
    } catch (error) {
      console.error('Error exporting work requests:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // Define CSV headers
    const headers = [
      'ID',
      'Title',
      'Status',
      'Priority',
      'Work Type',
      'Category',
      'Asset Code',
      'Asset Name',
      'Location',
      'Requestor',
      'Department',
      'Requested Start Date',
      'Estimated Duration (min)',
      'Estimated Cost',
      'Submission Date',
      'Approved Date',
      'Created At',
    ];

    // Convert data to CSV rows
    const rows = data.map((req) => [
      req.id,
      `"${req.title.replace(/"/g, '""')}"`,
      req.status,
      req.priority,
      req.workType,
      req.category,
      req.assetCode,
      `"${req.assetName.replace(/"/g, '""')}"`,
      req.assetLocation || '',
      req.requestorName,
      req.department || '',
      req.requestedStartDate ? new Date(req.requestedStartDate).toISOString() : '',
      req.estimatedDurationMinutes || '',
      req.estimatedTotalCost || '',
      req.submissionDate ? new Date(req.submissionDate).toISOString() : '',
      req.approvedDate ? new Date(req.approvedDate).toISOString() : '',
      new Date(req.createdAt).toISOString(),
    ]);

    // Combine headers and rows
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
