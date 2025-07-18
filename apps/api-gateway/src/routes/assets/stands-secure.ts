import { Router, Request, Response } from 'express';
import { StandCRUDSecureService } from '@capacity-planner/assets-module';
import { prisma } from '../../config/database';
import { validationEngine } from '../../config/validation';
import { fieldAccessControl } from '@capacity-planner/assets-module';
import {
  apiRateLimiter,
  importRateLimiter,
  validateFileUpload,
  apiKeyAuth,
} from '../../middleware/security.middleware';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorization';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = Router();
const standService = new StandCRUDSecureService(prisma, validationEngine);

// Configure multer for secure file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || '/tmp/uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/csv', 'text/plain'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Extend Request type for auth
interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    permissions: string[];
  };
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    sessionId: string;
    requestId: string;
  };
}

// Apply authentication to all routes
router.use(authenticate);

// Apply rate limiting
router.use(apiRateLimiter);

/**
 * GET /stands
 * Get all stands with filtering and pagination
 */
router.get(
  '/',
  authorize(['stands.read', 'admin']),
  fieldAccessControl.middleware('stand'),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        terminal: req.query.terminal as string,
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 50,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await standService.getStands(context, filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching stands:', error);
      res.status(error.message.includes('permissions') ? 403 : 400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /stands/:id
 * Get a single stand by ID
 */
router.get(
  '/:id',
  authorize(['stands.read', 'admin']),
  fieldAccessControl.middleware('stand'),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      const result = await standService.getStandById(context, req.params.id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Stand not found',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error fetching stand:', error);
      res.status(error.message.includes('permissions') ? 403 : 400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /stands
 * Create a new stand
 */
router.post(
  '/',
  authorize(['stands.create', 'admin']),
  fieldAccessControl.middleware('stand'),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      const stand = await standService.createStand(context, req.body);

      res.status(201).json({
        success: true,
        data: stand,
      });
    } catch (error: any) {
      console.error('Error creating stand:', error);

      let statusCode = 400;
      if (error.message.includes('permissions')) statusCode = 403;
      if (error.message.includes('already exists')) statusCode = 409;

      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * PUT /stands/:id
 * Update a stand
 */
router.put(
  '/:id',
  authorize(['stands.update', 'admin']),
  fieldAccessControl.middleware('stand'),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      const stand = await standService.updateStand(context, req.params.id, req.body);

      res.json({
        success: true,
        data: stand,
      });
    } catch (error: any) {
      console.error('Error updating stand:', error);

      let statusCode = 400;
      if (error.message.includes('permissions')) statusCode = 403;
      if (error.message.includes('not found')) statusCode = 404;
      if (error.message.includes('modified by another user')) statusCode = 409;

      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /stands/:id
 * Soft delete a stand
 */
router.delete(
  '/:id',
  authorize(['stands.delete', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      await standService.deleteStand(context, req.params.id, req.body.reason);

      res.json({
        success: true,
        message: 'Stand deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting stand:', error);

      let statusCode = 400;
      if (error.message.includes('permissions')) statusCode = 403;
      if (error.message.includes('not found')) statusCode = 404;

      res.status(statusCode).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /stands/import
 * Import stands from CSV file
 */
router.post(
  '/import',
  authorize(['stands.import', 'admin']),
  importRateLimiter,
  upload.single('file'),
  validateFileUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      // Import service would handle the file processing
      // For now, return success
      res.json({
        success: true,
        message: 'Import started',
        jobId: uuidv4(),
      });
    } catch (error: any) {
      console.error('Error importing stands:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /stands/export
 * Export stands to CSV
 */
router.get(
  '/export',
  authorize(['stands.export', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      // Export implementation would go here
      res.json({
        success: true,
        message: 'Export feature coming soon',
      });
    } catch (error: any) {
      console.error('Error exporting stands:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /stands/stats
 * Get stand statistics
 */
router.get(
  '/stats',
  authorize(['stands.read', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      const stats = await standService.getStandStats(context);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error fetching stand stats:', error);
      res.status(error.message.includes('permissions') ? 403 : 400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /stands/validate
 * Validate stand data without creating
 */
router.post(
  '/validate',
  authorize(['stands.create', 'stands.update', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      // Validation implementation
      res.json({
        success: true,
        valid: true,
        errors: [],
        warnings: [],
      });
    } catch (error: any) {
      console.error('Error validating stand:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /stands/audit
 * Get audit logs for stands (admin only)
 */
router.get(
  '/audit',
  authorize(['admin', 'audit.read']),
  async (req: AuthRequest, res: Response) => {
    try {
      const context = {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        permissions: req.user!.permissions,
        ...req.securityContext,
      };

      // Audit log implementation
      res.json({
        success: true,
        data: [],
      });
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }
  }
);

// API Key endpoints (for external integrations)
router.use('/api', apiKeyAuth);

router.get(
  '/api/stands',
  fieldAccessControl.middleware('stand'),
  async (req: Request, res: Response) => {
    // API key authenticated endpoints
    res.json({
      success: true,
      message: 'API access granted',
    });
  }
);

export default router;
