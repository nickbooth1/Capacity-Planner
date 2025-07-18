import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import {
  MetricsService,
  HealthService,
  EncryptionService,
  CapabilityValidationEngine as ValidationEngine,
} from '@capacity-planner/assets-module';

const router = Router();
const prisma = new PrismaClient();

// Initialize services
const metricsService = MetricsService.getInstance();
let healthService: HealthService;

// Initialize health service with dependencies
const initializeHealthService = async () => {
  try {
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();

    const encryptionService = new EncryptionService();
    const validationEngine = new ValidationEngine();

    healthService = new HealthService(prisma, redisClient, encryptionService, validationEngine);

    console.log('Health service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize health service:', error);
  }
};

// Initialize on startup
initializeHealthService();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * GET /metrics/json
 * Metrics in JSON format
 */
router.get('/metrics/json', async (req, res) => {
  try {
    const metrics = await metricsService.getMetricsAsJson();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error getting JSON metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve JSON metrics',
    });
  }
});

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health service not initialized',
      });
    }

    const health = await healthService.checkSystemHealth();

    const statusCode =
      health.overall === 'healthy' ? 200 : health.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      status: health.overall,
      timestamp: health.timestamp,
      components: health.components,
      summary: health.summary,
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check system health',
    });
  }
});

/**
 * GET /health/capabilities
 * Capabilities-specific health check
 */
router.get('/health/capabilities', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health service not initialized',
      });
    }

    const [dbHealth, validationHealth, encryptionHealth] = await Promise.all([
      healthService.checkDatabase(),
      healthService.checkValidation(),
      healthService.checkEncryption(),
    ]);

    const components = [
      { name: 'database', ...dbHealth },
      { name: 'validation', ...validationHealth },
      { name: 'encryption', ...encryptionHealth },
    ];

    const unhealthyComponents = components.filter((c) => c.status === 'unhealthy');
    const overallStatus = unhealthyComponents.length > 0 ? 'unhealthy' : 'healthy';

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      status: overallStatus,
      timestamp: new Date(),
      components,
      summary: {
        healthy: components.filter((c) => c.status === 'healthy').length,
        degraded: components.filter((c) => c.status === 'degraded').length,
        unhealthy: components.filter((c) => c.status === 'unhealthy').length,
        total: components.length,
      },
    });
  } catch (error) {
    console.error('Error checking capabilities health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check capabilities health',
    });
  }
});

/**
 * GET /health/validation
 * Validation engine health check
 */
router.get('/health/validation', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health service not initialized',
      });
    }

    const validationHealth = await healthService.checkValidation();

    const statusCode = validationHealth.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      ...validationHealth,
    });
  } catch (error) {
    console.error('Error checking validation health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check validation health',
    });
  }
});

/**
 * GET /health/cache
 * Cache health check
 */
router.get('/health/cache', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health service not initialized',
      });
    }

    const cacheHealth = await healthService.checkCache();

    const statusCode = cacheHealth.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      ...cacheHealth,
    });
  } catch (error) {
    console.error('Error checking cache health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check cache health',
    });
  }
});

/**
 * GET /health/database
 * Database health check
 */
router.get('/health/database', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health service not initialized',
      });
    }

    const dbHealth = await healthService.checkDatabase();

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      ...dbHealth,
    });
  } catch (error) {
    console.error('Error checking database health:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check database health',
    });
  }
});

/**
 * GET /health/history/:component
 * Get health history for a specific component
 */
router.get('/health/history/:component', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        error: 'Health service not initialized',
      });
    }

    const { component } = req.params;
    const history = healthService.getHealthHistory(component);
    const statistics = healthService.getHealthStatistics(component);

    res.json({
      success: true,
      component,
      history,
      statistics,
    });
  } catch (error) {
    console.error('Error getting health history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health history',
    });
  }
});

/**
 * GET /health/statistics/:component
 * Get health statistics for a specific component
 */
router.get('/health/statistics/:component', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        error: 'Health service not initialized',
      });
    }

    const { component } = req.params;
    const statistics = healthService.getHealthStatistics(component);

    res.json({
      success: true,
      component,
      statistics,
    });
  } catch (error) {
    console.error('Error getting health statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health statistics',
    });
  }
});

/**
 * POST /health/clear-history
 * Clear health history
 */
router.post('/health/clear-history', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        success: false,
        error: 'Health service not initialized',
      });
    }

    const { component } = req.body;
    healthService.clearHealthHistory(component);

    res.json({
      success: true,
      message: component
        ? `Health history cleared for component: ${component}`
        : 'All health history cleared',
    });
  } catch (error) {
    console.error('Error clearing health history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear health history',
    });
  }
});

/**
 * GET /status
 * Simple status endpoint for load balancers
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'assets-module',
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /readiness
 * Kubernetes readiness probe
 */
router.get('/readiness', async (req, res) => {
  try {
    if (!healthService) {
      return res.status(503).json({
        ready: false,
        error: 'Health service not initialized',
      });
    }

    // Quick check of critical components
    const [dbHealth, redisHealth] = await Promise.all([
      healthService.checkDatabase(),
      healthService.checkRedis(),
    ]);

    const ready = dbHealth.status !== 'unhealthy' && redisHealth.status !== 'unhealthy';

    res.status(ready ? 200 : 503).json({
      ready,
      timestamp: new Date(),
      components: {
        database: dbHealth.status,
        redis: redisHealth.status,
      },
    });
  } catch (error) {
    console.error('Error checking readiness:', error);
    res.status(503).json({
      ready: false,
      error: 'Failed to check readiness',
    });
  }
});

/**
 * GET /liveness
 * Kubernetes liveness probe
 */
router.get('/liveness', (req, res) => {
  // Basic liveness check - service is running
  res.json({
    alive: true,
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

export default router;
