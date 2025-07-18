# Stand CRUD Controls API Documentation

## Overview

The Stand CRUD Controls API provides comprehensive endpoints for managing aircraft stands, including create, read, update, delete operations, and bulk import functionality. All endpoints require authentication and respect organization-level data isolation.

## Base URL

```
https://api.capacity-planner.com/api/assets/stands
```

## Authentication

All endpoints require authentication via Bearer token:

```http
Authorization: Bearer <token>
X-Organization-ID: <organization-id>
X-User-ID: <user-id>
```

## Endpoints

### 1. List Stands

Get a paginated list of stands with optional filtering.

```http
GET /api/assets/stands
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| pageSize | integer | No | Items per page (default: 50, max: 100) |
| search | string | No | Search by code or name |
| status | string | No | Filter by status: operational, maintenance, closed |
| terminal | string | No | Filter by terminal |
| sortBy | string | No | Sort field: code, name, createdAt, updatedAt |
| sortOrder | string | No | Sort order: asc, desc |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "code": "A1",
      "name": "Stand A1",
      "terminal": "Terminal 1",
      "status": "operational",
      "dimensions": {
        "length": 60,
        "width": 30,
        "height": 15
      },
      "aircraftCompatibility": {
        "maxWingspan": 65,
        "maxLength": 70,
        "compatibleCategories": ["C", "D", "E"]
      },
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "pageSize": 50,
    "totalPages": 3
  }
}
```

#### Permissions Required
- `stands.read` or `admin`

---

### 2. Get Stand by ID

Retrieve a single stand by its ID.

```http
GET /api/assets/stands/:id
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Stand ID |

#### Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "A1",
    "name": "Stand A1",
    "terminal": "Terminal 1",
    "status": "operational",
    "dimensions": {
      "length": 60,
      "width": 30,
      "height": 15,
      "surface": "concrete",
      "slope": 0.5
    },
    "aircraftCompatibility": {
      "maxWingspan": 65,
      "maxLength": 70,
      "maxWeight": 560000,
      "compatibleCategories": ["C", "D", "E"],
      "specificAircraft": ["A330", "B777", "A350"]
    },
    "groundSupport": {
      "hasPowerSupply": true,
      "powerTypes": ["400Hz", "28VDC"],
      "hasGroundSupport": true,
      "fuelTypes": ["Jet-A1"],
      "hasDeicing": true
    },
    "operationalConstraints": {
      "timeRestrictions": [],
      "weatherLimits": {
        "maxWindSpeed": 50,
        "minVisibility": 200
      }
    },
    "version": 1,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "createdBy": "user-123",
    "updatedBy": "user-123"
  }
}
```

#### Permissions Required
- `stands.read` or `admin`

---

### 3. Create Stand

Create a new stand.

```http
POST /api/assets/stands
```

#### Request Body

```json
{
  "code": "A1",
  "name": "Stand A1",
  "terminal": "Terminal 1",
  "status": "operational",
  "dimensions": {
    "length": 60,
    "width": 30,
    "height": 15
  },
  "aircraftCompatibility": {
    "maxWingspan": 65,
    "maxLength": 70,
    "maxWeight": 560000,
    "compatibleCategories": ["C", "D", "E"]
  },
  "groundSupport": {
    "hasPowerSupply": true,
    "powerTypes": ["400Hz", "28VDC"],
    "hasGroundSupport": true,
    "fuelTypes": ["Jet-A1"]
  },
  "latitude": 51.4700,
  "longitude": -0.4543
}
```

#### Validation Rules

- `code`: Required, 1-10 alphanumeric characters
- `name`: Required, 1-100 characters
- `terminal`: Optional, max 50 characters
- `status`: Optional, must be one of: operational, maintenance, closed
- `dimensions.length`: Optional, 0-1000
- `dimensions.width`: Optional, 0-1000
- `dimensions.height`: Optional, 0-100
- `latitude`: Optional, -90 to 90
- `longitude`: Optional, -180 to 180

#### Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "A1",
    "name": "Stand A1",
    "version": 1,
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

#### Permissions Required
- `stands.create` or `admin`

---

### 4. Update Stand

Update an existing stand. Uses optimistic locking.

```http
PUT /api/assets/stands/:id
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Stand ID |

#### Request Body

```json
{
  "name": "Updated Stand A1",
  "status": "maintenance",
  "dimensions": {
    "length": 65,
    "width": 35
  },
  "version": 1
}
```

**Note**: The `version` field is required for optimistic locking. If the version doesn't match the current version in the database, a 409 Conflict error will be returned.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "A1",
    "name": "Updated Stand A1",
    "status": "maintenance",
    "version": 2,
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

#### Error Response (Version Conflict)

```json
{
  "success": false,
  "error": "Stand has been modified by another user"
}
```

#### Permissions Required
- `stands.update` or `admin`

---

### 5. Delete Stand

Soft delete a stand. The stand is not physically removed but marked as deleted.

```http
DELETE /api/assets/stands/:id
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Stand ID |

#### Request Body (Optional)

```json
{
  "reason": "Stand decommissioned"
}
```

#### Response

```json
{
  "success": true,
  "message": "Stand deleted successfully"
}
```

#### Permissions Required
- `stands.delete` or `admin`

---

### 6. Import Stands (Bulk)

Import multiple stands from a CSV file.

```http
POST /api/assets/stands/import
```

#### Request

Content-Type: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | CSV file with stands data |

#### CSV Format

```csv
code,name,terminal,status,length,width,height,maxWingspan
A1,Stand A1,Terminal 1,operational,60,30,15,65
A2,Stand A2,Terminal 1,operational,55,28,14,60
```

#### Response

```json
{
  "success": true,
  "message": "Import started",
  "jobId": "import-job-123"
}
```

#### Check Import Status

```http
GET /api/assets/stands/import/:jobId
```

```json
{
  "success": true,
  "data": {
    "id": "import-job-123",
    "status": "completed",
    "totalRows": 100,
    "processedRows": 100,
    "successRows": 98,
    "errorRows": 2,
    "errors": [
      {
        "row": 15,
        "error": "Duplicate code: A15"
      },
      {
        "row": 67,
        "error": "Invalid status: inactive"
      }
    ],
    "completedAt": "2025-01-15T11:30:00Z"
  }
}
```

#### Permissions Required
- `stands.import` or `admin`

---

### 7. Validate Stand Data

Validate stand data without creating a stand.

```http
POST /api/assets/stands/validate
```

#### Request Body

Same as Create Stand endpoint.

#### Response

```json
{
  "success": true,
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "field": "dimensions.height",
      "message": "Height is unusually low for aircraft category E"
    }
  ]
}
```

#### Permissions Required
- `stands.create` or `stands.update` or `admin`

---

### 8. Get Stand Statistics

Get aggregated statistics for stands.

```http
GET /api/assets/stands/stats
```

#### Response

```json
{
  "success": true,
  "data": {
    "total": 150,
    "byStatus": {
      "operational": 120,
      "maintenance": 25,
      "closed": 5
    },
    "byTerminal": {
      "Terminal 1": 50,
      "Terminal 2": 45,
      "Terminal 3": 55
    },
    "byCategory": {
      "A": 10,
      "B": 20,
      "C": 40,
      "D": 50,
      "E": 30
    }
  }
}
```

#### Permissions Required
- `stands.read` or `admin`

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Version conflict or duplicate resource |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limiting

- Standard API endpoints: 30 requests per minute
- Import endpoint: 10 requests per hour
- Auth endpoints: 5 requests per 15 minutes

## Field-Level Access Control

Certain fields may be filtered based on user permissions:

- **Location data** (`latitude`, `longitude`): Requires `stands.location` permission
- **Infrastructure details**: Requires `stands.infrastructure` permission
- **Environmental features**: Requires `stands.environmental` permission
- **Audit fields** (`createdBy`, `updatedBy`): Requires `audit.read` permission

## Security

- All data is encrypted in transit using TLS 1.2+
- Sensitive fields are encrypted at rest
- Row-level security ensures organization data isolation
- Comprehensive audit logging for all operations
- Input validation and sanitization on all endpoints

## Webhooks

The API supports webhooks for real-time notifications:

```json
{
  "event": "stand.created",
  "timestamp": "2025-01-15T10:00:00Z",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "A1",
    "organizationId": "org-123"
  }
}
```

Supported events:
- `stand.created`
- `stand.updated`
- `stand.deleted`
- `import.completed`

## SDK Examples

### JavaScript/TypeScript

```typescript
import { StandAPI } from '@capacity-planner/sdk';

const api = new StandAPI({
  apiKey: 'your-api-key',
  organizationId: 'your-org-id'
});

// List stands
const stands = await api.stands.list({
  page: 1,
  pageSize: 50,
  status: 'operational'
});

// Create stand
const newStand = await api.stands.create({
  code: 'A1',
  name: 'Stand A1',
  terminal: 'Terminal 1'
});

// Update stand
const updated = await api.stands.update(standId, {
  status: 'maintenance',
  version: 1
});
```

### Python

```python
from capacity_planner import StandAPI

api = StandAPI(
    api_key='your-api-key',
    organization_id='your-org-id'
)

# List stands
stands = api.stands.list(
    page=1,
    page_size=50,
    status='operational'
)

# Create stand
new_stand = api.stands.create({
    'code': 'A1',
    'name': 'Stand A1',
    'terminal': 'Terminal 1'
})
```

## Migration Guide

For migrating from the legacy stands API:

1. Update authentication headers
2. Change endpoint URLs from `/v1/stands` to `/api/assets/stands`
3. Update response parsing to handle new paginated format
4. Add version field for update operations
5. Handle soft delete instead of hard delete

## Support

For API support, please contact:
- Email: api-support@capacity-planner.com
- Documentation: https://docs.capacity-planner.com/api/stands
- Status Page: https://status.capacity-planner.com