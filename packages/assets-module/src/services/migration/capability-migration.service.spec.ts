import { CapabilityMigrationService } from './capability-migration.service';
import { PrismaClient } from '@prisma/client';
import { ICAOAircraftCategory } from '../../types';

describe('CapabilityMigrationService', () => {
  let service: CapabilityMigrationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      stand: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      standCapabilitySnapshot: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new CapabilityMigrationService(mockPrisma);
  });

  describe('migrateLegacyCapabilities', () => {
    it('should migrate legacy capabilities to new structure', async () => {
      const mockStand = {
        id: 'stand-1',
        code: 'A1',
        capabilities: {
          aircraftSize: 'large',
          maxWeight: 250000,
          hasPowerSupply: true,
          hasGroundSupport: true,
          hasJetbridge: true,
        },
      };

      mockPrisma.stand.count.mockResolvedValue(1);
      mockPrisma.stand.findMany.mockResolvedValueOnce([mockStand]);
      mockPrisma.stand.findMany.mockResolvedValueOnce([]);

      const progress = await service.migrateLegacyCapabilities('org-1', {
        dryRun: false,
      });

      expect(progress).toEqual({
        total: 1,
        processed: 1,
        successful: 1,
        failed: 0,
        errors: [],
      });

      expect(mockPrisma.stand.update).toHaveBeenCalledWith({
        where: { id: 'stand-1' },
        data: expect.objectContaining({
          dimensions: expect.objectContaining({
            length: 65,
            width: 50,
            icaoCategory: ICAOAircraftCategory.D,
          }),
          aircraftCompatibility: expect.objectContaining({
            maxWeight: 250000,
            maxWingspan: 52,
            compatibleCategories: [
              ICAOAircraftCategory.A,
              ICAOAircraftCategory.B,
              ICAOAircraftCategory.C,
              ICAOAircraftCategory.D,
            ],
          }),
          groundSupport: expect.objectContaining({
            hasPowerSupply: true,
            powerSupplyType: ['400Hz'],
            pushbackRequired: true,
          }),
          infrastructure: expect.objectContaining({
            hasJetbridge: true,
            jetbridgeType: 'single',
            lightingType: ['LED'],
          }),
        }),
      });

      expect(mockPrisma.standCapabilitySnapshot.create).toHaveBeenCalled();
    });

    it('should handle dry run without making changes', async () => {
      const mockStand = {
        id: 'stand-1',
        code: 'A1',
        capabilities: { aircraftSize: 'medium' },
      };

      mockPrisma.stand.count.mockResolvedValue(1);
      mockPrisma.stand.findMany.mockResolvedValueOnce([mockStand]);
      mockPrisma.stand.findMany.mockResolvedValueOnce([]);

      const progress = await service.migrateLegacyCapabilities('org-1', {
        dryRun: true,
      });

      expect(progress.processed).toBe(1);
      expect(mockPrisma.stand.update).not.toHaveBeenCalled();
      expect(mockPrisma.standCapabilitySnapshot.create).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockStand = {
        id: 'stand-1',
        code: 'A1',
        capabilities: { invalid: 'data' },
      };

      mockPrisma.stand.count.mockResolvedValue(1);
      mockPrisma.stand.findMany.mockResolvedValueOnce([mockStand]);
      mockPrisma.stand.findMany.mockResolvedValueOnce([]);
      mockPrisma.stand.update.mockRejectedValue(new Error('Update failed'));

      const progress = await service.migrateLegacyCapabilities('org-1');

      expect(progress.failed).toBe(1);
      expect(progress.errors).toHaveLength(1);
      expect(progress.errors[0]).toEqual({
        standCode: 'A1',
        error: 'Update failed',
      });
    });

    it('should process stands in batches', async () => {
      const mockStands = Array.from({ length: 5 }, (_, i) => ({
        id: `stand-${i}`,
        code: `A${i}`,
        capabilities: { aircraftSize: 'small' },
      }));

      mockPrisma.stand.count.mockResolvedValue(5);
      mockPrisma.stand.findMany
        .mockResolvedValueOnce(mockStands.slice(0, 2))
        .mockResolvedValueOnce(mockStands.slice(2, 4))
        .mockResolvedValueOnce(mockStands.slice(4, 5))
        .mockResolvedValueOnce([]);

      const progress = await service.migrateLegacyCapabilities('org-1', {
        batchSize: 2,
      });

      expect(progress.processed).toBe(5);
      expect(mockPrisma.stand.findMany).toHaveBeenCalledTimes(4);
    });

    it('should call progress callback', async () => {
      const mockStand = {
        id: 'stand-1',
        code: 'A1',
        capabilities: { aircraftSize: 'medium' },
      };

      mockPrisma.stand.count.mockResolvedValue(1);
      mockPrisma.stand.findMany.mockResolvedValueOnce([mockStand]);
      mockPrisma.stand.findMany.mockResolvedValueOnce([]);

      const onProgress = jest.fn();

      await service.migrateLegacyCapabilities('org-1', { onProgress });

      expect(onProgress).toHaveBeenCalledWith({
        total: 1,
        processed: 1,
        successful: 1,
        failed: 0,
        errors: [],
      });
    });
  });

  describe('validateMigration', () => {
    it('should return valid when migration is complete', async () => {
      mockPrisma.stand.count.mockResolvedValue(0);

      const result = await service.validateMigration('org-1');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect stands with both old and new capabilities', async () => {
      mockPrisma.stand.count
        .mockResolvedValueOnce(5) // stands with both
        .mockResolvedValueOnce(0); // stands without any

      const result = await service.validateMigration('org-1');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('5 stands have both legacy and new capabilities');
    });

    it('should detect stands without any capabilities', async () => {
      mockPrisma.stand.count
        .mockResolvedValueOnce(0) // stands with both
        .mockResolvedValueOnce(3); // stands without any

      const result = await service.validateMigration('org-1');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('3 stands have no capabilities');
    });
  });
});
