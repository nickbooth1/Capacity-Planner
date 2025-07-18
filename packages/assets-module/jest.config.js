module.exports = {
  displayName: 'assets-module',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/assets-module',
  testMatch: [
    // Unit tests - co-located with source files
    '<rootDir>/src/**/*.spec.ts',
    // Integration tests - co-located with source files
    '<rootDir>/src/**/*.integration.spec.ts',
    // E2E tests - co-located with source files
    '<rootDir>/src/**/*.e2e.spec.ts',
  ],
  // Ignore test files when collecting coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!src/**/*.e2e.spec.ts',
    '!src/**/index.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
};
