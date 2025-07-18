# Stand CRUD Controls - Rollback Procedures

## Overview

This document provides step-by-step procedures for rolling back the Stand CRUD Controls feature in case of critical issues post-deployment.

## Rollback Decision Matrix

| Issue Type | Severity | Rollback Required | Procedure |
|------------|----------|-------------------|-----------|
| Performance degradation > 50% | Critical | Yes | Full rollback |
| Data corruption | Critical | Yes | Full rollback + restore |
| Security vulnerability | Critical | Yes | Immediate rollback |
| Minor UI issues | Low | No | Hotfix |
| Single endpoint failure | Medium | Partial | API rollback only |
| Import feature issues | Medium | No | Feature flag disable |

## Pre-Rollback Checklist

Before initiating rollback:

1. [ ] Notify stakeholders via incident channel
2. [ ] Create incident ticket with impact assessment
3. [ ] Backup current state (data and configs)
4. [ ] Identify specific version to rollback to
5. [ ] Ensure rollback scripts are accessible
6. [ ] Have DBA on standby for database operations

## Rollback Procedures

### 1. Emergency Rollback (< 5 minutes)

For critical production issues requiring immediate action:

```bash
#!/bin/bash
# emergency-rollback.sh

echo "🚨 Starting emergency rollback..."

# 1. Disable feature flags immediately
redis-cli SET "feature:stand_crud" "false"
redis-cli SET "feature:bulk_import" "false"

# 2. Rollback API Gateway
kubectl rollout undo deployment/api-gateway -n production
# Or for non-k8s:
# systemctl stop api-gateway
# cp /backups/api-gateway-v1.1.1.1 /opt/api-gateway/current
# systemctl start api-gateway

# 3. Clear caches
redis-cli FLUSHDB

# 4. Verify health
curl https://api.capacity-planner.com/health

echo "✅ Emergency rollback completed"
```

### 2. Standard Rollback (15-30 minutes)

For planned rollback with proper verification:

```bash
#!/bin/bash
# standard-rollback.sh

echo "Starting standard rollback procedure..."

# 1. Set maintenance mode
redis-cli SET "system:maintenance" "true"
redis-cli SET "system:maintenance:message" "System maintenance in progress"

# 2. Stop new requests
kubectl scale deployment/api-gateway --replicas=0 -n production

# 3. Backup current state
pg_dump -h $DB_HOST -U $DB_USER -d capacity_planner > rollback_backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Rollback application code
cd /opt/deployments
./rollback-to-version.sh v1.1.1.1

# 5. Rollback database schema
cd packages/assets-module
npx prisma migrate resolve --rolled-back 20250115000000_add_crud_controls

# 6. Restart services
kubectl scale deployment/api-gateway --replicas=3 -n production
kubectl scale deployment/assets-module --replicas=3 -n production

# 7. Clear maintenance mode
redis-cli DEL "system:maintenance"

# 8. Verify
./scripts/verify-rollback.sh

echo "✅ Standard rollback completed"
```

### 3. Database-Only Rollback

If only database changes need reverting:

```sql
-- rollback-crud-fields.sql

BEGIN;

-- Remove CRUD-specific fields
ALTER TABLE assets.stands 
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS is_deleted,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;

-- Drop import tables
DROP TABLE IF EXISTS assets.stand_import_jobs CASCADE;

-- Remove RLS policies
DROP POLICY IF EXISTS stands_select_policy ON assets.stands;
DROP POLICY IF EXISTS stands_insert_policy ON assets.stands;
DROP POLICY IF EXISTS stands_update_policy ON assets.stands;
DROP POLICY IF EXISTS stands_delete_policy ON assets.stands;

-- Disable RLS
ALTER TABLE assets.stands DISABLE ROW LEVEL SECURITY;

-- Drop functions
DROP FUNCTION IF EXISTS assets.current_user_organization();
DROP FUNCTION IF EXISTS assets.check_user_permission(TEXT);

-- Remove indexes
DROP INDEX IF EXISTS idx_stands_org_deleted;
DROP INDEX IF EXISTS idx_stands_soft_delete;

COMMIT;
```

### 4. Frontend-Only Rollback

For UI issues without backend impact:

```bash
#!/bin/bash
# frontend-rollback.sh

# 1. Rollback to previous version
cd apps/web
git checkout v1.1.1.1
pnpm install
pnpm build

# 2. Deploy to CDN
aws s3 sync ./dist s3://capacity-planner-web --delete

# 3. Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*"

# 4. Verify
curl -I https://app.capacity-planner.com
```

### 5. Partial Feature Rollback

Disable specific features without full rollback:

```javascript
// feature-flags.js
const FEATURE_FLAGS = {
  STAND_CRUD: false,        // Disable CRUD operations
  STAND_IMPORT: false,      // Disable bulk import
  STAND_FIELD_SECURITY: true, // Keep security active
  STAND_AUDIT: true         // Keep audit logging
};

// Apply via Redis
redis-cli HSET "features:stand" "crud" "false"
redis-cli HSET "features:stand" "import" "false"
```

## Verification Steps

After rollback, verify system stability:

### 1. Health Checks

```bash
# API health
curl https://api.capacity-planner.com/health

# Database connectivity
psql -h $DB_HOST -U $DB_USER -d capacity_planner -c "SELECT 1;"

# Redis connectivity
redis-cli ping

# Service status
kubectl get pods -n production
```

### 2. Functionality Tests

```bash
# Test read operations still work
curl https://api.capacity-planner.com/api/assets/stands/capabilities

# Verify CRUD endpoints return 404 or disabled
curl -X POST https://api.capacity-planner.com/api/assets/stands

# Check frontend loads
curl https://app.capacity-planner.com
```

### 3. Data Integrity

```sql
-- Check data consistency
SELECT COUNT(*) FROM assets.stands;
SELECT COUNT(*) FROM assets.stands WHERE is_deleted IS NOT NULL;

-- Verify no orphaned data
SELECT COUNT(*) FROM assets.stand_capability_snapshots scs
LEFT JOIN assets.stands s ON scs.stand_id = s.id
WHERE s.id IS NULL;
```

## Post-Rollback Actions

### Immediate (Within 1 hour)

1. **Incident Report**
   - Document issue that triggered rollback
   - Timeline of events
   - Impact assessment
   - Actions taken

2. **Stakeholder Communication**
   - Email to affected users
   - Status page update
   - Slack announcement

3. **Monitoring**
   - Enable enhanced monitoring
   - Set up alerts for anomalies
   - Review logs for errors

### Short-term (Within 24 hours)

1. **Root Cause Analysis**
   - Identify issue source
   - Review deployment process
   - Check test coverage gaps

2. **Fix Development**
   - Create hotfix branch
   - Implement fixes
   - Additional testing

3. **Re-deployment Planning**
   - Schedule maintenance window
   - Prepare improved deployment plan
   - Update rollback procedures

### Long-term (Within 1 week)

1. **Process Improvement**
   - Update deployment procedures
   - Enhance testing strategy
   - Improve monitoring

2. **Documentation**
   - Update runbooks
   - Document lessons learned
   - Share knowledge with team

## Rollback Scripts

### verify-rollback.sh

```bash
#!/bin/bash
# verify-rollback.sh

echo "Verifying rollback..."

# Check version
VERSION=$(curl -s https://api.capacity-planner.com/version | jq -r '.version')
if [ "$VERSION" != "1.1.1.1" ]; then
  echo "❌ Version mismatch: $VERSION"
  exit 1
fi

# Check database
CRUD_FIELDS=$(psql -h $DB_HOST -U $DB_USER -d capacity_planner -t -c \
  "SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema='assets' AND table_name='stands' 
   AND column_name IN ('version', 'is_deleted');")

if [ $CRUD_FIELDS -gt 0 ]; then
  echo "❌ Database not fully rolled back"
  exit 1
fi

# Check endpoints
CRUD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://api.capacity-planner.com/api/assets/stands)

if [ $CRUD_STATUS -ne 404 ]; then
  echo "❌ CRUD endpoints still active"
  exit 1
fi

echo "✅ Rollback verified successfully"
```

### restore-from-backup.sh

```bash
#!/bin/bash
# restore-from-backup.sh

if [ -z "$1" ]; then
  echo "Usage: ./restore-from-backup.sh <backup-file>"
  exit 1
fi

BACKUP_FILE=$1

echo "Restoring from backup: $BACKUP_FILE"

# 1. Stop applications
kubectl scale deployment/api-gateway --replicas=0 -n production
kubectl scale deployment/assets-module --replicas=0 -n production

# 2. Restore database
psql -h $DB_HOST -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS capacity_planner_restore;"
psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE capacity_planner_restore;"
psql -h $DB_HOST -U $DB_USER -d capacity_planner_restore < $BACKUP_FILE

# 3. Verify restore
STAND_COUNT=$(psql -h $DB_HOST -U $DB_USER -d capacity_planner_restore -t -c "SELECT COUNT(*) FROM assets.stands;")
echo "Restored $STAND_COUNT stands"

# 4. Switch databases
psql -h $DB_HOST -U $DB_USER -d postgres -c "ALTER DATABASE capacity_planner RENAME TO capacity_planner_old;"
psql -h $DB_HOST -U $DB_USER -d postgres -c "ALTER DATABASE capacity_planner_restore RENAME TO capacity_planner;"

# 5. Restart applications
kubectl scale deployment/api-gateway --replicas=3 -n production
kubectl scale deployment/assets-module --replicas=3 -n production

echo "✅ Restore completed"
```

## Emergency Contacts

- **Platform Lead**: John Smith (+1-555-0123)
- **DBA On-call**: Mary Johnson (+1-555-0124)
- **Security Team**: security-oncall@capacity-planner.com
- **Incident Commander**: Available via PagerDuty

## Lessons Learned Log

Document all rollback events:

| Date | Issue | Rollback Type | Duration | Root Cause | Prevention |
|------|-------|---------------|----------|------------|------------|
| Example | Performance | Standard | 25 min | Missing index | Add perf tests |

---

*Last updated: January 2025*
*Version: 1.0*