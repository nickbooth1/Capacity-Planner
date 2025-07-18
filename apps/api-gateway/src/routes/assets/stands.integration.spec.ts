import request from 'supertest';
import express, { Application } from 'express';
import { PrismaClient } from '@prisma/client';
import standsRouter from './stands';

// Mock Prisma Client
const mockPrisma = {
  stand: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  standImportJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient;

// Mock services
jest.mock('@capacity-planner/assets-module', () => ({
  StandCapabilityService: jest.fn().mockImplementation(() => ({
    getCapabilities: jest.fn(),
    updateCapabilities: jest.fn(),
    validateCapabilities: jest.fn(),
    queryByCapabilities: jest.fn(),
    getCapabilityHistory: jest.fn(),
    getCapabilityStatistics: jest.fn(),
  })),
  StandCRUDService: jest.fn().mockImplementation(() => ({
    createStand: jest.fn(),
    updateStand: jest.fn(),
    deleteStand: jest.fn(),
    getStandById: jest.fn(),
    getStands: jest.fn(),
    getStandStats: jest.fn(),
  })),
  StandImportService: jest.fn().mockImplementation(() => ({
    startImport: jest.fn(),
    getImportStatus: jest.fn(),
    getImportJobs: jest.fn(),
  })),
  CapabilityValidationEngine: jest.fn().mockImplementation(() => ({
    validate: jest.fn(),
    invalidateCache: jest.fn(),
  })),
}));

describe('Stands API Integration Tests', () => {
  let app: Application;
  let mockStandCRUDService: any;
  let mockStandImportService: any;

  const organizationId = 'test-org-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/stands', standsRouter);

    // Get mocked service instances
    const { StandCRUDService, StandImportService } = require('@capacity-planner/assets-module');
    mockStandCRUDService = new StandCRUDService();
    mockStandImportService = new StandImportService();

    jest.clearAllMocks();
  });

  describe('GET /api/stands', () => {
    it('should return paginated stands list', async () => {
      const mockStands = {
        data: [
          { id: 'stand-1', code: 'A1', name: 'Stand A1' },
          { id: 'stand-2', code: 'A2', name: 'Stand A2' },
        ],
        meta: {
          total: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
        },
      };

      mockStandCRUDService.getStands.mockResolvedValue(mockStands);

      const response = await request(app)
        .get('/api/stands')
        .set('X-Organization-Id', organizationId)
        .query({ page: 1, pageSize: 50 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockStands,
      });
      expect(mockStandCRUDService.getStands).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ page: '1', pageSize: '50' }),
        1,
        50
      );
    });

    it('should handle filters', async () => {
      mockStandCRUDService.getStands.mockResolvedValue({ data: [], meta: {} });

      await request(app).get('/api/stands').set('X-Organization-Id', organizationId).query({
        status: 'operational',
        terminal: 'Terminal 1',
        search: 'A1',
      });

      expect(mockStandCRUDService.getStands).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          status: 'operational',
          terminal: 'Terminal 1',
          search: 'A1',
        }),
        1,
        50
      );
    });

    it('should return 400 if organization ID missing', async () => {
      const response = await request(app).get('/api/stands');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Organization ID is required',
      });
    });
  });

  describe('POST /api/stands', () => {
    const createRequest = {
      code: 'A1',
      name: 'Stand A1',
      terminal: 'Terminal 1',
      status: 'operational',
    };

    it('should create a new stand', async () => {
      const mockStand = {
        id: 'stand-1',
        ...createRequest,
        organizationId,
        createdBy: userId,
      };

      mockStandCRUDService.createStand.mockResolvedValue(mockStand);

      const response = await request(app)
        .post('/api/stands')
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send(createRequest);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: mockStand,
      });
      expect(mockStandCRUDService.createStand).toHaveBeenCalledWith(
        organizationId,
        createRequest,
        userId
      );
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/stands')
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send({ name: 'Missing code' });

      expect(response.status).toBe(400);
      expect(mockStandCRUDService.createStand).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockStandCRUDService.createStand.mockRejectedValue(
        new Error('Stand with code A1 already exists')
      );

      const response = await request(app)
        .post('/api/stands')
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send(createRequest);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Stand with code A1 already exists',
      });
    });
  });

  describe('GET /api/stands/:id', () => {
    const standId = 'stand-1';

    it('should retrieve a stand by ID', async () => {
      const mockStand = {
        id: standId,
        code: 'A1',
        name: 'Stand A1',
      };

      mockStandCRUDService.getStandById.mockResolvedValue(mockStand);

      const response = await request(app)
        .get(`/api/stands/${standId}`)
        .set('X-Organization-Id', organizationId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockStand,
      });
      expect(mockStandCRUDService.getStandById).toHaveBeenCalledWith(
        standId,
        organizationId,
        false
      );
    });

    it('should include deleted stands when requested', async () => {
      mockStandCRUDService.getStandById.mockResolvedValue({ id: standId, isDeleted: true });

      await request(app)
        .get(`/api/stands/${standId}`)
        .set('X-Organization-Id', organizationId)
        .query({ includeDeleted: 'true' });

      expect(mockStandCRUDService.getStandById).toHaveBeenCalledWith(standId, organizationId, true);
    });

    it('should return 404 if stand not found', async () => {
      mockStandCRUDService.getStandById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/stands/${standId}`)
        .set('X-Organization-Id', organizationId);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Stand not found',
      });
    });
  });

  describe('PUT /api/stands/:id', () => {
    const standId = 'stand-1';
    const updateRequest = {
      name: 'Updated Stand A1',
      status: 'maintenance',
      version: 1,
    };

    it('should update a stand', async () => {
      const mockUpdatedStand = {
        id: standId,
        ...updateRequest,
        version: 2,
        updatedBy: userId,
      };

      mockStandCRUDService.updateStand.mockResolvedValue(mockUpdatedStand);

      const response = await request(app)
        .put(`/api/stands/${standId}`)
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockUpdatedStand,
      });
      expect(mockStandCRUDService.updateStand).toHaveBeenCalledWith(
        standId,
        organizationId,
        updateRequest,
        userId
      );
    });

    it('should return 409 for version conflicts', async () => {
      mockStandCRUDService.updateStand.mockRejectedValue(
        new Error('Stand has been modified by another user')
      );

      const response = await request(app)
        .put(`/api/stands/${standId}`)
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send(updateRequest);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        error: 'Stand has been modified by another user',
      });
    });
  });

  describe('DELETE /api/stands/:id', () => {
    const standId = 'stand-1';

    it('should soft delete a stand', async () => {
      mockStandCRUDService.deleteStand.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/stands/${standId}`)
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Stand deleted successfully',
      });
      expect(mockStandCRUDService.deleteStand).toHaveBeenCalledWith(
        standId,
        organizationId,
        userId
      );
    });
  });

  describe('POST /api/stands/import', () => {
    it('should start an import job', async () => {
      const importRequest = {
        filename: 'stands.csv',
        fileUrl: '/tmp/stands.csv',
      };

      const mockJob = {
        id: 'job-1',
        ...importRequest,
        status: 'pending',
        organizationId,
        createdBy: userId,
      };

      mockStandImportService.startImport.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/stands/import')
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send(importRequest);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: mockJob,
      });
      expect(mockStandImportService.startImport).toHaveBeenCalledWith(
        organizationId,
        importRequest.filename,
        importRequest.fileUrl,
        userId
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/stands/import')
        .set('X-Organization-Id', organizationId)
        .set('X-User-Id', userId)
        .send({ filename: 'missing-url.csv' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Filename and fileUrl are required',
      });
    });
  });

  describe('GET /api/stands/import/:jobId', () => {
    const jobId = 'job-1';

    it('should retrieve import job status', async () => {
      const mockJob = {
        id: jobId,
        status: 'processing',
        totalRows: 100,
        processedRows: 50,
      };

      mockStandImportService.getImportStatus.mockResolvedValue(mockJob);

      const response = await request(app)
        .get(`/api/stands/import/${jobId}`)
        .set('X-Organization-Id', organizationId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockJob,
      });
    });

    it('should return 404 for non-existent job', async () => {
      mockStandImportService.getImportStatus.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/stands/import/${jobId}`)
        .set('X-Organization-Id', organizationId);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Import job not found',
      });
    });
  });
});
