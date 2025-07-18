/**
 * Example: Testing a Validation Service
 * 
 * This example demonstrates how to write comprehensive unit tests
 * for a validation service with multiple rules and edge cases.
 */

import { EmailValidator, PasswordValidator, ValidationResult } from './validators';

describe('EmailValidator', () => {
  let validator: EmailValidator;

  beforeEach(() => {
    validator = new EmailValidator();
  });

  describe('validate', () => {
    // Test valid cases
    describe('valid emails', () => {
      it.each([
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@subdomain.example.com',
      ])('should accept valid email: %s', (email) => {
        const result = validator.validate(email);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    // Test invalid cases
    describe('invalid emails', () => {
      it.each([
        ['', 'Email is required'],
        ['notanemail', 'Invalid email format'],
        ['@example.com', 'Invalid email format'],
        ['user@', 'Invalid email format'],
        ['user @example.com', 'Email contains invalid characters'],
        ['user@example', 'Invalid domain'],
      ])('should reject invalid email: %s', (email, expectedError) => {
        const result = validator.validate(email);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });

    // Test edge cases
    describe('edge cases', () => {
      it('should handle null input', () => {
        const result = validator.validate(null as any);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Email is required');
      });

      it('should trim whitespace', () => {
        const result = validator.validate('  user@example.com  ');
        
        expect(result.isValid).toBe(true);
        expect(result.normalizedValue).toBe('user@example.com');
      });

      it('should convert to lowercase', () => {
        const result = validator.validate('User@EXAMPLE.COM');
        
        expect(result.isValid).toBe(true);
        expect(result.normalizedValue).toBe('user@example.com');
      });

      it('should handle very long emails', () => {
        const longEmail = 'a'.repeat(255) + '@example.com';
        const result = validator.validate(longEmail);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Email exceeds maximum length');
      });
    });
  });
});

describe('PasswordValidator', () => {
  let validator: PasswordValidator;

  beforeEach(() => {
    validator = new PasswordValidator({
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    });
  });

  describe('validate', () => {
    it('should accept strong password', () => {
      const result = validator.validate('StrongP@ss123');
      
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('STRONG');
    });

    it('should provide specific error messages', () => {
      const result = validator.validate('weak');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Password must be at least 8 characters',
          'Password must contain uppercase letter',
          'Password must contain number',
          'Password must contain special character',
        ])
      );
    });

    it('should calculate password strength', () => {
      const testCases = [
        { password: 'Simple123', strength: 'WEAK' },
        { password: 'Better@123', strength: 'MEDIUM' },
        { password: 'V3ry$tr0ng!Pass', strength: 'STRONG' },
      ];

      testCases.forEach(({ password, strength }) => {
        const result = validator.validate(password);
        expect(result.strength).toBe(strength);
      });
    });

    it('should detect common passwords', () => {
      const commonPasswords = ['password123', 'qwerty123', 'admin123'];
      
      commonPasswords.forEach(password => {
        const result = validator.validate(password);
        expect(result.warnings).toContain('Password is too common');
      });
    });
  });

  describe('with custom configuration', () => {
    it('should respect custom requirements', () => {
      const customValidator = new PasswordValidator({
        minLength: 12,
        requireUppercase: false,
        requireSpecialChars: false,
      });

      const result = customValidator.validate('simplelongpassword123');
      
      expect(result.isValid).toBe(true);
    });
  });
});

// Example of testing async validation
describe('AsyncValidator', () => {
  let validator: AsyncValidator;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    mockApiClient = {
      checkEmailExists: jest.fn(),
      checkUsernameExists: jest.fn(),
    };
    validator = new AsyncValidator(mockApiClient);
  });

  describe('validateEmailUniqueness', () => {
    it('should pass when email does not exist', async () => {
      mockApiClient.checkEmailExists.mockResolvedValue(false);

      const result = await validator.validateEmailUniqueness('new@example.com');

      expect(result.isValid).toBe(true);
      expect(mockApiClient.checkEmailExists).toHaveBeenCalledWith('new@example.com');
    });

    it('should fail when email already exists', async () => {
      mockApiClient.checkEmailExists.mockResolvedValue(true);

      const result = await validator.validateEmailUniqueness('taken@example.com');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email already in use');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.checkEmailExists.mockRejectedValue(new Error('Network error'));

      const result = await validator.validateEmailUniqueness('test@example.com');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unable to validate email');
      expect(result.warnings).toContain('Validation service temporarily unavailable');
    });

    it('should cache validation results', async () => {
      mockApiClient.checkEmailExists.mockResolvedValue(false);

      // First call
      await validator.validateEmailUniqueness('cached@example.com');
      
      // Second call should use cache
      await validator.validateEmailUniqueness('cached@example.com');

      expect(mockApiClient.checkEmailExists).toHaveBeenCalledTimes(1);
    });
  });
});

// Example of performance testing
describe('ValidationPerformance', () => {
  let validator: BulkValidator;

  beforeEach(() => {
    validator = new BulkValidator();
  });

  it('should validate 1000 items within performance budget', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      email: `user${i}@example.com`,
      password: `Pass${i}@123`,
    }));

    const startTime = performance.now();
    const results = await validator.validateBulk(items);
    const duration = performance.now() - startTime;

    expect(results).toHaveLength(1000);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    
    console.log(`Validated 1000 items in ${duration.toFixed(2)}ms`);
  });
});

// Example of snapshot testing for complex validation rules
describe('ValidationRules Snapshot', () => {
  it('should match validation rules snapshot', () => {
    const rules = validator.getRules();
    
    expect(rules).toMatchSnapshot();
  });
});

// Example of testing validation with fixtures
describe('Validation with Fixtures', () => {
  const validEmails = require('./fixtures/valid-emails.json');
  const invalidEmails = require('./fixtures/invalid-emails.json');

  it.each(validEmails)('should accept valid email from fixtures: %s', (email) => {
    const result = validator.validate(email);
    expect(result.isValid).toBe(true);
  });

  it.each(invalidEmails)('should reject invalid email from fixtures: %s', (email) => {
    const result = validator.validate(email);
    expect(result.isValid).toBe(false);
  });
});