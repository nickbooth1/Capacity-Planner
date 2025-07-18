#!/usr/bin/env node

const { execSync } = require('child_process');
const process = require('process');

const testType = process.argv[2];
const project = process.argv[3];

let testCommand;

if (testType === 'unit') {
  // Run only unit tests (exclude integration and e2e)
  testCommand = project 
    ? `nx test ${project} --testNamePattern="^(?!.*Integration).*$"`
    : `nx run-many --target=test --all --parallel --testNamePattern="^(?!.*Integration).*$"`;
} else if (testType === 'integration') {
  // Run only integration and e2e tests
  testCommand = project
    ? `nx test ${project} --testNamePattern="Integration"`
    : `nx run-many --target=test --all --parallel --testNamePattern="Integration"`;
} else if (testType === 'all') {
  // Run all tests
  testCommand = project
    ? `nx test ${project}`
    : `nx run-many --target=test --all --parallel`;
} else {
  console.error(`
Usage: node scripts/test-by-type.js <type> [project]
  type: unit | integration | all
  project: optional project name (e.g., assets-module)

Examples:
  node scripts/test-by-type.js unit              # Run all unit tests
  node scripts/test-by-type.js unit assets-module # Run unit tests for assets-module
  node scripts/test-by-type.js integration       # Run all integration tests
  node scripts/test-by-type.js all               # Run all tests
`);
  process.exit(1);
}

console.log(`Running ${testType} tests${project ? ` for ${project}` : ''}...`);
console.log(`Command: ${testCommand}`);

try {
  execSync(testCommand, { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}