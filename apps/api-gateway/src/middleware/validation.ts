import { Request, Response, NextFunction } from 'express';
import { CapabilityValidationEngine } from '@capacity-planner/assets-module';
import { z } from 'zod';

const validationEngine = new CapabilityValidationEngine();

// Extended request interface for validation context
interface ValidationRequest extends Request {
  validationContext?: {
    performanceMetrics?: {
      startTime: number;
      validationDuration?: number;
      cacheHit?: boolean;
    };
  };
}

// Validation options schema
const validationOptionsSchema = z.object({
  useCache: z.boolean().default(true),
  performanceTracking: z.boolean().default(true),
  skipValidation: z.boolean().default(false),
});

/**
 * Middleware for validating capability requests
 */
export const validateCapabilityRequest = (
  req: ValidationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize validation context
    req.validationContext = {
      performanceMetrics: {
        startTime: Date.now(),
      },
    };

    // Parse validation options from headers or query
    const validationOptions = validationOptionsSchema.safeParse({
      useCache: req.headers['x-use-cache'] === 'true',
      performanceTracking: req.headers['x-performance-tracking'] === 'true',
      skipValidation: req.headers['x-skip-validation'] === 'true',
    });

    if (!validationOptions.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid validation options',
        details: validationOptions.error.errors,
      });
    }

    // Attach validation options to request
    req.validationOptions = validationOptions.data;

    next();
  } catch (error) {
    console.error('Error in validation middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error',
    });
  }
};

/**
 * Middleware for formatting validation responses
 */
export const formatValidationResponse = (
  req: ValidationRequest,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json;

  // Override json method to add validation metrics
  res.json = function (body: any) {
    if (req.validationContext?.performanceMetrics) {
      const endTime = Date.now();
      const duration = endTime - req.validationContext.performanceMetrics.startTime;

      // Add performance metrics to response
      if (body.success && body.data) {
        body.metadata = {
          ...(body.metadata || {}),
          validation: {
            duration,
            cacheMetrics: validationEngine.getCacheMetrics(),
            timestamp: new Date().toISOString(),
          },
        };
      }
    }

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Error handler for validation errors
 */
export const handleValidationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Validation error:', error);

  // Check if it's a validation-specific error
  if (error.message.includes('validation failed') || error.message.includes('Validation failed')) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Check if it's a capability-specific error
  if (error.message.includes('capability') || error.message.includes('Capability')) {
    return res.status(422).json({
      success: false,
      error: 'Capability validation error',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Pass to next error handler
  next(error);
};

/**
 * Middleware for tracking validation performance
 */
export const trackValidationPerformance = (
  req: ValidationRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Store original send method
  const originalSend = res.send;

  res.send = function (body: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log performance metrics
    console.log(`Validation request performance: ${duration}ms`);

    // Add performance headers
    res.set('X-Validation-Duration', duration.toString());
    res.set('X-Validation-Timestamp', new Date().toISOString());

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Middleware for caching validation results
 */
export const cacheValidationResults = (
  req: ValidationRequest,
  res: Response,
  next: NextFunction
) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = `validation:${req.originalUrl}:${JSON.stringify(req.query)}`;

  // Store original json method
  const originalJson = res.json;

  // Override json method to cache successful responses
  res.json = function (body: any) {
    if (body.success && body.data) {
      // Cache the response (implement your caching logic here)
      // This is a placeholder - you'd integrate with your actual cache
      console.log(`Caching validation result for key: ${cacheKey}`);
    }

    return originalJson.call(this, body);
  };

  next();
};

// Export validation engine for direct use
export { validationEngine };

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      validationOptions?: {
        useCache: boolean;
        performanceTracking: boolean;
        skipValidation: boolean;
      };
    }
  }
}
