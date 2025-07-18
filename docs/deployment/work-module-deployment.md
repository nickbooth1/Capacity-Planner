# Work Module Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Work Request Module of the Capacity Planner system. The module supports containerized deployment using Docker and Kubernetes, with options for various cloud providers.

## Prerequisites

### System Requirements

- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Redis 6.x or higher (for caching)
- Docker 20.x or higher (for containerization)
- Kubernetes 1.24 or higher (for orchestration)

### Required Services

- PostgreSQL database
- Redis cache
- S3-compatible object storage (for file attachments)
- SMTP server (for email notifications)
- Virus scanning service (optional)

## Environment Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Application
NODE_ENV=production
PORT=3000
API_URL=https://api.capacity-planner.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/capacity_planner
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://host:6379
REDIS_PASSWORD=your-redis-password

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=24h
SESSION_SECRET=your-session-secret

# File Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=capacity-planner-attachments
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_SIGNED_URL_EXPIRY=3600

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@capacity-planner.com

# Virus Scanning (optional)
CLAMAV_HOST=clamav-service
CLAMAV_PORT=3310

# Monitoring
NEW_RELIC_LICENSE_KEY=your-license-key
SENTRY_DSN=your-sentry-dsn

# Feature Flags
ENABLE_FILE_ENCRYPTION=true
ENABLE_VIRUS_SCANNING=true
ENABLE_AUDIT_TRAIL=true
MAX_FILE_SIZE_MB=100
MAX_FILES_PER_REQUEST=10
```

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE capacity_planner;
CREATE USER cp_user WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE capacity_planner TO cp_user;
```

### 2. Run Migrations

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @capacity-planner/work-module prisma generate

# Run migrations
pnpm --filter @capacity-planner/work-module prisma migrate deploy
```

### 3. Seed Initial Data (Optional)

```bash
pnpm --filter @capacity-planner/work-module prisma db seed
```

## Build Process

### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Build Application

```bash
# Build all packages
pnpm build

# Or build specific packages
pnpm --filter @capacity-planner/work-module build
pnpm --filter @capacity-planner/api-gateway build
```

### 3. Run Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Docker Deployment

### 1. Build Docker Image

Create a `Dockerfile` in the project root:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/work-module/package.json ./packages/work-module/
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY apps/api-gateway/package.json ./apps/api-gateway/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @capacity-planner/work-module prisma generate

# Build application
RUN pnpm build

# Production stage
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps ./apps

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "apps/api-gateway/dist/index.js"]
```

### 2. Build and Push Image

```bash
# Build image
docker build -t capacity-planner/work-module:latest .

# Tag for registry
docker tag capacity-planner/work-module:latest your-registry/capacity-planner/work-module:v1.0.0

# Push to registry
docker push your-registry/capacity-planner/work-module:v1.0.0
```

## Kubernetes Deployment

### 1. Create Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: capacity-planner
```

### 2. Create ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: work-module-config
  namespace: capacity-planner
data:
  NODE_ENV: "production"
  PORT: "3000"
  API_URL: "https://api.capacity-planner.com"
  DATABASE_POOL_MIN: "2"
  DATABASE_POOL_MAX: "10"
  REDIS_URL: "redis://redis-service:6379"
  S3_ENDPOINT: "https://s3.amazonaws.com"
  S3_REGION: "us-east-1"
  S3_BUCKET: "capacity-planner-attachments"
```

### 3. Create Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: work-module-secrets
  namespace: capacity-planner
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@postgres-service:5432/capacity_planner"
  JWT_SECRET: "your-jwt-secret"
  S3_ACCESS_KEY_ID: "your-access-key"
  S3_SECRET_ACCESS_KEY: "your-secret-key"
  SMTP_PASSWORD: "your-smtp-password"
```

### 4. Create Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: work-module
  namespace: capacity-planner
spec:
  replicas: 3
  selector:
    matchLabels:
      app: work-module
  template:
    metadata:
      labels:
        app: work-module
    spec:
      containers:
      - name: work-module
        image: your-registry/capacity-planner/work-module:v1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: work-module-config
        - secretRef:
            name: work-module-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 5. Create Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: work-module-service
  namespace: capacity-planner
spec:
  selector:
    app: work-module
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### 6. Create Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: work-module-ingress
  namespace: capacity-planner
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.capacity-planner.com
    secretName: work-module-tls
  rules:
  - host: api.capacity-planner.com
    http:
      paths:
      - path: /work-requests
        pathType: Prefix
        backend:
          service:
            name: work-module-service
            port:
              number: 80
```

### 7. Create HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: work-module-hpa
  namespace: capacity-planner
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: work-module
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Database Migrations

### Production Migration Strategy

1. **Backup Database**
```bash
pg_dump -h $DB_HOST -U $DB_USER -d capacity_planner > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Test Migration**
```bash
# Run on staging environment first
pnpm --filter @capacity-planner/work-module prisma migrate deploy --preview-feature
```

3. **Apply Migration**
```bash
# Apply to production
pnpm --filter @capacity-planner/work-module prisma migrate deploy
```

4. **Verify Migration**
```bash
# Check migration status
pnpm --filter @capacity-planner/work-module prisma migrate status
```

## Monitoring and Logging

### 1. Application Metrics

Configure Prometheus metrics endpoint:

```javascript
// metrics.js
import { register } from 'prom-client';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 2. Log Aggregation

Configure structured logging:

```javascript
// logger.js
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 3. Health Checks

Implement health check endpoints:

```javascript
// health.js
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

## Security Considerations

### 1. Network Security

- Use TLS/SSL for all communications
- Implement network policies in Kubernetes
- Use private subnets for database and cache

### 2. Secret Management

- Use Kubernetes Secrets or external secret managers
- Rotate secrets regularly
- Never commit secrets to version control

### 3. Access Control

- Implement RBAC in Kubernetes
- Use service accounts with minimal permissions
- Regular security audits

### 4. Data Protection

- Enable encryption at rest for database
- Use encrypted connections to Redis
- Implement file encryption for attachments

## Backup and Recovery

### 1. Database Backup

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups"
DB_NAME="capacity_planner"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Keep last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

### 2. File Storage Backup

- Enable S3 versioning
- Configure cross-region replication
- Implement lifecycle policies

### 3. Disaster Recovery

- Document RTO/RPO requirements
- Test recovery procedures regularly
- Maintain runbooks for common scenarios

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_work_requests_status ON work_requests(status);
CREATE INDEX idx_work_requests_priority ON work_requests(priority);
CREATE INDEX idx_work_requests_created_at ON work_requests(created_at);
CREATE INDEX idx_work_requests_organization_id ON work_requests(organization_id);

-- Analyze tables
ANALYZE work_requests;
```

### 2. Caching Strategy

- Cache frequently accessed data in Redis
- Implement cache invalidation logic
- Use CDN for static assets

### 3. Connection Pooling

Configure optimal pool sizes:

```javascript
const pool = new Pool({
  min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
  max: parseInt(process.env.DATABASE_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check connection string
   - Verify network connectivity
   - Check database user permissions

2. **High Memory Usage**
   - Review Node.js heap size
   - Check for memory leaks
   - Optimize query patterns

3. **Slow Response Times**
   - Enable query logging
   - Check database indexes
   - Review API endpoint performance

### Debug Mode

Enable debug logging:

```bash
DEBUG=capacity-planner:* node apps/api-gateway/dist/index.js
```

## Rollback Procedures

### 1. Application Rollback

```bash
# Kubernetes rollback
kubectl rollout undo deployment/work-module -n capacity-planner

# Docker rollback
docker service update --image your-registry/capacity-planner/work-module:previous-version work-module
```

### 2. Database Rollback

```bash
# Restore from backup
psql -h $DB_HOST -U $DB_USER -d capacity_planner < backup_file.sql

# Revert migration
pnpm --filter @capacity-planner/work-module prisma migrate reset
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check disk usage
   - Verify backup integrity

2. **Monthly**
   - Update dependencies
   - Review security patches
   - Performance analysis

3. **Quarterly**
   - Load testing
   - Disaster recovery drill
   - Security audit

## Support

For deployment issues, contact:
- DevOps Team: devops@capacity-planner.com
- On-call Engineer: +1-555-0123
- Slack Channel: #capacity-planner-ops