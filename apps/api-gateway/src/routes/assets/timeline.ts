import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '@capacity-planner/shared-kernel';
import { assetsDb, TimelineService } from '@capacity-planner/assets-module';
import { Request, Response } from 'express';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const TimelineQuerySchema = z.object({
  start: z.string().transform((str) => new Date(str)),
  end: z.string().transform((str) => new Date(str)),
  granularity: z.enum(['minute', 'hour', 'day']).optional().default('hour'),
});

const BulkTimelineQuerySchema = z.object({
  start: z.string().transform((str) => new Date(str)),
  end: z.string().transform((str) => new Date(str)),
  standIds: z
    .string()
    .optional()
    .transform((str) => (str ? str.split(',') : undefined)),
  granularity: z.enum(['minute', 'hour', 'day']).optional().default('hour'),
});

/**
 * GET /api/stands/:standId/timeline
 * Get timeline data for a specific stand
 */
router.get('/stands/:standId/timeline', async (req: Request, res: Response) => {
  try {
    const { standId } = req.params;
    const query = TimelineQuerySchema.parse(req.query);

    const timelineService = new TimelineService(assetsDb, req.context!);
    const timeline = await timelineService.getStandTimeline({
      standId,
      ...query,
    });

    res.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error('Timeline query error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/stands/timeline
 * Get timeline data for multiple stands
 */
router.get('/stands/timeline', async (req: Request, res: Response) => {
  try {
    const query = BulkTimelineQuerySchema.parse(req.query);

    const timelineService = new TimelineService(assetsDb, req.context!);
    const timeline = await timelineService.getBulkTimeline(query);

    res.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error('Bulk timeline query error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/stands/:standId/details
 * Get detailed stand information including history and maintenance
 */
router.get('/stands/:standId/details', async (req: Request, res: Response) => {
  try {
    const { standId } = req.params;

    const timelineService = new TimelineService(assetsDb, req.context!);
    const details = await timelineService.getStandDetails(standId);

    res.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Stand details query error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/stands/:standId/status-history
 * Get status change history for a specific stand
 */
router.get('/stands/:standId/status-history', async (req: Request, res: Response) => {
  try {
    const { standId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    // Verify stand belongs to organization
    const stand = await assetsDb.stand.findFirst({
      where: {
        id: standId,
        organizationId: req.context!.organizationId,
        isDeleted: false,
      },
    });

    if (!stand) {
      return res.status(404).json({
        success: false,
        error: 'Stand not found',
      });
    }

    const statusHistory = await assetsDb.standStatusHistory.findMany({
      where: {
        standId,
        organizationId: req.context!.organizationId,
      },
      orderBy: { changedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        changedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const total = await assetsDb.standStatusHistory.count({
      where: {
        standId,
        organizationId: req.context!.organizationId,
      },
    });

    res.json({
      success: true,
      data: {
        items: statusHistory,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Status history query error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/stands/:standId/maintenance-timeline
 * Get maintenance timeline for a specific stand
 */
router.get('/stands/:standId/maintenance-timeline', async (req: Request, res: Response) => {
  try {
    const { standId } = req.params;
    const query = TimelineQuerySchema.parse(req.query);

    // Verify stand belongs to organization
    const stand = await assetsDb.stand.findFirst({
      where: {
        id: standId,
        organizationId: req.context!.organizationId,
        isDeleted: false,
      },
    });

    if (!stand) {
      return res.status(404).json({
        success: false,
        error: 'Stand not found',
      });
    }

    const maintenanceRecords = await assetsDb.standMaintenanceRecord.findMany({
      where: {
        standId,
        organizationId: req.context!.organizationId,
        OR: [
          {
            scheduledStartTime: {
              gte: query.start,
              lte: query.end,
            },
          },
          {
            scheduledEndTime: {
              gte: query.start,
              lte: query.end,
            },
          },
          {
            AND: [
              { scheduledStartTime: { lte: query.start } },
              { scheduledEndTime: { gte: query.end } },
            ],
          },
        ],
      },
      orderBy: { scheduledStartTime: 'asc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        standId,
        dateRange: { start: query.start, end: query.end },
        maintenanceRecords,
      },
    });
  } catch (error) {
    console.error('Maintenance timeline query error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
