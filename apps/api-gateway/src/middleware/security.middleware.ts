import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { SecurityValidator } from '@capacity-planner/assets-module';

export interface SecurityConfig {
  enableHelmet: boolean;
  enableRateLimit: boolean;
  enableCors: boolean;
  trustedProxies: string[];
  allowedOrigins: string[];
  maxRequestSize: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      securityContext?: {
        ipAddress: string;
        userAgent: string;
        sessionId: string;
        requestId: string;
      };
    }
  }
}

/**
 * Security headers middleware using Helmet
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
}

/**
 * Rate limiting middleware
 */
export function createRateLimiter(options?: { windowMs?: number; max?: number; message?: string }) {
  return rateLimit({
    windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options?.max || 100, // Limit each IP to 100 requests per windowMs
    message: options?.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: options?.message || 'Too many requests from this IP, please try again later.',
      });
    },
  });
}

/**
 * API-specific rate limiter (stricter)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'API rate limit exceeded. Please wait before making more requests.',
});

/**
 * Auth endpoint rate limiter (very strict)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
});

/**
 * Import endpoint rate limiter
 */
export const importRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 imports per hour
  message: 'Import rate limit exceeded. Please wait before uploading more files.',
});

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = SecurityValidator.sanitizeString(value);
        }
      }
    }

    // Sanitize route parameters
    if (req.params) {
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string' && key !== 'id') {
          req.params[key] = SecurityValidator.sanitizeString(value);
        }
      }
    }

    // Validate common parameters
    if (req.query.page || req.query.pageSize) {
      const validation = SecurityValidator.validatePagination(req.query.page, req.query.pageSize);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }
    }

    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
    });
  }
}

/**
 * Security context middleware
 */
export function securityContext(req: Request, res: Response, next: NextFunction) {
  // Extract security context
  req.securityContext = {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    sessionId: req.session?.id || 'no-session',
    requestId: req.get('x-request-id') || generateRequestId(),
  };

  // Add security headers
  res.setHeader('X-Request-ID', req.securityContext.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * CORS configuration
 */
export function configureCors(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Organization-ID, X-User-ID'
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
    } else {
      next();
    }
  };
}

/**
 * SQL injection prevention middleware
 */
export function preventSqlInjection(req: Request, res: Response, next: NextFunction) {
  const checkValue = (value: any): boolean => {
    if (typeof value !== 'string') return true;

    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(-{2}|\/\*|\*\/|;|\||&&|\|\||@@|@)/,
    ];

    return !sqlPatterns.some((pattern) => pattern.test(value));
  };

  const checkObject = (obj: any): boolean => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (!checkObject(value)) return false;
      } else if (!checkValue(value)) {
        return false;
      }
    }
    return true;
  };

  // Check all input sources
  const sources = [req.body, req.query, req.params];
  for (const source of sources) {
    if (source && !checkObject(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid characters detected in request',
      });
    }
  }

  next();
}

/**
 * File upload security middleware
 */
export function validateFileUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return next();
  }

  const validation = SecurityValidator.validateFileUpload(
    req.file.originalname,
    req.file.mimetype,
    req.file.size
  );

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
    });
  }

  next();
}

/**
 * API key authentication middleware
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.get('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
    });
  }

  if (!SecurityValidator.validateApiKey(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key format',
    });
  }

  // Additional API key verification would happen here
  // For now, we'll assume it's valid if format is correct

  next();
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Security monitoring middleware
 */
export function securityMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log security-relevant events
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const securityEvent = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.securityContext?.ipAddress,
      userAgent: req.securityContext?.userAgent,
      requestId: req.securityContext?.requestId,
    };

    // Log suspicious activity
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn('Security: Unauthorized access attempt', securityEvent);
    } else if (res.statusCode === 429) {
      console.warn('Security: Rate limit exceeded', securityEvent);
    } else if (duration > 5000) {
      console.warn('Security: Slow request detected', securityEvent);
    }
  });

  next();
}

/**
 * Combined security middleware stack
 */
export function applySecurityMiddleware(app: any, config: SecurityConfig) {
  // Basic security headers
  if (config.enableHelmet) {
    app.use(securityHeaders());
  }

  // CORS
  if (config.enableCors) {
    app.use(configureCors(config.allowedOrigins));
  }

  // Request size limit
  app.use(express.json({ limit: config.maxRequestSize }));
  app.use(express.urlencoded({ extended: true, limit: config.maxRequestSize }));

  // Security context
  app.use(securityContext);

  // Request sanitization
  app.use(sanitizeRequest);

  // SQL injection prevention
  app.use(preventSqlInjection);

  // Security monitoring
  app.use(securityMonitoring);

  // Trust proxy settings
  if (config.trustedProxies.length > 0) {
    app.set('trust proxy', config.trustedProxies);
  }
}
