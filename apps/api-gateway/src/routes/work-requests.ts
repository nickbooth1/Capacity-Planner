import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import {
  WorkRequestService,
  ApprovalWorkflowService,
  NotificationService,
  ValidationEngineService,
  FileUploadService,
  VirusScannerService,
  FileEncryptionService,
  WorkRequestRepositoryService,
  ReportingService,
  ReportTemplateService,
  ScheduledReportService,
  ChartDataService,
} from '@capacity-planner/work-module';
import { HTTP_STATUS } from '@capacity-planner/shared-kernel';
import {
  CreateWorkRequestRequest,
  UpdateWorkRequestRequest,
  WorkRequestFilters,
  WorkRequestStatus,
  Priority,
  Urgency,
  WorkType,
  AssetType,
  ImpactLevel,
  WorkCategory,
} from '@capacity-planner/work-module';

const router = Router();
const prisma = new PrismaClient();
const workRequestService = new WorkRequestService(prisma);
const approvalWorkflowService = new ApprovalWorkflowService(prisma);
const notificationService = new NotificationService(prisma);
const validationEngineService = new ValidationEngineService(prisma);
const fileUploadService = new FileUploadService(prisma);
const virusScannerService = new VirusScannerService();
const fileEncryptionService = new FileEncryptionService();
const workRequestRepositoryService = new WorkRequestRepositoryService(prisma);
const reportingService = new ReportingService(prisma);
const reportTemplateService = new ReportTemplateService(prisma);
const scheduledReportService = new ScheduledReportService(prisma);
const chartDataService = new ChartDataService(prisma);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 104857600, // 100MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// Middleware to extract user context (mock for now)
const getUserContext = (req: Request) => {
  return {
    userId: (req.headers['x-user-id'] as string) || 'test-user-id',
    organizationId: (req.headers['x-organization-id'] as string) || 'test-org-id',
    userRole: (req.headers['x-user-role'] as string) || 'user',
  };
};

// Middleware to validate request body
const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: Function) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error,
      });
    }
  };
};

// ===== WORK REQUEST CRUD ENDPOINTS =====

// Create work request
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const requestData = req.body as CreateWorkRequestRequest;

    const result = await workRequestService.createWorkRequest(organizationId, userId, requestData);

    if (result.success) {
      res.status(HTTP_STATUS.CREATED).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error creating work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to create work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get work requests with filtering and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 25;

    const filters: WorkRequestFilters = {
      status: req.query.status
        ? ((Array.isArray(req.query.status)
            ? req.query.status
            : [req.query.status]) as WorkRequestStatus[])
        : undefined,
      priority: req.query.priority
        ? ((Array.isArray(req.query.priority)
            ? req.query.priority
            : [req.query.priority]) as Priority[])
        : undefined,
      workType: req.query.workType
        ? ((Array.isArray(req.query.workType)
            ? req.query.workType
            : [req.query.workType]) as WorkType[])
        : undefined,
      assetId: req.query.assetId as string,
      requestedBy: req.query.requestedBy as string,
      search: req.query.search as string,
    };

    const result = await workRequestService.getWorkRequests(
      organizationId,
      userId,
      filters,
      page,
      pageSize
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching work requests:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch work requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get specific work request
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;

    const result = await workRequestService.getWorkRequest(id, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json(result);
    }
  } catch (error) {
    console.error('Error fetching work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update work request
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;
    const updateData = req.body as UpdateWorkRequestRequest;

    const result = await workRequestService.updateWorkRequest(id, userId, updateData);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error updating work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to update work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete work request (now implemented)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;
    const { reason } = req.body;

    const result = await workRequestService.deleteWorkRequest(id, userId, reason);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error deleting work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== STATUS MANAGEMENT ENDPOINTS =====

// Update work request status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;
    const { status, reason } = req.body;

    const result = await workRequestService.updateWorkRequestStatus(id, status, userId, reason);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error updating work request status:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to update work request status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Submit work request for approval
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;

    // Update status to submitted
    const statusResult = await workRequestService.updateWorkRequestStatus(
      id,
      WorkRequestStatus.SUBMITTED,
      userId
    );

    if (!statusResult.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(statusResult);
    }

    // Initialize approval workflow
    const approvalResult = await approvalWorkflowService.initializeApprovalWorkflow(
      id,
      organizationId,
      userId
    );

    if (!approvalResult.success) {
      // Rollback status if approval initialization fails
      await workRequestService.updateWorkRequestStatus(
        id,
        WorkRequestStatus.DRAFT,
        userId,
        'Approval workflow initialization failed'
      );
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(approvalResult);
    }

    // Send notification for submission
    await notificationService.sendStatusChangeNotification(
      id,
      WorkRequestStatus.DRAFT,
      WorkRequestStatus.SUBMITTED
    );

    res.json({
      success: true,
      data: {
        workRequest: statusResult.data,
        approvalChain: approvalResult.data || [],
        estimatedApprovalTime: 24, // hours
      },
    });
  } catch (error) {
    console.error('Error submitting work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to submit work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Duplicate work request
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;
    const modifications = req.body;

    const result = await workRequestService.duplicateWorkRequest(id, userId, modifications);

    if (result.success) {
      res.status(HTTP_STATUS.CREATED).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error duplicating work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to duplicate work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== BULK OPERATIONS ENDPOINTS =====

// Bulk status update
router.post('/bulk-actions', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { requestIds, action, parameters } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Request IDs are required',
      });
    }

    let result;

    switch (action) {
      case 'cancel':
        result = await workRequestService.bulkUpdateStatus(
          requestIds,
          WorkRequestStatus.CANCELLED,
          userId,
          parameters?.reason
        );
        break;
      case 'update_status':
        if (!parameters?.status) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: 'Status is required for update_status action',
          });
        }
        result = await workRequestService.bulkUpdateStatus(
          requestIds,
          parameters.status,
          userId,
          parameters?.reason
        );
        break;
      case 'delete':
        result = await workRequestService.bulkDelete(requestIds, userId, parameters?.reason);
        break;
      case 'export':
        const format = parameters?.format || 'csv';
        const exportResult = await workRequestService.exportWorkRequests(
          { status: parameters?.status || [] },
          organizationId,
          userId,
          format
        );

        if (exportResult.success && format === 'csv') {
          // For CSV, send as downloadable file
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="work-requests.csv"');
          return res.send(exportResult.data);
        } else {
          result = exportResult;
        }
        break;
      default:
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid action',
        });
    }

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error in bulk action:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to execute bulk action',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== APPROVAL WORKFLOW ENDPOINTS =====

// Get approval chain for work request
router.get('/:id/approvals', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;

    const result = await approvalWorkflowService.getApprovalChain(id);

    if (result.success) {
      // Get current and next approver details
      const approvalChain = result.data || [];
      const currentApproval = approvalChain.find((a) => a.status === 'pending');
      const currentApprover = currentApproval
        ? {
            id: currentApproval.approverId,
            name: currentApproval.approverName,
            role: currentApproval.approverRole,
          }
        : null;

      const nextApprovers = approvalChain
        .filter((a) => a.status === 'pending' && a.approverId !== currentApprover?.id)
        .map((a) => ({
          id: a.approverId,
          name: a.approverName,
          role: a.approverRole,
        }));

      res.json({
        success: true,
        data: {
          approvals: approvalChain,
          currentApprover,
          nextApprovers,
          approvalChain,
        },
      });
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch approvals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Process approval decision
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;
    const { decision, comments, conditions, delegatedTo } = req.body;

    if (!['approve', 'reject', 'delegate'].includes(decision)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid decision. Must be approve, reject, or delegate',
      });
    }

    const result = await approvalWorkflowService.processApprovalDecision(id, userId, {
      decision,
      comments,
      conditions,
      delegatedTo,
    });

    if (result.success && result.data) {
      // Send notification based on decision
      if (decision === 'approve' || decision === 'reject') {
        await notificationService.sendStatusChangeNotification(
          id,
          WorkRequestStatus.UNDER_REVIEW,
          result.data.workRequestStatus,
          {
            approverName: 'Approver', // TODO: Get actual approver name
            comments,
          }
        );
      }

      res.json({
        success: true,
        data: {
          approval: {
            id: 'approval-' + Date.now(),
            decision,
            comments,
            processedAt: new Date(),
          },
          nextApprover: result.data.nextApprover,
          workRequestStatus: result.data.workRequestStatus,
        },
      });
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to process approval',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get pending approvals for user
router.get('/approvals/pending', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);

    const result = await approvalWorkflowService.getPendingApprovals(organizationId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch pending approvals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== ATTACHMENT ENDPOINTS =====

// Upload attachment
router.post('/:id/attachments', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;
    const { description, isSecure } = req.body;

    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'No file provided',
      });
    }

    // Check if work request exists
    const workRequest = await workRequestService.getWorkRequest(id, userId);
    if (!workRequest.success) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Work request not found',
      });
    }

    // Upload file
    const uploadResult = await fileUploadService.uploadFile(
      id,
      req.file as Express.Multer.File,
      userId,
      {
        description,
        isSecure: isSecure === 'true' || isSecure === true,
      }
    );

    if (uploadResult.success) {
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: {
          attachment: uploadResult.metadata,
          virusScanStatus: uploadResult.metadata?.virusScanStatus || 'pending',
        },
      });
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(uploadResult);
    }
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to upload attachment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Download attachment
router.get('/:id/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id, attachmentId } = req.params;

    // Download file
    const downloadResult = await fileUploadService.downloadFile(id, attachmentId, userId);

    if (downloadResult.success && downloadResult.data) {
      // Set appropriate headers
      res.setHeader('Content-Type', downloadResult.data.metadata.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadResult.data.metadata.originalName}"`
      );
      res.setHeader('Content-Length', downloadResult.data.metadata.fileSize.toString());

      // Send file
      const fs = require('fs');
      const fileStream = fs.createReadStream(downloadResult.data.path);
      fileStream.pipe(res);
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json(downloadResult);
    }
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to download attachment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete attachment
router.delete('/:id/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id, attachmentId } = req.params;

    // Delete attachment
    const deleteResult = await fileUploadService.deleteFile(id, attachmentId, userId);

    if (deleteResult.success) {
      res.json({
        success: true,
        data: {
          deletedAt: new Date().toISOString(),
        },
      });
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json(deleteResult);
    }
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete attachment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get attachments list
router.get('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { id } = req.params;

    // Get attachments
    const attachmentsResult = await fileUploadService.getAttachments(id);

    if (attachmentsResult.success) {
      res.json({
        success: true,
        data: {
          attachments: attachmentsResult.data || [],
        },
      });
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(attachmentsResult);
    }
  } catch (error) {
    console.error('Error getting attachments:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get attachments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== COMMENTS ENDPOINTS =====

// Add comment to work request
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, userRole } = getUserContext(req);
    const { id } = req.params;
    const { comment, commentType, isInternal, parentCommentId } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Comment text is required',
      });
    }

    const result = await workRequestService.addComment(
      id,
      userId,
      comment,
      commentType,
      isInternal,
      parentCommentId
    );

    if (result.success) {
      res.status(HTTP_STATUS.CREATED).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to add comment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get comments for work request
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, userRole } = getUserContext(req);
    const { id } = req.params;
    const includeInternal =
      req.query.includeInternal === 'true' && ['admin', 'manager'].includes(userRole);

    const result = await workRequestService.getComments(id, includeInternal);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch comments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update comment
router.put('/:id/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { userId } = getUserContext(req);
    const { id, commentId } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Comment text is required',
      });
    }

    const result = await workRequestService.updateComment(commentId, userId, comment);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to update comment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete comment
router.delete('/:id/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { userId } = getUserContext(req);
    const { id, commentId } = req.params;

    const result = await workRequestService.deleteComment(commentId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete comment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== ASSETS INTEGRATION ENDPOINTS =====

// Get stands for work request selection
router.get('/assets/stands', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);

    // Query parameters for stand filtering
    const filters = {
      search: req.query.search as string,
      terminal: req.query.terminal as string,
      status: req.query.status
        ? ((Array.isArray(req.query.status) ? req.query.status : [req.query.status]) as string[])
        : undefined,
      includeMaintenanceSchedule: req.query.includeMaintenanceSchedule === 'true',
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 50,
    };

    // Call Assets Module API to get stands
    const standsResponse = await fetch(
      `${process.env.ASSETS_API_URL || 'http://localhost:3001'}/api/assets/stands`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || '',
          'X-Organization-ID': organizationId,
          'X-User-ID': (req.headers['x-user-id'] as string) || '',
        },
        body: JSON.stringify(filters),
      }
    );

    if (!standsResponse.ok) {
      throw new Error(`Assets API error: ${standsResponse.status}`);
    }

    const standsData = await standsResponse.json();

    // Transform stands data for work request context
    const transformedStands =
      standsData.data?.map((stand: any) => ({
        id: stand.id,
        code: stand.code,
        name: stand.name,
        terminal: stand.terminal,
        pier: stand.pier,
        status: stand.status,
        capabilities: stand.capabilities,
        dimensions: stand.dimensions,
        aircraftCompatibility: stand.aircraftCompatibility,
        groundSupport: stand.groundSupport,
        operationalConstraints: stand.operationalConstraints,
        location: {
          latitude: stand.latitude,
          longitude: stand.longitude,
        },
        maintenanceSchedule: stand.maintenanceSchedule || [],
      })) || [];

    res.json({
      success: true,
      data: {
        stands: transformedStands,
        pagination: standsData.meta || {
          page: filters.page,
          pageSize: filters.pageSize,
          total: transformedStands.length,
          totalPages: Math.ceil(transformedStands.length / filters.pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stands:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch stands',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get specific stand details for work request
router.get('/assets/stands/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { id } = req.params;

    // Call Assets Module API to get stand details
    const standResponse = await fetch(
      `${process.env.ASSETS_API_URL || 'http://localhost:3001'}/api/assets/stands/${id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || '',
          'X-Organization-ID': organizationId,
          'X-User-ID': (req.headers['x-user-id'] as string) || '',
        },
      }
    );

    if (!standResponse.ok) {
      if (standResponse.status === 404) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: 'Stand not found',
        });
      }
      throw new Error(`Assets API error: ${standResponse.status}`);
    }

    const standData = await standResponse.json();
    const stand = standData.data;

    // Transform stand data for work request context
    const transformedStand = {
      id: stand.id,
      code: stand.code,
      name: stand.name,
      terminal: stand.terminal,
      pier: stand.pier,
      status: stand.status,
      capabilities: stand.capabilities,
      dimensions: stand.dimensions,
      aircraftCompatibility: stand.aircraftCompatibility,
      groundSupport: stand.groundSupport,
      operationalConstraints: stand.operationalConstraints,
      environmentalFeatures: stand.environmentalFeatures,
      infrastructure: stand.infrastructure,
      location: {
        latitude: stand.latitude,
        longitude: stand.longitude,
      },
      geometry: stand.geometry,
      metadata: stand.metadata,
      currentStatus: stand.status,
      maintenanceSchedule: [], // TODO: Fetch from maintenance system
      adjacentStands: [], // TODO: Fetch adjacent stands
    };

    res.json({
      success: true,
      data: {
        stand: transformedStand,
      },
    });
  } catch (error) {
    console.error('Error fetching stand details:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch stand details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Check stand availability for work request
router.get('/assets/stands/:id/availability', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { id } = req.params;

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const granularity = (req.query.granularity as string) || 'hour';

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Start date and end date are required',
      });
    }

    // TODO: Implement availability checking logic
    // This would involve:
    // 1. Checking existing work requests for the stand
    // 2. Checking maintenance schedules
    // 3. Checking operational constraints
    // 4. Checking aircraft schedules (if integrated)

    // For now, return mock availability data
    const mockAvailability = {
      availability: [
        {
          start: startDate,
          end: endDate,
          available: true,
          conflicts: [],
          restrictions: [],
        },
      ],
      conflicts: [],
      recommendations: [
        {
          type: 'optimal_time',
          message: 'Best time window for maintenance work',
          startTime: '06:00',
          endTime: '10:00',
          reason: 'Low aircraft traffic period',
        },
      ],
    };

    res.json({
      success: true,
      data: mockAvailability,
    });
  } catch (error) {
    console.error('Error checking stand availability:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to check stand availability',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== VALIDATION ENDPOINTS =====

// Validate work request data
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { workRequestData, validationLevel = 'standard' } = req.body;

    if (!workRequestData) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Work request data is required',
      });
    }

    // Use validation engine for comprehensive validation
    const validationContext = {
      organizationId,
      userId,
      workRequestId: undefined,
    };

    const result = await validationEngineService.validateWorkRequest(
      workRequestData,
      validationContext
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error validating work request:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to validate work request',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Validate single field
router.post('/validate-field', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { field, value } = req.body;

    if (!field) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Field name is required',
      });
    }

    const validationContext = {
      organizationId,
      userId,
      workRequestId: undefined,
    };

    const results = await validationEngineService.validateField(field, value, validationContext);

    res.json({
      success: true,
      data: {
        validationResult: results[0] || null,
        allResults: results,
      },
    });
  } catch (error) {
    console.error('Error validating field:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to validate field',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== DASHBOARD AND ANALYTICS =====

// Get work request dashboard data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);

    // TODO: Implement dashboard analytics
    // This would include:
    // - Request counts by status
    // - Recent requests
    // - Pending approvals
    // - Upcoming work
    // - Cost summaries
    // - Performance metrics

    const mockDashboard = {
      counts: {
        total: 156,
        draft: 12,
        submitted: 8,
        underReview: 5,
        approved: 15,
        inProgress: 23,
        completed: 89,
        overdue: 4,
      },
      recentRequests: [],
      pendingApprovals: [],
      upcomingWork: [],
      costSummary: {
        totalEstimated: 125000,
        totalApproved: 89000,
        averageCost: 2500,
      },
      trends: {
        requestsByWeek: [],
        completionRate: 0.85,
        averageApprovalTime: 18.5,
      },
    };

    res.json({
      success: true,
      data: mockDashboard,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== REPOSITORY AND MANAGEMENT ENDPOINTS =====

// Search work requests with filters
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { filters, sortOptions, page, pageSize } = req.body;

    const result = await workRequestRepositoryService.searchWorkRequests(
      organizationId,
      filters || {},
      sortOptions,
      page,
      pageSize
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error searching work requests:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to search work requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Perform bulk operations
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const { requestIds, operation, params } = req.body;

    if (!requestIds?.length || !operation) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Request IDs and operation are required',
      });
    }

    const result = await workRequestRepositoryService.performBulkOperation(
      organizationId,
      requestIds,
      operation,
      params || {},
      userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to perform bulk operation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const filters = req.query as any;

    const stats = await workRequestRepositoryService.getDashboardStats(organizationId, filters);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Export work requests
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { filters, options } = req.body;

    const result = await workRequestRepositoryService.exportWorkRequests(
      organizationId,
      filters || {},
      options || {
        format: 'csv',
        includeAttachments: false,
        includeComments: false,
        includeHistory: false,
      }
    );

    if (result.success && result.data) {
      res.setHeader('Content-Type', result.mimeType!);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error exporting work requests:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to export work requests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Save a view
router.post('/views', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const view = req.body;

    const result = await workRequestRepositoryService.saveView(organizationId, userId, view);

    if (result.success) {
      res.status(HTTP_STATUS.CREATED).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error saving view:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to save view',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get saved views
router.get('/views', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);

    const result = await workRequestRepositoryService.getSavedViews(organizationId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error fetching saved views:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch saved views',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== REPORTING AND ANALYTICS ENDPOINTS =====

// Get performance metrics
router.get('/reports/metrics', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { startDate, endDate, periodType } = req.query;

    const period = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      periodType: (periodType as any) || 'custom',
    };

    const result = await reportingService.getPerformanceMetrics(
      organizationId,
      period,
      req.query.filters ? JSON.parse(req.query.filters as string) : undefined
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get KPIs
router.get('/reports/kpis', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { startDate, endDate, periodType } = req.query;

    const period = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      periodType: (periodType as any) || 'custom',
    };

    const result = await reportingService.getKPIs(organizationId, period);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error getting KPIs:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get KPIs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get trend analysis
router.get('/reports/trends/:metric', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { metric } = req.params;
    const { startDate, endDate, groupBy } = req.query;

    const period = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      periodType: 'custom' as any,
    };

    const result = await reportingService.getTrendAnalysis(
      organizationId,
      metric as any,
      period,
      groupBy as any
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error getting trend analysis:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get trend analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get forecast
router.get('/reports/forecast/:metric', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { metric } = req.params;
    const { periods } = req.query;

    const result = await reportingService.getForecast(
      organizationId,
      metric as any,
      parseInt(periods as string) || 3
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error getting forecast:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get forecast',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get report templates
router.get('/reports/templates', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    const templates = type
      ? await reportTemplateService.getTemplatesByType(type as string)
      : await reportTemplateService.getAllTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error getting report templates:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get report templates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate report
router.post('/reports/generate', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { templateId, period, filters } = req.body;

    const result = await reportingService.generateReport(
      organizationId,
      templateId,
      period,
      filters
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to generate report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create scheduled report
router.post('/reports/scheduled', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = getUserContext(req);
    const reportData = req.body;

    const result = await scheduledReportService.createScheduledReport(
      organizationId,
      userId,
      reportData
    );

    if (result.success) {
      res.status(HTTP_STATUS.CREATED).json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to create scheduled report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get scheduled reports
router.get('/reports/scheduled', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);

    const result = await scheduledReportService.getScheduledReports(
      organizationId,
      req.query as any
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error getting scheduled reports:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get scheduled reports',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update scheduled report
router.put('/reports/scheduled/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await scheduledReportService.updateScheduledReport(id, updates);

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to update scheduled report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete scheduled report
router.delete('/reports/scheduled/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await scheduledReportService.deleteScheduledReport(id);

    if (result.success) {
      res.status(HTTP_STATUS.NO_CONTENT).send();
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to delete scheduled report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get report executions
router.get('/reports/scheduled/:id/executions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    const result = await scheduledReportService.getReportExecutions(
      id,
      parseInt(limit as string) || 10
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(HTTP_STATUS.BAD_REQUEST).json(result);
    }
  } catch (error) {
    console.error('Error getting report executions:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get report executions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== CHART DATA ENDPOINTS =====

// Get chart data
router.get('/charts/:chartType', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getUserContext(req);
    const { chartType } = req.params;
    const { startDate, endDate, groupBy, metric, filters } = req.query;

    let chartData;

    switch (chartType) {
      case 'status-distribution':
        chartData = await chartDataService.getStatusDistributionChart(
          organizationId,
          filters ? JSON.parse(filters as string) : undefined
        );
        break;

      case 'priority-distribution':
        chartData = await chartDataService.getPriorityDistributionChart(
          organizationId,
          filters ? JSON.parse(filters as string) : undefined
        );
        break;

      case 'request-volume':
        chartData = await chartDataService.getRequestVolumeTimeSeriesChart(
          organizationId,
          new Date(startDate as string),
          new Date(endDate as string),
          groupBy as any
        );
        break;

      case 'asset-performance':
        chartData = await chartDataService.getAssetTypePerformanceChart(
          organizationId,
          metric as any
        );
        break;

      case 'cost-analysis':
        chartData = await chartDataService.getCostAnalysisChart(organizationId, groupBy as any);
        break;

      case 'sla-compliance':
        chartData = await chartDataService.getSLAComplianceGauge(organizationId, {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        });
        break;

      default:
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: `Unknown chart type: ${chartType}`,
        });
    }

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error('Error getting chart data:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to get chart data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===== ENUMS AND METADATA =====

// Get form enums and metadata
router.get('/enums', async (req: Request, res: Response) => {
  try {
    const enums = {
      workTypes: ['maintenance', 'inspection', 'repair', 'modification', 'emergency'],
      categories: ['routine', 'corrective', 'preventive', 'emergency'],
      priorities: ['critical', 'high', 'medium', 'low'],
      urgencies: ['immediate', 'scheduled', 'routine'],
      impactLevels: ['full_closure', 'partial_restriction', 'no_impact'],
      assetTypes: ['stand', 'airfield', 'baggage', 'terminal', 'gate', 'runway', 'taxiway'],
      statuses: [
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected',
        'cancelled',
        'in_progress',
        'completed',
      ],
    };

    res.json({
      success: true,
      data: enums,
    });
  } catch (error) {
    console.error('Error fetching enums:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch enums',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
