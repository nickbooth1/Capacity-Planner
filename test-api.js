const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api/assets/stands';
const headers = {
  'Content-Type': 'application/json',
  'X-User-Id': 'test-user',
  'x-organization-id': 'test-org'
};

async function testAPI() {
  console.log('Testing Stand CRUD API...\n');

  // Test 1: GET all stands
  console.log('1. Testing GET /api/assets/stands');
  try {
    const response = await fetch(API_BASE, { headers });
    const data = await response.json();
    console.log(`✓ GET all stands: ${data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Found ${data.data?.length || 0} stands\n`);
  } catch (error) {
    console.log(`✗ GET all stands: ERROR - ${error.message}\n`);
  }

  // Test 2: GET single stand (if exists)
  console.log('2. Testing GET /api/assets/stands/:id');
  try {
    const response = await fetch(`${API_BASE}/1`, { headers });
    if (response.status === 404) {
      console.log('✓ GET single stand: Correctly returns 404 for non-existent stand\n');
    } else {
      const data = await response.json();
      console.log(`✓ GET single stand: ${data.success ? 'SUCCESS' : 'FAILED'}\n`);
    }
  } catch (error) {
    console.log(`✗ GET single stand: ERROR - ${error.message}\n`);
  }

  // Test 3: Test CORS preflight
  console.log('3. Testing CORS preflight');
  try {
    const response = await fetch(API_BASE, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-user-id,x-organization-id'
      }
    });
    console.log(`✓ CORS preflight: ${response.status === 200 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Allowed headers: ${response.headers.get('access-control-allow-headers')}\n`);
  } catch (error) {
    console.log(`✗ CORS preflight: ERROR - ${error.message}\n`);
  }

  console.log('API tests completed!');
}

testAPI().catch(console.error);