# Stand CRUD Performance Optimizations

This document describes the performance optimizations implemented for the Stand CRUD Controls feature.

## Overview

The following optimizations have been implemented to improve the performance and scalability of stand operations:

1. **Redis Caching** - Multi-tier caching with local and Redis cache
2. **Query Optimization** - Database indexes and optimized queries
3. **Request Deduplication** - Prevent duplicate requests
4. **Connection Pooling** - Efficient database connection management
5. **Response Compression** - Brotli, gzip, and deflate compression

## 1. Redis Caching

### Implementation
- **StandCache** class provides multi-tier caching
- Local in-memory cache for frequently accessed data
- Redis cache for distributed caching across instances
- Cache warming for preloading frequently accessed stands

### Cache Strategy
```typescript
// Cache TTLs
- Individual stands: 5 minutes
- Stand lists: 1 minute  
- Statistics: 5 minutes
- Local cache: 1 minute
```

### Usage
```typescript
// Import the optimized service
import { StandCRUDOptimizedService } from '@capacity-planner/assets-module';

// The service automatically handles caching
const service = new StandCRUDOptimizedService(validationEngine);

// Get stand (checks cache first)
const stand = await service.getStandById(standId, organizationId);

// Warm cache with frequently accessed stands
await service.warmCache(organizationId, 100);
```

## 2. Query Optimization

### Database Indexes
The following indexes have been added to improve query performance:

```sql
-- Organization and soft delete queries
CREATE INDEX idx_stand_org_deleted ON assets."Stand" (organization_id, is_deleted);

-- Code lookups
CREATE INDEX idx_stand_org_code ON assets."Stand" (organization_id, code) WHERE is_deleted = false;

-- Status filtering
CREATE INDEX idx_stand_org_status ON assets."Stand" (organization_id, status) WHERE is_deleted = false;

-- Terminal grouping
CREATE INDEX idx_stand_org_terminal ON assets."Stand" (organization_id, terminal) WHERE is_deleted = false;

-- JSONB field queries
CREATE INDEX idx_stand_dimensions ON assets."Stand" USING GIN (dimensions);
CREATE INDEX idx_stand_aircraft_compat ON assets."Stand" USING GIN (aircraft_compatibility);
CREATE INDEX idx_stand_ground_support ON assets."Stand" USING GIN (ground_support);
```

### Optimized Queries
- Parallel execution of count and data queries
- Aggregation queries for statistics
- Selective field loading
- Batch processing for bulk operations

## 3. Request Deduplication

### Implementation
- Deduplication middleware prevents duplicate requests within a time window
- Configurable time windows (default: 1 second for mutations, 5 seconds for bulk operations)
- Request fingerprinting based on method, path, body, and user

### Usage
```typescript
router.post('/stands', 
  deduplicationMiddleware(), // 1 second default
  async (req, res) => { /* ... */ }
);

router.post('/stands/bulk', 
  deduplicationMiddleware(5000), // 5 seconds for bulk operations
  async (req, res) => { /* ... */ }
);
```

## 4. Connection Pooling

### Configuration
Database connections are managed with pooling to prevent connection exhaustion:

```typescript
// Environment variables
DB_CONNECTION_LIMIT=10      // Maximum connections in pool
DB_MAX_IDLE_TIME=30        // Seconds before idle connection is closed
DB_CONNECTION_TIMEOUT=5000  // Milliseconds to wait for connection
DB_QUERY_TIMEOUT=30000     // Milliseconds before query timeout
```

### Features
- Automatic retry on connection errors
- Connection pool monitoring
- Slow query detection and logging
- Graceful shutdown handling

## 5. Response Compression

### Implementation
- Advanced compression middleware with multiple algorithms
- Algorithm preference: Brotli > Gzip > Deflate
- Configurable compression levels and thresholds
- Compression statistics in response headers

### Configuration
```typescript
router.use(advancedCompression({ 
  level: 6,                              // Compression level (1-9)
  threshold: 1024,                       // Minimum size to compress (1KB)
  algorithms: ['br', 'gzip', 'deflate']  // Supported algorithms
}));
```

### Response Headers
```
Content-Encoding: br
X-Original-Size: 5234
X-Compressed-Size: 1823
X-Compression-Ratio: 34.82%
```

## Performance Monitoring

### Cache Metrics
```typescript
// Get cache statistics
const stats = await service.getCacheStats();
// Returns: { cacheInfo, metrics }
```

### Database Metrics
```typescript
// Get connection pool statistics
const poolStats = await getConnectionPoolStats();
// Returns: { activeConnections, idleConnections, totalConnections, waitingRequests }
```

### API Endpoints
- `GET /stands/cache/stats` - Cache statistics
- `POST /stands/cache/warm` - Warm cache
- `GET /api/rate-limit/stats` - Rate limiting statistics

## Best Practices

1. **Cache Invalidation**
   - Caches are automatically invalidated on create/update/delete
   - List caches are invalidated when any stand in the organization changes
   - Statistics are recalculated after modifications

2. **Bulk Operations**
   - Use bulk endpoints for multiple operations
   - Batch processing prevents database overload
   - Automatic cache clearing after bulk operations

3. **Error Handling**
   - Cache misses gracefully fall back to database
   - Failed cache operations don't affect core functionality
   - Connection errors trigger automatic retries

4. **Monitoring**
   - Monitor cache hit rates
   - Track slow queries
   - Watch connection pool utilization
   - Set up alerts for high error rates

## Migration Guide

To use the optimized services:

1. **Update imports**
   ```typescript
   // Old
   import { StandCRUDService } from '@capacity-planner/assets-module';
   
   // New
   import { StandCRUDOptimizedService } from '@capacity-planner/assets-module';
   ```

2. **Configure Redis**
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your-password
   REDIS_DB=0
   ```

3. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   ```

4. **Update route handlers**
   ```typescript
   // Use the optimized route file
   import standsRouter from './routes/assets/stands-optimized';
   ```

## Performance Benchmarks

Expected improvements:
- **Read operations**: 50-80% faster with cache hits
- **List queries**: 60-90% faster with optimized indexes
- **Bulk operations**: 40-60% faster with batch processing
- **Response size**: 30-70% smaller with compression
- **Database connections**: 50% fewer connections needed