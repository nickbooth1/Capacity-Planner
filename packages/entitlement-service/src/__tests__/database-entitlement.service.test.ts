import { PrismaClient } from '.prisma/entitlement-service';
import { DatabaseEntitlementService } from '../database-entitlement.service';
import { ModuleKey } from '@capacity-planner/shared-kernel';

// Mock Prisma Client
jest.mock('.prisma/entitlement-service', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    entitlement: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    entitlementAudit: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

describe('DatabaseEntitlementService', () => {
  let service: DatabaseEntitlementService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
    service = new DatabaseEntitlementService(mockPrisma);
  });

  afterEach(async () => {
    await service.disconnect();
  });

  describe('hasAccess', () => {
    it('should return true for active entitlement', async () => {
      const mockEntitlement = {
        id: '1',
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active',
        validUntil: null,
      };

      mockPrisma.entitlement.findUnique.mockResolvedValue(mockEntitlement);

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);
      expect(result).toBe(true);
      expect(mockPrisma.entitlement.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_moduleKey: {
            organizationId: 'org1',
            moduleKey: ModuleKey.ASSETS,
          },
        },
      });
    });

    it('should return false for non-existent entitlement', async () => {
      mockPrisma.entitlement.findUnique.mockResolvedValue(null);

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);
      expect(result).toBe(false);
    });

    it('should return false for suspended entitlement', async () => {
      const mockEntitlement = {
        id: '1',
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'suspended',
        validUntil: null,
      };

      mockPrisma.entitlement.findUnique.mockResolvedValue(mockEntitlement);

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);
      expect(result).toBe(false);
    });

    it('should return false for expired entitlement', async () => {
      const mockEntitlement = {
        id: '1',
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active',
        validUntil: new Date('2020-01-01'),
      };

      mockPrisma.entitlement.findUnique.mockResolvedValue(mockEntitlement);

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);
      expect(result).toBe(false);
    });

    it('should return true for active entitlement with future expiry', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockEntitlement = {
        id: '1',
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active',
        validUntil: futureDate,
      };

      mockPrisma.entitlement.findUnique.mockResolvedValue(mockEntitlement);

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);
      expect(result).toBe(true);
    });
  });

  describe('grantAccess', () => {
    it('should create new entitlement if none exists', async () => {
      mockPrisma.entitlement.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          entitlement: {
            create: jest.fn().mockResolvedValue({ id: 'new-id' }),
          },
          entitlementAudit: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await service.grantAccess('org1', ModuleKey.ASSETS, undefined, 'user1');

      expect(mockPrisma.entitlement.findUnique).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should update existing entitlement', async () => {
      const existingEntitlement = {
        id: 'existing-id',
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'suspended',
        validUntil: null,
      };

      mockPrisma.entitlement.findUnique.mockResolvedValue(existingEntitlement);
      mockPrisma.$transaction.mockImplementation(async (callbacks) => {
        return Promise.all(callbacks);
      });
      mockPrisma.entitlement.update.mockResolvedValue({});
      mockPrisma.entitlementAudit.create.mockResolvedValue({});

      await service.grantAccess('org1', ModuleKey.ASSETS, undefined, 'user1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('revokeAccess', () => {
    it('should suspend existing entitlement', async () => {
      const existingEntitlement = {
        id: 'existing-id',
        organizationId: 'org1',
        moduleKey: ModuleKey.ASSETS,
        status: 'active',
        validUntil: null,
      };

      mockPrisma.entitlement.findUnique.mockResolvedValue(existingEntitlement);
      mockPrisma.$transaction.mockImplementation(async (callbacks) => {
        return Promise.all(callbacks);
      });
      mockPrisma.entitlement.update.mockResolvedValue({});
      mockPrisma.entitlementAudit.create.mockResolvedValue({});

      await service.revokeAccess('org1', ModuleKey.ASSETS, 'user1');

      expect(mockPrisma.entitlement.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: {
          status: 'suspended',
          updatedBy: 'user1',
        },
      });
    });

    it('should throw error if entitlement not found', async () => {
      mockPrisma.entitlement.findUnique.mockResolvedValue(null);

      await expect(service.revokeAccess('org1', ModuleKey.ASSETS, 'user1')).rejects.toThrow(
        'No entitlement found'
      );
    });
  });

  describe('listEntitlements', () => {
    it('should return all entitlements for organization', async () => {
      const mockEntitlements = [
        {
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
          status: 'active',
          validUntil: null,
          updatedBy: 'user1',
          updatedAt: new Date(),
        },
        {
          organizationId: 'org1',
          moduleKey: ModuleKey.WORK,
          status: 'suspended',
          validUntil: null,
          updatedBy: 'user2',
          updatedAt: new Date(),
        },
      ];

      mockPrisma.entitlement.findMany.mockResolvedValue(mockEntitlements);

      const result = await service.listEntitlements('org1');

      expect(result).toHaveLength(2);
      expect(result[0].moduleKey).toBe(ModuleKey.ASSETS);
      expect(result[1].moduleKey).toBe(ModuleKey.WORK);
      expect(mockPrisma.entitlement.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { moduleKey: 'asc' },
      });
    });
  });

  describe('getAuditHistory', () => {
    it('should return audit history for organization', async () => {
      const mockAudits = [
        {
          id: 'audit1',
          entitlementId: 'ent1',
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
          action: 'created',
          performedBy: 'user1',
          performedAt: new Date(),
        },
      ];

      mockPrisma.entitlementAudit.findMany.mockResolvedValue(mockAudits);

      const result = await service.getAuditHistory('org1', ModuleKey.ASSETS, 10);

      expect(result).toHaveLength(1);
      expect(mockPrisma.entitlementAudit.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
        },
        orderBy: { performedAt: 'desc' },
        take: 10,
      });
    });
  });
});
