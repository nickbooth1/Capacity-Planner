import { createClient, RedisClientType } from 'redis';

export class WorkRequestCacheService {
  private redis: RedisClientType;
  private isConnected: boolean = false;
  private defaultTTL: number = 300; // 5 minutes

  constructor(redisUrl?: string, ttl?: number) {
    this.redis = createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    });

    if (ttl) {
      this.defaultTTL = ttl;
    }

    this.redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.redis.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.redis.on('disconnect', () => {
      console.log('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.redis.connect();
        this.isConnected = true;
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        this.isConnected = false;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
  }

  private generateKey(prefix: string, ...parts: string[]): string {
    return `work-request:${prefix}:${parts.join(':')}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const ttlToUse = ttl || this.defaultTTL;
      await this.redis.setEx(key, ttlToUse, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Work request specific cache methods
  async getWorkRequest(id: string, organizationId: string): Promise<any> {
    const key = this.generateKey('request', organizationId, id);
    return this.get(key);
  }

  async setWorkRequest(id: string, organizationId: string, data: any, ttl?: number): Promise<void> {
    const key = this.generateKey('request', organizationId, id);
    await this.set(key, data, ttl);
  }

  async invalidateWorkRequest(id: string, organizationId: string): Promise<void> {
    const key = this.generateKey('request', organizationId, id);
    await this.del(key);
  }

  async getWorkRequestsList(organizationId: string, filtersHash: string): Promise<any> {
    const key = this.generateKey('list', organizationId, filtersHash);
    return this.get(key);
  }

  async setWorkRequestsList(
    organizationId: string,
    filtersHash: string,
    data: any,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey('list', organizationId, filtersHash);
    await this.set(key, data, ttl || 60); // Shorter TTL for lists
  }

  async invalidateWorkRequestsList(organizationId: string): Promise<void> {
    const pattern = this.generateKey('list', organizationId, '*');
    await this.invalidatePattern(pattern);
  }

  async getStandData(standId: string, organizationId: string): Promise<any> {
    const key = this.generateKey('stand', organizationId, standId);
    return this.get(key);
  }

  async setStandData(
    standId: string,
    organizationId: string,
    data: any,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey('stand', organizationId, standId);
    await this.set(key, data, ttl || 600); // 10 minutes for stand data
  }

  async invalidateStandData(standId: string, organizationId: string): Promise<void> {
    const key = this.generateKey('stand', organizationId, standId);
    await this.del(key);
  }

  async getStandsList(organizationId: string, filtersHash: string): Promise<any> {
    const key = this.generateKey('stands-list', organizationId, filtersHash);
    return this.get(key);
  }

  async setStandsList(
    organizationId: string,
    filtersHash: string,
    data: any,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey('stands-list', organizationId, filtersHash);
    await this.set(key, data, ttl || 300); // 5 minutes for stands list
  }

  async invalidateStandsList(organizationId: string): Promise<void> {
    const pattern = this.generateKey('stands-list', organizationId, '*');
    await this.invalidatePattern(pattern);
  }

  async getValidationResult(dataHash: string): Promise<any> {
    const key = this.generateKey('validation', dataHash);
    return this.get(key);
  }

  async setValidationResult(dataHash: string, result: any, ttl?: number): Promise<void> {
    const key = this.generateKey('validation', dataHash);
    await this.set(key, result, ttl || 120); // 2 minutes for validation results
  }

  // Utility method to create hash for cache keys
  createHash(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}
