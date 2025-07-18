import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Security validation utilities for input sanitization and validation
 */

// SQL injection pattern detection
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
  /(-{2}|\/\*|\*\/|;|\||&&|\|\||@@|@)/,
  /(xp_|sp_|exec|execute|declare|cast|convert)/i,
];

// XSS pattern detection
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
];

// Path traversal pattern detection
const PATH_TRAVERSAL_PATTERNS = [/\.\.(\/|\\)/, /\.\.%2[fF]/, /%2[eE]\./];

export class SecurityValidator {
  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    if (!input) return '';

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // HTML encode
    sanitized = validator.escape(sanitized);

    return sanitized;
  }

  /**
   * Sanitize HTML content
   */
  static sanitizeHtml(input: string): string {
    if (!input) return '';

    // Use DOMPurify for comprehensive HTML sanitization
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: [],
    });
  }

  /**
   * Validate and sanitize stand code
   */
  static validateStandCode(code: string): { valid: boolean; sanitized: string; error?: string } {
    if (!code) {
      return { valid: false, sanitized: '', error: 'Stand code is required' };
    }

    // Basic sanitization
    const sanitized = this.sanitizeString(code).toUpperCase();

    // Stand code pattern: alphanumeric, 1-10 characters
    if (!/^[A-Z0-9]{1,10}$/.test(sanitized)) {
      return {
        valid: false,
        sanitized,
        error: 'Stand code must be 1-10 alphanumeric characters',
      };
    }

    // Check for SQL injection patterns
    if (this.containsSqlInjection(sanitized)) {
      return {
        valid: false,
        sanitized,
        error: 'Invalid characters in stand code',
      };
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate and sanitize terminal name
   */
  static validateTerminal(terminal: string): { valid: boolean; sanitized: string; error?: string } {
    if (!terminal) {
      return { valid: true, sanitized: '' }; // Terminal is optional
    }

    const sanitized = this.sanitizeString(terminal);

    // Terminal pattern: alphanumeric with spaces, 1-50 characters
    if (!/^[A-Za-z0-9\s\-]{1,50}$/.test(sanitized)) {
      return {
        valid: false,
        sanitized,
        error: 'Terminal must be 1-50 alphanumeric characters',
      };
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate JSON data
   */
  static validateJsonData(data: any, maxDepth: number = 5): { valid: boolean; error?: string } {
    try {
      // Check depth
      if (this.getJsonDepth(data) > maxDepth) {
        return { valid: false, error: 'JSON structure too deep' };
      }

      // Check size
      const jsonString = JSON.stringify(data);
      if (jsonString.length > 1048576) {
        // 1MB limit
        return { valid: false, error: 'JSON data too large' };
      }

      // Check for suspicious patterns in string values
      const checkStrings = (obj: any): boolean => {
        if (typeof obj === 'string') {
          return !this.containsSqlInjection(obj) && !this.containsXss(obj);
        }
        if (Array.isArray(obj)) {
          return obj.every(checkStrings);
        }
        if (obj && typeof obj === 'object') {
          return Object.values(obj).every(checkStrings);
        }
        return true;
      };

      if (!checkStrings(data)) {
        return { valid: false, error: 'Invalid content in JSON data' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON data' };
    }
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(
    filename: string,
    mimetype: string,
    size: number
  ): { valid: boolean; error?: string } {
    // Sanitize filename
    const sanitizedFilename = validator.escape(filename);

    // Check for path traversal
    if (this.containsPathTraversal(sanitizedFilename)) {
      return { valid: false, error: 'Invalid filename' };
    }

    // Allowed file types for CSV import
    const allowedMimetypes = [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
    ];

    if (!allowedMimetypes.includes(mimetype)) {
      return { valid: false, error: 'Invalid file type. Only CSV files are allowed' };
    }

    // File size limit: 10MB
    if (size > 10 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    return { valid: true };
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(
    page: any,
    pageSize: any
  ): { valid: boolean; page: number; pageSize: number; error?: string } {
    const pageNum = parseInt(page, 10);
    const size = parseInt(pageSize, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return { valid: false, page: 1, pageSize: 50, error: 'Invalid page number' };
    }

    if (isNaN(size) || size < 1 || size > 100) {
      return {
        valid: false,
        page: pageNum,
        pageSize: 50,
        error: 'Page size must be between 1 and 100',
      };
    }

    return { valid: true, page: pageNum, pageSize: size };
  }

  /**
   * Check for SQL injection patterns
   */
  private static containsSqlInjection(input: string): boolean {
    return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
  }

  /**
   * Check for XSS patterns
   */
  private static containsXss(input: string): boolean {
    return XSS_PATTERNS.some((pattern) => pattern.test(input));
  }

  /**
   * Check for path traversal patterns
   */
  private static containsPathTraversal(input: string): boolean {
    return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(input));
  }

  /**
   * Get JSON depth
   */
  private static getJsonDepth(obj: any): number {
    if (obj === null || typeof obj !== 'object') return 0;

    if (Array.isArray(obj)) {
      return 1 + Math.max(0, ...obj.map((item) => this.getJsonDepth(item)));
    }

    const depths = Object.values(obj).map((val) => this.getJsonDepth(val));
    return 1 + Math.max(0, ...depths);
  }

  /**
   * Create secure schema for stand data
   */
  static createStandSchema() {
    return z.object({
      code: z
        .string()
        .min(1)
        .max(10)
        .regex(/^[A-Z0-9]+$/)
        .transform((val) => this.sanitizeString(val)),

      name: z
        .string()
        .min(1)
        .max(100)
        .transform((val) => this.sanitizeString(val)),

      terminal: z
        .string()
        .max(50)
        .optional()
        .transform((val) => (val ? this.sanitizeString(val) : undefined)),

      status: z.enum(['operational', 'maintenance', 'closed']).default('operational'),

      dimensions: z
        .object({
          length: z.number().min(0).max(1000).optional(),
          width: z.number().min(0).max(1000).optional(),
          height: z.number().min(0).max(100).optional(),
        })
        .optional(),

      aircraftCompatibility: z
        .object({
          maxWingspan: z.number().min(0).max(100).optional(),
          maxLength: z.number().min(0).max(100).optional(),
          maxWeight: z.number().min(0).max(1000000).optional(),
          compatibleCategories: z.array(z.string()).optional(),
        })
        .optional(),

      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    });
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string): boolean {
    // API key format: sk_[environment]_[32 random chars]
    const pattern = /^sk_(dev|test|prod)_[a-zA-Z0-9]{32}$/;
    return pattern.test(apiKey);
  }

  /**
   * Generate secure random token
   */
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';

    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);

      for (let i = 0; i < length; i++) {
        token += chars[array[i] % chars.length];
      }
    } else {
      // Node.js environment
      const crypto = require('crypto');
      for (let i = 0; i < length; i++) {
        token += chars[crypto.randomInt(0, chars.length)];
      }
    }

    return token;
  }
}
