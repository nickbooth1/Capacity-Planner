import winston from 'winston';
import { Request } from 'express';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let metaString = '';

    if (Object.keys(meta).length > 0) {
      metaString = JSON.stringify(meta, null, 2);
    }

    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize({ all: true }), format),
  }),
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(winston.format.uncolorize(), format),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(winston.format.uncolorize(), format),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create stream for Morgan HTTP logger
logger.stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
} as any;

// Helper functions for structured logging
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error | any, meta?: any) => {
  logger.error(message, {
    ...meta,
    error: error?.message || error,
    stack: error?.stack,
  });
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

// Request logging helper
export const logRequest = (req: Request, message: string, meta?: any) => {
  logger.info(message, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.headers['x-user-id'],
    organizationId: req.headers['x-organization-id'],
    ...meta,
  });
};

// Performance logging helper
export const logPerformance = (operation: string, duration: number, meta?: any) => {
  logger.info(`Performance: ${operation}`, {
    operation,
    duration,
    durationMs: Math.round(duration * 1000),
    ...meta,
  });
};

// Audit logging helper
export const logAudit = (action: string, userId: string, resourceId: string, meta?: any) => {
  logger.info(`Audit: ${action}`, {
    action,
    userId,
    resourceId,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

// Security logging helper
export const logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  meta?: any
) => {
  const logFn = severity === 'critical' || severity === 'high' ? logger.error : logger.warn;

  logFn(`Security: ${event}`, {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

// Business event logging helper
export const logBusinessEvent = (event: string, meta?: any) => {
  logger.info(`Business Event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

// Create child logger with context
export const createContextLogger = (context: Record<string, any>) => {
  return {
    info: (message: string, meta?: any) => logger.info(message, { ...context, ...meta }),
    error: (message: string, error?: Error | any, meta?: any) =>
      logError(message, error, { ...context, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { ...context, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { ...context, ...meta }),
  };
};

export default logger;
