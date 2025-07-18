# Work Request Module

A comprehensive work request management system for airport operations, providing full lifecycle management from request creation through completion.

## Features

### Core Functionality
- **Work Request Management**: Create, update, and track maintenance and operational work requests
- **Asset Integration**: Link requests to specific airport assets (stands, gates, runways, etc.)
- **Multi-level Approval Workflow**: Configurable approval chains based on cost and type
- **File Attachments**: Secure file upload with virus scanning and encryption
- **Real-time Notifications**: Email and in-app notifications for all stakeholders

### Advanced Features
- **Repository Service**: Advanced search, filtering, sorting, and bulk operations
- **Reporting & Analytics**: Performance metrics, KPIs, trend analysis, and forecasting
- **Report Templates**: Pre-built templates for operational, executive, and compliance reports
- **Scheduled Reports**: Automated report generation and email distribution
- **Chart Visualization**: Multiple chart types for data visualization
- **Saved Views**: Custom filters and views for personalized workflows
- **Audit Trail**: Complete tracking of all actions and changes

## Architecture

```
work-module/
├── src/
│   ├── services/
│   │   ├── work-request.service.ts         # Core CRUD operations
│   │   ├── approval-workflow.service.ts    # Approval management
│   │   ├── notification.service.ts         # Notification handling
│   │   ├── validation-engine.service.ts    # Request validation
│   │   ├── file-upload.service.ts          # File management
│   │   ├── virus-scanner.service.ts        # Virus scanning
│   │   ├── file-encryption.service.ts      # File encryption
│   │   ├── work-request-repository.service.ts  # Advanced data operations
│   │   ├── reporting.service.ts            # Report generation
│   │   ├── report-template.service.ts      # Template management
│   │   ├── scheduled-report.service.ts     # Automated reports
│   │   └── chart-data.service.ts           # Chart data generation
│   ├── utils/
│   │   ├── monitoring.ts                   # Prometheus metrics
│   │   └── logger.ts                       # Winston logging
│   └── index.ts                            # Module exports
├── prisma/
│   └── schema.prisma                       # Database schema
└── tests/
    └── ...                                 # Test suites
```

## Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate

# Run database migrations
pnpm prisma migrate dev
```

## Usage

### Basic Work Request Operations

```typescript
import { WorkRequestService } from '@capacity-planner/work-module';

const service = new WorkRequestService(prisma);

// Create work request
const request = await service.createWorkRequest(organizationId, userId, {
  assetId: 'asset-123',
  assetType: AssetType.STAND,
  workType: WorkType.MAINTENANCE,
  category: 'routine',
  priority: Priority.MEDIUM,
  title: 'Routine Stand Maintenance',
  description: 'Monthly inspection and maintenance',
  requestedStartDate: new Date('2024-02-01')
});

// Get work requests
const requests = await service.getWorkRequests(organizationId, {
  status: [WorkRequestStatus.SUBMITTED],
  priority: [Priority.HIGH, Priority.CRITICAL]
});
```

### Advanced Search and Filtering

```typescript
import { WorkRequestRepositoryService } from '@capacity-planner/work-module';

const repository = new WorkRequestRepositoryService(prisma);

// Advanced search
const results = await repository.searchWorkRequests(
  organizationId,
  {
    status: [WorkRequestStatus.APPROVED],
    search: 'maintenance',
    minCost: 1000,
    maxCost: 50000
  },
  [
    { field: 'priority', direction: 'desc' },
    { field: 'createdAt', direction: 'asc' }
  ],
  1,
  50
);

// Bulk operations
const bulkResult = await repository.performBulkOperation(
  organizationId,
  ['req-1', 'req-2', 'req-3'],
  'approve',
  { comments: 'Bulk approved' },
  userId
);
```

### Reporting and Analytics

```typescript
import { ReportingService } from '@capacity-planner/work-module';

const reporting = new ReportingService(prisma);

// Get performance metrics
const metrics = await reporting.getPerformanceMetrics(organizationId, {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  periodType: 'monthly'
});

// Generate report
const report = await reporting.generateReport(
  organizationId,
  'operational-daily',
  period
);

// Get trend analysis
const trends = await reporting.getTrendAnalysis(
  organizationId,
  'request_volume',
  'month',
  12
);
```

### Chart Data Generation

```typescript
import { ChartDataService } from '@capacity-planner/work-module';

const charts = new ChartDataService(prisma);

// Status distribution pie chart
const statusChart = await charts.getStatusDistributionChart(organizationId);

// Request volume time series
const volumeChart = await charts.getRequestVolumeTimeSeriesChart(
  organizationId,
  startDate,
  endDate,
  'week'
);

// SLA compliance gauge
const slaChart = await charts.getSLAComplianceGauge(organizationId, period);
```

## API Endpoints

### Work Request Operations
- `POST /work-requests` - Create new request
- `GET /work-requests` - List requests with filters
- `GET /work-requests/:id` - Get request details
- `PUT /work-requests/:id` - Update request
- `POST /work-requests/:id/status` - Update status

### Approval Workflow
- `GET /work-requests/approvals/pending` - Get pending approvals
- `POST /work-requests/:id/approve` - Approve request
- `POST /work-requests/:id/reject` - Reject request

### File Management
- `POST /work-requests/:id/attachments` - Upload files
- `GET /work-requests/:id/attachments` - List attachments
- `GET /work-requests/:id/attachments/:attachmentId` - Download file

### Advanced Operations
- `POST /work-requests/search` - Advanced search
- `POST /work-requests/bulk` - Bulk operations
- `POST /work-requests/export` - Export to Excel/CSV

### Reporting
- `GET /work-requests/reports/metrics` - Performance metrics
- `GET /work-requests/reports/kpis` - KPI metrics
- `POST /work-requests/reports/generate` - Generate report
- `GET /work-requests/charts/:chartType` - Get chart data

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# File Storage
S3_BUCKET=work-request-attachments
S3_REGION=us-east-1
MAX_FILE_SIZE_MB=100
MAX_FILES_PER_REQUEST=10

# Security
ENABLE_FILE_ENCRYPTION=true
ENABLE_VIRUS_SCANNING=true
ENCRYPTION_KEY=your-encryption-key

# Notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASSWORD=pass

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

## Testing

```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Run with coverage
pnpm test:coverage

# Run specific test suite
pnpm test work-request-repository.service.test.ts
```

## Monitoring

The module includes comprehensive monitoring with Prometheus metrics:

- HTTP request duration
- Work request counters by status/priority
- Approval processing times
- File upload sizes
- Database query performance
- Cache hit rates
- Report generation times

Access metrics at `/metrics` endpoint.

## Performance Considerations

1. **Database Indexing**: Ensure proper indexes on frequently queried fields
2. **Caching**: Redis caching for frequently accessed data
3. **File Storage**: Use S3 or compatible object storage for scalability
4. **Batch Operations**: Use bulk endpoints for processing multiple items
5. **Pagination**: Always paginate large result sets

## Security

- JWT-based authentication
- Role-based access control (RBAC)
- File encryption for sensitive attachments
- Virus scanning for all uploads
- Comprehensive audit logging
- Input validation and sanitization

## License

Proprietary - Capacity Planner System

## Support

For issues and questions:
- Technical Support: tech-support@capacity-planner.com
- Documentation: https://docs.capacity-planner.com
- Issue Tracker: https://github.com/capacity-planner/issues