# Stand CRUD Controls Deployment Guide

## Overview

This guide covers the deployment process for the Stand CRUD Controls feature (v1.1.1.2).

## Prerequisites

- Stand Capabilities feature (v1.1.1.1) deployed and operational
- PostgreSQL 14+ with assets schema
- Redis 6+ for caching
- Node.js 18+ runtime
- Required environment variables configured

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/capacity_planner

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Security
ENCRYPTION_MASTER_KEY=your-encryption-key-min-32-chars
JWT_SECRET=your-jwt-secret

# Application
NODE_ENV=production
APP_VERSION=1.1.1.2

# Feature Flags
ENABLE_STAND_CRUD=true
ENABLE_BULK_IMPORT=true
ENABLE_FIELD_SECURITY=true

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# File Upload
UPLOAD_DIR=/var/app/uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### Optional Variables

```bash
# Performance
CACHE_TTL=3600
DB_POOL_MIN=2
DB_POOL_MAX=10

# Security
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=30
CORS_ORIGINS=https://app.capacity-planner.com

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

## Database Migration

### 1. Backup Current Database

```bash
pg_dump -h localhost -U postgres -d capacity_planner > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Run Migrations

```bash
cd packages/assets-module

# Run Prisma migrations
npx prisma migrate deploy

# Apply RLS policies
psql -h localhost -U postgres -d capacity_planner -f prisma/migrations/add_rls_policies.sql

# Apply performance indexes
psql -h localhost -U postgres -d capacity_planner -f prisma/migrations/add_performance_indexes.sql
```

### 3. Verify Migration

```sql
-- Check new fields exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'assets' 
  AND table_name = 'stands' 
  AND column_name IN ('version', 'is_deleted', 'deleted_at', 'deleted_by');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'assets';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'assets' 
  AND tablename = 'stands';
```

## Application Deployment

### 1. Build Applications

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### 2. Deploy Backend Services

```bash
# Deploy assets module
cd packages/assets-module
pnpm build
# Copy dist/ to production server

# Deploy API gateway
cd apps/api-gateway
pnpm build
# Copy dist/ to production server
```

### 3. Deploy Frontend

```bash
# Build frontend
cd apps/web
pnpm build

# Upload to CDN or static hosting
aws s3 sync ./dist s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check API health
curl https://api.capacity-planner.com/health

# Check detailed health
curl https://api.capacity-planner.com/health/detailed

# Expected response
{
  "status": "healthy",
  "version": "1.1.1.2",
  "checks": {
    "database": { "status": "pass" },
    "redis": { "status": "pass" },
    "memory": { "status": "pass" },
    "disk": { "status": "pass" }
  }
}
```

### 2. Feature Verification

```bash
# Test stand CRUD endpoints
./scripts/verify-deployment.sh

# Manual checks:
# 1. Create a test stand
# 2. Update the test stand
# 3. Search for the stand
# 4. Delete the test stand
# 5. Verify soft delete worked
```

### 3. Performance Verification

```bash
# Run load test
k6 run ./tests/load/stand-crud-load-test.js

# Check metrics
curl https://api.capacity-planner.com/metrics | grep stand_

# Verify response times < 200ms
```

### 4. Security Verification

```bash
# Test RLS policies
psql -U test_user -d capacity_planner -c "SELECT * FROM assets.stands;"
# Should only see org-specific data

# Test rate limiting
for i in {1..50}; do curl https://api.capacity-planner.com/api/assets/stands; done
# Should get 429 after 30 requests
```

## Rollback Procedure

If issues are encountered:

### 1. Immediate Rollback

```bash
# Revert application code
kubectl rollout undo deployment/api-gateway
kubectl rollout undo deployment/assets-module

# Or for non-k8s deployments
./scripts/rollback-to-previous.sh
```

### 2. Database Rollback

```bash
# Restore from backup
psql -h localhost -U postgres -d capacity_planner < backup_YYYYMMDD_HHMMSS.sql

# Or revert specific migration
npx prisma migrate resolve --rolled-back 20250115000000_add_crud_controls
```

### 3. Clear Cache

```bash
# Clear Redis cache
redis-cli FLUSHDB

# Clear CDN cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Monitoring Setup

### 1. Prometheus Metrics

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'stand-crud'
    static_configs:
      - targets: ['api-gateway:9090']
    metrics_path: '/metrics'
```

### 2. Grafana Dashboard

Import dashboard from: `monitoring/dashboards/stand-crud-dashboard.json`

Key metrics to monitor:
- `stand_operations_total`
- `stand_operation_duration_seconds`
- `stand_cache_hits_total`
- `stand_security_events_total`

### 3. Alerts

```yaml
# alerting-rules.yml
groups:
  - name: stand-crud
    rules:
      - alert: HighErrorRate
        expr: rate(stand_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate in stand operations"
          
      - alert: SlowResponse
        expr: histogram_quantile(0.95, stand_operation_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: "95th percentile response time > 500ms"
```

## Troubleshooting

### Common Issues

#### 1. Migration Fails

**Error**: "Migration failed: column already exists"

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# Reset if needed
npx prisma migrate reset --skip-seed
```

#### 2. RLS Policy Errors

**Error**: "Permission denied for schema assets"

**Solution**:
```sql
-- Grant permissions
GRANT USAGE ON SCHEMA assets TO authenticated_user;
GRANT SELECT ON ALL TABLES IN SCHEMA assets TO authenticated_user;
```

#### 3. Redis Connection Issues

**Error**: "Redis connection refused"

**Solution**:
```bash
# Check Redis is running
redis-cli ping

# Check connection string
echo $REDIS_URL

# Test connection
redis-cli -h your-redis-host -a your-password ping
```

#### 4. Import Feature Not Working

**Error**: "File upload failed"

**Solution**:
```bash
# Check upload directory exists and is writable
mkdir -p $UPLOAD_DIR
chmod 755 $UPLOAD_DIR

# Check file size limits
echo $MAX_FILE_SIZE
```

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
export DEBUG=capacity-planner:*
```

## Performance Tuning

### Database Optimization

```sql
-- Update table statistics
ANALYZE assets.stands;

-- Check slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%stands%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Redis Optimization

```bash
# Monitor Redis performance
redis-cli --latency
redis-cli --bigkeys

# Adjust memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Application Optimization

```javascript
// Adjust pool settings
DB_POOL_MIN=5
DB_POOL_MAX=20

// Increase cache TTL for stable data
CACHE_TTL=7200  # 2 hours

// Enable compression
COMPRESSION_LEVEL=6
```

## Security Checklist

- [ ] Environment variables secured in vault
- [ ] Database credentials rotated
- [ ] RLS policies tested with different roles
- [ ] Rate limiting configured and tested
- [ ] CORS origins restricted to production domains
- [ ] File upload restrictions verified
- [ ] Audit logging confirmed working
- [ ] Encryption keys backed up securely

## Go-Live Checklist

- [ ] All migrations successfully applied
- [ ] Health checks passing
- [ ] Performance metrics within SLA
- [ ] Security verification completed
- [ ] Monitoring alerts configured
- [ ] Rollback procedure tested
- [ ] Documentation updated
- [ ] Support team briefed
- [ ] Stakeholder sign-off received

## Support Information

- **Documentation**: https://docs.capacity-planner.com/features/stand-crud
- **Runbooks**: Available in team wiki
- **On-call**: #platform-oncall in Slack
- **Escalation**: platform-leads@capacity-planner.com

---

*Last updated: January 2025*
*Version: 1.1.1.2*