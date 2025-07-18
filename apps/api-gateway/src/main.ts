import express from 'express';
import { HTTP_STATUS } from '@capacity-planner/shared-kernel';
import {
  getEntitlementService,
  closeEntitlementService,
} from './services/entitlement-service.factory';
import { createEntitlementRoutes } from './routes/entitlements';
import standsRouter from './routes/assets/stands-simple';
import timelineRouter from './routes/assets/timeline';
import workRequestsRouter from './routes/work-requests';
import workRequestsAssetsRouter from './routes/work-requests-assets';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(express.json());

// Development logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Initialize services
const entitlementService = getEntitlementService();

// Mount entitlement routes
app.use('/api/entitlements', createEntitlementRoutes(entitlementService));

// Mount assets routes
app.use('/api/assets/stands', standsRouter);
app.use('/api/assets', timelineRouter);

// Mount work request routes
app.use('/api/work/requests', workRequestsRouter);
app.use('/api/work/requests/assets', workRequestsAssetsRouter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check if database is accessible
    const dbHealthy = await entitlementService
      .getAllEntitlements()
      .then(() => true)
      .catch(() => false);

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: process.env.ENABLE_REDIS_CACHE === 'true' ? 'enabled' : 'disabled',
      },
    });
  } catch (error) {
    res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: 'error',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API root
app.get('/', (req, res) => {
  res.json({
    message: 'CapaCity Planner API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      entitlements: '/api/entitlements',
      assets: '/api/assets',
      work: '/api/work',
    },
    services: {
      useMockServices: process.env.USE_MOCK_SERVICES === 'true',
      redisCache: process.env.ENABLE_REDIS_CACHE === 'true',
    },
  });
});

const server = app.listen(port, host, () => {
  console.log(`🚀 API Gateway ready at http://${host}:${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    `🔄 Hot reload: ${process.env.ENABLE_HOT_RELOAD === 'true' ? 'enabled' : 'disabled'}`
  );
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Starting graceful shutdown...');

  // Close HTTP server
  server.close(async () => {
    console.log('HTTP server closed');

    // Close entitlement service connections
    try {
      await closeEntitlementService();
      console.log('Entitlement service connections closed');
    } catch (error) {
      console.error('Error closing entitlement service:', error);
    }

    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
