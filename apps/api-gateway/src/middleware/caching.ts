import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// Cache configuration
interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size in MB
  enabled: boolean;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  etag: string;
  contentType: string;
  expires: number;
}

class APICache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private totalSize: number = 0;

  constructor(config: CacheConfig) {
    this.config = config;

    // Clean up expired entries every 5 minutes
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  private generateCacheKey(req: Request): string {
    const { method, originalUrl, headers } = req;
    const organizationId = headers['x-organization-id'] || '';
    const userId = headers['x-user-id'] || '';

    const keyData = {
      method,
      url: originalUrl,
      organizationId,
      userId,
      query: req.query,
    };

    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private cleanup(): void {
    const now = Date.now();
    let removedSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        removedSize += this.calculateSize(entry.data);
        this.cache.delete(key);
      }
    }

    this.totalSize -= removedSize;
  }

  private evictLRU(): void {
    // Simple LRU eviction - remove oldest entry
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.totalSize -= this.calculateSize(entry.data);
        this.cache.delete(oldestKey);
      }
    }
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key: string, data: any, contentType: string = 'application/json'): void {
    if (!this.config.enabled) return;

    const size = this.calculateSize(data);
    const maxSizeBytes = this.config.maxSize * 1024 * 1024; // Convert to bytes

    // Check if single entry is too large
    if (size > maxSizeBytes) return;

    // Evict entries if cache is full
    while (this.totalSize + size > maxSizeBytes && this.cache.size > 0) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      etag: createHash('md5').update(JSON.stringify(data)).digest('hex'),
      contentType,
      expires: Date.now() + this.config.ttl * 1000,
    };

    this.cache.set(key, entry);
    this.totalSize += size;
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.totalSize -= this.calculateSize(entry.data);
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  getStats(): {
    size: number;
    entries: number;
    hitRate: number;
    totalSize: number;
  } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      totalSize: this.totalSize,
    };
  }
}

// Global cache instance
const cache = new APICache({
  ttl: 300, // 5 minutes
  maxSize: 100, // 100MB
  enabled: process.env.NODE_ENV === 'production',
});

/**
 * Middleware for caching GET requests
 */
export const cacheMiddleware = (
  options: {
    ttl?: number;
    skipCache?: boolean;
    keyGenerator?: (req: Request) => string;
  } = {}
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET' || options.skipCache) {
      return next();
    }

    const cacheKey = options.keyGenerator
      ? options.keyGenerator(req)
      : cache['generateCacheKey'](req);
    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry) {
      // Set cache headers
      res.set('Cache-Control', `public, max-age=${options.ttl || 300}`);
      res.set('ETag', cachedEntry.etag);
      res.set('X-Cache', 'HIT');
      res.set('Content-Type', cachedEntry.contentType);

      // Check if client has fresh copy
      if (req.headers['if-none-match'] === cachedEntry.etag) {
        return res.status(304).send();
      }

      return res.json(cachedEntry.data);
    }

    // Store original json method
    const originalJson = res.json;

    // Override json method to cache response
    res.json = function (body: any) {
      if (res.statusCode === 200 && body.success) {
        cache.set(cacheKey, body, 'application/json');
      }

      // Set cache headers
      res.set('Cache-Control', `public, max-age=${options.ttl || 300}`);
      res.set('X-Cache', 'MISS');

      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware for cache invalidation
 */
export const invalidateCache = (pattern: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to invalidate cache after successful response
    res.json = function (body: any) {
      if (res.statusCode < 300) {
        cache.invalidate(pattern);
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware for cache warming
 */
export const warmCache = (endpoints: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // This would implement cache warming logic
    // For now, just pass through
    next();
  };
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return cache.getStats();
};

/**
 * Clear all cache
 */
export const clearCache = () => {
  cache.clear();
};

/**
 * Cache configuration endpoints
 */
export const cacheConfigMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/cache/stats') {
    return res.json({
      success: true,
      data: getCacheStats(),
    });
  }

  if (req.path === '/api/cache/clear' && req.method === 'POST') {
    clearCache();
    return res.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  }

  next();
};

export default cache;
