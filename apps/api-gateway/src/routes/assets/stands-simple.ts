import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { StandCRUDService } from '@capacity-planner/assets-module';

const router = Router();
const prisma = new PrismaClient();

// Initialize service without validation engine for now
const standCRUDService = new StandCRUDService(prisma as any, {} as any);

// Simple middleware to extract organization ID
router.use((req: any, res, next) => {
  req.organizationId = req.headers['x-organization-id'] || 'default-org';
  next();
});

// GET /stands
router.get('/', async (req: any, res) => {
  try {
    const { organizationId } = req;
    const { page = 1, limit = 20, search, status } = req.query;

    const result = await standCRUDService.getStands(organizationId, {
      page: Number(page),
      limit: Number(limit),
      search: search as string,
      status: status as string,
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching stands:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/:id
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const result = await standCRUDService.getStandById(id, organizationId);

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

// POST /stands
router.post('/', async (req: any, res) => {
  try {
    const { organizationId } = req;
    const standData = {
      ...req.body,
      organizationId,
    };

    const result = await standCRUDService.createStand(standData);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating stand:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// PUT /stands/:id
router.put('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;
    const { version, ...updateData } = req.body;

    const result = await standCRUDService.updateStand(id, organizationId, updateData, version);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating stand:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// DELETE /stands/:id
router.delete('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    await standCRUDService.deleteStand(id, organizationId, 'default-user');

    res.json({
      success: true,
      message: 'Stand deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting stand:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
