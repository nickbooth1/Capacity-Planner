import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('validation_errors');
const validationComplexTrend = new Trend('complex_validation_duration');
const validationSimpleTrend = new Trend('simple_validation_duration');
const cacheHitRate = new Rate('cache_hits');

// Test configuration for validation-focused load testing
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Warm up
    { duration: '3m', target: 50 }, // Ramp to 50 concurrent validations
    { duration: '5m', target: 100 }, // Peak validation load
    { duration: '3m', target: 200 }, // Stress test validation engine
    { duration: '2m', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of validation requests under 500ms
    http_req_failed: ['rate<0.05'], // Less than 5% error rate
    validation_errors: ['rate<0.1'], // Less than 10% validation errors
    complex_validation_duration: ['p(95)<1000'], // Complex validations under 1s
    simple_validation_duration: ['p(95)<200'], // Simple validations under 200ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';
const ORGANIZATION_ID = __ENV.ORGANIZATION_ID || 'test-org';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'X-Organization-ID': ORGANIZATION_ID,
  };
}

// Test data sets
const simpleCapabilities = {
  dimensions: {
    length: 60,
    width: 45,
    height: 20,
  },
};

const complexCapabilities = {
  dimensions: {
    length: 75,
    width: 55,
    height: 25,
    wingspan: 70,
    clearances: {
      wingtip: 6,
      nose: 4,
      tail: 4,
    },
    slopes: {
      longitudinal: 0.6,
      transverse: 0.4,
    },
  },
  aircraftCompatibility: {
    supportedCategories: ['C', 'D'],
    maxWingspan: 70,
    maxLength: 75,
    maxWeight: 150000,
    restrictions: ['no_wide_body', 'daylight_only'],
  },
  groundSupport: {
    powerSupply: {
      available: true,
      voltage: 400,
      frequency: 50,
      amperage: 250,
    },
    airConditioning: {
      available: true,
      capacity: 180,
    },
    jetBridge: {
      available: true,
      type: 'moveable',
    },
  },
  operationalConstraints: {
    operatingHours: {
      start: '06:00',
      end: '22:00',
    },
    restrictions: ['noise_sensitive'],
    weatherLimitations: ['wind_speed_30kt', 'visibility_1000m'],
  },
  environmentalFeatures: {
    deIcing: {
      available: true,
      capacity: 1200,
    },
    lighting: {
      available: true,
      type: 'LED',
    },
    drainage: {
      available: true,
      capacity: 600,
    },
  },
  infrastructure: {
    pavement: {
      type: 'concrete',
      strength: 'high',
      condition: 'excellent',
    },
    markings: {
      type: 'standard',
      condition: 'good',
    },
    signage: {
      available: true,
      type: 'LED',
    },
  },
};

const invalidCapabilities = {
  dimensions: {
    length: -10, // Invalid negative length
    width: 0, // Invalid zero width
    height: -5, // Invalid negative height
  },
  aircraftCompatibility: {
    supportedCategories: ['Z'], // Invalid ICAO category
    maxWingspan: -5, // Invalid negative wingspan
    maxWeight: 0, // Invalid zero weight
  },
};

// Edge case capabilities for stress testing
const edgeCaseCapabilities = {
  dimensions: {
    length: 999, // Very large length
    width: 999, // Very large width
    height: 999, // Very large height
    wingspan: 999, // Very large wingspan
    clearances: {
      wingtip: 0.1, // Minimal clearance
      nose: 0.1,
      tail: 0.1,
    },
    slopes: {
      longitudinal: 2.0, // High slope
      transverse: 2.0,
    },
  },
  aircraftCompatibility: {
    supportedCategories: ['A', 'B', 'C', 'D', 'E', 'F'], // All categories
    maxWingspan: 999,
    maxLength: 999,
    maxWeight: 999999,
    restrictions: Array.from({ length: 50 }, (_, i) => `restriction_${i}`), // Many restrictions
  },
};

export default function () {
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% - Simple validation (fast)
    validateSimple();
  } else if (scenario < 0.6) {
    // 30% - Complex validation (comprehensive)
    validateComplex();
  } else if (scenario < 0.8) {
    // 20% - Invalid data validation (error cases)
    validateInvalid();
  } else {
    // 20% - Edge case validation (stress test)
    validateEdgeCases();
  }

  sleep(0.5); // Shorter sleep for validation-focused testing
}

function validateSimple() {
  const url = `${BASE_URL}${API_VERSION}/stands/capabilities/validate`;

  const start = Date.now();
  const response = http.post(url, JSON.stringify(simpleCapabilities), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  validationSimpleTrend.add(duration);

  const success = check(response, {
    'simple validation status is 200': (r) => r.status === 200,
    'simple validation is valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.isValid === true;
      } catch (e) {
        return false;
      }
    },
    'simple validation fast response': () => duration < 200,
  });

  // Check for cache hit indicators
  if (response.headers['X-Cache-Status'] === 'HIT') {
    cacheHitRate.add(1);
  } else {
    cacheHitRate.add(0);
  }

  if (!success) {
    errorRate.add(1);
  }
}

function validateComplex() {
  const url = `${BASE_URL}${API_VERSION}/stands/capabilities/validate`;

  const start = Date.now();
  const response = http.post(url, JSON.stringify(complexCapabilities), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  validationComplexTrend.add(duration);

  const success = check(response, {
    'complex validation status is 200': (r) => r.status === 200,
    'complex validation has result': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.isValid === 'boolean';
      } catch (e) {
        return false;
      }
    },
    'complex validation has detailed errors': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.errors) && Array.isArray(body.warnings);
      } catch (e) {
        return false;
      }
    },
    'complex validation reasonable time': () => duration < 1000,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function validateInvalid() {
  const url = `${BASE_URL}${API_VERSION}/stands/capabilities/validate`;

  const start = Date.now();
  const response = http.post(url, JSON.stringify(invalidCapabilities), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  const success = check(response, {
    'invalid validation status is 200': (r) => r.status === 200,
    'invalid validation is invalid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.isValid === false;
      } catch (e) {
        return false;
      }
    },
    'invalid validation has errors': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.errors) && body.errors.length > 0;
      } catch (e) {
        return false;
      }
    },
    'invalid validation quick response': () => duration < 300,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function validateEdgeCases() {
  const url = `${BASE_URL}${API_VERSION}/stands/capabilities/validate`;

  const start = Date.now();
  const response = http.post(url, JSON.stringify(edgeCaseCapabilities), {
    headers: getHeaders(),
  });
  const duration = Date.now() - start;

  const success = check(response, {
    'edge case validation status is 200': (r) => r.status === 200,
    'edge case validation completes': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.isValid === 'boolean';
      } catch (e) {
        return false;
      }
    },
    'edge case validation handles complexity': () => duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  }
}

export function setup() {
  console.log('Starting validation engine load test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Testing validation performance under load`);

  // Warm up cache with common validations
  const warmupUrl = `${BASE_URL}${API_VERSION}/stands/capabilities/validate`;

  console.log('Warming up validation cache...');
  for (let i = 0; i < 5; i++) {
    http.post(warmupUrl, JSON.stringify(simpleCapabilities), {
      headers: getHeaders(),
    });
  }

  console.log('Cache warmed up, starting load test...');
  return { cacheWarmed: true };
}

export function teardown(data) {
  console.log('Validation load test completed');
  console.log('Review metrics for validation engine performance');
}
