# Database Setup Guide

This guide explains the database architecture and setup process for the CapaCity Planner project.

## Architecture Overview

The project uses a multi-tenant PostgreSQL database with separate schemas for each module:

- **public schema**: Core entities (organizations, users)
- **entitlement schema**: Module access control
- **assets schema**: Aircraft stands and other assets
- **work schema**: Work requests and approvals

## Prerequisites

- PostgreSQL 16+ installed locally or Docker
- Node.js 18+ and pnpm installed

## Quick Start

### 1. Start PostgreSQL with Docker

```bash
# Start the database container
pnpm docker:up

# Check logs to ensure it's running
pnpm docker:logs
```

### 2. Generate Prisma Clients

```bash
# Generate TypeScript types for all modules
pnpm prisma:generate
```

### 3. Run Migrations

```bash
# This will create all schemas and tables
pnpm prisma:migrate:dev
```

When prompted for migration names, use:
- shared-kernel: `init_public_schema`
- entitlement-service: `init_entitlement_schema`
- assets-module: `init_assets_schema`
- work-module: `init_work_schema`

### 4. Seed the Database

```bash
# Populate with Manchester Airport test data
pnpm db:seed
```

## Manual Database Setup (Without Docker)

If you prefer to use an existing PostgreSQL installation:

1. Create the database:
```sql
CREATE DATABASE capacity_planner;
```

2. Run the initialization script:
```bash
psql -U postgres -h localhost -f scripts/init-database.sql
```

3. Update DATABASE_URL in each module's .env file if needed

## Module-Specific Information

### Shared Kernel
- Location: `packages/shared-kernel/prisma/schema.prisma`
- Tables: organizations, users
- Seeds: Manchester Airport (MAN) and London Heathrow (LHR) organizations

### Entitlement Service
- Location: `packages/entitlement-service/prisma/schema.prisma`
- Tables: entitlements, entitlement_audits
- Seeds: Module access for MAN (all modules) and LHR (assets, work only)

### Assets Module
- Location: `packages/assets-module/prisma/schema.prisma`
- Tables: stands, stand_status_history, asset_types, assets
- Seeds: 28 stands for Manchester Airport with realistic terminal layout

### Work Module
- Location: `packages/work-module/prisma/schema.prisma`
- Tables: work_requests, work_request_status_history, work_request_comments, etc.
- Seeds: Sample work requests in various states

## Common Commands

```bash
# View database in psql
psql -U postgres -h localhost -d capacity_planner

# List all schemas
\dn

# View tables in a schema
\dt assets.*

# Reset database completely
pnpm docker:reset

# Generate migrations without applying
cd packages/<module-name>
npx prisma migrate dev --create-only

# Apply existing migrations
cd packages/<module-name>
npx prisma migrate deploy
```

## Environment Variables

Each module has its own `.env` file with the appropriate schema:

```bash
# shared-kernel
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/capacity_planner?schema=public"

# entitlement-service
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/capacity_planner?schema=entitlement"

# assets-module
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/capacity_planner?schema=assets"

# work-module
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/capacity_planner?schema=work"
```

## Troubleshooting

### "Database does not exist" error
Run `pnpm docker:up` or create the database manually

### "Schema does not exist" error
Run `pnpm db:init` to create all schemas

### Migration conflicts
Reset the database with `pnpm docker:reset` and re-run migrations

### Type generation issues
Ensure you run `pnpm prisma:generate` after any schema changes