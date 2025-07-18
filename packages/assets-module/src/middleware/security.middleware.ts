import { Request, Response, NextFunction } from 'express';
import { StandSecurityService, SecurityContext } from '../security/stand-security.service';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// Extended request interface for security context
export interface SecurityRequest extends Request {
  securityContext?: SecurityContext;
  requestId?: string;
  sessionId?: string;
}

// Security headers configuration
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * Initialize security context middleware
 */
export const initializeSecurityContext = (prisma: PrismaClient) => {
  const securityService = new StandSecurityService(prisma);

  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    try {
      // Generate request and session IDs
      req.requestId = crypto.randomUUID();
      req.sessionId = (req.headers['x-session-id'] as string) || crypto.randomUUID();

      // Extract user context from headers/auth token
      const userId = (req.headers['x-user-id'] as string) || 'anonymous';
      const organizationId = req.headers['x-organization-id'] as string;
      const userRole = (req.headers['x-user-role'] as string) || 'user';
      const permissions = ((req.headers['x-user-permissions'] as string) || '')
        .split(',')
        .filter(Boolean);

      // Build security context
      const securityContext: SecurityContext = {
        userId,
        organizationId,
        role: userRole,
        permissions,
        accessLevel:
          userRole === 'admin'
            ? 'admin'
            : permissions.includes('capability_management')
              ? 'write'
              : 'read',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.requestId,
        sessionId: req.sessionId,
      };

      req.securityContext = securityContext;

      // Set RLS context in database
      if (organizationId) {
        await securityService.setRLSContext(securityContext);
      }

      next();
    } catch (error) {
      console.error('Security context initialization failed:', error);
      res.status(500).json({
        success: false,
        error: 'Security initialization failed',
        requestId: req.requestId,
      });
    }
  };
};

/**
 * Apply security headers middleware
 */
export const applySecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Apply all security headers
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  // Add request tracking headers
  if ((req as SecurityRequest).requestId) {
    res.setHeader('X-Request-ID', (req as SecurityRequest).requestId!);
  }

  next();
};

/**
 * Input validation and sanitization middleware
 */
export const validateAndSanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Validate content type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const contentType = req.headers['content-type'];
    if (!contentType?.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type. Expected application/json',
      });
    }
  }

  next();
};

/**
 * Rate limiting per user/organization
 */
export const rateLimitByOrganization = (windowMs: number = 60000, maxRequests: number = 100) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: SecurityRequest, res: Response, next: NextFunction) => {
    const key = `${req.securityContext?.organizationId}:${req.securityContext?.userId}`;
    const now = Date.now();

    const record = requests.get(key);

    if (!record || record.resetTime < now) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter,
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    next();
  };
};

/**
 * Audit logging middleware
 */
export const auditLog = (action: string) => {
  return async (req: SecurityRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;

    // Capture response
    let responseData: any;
    let success = true;

    res.send = function (data: any) {
      responseData = data;
      success = res.statusCode < 400;
      return originalSend.call(this, data);
    };

    res.json = function (data: any) {
      responseData = data;
      success = res.statusCode < 400;
      return originalJson.call(this, data);
    };

    // Continue with request
    next();

    // Log after response
    res.on('finish', async () => {
      const duration = Date.now() - startTime;

      if (req.securityContext && req.securityContext.organizationId) {
        const prisma = new PrismaClient();
        const securityService = new StandSecurityService(prisma);

        try {
          await securityService.logStandAccess(
            req.securityContext,
            req.params.id || 'unknown',
            action,
            success,
            {
              method: req.method,
              path: req.path,
              query: req.query,
              duration,
              statusCode: res.statusCode,
              responseSize: responseData ? JSON.stringify(responseData).length : 0,
            }
          );
        } catch (error) {
          console.error('Audit logging failed:', error);
        } finally {
          await prisma.$disconnect();
        }
      }
    });
  };
};

/**
 * Permission check middleware
 */
export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: SecurityRequest, res: Response, next: NextFunction) => {
    if (!req.securityContext) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No security context',
      });
    }

    const hasPermission = requiredPermissions.some(
      (permission) =>
        req.securityContext!.permissions.includes(permission) ||
        req.securityContext!.role === 'admin'
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient permissions',
        required: requiredPermissions,
      });
    }

    next();
  };
};

/**
 * Sanitize object to prevent XSS
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[sanitizeString(key)] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize string to prevent XSS
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Error handler middleware for security errors
 */
export const handleSecurityError = (
  error: Error,
  req: SecurityRequest,
  res: Response,
  next: NextFunction
) => {
  console.error('Security error:', {
    error: error.message,
    requestId: req.requestId,
    userId: req.securityContext?.userId,
    organizationId: req.securityContext?.organizationId,
  });

  // Don't leak internal error details
  const message =
    process.env.NODE_ENV === 'production' ? 'A security error occurred' : error.message;

  res.status(500).json({
    success: false,
    error: message,
    requestId: req.requestId,
  });
};

// Export middleware collection for easy use
export const securityMiddleware = {
  initializeSecurityContext,
  applySecurityHeaders,
  validateAndSanitizeInput,
  rateLimitByOrganization,
  auditLog,
  requirePermissions,
  handleSecurityError,
};
