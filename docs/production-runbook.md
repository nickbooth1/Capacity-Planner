# Production Runbook

## System Overview

The Capacity Planner is a multi-tenant SaaS application for airport stand management and work scheduling.

### Architecture
- **Frontend**: Next.js on Vercel
- **API Gateway**: Express.js on Railway
- **Database**: PostgreSQL on Supabase
- **Monitoring**: Sentry (errors), Datadog (metrics)

### Key URLs
- **Production API**: https://api.capacity-planner.com
- **Production App**: https://app.capacity-planner.com
- **Health Check**: https://api.capacity-planner.com/health
- **Metrics Dashboard**: [Datadog Dashboard Link]

## Common Operations

### 1. Health Checks

```bash
# Quick health check
curl https://api.capacity-planner.com/health

# Detailed health check
curl https://api.capacity-planner.com/health/detailed
```

Expected response:
```json
{
  "status": "ok",
  "environment": "production",
  "version": "1.0.0",
  "database": "connected",
  "uptime": 3600
}
```

### 2. Database Operations

#### Connect to Production Database
```bash
# Via Supabase CLI
supabase db remote

# Direct connection (use with caution)
psql $DATABASE_URL
```

#### Common Queries
```sql
-- Check active organizations
SELECT COUNT(*) FROM public.organizations WHERE deleted_at IS NULL;

-- Check entitlements
SELECT o.code, e.module_key, e.status 
FROM entitlement.entitlements e
JOIN public.organizations o ON e.organization_id = o.id
WHERE e.status = 'active';

-- Recent errors
SELECT created_at, level, message, context 
FROM public.logs 
WHERE level = 'error' 
ORDER BY created_at DESC 
LIMIT 20;
```

### 3. Deployment Operations

#### Deploy New Version
```bash
# Ensure on main branch
git checkout main
git pull origin main

# Create release tag
git tag -a v1.0.1 -m "Release v1.0.1: Fix XYZ"
git push origin v1.0.1

# This triggers automatic deployment via GitHub Actions
```

#### Rollback Deployment
1. Go to Railway Dashboard
2. Select production environment
3. Click on the service
4. Go to "Deployments" tab
5. Find previous stable deployment
6. Click "Rollback to this deployment"

### 4. Monitoring & Alerts

#### Check Error Rates
```bash
# Last hour error count
curl -X POST https://api.datadoghq.com/api/v1/query \
  -H "DD-API-KEY: $DATADOG_API_KEY" \
  -d '{
    "query": "sum:app.errors{env:production}.as_count()",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }'
```

#### Common Alert Responses

**High Error Rate Alert**
1. Check Sentry for error details
2. Check recent deployments
3. Review database performance
4. Check external service status
5. Consider rollback if errors spike post-deployment

**High Response Time Alert**
1. Check database query performance
2. Review Railway metrics (CPU/Memory)
3. Check for traffic spikes
4. Review recent code changes
5. Scale up if needed

**Database Connection Errors**
1. Check Supabase status page
2. Verify connection pool settings
3. Check for long-running queries
4. Review connection limits
5. Restart services if needed

## Troubleshooting

### Service Won't Start
1. Check Railway logs: `railway logs --service gateway`
2. Verify environment variables are set
3. Check for port conflicts
4. Ensure database migrations completed
5. Review health check configuration

### Database Issues
1. **Connection refused**: Check SSL settings, verify Supabase is up
2. **Slow queries**: Run `EXPLAIN ANALYZE` on slow queries
3. **Connection pool exhausted**: Increase pool size or find connection leaks
4. **Migration failed**: Check migration logs, may need manual intervention

### Authentication Issues
1. Verify JWT secret is set correctly
2. Check token expiration settings
3. Ensure CORS configuration includes client domain
4. Review auth middleware logs

## Maintenance Procedures

### Scheduled Maintenance
1. Announce 24h in advance
2. Put up maintenance page
3. Backup database
4. Perform maintenance
5. Run health checks
6. Remove maintenance page
7. Monitor for 30 minutes

### Database Backup
```bash
# Manual backup (automated backups run every 6 hours)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
pg_restore --list backup_*.sql | head -20
```

### Certificate Renewal
- SSL certificates auto-renew via Let's Encrypt
- Manual check: `openssl s_client -connect api.capacity-planner.com:443 -servername api.capacity-planner.com | openssl x509 -noout -dates`

## Security Procedures

### Incident Response
1. **Detect**: Alert triggered or issue reported
2. **Assess**: Determine severity and scope
3. **Contain**: Isolate affected systems if needed
4. **Eradicate**: Fix the root cause
5. **Recover**: Restore normal operations
6. **Lessons**: Document and improve

### Secret Rotation
1. Generate new secret
2. Add to Railway/Vercel with new name
3. Update code to use new secret
4. Deploy changes
5. Monitor for issues
6. Remove old secret after 24h

## Contact Information

### Escalation Path
1. **L1**: On-call engineer (PagerDuty)
2. **L2**: Team lead
3. **L3**: Engineering manager
4. **L4**: CTO

### External Services
- **Supabase Support**: support@supabase.io
- **Railway Support**: support@railway.app
- **Vercel Support**: support@vercel.com

## Appendix

### Environment Variables Reference
See `.env.production.example` for full list

### API Endpoints Reference
See API documentation at `/docs/api`

### Database Schema
See `/packages/*/prisma/schema.prisma` files