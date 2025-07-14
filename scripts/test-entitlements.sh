#!/bin/bash

# Test script for entitlement service endpoints

API_BASE="http://localhost:3000/api/entitlements"
ORG_ID="test-org-123"
MODULE_KEY="assets"

echo "Testing Entitlement Service Endpoints..."
echo "======================================="

# 1. Check initial access (should be false)
echo -e "\n1. Checking initial access for $ORG_ID to $MODULE_KEY module:"
curl -s "$API_BASE/organizations/$ORG_ID/modules/$MODULE_KEY/access" | jq .

# 2. Grant access
echo -e "\n2. Granting access to $MODULE_KEY module:"
curl -s -X POST "$API_BASE/organizations/$ORG_ID/entitlements/$MODULE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin", "validUntil": "2025-12-31T23:59:59Z"}' | jq .

# 3. Check access again (should be true)
echo -e "\n3. Checking access after grant:"
curl -s "$API_BASE/organizations/$ORG_ID/modules/$MODULE_KEY/access" | jq .

# 4. List all entitlements for the organization
echo -e "\n4. Listing all entitlements for $ORG_ID:"
curl -s "$API_BASE/organizations/$ORG_ID/entitlements" | jq .

# 5. Get specific entitlement
echo -e "\n5. Getting specific entitlement:"
curl -s "$API_BASE/organizations/$ORG_ID/entitlements/$MODULE_KEY" | jq .

# 6. Grant access to another module
echo -e "\n6. Granting access to work module:"
curl -s -X POST "$API_BASE/organizations/$ORG_ID/entitlements/work" \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin"}' | jq .

# 7. List all entitlements again
echo -e "\n7. Listing all entitlements after second grant:"
curl -s "$API_BASE/organizations/$ORG_ID/entitlements" | jq .

# 8. Test batch grant
echo -e "\n8. Testing batch grant for multiple organizations:"
curl -s -X POST "$API_BASE/entitlements/batch-grant" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "admin",
    "grants": [
      {"organizationId": "org-001", "moduleKey": "assets"},
      {"organizationId": "org-001", "moduleKey": "work"},
      {"organizationId": "org-002", "moduleKey": "capacity"}
    ]
  }' | jq .

# 9. Get all entitlements (admin endpoint)
echo -e "\n9. Getting all entitlements (admin view):"
curl -s "$API_BASE/entitlements" | jq .

# 10. Revoke access
echo -e "\n10. Revoking access to $MODULE_KEY module:"
curl -s -X DELETE "$API_BASE/organizations/$ORG_ID/entitlements/$MODULE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin"}' | jq .

# 11. Check access after revoke (should be false)
echo -e "\n11. Checking access after revoke:"
curl -s "$API_BASE/organizations/$ORG_ID/modules/$MODULE_KEY/access" | jq .

# 12. Check health endpoint
echo -e "\n12. Checking health endpoint:"
curl -s "http://localhost:3000/health" | jq .

echo -e "\n======================================="
echo "Test completed!"