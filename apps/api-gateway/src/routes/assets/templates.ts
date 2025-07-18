import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { TemplateService } from '@capacity-planner/assets-module';
import { z } from 'zod';
import { cacheMiddleware, invalidateCache } from '../../middleware/caching';
import { advancedCompression } from '../../middleware/compression';
import {
  capabilityRateLimit,
  bulkOperationRateLimit,
  deduplicationMiddleware,
} from '../../middleware/rate-limiting';

const router = Router();
const prisma = new PrismaClient();
const templateService = new TemplateService(prisma);

// Temporary middleware until proper auth is implemented
const validateOrganization = (req: any, res: any, next: any) => {
  req.organizationId = req.headers['x-organization-id'] || 'default-org';
  next();
};

// Apply middleware
router.use(advancedCompression());

// Request/Response DTOs
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['AIRCRAFT_SIZE', 'GROUND_SUPPORT', 'OPERATIONAL', 'INFRASTRUCTURE', 'CUSTOM']),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  applicableAircraftCategories: z.array(z.enum(['A', 'B', 'C', 'D', 'E', 'F'])).optional(),
  capabilities: z.object({
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
  }),
  tags: z.array(z.string()).optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const templateSearchSchema = z.object({
  category: z.string().optional(),
  aircraftCategory: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().positive().max(100).default(50),
  offset: z.number().min(0).default(0),
  orderBy: z.enum(['name', 'category', 'created', 'updated']).default('name'),
  orderDirection: z.enum(['asc', 'desc']).default('asc'),
});

const applyTemplateSchema = z.object({
  templateId: z.string(),
  standIds: z.array(z.string()),
  overrideMode: z.enum(['MERGE', 'REPLACE', 'ADDITIVE']).default('MERGE'),
  conflictResolution: z.enum(['SKIP', 'OVERWRITE', 'PROMPT']).default('OVERWRITE'),
  previewOnly: z.boolean().default(false),
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

// GET /capability-templates
router.get(
  '/',
  cacheMiddleware({ ttl: 300 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { organizationId } = req;

      const validation = templateSearchSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.errors,
        });
      }

      const result = await templateService.searchTemplates(organizationId, validation.data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error searching templates:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /capability-templates
router.post(
  '/',
  invalidateCache('templates:.*'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { organizationId, userId } = req;

      const validation = createTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await templateService.createTemplate(organizationId, validation.data, userId);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /capability-templates/:id
router.get(
  '/:id',
  cacheMiddleware({ ttl: 600 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const result = await templateService.getTemplate(id, organizationId);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// PUT /capability-templates/:id
router.put(
  '/:id',
  invalidateCache('templates:.*'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, userId } = req;

      const validation = updateTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await templateService.updateTemplate(
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
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// DELETE /capability-templates/:id
router.delete(
  '/:id',
  invalidateCache('templates:.*'),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      await templateService.deleteTemplate(id, organizationId);

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /capability-templates/category/:category/default
router.get(
  '/category/:category/default',
  cacheMiddleware({ ttl: 600 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { category } = req.params;
      const { organizationId } = req;

      const result = await templateService.getDefaultTemplate(organizationId, category);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Default template not found for this category',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching default template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /capability-templates/apply
router.post(
  '/apply',
  invalidateCache('stands:.*:capabilities'),
  bulkOperationRateLimit,
  deduplicationMiddleware(5000),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { organizationId, userId } = req;

      const validation = applyTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const result = await templateService.applyTemplate(organizationId, validation.data, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error applying template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /capability-templates/:id/inheritance
router.get(
  '/:id/inheritance',
  cacheMiddleware({ ttl: 600 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const result = await templateService.getInheritanceChain(id, organizationId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching inheritance chain:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// POST /capability-templates/:id/inheritance
router.post(
  '/:id/inheritance',
  invalidateCache('templates:.*'),
  capabilityRateLimit,
  deduplicationMiddleware(),
  validateOrganization,
  validateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId, userId } = req;
      const { parentTemplateId } = req.body;

      if (!parentTemplateId) {
        return res.status(400).json({
          success: false,
          error: 'Parent template ID is required',
        });
      }

      await templateService.createInheritanceChain(id, parentTemplateId, organizationId, userId);

      res.json({
        success: true,
        message: 'Inheritance chain created successfully',
      });
    } catch (error) {
      console.error('Error creating inheritance chain:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /capability-templates/:id/capabilities/merged
router.get(
  '/:id/capabilities/merged',
  cacheMiddleware({ ttl: 600 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const result = await templateService.getMergedCapabilities(id, organizationId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching merged capabilities:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

// GET /capability-templates/:id/usage
router.get(
  '/:id/usage',
  cacheMiddleware({ ttl: 300 }),
  capabilityRateLimit,
  validateOrganization,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const result = await templateService.getTemplateUsageStatistics(id, organizationId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching template usage:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

export default router;
