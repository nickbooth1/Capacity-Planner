import { PrismaClient } from '@prisma/client';

// Database connection configuration with pooling
export interface DatabaseConfig {
  connectionLimit: number;
  maxIdleTime: number;
  connectionTimeout: number;
  queryTimeout: number;
}

const config: DatabaseConfig = {
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  maxIdleTime: parseInt(process.env.DB_MAX_IDLE_TIME || '30', 10), // seconds
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10), // milliseconds
  queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10), // milliseconds
};

// Singleton Prisma client with connection pooling
let prismaClient: PrismaClient | null = null;

export const createPrismaClient = (): PrismaClient => {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // Connection pool configuration via connection string parameters
      // These are appended to DATABASE_URL:
      // ?connection_limit=10&pool_timeout=30&statement_cache_size=100
    });

    // Add middleware for query performance tracking
    prismaClient.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();

      // Log slow queries in production
      if (process.env.NODE_ENV === 'production' && after - before > 1000) {
        console.warn(
          `Slow query detected: ${params.model}.${params.action} took ${after - before}ms`
        );
      }

      return result;
    });

    // Add middleware for automatic retry on connection errors
    prismaClient.$use(async (params, next) => {
      let retries = 3;
      let result;

      while (retries > 0) {
        try {
          result = await next(params);
          break;
        } catch (error: any) {
          retries--;

          // Only retry on connection errors
          if (error.code === 'P1001' || error.code === 'P1002') {
            if (retries === 0) {
              throw error;
            }

            // Wait before retry with exponential backoff
            const delay = (3 - retries) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw error;
        }
      }

      return result;
    });
  }

  return prismaClient;
};

export const getPrismaClient = (): PrismaClient => {
  return createPrismaClient();
};

// Close database connections
export const closeDatabaseConnection = async (): Promise<void> => {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
};

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

// Get connection pool statistics (if available)
export const getConnectionPoolStats = async (): Promise<{
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
}> => {
  try {
    const client = getPrismaClient();
    // This would need actual pool metrics from the database driver
    // For now, return placeholder values
    const result = await client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;

    const activeConnections = Number(result[0]?.count || 0);

    return {
      activeConnections,
      idleConnections: config.connectionLimit - activeConnections,
      totalConnections: config.connectionLimit,
      waitingRequests: 0,
    };
  } catch (error) {
    console.error('Failed to get connection pool stats:', error);
    return {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: config.connectionLimit,
      waitingRequests: 0,
    };
  }
};

export default {
  config,
  createPrismaClient,
  getPrismaClient,
  closeDatabaseConnection,
  checkDatabaseHealth,
  getConnectionPoolStats,
};
