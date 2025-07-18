import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createGzip, createDeflate, createBrotliCompress } from 'zlib';

// Compression configuration
interface CompressionConfig {
  enabled: boolean;
  level: number; // 1-9 for gzip/deflate, 1-11 for brotli
  threshold: number; // Minimum response size to compress (bytes)
  algorithms: ('gzip' | 'deflate' | 'br')[];
}

const config: CompressionConfig = {
  enabled: process.env.NODE_ENV === 'production',
  level: 6,
  threshold: 1024, // 1KB
  algorithms: ['br', 'gzip', 'deflate'],
};

/**
 * Custom compression middleware with advanced options
 */
export const advancedCompression = (options: Partial<CompressionConfig> = {}) => {
  const finalConfig = { ...config, ...options };

  if (!finalConfig.enabled) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return compression({
    level: finalConfig.level,
    threshold: finalConfig.threshold,

    // Custom filter function
    filter: (req: Request, res: Response) => {
      // Don't compress if already compressed
      if (res.getHeader('content-encoding')) {
        return false;
      }

      // Don't compress if client doesn't accept it
      const acceptEncoding = req.headers['accept-encoding'];
      if (!acceptEncoding) {
        return false;
      }

      // Only compress JSON responses
      const contentType = res.getHeader('content-type');
      if (!contentType || !contentType.toString().includes('application/json')) {
        return false;
      }

      return true;
    },

    // Custom compression strategy
    strategy: (req: Request, res: Response) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';

      // Check for supported algorithms in order of preference
      for (const algorithm of finalConfig.algorithms) {
        if (acceptEncoding.includes(algorithm)) {
          return algorithm;
        }
      }

      return 'gzip'; // fallback
    },
  });
};

/**
 * Middleware for streaming compression
 */
export const streamingCompression = (req: Request, res: Response, next: NextFunction) => {
  if (!config.enabled) {
    return next();
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  let stream: any;

  // Choose compression algorithm
  if (acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br');
    stream = createBrotliCompress();
  } else if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    stream = createGzip();
  } else if (acceptEncoding.includes('deflate')) {
    res.setHeader('Content-Encoding', 'deflate');
    stream = createDeflate();
  }

  if (stream) {
    // Store original write and end methods
    const originalWrite = res.write;
    const originalEnd = res.end;

    // Override write method
    res.write = function (chunk: any, encoding?: BufferEncoding) {
      return stream.write(chunk, encoding);
    };

    // Override end method
    res.end = function (chunk?: any, encoding?: BufferEncoding) {
      if (chunk) {
        stream.write(chunk, encoding);
      }
      stream.end();
      return originalEnd.call(this);
    };

    // Pipe compressed stream to response
    stream.pipe(res);
  }

  next();
};

/**
 * Middleware for content-specific compression
 */
export const contentSpecificCompression = (req: Request, res: Response, next: NextFunction) => {
  if (!config.enabled) {
    return next();
  }

  // Store original json method
  const originalJson = res.json;

  // Override json method with compression
  res.json = function (body: any) {
    const jsonString = JSON.stringify(body);
    const size = Buffer.byteLength(jsonString, 'utf8');

    // Only compress if above threshold
    if (size < config.threshold) {
      return originalJson.call(this, body);
    }

    // Set headers for compression
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Original-Size', size.toString());

    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (acceptEncoding.includes('br')) {
      res.setHeader('Content-Encoding', 'br');
      const brotli = createBrotliCompress({ level: config.level });

      brotli.write(jsonString);
      brotli.end();

      const chunks: Buffer[] = [];
      brotli.on('data', (chunk) => chunks.push(chunk));
      brotli.on('end', () => {
        const compressed = Buffer.concat(chunks);
        res.setHeader('X-Compressed-Size', compressed.length.toString());
        res.setHeader('X-Compression-Ratio', ((compressed.length / size) * 100).toFixed(2) + '%');
        res.send(compressed);
      });
    } else if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      const gzip = createGzip({ level: config.level });

      gzip.write(jsonString);
      gzip.end();

      const chunks: Buffer[] = [];
      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => {
        const compressed = Buffer.concat(chunks);
        res.setHeader('X-Compressed-Size', compressed.length.toString());
        res.setHeader('X-Compression-Ratio', ((compressed.length / size) * 100).toFixed(2) + '%');
        res.send(compressed);
      });
    } else {
      return originalJson.call(this, body);
    }
  };

  next();
};

/**
 * Middleware for compression statistics
 */
export const compressionStats = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (body: any) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Add compression statistics headers
    res.setHeader('X-Processing-Time', processingTime.toString());
    res.setHeader('X-Compression-Enabled', config.enabled.toString());

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Get compression statistics
 */
export const getCompressionStats = () => {
  return {
    enabled: config.enabled,
    level: config.level,
    threshold: config.threshold,
    algorithms: config.algorithms,
  };
};

export default advancedCompression;
