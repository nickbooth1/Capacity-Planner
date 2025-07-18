// Test setup for work-module

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(30000);

// Mock Date.now to ensure consistent test results
const mockDate = new Date('2024-01-15T10:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
