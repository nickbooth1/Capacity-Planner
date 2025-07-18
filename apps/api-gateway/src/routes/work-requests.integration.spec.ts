import request from 'supertest';
import express from 'express';
import workRequestsRouter from './work-requests';

// Mock the work module
jest.mock('@capacity-planner/work-module', () => ({
  WorkRequestService: jest.fn().mockImplementation(() => ({
    createWorkRequest: jest.fn(),
    getWorkRequests: jest.fn(),
    getWorkRequest: jest.fn(),
    updateWorkRequest: jest.fn(),
    validateWorkRequest: jest.fn(),
  })),
  WorkType: {
    MAINTENANCE: 'maintenance',
    INSPECTION: 'inspection',
    REPAIR: 'repair',
  },
  WorkCategory: {
    ROUTINE: 'routine',
    CORRECTIVE: 'corrective',
  },
  Priority: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
  Urgency: {
    ROUTINE: 'routine',
    SCHEDULED: 'scheduled',
    IMMEDIATE: 'immediate',
  },
  ImpactLevel: {
    NO_IMPACT: 'no_impact',
    PARTIAL_RESTRICTION: 'partial_restriction',
    FULL_CLOSURE: 'full_closure',
  },
  AssetType: {
    STAND: 'stand',
    AIRFIELD: 'airfield',
  },
  WorkRequestStatus: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    COMPLETED: 'completed',
  },
}));

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

describe('Work Requests API Integration', () => {
  let app: express.Application;
  let mockWorkRequestService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/work/requests', workRequestsRouter);

    // Get the mocked service instance
    const { WorkRequestService } = require('@capacity-planner/work-module');
    mockWorkRequestService = new WorkRequestService();
  });

  describe('POST /api/work/requests', () => {
    it('should create a work request with valid data', async () => {
      const requestData = {
        assetId: 'test-asset-id',
        workType: 'maintenance',
        category: 'routine',
        priority: 'medium',
        urgency: 'scheduled',
        impactLevel: 'partial_restriction',
        title: 'Test maintenance request',
        description: 'This is a test maintenance request for stand A01',
        requestedStartDate: '2024-02-15T08:00:00Z',
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'test-request-id',
          ...requestData,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockWorkRequestService.createWorkRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/work/requests')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id')
        .send(requestData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workRequest).toBeDefined();
      expect(mockWorkRequestService.createWorkRequest).toHaveBeenCalledWith(
        'test-org-id',
        'test-user-id',
        requestData
      );
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        assetId: 'test-asset-id',
        // Missing title, description, workType
      };

      const response = await request(app)
        .post('/api/work/requests')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return validation errors from service', async () => {
      const requestData = {
        assetId: 'test-asset-id',
        workType: 'maintenance',
        category: 'routine',
        priority: 'medium',
        urgency: 'scheduled',
        impactLevel: 'partial_restriction',
        title: 'x', // Too short
        description: 'y', // Too short
        requestedStartDate: '2024-02-15T08:00:00Z',
      };

      const mockResponse = {
        success: false,
        error: 'Validation failed',
        validationResults: [
          { field: 'title', message: 'Title must be at least 5 characters', severity: 'error' },
          {
            field: 'description',
            message: 'Description must be at least 20 characters',
            severity: 'error',
          },
        ],
      };

      mockWorkRequestService.createWorkRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/work/requests')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.validationResults).toHaveLength(2);
    });
  });

  describe('GET /api/work/requests', () => {
    it('should return paginated work requests', async () => {
      const mockResponse = {
        success: true,
        data: {
          requests: [
            {
              id: 'request-1',
              title: 'Test Request 1',
              status: 'draft',
              priority: 'medium',
              workType: 'maintenance',
              assetCode: 'A01',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          pagination: {
            page: 1,
            pageSize: 25,
            total: 1,
            totalPages: 1,
          },
        },
      };

      mockWorkRequestService.getWorkRequests.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/work/requests')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should apply query filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          requests: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
        },
      };

      mockWorkRequestService.getWorkRequests.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/work/requests')
        .query({
          status: 'draft,submitted',
          priority: 'high',
          page: '2',
          pageSize: '10',
        })
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id');

      expect(response.status).toBe(200);
      expect(mockWorkRequestService.getWorkRequests).toHaveBeenCalledWith(
        'test-org-id',
        'test-user-id',
        expect.objectContaining({
          status: ['draft', 'submitted'],
          priority: ['high'],
        }),
        2,
        10
      );
    });
  });

  describe('GET /api/work/requests/:id', () => {
    it('should return work request details', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'test-request-id',
          title: 'Test Request',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockWorkRequestService.getWorkRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/work/requests/test-request-id')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workRequest.id).toBe('test-request-id');
    });

    it('should return 404 for non-existent work request', async () => {
      const mockResponse = {
        success: false,
        error: 'Work request not found',
      };

      mockWorkRequestService.getWorkRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/work/requests/non-existent-id')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Work request not found');
    });
  });

  describe('PUT /api/work/requests/:id', () => {
    it('should update a work request', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description for the work request',
        priority: 'high',
        version: 1,
      };

      const mockResponse = {
        success: true,
        data: {
          id: 'test-request-id',
          ...updateData,
          version: 2,
          updatedAt: new Date(),
        },
      };

      mockWorkRequestService.updateWorkRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .put('/api/work/requests/test-request-id')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workRequest.title).toBe('Updated Title');
      expect(response.body.data.workRequest.version).toBe(2);
    });

    it('should return 400 for missing version', async () => {
      const updateData = {
        title: 'Updated Title',
        // Missing version
      };

      const response = await request(app)
        .put('/api/work/requests/test-request-id')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Version is required');
    });
  });

  describe('GET /api/work/enums', () => {
    it('should return available enum values', async () => {
      const response = await request(app)
        .get('/api/work/enums')
        .set('x-user-id', 'test-user-id')
        .set('x-organization-id', 'test-org-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workTypes).toContain('maintenance');
      expect(response.body.data.priorities).toContain('medium');
      expect(response.body.data.statuses).toContain('draft');
    });
  });
});
