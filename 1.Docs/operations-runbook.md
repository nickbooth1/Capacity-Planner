# CapaCity Planner Operations Runbook

## Overview

This document provides operational procedures for managing the CapaCity Planner platform. All operations can be performed using CLI tools without needing direct database access.

## CLI Tools

All operational commands are available through `pnpm ops:*` scripts.

### Organization Management

#### List All Organizations
```bash
pnpm ops:list-orgs
# Output format options:
pnpm ops:list-orgs --format json
```

#### Create Organization Interactively
```bash
pnpm ops:create-org
# Follow the prompts to enter:
# - Organization name
# - IATA code (3 letters)
# - Module access selection
```

#### Grant Module Access
```bash
pnpm ops:grant-module --org LHR --module assets
# With expiration date:
pnpm ops:grant-module --org LHR --module work --until 2024-12-31
```

#### Bulk Import Organizations
```bash
# CSV format: name,code,modules
pnpm ops:bulk-import organizations.csv
# Dry run first:
pnpm ops:bulk-import organizations.csv --dry-run
```

### System Operations

#### Health Check
```bash
pnpm ops:health-check
# Verbose output:
pnpm ops:health-check --verbose
```

Checks:
- Database connectivity
- API Gateway health
- Frontend accessibility
- Redis (if configured)

#### Database Backup
```bash
# Default location: ./backups/backup-YYYY-MM-DD.sql
pnpm ops:backup

# Custom location:
pnpm ops:backup --output /path/to/backup.sql
```

#### Database Restore
```bash
pnpm ops:restore /path/to/backup.sql
# Skip confirmation:
pnpm ops:restore /path/to/backup.sql --force
```

⚠️ **WARNING**: Restore completely replaces the database!

## Emergency Procedures

### 1. Service Down

If the health check shows services down:

```bash
# Check Docker status
docker compose ps

# Restart specific service
docker compose restart <service-name>

# View logs
docker compose logs -f <service-name>
```

### 2. Database Connection Issues

```bash
# Check database container
docker compose ps postgres

# Test direct connection
docker compose exec postgres psql -U postgres -d capacity_planner -c "SELECT 1"

# Restart database
docker compose restart postgres
```

### 3. Emergency Admin Access

If admin portal is inaccessible:

```bash
# Create temporary admin organization
pnpm ops:create-org
# Enter: "Emergency Admin", "EMR", select all modules

# Grant full access
pnpm ops:grant-module --org EMR --module assets
pnpm ops:grant-module --org EMR --module work
pnpm ops:grant-module --org EMR --module capacity
pnpm ops:grant-module --org EMR --module planning
pnpm ops:grant-module --org EMR --module monitoring
```

### 4. Rollback Procedure

```bash
# 1. Create current backup
pnpm ops:backup --output ./backups/pre-rollback.sql

# 2. Restore previous backup
pnpm ops:restore ./backups/last-known-good.sql

# 3. Verify system health
pnpm ops:health-check
```

## Regular Maintenance

### Daily
- [ ] Run health check: `pnpm ops:health-check`
- [ ] Check disk space for backups
- [ ] Review error logs

### Weekly
- [ ] Create full backup: `pnpm ops:backup`
- [ ] Test restore procedure on staging
- [ ] Review organization access: `pnpm ops:list-orgs`

### Monthly
- [ ] Archive old backups
- [ ] Review and update module access
- [ ] Performance analysis of database

## Common Issues

### Module Not Found Errors
```bash
# Regenerate Prisma clients
pnpm prisma:generate
```

### Permission Denied
```bash
# Ensure database migrations are applied
pnpm prisma:migrate:deploy
```

### Import Failures
- Check CSV format: `name,code,modules`
- Verify module keys are valid: assets, work, capacity, planning, monitoring
- IATA codes must be 3 uppercase letters

## Environment Variables

Required for CLI tools:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection (optional)

## Support

For issues not covered in this runbook:
1. Check application logs: `docker compose logs`
2. Review recent changes in git history
3. Contact development team with error details

## Backup Strategy

1. **Automated Backups**: Set up cron job
   ```bash
   0 2 * * * cd /path/to/project && pnpm ops:backup
   ```

2. **Retention Policy**: 
   - Daily backups: Keep for 7 days
   - Weekly backups: Keep for 4 weeks
   - Monthly backups: Keep for 12 months

3. **Off-site Storage**: Copy backups to S3 or similar
   ```bash
   aws s3 cp ./backups/backup-$(date +%Y-%m-%d).sql s3://bucket/backups/
   ```