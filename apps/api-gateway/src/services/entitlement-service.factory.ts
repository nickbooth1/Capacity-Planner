import { PrismaClient } from '.prisma/entitlement-service';
import Redis from 'ioredis';
import {
  DatabaseEntitlementService,
  CachedEntitlementService,
  MockEntitlementService,
  ExtendedEntitlementService,
} from '@capacity-planner/entitlement-service';

export interface EntitlementServiceConfig {
  useMock?: boolean;
  useCache?: boolean;
  redisHost?: string;
  redisPort?: number;
  cacheTTL?: number;
}

export function createEntitlementService(
  config: EntitlementServiceConfig = {}
): ExtendedEntitlementService {
  const {
    useMock = process.env.USE_MOCK_SERVICES === 'true',
    useCache = process.env.ENABLE_REDIS_CACHE === 'true',
    redisHost = process.env.REDIS_HOST || 'localhost',
    redisPort = parseInt(process.env.REDIS_PORT || '6379'),
    cacheTTL = parseInt(process.env.CACHE_TTL || '300'),
  } = config;

  // Use mock service for development/testing
  if (useMock) {
    console.log('Using MockEntitlementService');
    return new MockEntitlementService() as any; // Mock doesn't implement all extended methods
  }

  // Create Prisma client
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Create database service
  const dbService = new DatabaseEntitlementService(prisma);
  console.log('Using DatabaseEntitlementService');

  // Wrap with cache if enabled
  if (useCache) {
    try {
      const redis = new Redis({
        host: redisHost,
        port: redisPort,
        keyPrefix: 'entitlement:',
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      // Test Redis connection
      redis.on('connect', () => {
        console.log(`Redis connected at ${redisHost}:${redisPort}`);
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      console.log(`Using CachedEntitlementService with TTL: ${cacheTTL}s`);
      return new CachedEntitlementService(dbService, redis, cacheTTL);
    } catch (error) {
      console.error('Failed to initialize Redis, falling back to database-only service:', error);
      return dbService;
    }
  }

  return dbService;
}

// Singleton instance for the application
let serviceInstance: ExtendedEntitlementService | null = null;

export function getEntitlementService(
  config?: EntitlementServiceConfig
): ExtendedEntitlementService {
  if (!serviceInstance) {
    serviceInstance = createEntitlementService(config);
  }
  return serviceInstance;
}

// Cleanup function for graceful shutdown
export async function closeEntitlementService(): Promise<void> {
  if (serviceInstance && 'disconnect' in serviceInstance) {
    await serviceInstance.disconnect();
    serviceInstance = null;
  }
}
