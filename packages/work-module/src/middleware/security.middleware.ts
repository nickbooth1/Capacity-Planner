import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuditTrailService } from '../services/audit-trail.service';

export interface SecurityConfig {
  enableCSRFProtection: boolean;
  enableRateLimiting: boolean;
  enableIPWhitelisting: boolean;
  ipWhitelist: string[];
  maxRequestsPerMinute: number;
  enableRequestSigning: boolean;
  secretKey: string;
}

export class SecurityMiddleware {
  private config: SecurityConfig;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private auditService?: AuditTrailService;

  constructor(config: Partial<SecurityConfig> = {}, auditService?: AuditTrailService) {
    this.config = {
      enableCSRFProtection: true,
      enableRateLimiting: true,
      enableIPWhitelisting: false,
      ipWhitelist: [],
      maxRequestsPerMinute: 60,
      enableRequestSigning: false,
      secretKey: process.env.SECURITY_SECRET_KEY || 'default-secret-key',
      ...config,
    };
    this.auditService = auditService;
  }

  // CSRF Protection
  csrfProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableCSRFProtection) {
        return next();
      }

      // Skip CSRF for GET requests
      if (req.method === 'GET') {
        return next();
      }

      const token = req.headers['x-csrf-token'] as string;
      const sessionToken = (req as any).session?.csrfToken;

      if (!token || !sessionToken || token !== sessionToken) {
        this.logSecurityEvent(req, 'csrf_validation_failed', 'failure');
        return res.status(403).json({
          success: false,
          error: 'Invalid CSRF token',
        });
      }

      next();
    };
  }

  // Rate Limiting
  rateLimiting() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableRateLimiting) {
        return next();
      }

      const identifier = this.getRequestIdentifier(req);
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute window

      // Clean up old entries
      this.cleanupRequestCounts(windowStart);

      // Get or create counter
      let counter = this.requestCounts.get(identifier);
      if (!counter || counter.resetTime < now) {
        counter = { count: 0, resetTime: now + 60000 };
        this.requestCounts.set(identifier, counter);
      }

      counter.count++;

      if (counter.count > this.config.maxRequestsPerMinute) {
        this.logSecurityEvent(req, 'rate_limit_exceeded', 'failure');
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil((counter.resetTime - now) / 1000),
        });
      }

      next();
    };
  }

  // IP Whitelisting
  ipWhitelisting() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableIPWhitelisting || this.config.ipWhitelist.length === 0) {
        return next();
      }

      const clientIP = this.getClientIP(req);

      if (!this.config.ipWhitelist.includes(clientIP)) {
        this.logSecurityEvent(req, 'ip_whitelist_denied', 'failure', { ip: clientIP });
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      next();
    };
  }

  // Request Signing Verification
  requestSigning() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableRequestSigning) {
        return next();
      }

      const signature = req.headers['x-signature'] as string;
      const timestamp = req.headers['x-timestamp'] as string;

      if (!signature || !timestamp) {
        this.logSecurityEvent(req, 'request_signature_missing', 'failure');
        return res.status(401).json({
          success: false,
          error: 'Request signature required',
        });
      }

      // Check timestamp to prevent replay attacks
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      if (Math.abs(now - requestTime) > 300000) {
        // 5 minutes
        this.logSecurityEvent(req, 'request_signature_expired', 'failure');
        return res.status(401).json({
          success: false,
          error: 'Request signature expired',
        });
      }

      // Verify signature
      const payload = `${req.method}:${req.path}:${timestamp}:${JSON.stringify(req.body)}`;
      const expectedSignature = this.generateSignature(payload);

      if (signature !== expectedSignature) {
        this.logSecurityEvent(req, 'request_signature_invalid', 'failure');
        return res.status(401).json({
          success: false,
          error: 'Invalid request signature',
        });
      }

      next();
    };
  }

  // Content Security Headers
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Prevent XSS attacks
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');

      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Enable strict transport security
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

      // Content Security Policy
      res.setHeader('Content-Security-Policy', "default-src 'self'");

      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // Permissions Policy
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      next();
    };
  }

  // Input Sanitization
  inputSanitization() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize params
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }

      next();
    };
  }

  // SQL Injection Prevention
  sqlInjectionPrevention() {
    return (req: Request, res: Response, next: NextFunction) => {
      const suspicious = this.detectSQLInjection(req);

      if (suspicious) {
        this.logSecurityEvent(req, 'sql_injection_attempt', 'failure');
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
        });
      }

      next();
    };
  }

  // File Upload Security
  fileUploadSecurity() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.file && !req.files) {
        return next();
      }

      // Check for double extensions
      const files = req.files
        ? Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat()
        : [req.file];

      for (const file of files.filter(Boolean)) {
        if (this.hasDoubleExtension(file.originalname)) {
          this.logSecurityEvent(req, 'file_double_extension', 'failure', {
            filename: file.originalname,
          });
          return res.status(400).json({
            success: false,
            error: 'Invalid file name',
          });
        }

        // Check for null bytes
        if (file.originalname.includes('\0')) {
          this.logSecurityEvent(req, 'file_null_byte', 'failure', { filename: file.originalname });
          return res.status(400).json({
            success: false,
            error: 'Invalid file name',
          });
        }
      }

      next();
    };
  }

  private getRequestIdentifier(req: Request): string {
    const userId = (req as any).user?.id || 'anonymous';
    const ip = this.getClientIP(req);
    return `${userId}:${ip}`;
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private cleanupRequestCounts(windowStart: number): void {
    for (const [key, value] of this.requestCounts.entries()) {
      if (value.resetTime < windowStart) {
        this.requestCounts.delete(key);
      }
    }
  }

  private generateSignature(payload: string): string {
    return crypto.createHmac('sha256', this.config.secretKey).update(payload).digest('hex');
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[this.sanitizeValue(key)] = this.sanitizeObject(value);
    }
    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove null bytes
    value = value.replace(/\0/g, '');

    // Escape HTML entities
    value = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return value;
  }

  private detectSQLInjection(req: Request): boolean {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b[\s\S]*\b(from|into|where|table)\b)/i,
      /(\b(or|and)\b[\s]*['"0-9][\s]*=[\s]*['"0-9])/i,
      /(--|\*|\/\*|\*\/|xp_|sp_|@@|@)/i,
      /(\b(char|nchar|varchar|nvarchar|cast|convert|exec)\s*\()/i,
    ];

    const checkString = (str: string): boolean => {
      return sqlPatterns.some((pattern) => pattern.test(str));
    };

    const checkObject = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return checkString(obj);
      }
      if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some((value) => checkObject(value));
      }
      return false;
    };

    return checkObject(req.query) || checkObject(req.body) || checkObject(req.params);
  }

  private hasDoubleExtension(filename: string): boolean {
    const parts = filename.split('.');
    if (parts.length < 3) return false;

    const suspiciousExtensions = ['php', 'asp', 'aspx', 'jsp', 'cgi', 'exe', 'bat', 'sh'];

    return parts.some(
      (part, index) => index < parts.length - 1 && suspiciousExtensions.includes(part.toLowerCase())
    );
  }

  private logSecurityEvent(
    req: Request,
    action: string,
    result: 'success' | 'failure',
    metadata: Record<string, any> = {}
  ): void {
    if (!this.auditService) return;

    const actor = {
      id: (req as any).user?.id || 'anonymous',
      name: (req as any).user?.name || 'Anonymous',
      email: (req as any).user?.email || 'anonymous@unknown',
      role: (req as any).user?.role || 'guest',
    };

    this.auditService.logSecurityEvent(
      action,
      actor,
      {
        ...metadata,
        method: req.method,
        path: req.path,
        ip: this.getClientIP(req),
        userAgent: req.headers['user-agent'],
        organizationId: (req as any).organizationId,
      },
      result
    );
  }

  // Combine all middleware
  all() {
    return [
      this.securityHeaders(),
      this.ipWhitelisting(),
      this.rateLimiting(),
      this.inputSanitization(),
      this.sqlInjectionPrevention(),
      this.fileUploadSecurity(),
      this.csrfProtection(),
      this.requestSigning(),
    ];
  }
}
