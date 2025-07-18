# Local Development Environment Reference

## Overview

This document outlines the local development environment setup for the CapaCity Planner application. The environment consists of three main components running on different ports.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend API    │     │   PostgreSQL    │
│   (Next.js)     │────▶│   (Express)      │────▶│   Database      │
│   Port: 4200    │     │   Port: 3001     │     │   Port: 5432    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Components

### 1. Frontend - Next.js Application
- **Port:** 4200
- **URL:** http://localhost:4200
- **Location:** `/apps/web`
- **Start Command:** `PORT=4200 npm run dev:web`
- **Technology:** Next.js 15.2.5, React, TypeScript
- **Purpose:** User interface for the CapaCity Planner application

### 2. Backend API - Express Server
- **Port:** 3001
- **URL:** http://localhost:3001
- **File:** `/simple-db-api.js`
- **Start Command:** `node simple-db-api.js`
- **Technology:** Express.js, Prisma ORM
- **Purpose:** Simplified API layer for database operations
- **Endpoints:**
  - `GET /api/stands` - List all stands with pagination
  - `GET /api/stands/:id` - Get single stand
  - `POST /api/stands` - Create new stand
  - `PUT /api/stands/:id` - Update stand
  - `DELETE /api/stands/:id` - Soft delete stand

### 3. Database - PostgreSQL
- **Port:** 5432
- **Container Name:** `capacity-planner-db`
- **Running In:** Docker
- **Start Command:** `docker compose -f docker-compose.dev.yml up -d postgres`
- **Connection String:** `postgresql://postgres:postgres@localhost:5432/capacity_planner`
- **Initial Data:** Manchester Airport stands (23 stands across 3 terminals)

## Starting the Environment

### Step 1: Start PostgreSQL
```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

### Step 2: Start the Backend API
```bash
node simple-db-api.js
```

### Step 3: Start the Frontend
```bash
PORT=4200 npm run dev:web
```

## Verifying Services

### Check Running Services
```bash
# Check all listening ports
lsof -i -P | grep LISTEN | grep -E "(node|docker)"

# Check Docker containers
docker ps

# Check specific ports
lsof -i :4200  # Frontend
lsof -i :3001  # API
lsof -i :5432  # Database
```

## Common Issues and Solutions

### Port Already in Use
If a port is already in use, find and kill the process:
```bash
# Find process using port
lsof -ti:PORT_NUMBER

# Kill process
kill -9 $(lsof -ti:PORT_NUMBER)
```

### Database Connection Issues
1. Ensure Docker is running
2. Check PostgreSQL container status: `docker ps`
3. Restart container if needed: `docker restart capacity-planner-db`

### API Not Responding
1. Check if simple-db-api.js is running
2. Check logs in terminal where API was started
3. Verify database connection

## Environment Details

### Database Schema
The PostgreSQL database uses multiple schemas:
- `shared` - Organization and shared entities
- `assets` - Stand management
- `entitlement` - Access control
- `work` - Work management

### Stand Data Structure
Stands include:
- Basic info: code, name, terminal, status
- Capabilities: aircraft size, max weight, power supply, ground support
- Location: latitude, longitude, geometry
- CRUD controls: version, soft delete fields

### Authentication
Currently using mock authentication with:
- Organization: Manchester Airport (MAN)
- User ID: Passed via `X-User-Id` header

## Development Workflow

1. Make changes to frontend code in `/apps/web`
2. Frontend hot-reloads automatically
3. API changes require restarting `simple-db-api.js`
4. Database schema changes require Prisma migrations

## Notes

- The `simple-db-api.js` is a temporary solution created to bypass TypeScript compilation issues in the main API gateway
- Frontend runs on port 4200 (instead of Next.js default 3000) to match enterprise application standards
- All database operations use soft delete pattern with `isDeleted` flag
- Optimistic locking is implemented using `version` field on stands

## Related Documentation

- [Stand Capabilities PRD](./PRD/1.1_Assets_Module.md)
- [Stand CRUD Controls PRD](./PRD/1.1.1.2_Stand_CRUD_Controls.md)
- [Database Schema](../packages/assets-module/prisma/schema.prisma)
- [Docker Configuration](../docker-compose.dev.yml)