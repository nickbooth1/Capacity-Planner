# Production Deployment Checklist

## Pre-Deployment Checks

### Code Review
- [ ] All PR reviews completed
- [ ] No merge conflicts with main branch
- [ ] Security scan passed (no critical vulnerabilities)
- [ ] All tests passing in CI pipeline

### Database
- [ ] Database backup completed
- [ ] Migration scripts reviewed
- [ ] Rollback scripts prepared
- [ ] No breaking schema changes without feature flags

### Configuration
- [ ] Production environment variables verified
- [ ] SSL certificates valid for > 30 days
- [ ] API rate limits configured
- [ ] CORS settings reviewed

### Monitoring
- [ ] Sentry project configured
- [ ] Datadog alerts set up
- [ ] Log aggregation verified
- [ ] Health check endpoints tested

## Deployment Process

### Step 1: Pre-Deployment (15 minutes before)
- [ ] Announce deployment in #deployments Slack channel
- [ ] Verify staging environment is stable
- [ ] Check current production metrics baseline
- [ ] Ensure on-call engineer is available

### Step 2: Database Migration
- [ ] Create production database backup
- [ ] Run migration dry-run
- [ ] Execute production migrations
- [ ] Verify migration success

### Step 3: Blue-Green Deployment
- [ ] Deploy to blue environment
- [ ] Run health checks on blue environment
- [ ] Execute smoke tests on blue environment
- [ ] Begin traffic migration (10% → 50% → 100%)

### Step 4: Monitoring (First 30 minutes)
- [ ] Monitor error rates
- [ ] Check response times
- [ ] Verify database query performance
- [ ] Monitor memory and CPU usage
- [ ] Check user reports in support channels

### Step 5: Post-Deployment
- [ ] Update deployment log
- [ ] Document any issues encountered
- [ ] Update runbook if needed
- [ ] Announce successful deployment

## Rollback Procedure

If issues detected:

1. **Immediate Rollback** (< 5 minutes)
   - [ ] Click "Rollback" in Railway dashboard
   - [ ] Verify traffic switched back
   - [ ] Check service health

2. **Database Rollback** (if needed)
   - [ ] Stop application traffic
   - [ ] Run rollback migration
   - [ ] Restore from backup if migration fails
   - [ ] Restart services

3. **Communication**
   - [ ] Notify team of rollback
   - [ ] Create incident report
   - [ ] Schedule post-mortem

## Success Criteria

- [ ] All health checks passing
- [ ] Error rate < 0.1%
- [ ] Response time p95 < 500ms
- [ ] No critical errors in logs
- [ ] No customer complaints in first hour

## Emergency Contacts

- **On-Call Engineer**: Via PagerDuty
- **Database Admin**: #database-oncall
- **Infrastructure**: #infra-oncall
- **Product Manager**: See escalation matrix

## Notes

- Never deploy on Fridays unless critical
- Always have rollback plan ready
- Keep deployment window < 1 hour
- Document everything