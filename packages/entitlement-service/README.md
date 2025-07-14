# Entitlement Service

## Overview

The Entitlement Service manages module access control for organizations in the CapaCity Planner platform. It provides a database-backed implementation with optional Redis caching for performance optimization.

## Features

- **Full CRUD Operations**: Create, read, update, and delete entitlements
- **Access Control**: Check if organizations have access to specific modules
- **Audit Trail**: Complete audit history of all entitlement changes
- **Redis Caching**: Optional caching layer for improved performance
- **REST API**: Comprehensive REST endpoints for entitlement management

## Architecture

### Service Layers

1. **DatabaseEntitlementService**: Direct database operations using Prisma
2. **CachedEntitlementService**: Redis caching wrapper around database service
3. **MockEntitlementService**: In-memory implementation for development/testing

### Database Schema

```prisma
model Entitlement {
  id             String    @id @default(uuid())
  organizationId String    
  moduleKey      String    // 'assets', 'work', 'capacity', etc.
  status         String    // 'active', 'suspended', 'expired'
  validFrom      DateTime  
  validUntil     DateTime?
  createdAt      DateTime  
  updatedAt      DateTime  
  createdBy      String?   
  updatedBy      String?   
}

model EntitlementAudit {
  id             String   @id @default(uuid())
  entitlementId  String   
  organizationId String   
  moduleKey      String   
  action         String   // 'created', 'updated', 'suspended', 'reactivated'
  previousValue  Json?    
  newValue       Json?    
  performedBy    String   
  performedAt    DateTime 
  reason         String?
}
```

## API Endpoints

### Check Access
```
GET /api/entitlements/organizations/:orgId/modules/:moduleKey/access
```

### List Organization Entitlements
```
GET /api/entitlements/organizations/:orgId/entitlements
```

### Get Specific Entitlement
```
GET /api/entitlements/organizations/:orgId/entitlements/:moduleKey
```

### Grant Access
```
POST /api/entitlements/organizations/:orgId/entitlements/:moduleKey
Body: { validUntil?: string, userId?: string }
```

### Revoke Access
```
DELETE /api/entitlements/organizations/:orgId/entitlements/:moduleKey
Body: { userId?: string }
```

### Get All Entitlements (Admin)
```
GET /api/entitlements/entitlements
```

### Get Audit History
```
GET /api/entitlements/organizations/:orgId/entitlements/audit?moduleKey=:moduleKey&limit=:limit
```

### Batch Grant Access (Admin)
```
POST /api/entitlements/entitlements/batch-grant
Body: { 
  grants: [{ organizationId: string, moduleKey: string, validUntil?: string }],
  userId?: string 
}
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/capacity_planner

# Redis (optional)
ENABLE_REDIS_CACHE=true
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TTL=300  # Cache TTL in seconds

# Services
USE_MOCK_SERVICES=false  # Use mock service for development
```

## Usage

### Basic Usage

```typescript
import { getEntitlementService } from './services/entitlement-service.factory';

// Get service instance (automatically configured based on environment)
const entitlementService = getEntitlementService();

// Check access
const hasAccess = await entitlementService.hasAccess('org123', ModuleKey.ASSETS);

// Grant access
await entitlementService.grantAccess('org123', ModuleKey.ASSETS, validUntilDate, 'admin');

// List entitlements
const entitlements = await entitlementService.listEntitlements('org123');
```

### With Custom Configuration

```typescript
const entitlementService = createEntitlementService({
  useMock: false,
  useCache: true,
  redisHost: 'redis.example.com',
  redisPort: 6379,
  cacheTTL: 600, // 10 minutes
});
```

## Testing

```bash
# Run unit tests
pnpm test entitlement-service

# Run with coverage
pnpm test entitlement-service --coverage
```

## Migration

To migrate from the mock service to the database-backed service:

1. Ensure database is set up and migrations are run
2. Set `USE_MOCK_SERVICES=false` in environment
3. Optionally enable Redis caching with `ENABLE_REDIS_CACHE=true`
4. Restart the API gateway

The service factory will automatically use the appropriate implementation based on configuration.