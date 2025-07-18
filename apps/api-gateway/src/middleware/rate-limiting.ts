import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message: string; // Error message when rate limit exceeded
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation based on IP and organization
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const organizationId = req.headers['x-organization-id'] || 'anonymous';
    const userId = req.headers['x-user-id'] || 'anonymous';

    return createHash('md5').update(`${ip}:${organizationId}:${userId}`).digest('hex');
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  checkLimit(req: Request): {
    allowed: boolean;
    count: number;
    remaining: number;
    resetTime: number;
  } {
    if (this.config.skip && this.config.skip(req)) {
      return {
        allowed: true,
        count: 0,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    const key = this.generateKey(req);
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
      };
      this.store.set(key, entry);
    } else {
      // Increment count
      entry.count++;
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = entry.count <= this.config.maxRequests;

    return {
      allowed,
      count: entry.count,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  getStats(): {
    totalEntries: number;
    storeSize: number;
    config: RateLimitConfig;
  } {
    return {
      totalEntries: this.store.size,
      storeSize: this.store.size,
      config: this.config,
    };
  }
}

// Default rate limiter configurations
const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.',
};

const strictConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
  message: 'Rate limit exceeded for this endpoint.',
};

const permissiveConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200,
  message: 'Too many requests, please slow down.',
};

// Rate limiter instances
const defaultLimiter = new RateLimiter(defaultConfig);
const strictLimiter = new RateLimiter(strictConfig);
const permissiveLimiter = new RateLimiter(permissiveConfig);

/**
 * Generic rate limiting middleware
 */
export const rateLimit = (config: Partial<RateLimitConfig> = {}) => {
  const limiter = new RateLimiter({ ...defaultConfig, ...config });

  return (req: Request, res: Response, next: NextFunction) => {
    const result = limiter.checkLimit(req);

    // Set rate limit headers
    res.set(
      'X-RateLimit-Limit',
      config.maxRequests?.toString() || defaultConfig.maxRequests.toString()
    );
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    res.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed) {
      res.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());

      if (config.onLimitReached) {
        config.onLimitReached(req, res);
      }

      return res.status(429).json({
        success: false,
        error: config.message || defaultConfig.message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
    }

    next();
  };
};

/**
 * Capability-specific rate limiting
 */
export const capabilityRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 30,
  message: 'Too many capability requests, please try again later.',
  keyGenerator: (req: Request) => {
    const organizationId = req.headers['x-organization-id'] || 'anonymous';
    const endpoint = req.path;
    return `capability:${organizationId}:${endpoint}`;
  },
});

/**
 * Validation-specific rate limiting
 */
export const validationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 20,
  message: 'Too many validation requests, please try again later.',
  keyGenerator: (req: Request) => {
    const organizationId = req.headers['x-organization-id'] || 'anonymous';
    return `validation:${organizationId}`;
  },
});

/**
 * Bulk operation rate limiting
 */
export const bulkOperationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 5,
  message: 'Too many bulk operations, please try again later.',
  keyGenerator: (req: Request) => {
    const organizationId = req.headers['x-organization-id'] || 'anonymous';
    return `bulk:${organizationId}`;
  },
});

/**
 * Administrative rate limiting
 */
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200,
  message: 'Administrative rate limit exceeded.',
  skip: (req: Request) => {
    // Skip rate limiting for certain admin operations
    return req.path.includes('/health') || req.path.includes('/metrics');
  },
});

/**
 * Request deduplication middleware
 */
export const deduplicationMiddleware = (
  windowMs: number = 1000 // 1 second
) => {
  const requestCache = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction) => {
    // Only deduplicate POST, PUT, PATCH requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const key = createHash('md5')
      .update(
        `${req.method}:${req.path}:${JSON.stringify(req.body)}:${req.headers['x-organization-id']}:${req.headers['x-user-id']}`
      )
      .digest('hex');

    const now = Date.now();
    const lastRequest = requestCache.get(key);

    if (lastRequest && now - lastRequest < windowMs) {
      return res.status(429).json({
        success: false,
        error: 'Duplicate request detected. Please wait before retrying.',
        retryAfter: Math.ceil((lastRequest + windowMs - now) / 1000),
      });
    }

    requestCache.set(key, now);

    // Clean up old entries
    setTimeout(() => {
      requestCache.delete(key);
    }, windowMs);

    next();
  };
};

/**
 * Get rate limiting statistics
 */
export const getRateLimitStats = () => {
  return {
    default: defaultLimiter.getStats(),
    strict: strictLimiter.getStats(),
    permissive: permissiveLimiter.getStats(),
  };
};

/**
 * Rate limiting configuration endpoint
 */
export const rateLimitConfigMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/rate-limit/stats') {
    return res.json({
      success: true,
      data: getRateLimitStats(),
    });
  }

  next();
};

export default rateLimit;
