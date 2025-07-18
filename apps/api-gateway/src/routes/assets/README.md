# Stand Capabilities API Documentation

## Overview

This API provides endpoints for managing stand capabilities, maintenance records, and adjacency relationships within the CapaCity Planner system.

## Authentication & Authorization

All endpoints require the following headers:
- `x-organization-id`: The organization ID for data isolation
- `x-user-id`: The user ID for audit trails (required for write operations)

## Base URL

All endpoints are prefixed with `/api/v1/assets/stands`

## Stand Capabilities Endpoints

### Get Stand Capabilities

**GET** `/stands/:id/capabilities`

Retrieves the capabilities for a specific stand.

**Parameters:**
- `id` (path): Stand ID

**Response:**
```json
{
  "success": true,
  "data": {
    "stand": {
      "id": "stand-123",
      "identifier": "A01",
      "capabilities": {
        "dimensions": {
          "length": 60,
          "width": 45,
          "icaoCategory": "C"
        },
        "aircraftCompatibility": {
          "supportedAircraftTypes": ["A320", "B737"],
          "maxWingspan": 36,
          "maxLength": 38,
          "maxWeight": 79000
        },
        "groundSupport": {
          "hasPowerSupply": true,
          "hasAirConditioning": true,
          "hasJetbridge": true
        }
      }
    }
  }
}
```

### Update Stand Capabilities

**PUT** `/stands/:id/capabilities`

Updates the complete capabilities for a stand.

**Parameters:**
- `id` (path): Stand ID

**Request Body:**
```json
{
  "dimensions": {
    "length": 60,
    "width": 45,
    "icaoCategory": "C"
  },
  "aircraftCompatibility": {
    "supportedAircraftTypes": ["A320", "B737"],
    "maxWingspan": 36,
    "maxLength": 38,
    "maxWeight": 79000
  },
  "groundSupport": {
    "hasPowerSupply": true,
    "hasAirConditioning": true,
    "hasJetbridge": true
  }
}
```

### Update Specific Capability Type

**PATCH** `/stands/:id/capabilities/:type`

Updates a specific capability type for a stand.

**Parameters:**
- `id` (path): Stand ID
- `type` (path): Capability type (`dimensions`, `aircraftCompatibility`, `groundSupport`, `operationalConstraints`, `environmentalFeatures`, `infrastructure`)

**Request Body:**
```json
{
  "hasPowerSupply": true,
  "hasAirConditioning": true,
  "hasJetbridge": false
}
```

### Bulk Update Capabilities

**POST** `/stands/capabilities/bulk-update`

Updates capabilities for multiple stands in a single operation.

**Request Body:**
```json
{
  "operations": [
    {
      "standId": "stand-123",
      "capabilities": {
        "dimensions": {
          "length": 60,
          "width": 45
        }
      }
    },
    {
      "standId": "stand-456",
      "capabilities": {
        "groundSupport": {
          "hasPowerSupply": false
        }
      }
    }
  ]
}
```

### Validate Capabilities

**POST** `/stands/capabilities/validate`

Validates capability configuration without persisting changes.

**Request Body:**
```json
{
  "dimensions": {
    "length": 60,
    "width": 45,
    "icaoCategory": "C"
  }
}
```

### Query Stands by Capabilities

**GET** `/stands/capabilities/query`

Searches for stands matching specific capability criteria.

**Query Parameters:**
- `icaoCategory`: ICAO aircraft category (A, B, C, D, E, F)
- `hasJetbridge`: Boolean for jetbridge availability
- `minLength`: Minimum stand length
- `maxLength`: Maximum stand length
- `minWidth`: Minimum stand width
- `maxWidth`: Maximum stand width
- `groundSupportType`: Type of ground support equipment
- `limit`: Maximum results (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

### Get Capability History

**GET** `/stands/:id/capabilities/history`

Retrieves the capability change history for a stand.

**Parameters:**
- `id` (path): Stand ID

**Query Parameters:**
- `limit`: Maximum results (default: 20)

### Get Capability Statistics

**GET** `/stands/capabilities/statistics`

Retrieves capability statistics for the organization.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalStands": 150,
    "byIcaoCategory": {
      "A": 20,
      "B": 40,
      "C": 60,
      "D": 25,
      "E": 5
    },
    "validationMetrics": {
      "cacheHitRate": 0.85,
      "totalValidations": 1250,
      "cacheErrors": 2
    }
  }
}
```

### Rollback Capabilities

**POST** `/stands/:id/capabilities/rollback`

Rollback capabilities to a previous snapshot.

**Parameters:**
- `id` (path): Stand ID

**Request Body:**
```json
{
  "snapshotId": "snapshot-123",
  "reason": "Reverting incorrect configuration"
}
```

## Maintenance Endpoints

### Get Maintenance History

**GET** `/stands/:id/maintenance`

Retrieves maintenance history for a specific stand.

**Parameters:**
- `id` (path): Stand ID

**Query Parameters:**
- `limit`: Maximum results (default: 20)

### Schedule Maintenance

**POST** `/stands/:id/maintenance`

Schedules new maintenance for a stand.

**Parameters:**
- `id` (path): Stand ID

**Request Body:**
```json
{
  "type": "Routine Inspection",
  "description": "Monthly safety inspection",
  "scheduledStart": "2024-02-01T08:00:00Z",
  "scheduledEnd": "2024-02-01T12:00:00Z",
  "priority": "MEDIUM",
  "estimatedCost": 5000,
  "requiredSkills": ["electrical", "mechanical"],
  "requiredEquipment": ["lift", "tools"]
}
```

### Update Maintenance Record

**PUT** `/stands/:id/maintenance/:recordId`

Updates an existing maintenance record.

**Parameters:**
- `id` (path): Stand ID
- `recordId` (path): Maintenance record ID

**Request Body:**
```json
{
  "status": "COMPLETED",
  "actualStart": "2024-02-01T08:15:00Z",
  "actualEnd": "2024-02-01T11:45:00Z",
  "completionNotes": "All checks completed successfully",
  "actualCost": 4500
}
```

### Get Maintenance Schedule

**GET** `/stands/maintenance/schedule`

Retrieves maintenance schedule for a date range.

**Query Parameters:**
- `startDate`: Start date (ISO 8601 format)
- `endDate`: End date (ISO 8601 format)

### Get Maintenance Statistics

**GET** `/stands/maintenance/statistics`

Retrieves maintenance statistics for the organization.

**Query Parameters:**
- `startDate`: Start date for statistics (optional)
- `endDate`: End date for statistics (optional)

### Get Maintenance Alerts

**GET** `/stands/maintenance/alerts`

Retrieves upcoming maintenance alerts.

**Query Parameters:**
- `daysBefore`: Number of days before scheduled maintenance (default: 7)

## Adjacency Endpoints

### Create Adjacency Relationship

**POST** `/stands/adjacency`

Creates a new adjacency relationship between two stands.

**Request Body:**
```json
{
  "standId": "stand-123",
  "adjacentStandId": "stand-456",
  "distance": 75,
  "impactLevel": "MEDIUM",
  "operationalConstraints": ["taxi_conflict", "noise_overlap"],
  "notes": "Shared taxiway access"
}
```

### Update Adjacency Relationship

**PUT** `/stands/adjacency/:adjacencyId`

Updates an existing adjacency relationship.

**Parameters:**
- `adjacencyId` (path): Adjacency relationship ID

**Request Body:**
```json
{
  "distance": 80,
  "impactLevel": "LOW",
  "operationalConstraints": ["taxi_conflict"]
}
```

### Delete Adjacency Relationship

**DELETE** `/stands/adjacency/:adjacencyId`

Deletes an adjacency relationship.

**Parameters:**
- `adjacencyId` (path): Adjacency relationship ID

### Get Adjacency Impact Analysis

**GET** `/stands/:id/adjacency/impact`

Retrieves impact analysis for a stand's adjacencies.

**Parameters:**
- `id` (path): Stand ID

**Response:**
```json
{
  "success": true,
  "data": {
    "standId": "stand-123",
    "adjacentStands": [
      {
        "standId": "stand-456",
        "standIdentifier": "A02",
        "distance": 75,
        "impactLevel": "MEDIUM",
        "operationalConstraints": ["taxi_conflict"]
      }
    ],
    "totalImpactScore": 8,
    "riskFactors": ["Multiple high-impact adjacent stands"],
    "recommendations": ["Consider reducing high-impact adjacencies"]
  }
}
```

### Get Adjacency Network

**GET** `/stands/adjacency/network`

Retrieves the complete adjacency network for visualization.

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "stand-123",
        "identifier": "A01",
        "type": "stand",
        "properties": {
          "dimensions": { "length": 60, "width": 45 }
        }
      }
    ],
    "edges": [
      {
        "source": "stand-123",
        "target": "stand-456",
        "distance": 75,
        "impactLevel": "MEDIUM",
        "operationalConstraints": ["taxi_conflict"]
      }
    ]
  }
}
```

### Get Adjacency Optimization

**GET** `/stands/adjacency/optimization`

Retrieves optimization recommendations for adjacency configuration.

### Find Alternative Stands

**GET** `/stands/:id/adjacency/alternatives`

Finds alternative stands considering adjacency constraints.

**Parameters:**
- `id` (path): Original stand ID

**Query Parameters:**
- `minDistance`: Minimum distance requirement
- `maxImpactLevel`: Maximum acceptable impact level
- `requiredCapabilities`: Required capability types

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details or validation errors",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## HTTP Status Codes

- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `400 Bad Request`: Invalid request parameters or body
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation errors
- `500 Internal Server Error`: Server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per time window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Caching

Responses include caching headers:
- `Cache-Control`: Caching directives
- `ETag`: Entity tag for cache validation
- `Last-Modified`: Last modification timestamp