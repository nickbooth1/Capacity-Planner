import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MaintenanceService } from '@capacity-planner/assets-module';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const maintenanceService = new MaintenanceService(prisma);

// Request/Response DTOs
const scheduleMaintenanceSchema = z.object({
  standId: z.string(),
  type: z.string(),
  description: z.string().optional(),
  scheduledStart: z.string().transform((str) => new Date(str)),
  scheduledEnd: z.string().transform((str) => new Date(str)),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  estimatedCost: z.number().positive().optional(),
  requiredSkills: z.array(z.string()).optional(),
  requiredEquipment: z.array(z.string()).optional(),
});

const updateMaintenanceSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED']).optional(),
  actualStart: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  actualEnd: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  completionNotes: z.string().optional(),
  actualCost: z.number().positive().optional(),
});

const maintenanceQuerySchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED']).optional(),
  startDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  type: z.string().optional(),
  limit: z.number().positive().max(100).default(20),
  offset: z.number().min(0).default(0),
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

// GET /stands/:id/maintenance
router.get('/:id/maintenance', validateOrganization, async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await maintenanceService.getMaintenanceHistory(id, organizationId, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// POST /stands/:id/maintenance
router.post('/:id/maintenance', validateOrganization, validateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, userId } = req;

    const validation = scheduleMaintenanceSchema.safeParse({
      ...req.body,
      standId: id,
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const result = await maintenanceService.scheduleMaintenance(
      organizationId,
      validation.data,
      userId
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error scheduling maintenance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// PUT /stands/:id/maintenance/:recordId
router.put('/:id/maintenance/:recordId', validateOrganization, validateUser, async (req, res) => {
  try {
    const { recordId } = req.params;
    const { organizationId, userId } = req;

    const validation = updateMaintenanceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const result = await maintenanceService.updateMaintenance(
      recordId,
      organizationId,
      validation.data,
      userId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating maintenance record:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/maintenance/schedule
router.get('/maintenance/schedule', validateOrganization, async (req, res) => {
  try {
    const { organizationId } = req;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const result = await maintenanceService.getMaintenanceSchedule(
      organizationId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching maintenance schedule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/maintenance/statistics
router.get('/maintenance/statistics', validateOrganization, async (req, res) => {
  try {
    const { organizationId } = req;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await maintenanceService.getMaintenanceStatistics(
      organizationId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching maintenance statistics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/maintenance/alerts
router.get('/maintenance/alerts', validateOrganization, async (req, res) => {
  try {
    const { organizationId } = req;
    const daysBefore = parseInt(req.query.daysBefore as string) || 7;

    const result = await maintenanceService.getUpcomingMaintenanceAlerts(
      organizationId,
      daysBefore
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching maintenance alerts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/maintenance/query
router.get('/maintenance/query', validateOrganization, async (req, res) => {
  try {
    const { organizationId } = req;

    const validation = maintenanceQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
    }

    // This would require implementing a query method in MaintenanceService
    // For now, we'll return a simple response
    res.json({
      success: true,
      data: {
        message: 'Maintenance query endpoint - implementation pending',
        filters: validation.data,
      },
    });
  } catch (error) {
    console.error('Error querying maintenance records:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
