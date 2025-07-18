import { Router } from 'express';
import {
  StandCapabilityService,
  StandCRUDOptimizedService,
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
import { getPrismaClient } from '@capacity-planner/assets-module/src/config/database.config';

const router = Router();
const validationEngine = new CapabilityValidationEngine();
const standCapabilityService = new StandCapabilityService(getPrismaClient());
const standCRUDService = new StandCRUDOptimizedService(validationEngine);
const standImportService = new StandImportService(getPrismaClient(), validationEngine);

// Apply global middleware with enhanced compression
router.use(
  advancedCompression({
    level: 6,
    threshold: 1024,
    algorithms: ['br', 'gzip', 'deflate'],
  })
);
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

const bulkCreateSchema = z.object({
  stands: z.array(createStandSchema).min(1).max(1000),
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
router.get('/:id/capabilities', capabilityRateLimit, validateOrganization, async (req, res) => {
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
});

// PUT /stands/:id/capabilities
router.put(
  '/:id/capabilities',
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

// === CRUD OPERATIONS WITH REDIS CACHING ===

// GET /stands - List all stands with pagination and filtering
router.get('/', capabilityRateLimit, validateOrganization, async (req, res) => {
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
});

// POST /stands - Create a new stand
router.post(
  '/',
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
router.get('/:id', capabilityRateLimit, validateOrganization, async (req, res) => {
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
});

// PUT /stands/:id - Update a stand
router.put(
  '/:id',
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
router.delete('/:id', capabilityRateLimit, validateOrganization, validateUser, async (req, res) => {
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
});

// GET /stands/stats - Get stand statistics
router.get('/stats', capabilityRateLimit, validateOrganization, async (req, res) => {
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
});

// POST /stands/bulk - Bulk create stands
router.post(
  '/bulk',
  bulkOperationRateLimit,
  deduplicationMiddleware(5000),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { organizationId, userId } = req;
      const data = bulkCreateSchema.parse(req.body);

      const result = await standCRUDService.bulkCreateStands(organizationId, data.stands, userId);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error bulk creating stands:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /stands/cache/warm - Warm the cache
router.post(
  '/cache/warm',
  capabilityRateLimit,
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { organizationId } = req;
      const limit = parseInt(req.query.limit as string) || 100;

      await standCRUDService.warmCache(organizationId, limit);

      res.json({
        success: true,
        message: 'Cache warmed successfully',
      });
    } catch (error) {
      console.error('Error warming cache:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /stands/cache/stats - Get cache statistics
router.get('/cache/stats', capabilityRateLimit, validateOrganization, async (req, res) => {
  try {
    const stats = await standCRUDService.getCacheStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// POST /stands/capabilities/bulk-update
router.post(
  '/capabilities/bulk-update',
  bulkOperationRateLimit,
  deduplicationMiddleware(5000),
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
router.get('/capabilities/query', capabilityRateLimit, validateOrganization, async (req, res) => {
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
});

export default router;
