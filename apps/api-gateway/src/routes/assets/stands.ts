import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  StandCapabilityService,
  StandCRUDService,
  StandImportService,
  CapabilityValidationEngine,
} from '@capacity-planner/assets-module';
import { z } from 'zod';
import { cacheMiddleware, invalidateCache } from '../../middleware/caching';
import { advancedCompression } from '../../middleware/compression';
import {
  capabilityRateLimit,
  validationRateLimit,
  bulkOperationRateLimit,
  deduplicationMiddleware,
} from '../../middleware/rate-limiting';
import {
  validateCapabilityRequest,
  formatValidationResponse,
  handleValidationError,
  trackValidationPerformance,
} from '../../middleware/validation';

const router = Router();
const prisma = new PrismaClient();
const validationEngine = new CapabilityValidationEngine();
const standCapabilityService = new StandCapabilityService(prisma);
const standCRUDService = new StandCRUDService(prisma, validationEngine);
const standImportService = new StandImportService(prisma, validationEngine);

// Temporary middleware until proper auth is implemented
const validateOrganization = (req: any, res: any, next: any) => {
  req.organizationId = req.headers['x-organization-id'] || 'default-org';
  next();
};

const validateUser = (req: any, res: any, next: any) => {
  req.userId = req.headers['x-user-id'] || 'default-user';
  next();
};

// Apply global middleware
router.use(advancedCompression());
router.use(trackValidationPerformance);
router.use(formatValidationResponse);
router.use(handleValidationError);

// Request/Response DTOs
const updateCapabilitiesSchema = z.object({
  dimensions: z
    .object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      icaoCategory: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
    })
    .optional(),
  aircraftCompatibility: z
    .object({
      supportedAircraftTypes: z.array(z.string()).optional(),
      maxWingspan: z.number().positive().optional(),
      maxLength: z.number().positive().optional(),
      maxWeight: z.number().positive().optional(),
    })
    .optional(),
  groundSupport: z
    .object({
      hasPowerSupply: z.boolean().optional(),
      hasAirConditioning: z.boolean().optional(),
      hasJetbridge: z.boolean().optional(),
      groundPowerUnits: z.number().min(0).optional(),
      airStartUnits: z.number().min(0).optional(),
    })
    .optional(),
  operationalConstraints: z
    .object({
      operatingHours: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional(),
      weatherLimitations: z.array(z.string()).optional(),
      noiseRestrictions: z
        .object({
          hasRestrictions: z.boolean().optional(),
          maxDecibels: z.number().optional(),
          restrictedHours: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  environmentalFeatures: z
    .object({
      deIcingCapability: z.boolean().optional(),
      fuelHydrantSystem: z.boolean().optional(),
      wasteServiceCapability: z.boolean().optional(),
      cateringServiceCapability: z.boolean().optional(),
    })
    .optional(),
  infrastructure: z
    .object({
      lightingType: z.enum(['LED', 'HALOGEN', 'FLUORESCENT']).optional(),
      hasFireSuppressionSystem: z.boolean().optional(),
      hasSecuritySystem: z.boolean().optional(),
      pavementType: z.enum(['CONCRETE', 'ASPHALT', 'COMPOSITE']).optional(),
      drainageSystem: z.enum(['SURFACE', 'SUBSURFACE', 'COMBINED']).optional(),
    })
    .optional(),
});

const bulkUpdateSchema = z.object({
  operations: z.array(
    z.object({
      standId: z.string(),
      capabilities: updateCapabilitiesSchema,
    })
  ),
});

const queryCapabilitiesSchema = z.object({
  icaoCategory: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
  hasJetbridge: z.boolean().optional(),
  minLength: z.number().positive().optional(),
  maxLength: z.number().positive().optional(),
  minWidth: z.number().positive().optional(),
  maxWidth: z.number().positive().optional(),
  groundSupportType: z.string().optional(),
  limit: z.number().positive().max(100).default(50),
  offset: z.number().min(0).default(0),
});

// CRUD-specific schemas
const createStandSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  terminal: z.string().max(50).optional(),
  status: z.enum(['operational', 'maintenance', 'closed']).optional(),
  dimensions: z
    .object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
    })
    .optional(),
  aircraftCompatibility: z
    .object({
      maxWingspan: z.number().positive().optional(),
      maxLength: z.number().positive().optional(),
      maxWeight: z.number().positive().optional(),
      compatibleCategories: z.array(z.enum(['A', 'B', 'C', 'D', 'E', 'F'])).optional(),
    })
    .optional(),
  groundSupport: z
    .object({
      hasPowerSupply: z.boolean().optional(),
      hasGroundAir: z.boolean().optional(),
      hasFuelHydrant: z.boolean().optional(),
    })
    .optional(),
  geometry: z.any().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  metadata: z.any().optional(),
});

const updateStandSchema = createStandSchema.partial().extend({
  version: z.number().positive(),
});

const standFiltersSchema = z.object({
  status: z.enum(['operational', 'maintenance', 'closed']).optional(),
  terminal: z.string().optional(),
  aircraftCategory: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
  search: z.string().optional(),
  includeDeleted: z.boolean().optional(),
  page: z.number().positive().default(1),
  pageSize: z.number().positive().max(100).default(50),
});

// Middleware for authentication and organization validation
const validateOrganization = (req: any, res: any, next: any) => {
  const organizationId = req.headers['x-organization-id'];
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID is required' });
  }
  req.organizationId = organizationId;
  next();
};

const validateUser = (req: any, res: any, next: any) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  req.userId = userId;
  next();
};

// GET /stands/:id/capabilities
router.get(
  '/:id/capabilities',
  cacheMiddleware({ ttl: 300 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const result = await standCapabilityService.getCapabilities(id, organizationId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching stand capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// PUT /stands/:id/capabilities
router.put(
  '/:id/capabilities',
  invalidateCache('stands:.*:capabilities'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  validateCapabilityRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, userId } = req;

      const validation = updateCapabilitiesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await standCapabilityService.updateCapabilities(
        id,
        organizationId,
        validation.data,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error updating stand capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// PATCH /stands/:id/capabilities/:type
router.patch(
  '/:id/capabilities/:type',
  invalidateCache('stands:.*:capabilities'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  validateCapabilityRequest,
  async (req, res) => {
    try {
      const { id, type } = req.params;
      const { organizationId, userId } = req;

      // Validate capability type
      const validTypes = [
        'dimensions',
        'aircraftCompatibility',
        'groundSupport',
        'operationalConstraints',
        'environmentalFeatures',
        'infrastructure',
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid capability type. Must be one of: ${validTypes.join(', ')}`,
        });
      }

      // Create partial update object
      const partialUpdate = {
        [type]: req.body,
      };

      const validation = updateCapabilitiesSchema.safeParse(partialUpdate);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await standCapabilityService.updateCapabilities(
        id,
        organizationId,
        validation.data,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error updating stand capability type:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /stands/capabilities/bulk-update
router.post(
  '/capabilities/bulk-update',
  invalidateCache('stands:.*:capabilities'),
  bulkOperationRateLimit,
  deduplicationMiddleware(5000), // 5 second deduplication for bulk operations
  validateOrganization,
  validateUser,
  validateCapabilityRequest,
  async (req, res) => {
    try {
      const { organizationId, userId } = req;

      const validation = bulkUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await standCapabilityService.bulkUpdateCapabilities(
        validation.data.operations,
        organizationId,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error bulk updating stand capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /stands/capabilities/validate
router.post(
  '/capabilities/validate',
  validationRateLimit,
  validateCapabilityRequest,
  async (req, res) => {
    try {
      const validation = updateCapabilitiesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await standCapabilityService.validateCapabilities(validation.data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error validating stand capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/capabilities/query
router.get(
  '/capabilities/query',
  cacheMiddleware({ ttl: 180 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { organizationId } = req;

      const validation = queryCapabilitiesSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.errors,
        });
      }

      const result = await standCapabilityService.queryByCapabilities({
        ...validation.data,
        organizationId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error querying stand capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/:id/capabilities/history
router.get(
  '/:id/capabilities/history',
  cacheMiddleware({ ttl: 600 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await standCapabilityService.getCapabilityHistory(id, organizationId, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching capability history:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/capabilities/statistics
router.get(
  '/capabilities/statistics',
  cacheMiddleware({ ttl: 300 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { organizationId } = req;

      const result = await standCapabilityService.getCapabilityStatistics(organizationId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching capability statistics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /stands/:id/capabilities/rollback
router.post(
  '/:id/capabilities/rollback',
  invalidateCache('stands:.*:capabilities'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, userId } = req;
      const { snapshotId, reason } = req.body;

      if (!snapshotId) {
        return res.status(400).json({
          success: false,
          error: 'Snapshot ID is required',
        });
      }

      const result = await standCapabilityService.rollbackCapabilities(id, organizationId, {
        snapshotId,
        userId,
        reason,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error rolling back capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// === CRUD OPERATIONS ===

// GET /stands - List all stands with pagination and filtering
router.get(
  '/',
  cacheMiddleware({ ttl: 60 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { organizationId } = req;
      const filters = standFiltersSchema.parse(req.query);

      const result = await standCRUDService.getStands(
        organizationId,
        filters,
        filters.page,
        filters.pageSize
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching stands:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /stands - Create a new stand
router.post(
  '/',
  invalidateCache('stands:.*'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { organizationId, userId } = req;
      const data = createStandSchema.parse(req.body);

      const result = await standCRUDService.createStand(organizationId, data, userId);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error creating stand:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/:id - Get a specific stand
router.get(
  '/:id',
  cacheMiddleware({ ttl: 300 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;
      const includeDeleted = req.query.includeDeleted === 'true';

      const result = await standCRUDService.getStandById(id, organizationId, includeDeleted);

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
    } catch (error) {
      console.error('Error fetching stand:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// PUT /stands/:id - Update a stand
router.put(
  '/:id',
  invalidateCache('stands:.*'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, userId } = req;
      const data = updateStandSchema.parse(req.body);

      const result = await standCRUDService.updateStand(id, organizationId, data, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error updating stand:', error);
      const statusCode =
        error instanceof Error && error.message.includes('modified by another user') ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// DELETE /stands/:id - Delete a stand (soft delete)
router.delete(
  '/:id',
  invalidateCache('stands:.*'),
  capabilityRateLimit,
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, userId } = req;

      await standCRUDService.deleteStand(id, organizationId, userId);

      res.json({
        success: true,
        message: 'Stand deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting stand:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/stats - Get stand statistics
router.get(
  '/stats',
  cacheMiddleware({ ttl: 300 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { organizationId } = req;

      const result = await standCRUDService.getStandStats(organizationId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching stand stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// === BULK IMPORT OPERATIONS ===

// POST /stands/import - Start bulk import
router.post(
  '/import',
  invalidateCache('stands:.*'),
  bulkOperationRateLimit,
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { organizationId, userId } = req;
      const { filename, fileUrl } = req.body;

      if (!filename || !fileUrl) {
        return res.status(400).json({
          success: false,
          error: 'Filename and fileUrl are required',
        });
      }

      const result = await standImportService.startImport(
        organizationId,
        filename,
        fileUrl,
        userId
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error starting import:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/import/:jobId - Get import job status
router.get(
  '/import/:jobId',
  cacheMiddleware({ ttl: 10 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { jobId } = req.params;

      const result = await standImportService.getImportStatus(jobId);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Import job not found',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching import status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/import - Get import jobs
router.get(
  '/import',
  cacheMiddleware({ ttl: 60 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { organizationId } = req;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await standImportService.getImportJobs(organizationId, page, pageSize);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching import jobs:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

export default router;
