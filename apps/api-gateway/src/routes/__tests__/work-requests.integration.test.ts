import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import workRequestRoutes from '../work-requests';
import { WorkRequestStatus, Priority, WorkType, AssetType } from '@capacity-planner/work-module';

const app = express();
app.use(express.json());
app.use('/work-requests', workRequestRoutes);

jest.mock('@prisma/client');

describe('Work Request API Integration Tests', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /work-requests', () => {
    it('should create a new work request', async () => {
      const newRequest = {
        assetId: 'asset-123',
        assetType: AssetType.STAND,
        workType: WorkType.MAINTENANCE,
        category: 'routine',
        priority: Priority.MEDIUM,
        urgency: 'scheduled',
        impactLevel: 'partial_restriction',
        title: 'Routine Stand Maintenance',
        description: 'Monthly inspection and maintenance',
        requestedStartDate: '2024-02-01T08:00:00Z',
      };

      const response = await request(app)
        .post('/work-requests')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .send(newRequest);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('workRequestId');
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        assetId: 'asset-123',
        // Missing required fields
      };

      const response = await request(app)
        .post('/work-requests')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /work-requests', () => {
    it('should retrieve work requests with filters', async () => {
      const response = await request(app)
        .get('/work-requests')
        .set('x-organization-id', 'org-123')
        .query({
          status: WorkRequestStatus.SUBMITTED,
          priority: Priority.HIGH,
          page: 1,
          pageSize: 20,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.requests');
      expect(response.body).toHaveProperty('data.pagination');
    });

    it('should handle empty results', async () => {
      const response = await request(app)
        .get('/work-requests')
        .set('x-organization-id', 'org-123')
        .query({
          status: WorkRequestStatus.CANCELLED,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.requests).toEqual([]);
    });
  });

  describe('GET /work-requests/:id', () => {
    it('should retrieve a specific work request', async () => {
      const response = await request(app)
        .get('/work-requests/req-123')
        .set('x-organization-id', 'org-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should handle not found', async () => {
      const response = await request(app)
        .get('/work-requests/non-existent')
        .set('x-organization-id', 'org-123');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /work-requests/:id', () => {
    it('should update a work request', async () => {
      const updates = {
        title: 'Updated Title',
        priority: Priority.CRITICAL,
        version: 1,
      };

      const response = await request(app)
        .put('/work-requests/req-123')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /work-requests/:id/status', () => {
    it('should update work request status', async () => {
      const response = await request(app)
        .post('/work-requests/req-123/status')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .send({
          status: WorkRequestStatus.IN_PROGRESS,
          reason: 'Starting work',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Approval Workflow Endpoints', () => {
    it('should get pending approvals', async () => {
      const response = await request(app)
        .get('/work-requests/approvals/pending')
        .set('x-user-id', 'approver-123')
        .set('x-organization-id', 'org-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.entries');
    });

    it('should approve a work request', async () => {
      const response = await request(app)
        .post('/work-requests/req-123/approve')
        .set('x-user-id', 'approver-123')
        .set('x-organization-id', 'org-123')
        .send({
          comments: 'Approved for immediate action',
          conditions: 'Complete by end of week',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject a work request', async () => {
      const response = await request(app)
        .post('/work-requests/req-123/reject')
        .set('x-user-id', 'approver-123')
        .set('x-organization-id', 'org-123')
        .send({
          comments: 'Budget constraints',
          requestInfo: 'Please resubmit next quarter',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('File Upload Endpoints', () => {
    it('should upload files to work request', async () => {
      const response = await request(app)
        .post('/work-requests/req-123/attachments')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .attach('files', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('attachmentIds');
    });

    it('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/work-requests/req-123/attachments')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .attach('files', Buffer.from('test'), 'test.exe');

      expect(response.status).toBe(400);
    });
  });

  describe('Repository Search and Export', () => {
    it('should search work requests with advanced filters', async () => {
      const response = await request(app)
        .post('/work-requests/search')
        .set('x-organization-id', 'org-123')
        .send({
          filters: {
            status: [WorkRequestStatus.APPROVED, WorkRequestStatus.IN_PROGRESS],
            priority: [Priority.HIGH, Priority.CRITICAL],
            search: 'maintenance',
          },
          sortOptions: [
            { field: 'priority', direction: 'desc' },
            { field: 'createdAt', direction: 'asc' },
          ],
          page: 1,
          pageSize: 50,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.requests');
    });

    it('should export work requests to Excel', async () => {
      const response = await request(app)
        .post('/work-requests/export')
        .set('x-organization-id', 'org-123')
        .send({
          filters: {
            status: [WorkRequestStatus.COMPLETED],
          },
          format: 'excel',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    it('should export work requests to CSV', async () => {
      const response = await request(app)
        .post('/work-requests/export')
        .set('x-organization-id', 'org-123')
        .send({
          filters: {},
          format: 'csv',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk approval', async () => {
      const response = await request(app)
        .post('/work-requests/bulk')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .send({
          requestIds: ['req-1', 'req-2', 'req-3'],
          operation: 'approve',
          params: {
            comments: 'Bulk approved',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('processedCount');
    });
  });

  describe('Dashboard and Analytics', () => {
    it('should get dashboard stats', async () => {
      const response = await request(app)
        .get('/work-requests/dashboard/stats')
        .set('x-organization-id', 'org-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.totalRequests');
      expect(response.body).toHaveProperty('data.byStatus');
    });
  });

  describe('Reporting Endpoints', () => {
    it('should get performance metrics', async () => {
      const response = await request(app)
        .get('/work-requests/reports/metrics')
        .set('x-organization-id', 'org-123')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('metrics');
    });

    it('should get KPI metrics', async () => {
      const response = await request(app)
        .get('/work-requests/reports/kpis')
        .set('x-organization-id', 'org-123')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('kpis');
    });

    it('should generate a report', async () => {
      const response = await request(app)
        .post('/work-requests/reports/generate')
        .set('x-organization-id', 'org-123')
        .send({
          templateId: 'operational-daily',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('report');
    });
  });

  describe('Chart Data Endpoints', () => {
    it('should get status distribution chart', async () => {
      const response = await request(app)
        .get('/work-requests/charts/status-distribution')
        .set('x-organization-id', 'org-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.config');
      expect(response.body).toHaveProperty('data.series');
    });

    it('should get request volume chart', async () => {
      const response = await request(app)
        .get('/work-requests/charts/request-volume')
        .set('x-organization-id', 'org-123')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          groupBy: 'week',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.config.type).toBe('line');
    });

    it('should get cost analysis chart', async () => {
      const response = await request(app)
        .get('/work-requests/charts/cost-analysis')
        .set('x-organization-id', 'org-123')
        .query({
          groupBy: 'category',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Saved Views', () => {
    it('should create a saved view', async () => {
      const response = await request(app)
        .post('/work-requests/views')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123')
        .send({
          name: 'My High Priority View',
          filters: {
            priority: [Priority.HIGH, Priority.CRITICAL],
            status: [WorkRequestStatus.SUBMITTED],
          },
          sortOptions: [{ field: 'priority', direction: 'desc' }],
          isShared: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('viewId');
    });

    it('should get saved views', async () => {
      const response = await request(app)
        .get('/work-requests/views')
        .set('x-user-id', 'user-123')
        .set('x-organization-id', 'org-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('views');
    });
  });
});
