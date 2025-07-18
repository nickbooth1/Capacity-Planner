// Test setup for assets-module
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient for unit tests
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    stand: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    standCapabilitySnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    standMaintenanceRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    standAdjacency: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaClient);
      }
      return Promise.all(callback);
    }),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Increase timeout for integration tests
if (process.env.TEST_TYPE === 'integration') {
  jest.setTimeout(30000);
} else {
  jest.setTimeout(5000);
}

// Global test utilities
global.createTestStand = (overrides = {}) => ({
  id: 'test-stand-1',
  organizationId: 'test-org',
  code: 'A1',
  name: 'Alpha 1',
  terminal: 'A',
  status: 'operational',
  dimensions: {},
  aircraftCompatibility: {},
  groundSupport: {},
  operationalConstraints: {},
  environmentalFeatures: {},
  infrastructure: {},
  geometry: null,
  latitude: null,
  longitude: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user',
  updatedBy: 'test-user',
  ...overrides,
});

// Clean up after tests
afterAll(async () => {
  // Clean up any resources
  await new Promise((resolve) => setTimeout(resolve, 500));
});
