import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdjacencyService } from '@capacity-planner/assets-module';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const adjacencyService = new AdjacencyService(prisma);

// Request/Response DTOs
const createAdjacencySchema = z.object({
  standId: z.string(),
  adjacentStandId: z.string(),
  distance: z.number().positive(),
  impactLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  operationalConstraints: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updateAdjacencySchema = z.object({
  distance: z.number().positive().optional(),
  impactLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  operationalConstraints: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const findAdjacentStandsSchema = z.object({
  minDistance: z.number().positive().optional(),
  maxImpactLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
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

// POST /stands/adjacency
router.post('/adjacency', validateOrganization, validateUser, async (req, res) => {
  try {
    const { organizationId, userId } = req;

    const validation = createAdjacencySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const result = await adjacencyService.createAdjacency(organizationId, validation.data, userId);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating adjacency:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// PUT /stands/adjacency/:adjacencyId
router.put('/adjacency/:adjacencyId', validateOrganization, validateUser, async (req, res) => {
  try {
    const { adjacencyId } = req.params;
    const { organizationId, userId } = req;

    const validation = updateAdjacencySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const result = await adjacencyService.updateAdjacency(
      adjacencyId,
      organizationId,
      validation.data,
      userId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating adjacency:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// DELETE /stands/adjacency/:adjacencyId
router.delete('/adjacency/:adjacencyId', validateOrganization, async (req, res) => {
  try {
    const { adjacencyId } = req.params;
    const { organizationId } = req;

    await adjacencyService.deleteAdjacency(adjacencyId, organizationId);

    res.json({
      success: true,
      message: 'Adjacency deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting adjacency:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/:id/adjacency
router.get('/:id/adjacency', validateOrganization, async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const result = await adjacencyService.getAdjacencyInfo(id, organizationId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching adjacency information:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/adjacency/network
router.get('/adjacency/network', validateOrganization, async (req, res) => {
  try {
    const { organizationId } = req;

    const result = await adjacencyService.getAdjacencyNetwork(organizationId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching adjacency network:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// GET /stands/:id/adjacent
router.get('/:id/adjacent', validateOrganization, async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const validation = findAdjacentStandsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
    }

    const result = await adjacencyService.findAdjacentStands(id, organizationId, validation.data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error finding adjacent stands:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
