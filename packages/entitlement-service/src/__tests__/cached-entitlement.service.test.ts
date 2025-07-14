import Redis from 'ioredis';
import { CachedEntitlementService } from '../cached-entitlement.service';
import { DatabaseEntitlementService } from '../database-entitlement.service';
import { ModuleKey } from '@capacity-planner/shared-kernel';

// Mock Redis
jest.mock('ioredis');

// Mock DatabaseEntitlementService
jest.mock('../database-entitlement.service');

describe('CachedEntitlementService', () => {
  let service: CachedEntitlementService;
  let mockDbService: jest.Mocked<DatabaseEntitlementService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Redis
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      incr: jest.fn(),
      quit: jest.fn(),
    } as any;
    (Redis as any).mockImplementation(() => mockRedis);

    // Setup mock database service
    mockDbService = new DatabaseEntitlementService() as jest.Mocked<DatabaseEntitlementService>;

    service = new CachedEntitlementService(mockDbService, mockRedis, 300);
  });

  describe('hasAccess', () => {
    it('should return cached value if available', async () => {
      mockRedis.get.mockResolvedValue('true');

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('org1:assets');
      expect(mockDbService.hasAccess).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDbService.hasAccess.mockResolvedValue(true);

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('org1:assets');
      expect(mockDbService.hasAccess).toHaveBeenCalledWith('org1', ModuleKey.ASSETS);
      expect(mockRedis.setex).toHaveBeenCalledWith('org1:assets', 300, 'true');
    });

    it('should handle false values correctly', async () => {
      mockRedis.get.mockResolvedValue('false');

      const result = await service.hasAccess('org1', ModuleKey.ASSETS);

      expect(result).toBe(false);
      expect(mockDbService.hasAccess).not.toHaveBeenCalled();
    });
  });

  describe('grantAccess', () => {
    it('should invalidate cache after granting access', async () => {
      mockDbService.grantAccess.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      await service.grantAccess('org1', ModuleKey.ASSETS, undefined, 'user1');

      expect(mockDbService.grantAccess).toHaveBeenCalledWith(
        'org1',
        ModuleKey.ASSETS,
        undefined,
        'user1'
      );
      expect(mockRedis.del).toHaveBeenCalledTimes(4); // Multiple cache keys
    });
  });

  describe('revokeAccess', () => {
    it('should invalidate cache after revoking access', async () => {
      mockDbService.revokeAccess.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      await service.revokeAccess('org1', ModuleKey.ASSETS, 'user1');

      expect(mockDbService.revokeAccess).toHaveBeenCalledWith('org1', ModuleKey.ASSETS, 'user1');
      expect(mockRedis.del).toHaveBeenCalledTimes(4); // Multiple cache keys
    });
  });

  describe('listEntitlements', () => {
    it('should return cached list if available', async () => {
      const cachedData = JSON.stringify([
        { organizationId: 'org1', moduleKey: ModuleKey.ASSETS, status: 'active' },
      ]);
      mockRedis.get.mockResolvedValue(cachedData);

      const result = await service.listEntitlements('org1');

      expect(result).toHaveLength(1);
      expect(result[0].moduleKey).toBe(ModuleKey.ASSETS);
      expect(mockDbService.listEntitlements).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const dbData = [
        {
          organizationId: 'org1',
          moduleKey: ModuleKey.ASSETS,
          status: 'active' as const,
          updatedBy: 'user1',
          updatedAt: new Date(),
        },
      ];
      mockRedis.get.mockResolvedValue(null);
      mockDbService.listEntitlements.mockResolvedValue(dbData);

      const result = await service.listEntitlements('org1');

      expect(result).toEqual(dbData);
      expect(mockDbService.listEntitlements).toHaveBeenCalledWith('org1');
      expect(mockRedis.setex).toHaveBeenCalledWith('org1:all', 300, JSON.stringify(dbData));
    });
  });

  describe('invalidateAllCache', () => {
    it('should delete all cache keys', async () => {
      const keys = [
        'entitlement:org1:assets',
        'entitlement:org1:all',
        'entitlement:all:entitlements',
      ];
      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.del.mockResolvedValue(3);

      await service.invalidateAllCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('entitlement:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle no keys gracefully', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidateAllCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('entitlement:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'stats:hits') return Promise.resolve('100');
        if (key === 'stats:misses') return Promise.resolve('50');
        return Promise.resolve(null);
      });

      const stats = await service.getCacheStats();

      expect(stats).toEqual({
        hits: 100,
        misses: 50,
        hitRate: 100 / 150,
      });
    });

    it('should handle missing stats', async () => {
      mockRedis.get.mockResolvedValue(null);

      const stats = await service.getCacheStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect both Redis and database', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      mockDbService.disconnect.mockResolvedValue(undefined);

      await service.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
      expect(mockDbService.disconnect).toHaveBeenCalled();
    });
  });
});
