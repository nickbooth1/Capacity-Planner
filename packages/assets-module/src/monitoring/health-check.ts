import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
}

export class HealthCheckService {
  private readonly version: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis
  ) {
    this.version = process.env.APP_VERSION || '1.0.0';
  }

  /**
   * Perform comprehensive health check
   */
  async check(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    const startTime = Date.now();

    // Database check
    checks.database = await this.checkDatabase();

    // Redis check
    if (this.redis) {
      checks.redis = await this.checkRedis();
    }

    // Memory check
    checks.memory = this.checkMemory();

    // Disk space check
    checks.disk = await this.checkDiskSpace();

    // API dependencies check
    checks.dependencies = await this.checkDependencies();

    // Calculate overall status
    const hasFailure = Object.values(checks).some((check) => check.status === 'fail');
    const hasWarning = Object.values(checks).some((check) => check.status === 'warn');

    const status = hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: this.version,
      checks,
    };
  }

  /**
   * Database health check
   */
  private async checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
    const start = Date.now();

    try {
      // Perform a simple query
      await this.prisma.$queryRaw`SELECT 1`;

      // Check connection pool
      const pool = await this.prisma.$metrics.json();
      const activeConnections =
        pool.counters.find((c) => c.key === 'prisma_client_queries_active')?.value || 0;

      const responseTime = Date.now() - start;

      if (activeConnections > 80) {
        return {
          status: 'warn',
          message: 'High database connection usage',
          responseTime,
          details: { activeConnections },
        };
      }

      return {
        status: 'pass',
        message: 'Database is healthy',
        responseTime,
        details: { activeConnections },
      };
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Database connection failed: ${error.message}`,
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Redis health check
   */
  private async checkRedis(): Promise<HealthCheckResult['checks'][string]> {
    if (!this.redis) {
      return {
        status: 'pass',
        message: 'Redis not configured',
      };
    }

    const start = Date.now();

    try {
      // Ping Redis
      await this.redis.ping();

      // Check memory usage
      const info = await this.redis.info('memory');
      const memoryUsed = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
      const maxMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');

      const responseTime = Date.now() - start;

      if (maxMemory > 0 && memoryUsed / maxMemory > 0.9) {
        return {
          status: 'warn',
          message: 'Redis memory usage is high',
          responseTime,
          details: {
            memoryUsed,
            maxMemory,
            percentage: Math.round((memoryUsed / maxMemory) * 100),
          },
        };
      }

      return {
        status: 'pass',
        message: 'Redis is healthy',
        responseTime,
        details: {
          memoryUsed,
          maxMemory: maxMemory || 'unlimited',
        },
      };
    } catch (error: any) {
      return {
        status: 'fail',
        message: `Redis connection failed: ${error.message}`,
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Memory health check
   */
  private checkMemory(): HealthCheckResult['checks'][string] {
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usedMemory = usage.heapUsed;
    const percentage = (usedMemory / totalMemory) * 100;

    if (percentage > 90) {
      return {
        status: 'fail',
        message: 'Critical memory usage',
        details: {
          usedMemory,
          totalMemory,
          percentage: Math.round(percentage),
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
        },
      };
    }

    if (percentage > 70) {
      return {
        status: 'warn',
        message: 'High memory usage',
        details: {
          usedMemory,
          totalMemory,
          percentage: Math.round(percentage),
        },
      };
    }

    return {
      status: 'pass',
      message: 'Memory usage is normal',
      details: {
        usedMemory,
        totalMemory,
        percentage: Math.round(percentage),
      },
    };
  }

  /**
   * Disk space health check
   */
  private async checkDiskSpace(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('df -h /');
      const lines = stdout.trim().split('\n');
      const data = lines[1].split(/\s+/);
      const usagePercent = parseInt(data[4]);

      if (usagePercent > 90) {
        return {
          status: 'fail',
          message: 'Critical disk space',
          details: {
            usagePercent,
            available: data[3],
            total: data[1],
          },
        };
      }

      if (usagePercent > 80) {
        return {
          status: 'warn',
          message: 'Low disk space',
          details: {
            usagePercent,
            available: data[3],
            total: data[1],
          },
        };
      }

      return {
        status: 'pass',
        message: 'Disk space is adequate',
        details: {
          usagePercent,
          available: data[3],
          total: data[1],
        },
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Unable to check disk space',
      };
    }
  }

  /**
   * Check external dependencies
   */
  private async checkDependencies(): Promise<HealthCheckResult['checks'][string]> {
    const dependencies = [];

    // Add checks for external services here
    // For example: authentication service, file storage, etc.

    if (dependencies.length === 0) {
      return {
        status: 'pass',
        message: 'No external dependencies configured',
      };
    }

    // Check each dependency
    const results = await Promise.all(
      dependencies.map(async (dep) => {
        // Implement dependency checks
        return { name: dep, status: 'pass' };
      })
    );

    const failed = results.filter((r) => r.status !== 'pass');

    if (failed.length > 0) {
      return {
        status: 'fail',
        message: `${failed.length} dependencies are unhealthy`,
        details: { failed },
      };
    }

    return {
      status: 'pass',
      message: 'All dependencies are healthy',
      details: { dependencies: results },
    };
  }

  /**
   * Liveness probe (simple check)
   */
  async liveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe (can accept traffic)
   */
  async readiness(): Promise<{
    ready: boolean;
    timestamp: string;
    checks: string[];
  }> {
    const checks: string[] = [];
    let ready = true;

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.push('database: ready');
    } catch {
      checks.push('database: not ready');
      ready = false;
    }

    // Check Redis if configured
    if (this.redis) {
      try {
        await this.redis.ping();
        checks.push('redis: ready');
      } catch {
        checks.push('redis: not ready');
        ready = false;
      }
    }

    return {
      ready,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
