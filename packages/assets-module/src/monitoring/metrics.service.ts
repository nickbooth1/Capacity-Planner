import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';

export interface MetricsConfig {
  enableDefaultMetrics: boolean;
  prefix: string;
  collectInterval: number;
}

export class MetricsService {
  private static instance: MetricsService;
  private config: MetricsConfig;

  // API Metrics
  private apiRequestDuration: Histogram<string>;
  private apiRequestCount: Counter<string>;
  private apiErrorCount: Counter<string>;

  // Validation Metrics
  private validationDuration: Histogram<string>;
  private validationCount: Counter<string>;
  private validationErrorCount: Counter<string>;

  // Cache Metrics
  private cacheHitRate: Gauge<string>;
  private cacheOperations: Counter<string>;
  private cacheSize: Gauge<string>;

  // Business Metrics
  private standsTotal: Gauge<string>;
  private templatesTotal: Gauge<string>;
  private maintenanceRecordsTotal: Gauge<string>;
  private capabilityUpdates: Counter<string>;
  private templateApplications: Counter<string>;

  // Database Metrics
  private dbQueryDuration: Histogram<string>;
  private dbConnectionPoolSize: Gauge<string>;
  private dbQueryErrors: Counter<string>;

  // Security Metrics
  private securityEvents: Counter<string>;
  private encryptionOperations: Counter<string>;
  private accessDenials: Counter<string>;

  private constructor(config: Partial<MetricsConfig> = {}) {
    this.config = {
      enableDefaultMetrics: true,
      prefix: 'assets_module_',
      collectInterval: 10000,
      ...config,
    };

    this.initializeMetrics();

    if (this.config.enableDefaultMetrics) {
      collectDefaultMetrics({
        prefix: this.config.prefix,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      });
    }
  }

  public static getInstance(config?: Partial<MetricsConfig>): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService(config);
    }
    return MetricsService.instance;
  }

  private initializeMetrics(): void {
    const prefix = this.config.prefix;

    // API Metrics
    this.apiRequestDuration = new Histogram({
      name: `${prefix}api_request_duration_seconds`,
      help: 'Duration of API requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'organization_id'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    this.apiRequestCount = new Counter({
      name: `${prefix}api_requests_total`,
      help: 'Total number of API requests',
      labelNames: ['method', 'route', 'status_code', 'organization_id'],
    });

    this.apiErrorCount = new Counter({
      name: `${prefix}api_errors_total`,
      help: 'Total number of API errors',
      labelNames: ['method', 'route', 'error_type', 'organization_id'],
    });

    // Validation Metrics
    this.validationDuration = new Histogram({
      name: `${prefix}validation_duration_seconds`,
      help: 'Duration of validation operations in seconds',
      labelNames: ['validator_type', 'organization_id'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
    });

    this.validationCount = new Counter({
      name: `${prefix}validations_total`,
      help: 'Total number of validations performed',
      labelNames: ['validator_type', 'result', 'organization_id'],
    });

    this.validationErrorCount = new Counter({
      name: `${prefix}validation_errors_total`,
      help: 'Total number of validation errors',
      labelNames: ['validator_type', 'error_type', 'organization_id'],
    });

    // Cache Metrics
    this.cacheHitRate = new Gauge({
      name: `${prefix}cache_hit_rate`,
      help: 'Cache hit rate as a percentage',
      labelNames: ['cache_type', 'organization_id'],
    });

    this.cacheOperations = new Counter({
      name: `${prefix}cache_operations_total`,
      help: 'Total number of cache operations',
      labelNames: ['operation', 'cache_type', 'result', 'organization_id'],
    });

    this.cacheSize = new Gauge({
      name: `${prefix}cache_size_bytes`,
      help: 'Current cache size in bytes',
      labelNames: ['cache_type', 'organization_id'],
    });

    // Business Metrics
    this.standsTotal = new Gauge({
      name: `${prefix}stands_total`,
      help: 'Total number of stands',
      labelNames: ['status', 'organization_id'],
    });

    this.templatesTotal = new Gauge({
      name: `${prefix}templates_total`,
      help: 'Total number of capability templates',
      labelNames: ['category', 'is_active', 'organization_id'],
    });

    this.maintenanceRecordsTotal = new Gauge({
      name: `${prefix}maintenance_records_total`,
      help: 'Total number of maintenance records',
      labelNames: ['status', 'maintenance_type', 'organization_id'],
    });

    this.capabilityUpdates = new Counter({
      name: `${prefix}capability_updates_total`,
      help: 'Total number of capability updates',
      labelNames: ['update_type', 'organization_id'],
    });

    this.templateApplications = new Counter({
      name: `${prefix}template_applications_total`,
      help: 'Total number of template applications',
      labelNames: ['result', 'organization_id'],
    });

    // Database Metrics
    this.dbQueryDuration = new Histogram({
      name: `${prefix}db_query_duration_seconds`,
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'organization_id'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
    });

    this.dbConnectionPoolSize = new Gauge({
      name: `${prefix}db_connection_pool_size`,
      help: 'Current database connection pool size',
      labelNames: ['pool_type'],
    });

    this.dbQueryErrors = new Counter({
      name: `${prefix}db_query_errors_total`,
      help: 'Total number of database query errors',
      labelNames: ['operation', 'table', 'error_type', 'organization_id'],
    });

    // Security Metrics
    this.securityEvents = new Counter({
      name: `${prefix}security_events_total`,
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'organization_id'],
    });

    this.encryptionOperations = new Counter({
      name: `${prefix}encryption_operations_total`,
      help: 'Total number of encryption/decryption operations',
      labelNames: ['operation', 'result', 'organization_id'],
    });

    this.accessDenials = new Counter({
      name: `${prefix}access_denials_total`,
      help: 'Total number of access denials',
      labelNames: ['resource', 'reason', 'organization_id'],
    });

    // Register all metrics
    register.registerMetric(this.apiRequestDuration);
    register.registerMetric(this.apiRequestCount);
    register.registerMetric(this.apiErrorCount);
    register.registerMetric(this.validationDuration);
    register.registerMetric(this.validationCount);
    register.registerMetric(this.validationErrorCount);
    register.registerMetric(this.cacheHitRate);
    register.registerMetric(this.cacheOperations);
    register.registerMetric(this.cacheSize);
    register.registerMetric(this.standsTotal);
    register.registerMetric(this.templatesTotal);
    register.registerMetric(this.maintenanceRecordsTotal);
    register.registerMetric(this.capabilityUpdates);
    register.registerMetric(this.templateApplications);
    register.registerMetric(this.dbQueryDuration);
    register.registerMetric(this.dbConnectionPoolSize);
    register.registerMetric(this.dbQueryErrors);
    register.registerMetric(this.securityEvents);
    register.registerMetric(this.encryptionOperations);
    register.registerMetric(this.accessDenials);
  }

  // API Metrics Methods
  public recordApiRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    organizationId: string = 'unknown'
  ): void {
    this.apiRequestDuration
      .labels(method, route, statusCode.toString(), organizationId)
      .observe(duration);

    this.apiRequestCount.labels(method, route, statusCode.toString(), organizationId).inc();
  }

  public recordApiError(
    method: string,
    route: string,
    errorType: string,
    organizationId: string = 'unknown'
  ): void {
    this.apiErrorCount.labels(method, route, errorType, organizationId).inc();
  }

  // Validation Metrics Methods
  public recordValidation(
    validatorType: string,
    duration: number,
    result: 'success' | 'failure',
    organizationId: string = 'unknown'
  ): void {
    this.validationDuration.labels(validatorType, organizationId).observe(duration);

    this.validationCount.labels(validatorType, result, organizationId).inc();
  }

  public recordValidationError(
    validatorType: string,
    errorType: string,
    organizationId: string = 'unknown'
  ): void {
    this.validationErrorCount.labels(validatorType, errorType, organizationId).inc();
  }

  // Cache Metrics Methods
  public updateCacheHitRate(
    cacheType: string,
    hitRate: number,
    organizationId: string = 'unknown'
  ): void {
    this.cacheHitRate.labels(cacheType, organizationId).set(hitRate);
  }

  public recordCacheOperation(
    operation: 'get' | 'set' | 'delete' | 'clear',
    cacheType: string,
    result: 'hit' | 'miss' | 'success' | 'failure',
    organizationId: string = 'unknown'
  ): void {
    this.cacheOperations.labels(operation, cacheType, result, organizationId).inc();
  }

  public updateCacheSize(
    cacheType: string,
    size: number,
    organizationId: string = 'unknown'
  ): void {
    this.cacheSize.labels(cacheType, organizationId).set(size);
  }

  // Business Metrics Methods
  public updateStandsCount(
    status: string,
    count: number,
    organizationId: string = 'unknown'
  ): void {
    this.standsTotal.labels(status, organizationId).set(count);
  }

  public updateTemplatesCount(
    category: string,
    isActive: boolean,
    count: number,
    organizationId: string = 'unknown'
  ): void {
    this.templatesTotal.labels(category, isActive.toString(), organizationId).set(count);
  }

  public updateMaintenanceRecordsCount(
    status: string,
    maintenanceType: string,
    count: number,
    organizationId: string = 'unknown'
  ): void {
    this.maintenanceRecordsTotal.labels(status, maintenanceType, organizationId).set(count);
  }

  public recordCapabilityUpdate(
    updateType: 'create' | 'update' | 'delete',
    organizationId: string = 'unknown'
  ): void {
    this.capabilityUpdates.labels(updateType, organizationId).inc();
  }

  public recordTemplateApplication(
    result: 'success' | 'failure',
    organizationId: string = 'unknown'
  ): void {
    this.templateApplications.labels(result, organizationId).inc();
  }

  // Database Metrics Methods
  public recordDbQuery(
    operation: string,
    table: string,
    duration: number,
    organizationId: string = 'unknown'
  ): void {
    this.dbQueryDuration.labels(operation, table, organizationId).observe(duration);
  }

  public recordDbQueryError(
    operation: string,
    table: string,
    errorType: string,
    organizationId: string = 'unknown'
  ): void {
    this.dbQueryErrors.labels(operation, table, errorType, organizationId).inc();
  }

  public updateDbConnectionPoolSize(poolType: string, size: number): void {
    this.dbConnectionPoolSize.labels(poolType).set(size);
  }

  // Security Metrics Methods
  public recordSecurityEvent(
    eventType: string,
    severity: string,
    organizationId: string = 'unknown'
  ): void {
    this.securityEvents.labels(eventType, severity, organizationId).inc();
  }

  public recordEncryptionOperation(
    operation: 'encrypt' | 'decrypt',
    result: 'success' | 'failure',
    organizationId: string = 'unknown'
  ): void {
    this.encryptionOperations.labels(operation, result, organizationId).inc();
  }

  public recordAccessDenial(
    resource: string,
    reason: string,
    organizationId: string = 'unknown'
  ): void {
    this.accessDenials.labels(resource, reason, organizationId).inc();
  }

  // Utility Methods
  public getMetrics(): Promise<string> {
    return register.metrics();
  }

  public getMetricsAsJson(): Promise<Array<any>> {
    return register.getMetricsAsJSON();
  }

  public clearMetrics(): void {
    register.clear();
  }

  public resetMetrics(): void {
    register.resetMetrics();
  }

  // Express Middleware
  public createApiMetricsMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const startTime = Date.now();
      const organizationId = (req.headers['x-organization-id'] as string) || 'unknown';

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        const duration = (Date.now() - startTime) / 1000;
        const route = req.route?.path || req.path;

        MetricsService.getInstance().recordApiRequest(
          req.method,
          route,
          res.statusCode,
          duration,
          organizationId
        );

        if (res.statusCode >= 400) {
          MetricsService.getInstance().recordApiError(
            req.method,
            route,
            `http_${res.statusCode}`,
            organizationId
          );
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Periodic Business Metrics Collection
  public startPeriodicCollection(prisma: any): void {
    setInterval(async () => {
      try {
        await this.collectBusinessMetrics(prisma);
      } catch (error) {
        console.error('Error collecting business metrics:', error);
      }
    }, this.config.collectInterval);
  }

  private async collectBusinessMetrics(prisma: any): Promise<void> {
    try {
      // Collect stands metrics
      const standsStats = await prisma.stand.groupBy({
        by: ['organizationId', 'status'],
        _count: { id: true },
      });

      standsStats.forEach((stat: any) => {
        this.updateStandsCount(stat.status, stat._count.id, stat.organizationId);
      });

      // Collect templates metrics
      const templatesStats = await prisma.standCapabilityTemplate.groupBy({
        by: ['organizationId', 'category', 'isActive'],
        _count: { id: true },
      });

      templatesStats.forEach((stat: any) => {
        this.updateTemplatesCount(
          stat.category,
          stat.isActive,
          stat._count.id,
          stat.organizationId
        );
      });

      // Collect maintenance records metrics
      const maintenanceStats = await prisma.standMaintenanceRecord.groupBy({
        by: ['organizationId', 'status', 'maintenanceType'],
        _count: { id: true },
      });

      maintenanceStats.forEach((stat: any) => {
        this.updateMaintenanceRecordsCount(
          stat.status,
          stat.maintenanceType,
          stat._count.id,
          stat.organizationId
        );
      });
    } catch (error) {
      console.error('Error collecting business metrics:', error);
    }
  }
}
