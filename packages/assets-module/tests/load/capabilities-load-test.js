import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const capabilityReadTrend = new Trend('capability_read_duration');
const capabilityUpdateTrend = new Trend('capability_update_duration');
const validationTrend = new Trend('validation_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.1'], // Error rate must be below 10%
    capability_read_duration: ['p(95)<100'], // 95% of capability reads below 100ms
    capability_update_duration: ['p(95)<500'], // 95% of capability updates below 500ms
    validation_duration: ['p(95)<200'], // 95% of validations below 200ms
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';
const ORGANIZATION_ID = __ENV.ORGANIZATION_ID || 'test-org';

// Sample capability data
const sampleCapabilities = {
  dimensions: {
    length: 60,
    width: 45,
    height: 20,
    wingspan: 65,
    clearances: {
      wingtip: 5,
      nose: 3,
      tail: 3,
    },
    slopes: {
      longitudinal: 0.5,
      transverse: 0.3,
    },
  },
  aircraftCompatibility: {
    supportedCategories: ['C'],
    maxWingspan: 65,
    maxLength: 60,
    maxWeight: 100000,
    restrictions: [],
  },
  groundSupport: {
    powerSupply: {
      available: true,
      voltage: 400,
      frequency: 50,
      amperage: 200,
    },
    airConditioning: {
      available: true,
      capacity: 150,
    },
    jetBridge: {
      available: true,
      type: 'fixed',
    },
  },
};

// Stand IDs for testing (these should be pre-populated in test environment)
const standIds = [
  'stand-001',
  'stand-002',
  'stand-003',
  'stand-004',
  'stand-005',
  'stand-006',
  'stand-007',
  'stand-008',
  'stand-009',
  'stand-010',
  'stand-011',
  'stand-012',
  'stand-013',
  'stand-014',
  'stand-015',
  'stand-016',
  'stand-017',
  'stand-018',
  'stand-019',
  'stand-020',
];

// Helper function to get random stand ID
function getRandomStandId() {
  return standIds[Math.floor(Math.random() * standIds.length)];
}

// Helper function to create HTTP headers
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'X-Organization-ID': ORGANIZATION_ID,
  };
}

// Helper function to generate random capability variations
function generateRandomCapabilities() {
  const variations = {
    dimensions: {
      ...sampleCapabilities.dimensions,
      length: 50 + Math.floor(Math.random() * 30), // 50-80
      width: 35 + Math.floor(Math.random() * 25), // 35-60
      wingspan: 55 + Math.floor(Math.random() * 25), // 55-80
    },
    aircraftCompatibility: {
      ...sampleCapabilities.aircraftCompatibility,
      maxWingspan: 55 + Math.floor(Math.random() * 25),
      maxLength: 50 + Math.floor(Math.random() * 30),
      maxWeight: 80000 + Math.floor(Math.random() * 120000),
    },
    groundSupport: {
      ...sampleCapabilities.groundSupport,
      powerSupply: {
        ...sampleCapabilities.groundSupport.powerSupply,
        voltage: Math.random() > 0.5 ? 400 : 115,
        amperage: 150 + Math.floor(Math.random() * 150),
      },
    },
  };

  return variations;
}

// Test scenarios
export default function () {
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Read capabilities
    readCapabilities();
  } else if (scenario < 0.7) {
    // 30% - Update capabilities
    updateCapabilities();
  } else if (scenario < 0.9) {
    // 20% - Validate capabilities
    validateCapabilities();
  } else {
    // 10% - Bulk operations
    bulkUpdateCapabilities();
  }

  sleep(1); // 1 second between requests
}

function readCapabilities() {
  const standId = getRandomStandId();
  const url = `${BASE_URL}${API_VERSION}/stands/${standId}/capabilities`;

  const start = Date.now();
  const response = http.get(url, { headers: getHeaders() });
  const duration = Date.now() - start;

  capabilityReadTrend.add(duration);

  const success = check(response, {
    'capability read status is 200': (r) => r.status === 200,
    'capability read has standId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.standId === standId;
      } catch (e) {
        return false;
      }
    },
    'capability read has capabilities': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.capabilities && typeof body.capabilities === 'object';
      } catch (e) {
        return false;
      }
    },
    'capability read response time < 200ms': () => duration < 200,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function updateCapabilities() {
  const standId = getRandomStandId();
  const url = `${BASE_URL}${API_VERSION}/stands/${standId}/capabilities`;
  const capabilities = generateRandomCapabilities();

  const start = Date.now();
  const response = http.put(url, JSON.stringify(capabilities), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  capabilityUpdateTrend.add(duration);

  const success = check(response, {
    'capability update status is 200': (r) => r.status === 200,
    'capability update has success': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
    'capability update has validation result': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.validationResult && typeof body.validationResult === 'object';
      } catch (e) {
        return false;
      }
    },
    'capability update response time < 1000ms': () => duration < 1000,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function validateCapabilities() {
  const url = `${BASE_URL}${API_VERSION}/stands/capabilities/validate`;
  const capabilities = generateRandomCapabilities();

  const start = Date.now();
  const response = http.post(url, JSON.stringify(capabilities), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  validationTrend.add(duration);

  const success = check(response, {
    'validation status is 200': (r) => r.status === 200,
    'validation has isValid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.isValid === 'boolean';
      } catch (e) {
        return false;
      }
    },
    'validation has errors array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.errors);
      } catch (e) {
        return false;
      }
    },
    'validation response time < 500ms': () => duration < 500,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function bulkUpdateCapabilities() {
  const url = `${BASE_URL}${API_VERSION}/stands/capabilities/bulk-update`;
  const operations = [];

  // Create 3-5 random operations
  const numOperations = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numOperations; i++) {
    operations.push({
      standId: getRandomStandId(),
      capabilities: generateRandomCapabilities(),
    });
  }

  const start = Date.now();
  const response = http.post(url, JSON.stringify({ operations }), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  const success = check(response, {
    'bulk update status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    'bulk update has totalProcessed': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.totalProcessed === 'number';
      } catch (e) {
        return false;
      }
    },
    'bulk update response time < 2000ms': () => duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  }
}

// Setup function to run before tests
export function setup() {
  console.log('Starting load test for Stand Capabilities API');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Organization ID: ${ORGANIZATION_ID}`);
  console.log(`Using ${standIds.length} test stands`);

  // Verify API is accessible
  const response = http.get(`${BASE_URL}/health`, { headers: getHeaders() });
  if (response.status !== 200) {
    console.error('API health check failed:', response.status);
    return null;
  }

  console.log('API is healthy, starting load test...');
  return { apiHealthy: true };
}

// Teardown function to run after tests
export function teardown(data) {
  console.log('Load test completed');
  console.log('Check metrics for performance results');
}
