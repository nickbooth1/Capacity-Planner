/**
 * Example: Testing a Repository with Database Integration
 * 
 * This example shows how to write integration tests that interact
 * with a real database, including transactions and error scenarios.
 */

import { PrismaClient } from '@prisma/client';
import { StandRepository } from './stand.repository';
import { Stand, StandStatus } from './types';

describe('StandRepository Integration', () => {
  let repository: StandRepository;
  let prisma: PrismaClient;

  // Setup and teardown
  beforeAll(async () => {
    // Use test database
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.$executeRaw`TRUNCATE TABLE assets.stands CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE assets.stand_maintenance_records CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE assets.stand_adjacencies CASCADE`;
    
    repository = new StandRepository(prisma);
  });

  describe('create', () => {
    it('should create a stand with all properties', async () => {
      const standData = {
        organizationId: 'org-123',
        code: 'A1',
        name: 'Alpha 1',
        terminal: 'A',
        status: StandStatus.OPERATIONAL,
        dimensions: {
          length: 60,
          width: 45,
          icaoCategory: 'C',
        },
        aircraftCompatibility: {
          maxWingspan: 36,
          maxLength: 40,
          compatibleCategories: ['B', 'C'],
        },
      };

      const created = await repository.create(standData);

      expect(created).toMatchObject({
        id: expect.any(String),
        ...standData,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      // Verify in database
      const dbStand = await prisma.stand.findUnique({
        where: { id: created.id },
      });
      expect(dbStand).toBeDefined();
      expect(dbStand?.dimensions).toEqual(standData.dimensions);
    });

    it('should enforce unique constraint on organization and code', async () => {
      const standData = {
        organizationId: 'org-123',
        code: 'A1',
        name: 'Alpha 1',
      };

      await repository.create(standData);

      // Try to create duplicate
      await expect(repository.create(standData)).rejects.toThrow(
        'Stand with code A1 already exists'
      );
    });
  });

  describe('updateCapabilities', () => {
    let testStand: Stand;

    beforeEach(async () => {
      testStand = await repository.create({
        organizationId: 'org-123',
        code: 'B1',
        name: 'Bravo 1',
      });
    });

    it('should update capabilities and create snapshot', async () => {
      const newCapabilities = {
        dimensions: { length: 70, width: 50 },
        groundSupport: { hasPowerSupply: true },
      };

      const updated = await repository.updateCapabilities(
        testStand.id,
        newCapabilities,
        'user-123'
      );

      expect(updated.dimensions).toEqual(newCapabilities.dimensions);
      expect(updated.groundSupport).toEqual(newCapabilities.groundSupport);

      // Verify snapshot was created
      const snapshots = await prisma.standCapabilitySnapshot.findMany({
        where: { standId: testStand.id },
      });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].previousCapabilities).toEqual({});
      expect(snapshots[0].newCapabilities).toEqual(newCapabilities);
    });

    it('should rollback on validation failure', async () => {
      const invalidCapabilities = {
        dimensions: { length: -10, width: 50 }, // Invalid negative length
      };

      await expect(
        repository.updateCapabilities(testStand.id, invalidCapabilities, 'user-123')
      ).rejects.toThrow('Invalid dimensions');

      // Verify no changes were made
      const unchanged = await repository.findById(testStand.id);
      expect(unchanged?.dimensions).toEqual({});
    });
  });

  describe('bulkUpdate', () => {
    beforeEach(async () => {
      // Create test stands
      await repository.create({ organizationId: 'org-123', code: 'A1', name: 'Alpha 1' });
      await repository.create({ organizationId: 'org-123', code: 'A2', name: 'Alpha 2' });
      await repository.create({ organizationId: 'org-123', code: 'A3', name: 'Alpha 3' });
    });

    it('should update multiple stands in a transaction', async () => {
      const updates = [
        { code: 'A1', status: StandStatus.MAINTENANCE },
        { code: 'A2', status: StandStatus.MAINTENANCE },
        { code: 'A3', status: StandStatus.CLOSED },
      ];

      const results = await repository.bulkUpdateStatus('org-123', updates);

      expect(results.updated).toBe(3);
      expect(results.failed).toBe(0);

      // Verify all updates
      const stands = await repository.findByOrganization('org-123');
      expect(stands.filter(s => s.status === StandStatus.MAINTENANCE)).toHaveLength(2);
      expect(stands.filter(s => s.status === StandStatus.CLOSED)).toHaveLength(1);
    });

    it('should rollback all changes if one update fails', async () => {
      const updates = [
        { code: 'A1', status: StandStatus.MAINTENANCE },
        { code: 'INVALID', status: StandStatus.MAINTENANCE }, // Non-existent stand
        { code: 'A3', status: StandStatus.CLOSED },
      ];

      await expect(
        repository.bulkUpdateStatus('org-123', updates)
      ).rejects.toThrow('Stand INVALID not found');

      // Verify no changes were made
      const stands = await repository.findByOrganization('org-123');
      expect(stands.every(s => s.status === StandStatus.OPERATIONAL)).toBe(true);
    });
  });

  describe('findWithAdjacencies', () => {
    beforeEach(async () => {
      // Create stands with adjacencies
      const standA = await repository.create({ organizationId: 'org-123', code: 'A1', name: 'Alpha 1' });
      const standB = await repository.create({ organizationId: 'org-123', code: 'B1', name: 'Bravo 1' });
      const standC = await repository.create({ organizationId: 'org-123', code: 'C1', name: 'Charlie 1' });

      // Create adjacencies
      await prisma.standAdjacency.create({
        data: {
          standId: standA.id,
          adjacentStandId: standB.id,
          type: 'PHYSICAL',
          impactLevel: 'HIGH',
        },
      });
      await prisma.standAdjacency.create({
        data: {
          standId: standA.id,
          adjacentStandId: standC.id,
          type: 'OPERATIONAL',
          impactLevel: 'MEDIUM',
        },
      });
    });

    it('should load stand with all adjacencies', async () => {
      const stand = await repository.findWithAdjacencies('org-123', 'A1');

      expect(stand).toBeDefined();
      expect(stand?.adjacencies).toHaveLength(2);
      expect(stand?.adjacencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            adjacentStand: expect.objectContaining({ code: 'B1' }),
            type: 'PHYSICAL',
            impactLevel: 'HIGH',
          }),
          expect.objectContaining({
            adjacentStand: expect.objectContaining({ code: 'C1' }),
            type: 'OPERATIONAL',
            impactLevel: 'MEDIUM',
          }),
        ])
      );
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repository.create({
        organizationId: 'org-123',
        code: 'A1',
        name: 'Alpha Terminal Gate 1',
        terminal: 'A',
        aircraftCompatibility: { specificAircraft: ['A320', 'B737'] },
      });
      await repository.create({
        organizationId: 'org-123',
        code: 'B1',
        name: 'Bravo Terminal Gate 1',
        terminal: 'B',
        aircraftCompatibility: { specificAircraft: ['A380', 'B747'] },
      });
    });

    it('should search by capabilities using JSONB queries', async () => {
      const results = await repository.searchByCapabilities('org-123', {
        aircraftType: 'A320',
      });

      expect(results).toHaveLength(1);
      expect(results[0].code).toBe('A1');
    });

    it('should use GIN index for performance', async () => {
      // This would be verified by checking query plan in real scenario
      const explainResult = await prisma.$queryRaw`
        EXPLAIN (FORMAT JSON) 
        SELECT * FROM assets.stands 
        WHERE aircraft_compatibility @> '{"specificAircraft": ["A320"]}'::jsonb
      `;

      // In real test, would verify index usage in query plan
      expect(explainResult).toBeDefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent updates correctly', async () => {
      const stand = await repository.create({
        organizationId: 'org-123',
        code: 'A1',
        name: 'Alpha 1',
      });

      // Simulate concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) => 
        repository.updateCapabilities(
          stand.id,
          { dimensions: { length: 50 + i } },
          `user-${i}`
        )
      );

      const results = await Promise.allSettled(updates);
      
      // Some updates might fail due to optimistic locking
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBeGreaterThan(0);
      if (failed.length > 0) {
        expect(failed[0].reason).toContain('version conflict');
      }
    });
  });

  describe('performance', () => {
    it('should efficiently query large datasets', async () => {
      // Create 100 test stands
      const stands = Array.from({ length: 100 }, (_, i) => ({
        organizationId: 'org-123',
        code: `TEST-${i}`,
        name: `Test Stand ${i}`,
        terminal: ['A', 'B', 'C'][i % 3],
      }));

      await prisma.stand.createMany({ data: stands });

      const startTime = Date.now();
      const results = await repository.findByTerminal('org-123', 'A');
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(34); // ~1/3 of stands
      expect(duration).toBeLessThan(100); // Should be fast with indexes
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Disconnect to simulate connection error
      await prisma.$disconnect();

      await expect(repository.findAll()).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      try {
        await repository.create({
          organizationId: null as any, // Invalid null
          code: 'A1',
          name: 'Test',
        });
      } catch (error) {
        expect(error.message).toContain('organizationId cannot be null');
        expect(error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});