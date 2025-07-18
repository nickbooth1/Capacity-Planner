import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { EncryptionService } from '../security/encryption.service';
import { CapabilityValidationEngine } from '../validation/capability-validation.engine';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  duration: number;
  details?: any;
  error?: string;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  timestamp: Date;
  duration: number;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  overall: HealthStatus;
  timestamp: Date;
  components: ComponentHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

export interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
  criticalComponents: string[];
}

export class HealthService {
  private prisma: PrismaClient;
  private redisClient: any;
  private encryptionService: EncryptionService;
  private validationEngine: CapabilityValidationEngine;
  private config: HealthCheckConfig;
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private maxHistorySize = 100;

  constructor(
    prisma: PrismaClient,
    redisClient: any,
    encryptionService: EncryptionService,
    validationEngine: CapabilityValidationEngine,
    config: Partial<HealthCheckConfig> = {}
  ) {
    this.prisma = prisma;
    this.redisClient = redisClient;
    this.encryptionService = encryptionService;
    this.validationEngine = validationEngine;
    this.config = {
      timeout: 5000,
      retries: 3,
      interval: 30000,
      criticalComponents: ['database', 'redis', 'encryption'],
      ...config,
    };
  }

  /**
   * Check database connectivity and performance
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const componentName = 'database';

    try {
      // Basic connectivity check
      await this.prisma.$queryRaw`SELECT 1`;

      // Performance check - simple query
      const startQueryTime = Date.now();
      const standsCount = await this.prisma.stand.count();
      const queryDuration = Date.now() - startQueryTime;

      // Check connection pool
      const poolSize = await this.getDatabasePoolSize();

      const duration = Date.now() - startTime;
      const status = this.determineHealthStatus(duration, queryDuration, poolSize);

      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        duration,
        details: {
          standsCount,
          queryDuration,
          poolSize,
          connectionActive: true,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown database error',
        details: {
          connectionActive: false,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const componentName = 'redis';

    try {
      if (!this.redisClient || !this.redisClient.isOpen) {
        throw new Error('Redis client not connected');
      }

      // Basic connectivity check
      await this.redisClient.ping();

      // Performance check - set/get operation
      const testKey = 'health_check_test';
      const testValue = 'test_value';

      const startSetTime = Date.now();
      await this.redisClient.set(testKey, testValue, { EX: 60 });
      const setValue = await this.redisClient.get(testKey);
      const operationDuration = Date.now() - startSetTime;

      // Clean up test key
      await this.redisClient.del(testKey);

      // Get Redis info
      const info = await this.redisClient.info();
      const memoryUsage = this.parseRedisInfo(info, 'used_memory');
      const connectedClients = this.parseRedisInfo(info, 'connected_clients');

      const duration = Date.now() - startTime;
      const status = this.determineRedisHealth(duration, operationDuration, memoryUsage);

      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        duration,
        details: {
          ping: 'pong',
          operationDuration,
          memoryUsage,
          connectedClients,
          testSuccess: setValue === testValue,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        details: {
          connected: false,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    }
  }

  /**
   * Check encryption service functionality
   */
  async checkEncryption(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const componentName = 'encryption';

    try {
      // Test encryption/decryption
      const testData = { test: 'health_check_data', timestamp: Date.now() };

      const encryptStartTime = Date.now();
      const encrypted = this.encryptionService.encryptObject(testData);
      const decrypted = this.encryptionService.decryptObject(encrypted);
      const encryptionDuration = Date.now() - encryptStartTime;

      const isDataIntact = JSON.stringify(testData) === JSON.stringify(decrypted);

      // Test self-check
      const selfTestPassed = this.encryptionService.test();

      const duration = Date.now() - startTime;
      const status = isDataIntact && selfTestPassed ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        duration,
        details: {
          encryptionDuration,
          dataIntegrity: isDataIntact,
          selfTestPassed,
          encryptionWorking: true,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown encryption error',
        details: {
          encryptionWorking: false,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    }
  }

  /**
   * Check validation engine functionality
   */
  async checkValidation(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const componentName = 'validation';

    try {
      // Test validation with sample data
      const testCapabilities = {
        dimensions: {
          length: 60,
          width: 45,
          height: 5,
          icaoCategory: 'C' as const,
        },
        aircraftCompatibility: {
          maxWingspan: 36,
          maxLength: 45,
          maxWeight: 79000,
        },
      };

      const validationStartTime = Date.now();
      const validationResult = await this.validationEngine.validate(testCapabilities);
      const validationDuration = Date.now() - validationStartTime;

      const duration = Date.now() - startTime;
      const status = validationResult.result.isValid ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        duration,
        details: {
          validationDuration,
          validationResult: validationResult.result,
          validationWorking: true,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        details: {
          validationWorking: false,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    }
  }

  /**
   * Check cache performance
   */
  async checkCache(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const componentName = 'cache';

    try {
      // Test both local and Redis cache
      const testKey = 'health_check_cache_test';
      const testData = { data: 'test', timestamp: Date.now() };

      // Test Redis cache
      const redisStartTime = Date.now();
      await this.redisClient.set(testKey, JSON.stringify(testData), { EX: 60 });
      const cachedData = await this.redisClient.get(testKey);
      const redisDuration = Date.now() - redisStartTime;

      // Clean up
      await this.redisClient.del(testKey);

      const isDataCorrect = JSON.stringify(testData) === cachedData;

      const duration = Date.now() - startTime;
      const status = isDataCorrect ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        duration,
        details: {
          redisDuration,
          dataIntegrity: isDataCorrect,
          cacheWorking: true,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HealthCheckResult = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown cache error',
        details: {
          cacheWorking: false,
        },
      };

      this.recordHealthCheck(componentName, result);
      return result;
    }
  }

  /**
   * Comprehensive system health check
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();

    const healthChecks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEncryption(),
      this.checkValidation(),
      this.checkCache(),
    ]);

    const components: ComponentHealth[] = [];
    const componentNames = ['database', 'redis', 'encryption', 'validation', 'cache'];

    healthChecks.forEach((result, index) => {
      const componentName = componentNames[index];

      if (result.status === 'fulfilled') {
        components.push({
          name: componentName,
          status: result.value.status,
          timestamp: result.value.timestamp,
          duration: result.value.duration,
          details: result.value.details,
          error: result.value.error,
        });
      } else {
        components.push({
          name: componentName,
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          error: result.reason?.message || 'Health check failed',
        });
      }
    });

    // Calculate overall health
    const summary = {
      healthy: components.filter((c) => c.status === HealthStatus.HEALTHY).length,
      degraded: components.filter((c) => c.status === HealthStatus.DEGRADED).length,
      unhealthy: components.filter((c) => c.status === HealthStatus.UNHEALTHY).length,
      total: components.length,
    };

    // Determine overall status
    const criticalUnhealthy = components.filter(
      (c) => this.config.criticalComponents.includes(c.name) && c.status === HealthStatus.UNHEALTHY
    ).length;

    let overallStatus: HealthStatus;
    if (criticalUnhealthy > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (summary.unhealthy > 0 || summary.degraded > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.HEALTHY;
    }

    return {
      overall: overallStatus,
      timestamp: new Date(),
      components,
      summary,
    };
  }

  /**
   * Get health history for a component
   */
  getHealthHistory(componentName: string): HealthCheckResult[] {
    return this.healthHistory.get(componentName) || [];
  }

  /**
   * Get health statistics for a component
   */
  getHealthStatistics(componentName: string): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    averageDuration: number;
    uptime: number;
  } {
    const history = this.getHealthHistory(componentName);

    if (history.length === 0) {
      return {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        averageDuration: 0,
        uptime: 0,
      };
    }

    const healthy = history.filter((h) => h.status === HealthStatus.HEALTHY).length;
    const degraded = history.filter((h) => h.status === HealthStatus.DEGRADED).length;
    const unhealthy = history.filter((h) => h.status === HealthStatus.UNHEALTHY).length;

    const totalDuration = history.reduce((sum, h) => sum + h.duration, 0);
    const averageDuration = totalDuration / history.length;

    const uptime = ((healthy + degraded) / history.length) * 100;

    return {
      total: history.length,
      healthy,
      degraded,
      unhealthy,
      averageDuration,
      uptime,
    };
  }

  /**
   * Clear health history
   */
  clearHealthHistory(componentName?: string): void {
    if (componentName) {
      this.healthHistory.delete(componentName);
    } else {
      this.healthHistory.clear();
    }
  }

  /**
   * Private helper methods
   */
  private recordHealthCheck(componentName: string, result: HealthCheckResult): void {
    if (!this.healthHistory.has(componentName)) {
      this.healthHistory.set(componentName, []);
    }

    const history = this.healthHistory.get(componentName)!;
    history.push(result);

    // Keep only the last N results
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  private determineHealthStatus(
    duration: number,
    queryDuration: number,
    poolSize: number
  ): HealthStatus {
    if (duration > 3000 || queryDuration > 1000) {
      return HealthStatus.DEGRADED;
    }
    if (poolSize < 5) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  private determineRedisHealth(
    duration: number,
    operationDuration: number,
    memoryUsage: number
  ): HealthStatus {
    if (duration > 2000 || operationDuration > 500) {
      return HealthStatus.DEGRADED;
    }
    if (memoryUsage > 1000000000) {
      // 1GB
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  private async getDatabasePoolSize(): Promise<number> {
    try {
      // This is a simplified check - actual implementation depends on your database setup
      return 10; // Default pool size
    } catch (error) {
      return 0;
    }
  }

  private parseRedisInfo(info: string, key: string): number {
    const regex = new RegExp(`${key}:(\\d+)`);
    const match = info.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Start periodic health checks
   */
  startPeriodicHealthChecks(): void {
    setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        console.error('Error during periodic health check:', error);
      }
    }, this.config.interval);
  }
}
