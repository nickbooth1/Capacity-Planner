/**
 * Example: E2E Testing for API Endpoints
 * 
 * This example demonstrates how to write end-to-end tests for API
 * endpoints, including authentication, error handling, and complete flows.
 */

import request from 'supertest';
import { app } from '../../../apps/api-gateway/src/app';
import { PrismaClient } from '@prisma/client';
import { generateAuthToken } from './helpers/auth';
import { createTestOrganization, createTestUser } from './helpers/fixtures';

describe('Stand Capabilities API E2E', () => {
  let prisma: PrismaClient;
  let authToken: string;
  let organizationId: string;

  // Setup
  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    
    // Create test organization and user
    const org = await createTestOrganization(prisma);
    const user = await createTestUser(prisma, { organizationId: org.id });
    
    organizationId = org.id;
    authToken = await generateAuthToken(user);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up stands but keep org/user
    await prisma.stand.deleteMany({ where: { organizationId } });
  });

  describe('GET /api/v1/stands/:id/capabilities', () => {
    it('should return stand capabilities for authorized user', async () => {
      // Create test stand
      const stand = await prisma.stand.create({
        data: {
          organizationId,
          code: 'A1',
          name: 'Alpha 1',
          dimensions: { length: 60, width: 45 },
          aircraftCompatibility: { maxWingspan: 36 },
        },
      });

      const response = await request(app)
        .get(`/api/v1/stands/${stand.id}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: stand.id,
        code: 'A1',
        capabilities: {
          dimensions: { length: 60, width: 45 },
          aircraftCompatibility: { maxWingspan: 36 },
        },
      });
    });

    it('should return 404 for non-existent stand', async () => {
      const response = await request(app)
        .get('/api/v1/stands/invalid-id/capabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Stand not found',
        code: 'STAND_NOT_FOUND',
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/stands/some-id/capabilities')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Authentication required',
      });
    });

    it('should return 403 for unauthorized organization', async () => {
      // Create stand in different org
      const otherStand = await prisma.stand.create({
        data: {
          organizationId: 'other-org',
          code: 'X1',
          name: 'Other Stand',
        },
      });

      const response = await request(app)
        .get(`/api/v1/stands/${otherStand.id}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Access denied',
      });
    });
  });

  describe('PUT /api/v1/stands/:id/capabilities', () => {
    let stand: any;

    beforeEach(async () => {
      stand = await prisma.stand.create({
        data: {
          organizationId,
          code: 'B1',
          name: 'Bravo 1',
        },
      });
    });

    it('should update stand capabilities with validation', async () => {
      const updates = {
        dimensions: {
          length: 70,
          width: 50,
          icaoCategory: 'D',
        },
        aircraftCompatibility: {
          maxWingspan: 52,
          maxLength: 50,
          compatibleCategories: ['C', 'D'],
        },
      };

      const response = await request(app)
        .put(`/api/v1/stands/${stand.id}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        id: stand.id,
        capabilities: updates,
        validation: {
          isValid: true,
          errors: [],
        },
      });

      // Verify in database
      const updated = await prisma.stand.findUnique({
        where: { id: stand.id },
      });
      expect(updated?.dimensions).toEqual(updates.dimensions);
    });

    it('should reject invalid capabilities', async () => {
      const invalidUpdates = {
        dimensions: {
          length: -10, // Invalid negative length
          width: 50,
        },
      };

      const response = await request(app)
        .put(`/api/v1/stands/${stand.id}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdates)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        validation: {
          isValid: false,
          errors: expect.arrayContaining([
            'Stand length must be greater than 0',
          ]),
        },
      });
    });

    it('should create capability snapshot on update', async () => {
      const updates = { dimensions: { length: 65 } };

      await request(app)
        .put(`/api/v1/stands/${stand.id}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      const snapshots = await prisma.standCapabilitySnapshot.findMany({
        where: { standId: stand.id },
      });

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        standId: stand.id,
        previousCapabilities: {},
        newCapabilities: updates,
      });
    });
  });

  describe('POST /api/v1/stands/capabilities/bulk-update', () => {
    beforeEach(async () => {
      // Create multiple stands
      await prisma.stand.createMany({
        data: [
          { organizationId, code: 'A1', name: 'Alpha 1' },
          { organizationId, code: 'A2', name: 'Alpha 2' },
          { organizationId, code: 'A3', name: 'Alpha 3' },
        ],
      });
    });

    it('should update multiple stands in one request', async () => {
      const bulkUpdates = {
        updates: [
          {
            code: 'A1',
            capabilities: { dimensions: { length: 60 } },
          },
          {
            code: 'A2',
            capabilities: { dimensions: { length: 65 } },
          },
          {
            code: 'A3',
            capabilities: { dimensions: { length: 70 } },
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkUpdates)
        .expect(200);

      expect(response.body).toMatchObject({
        updated: 3,
        failed: 0,
        results: expect.arrayContaining([
          { code: 'A1', success: true },
          { code: 'A2', success: true },
          { code: 'A3', success: true },
        ]),
      });
    });

    it('should handle partial failures in bulk update', async () => {
      const bulkUpdates = {
        updates: [
          {
            code: 'A1',
            capabilities: { dimensions: { length: 60 } },
          },
          {
            code: 'INVALID',
            capabilities: { dimensions: { length: 65 } },
          },
          {
            code: 'A3',
            capabilities: { dimensions: { length: -10 } }, // Invalid
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkUpdates)
        .expect(200);

      expect(response.body).toMatchObject({
        updated: 1,
        failed: 2,
        results: expect.arrayContaining([
          { code: 'A1', success: true },
          { code: 'INVALID', success: false, error: 'Stand not found' },
          { code: 'A3', success: false, error: expect.stringContaining('validation') },
        ]),
      });
    });
  });

  describe('POST /api/v1/stands/capabilities/validate', () => {
    it('should validate capabilities without saving', async () => {
      const capabilities = {
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: 'C',
        },
        aircraftCompatibility: {
          maxWingspan: 36,
          compatibleCategories: ['B', 'C'],
        },
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(capabilities)
        .expect(200);

      expect(response.body).toMatchObject({
        isValid: true,
        errors: [],
        warnings: [],
        icaoCompliant: true,
      });
    });

    it('should return detailed validation errors', async () => {
      const invalidCapabilities = {
        dimensions: {
          length: 30,
          width: 25,
          icaoCategory: 'D', // Too small for category D
        },
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCapabilities)
        .expect(200);

      expect(response.body).toMatchObject({
        isValid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('insufficient for Category D'),
        ]),
        icaoCompliant: false,
      });
    });
  });

  describe('Complete workflow test', () => {
    it('should handle complete stand capability management flow', async () => {
      // 1. Create a stand
      const createResponse = await request(app)
        .post('/api/v1/stands')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'E1',
          name: 'Echo 1',
          terminal: 'E',
        })
        .expect(201);

      const standId = createResponse.body.id;

      // 2. Validate capabilities before update
      const validationResponse = await request(app)
        .post('/api/v1/stands/capabilities/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dimensions: { length: 80, width: 65, icaoCategory: 'E' },
        })
        .expect(200);

      expect(validationResponse.body.isValid).toBe(true);

      // 3. Update capabilities
      const updateResponse = await request(app)
        .put(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dimensions: { length: 80, width: 65, icaoCategory: 'E' },
          aircraftCompatibility: {
            maxWingspan: 65,
            specificAircraft: ['A380', 'B747-8'],
          },
        })
        .expect(200);

      // 4. Retrieve and verify
      const getResponse = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.capabilities).toMatchObject({
        dimensions: { length: 80, width: 65, icaoCategory: 'E' },
        aircraftCompatibility: {
          maxWingspan: 65,
          specificAircraft: ['A380', 'B747-8'],
        },
      });

      // 5. Check audit history
      const historyResponse = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body).toHaveLength(1);
      expect(historyResponse.body[0]).toMatchObject({
        action: 'UPDATE',
        changes: expect.any(Object),
        performedBy: expect.any(String),
        performedAt: expect.any(String),
      });
    });
  });

  describe('Performance and load testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const stand = await prisma.stand.create({
        data: { organizationId, code: 'PERF1', name: 'Performance Test' },
      });

      // Send 10 concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get(`/api/v1/stands/${stand.id}/capabilities`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete reasonably fast
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Error scenarios', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .put('/api/v1/stands/some-id/capabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid request body',
      });
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error by disconnecting
      await prisma.$disconnect();

      const response = await request(app)
        .get('/api/v1/stands/some-id/capabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal server error',
        message: expect.any(String),
      });

      // Reconnect for cleanup
      await prisma.$connect();
    });
  });
});