# CapaCity Planner Testing Strategy

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Active  

## Overview

This document defines the testing strategy and standards for the CapaCity Planner project. All developers should follow these guidelines to ensure consistent, maintainable, and reliable tests across the codebase.

## Core Principles

1. **Test Co-location**: Tests live alongside the code they test
2. **Test First Development**: Write tests before implementation when possible
3. **Comprehensive Coverage**: Aim for 80%+ code coverage
4. **Fast Feedback**: Tests should run quickly and provide immediate feedback
5. **Clear Intent**: Test names should clearly describe what is being tested

## Test Organization

### File Structure

Tests are co-located with source files, not in separate test directories:

```
packages/[module-name]/src/
├── services/
│   ├── user.service.ts
│   ├── user.service.spec.ts              # Unit tests
│   └── user.service.integration.spec.ts  # Integration tests
├── controllers/
│   ├── user.controller.ts
│   ├── user.controller.spec.ts
│   └── user.controller.e2e.spec.ts       # E2E tests
└── utils/
    ├── validation.ts
    └── validation.spec.ts
```

### Naming Conventions

| Test Type | File Pattern | Example | Purpose |
|-----------|--------------|---------|---------|
| Unit | `*.spec.ts` | `user.service.spec.ts` | Test individual functions/classes in isolation |
| Integration | `*.integration.spec.ts` | `user.service.integration.spec.ts` | Test interactions between components |
| E2E | `*.e2e.spec.ts` | `user.controller.e2e.spec.ts` | Test complete workflows/endpoints |

## Test Categories

### 1. Unit Tests (`*.spec.ts`)

**Purpose**: Test individual components in isolation with all dependencies mocked.

**What to test**:
- Pure functions and business logic
- Individual class methods
- Data transformations
- Validation rules
- Error handling
- Edge cases

**Example**:
```typescript
// calculator.service.spec.ts
import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    service = new CalculatorService();
  });

  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(service.add(2, 3)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(service.add(-2, 3)).toBe(1);
    });

    it('should handle zero', () => {
      expect(service.add(0, 0)).toBe(0);
    });
  });
});
```

### 2. Integration Tests (`*.integration.spec.ts`)

**Purpose**: Test interactions between multiple components with real or test databases.

**What to test**:
- Database operations
- Service interactions
- Transaction handling
- Cache behavior
- Event publishing
- External API calls (with mocked responses)

**Example**:
```typescript
// user.repository.integration.spec.ts
import { PrismaClient } from '@prisma/client';
import { UserRepository } from './user.repository';

describe('UserRepository Integration', () => {
  let repository: UserRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    repository = new UserRepository(prisma);
  });

  describe('createUser', () => {
    it('should persist user to database', async () => {
      const userData = { name: 'John', email: 'john@example.com' };
      
      const user = await repository.createUser(userData);
      
      expect(user.id).toBeDefined();
      expect(user.name).toBe(userData.name);
      
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).toBeDefined();
    });
  });
});
```

### 3. E2E Tests (`*.e2e.spec.ts`)

**Purpose**: Test complete user workflows through API endpoints.

**What to test**:
- API endpoint responses
- Authentication/authorization flows
- Complete user journeys
- Error responses
- Rate limiting

**Example**:
```typescript
// auth.controller.e2e.spec.ts
import request from 'supertest';
import { app } from '../app';

describe('Auth Controller E2E', () => {
  describe('POST /auth/login', () => {
    it('should return JWT token for valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toMatch(/^eyJ/); // JWT format
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });
});
```

## Test Commands

### Module-Specific Testing

```bash
# Run all tests for a specific module
pnpm test:[module-name]
pnpm test:assets
pnpm test:entitlement

# Run tests in watch mode (for development)
pnpm test:[module-name]:watch
pnpm test:assets:watch

# Run tests with coverage report
pnpm test:[module-name]:coverage
pnpm test:assets:coverage
```

### Project-Wide Testing

```bash
# Run all unit tests across the monorepo
pnpm test:unit

# Run all integration tests
pnpm test:integration

# Run all tests (unit + integration + e2e)
pnpm test:all

# Run tests for affected modules only
pnpm affected:test
```

## Writing Good Tests

### Test Structure

Follow the AAA pattern:
- **Arrange**: Set up test data and dependencies
- **Act**: Execute the code being tested
- **Assert**: Verify the results

```typescript
it('should calculate discount correctly', () => {
  // Arrange
  const originalPrice = 100;
  const discountPercentage = 20;
  
  // Act
  const finalPrice = calculateDiscount(originalPrice, discountPercentage);
  
  // Assert
  expect(finalPrice).toBe(80);
});
```

### Test Descriptions

Use descriptive test names that explain the scenario:

```typescript
// ❌ Bad
it('test user creation', () => {});

// ✅ Good
it('should create user with valid email and password', () => {});
it('should throw error when email is already taken', () => {});
it('should hash password before saving to database', () => {});
```

### Test Data

Create test fixtures for reusable test data:

```typescript
// test/fixtures/users.fixture.ts
export const createTestUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date(),
  ...overrides,
});

export const createAdminUser = (): User => 
  createTestUser({ role: 'ADMIN', email: 'admin@example.com' });
```

## Mocking Strategy

### Database Mocking

For unit tests, mock the Prisma client:

```typescript
// test/mocks/prisma.mock.ts
export function createMockPrismaClient() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(this)),
  };
}
```

### External Service Mocking

Mock external services to avoid dependencies:

```typescript
// test/mocks/email.mock.ts
export const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
  sendBulkEmails: jest.fn().mockResolvedValue({ success: true }),
};
```

## Coverage Requirements

### Minimum Coverage Targets

| Metric | Target | Critical Paths* |
|--------|--------|-----------------|
| Statements | 80% | 95% |
| Branches | 80% | 95% |
| Functions | 80% | 95% |
| Lines | 80% | 95% |

*Critical paths include: Authentication, Authorization, Payment processing, Data validation

### Coverage Configuration

Each module's `jest.config.js` should include:

```javascript
module.exports = {
  // ... other config
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Critical paths with higher requirements
    './src/auth/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
```

## Performance Testing

For performance-critical code, include performance benchmarks:

```typescript
describe('Performance', () => {
  it('should process 1000 records in under 2 seconds', async () => {
    const records = generateTestRecords(1000);
    
    const startTime = Date.now();
    await service.processRecords(records);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(2000);
  });
});
```

## CI/CD Integration

All tests run automatically in CI/CD pipeline:

1. **Pre-commit**: Lint and format checks
2. **Pull Request**: 
   - Unit tests (must pass)
   - Integration tests (must pass)
   - Coverage check (must meet thresholds)
3. **Main branch merge**:
   - All tests including E2E
   - Performance benchmarks
   - Security scans

## Test Database Management

### Setup

Each developer should have local test databases:

```bash
# Create test databases
createdb capacity_planner_test
createdb capacity_planner_integration_test
```

### Configuration

Use environment variables for test databases:

```env
# .env.test
DATABASE_URL="postgresql://localhost/capacity_planner_test"
REDIS_URL="redis://localhost:6379/1"
```

### Cleanup

Always clean up test data:

```typescript
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;
});
```

## Debugging Tests

### Running Single Tests

```bash
# Run a single test file
pnpm nx test assets-module --testFile=user.service.spec.ts

# Run tests matching a pattern
pnpm nx test assets-module --testNamePattern="should create user"

# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Common Issues

1. **Timeout errors**: Increase timeout for integration tests
   ```typescript
   jest.setTimeout(30000); // 30 seconds for integration tests
   ```

2. **Database connection issues**: Ensure test database is running
   ```bash
   pnpm docker:db:up
   ```

3. **Mock not working**: Clear Jest cache
   ```bash
   pnpm nx reset
   ```

## Best Practices

### Do's ✅

1. **Write tests first** when implementing new features
2. **Keep tests simple** and focused on one thing
3. **Use descriptive names** that explain the test scenario
4. **Mock external dependencies** in unit tests
5. **Clean up resources** in afterEach/afterAll hooks
6. **Test edge cases** and error scenarios
7. **Use test fixtures** for consistent test data
8. **Run tests locally** before pushing

### Don'ts ❌

1. **Don't test implementation details** - test behavior
2. **Don't use production data** in tests
3. **Don't skip tests** - fix or remove them
4. **Don't rely on test order** - tests should be independent
5. **Don't hardcode values** - use constants or fixtures
6. **Don't ignore flaky tests** - fix the root cause
7. **Don't commit console.logs** in tests
8. **Don't use random data** without seeding

## Migration Guide

For existing tests in separate directories:

1. Move test file next to source file
2. Rename following naming conventions
3. Update imports
4. Run tests to ensure they still pass
5. Update coverage paths if needed

## Getting Help

- **Documentation**: See test examples in `/docs/examples/tests`
- **Questions**: Post in #testing Slack channel
- **Issues**: Create ticket with `testing` label
- **Reviews**: Tag @testing-team for test reviews

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2025 | Initial testing strategy |

---

Remember: **Good tests are an investment in code quality and team productivity!**