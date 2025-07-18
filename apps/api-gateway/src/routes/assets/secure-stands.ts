import { Router, Request, Response } from 'express';
import { PrismaClient } from '@capacity-planner/assets-module/prisma/client';
import {
  SecureStandCRUDService,
  CapabilityValidationEngine,
  CreateStandRequest,
  UpdateStandRequest,
  StandFilters,
} from '@capacity-planner/assets-module';
import { securityMiddleware, SecurityRequest } from '@capacity-planner/assets-module/middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const validationEngine = new CapabilityValidationEngine();
const secureStandService = new SecureStandCRUDService(
  prisma,
  validationEngine,
  process.env.CAPABILITIES_ENCRYPTION_KEY
);

// Apply security middleware to all routes
router.use(securityMiddleware.applySecurityHeaders);
router.use(securityMiddleware.validateAndSanitizeInput);
router.use(securityMiddleware.initializeSecurityContext(prisma));
router.use(securityMiddleware.rateLimitByOrganization(60000, 100)); // 100 requests per minute

// Request validation schemas
const createStandSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  terminal: z.string().optional(),
  status: z.enum(['operational', 'maintenance', 'closed']).optional(),
  dimensions: z.object({}).passthrough().optional(),
  aircraftCompatibility: z.object({}).passthrough().optional(),
  groundSupport: z.object({}).passthrough().optional(),
  operationalConstraints: z.object({}).passthrough().optional(),
  environmentalFeatures: z.object({}).passthrough().optional(),
  infrastructure: z.object({}).passthrough().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  metadata: z.object({}).passthrough().optional(),
});

const updateStandSchema = createStandSchema.partial();

const standFiltersSchema = z.object({
  status: z.enum(['operational', 'maintenance', 'closed']).optional(),
  terminal: z.string().optional(),
  icaoCategory: z.string().optional(),
  hasPowerSupply: z.boolean().optional(),
  hasJetbridge: z.boolean().optional(),
  searchTerm: z.string().optional(),
  includeDeleted: z.boolean().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  includeCapabilities: z.coerce.boolean().default(false),
});

/**
 * GET /secure-stands
 * Get all stands with field-level security
 */
router.get(
  '/',
  securityMiddleware.requirePermissions('capability_read'),
  securityMiddleware.auditLog('list_stands'),
  async (req: SecurityRequest, res: Response) => {
    try {
      // Validate query parameters
      const paginationResult = paginationSchema.safeParse(req.query);
      const filtersResult = standFiltersSchema.safeParse(req.query);

      if (!paginationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pagination parameters',
          details: paginationResult.error.errors,
        });
      }

      if (!filtersResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filter parameters',
          details: filtersResult.error.errors,
        });
      }

      const { page, pageSize, includeCapabilities } = paginationResult.data;
      const filters = filtersResult.data;

      // Get stands with security
      const result = await secureStandService.getStands(
        req.securityContext!,
        filters,
        page,
        pageSize,
        includeCapabilities
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.data,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Error fetching stands:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stands',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /secure-stands/:id
 * Get a specific stand with field-level security
 */
router.get(
  '/:id',
  securityMiddleware.requirePermissions('capability_read'),
  securityMiddleware.auditLog('get_stand'),
  async (req: SecurityRequest, res: Response) => {
    try {
      const { id } = req.params;
      const includeCapabilities = req.query.includeCapabilities === 'true';

      const result = await secureStandService.getStandById(
        req.securityContext!,
        id,
        includeCapabilities
      );

      if (!result.success) {
        return res.status(result.error === 'Stand not found' ? 404 : 400).json(result);
      }

      res.json({
        success: true,
        data: result.data,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Error fetching stand:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stand',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * POST /secure-stands
 * Create a new stand with security validation
 */
router.post(
  '/',
  securityMiddleware.requirePermissions('capability_management'),
  securityMiddleware.auditLog('create_stand'),
  async (req: SecurityRequest, res: Response) => {
    try {
      // Validate request body
      const validationResult = createStandSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
      }

      const result = await secureStandService.createStand(
        req.securityContext!,
        validationResult.data as CreateStandRequest
      );

      if (!result.success) {
        return res.status(result.securityViolations?.length ? 403 : 400).json(result);
      }

      res.status(201).json({
        success: true,
        data: result.data,
        recommendations: result.recommendations,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          auditTrail: result.auditTrail,
        },
      });
    } catch (error) {
      console.error('Error creating stand:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create stand',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * PUT /secure-stands/:id
 * Update a stand with security validation
 */
router.put(
  '/:id',
  securityMiddleware.requirePermissions('capability_management'),
  securityMiddleware.auditLog('update_stand'),
  async (req: SecurityRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const validationResult = updateStandSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
      }

      const result = await secureStandService.updateStand(
        req.securityContext!,
        id,
        validationResult.data as UpdateStandRequest
      );

      if (!result.success) {
        return res
          .status(
            result.securityViolations?.length ? 403 : result.error === 'Stand not found' ? 404 : 400
          )
          .json(result);
      }

      res.json({
        success: true,
        data: result.data,
        recommendations: result.recommendations,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          auditTrail: result.auditTrail,
        },
      });
    } catch (error) {
      console.error('Error updating stand:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update stand',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * DELETE /secure-stands/:id
 * Delete a stand (soft delete) with security validation
 */
router.delete(
  '/:id',
  securityMiddleware.requirePermissions('capability_management'),
  securityMiddleware.auditLog('delete_stand'),
  async (req: SecurityRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await secureStandService.deleteStand(req.securityContext!, id);

      if (!result.success) {
        return res
          .status(
            result.securityViolations?.length ? 403 : result.error === 'Stand not found' ? 404 : 400
          )
          .json(result);
      }

      res.json({
        success: true,
        message: 'Stand deleted successfully',
        recommendations: result.recommendations,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          auditTrail: result.auditTrail,
        },
      });
    } catch (error) {
      console.error('Error deleting stand:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete stand',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /secure-stands/security/statistics
 * Get security statistics (admin only)
 */
router.get(
  '/security/statistics',
  securityMiddleware.requirePermissions('admin'),
  securityMiddleware.auditLog('view_security_stats'),
  async (req: SecurityRequest, res: Response) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const statistics = await secureStandService.getSecurityStatistics(
        req.securityContext!,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: statistics,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Error fetching security statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch security statistics',
        requestId: req.requestId,
      });
    }
  }
);

// Error handler for security errors
router.use(securityMiddleware.handleSecurityError);

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await secureStandService.destroy();
  await prisma.$disconnect();
});

export default router;
