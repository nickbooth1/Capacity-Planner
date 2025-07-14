# Production Environment Setup Guide

## Overview

This guide covers the setup and configuration of the production environment for the Capacity Planner application.

## Prerequisites

- [ ] Supabase account with Pro plan or higher
- [ ] Railway account with Pro plan
- [ ] Vercel account (Pro recommended)
- [ ] Domain name configured (capacity-planner.com)
- [ ] SSL certificates (auto-provisioned by platforms)
- [ ] Monitoring accounts (Sentry, Datadog)

## Step 1: Supabase Production Setup

### 1.1 Create Production Project

1. Log into Supabase Dashboard
2. Click "New Project"
3. Configure:
   - **Name**: `capacity-planner-production`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to users
   - **Pricing Plan**: Pro (for HA and backups)

### 1.2 Configure Database

```sql
-- Run these after project creation
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set up connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
```

### 1.3 Enable Point-in-Time Recovery

1. Go to Settings → Database
2. Enable "Point-in-time Recovery"
3. Set retention to 7 days

### 1.4 Configure Backups

- Automatic backups run daily
- Configure additional backup script (see `/scripts/backup-production.sh`)
- Test restore procedure monthly

## Step 2: Railway Production Setup

### 2.1 Create Production Project

```bash
# Using Railway CLI
railway login
railway init
railway project create capacity-planner-production
railway environment create production
```

### 2.2 Configure Services

1. **API Gateway Service**:
   ```bash
   railway service create gateway-production
   railway vars set NODE_ENV=production
   railway vars set PORT=3000
   ```

2. **Configure Blue-Green Deployment**:
   - Edit `railway.production.json`
   - Enable traffic splitting
   - Set health check endpoints

### 2.3 Set Environment Variables

```bash
# Database
railway vars set DATABASE_URL="postgresql://..."

# Security
railway vars set JWT_SECRET="$(openssl rand -base64 32)"
railway vars set ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Monitoring
railway vars set SENTRY_DSN="your-sentry-dsn"
railway vars set DATADOG_API_KEY="your-datadog-key"
```

### 2.4 Configure Domains

1. Go to service settings
2. Add custom domain: `api.capacity-planner.com`
3. Configure DNS CNAME record
4. Enable automatic HTTPS

## Step 3: Vercel Production Setup

### 3.1 Import Project

```bash
vercel link
vercel env pull .env.production.local
```

### 3.2 Configure Production

1. Set production branch to `main`
2. Configure environment variables:
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   vercel env add NEXT_PUBLIC_APP_URL production
   ```

### 3.3 Configure Domain

1. Go to Project Settings → Domains
2. Add `app.capacity-planner.com`
3. Configure DNS records
4. Verify domain ownership

## Step 4: Monitoring Setup

### 4.1 Sentry Configuration

1. Create new Sentry project
2. Install SDK:
   ```bash
   pnpm add @sentry/node @sentry/nextjs
   ```
3. Configure in both gateway and web apps

### 4.2 Datadog Setup

1. Create Datadog account
2. Install agent on Railway
3. Configure APM and logs
4. Set up dashboards and alerts

### 4.3 Configure Alerts

- Use `/monitoring/alerts.yml` as template
- Set up PagerDuty integration
- Configure Slack webhooks
- Test all alert channels

## Step 5: Security Configuration

### 5.1 API Security

- [ ] Rate limiting configured
- [ ] CORS properly restricted
- [ ] API keys rotated quarterly
- [ ] WAF rules configured

### 5.2 Database Security

- [ ] Row Level Security enabled
- [ ] Connection SSL required
- [ ] IP allowlist configured
- [ ] Audit logging enabled

### 5.3 Secret Management

- [ ] All secrets in environment variables
- [ ] Secrets rotated quarterly
- [ ] Backup encryption keys secure
- [ ] No secrets in code

## Step 6: DNS Configuration

### 6.1 Required Records

```
# API Gateway
api.capacity-planner.com    CNAME    your-railway-domain.up.railway.app

# Web Application  
app.capacity-planner.com    CNAME    cname.vercel-dns.com

# Marketing Site (if applicable)
capacity-planner.com        A        76.76.21.21
www.capacity-planner.com    CNAME    cname.vercel-dns.com
```

### 6.2 Email Configuration

```
# SPF Record
@    TXT    "v=spf1 include:_spf.google.com ~all"

# DKIM (from email provider)
google._domainkey    TXT    "v=DKIM1; k=rsa; p=..."

# DMARC
_dmarc    TXT    "v=DMARC1; p=quarantine; rua=mailto:admin@capacity-planner.com"
```

## Step 7: Testing Production

### 7.1 Pre-Launch Checklist

- [ ] All health endpoints return 200
- [ ] SSL certificates valid
- [ ] Database migrations successful
- [ ] Authentication working
- [ ] API rate limiting active
- [ ] Monitoring alerts configured
- [ ] Backup script tested
- [ ] Load testing completed

### 7.2 Smoke Tests

```bash
# API Health
curl https://api.capacity-planner.com/health

# App Loading
curl -I https://app.capacity-planner.com

# Database Connectivity
curl https://api.capacity-planner.com/api/health/detailed

# Authentication
curl -X POST https://api.capacity-planner.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

## Step 8: Go-Live Process

### 8.1 Soft Launch

1. Deploy with feature flags disabled
2. Test with internal team
3. Enable for pilot customers
4. Monitor closely for 48 hours

### 8.2 Full Launch

1. Enable all feature flags
2. Update status page
3. Send launch communications
4. Monitor dashboards actively

### 8.3 Post-Launch

1. Daily monitoring for first week
2. Address any issues immediately
3. Collect performance metrics
4. Plan optimizations

## Maintenance Windows

- **Scheduled**: Tuesday 2-4 AM UTC
- **Notification**: 24 hours advance
- **Procedure**: See runbook
- **Rollback**: Always prepared

## Disaster Recovery

### RTO and RPO Targets

- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 6 hours

### Backup Schedule

- **Database**: Every 6 hours
- **Configuration**: Daily
- **Retention**: 30 days

### Recovery Procedures

See `/scripts/restore-production.sh` for detailed steps

## Support Contacts

- **Railway Support**: support@railway.app
- **Supabase Support**: support@supabase.io
- **Vercel Support**: support@vercel.com
- **Domain Registrar**: (your registrar)

## Regular Maintenance Tasks

### Daily
- [ ] Check monitoring dashboards
- [ ] Review error logs
- [ ] Verify backups completed

### Weekly
- [ ] Review performance metrics
- [ ] Check SSL certificate expiry
- [ ] Update dependencies (staging first)

### Monthly
- [ ] Test disaster recovery
- [ ] Review and update documentation
- [ ] Security audit
- [ ] Cost optimization review

### Quarterly
- [ ] Rotate secrets
- [ ] Full system audit
- [ ] Load testing
- [ ] Update runbook