# Work Request API Documentation

## Overview

The Work Request API provides comprehensive functionality for managing maintenance and operational work requests in an airport environment. This API supports the full lifecycle of work requests from creation through completion, including approvals, file attachments, reporting, and analytics.

## Base URL

```
https://api.capacity-planner.com/v1
```

## Authentication

All API requests require authentication headers:

```
x-user-id: <user-id>
x-organization-id: <organization-id>
x-user-role: <user-role>
```

## Endpoints

### Work Request CRUD Operations

#### Create Work Request

```http
POST /work-requests
```

Creates a new work request.

**Request Body:**
```json
{
  "assetId": "string",
  "assetType": "stand|airfield|baggage|terminal|gate|runway|taxiway",
  "workType": "maintenance|inspection|repair|modification|emergency",
  "category": "routine|corrective|preventive|emergency",
  "priority": "critical|high|medium|low",
  "urgency": "immediate|scheduled|routine",
  "impactLevel": "full_closure|partial_restriction|no_impact",
  "title": "string",
  "description": "string",
  "locationDetails": "string",
  "safetyConsiderations": "string",
  "requestedStartDate": "ISO 8601 date",
  "requestedEndDate": "ISO 8601 date",
  "estimatedDurationMinutes": "number",
  "deadline": "ISO 8601 date",
  "estimatedPersonnelCount": "number",
  "requiredSkills": ["string"],
  "requiredEquipment": ["string"],
  "estimatedMaterialsCost": "number",
  "budgetCode": "string",
  "estimatedTotalCost": "number"
}
```

**Response:**
```json
{
  "success": true,
  "workRequestId": "string",
  "validationResults": []
}
```

#### Get Work Requests

```http
GET /work-requests
```

Retrieves a paginated list of work requests with filtering options.

**Query Parameters:**
- `status`: Filter by status (can be multiple)
- `priority`: Filter by priority (can be multiple)
- `workType`: Filter by work type
- `assetType`: Filter by asset type
- `assetId`: Filter by specific asset
- `search`: Text search across title and description
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [{
      "id": "string",
      "title": "string",
      "status": "string",
      "priority": "string",
      "assetCode": "string",
      "requestedStartDate": "ISO 8601 date",
      "createdAt": "ISO 8601 date"
    }],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### Get Work Request Details

```http
GET /work-requests/:id
```

Retrieves detailed information about a specific work request.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "title": "string",
    "description": "string",
    "status": "string",
    "priority": "string",
    "workType": "string",
    "category": "string",
    "assetId": "string",
    "assetType": "string",
    "assetCode": "string",
    "assetName": "string",
    "requestedBy": "string",
    "requestorName": "string",
    "approvals": [],
    "attachments": [],
    "statusHistory": [],
    "comments": []
  }
}
```

#### Update Work Request

```http
PUT /work-requests/:id
```

Updates an existing work request.

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "priority": "critical|high|medium|low",
  "deadline": "ISO 8601 date",
  "version": "number (required for optimistic locking)"
}
```

### Status Management

#### Update Work Request Status

```http
POST /work-requests/:id/status
```

Updates the status of a work request.

**Request Body:**
```json
{
  "status": "draft|submitted|under_review|approved|rejected|cancelled|in_progress|completed",
  "reason": "string",
  "comments": "string"
}
```

### Approval Workflow

#### Get Pending Approvals

```http
GET /work-requests/approvals/pending
```

Retrieves work requests pending approval for the current user.

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [{
      "id": "string",
      "workRequestId": "string",
      "workRequestTitle": "string",
      "priority": "string",
      "submissionDate": "ISO 8601 date",
      "timeoutDate": "ISO 8601 date"
    }]
  }
}
```

#### Approve Work Request

```http
POST /work-requests/:id/approve
```

Approves a work request.

**Request Body:**
```json
{
  "comments": "string",
  "conditions": "string"
}
```

#### Reject Work Request

```http
POST /work-requests/:id/reject
```

Rejects a work request.

**Request Body:**
```json
{
  "comments": "string",
  "requestInfo": "string"
}
```

### File Attachments

#### Upload Attachments

```http
POST /work-requests/:id/attachments
Content-Type: multipart/form-data
```

Uploads files to a work request.

**Form Data:**
- `files`: One or more files (max 10 files, max 100MB each)

**Supported File Types:**
- PDF (application/pdf)
- JPEG (image/jpeg)
- PNG (image/png)
- GIF (image/gif)
- Text (text/plain)
- Word Documents (application/msword, .docx)

**Response:**
```json
{
  "success": true,
  "attachmentIds": ["string"]
}
```

#### Get Attachments

```http
GET /work-requests/:id/attachments
```

Retrieves attachment metadata for a work request.

#### Download Attachment

```http
GET /work-requests/:id/attachments/:attachmentId
```

Downloads a specific attachment file.

### Advanced Search and Export

#### Search Work Requests

```http
POST /work-requests/search
```

Performs advanced search with sorting and filtering.

**Request Body:**
```json
{
  "filters": {
    "status": ["string"],
    "priority": ["string"],
    "workType": ["string"],
    "assetType": ["string"],
    "search": "string",
    "submissionDateStart": "ISO 8601 date",
    "submissionDateEnd": "ISO 8601 date",
    "minCost": "number",
    "maxCost": "number"
  },
  "sortOptions": [{
    "field": "priority|createdAt|deadline|estimatedTotalCost",
    "direction": "asc|desc"
  }],
  "page": 1,
  "pageSize": 50
}
```

#### Export Work Requests

```http
POST /work-requests/export
```

Exports work requests to Excel or CSV format.

**Request Body:**
```json
{
  "filters": {
    "status": ["string"],
    "priority": ["string"]
  },
  "format": "excel|csv",
  "columns": ["id", "title", "status", "priority", "assetCode"]
}
```

### Bulk Operations

#### Perform Bulk Operations

```http
POST /work-requests/bulk
```

Performs bulk operations on multiple work requests.

**Request Body:**
```json
{
  "requestIds": ["string"],
  "operation": "approve|reject|assign|cancel|prioritize",
  "params": {
    "comments": "string",
    "priority": "string",
    "assignedTo": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "processedCount": 10,
  "failedCount": 0,
  "results": [{
    "id": "string",
    "success": true
  }]
}
```

### Dashboard and Analytics

#### Get Dashboard Statistics

```http
GET /work-requests/dashboard/stats
```

Retrieves dashboard statistics and summaries.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 1250,
    "pendingRequests": 45,
    "inProgressRequests": 28,
    "completedRequests": 1100,
    "overdueRequests": 12,
    "totalEstimatedCost": 2500000,
    "avgCompletionTime": 3.5,
    "byStatus": {
      "submitted": 45,
      "approved": 20,
      "in_progress": 28,
      "completed": 1100
    },
    "byPriority": {
      "critical": 5,
      "high": 40,
      "medium": 180,
      "low": 1025
    },
    "byAssetType": {
      "stand": 450,
      "gate": 300,
      "runway": 150
    }
  }
}
```

### Reporting

#### Get Performance Metrics

```http
GET /work-requests/reports/metrics
```

Retrieves performance metrics for a specified period.

**Query Parameters:**
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalRequests": 320,
    "completedRequests": 280,
    "completionRate": 87.5,
    "averageResolutionTime": 3.2,
    "averageApprovalTime": 0.8,
    "onTimeCompletionRate": 92.3,
    "overdueRequests": 15,
    "costVariance": -2.5,
    "resourceUtilization": 78.5
  }
}
```

#### Get KPI Metrics

```http
GET /work-requests/reports/kpis
```

Retrieves KPI metrics with targets and trends.

**Response:**
```json
{
  "success": true,
  "kpis": [{
    "name": "Completion Rate",
    "value": 87.5,
    "target": 90,
    "unit": "%",
    "trend": "up",
    "status": "warning"
  }]
}
```

#### Get Trend Analysis

```http
GET /work-requests/reports/trends
```

Analyzes trends for specified metrics.

**Query Parameters:**
- `metric`: Metric to analyze (request_volume|completion_rate|cost|approval_time)
- `groupBy`: Time grouping (day|week|month)
- `periods`: Number of periods to analyze

**Response:**
```json
{
  "success": true,
  "data": [{
    "period": "2024-01",
    "value": 320
  }],
  "trend": "increasing",
  "changeRate": 5.2
}
```

#### Generate Report

```http
POST /work-requests/reports/generate
```

Generates a report using a specified template.

**Request Body:**
```json
{
  "templateId": "operational-daily|executive-weekly|compliance-monthly",
  "startDate": "ISO 8601 date",
  "endDate": "ISO 8601 date",
  "filters": {},
  "format": "pdf|excel|html"
}
```

### Chart Data

#### Get Chart Data

```http
GET /work-requests/charts/:chartType
```

Retrieves data formatted for various chart types.

**Chart Types:**
- `status-distribution`: Pie chart of request statuses
- `priority-distribution`: Bar chart of priorities
- `request-volume`: Time series of request volume
- `asset-performance`: Performance metrics by asset type
- `cost-analysis`: Cost breakdown and trends
- `sla-compliance`: SLA compliance gauge

**Query Parameters (varies by chart type):**
- `startDate`: Start date for time-based charts
- `endDate`: End date for time-based charts
- `groupBy`: Grouping option (day|week|month|category|asset_type)
- `metric`: Specific metric for performance charts

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {
      "type": "pie|bar|line|gauge|donut|area",
      "title": "Chart Title",
      "xAxis": {},
      "yAxis": {}
    },
    "series": [{
      "name": "Series Name",
      "data": [{
        "label": "Label",
        "value": 100
      }]
    }]
  }
}
```

### Saved Views

#### Create Saved View

```http
POST /work-requests/views
```

Creates a saved view with filters and preferences.

**Request Body:**
```json
{
  "name": "My Custom View",
  "filters": {
    "status": ["submitted", "approved"],
    "priority": ["high", "critical"]
  },
  "sortOptions": [{
    "field": "priority",
    "direction": "desc"
  }],
  "columns": ["id", "title", "status", "priority", "assetCode"],
  "isShared": true
}
```

#### Get Saved Views

```http
GET /work-requests/views
```

Retrieves saved views for the current user.

#### Update Saved View

```http
PUT /work-requests/views/:id
```

Updates an existing saved view.

#### Delete Saved View

```http
DELETE /work-requests/views/:id
```

Deletes a saved view.

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": {}
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Version conflict or duplicate resource
- `500 Internal Server Error`: Server error

## Rate Limiting

API requests are rate limited to:
- 1000 requests per hour per user
- 10000 requests per hour per organization

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets

## Webhooks

Webhooks can be configured to receive real-time notifications for work request events:

### Event Types
- `work_request.created`
- `work_request.updated`
- `work_request.status_changed`
- `work_request.approved`
- `work_request.rejected`
- `work_request.completed`

### Webhook Payload

```json
{
  "event": "work_request.status_changed",
  "timestamp": "ISO 8601 date",
  "data": {
    "workRequestId": "string",
    "previousStatus": "submitted",
    "newStatus": "approved",
    "changedBy": "user-id"
  }
}
```

## Best Practices

1. **Pagination**: Always use pagination for list endpoints to improve performance
2. **Filtering**: Use specific filters to reduce response size
3. **Caching**: Implement client-side caching with ETags
4. **Error Handling**: Implement retry logic for transient errors
5. **Versioning**: Include version numbers when updating resources
6. **Bulk Operations**: Use bulk endpoints for multiple operations
7. **File Uploads**: Compress large files before uploading
8. **Monitoring**: Monitor rate limit headers to avoid throttling