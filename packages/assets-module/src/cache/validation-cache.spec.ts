import { ValidationCache } from './validation-cache';
import { StandCapabilities, ValidationResult, ICAOAircraftCategory } from '../types';
import Redis from 'ioredis';

// Mock Redis
jest.mock('../config/redis.config', () => ({
  getRedisClient: jest.fn(() => {
    const mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      on: jest.fn(),
    };
    return mockRedis;
  }),
}));

describe('ValidationCache', () => {
  let cache: ValidationCache;
  let mockRedis: any;

  const mockCapabilities: StandCapabilities = {
    dimensions: {
      length: 60,
      width: 45,
      icaoCategory: ICAOAircraftCategory.C,
    },
  };

  const mockResult: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    icaoCompliant: true,
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new ValidationCache();
    // Get the mocked Redis instance
    mockRedis = (cache as any).redis;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('get', () => {
    it('should return null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(mockCapabilities);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('should return cached result on cache hit', async () => {
      const cachedEntry = {
        result: mockResult,
        timestamp: Date.now(),
        ttl: 3600,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const result = await cache.get(mockCapabilities);

      expect(result).toEqual(mockResult);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('should use local cache for subsequent requests', async () => {
      const cachedEntry = {
        result: mockResult,
        timestamp: Date.now(),
        ttl: 3600,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

      // First call - hits Redis
      await cache.get(mockCapabilities);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // Second call - should use local cache
      const result = await cache.get(mockCapabilities);
      expect(result).toEqual(mockResult);
      expect(mockRedis.get).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));

      const result = await cache.get(mockCapabilities);

      expect(result).toBeNull();
      const metrics = cache.getMetrics();
      expect(metrics.errors).toBe(1);
    });
  });

  describe('set', () => {
    it('should store validation result in cache', async () => {
      await cache.set(mockCapabilities, mockResult);

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      const [key, ttl, data] = mockRedis.setex.mock.calls[0];
      expect(key).toMatch(/^validation:/);
      expect(ttl).toBe(3600);
      expect(JSON.parse(data)).toMatchObject({
        result: mockResult,
        ttl: 3600,
      });
    });

    it('should use custom TTL when provided', async () => {
      const customTTL = 7200;
      await cache.set(mockCapabilities, mockResult, customTTL);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        customTTL,
        expect.any(String)
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write error'));

      await cache.set(mockCapabilities, mockResult);

      const metrics = cache.getMetrics();
      expect(metrics.errors).toBe(1);
    });
  });

  describe('invalidate', () => {
    it('should remove entry from cache', async () => {
      await cache.invalidate(mockCapabilities);

      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringMatching(/^validation:/));
    });
  });

  describe('invalidatePattern', () => {
    it('should remove all matching entries', async () => {
      const keys = ['validation:abc123', 'validation:def456'];
      mockRedis.keys.mockResolvedValue(keys);

      await cache.invalidatePattern('*');

      expect(mockRedis.keys).toHaveBeenCalledWith('validation:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle empty pattern matches', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cache.invalidatePattern('nonexistent*');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      const keys = ['validation:1', 'validation:2', 'validation:3'];
      mockRedis.keys.mockResolvedValue(keys);

      await cache.clear();

      expect(mockRedis.keys).toHaveBeenCalledWith('validation:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });
  });

  describe('warmCache', () => {
    it('should pre-populate cache with multiple entries', async () => {
      const entries = [
        { capabilities: mockCapabilities, result: mockResult },
        {
          capabilities: { ...mockCapabilities, dimensions: { length: 70, width: 50 } },
          result: { ...mockResult, warnings: [{ message: 'Large stand' }] },
        },
      ];

      await cache.warmCache(entries);

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe('metrics', () => {
    it('should track cache hits and misses', async () => {
      mockRedis.get.mockResolvedValueOnce(null); // Miss
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          result: mockResult,
          timestamp: Date.now(),
          ttl: 3600,
        })
      ); // Hit

      await cache.get(mockCapabilities);
      await cache.get(mockCapabilities);

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });

    it('should reset metrics', () => {
      cache.resetMetrics();
      const metrics = cache.getMetrics();

      expect(metrics).toEqual({
        hits: 0,
        misses: 0,
        errors: 0,
        evictions: 0,
      });
    });
  });

  describe('getCacheInfo', () => {
    it('should return cache size information', async () => {
      mockRedis.keys.mockResolvedValue(['validation:1', 'validation:2']);

      const info = await cache.getCacheInfo();

      expect(info).toMatchObject({
        redisSize: 2,
        localSize: 0,
        metrics: expect.any(Object),
      });
    });
  });
});
