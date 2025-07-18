import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { StandCapabilities, ICAOAircraftCategory } from '../types/stand-capabilities';
import { setupTestApp } from '../test-utils/app-setup';
import { seedTestData } from '../test-utils/seed-data';
import { cleanupTestData } from '../test-utils/cleanup';

describe('Stand Capabilities API Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let organizationId: string;
  let standId: string;
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    const testSetup = await setupTestApp();
    app = testSetup.app;
    prisma = testSetup.prisma;
    organizationId = testSetup.organizationId;
    userId = testSetup.userId;
    authToken = testSetup.authToken;

    const seedData = await seedTestData(prisma, organizationId, userId);
    standId = seedData.standId;
  });

  afterAll(async () => {
    await cleanupTestData(prisma, organizationId);
    await prisma.$disconnect();
  });

  describe('GET /api/v1/stands/:id/capabilities', () => {
    it('should return stand capabilities', async () => {
      const response = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      expect(response.body).toHaveProperty('standId', standId);
      expect(response.body).toHaveProperty('organizationId', organizationId);
      expect(response.body).toHaveProperty('capabilities');
      expect(response.body.capabilities).toHaveProperty('dimensions');
      expect(response.body.capabilities).toHaveProperty('aircraftCompatibility');
      expect(response.body.capabilities).toHaveProperty('groundSupport');
    });

    it('should return 404 for non-existent stand', async () => {
      const response = await request(app)
        .get('/api/v1/stands/non-existent-id/capabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Stand not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('X-Organization-ID', organizationId)
        .expect(401);
    });

    it('should return 403 for different organization', async () => {
      await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', 'different-org-id')
        .expect(403);
    });
  });

  describe('PUT /api/v1/stands/:id/capabilities', () => {
    const updatedCapabilities: Partial<StandCapabilities> = {
      dimensions: {
        length: 65,
        width: 50,
        height: 25,
        wingspan: 70,
        clearances: {
          wingtip: 6,
          nose: 4,
          tail: 4,
        },
        slopes: {
          longitudinal: 0.6,
          transverse: 0.4,
        },
      },
      aircraftCompatibility: {
        supportedCategories: [ICAOAircraftCategory.D],
        maxWingspan: 70,
        maxLength: 65,
        maxWeight: 150000,
        restrictions: ['no_wide_body'],
      },
    };

    it('should update stand capabilities successfully', async () => {
      const response = await request(app)
        .put(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(updatedCapabilities)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('validationResult');
      expect(response.body.validationResult).toHaveProperty('isValid', true);
      expect(response.body).toHaveProperty('stand');
      expect(response.body.stand.dimensions.length).toBe(65);
      expect(response.body.stand.aircraftCompatibility.maxWingspan).toBe(70);
    });

    it('should reject invalid capabilities', async () => {
      const invalidCapabilities = {
        dimensions: {
          length: -10, // Invalid negative length
          width: 50,
        },
      };

      const response = await request(app)
        .put(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(invalidCapabilities)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('validationResult');
      expect(response.body.validationResult).toHaveProperty('isValid', false);
      expect(response.body.validationResult.errors).toHaveLength(1);
    });

    it('should handle malformed request body', async () => {
      const response = await request(app)
        .put(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send('invalid-json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should enforce rate limiting', async () => {
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .put(`/api/v1/stands/${standId}/capabilities`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('X-Organization-ID', organizationId)
            .send(updatedCapabilities)
        );
      }

      const responses = await Promise.all(promises);
      const tooManyRequests = responses.filter((r) => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    it('should support partial updates', async () => {
      const partialUpdate = {
        groundSupport: {
          powerSupply: {
            available: true,
            voltage: 115,
            frequency: 400,
            amperage: 300,
          },
        },
      };

      const response = await request(app)
        .put(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.stand.groundSupport.powerSupply.voltage).toBe(115);
      // Other fields should remain unchanged
      expect(response.body.stand.dimensions).toBeDefined();
    });
  });

  describe('PATCH /api/v1/stands/:id/capabilities/:type', () => {
    it('should update specific capability type', async () => {
      const dimensionUpdate = {
        length: 70,
        width: 55,
        height: 30,
      };

      const response = await request(app)
        .patch(`/api/v1/stands/${standId}/capabilities/dimensions`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(dimensionUpdate)
        .expect(200);

      expect(response.body.stand.dimensions.length).toBe(70);
      expect(response.body.stand.dimensions.width).toBe(55);
      expect(response.body.stand.dimensions.height).toBe(30);
    });

    it('should reject invalid capability type', async () => {
      await request(app)
        .patch(`/api/v1/stands/${standId}/capabilities/invalid-type`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({})
        .expect(400);
    });

    it('should validate specific capability type', async () => {
      const invalidDimensionUpdate = {
        length: 0,
        width: -5,
      };

      const response = await request(app)
        .patch(`/api/v1/stands/${standId}/capabilities/dimensions`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(invalidDimensionUpdate)
        .expect(400);

      expect(response.body.validationResult.isValid).toBe(false);
      expect(response.body.validationResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/stands/capabilities/bulk-update', () => {
    let secondStandId: string;

    beforeAll(async () => {
      const additionalSeedData = await seedTestData(prisma, organizationId, userId);
      secondStandId = additionalSeedData.standId;
    });

    it('should perform bulk update successfully', async () => {
      const bulkOperations = [
        {
          standId: standId,
          capabilities: {
            dimensions: {
              length: 75,
              width: 60,
            },
          },
        },
        {
          standId: secondStandId,
          capabilities: {
            groundSupport: {
              powerSupply: {
                available: true,
                voltage: 400,
                frequency: 50,
                amperage: 250,
              },
            },
          },
        },
      ];

      const response = await request(app)
        .post('/api/v1/stands/capabilities/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({ operations: bulkOperations })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('totalProcessed', 2);
      expect(response.body).toHaveProperty('successCount', 2);
      expect(response.body).toHaveProperty('failureCount', 0);
    });

    it('should handle validation failures in bulk update', async () => {
      const bulkOperations = [
        {
          standId: standId,
          capabilities: {
            dimensions: {
              length: -10, // Invalid
            },
          },
        },
        {
          standId: secondStandId,
          capabilities: {
            groundSupport: {
              powerSupply: {
                available: true,
                voltage: 400,
                frequency: 50,
                amperage: 250,
              },
            },
          },
        },
      ];

      const response = await request(app)
        .post('/api/v1/stands/capabilities/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({ operations: bulkOperations })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.validationErrors).toHaveLength(1);
    });

    it('should enforce bulk operation limits', async () => {
      const bulkOperations = [];
      for (let i = 0; i < 150; i++) {
        bulkOperations.push({
          standId: standId,
          capabilities: {
            dimensions: { length: 60 + i },
          },
        });
      }

      const response = await request(app)
        .post('/api/v1/stands/capabilities/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({ operations: bulkOperations })
        .expect(400);

      expect(response.body.error).toContain('Too many operations');
    });
  });

  describe('POST /api/v1/stands/capabilities/validate', () => {
    it('should validate capabilities without saving', async () => {
      const capabilitiesToValidate: StandCapabilities = {
        dimensions: {
          length: 80,
          width: 65,
          height: 35,
          wingspan: 80,
          clearances: {
            wingtip: 8,
            nose: 5,
            tail: 5,
          },
          slopes: {
            longitudinal: 0.8,
            transverse: 0.5,
          },
        },
        aircraftCompatibility: {
          supportedCategories: [ICAOAircraftCategory.E],
          maxWingspan: 80,
          maxLength: 80,
          maxWeight: 200000,
          restrictions: [],
        },
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(capabilitiesToValidate)
        .expect(200);

      expect(response.body).toHaveProperty('isValid');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('warnings');
      expect(response.body).toHaveProperty('validatedAt');
      expect(response.body).toHaveProperty('validationId');
    });

    it('should return validation errors for invalid capabilities', async () => {
      const invalidCapabilities = {
        dimensions: {
          length: -5,
          width: 0,
        },
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send(invalidCapabilities)
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should support validation options', async () => {
      const capabilities = {
        dimensions: {
          length: 60,
          width: 45,
        },
      };

      const response = await request(app)
        .post('/api/v1/stands/capabilities/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({
          capabilities,
          options: {
            strict: true,
            includePerformance: true,
            skipValidators: [],
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('isValid');
      expect(response.body).toHaveProperty('performance');
    });
  });

  describe('GET /api/v1/stands/:id/capabilities/history', () => {
    it('should return capability history', async () => {
      const response = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('hasMore');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities/history`)
        .query({ limit: 5, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      expect(response.body.history.length).toBeLessThanOrEqual(5);
    });

    it('should filter by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities/history`)
        .query({
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      expect(response.body.history).toBeDefined();
    });
  });

  describe('DELETE /api/v1/stands/:id/capabilities', () => {
    it('should delete capabilities successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({ reason: 'Testing deletion' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should require reason for deletion', async () => {
      const response = await request(app)
        .delete(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Caching behavior', () => {
    it('should cache responses appropriately', async () => {
      // First request
      const response1 = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      // Second request should be faster (cached)
      const start = Date.now();
      const response2 = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);
      const duration = Date.now() - start;

      expect(response1.body).toEqual(response2.body);
      expect(duration).toBeLessThan(100); // Should be very fast due to caching
    });

    it('should invalidate cache on updates', async () => {
      // Get initial capabilities
      const initialResponse = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      // Update capabilities
      const updateResponse = await request(app)
        .put(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .send({
          dimensions: {
            length: 90,
            width: 70,
          },
        })
        .expect(200);

      // Get updated capabilities
      const updatedResponse = await request(app)
        .get(`/api/v1/stands/${standId}/capabilities`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Organization-ID', organizationId)
        .expect(200);

      expect(initialResponse.body.capabilities.dimensions.length).not.toBe(90);
      expect(updatedResponse.body.capabilities.dimensions.length).toBe(90);
    });
  });

  describe('Performance and concurrent operations', () => {
    it('should handle concurrent read operations', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get(`/api/v1/stands/${standId}/capabilities`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('X-Organization-ID', organizationId)
        );
      }

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.standId).toBe(standId);
      });
    });

    it('should handle concurrent write operations', async () => {
      const concurrentUpdates = 5;
      const promises = [];

      for (let i = 0; i < concurrentUpdates; i++) {
        promises.push(
          request(app)
            .put(`/api/v1/stands/${standId}/capabilities`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('X-Organization-ID', organizationId)
            .send({
              dimensions: {
                length: 60 + i,
                width: 45 + i,
              },
            })
        );
      }

      const responses = await Promise.all(promises);
      const successfulUpdates = responses.filter((r) => r.status === 200);
      expect(successfulUpdates.length).toBeGreaterThan(0);
    });
  });
});
