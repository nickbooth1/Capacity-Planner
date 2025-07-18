import * as promClient from 'prom-client';
import winston from 'winston';
import { Request, Response, NextFunction } from 'express';

// Initialize Prometheus metrics
const register = new promClient.Registry();

// Default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const workRequestCounter = new promClient.Counter({
  name: 'work_requests_total',
  help: 'Total number of work requests',
  labelNames: ['status', 'priority', 'asset_type'],
});

const activeWorkRequestsGauge = new promClient.Gauge({
  name: 'active_work_requests',
  help: 'Number of active work requests',
  labelNames: ['status'],
});

const approvalProcessingTime = new promClient.Histogram({
  name: 'approval_processing_time_seconds',
  help: 'Time taken to process approvals',
  labelNames: ['approval_level', 'result'],
  buckets: [60, 300, 900, 1800, 3600], // 1min, 5min, 15min, 30min, 1hr
});

const fileUploadSize = new promClient.Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size of uploaded files',
  labelNames: ['file_type'],
  buckets: [1024, 10240, 102400, 1048576, 10485760], // 1KB, 10KB, 100KB, 1MB, 10MB
});

const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1],
});

const cacheHitRate = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Cache operations',
  labelNames: ['operation', 'result'],
});

const reportGenerationTime = new promClient.Histogram({
  name: 'report_generation_time_seconds',
  help: 'Time taken to generate reports',
  labelNames: ['template_id', 'format'],
  buckets: [1, 5, 10, 30, 60, 120], // seconds
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(workRequestCounter);
register.registerMetric(activeWorkRequestsGauge);
register.registerMetric(approvalProcessingTime);
register.registerMetric(fileUploadSize);
register.registerMetric(databaseQueryDuration);
register.registerMetric(cacheHitRate);
register.registerMetric(reportGenerationTime);

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'work-module',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add production transports
if (process.env.NODE_ENV === 'production') {
  // Add CloudWatch transport
  if (process.env.AWS_REGION) {
    const CloudWatchTransport = require('winston-cloudwatch');
    logger.add(
      new CloudWatchTransport({
        logGroupName: 'capacity-planner',
        logStreamName: `work-module-${process.env.INSTANCE_ID || 'default'}`,
        awsRegion: process.env.AWS_REGION,
        jsonMessage: true,
      })
    );
  }

  // Add Datadog transport
  if (process.env.DATADOG_API_KEY) {
    const DatadogTransport = require('winston-datadog').DatadogTransport;
    logger.add(
      new DatadogTransport({
        apiKey: process.env.DATADOG_API_KEY,
        hostname: process.env.HOSTNAME,
        service: 'work-module',
        ddsource: 'nodejs',
        ddtags: `env:${process.env.NODE_ENV}`,
      })
    );
  }
}

// Request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.headers['x-user-id'],
    organizationId: req.headers['x-organization-id'],
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;
    const duration = (Date.now() - start) / 1000;

    // Log response
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    });

    // Record metrics
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);

    return res.send(data);
  };

  next();
};

// Error logging middleware
export const errorLoggingMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userId: req.headers['x-user-id'],
    organizationId: req.headers['x-organization-id'],
  });

  next(err);
};

// Metrics endpoint
export const metricsEndpoint = async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

// Monitoring utilities
export const monitoring = {
  // Track work request metrics
  trackWorkRequest: (status: string, priority: string, assetType: string) => {
    workRequestCounter.labels(status, priority, assetType).inc();
  },

  // Update active work requests gauge
  updateActiveRequests: (counts: Record<string, number>) => {
    Object.entries(counts).forEach(([status, count]) => {
      activeWorkRequestsGauge.labels(status).set(count);
    });
  },

  // Track approval processing time
  trackApprovalTime: (approvalLevel: string, result: string, durationSeconds: number) => {
    approvalProcessingTime.labels(approvalLevel, result).observe(durationSeconds);
  },

  // Track file upload
  trackFileUpload: (fileType: string, sizeBytes: number) => {
    fileUploadSize.labels(fileType).observe(sizeBytes);
  },

  // Track database query
  trackDatabaseQuery: (operation: string, table: string, durationSeconds: number) => {
    databaseQueryDuration.labels(operation, table).observe(durationSeconds);
  },

  // Track cache operations
  trackCacheOperation: (operation: string, hit: boolean) => {
    cacheHitRate.labels(operation, hit ? 'hit' : 'miss').inc();
  },

  // Track report generation
  trackReportGeneration: (templateId: string, format: string, durationSeconds: number) => {
    reportGenerationTime.labels(templateId, format).observe(durationSeconds);
  },

  // Log structured data
  log: logger,

  // Create child logger with context
  createLogger: (context: Record<string, any>) => {
    return logger.child(context);
  },
};

// Database query wrapper with metrics
export const instrumentDatabaseQuery = async <T>(
  operation: string,
  table: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const start = Date.now();

  try {
    const result = await queryFn();
    const duration = (Date.now() - start) / 1000;
    monitoring.trackDatabaseQuery(operation, table, duration);
    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    monitoring.trackDatabaseQuery(operation, table, duration);
    monitoring.log.error('Database query error', {
      operation,
      table,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    });
    throw error;
  }
};

// Cache operation wrapper with metrics
export const instrumentCacheOperation = async <T>(
  operation: string,
  key: string,
  cacheFn: () => Promise<T | null>,
  fallbackFn?: () => Promise<T>
): Promise<T | null> => {
  try {
    const cached = await cacheFn();
    monitoring.trackCacheOperation(operation, cached !== null);

    if (cached !== null) {
      return cached;
    }

    if (fallbackFn) {
      const result = await fallbackFn();
      return result;
    }

    return null;
  } catch (error) {
    monitoring.log.error('Cache operation error', {
      operation,
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (fallbackFn) {
      return fallbackFn();
    }

    throw error;
  }
};

// Health check utilities
export const healthCheck = {
  database: async (prisma: any): Promise<boolean> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },

  redis: async (redis: any): Promise<boolean> => {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  },

  storage: async (s3: any): Promise<boolean> => {
    try {
      await s3.headBucket({ Bucket: process.env.S3_BUCKET }).promise();
      return true;
    } catch {
      return false;
    }
  },
};

// Performance monitoring decorator
export function measurePerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    const className = target.constructor.name;
    const methodName = propertyKey;

    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - start;

      monitoring.log.debug('Method execution completed', {
        class: className,
        method: methodName,
        duration,
        args: args.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      monitoring.log.error('Method execution failed', {
        class: className,
        method: methodName,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  };

  return descriptor;
}

export default monitoring;
