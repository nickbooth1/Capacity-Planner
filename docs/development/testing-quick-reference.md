# Testing Quick Reference

## 🚀 Quick Start

### File Naming
```
feature.ts                    # Source file
feature.spec.ts              # Unit tests
feature.integration.spec.ts  # Integration tests
feature.e2e.spec.ts         # End-to-end tests
```

### Run Tests
```bash
# All tests for a module
pnpm test:assets

# Only unit tests
pnpm test:unit

# Only integration tests  
pnpm test:integration

# Watch mode (during development)
pnpm test:assets:watch

# With coverage
pnpm test:assets:coverage
```

## 📝 Test Template

### Unit Test
```typescript
import { MyService } from './my-service';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    mockDependency = createMockDependency();
    service = new MyService(mockDependency);
  });

  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = service.methodName(input);
      
      // Assert
      expect(result).toBe('expected');
    });

    it('should handle error case', () => {
      // Arrange
      mockDependency.someMethod.mockRejectedValue(new Error('Failed'));
      
      // Act & Assert
      await expect(service.methodName()).rejects.toThrow('Failed');
    });
  });
});
```

### Integration Test
```typescript
describe('MyRepository Integration', () => {
  let repository: MyRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.myTable.deleteMany();
    repository = new MyRepository(prisma);
  });

  it('should create and retrieve record', async () => {
    const created = await repository.create({ name: 'Test' });
    const found = await repository.findById(created.id);
    
    expect(found).toEqual(created);
  });
});
```

## 🎯 What to Test

### Unit Tests
- ✅ Business logic
- ✅ Pure functions
- ✅ Data transformations
- ✅ Validation rules
- ✅ Error handling
- ❌ Database queries
- ❌ External APIs
- ❌ File system

### Integration Tests
- ✅ Database operations
- ✅ Service interactions
- ✅ Transactions
- ✅ Cache behavior
- ❌ External APIs (mock them)
- ❌ UI interactions

### E2E Tests
- ✅ Complete API flows
- ✅ Authentication
- ✅ User journeys
- ✅ Error responses

## 🛠️ Common Patterns

### Test Data Factory
```typescript
export const createTestUser = (overrides?: Partial<User>): User => ({
  id: 'test-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});
```

### Mock Factory
```typescript
export const createMockService = () => ({
  method1: jest.fn(),
  method2: jest.fn().mockResolvedValue('result'),
  method3: jest.fn().mockRejectedValue(new Error('Error')),
});
```

### Parameterized Tests
```typescript
it.each([
  [2, 2, 4],
  [0, 5, 5],
  [-1, 1, 0],
])('add(%i, %i) should return %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});
```

## 📊 Coverage Requirements

- **Minimum**: 80% overall
- **Critical paths**: 95%
- **New code**: 90%

Check coverage:
```bash
pnpm test:assets:coverage
open coverage/packages/assets-module/index.html
```

## 🐛 Debugging

```bash
# Run specific test
pnpm nx test assets-module --testNamePattern="should create"

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Clear cache
pnpm nx reset
```

## ⚡ Performance Testing

```typescript
it('should complete within performance budget', async () => {
  const start = Date.now();
  
  await service.processLargeDataset(1000);
  
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(2000); // 2 seconds
});
```

## 🔧 Test Utilities

### Global Test Helpers (in test-setup.ts)
```typescript
global.createTestStand = (overrides = {}) => ({
  id: 'test-stand-1',
  code: 'A1',
  // ... defaults
  ...overrides,
});
```

### Custom Matchers
```typescript
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      pass: emailRegex.test(received),
      message: () => `Expected ${received} to be a valid email`,
    };
  },
});
```

## 📋 Checklist

Before committing:
- [ ] All tests pass
- [ ] Coverage meets requirements
- [ ] No `.only` or `.skip` left in tests
- [ ] No console.logs in tests
- [ ] Tests run in isolation
- [ ] Mock data cleaned up
- [ ] Performance benchmarks met

## 🚨 Common Mistakes

1. **Testing implementation instead of behavior**
   ```typescript
   // ❌ Bad
   expect(service._privateMethod()).toBe(true);
   
   // ✅ Good
   expect(service.publicMethod()).toBe(true);
   ```

2. **Not cleaning up test data**
   ```typescript
   // ✅ Always clean up
   afterEach(async () => {
     await cleanup();
   });
   ```

3. **Dependent tests**
   ```typescript
   // ❌ Bad - depends on previous test
   it('should update user', () => {
     const user = globalUser; // Set by previous test
   });
   
   // ✅ Good - independent
   it('should update user', () => {
     const user = createTestUser();
   });
   ```