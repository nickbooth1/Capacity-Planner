import { ModuleKey } from '@capacity-planner/shared-kernel';
import Redis from 'ioredis';
import { EntitlementService, Entitlement } from './index';
import { DatabaseEntitlementService } from './database-entitlement.service';

export class CachedEntitlementService implements EntitlementService {
  private redis: Redis;
  private dbService: DatabaseEntitlementService;
  private cacheTTL: number;

  constructor(
    dbService: DatabaseEntitlementService,
    redis?: Redis,
    cacheTTL: number = 300 // 5 minutes default
  ) {
    this.dbService = dbService;
    this.redis =
      redis ||
      new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        keyPrefix: 'entitlement:',
      });
    this.cacheTTL = cacheTTL;
  }

  private getCacheKey(orgId: string, moduleKey?: ModuleKey): string {
    return moduleKey ? `${orgId}:${moduleKey}` : `${orgId}:all`;
  }

  async hasAccess(orgId: string, moduleKey: ModuleKey): Promise<boolean> {
    const cacheKey = this.getCacheKey(orgId, moduleKey);

    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    // Get from database
    const hasAccess = await this.dbService.hasAccess(orgId, moduleKey);

    // Cache the result
    await this.redis.setex(cacheKey, this.cacheTTL, hasAccess.toString());

    return hasAccess;
  }

  async grantAccess(
    orgId: string,
    moduleKey: ModuleKey,
    validUntil?: Date,
    userId?: string
  ): Promise<void> {
    // Update database
    await this.dbService.grantAccess(orgId, moduleKey, validUntil, userId);

    // Invalidate related cache entries
    await this.invalidateCache(orgId, moduleKey);
  }

  async revokeAccess(orgId: string, moduleKey: ModuleKey, userId?: string): Promise<void> {
    // Update database
    await this.dbService.revokeAccess(orgId, moduleKey, userId);

    // Invalidate related cache entries
    await this.invalidateCache(orgId, moduleKey);
  }

  async listEntitlements(orgId: string): Promise<Entitlement[]> {
    const cacheKey = this.getCacheKey(orgId);

    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const entitlements = await this.dbService.listEntitlements(orgId);

    // Cache the result
    await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(entitlements));

    return entitlements;
  }

  async getEntitlement(orgId: string, moduleKey: ModuleKey): Promise<Entitlement | null> {
    const cacheKey = `single:${this.getCacheKey(orgId, moduleKey)}`;

    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached === 'null' ? null : JSON.parse(cached);
    }

    // Get from database
    const entitlement = await this.dbService.getEntitlement(orgId, moduleKey);

    // Cache the result
    await this.redis.setex(
      cacheKey,
      this.cacheTTL,
      entitlement ? JSON.stringify(entitlement) : 'null'
    );

    return entitlement;
  }

  async getAllEntitlements(): Promise<Entitlement[]> {
    const cacheKey = 'all:entitlements';

    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const entitlements = await this.dbService.getAllEntitlements();

    // Cache the result with shorter TTL for global data
    await this.redis.setex(cacheKey, this.cacheTTL / 2, JSON.stringify(entitlements));

    return entitlements;
  }

  async getAuditHistory(orgId: string, moduleKey?: ModuleKey, limit: number = 50): Promise<any[]> {
    // Audit history is not cached
    return await this.dbService.getAuditHistory(orgId, moduleKey, limit);
  }

  private async invalidateCache(orgId: string, moduleKey?: ModuleKey): Promise<void> {
    const keys = [
      this.getCacheKey(orgId, moduleKey),
      this.getCacheKey(orgId),
      `single:${this.getCacheKey(orgId, moduleKey)}`,
      'all:entitlements',
    ];

    if (moduleKey) {
      keys.push(this.getCacheKey(orgId, moduleKey));
    }

    // Delete all related cache entries
    await Promise.all(keys.map((key) => this.redis.del(key)));
  }

  async invalidateAllCache(): Promise<void> {
    const pattern = 'entitlement:*';
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    await this.dbService.disconnect();
  }

  // Cache statistics methods
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    const hits = parseInt((await this.redis.get('stats:hits')) || '0');
    const misses = parseInt((await this.redis.get('stats:misses')) || '0');
    const total = hits + misses;

    return {
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
    };
  }

  private async recordCacheHit(): Promise<void> {
    await this.redis.incr('stats:hits');
  }

  private async recordCacheMiss(): Promise<void> {
    await this.redis.incr('stats:misses');
  }
}
