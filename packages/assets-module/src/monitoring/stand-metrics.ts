import { Counter, Histogram, Gauge, register } from 'prom-client';

/**
 * Prometheus metrics for stand operations monitoring
 */

// Operation counters
export const standOperationCounter = new Counter({
  name: 'stand_operations_total',
  help: 'Total number of stand operations',
  labelNames: ['operation', 'status', 'organization'],
});

// Operation duration histogram
export const standOperationDuration = new Histogram({
  name: 'stand_operation_duration_seconds',
  help: 'Duration of stand operations in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Cache hit rate
export const cacheHitCounter = new Counter({
  name: 'stand_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'operation'],
});

export const cacheMissCounter = new Counter({
  name: 'stand_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'operation'],
});

// Validation metrics
export const validationCounter = new Counter({
  name: 'stand_validations_total',
  help: 'Total number of stand validations',
  labelNames: ['result', 'validation_type'],
});

export const validationDuration = new Histogram({
  name: 'stand_validation_duration_seconds',
  help: 'Duration of stand validations in seconds',
  labelNames: ['validation_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

// Security metrics
export const securityEventCounter = new Counter({
  name: 'stand_security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity', 'organization'],
});

export const accessDeniedCounter = new Counter({
  name: 'stand_access_denied_total',
  help: 'Total number of access denied events',
  labelNames: ['resource', 'action', 'reason'],
});

// Import metrics
export const importJobGauge = new Gauge({
  name: 'stand_import_jobs_active',
  help: 'Number of active import jobs',
  labelNames: ['organization'],
});

export const importRowsProcessed = new Counter({
  name: 'stand_import_rows_processed_total',
  help: 'Total number of rows processed in imports',
  labelNames: ['status', 'organization'],
});

// Database metrics
export const dbConnectionGauge = new Gauge({
  name: 'stand_db_connections_active',
  help: 'Number of active database connections',
});

export const dbQueryDuration = new Histogram({
  name: 'stand_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5],
});

// Error metrics
export const errorCounter = new Counter({
  name: 'stand_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'operation', 'severity'],
});

// Stand inventory metrics
export const standInventoryGauge = new Gauge({
  name: 'stand_inventory_total',
  help: 'Total number of stands',
  labelNames: ['status', 'terminal', 'organization'],
});

// Performance metrics
export const memoryUsageGauge = new Gauge({
  name: 'stand_service_memory_usage_bytes',
  help: 'Memory usage of stand service',
});

export const cpuUsageGauge = new Gauge({
  name: 'stand_service_cpu_usage_percent',
  help: 'CPU usage percentage of stand service',
});

/**
 * Metrics helper functions
 */

export function recordOperation(
  operation: string,
  status: 'success' | 'failure',
  organization: string,
  duration: number
): void {
  standOperationCounter.labels(operation, status, organization).inc();
  standOperationDuration.labels(operation).observe(duration / 1000); // Convert to seconds
}

export function recordCacheAccess(
  cacheType: 'local' | 'redis',
  operation: string,
  hit: boolean
): void {
  if (hit) {
    cacheHitCounter.labels(cacheType, operation).inc();
  } else {
    cacheMissCounter.labels(cacheType, operation).inc();
  }
}

export function recordValidation(validationType: string, isValid: boolean, duration: number): void {
  validationCounter.labels(isValid ? 'valid' : 'invalid', validationType).inc();
  validationDuration.labels(validationType).observe(duration / 1000);
}

export function recordSecurityEvent(
  eventType: string,
  severity: string,
  organization: string
): void {
  securityEventCounter.labels(eventType, severity, organization).inc();
}

export function recordAccessDenied(resource: string, action: string, reason: string): void {
  accessDeniedCounter.labels(resource, action, reason).inc();
}

export function recordError(
  errorType: string,
  operation: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): void {
  errorCounter.labels(errorType, operation, severity).inc();
}

export function updateImportMetrics(
  organization: string,
  activeJobs: number,
  successRows: number,
  errorRows: number
): void {
  importJobGauge.labels(organization).set(activeJobs);
  importRowsProcessed.labels('success', organization).inc(successRows);
  importRowsProcessed.labels('error', organization).inc(errorRows);
}

export function recordDbQuery(queryType: string, table: string, duration: number): void {
  dbQueryDuration.labels(queryType, table).observe(duration / 1000);
}

export function updateInventoryMetrics(
  metrics: Array<{
    status: string;
    terminal: string;
    organization: string;
    count: number;
  }>
): void {
  metrics.forEach(({ status, terminal, organization, count }) => {
    standInventoryGauge.labels(status, terminal, organization).set(count);
  });
}

/**
 * Initialize system metrics collection
 */
export function initializeSystemMetrics(): void {
  // Update system metrics every 10 seconds
  setInterval(() => {
    const usage = process.memoryUsage();
    memoryUsageGauge.set(usage.heapUsed);

    const cpuUsage = process.cpuUsage();
    const totalCpu = cpuUsage.user + cpuUsage.system;
    cpuUsageGauge.set(totalCpu / 1000000); // Convert to percentage
  }, 10000);
}

/**
 * Export all metrics for Prometheus scraping
 */
export function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  register.clear();
}
