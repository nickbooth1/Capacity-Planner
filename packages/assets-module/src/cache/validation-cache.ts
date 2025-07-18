import { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { StandCapabilities, ValidationResult } from '../types';
import { getRedisClient } from '../config/redis.config';

interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
  ttl: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  evictions: number;
}

export class ValidationCache {
  private redis: Redis;
  private localCache: Map<string, CacheEntry>;
  private metrics: CacheMetrics;
  private readonly prefix = 'validation:';
  private readonly defaultTTL = 3600; // 1 hour in seconds
  private readonly localCacheMaxSize = 1000;
  private readonly localCacheTTL = 300000; // 5 minutes in milliseconds

  constructor() {
    this.redis = getRedisClient();
    this.localCache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      evictions: 0,
    };

    // Periodic cleanup of local cache
    setInterval(() => this.cleanupLocalCache(), 60000); // Every minute
  }

  /**
   * Generate cache key from capabilities
   */
  private generateKey(capabilities: StandCapabilities): string {
    const normalized = JSON.stringify(capabilities, Object.keys(capabilities).sort());
    const hash = createHash('sha256').update(normalized).digest('hex');
    return `${this.prefix}${hash}`;
  }

  /**
   * Get validation result from cache
   */
  async get(capabilities: StandCapabilities): Promise<ValidationResult | null> {
    const key = this.generateKey(capabilities);

    try {
      // Check local cache first
      const localEntry = this.localCache.get(key);
      if (localEntry && Date.now() - localEntry.timestamp < this.localCacheTTL) {
        this.metrics.hits++;
        return localEntry.result;
      }

      // Check Redis cache
      const redisData = await this.redis.get(key);
      if (redisData) {
        const entry: CacheEntry = JSON.parse(redisData);

        // Update local cache
        this.updateLocalCache(key, entry);

        this.metrics.hits++;
        return entry.result;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set validation result in cache
   */
  async set(
    capabilities: StandCapabilities,
    result: ValidationResult,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey(capabilities);
    const ttlSeconds = ttl || this.defaultTTL;

    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    };

    try {
      // Set in Redis with expiration
      await this.redis.setex(key, ttlSeconds, JSON.stringify(entry));

      // Update local cache
      this.updateLocalCache(key, entry);
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(capabilities: StandCapabilities): Promise<void> {
    const key = this.generateKey(capabilities);

    try {
      await this.redis.del(key);
      this.localCache.delete(key);
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.prefix}${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);

        // Clear matching entries from local cache
        for (const [localKey] of this.localCache) {
          if (localKey.includes(pattern)) {
            this.localCache.delete(localKey);
          }
        }
      }
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache invalidate pattern error:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.localCache.clear();
    } catch (error) {
      this.metrics.errors++;
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      evictions: 0,
    };
  }

  /**
   * Warm cache with pre-validated results
   */
  async warmCache(
    entries: Array<{ capabilities: StandCapabilities; result: ValidationResult }>
  ): Promise<void> {
    const promises = entries.map(({ capabilities, result }) => this.set(capabilities, result));

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  /**
   * Get cache size information
   */
  async getCacheInfo(): Promise<{
    redisSize: number;
    localSize: number;
    metrics: CacheMetrics;
  }> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      return {
        redisSize: keys.length,
        localSize: this.localCache.size,
        metrics: this.getMetrics(),
      };
    } catch (error) {
      return {
        redisSize: -1,
        localSize: this.localCache.size,
        metrics: this.getMetrics(),
      };
    }
  }

  /**
   * Update local cache with LRU eviction
   */
  private updateLocalCache(key: string, entry: CacheEntry): void {
    // Evict oldest entries if cache is full
    if (this.localCache.size >= this.localCacheMaxSize) {
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey) {
        this.localCache.delete(oldestKey);
        this.metrics.evictions++;
      }
    }

    this.localCache.set(key, entry);
  }

  /**
   * Clean up expired entries from local cache
   */
  private cleanupLocalCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.localCache) {
      if (now - entry.timestamp > this.localCacheTTL) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => {
      this.localCache.delete(key);
      this.metrics.evictions++;
    });
  }
}
