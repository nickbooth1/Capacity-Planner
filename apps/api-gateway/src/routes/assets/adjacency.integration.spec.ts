import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import adjacencyRouter from './adjacency';

// Mock services
jest.mock('@capacity-planner/assets-module', () => ({
  AdjacencyService: jest.fn().mockImplementation(() => ({
    createAdjacency: jest.fn(),
    updateAdjacency: jest.fn(),
    deleteAdjacency: jest.fn(),
    getAdjacencyInfo: jest.fn(),
    getAdjacencyNetwork: jest.fn(),
    findAdjacentStands: jest.fn(),
  })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

describe('Adjacency API Integration Tests', () => {
  let app: express.Application;
  let mockAdjacencyService: any;

  const organizationId = 'test-org-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/stands', adjacencyRouter);

    // Get mock instances
    const { AdjacencyService } = require('@capacity-planner/assets-module');

    mockAdjacencyService = new AdjacencyService({});
  });

  describe('POST /stands/adjacency', () => {
    it('should create new adjacency relationship', async () => {
      const adjacencyData = {
        standId: 'stand-1',
        adjacentStandId: 'stand-2',
        distance: 50,
        impactLevel: 'MEDIUM',
        operationalConstraints: ['Weather dependent'],
        notes: 'Test adjacency',
      };

      const mockResult = {
        id: 'adj-1',
        ...adjacencyData,
        createdAt: new Date(),
      };

      mockAdjacencyService.createAdjacency.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/stands/adjacency')
        .set('x-organization-id', organizationId)
        .set('x-user-id', userId)
        .send(adjacencyData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: mockResult,
      });

      expect(mockAdjacencyService.createAdjacency).toHaveBeenCalledWith(
        organizationId,
        adjacencyData,
        userId
      );
    });

    it('should return 400 for invalid request body', async () => {
      const invalidData = {
        standId: 'stand-1',
        // Missing required fields
      };

      const response = await request(app)
        .post('/stands/adjacency')
        .set('x-organization-id', organizationId)
        .set('x-user-id', userId)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid request body',
        details: expect.any(Array),
      });
    });

    it('should return 400 when organization ID is missing', async () => {
      const response = await request(app).post('/stands/adjacency').set('x-user-id', userId).send({
        standId: 'stand-1',
        adjacentStandId: 'stand-2',
        distance: 50,
        impactLevel: 'MEDIUM',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Organization ID is required',
      });
    });

    it('should return 400 when user ID is missing', async () => {
      const response = await request(app)
        .post('/stands/adjacency')
        .set('x-organization-id', organizationId)
        .send({
          standId: 'stand-1',
          adjacentStandId: 'stand-2',
          distance: 50,
          impactLevel: 'MEDIUM',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'User ID is required',
      });
    });

    it('should return 500 when service throws error', async () => {
      const adjacencyData = {
        standId: 'stand-1',
        adjacentStandId: 'stand-2',
        distance: 50,
        impactLevel: 'MEDIUM',
      };

      mockAdjacencyService.createAdjacency.mockRejectedValue(new Error('Stand not found'));

      const response = await request(app)
        .post('/stands/adjacency')
        .set('x-organization-id', organizationId)
        .set('x-user-id', userId)
        .send(adjacencyData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Stand not found',
      });
    });
  });

  describe('PUT /stands/adjacency/:adjacencyId', () => {
    it('should update adjacency relationship', async () => {
      const adjacencyId = 'adj-1';
      const updateData = {
        distance: 60,
        impactLevel: 'HIGH',
        notes: 'Updated adjacency',
      };

      const mockResult = {
        id: adjacencyId,
        standId: 'stand-1',
        adjacentStandId: 'stand-2',
        ...updateData,
        updatedAt: new Date(),
      };

      mockAdjacencyService.updateAdjacency.mockResolvedValue(mockResult);

      const response = await request(app)
        .put(`/stands/adjacency/${adjacencyId}`)
        .set('x-organization-id', organizationId)
        .set('x-user-id', userId)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockResult,
      });

      expect(mockAdjacencyService.updateAdjacency).toHaveBeenCalledWith(
        adjacencyId,
        organizationId,
        updateData,
        userId
      );
    });

    it('should return 400 for invalid update data', async () => {
      const adjacencyId = 'adj-1';
      const invalidData = {
        distance: -10, // Invalid negative distance
      };

      const response = await request(app)
        .put(`/stands/adjacency/${adjacencyId}`)
        .set('x-organization-id', organizationId)
        .set('x-user-id', userId)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid request body',
        details: expect.any(Array),
      });
    });
  });

  describe('DELETE /stands/adjacency/:adjacencyId', () => {
    it('should delete adjacency relationship', async () => {
      const adjacencyId = 'adj-1';

      mockAdjacencyService.deleteAdjacency.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/stands/adjacency/${adjacencyId}`)
        .set('x-organization-id', organizationId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Adjacency deleted successfully',
      });

      expect(mockAdjacencyService.deleteAdjacency).toHaveBeenCalledWith(
        adjacencyId,
        organizationId
      );
    });

    it('should return 500 when deletion fails', async () => {
      const adjacencyId = 'adj-1';

      mockAdjacencyService.deleteAdjacency.mockRejectedValue(new Error('Adjacency not found'));

      const response = await request(app)
        .delete(`/stands/adjacency/${adjacencyId}`)
        .set('x-organization-id', organizationId);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Adjacency not found',
      });
    });
  });

  describe('GET /stands/:id/adjacency', () => {
    it('should return adjacency information', async () => {
      const standId = 'stand-1';
      const mockInfo = {
        standId,
        adjacentStands: [
          {
            standId: 'stand-2',
            standIdentifier: 'A02',
            distance: 50,
            impactLevel: 'MEDIUM',
            operationalConstraints: [],
          },
        ],
      };

      mockAdjacencyService.getAdjacencyInfo.mockResolvedValue(mockInfo);

      const response = await request(app)
        .get(`/stands/${standId}/adjacency`)
        .set('x-organization-id', organizationId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockInfo,
      });

      expect(mockAdjacencyService.getAdjacencyInfo).toHaveBeenCalledWith(standId, organizationId);
    });
  });

  describe('GET /stands/adjacency/network', () => {
    it('should return adjacency network data', async () => {
      const mockNetwork = {
        nodes: [
          {
            id: 'stand-1',
            identifier: 'A01',
            type: 'stand',
            properties: {
              dimensions: { length: 60, width: 40 },
              infrastructure: { hasPower: true },
            },
          },
          {
            id: 'stand-2',
            identifier: 'A02',
            type: 'stand',
            properties: {
              dimensions: { length: 55, width: 38 },
              infrastructure: { hasPower: false },
            },
          },
        ],
        edges: [
          {
            source: 'stand-1',
            target: 'stand-2',
            distance: 50,
            impactLevel: 'MEDIUM',
            operationalConstraints: [],
          },
        ],
      };

      mockAdjacencyService.getAdjacencyNetwork.mockResolvedValue(mockNetwork);

      const response = await request(app)
        .get('/stands/adjacency/network')
        .set('x-organization-id', organizationId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockNetwork,
      });

      expect(mockAdjacencyService.getAdjacencyNetwork).toHaveBeenCalledWith(organizationId);
    });
  });

  describe('GET /stands/:id/adjacent', () => {
    it('should return adjacent stands with valid query parameters', async () => {
      const standId = 'stand-1';
      const mockAdjacentStands = [
        {
          standId: 'stand-2',
          standIdentifier: 'A02',
          distance: 75,
          impactLevel: 'LOW',
          operationalConstraints: [],
          notes: 'Close proximity',
        },
        {
          standId: 'stand-3',
          standIdentifier: 'A03',
          distance: 100,
          impactLevel: 'LOW',
          operationalConstraints: ['Weather dependent'],
          notes: 'Good alternative',
        },
      ];

      mockAdjacencyService.findAdjacentStands.mockResolvedValue(mockAdjacentStands);

      const response = await request(app)
        .get(`/stands/${standId}/adjacent`)
        .query({
          minDistance: '50',
          maxImpactLevel: 'MEDIUM',
        })
        .set('x-organization-id', organizationId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockAdjacentStands,
      });

      expect(mockAdjacencyService.findAdjacentStands).toHaveBeenCalledWith(
        standId,
        organizationId,
        {
          minDistance: 50,
          maxImpactLevel: 'MEDIUM',
        }
      );
    });

    it('should return 400 for invalid query parameters', async () => {
      const standId = 'stand-1';

      const response = await request(app)
        .get(`/stands/${standId}/adjacent`)
        .query({
          minDistance: 'invalid', // Should be number
        })
        .set('x-organization-id', organizationId);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid query parameters',
        details: expect.any(Array),
      });
    });
  });
});
