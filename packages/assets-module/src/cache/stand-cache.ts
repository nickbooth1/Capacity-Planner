import { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { Stand, StandFilters, PaginatedResult } from '../types';
import { getRedisClient } from '../config/redis.config';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  evictions: number;
}

export class StandCache {
  private redis: Redis;
  private localCache: Map<string, CacheEntry<any>>;
  private metrics: CacheMetrics;
  private readonly prefix = 'stand:';
  private readonly listPrefix = 'stand:list:';
  private readonly statsPrefix = 'stand:stats:';
  private readonly defaultTTL = 300; // 5 minutes in seconds
  private readonly listTTL = 60; // 1 minute for list queries
  private readonly statsTTL = 300; // 5 minutes for statistics
  private readonly localCacheMaxSize = 500;
  private readonly localCacheTTL = 60000; // 1 minute in milliseconds

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
    setInterval(() => this.cleanupLocalCache(), 30000); // Every 30 seconds
  }

  /**
   * Generate cache key for single stand
   */
  private generateStandKey(standId: string, organizationId: string): string {
    return `${this.prefix}${organizationId}:${standId}`;
  }

  /**
   * Generate cache key for stand list
   */
  private generateListKey(
    organizationId: string,
    filters: StandFilters,
    page: number,
    pageSize: number
  ): string {
    const normalized = JSON.stringify(
      { filters, page, pageSize },
      Object.keys({ filters, page, pageSize }).sort()
    );
    const hash = createHash('sha256').update(normalized).digest('hex');
    return `${this.listPrefix}${organizationId}:${hash}`;
  }

  /**
   * Generate cache key for statistics
   */
  private generateStatsKey(organizationId: string): string {
    return `${this.statsPrefix}${organizationId}`;
  }

  /**
   * Get stand by ID from cache
   */
  async getStand(standId: string, organizationId: string): Promise<Stand | null> {
    const key = this.generateStandKey(standId, organizationId);

    try {
      // Check local cache first
      const localEntry = this.localCache.get(key);
      if (localEntry && Date.now() - localEntry.timestamp < this.localCacheTTL) {
        this.metrics.hits++;
        return localEntry.data;
      }

      // Check Redis cache
      const redisData = await this.redis.get(key);
      if (redisData) {
        const entry: CacheEntry<Stand> = JSON.parse(redisData);

        // Update local cache
        this.updateLocalCache(key, entry);

        this.metrics.hits++;
        return entry.data;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      this.metrics.errors++;
      console.error('Stand cache get error:', error);
      return null;
    }
  }

  /**
   * Set stand in cache
   */
  async setStand(stand: Stand, organizationId: string, ttl?: number): Promise<void> {
    const key = this.generateStandKey(stand.id, organizationId);
    const ttlSeconds = ttl || this.defaultTTL;

    const entry: CacheEntry<Stand> = {
      data: stand,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    };

    try {
      // Set in Redis with expiration
      await this.redis.setex(key, ttlSeconds, JSON.stringify(entry));

      // Update local cache
      this.updateLocalCache(key, entry);

      // Also invalidate any list caches that might contain this stand
      await this.invalidateListCaches(organizationId);
    } catch (error) {
      this.metrics.errors++;
      console.error('Stand cache set error:', error);
    }
  }

  /**
   * Get stand list from cache
   */
  async getStandList(
    organizationId: string,
    filters: StandFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<Stand> | null> {
    const key = this.generateListKey(organizationId, filters, page, pageSize);

    try {
      // Check local cache first
      const localEntry = this.localCache.get(key);
      if (localEntry && Date.now() - localEntry.timestamp < this.localCacheTTL) {
        this.metrics.hits++;
        return localEntry.data;
      }

      // Check Redis cache
      const redisData = await this.redis.get(key);
      if (redisData) {
        const entry: CacheEntry<PaginatedResult<Stand>> = JSON.parse(redisData);

        // Update local cache
        this.updateLocalCache(key, entry);

        this.metrics.hits++;
        return entry.data;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      this.metrics.errors++;
      console.error('Stand list cache get error:', error);
      return null;
    }
  }

  /**
   * Set stand list in cache
   */
  async setStandList(
    result: PaginatedResult<Stand>,
    organizationId: string,
    filters: StandFilters,
    page: number,
    pageSize: number,
    ttl?: number
  ): Promise<void> {
    const key = this.generateListKey(organizationId, filters, page, pageSize);
    const ttlSeconds = ttl || this.listTTL;

    const entry: CacheEntry<PaginatedResult<Stand>> = {
      data: result,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    };

    try {
      // Set in Redis with expiration
      await this.redis.setex(key, ttlSeconds, JSON.stringify(entry));

      // Update local cache
      this.updateLocalCache(key, entry);

      // Also cache individual stands
      for (const stand of result.data) {
        await this.setStand(stand, organizationId, this.defaultTTL);
      }
    } catch (error) {
      this.metrics.errors++;
      console.error('Stand list cache set error:', error);
    }
  }

  /**
   * Get statistics from cache
   */
  async getStats(organizationId: string): Promise<any | null> {
    const key = this.generateStatsKey(organizationId);

    try {
      const redisData = await this.redis.get(key);
      if (redisData) {
        this.metrics.hits++;
        return JSON.parse(redisData);
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      this.metrics.errors++;
      console.error('Stats cache get error:', error);
      return null;
    }
  }

  /**
   * Set statistics in cache
   */
  async setStats(stats: any, organizationId: string, ttl?: number): Promise<void> {
    const key = this.generateStatsKey(organizationId);
    const ttlSeconds = ttl || this.statsTTL;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(stats));
    } catch (error) {
      this.metrics.errors++;
      console.error('Stats cache set error:', error);
    }
  }

  /**
   * Invalidate stand cache
   */
  async invalidateStand(standId: string, organizationId: string): Promise<void> {
    const key = this.generateStandKey(standId, organizationId);

    try {
      await this.redis.del(key);
      this.localCache.delete(key);

      // Also invalidate list caches and stats
      await this.invalidateListCaches(organizationId);
      await this.invalidateStats(organizationId);
    } catch (error) {
      this.metrics.errors++;
      console.error('Stand cache invalidate error:', error);
    }
  }

  /**
   * Invalidate all list caches for an organization
   */
  async invalidateListCaches(organizationId: string): Promise<void> {
    try {
      const pattern = `${this.listPrefix}${organizationId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);

        // Clear matching entries from local cache
        for (const [localKey] of this.localCache) {
          if (localKey.startsWith(`${this.listPrefix}${organizationId}:`)) {
            this.localCache.delete(localKey);
          }
        }
      }
    } catch (error) {
      this.metrics.errors++;
      console.error('List cache invalidate error:', error);
    }
  }

  /**
   * Invalidate statistics cache
   */
  async invalidateStats(organizationId: string): Promise<void> {
    const key = this.generateStatsKey(organizationId);

    try {
      await this.redis.del(key);
    } catch (error) {
      this.metrics.errors++;
      console.error('Stats cache invalidate error:', error);
    }
  }

  /**
   * Clear all caches for an organization
   */
  async clearOrganizationCache(organizationId: string): Promise<void> {
    try {
      // Clear individual stand caches
      const standKeys = await this.redis.keys(`${this.prefix}${organizationId}:*`);
      if (standKeys.length > 0) {
        await this.redis.del(...standKeys);
      }

      // Clear list caches
      await this.invalidateListCaches(organizationId);

      // Clear stats cache
      await this.invalidateStats(organizationId);

      // Clear from local cache
      const keysToDelete: string[] = [];
      for (const [key] of this.localCache) {
        if (key.includes(organizationId)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.localCache.delete(key));
    } catch (error) {
      this.metrics.errors++;
      console.error('Clear organization cache error:', error);
    }
  }

  /**
   * Warm cache with frequently accessed stands
   */
  async warmCache(stands: Stand[], organizationId: string): Promise<void> {
    const promises = stands.map((stand) => this.setStand(stand, organizationId));

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Cache warming error:', error);
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
  private updateLocalCache(key: string, entry: CacheEntry<any>): void {
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
