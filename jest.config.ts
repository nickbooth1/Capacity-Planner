import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
  // Global test match patterns for different test types
  testMatch: process.env.TEST_TYPE === 'unit' 
    ? ['**/*.spec.ts', '!**/*.integration.spec.ts', '!**/*.e2e.spec.ts']
    : process.env.TEST_TYPE === 'integration'
    ? ['**/*.integration.spec.ts', '**/*.e2e.spec.ts'] 
    : undefined // Run all tests if TEST_TYPE not specified
});