# CapaCity Planner Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for building the CapaCity Planner MVP with a foundation-first approach. Each step includes purpose, deliverables, and testing criteria.

---

## Phase 1: Core Infrastructure (Weeks 1-2)

### Step 1.1: Monorepo Setup with Nx and pnpm

**Purpose**: Create the foundational repository structure that enforces module boundaries and enables independent development, testing, and deployment of each module while maintaining code sharing capabilities.

**Deliverables**:
- Git repository with main/develop branches
- Nx workspace configuration
- pnpm workspace setup
- Basic folder structure for apps and packages
- ESLint, Prettier, and TypeScript configurations
- Pre-commit hooks with Husky

**What to Test**:
```bash
# Verify pnpm installation
pnpm --version  # Should show version 8.x or higher

# Verify Nx workspace
npx nx list  # Should show available plugins

# Test workspace boundaries
npx nx graph  # Should show dependency graph visualization

# Verify linting works
pnpm lint  # Should run across all workspaces

# Test that commit hooks work
git commit -m "test"  # Should trigger pre-commit validation
```

**Success Criteria**:
- Can create new packages with `nx generate`
- Module boundaries are enforced (shared-kernel can be imported everywhere, modules cannot import each other)
- All development tools are configured and working

---

### Step 1.2: Create Package Structure

**Purpose**: Establish the modular architecture with clear separation of concerns, allowing each module to be developed, tested, and eventually deployed independently.

**Deliverables**:
```
capacity-planner/
├── apps/
│   ├── api-gateway/        # Express/Nest.js gateway application
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   └── health/
│   │   └── project.json
│   └── web/               # Next.js frontend application
│       ├── pages/
│       ├── styles/
│       └── project.json
├── packages/
│   ├── shared-kernel/     # Shared utilities and types
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   └── project.json
│   ├── assets-module/     # Assets (stands) functionality
│   │   ├── src/
│   │   └── project.json
│   ├── work-module/       # Work scheduling functionality
│   │   ├── src/
│   │   └── project.json
│   └── entitlement-service/  # Module access control
│       ├── src/
│       └── project.json
```

**What to Test**:
```bash
# Build shared-kernel
npx nx build shared-kernel

# Test that assets-module cannot import work-module
# (This should fail with Nx boundary violation)
# Try adding: import { something } from '@capacity-planner/work-module'
# to any file in assets-module

# Verify each package has its own test command
npx nx test shared-kernel
npx nx test assets-module
```

**Success Criteria**:
- Each package builds independently
- Nx enforces module boundaries
- Shared-kernel is accessible from all modules
- Basic health check endpoint works in api-gateway

---

### Step 1.3: Database Schema Design

**Purpose**: Establish the database structure that supports multi-tenancy, module isolation, and future scalability without requiring schema changes when adding new modules.

**Deliverables**:
- Prisma setup in each module
- Database schema definitions:
  - `public` schema: organizations, users
  - `entitlement` schema: module access control
  - `assets` schema: stands and related tables
  - `work` schema: work requests and approvals
- Migration files for initial schema
- Seed scripts for development data

**Database Structure**:
```sql
-- public schema
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    code VARCHAR(10),  -- IATA code
    created_at TIMESTAMP
);

-- entitlement schema
CREATE TABLE entitlements (
    organization_id UUID,
    module_key VARCHAR(50),  -- 'assets', 'work', 'capacity'
    status VARCHAR(20),      -- 'active', 'suspended'
    valid_until DATE,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP
);

-- assets schema
CREATE TABLE stands (
    id UUID PRIMARY KEY,
    organization_id UUID,
    code VARCHAR(20),
    name VARCHAR(255),
    geometry JSONB,  -- GeoJSON for map display
    capabilities JSONB,
    status VARCHAR(50)
);

-- work schema
CREATE TABLE work_requests (
    id UUID PRIMARY KEY,
    organization_id UUID,
    asset_id UUID,
    requested_by UUID,
    status VARCHAR(50),
    start_date DATE,
    end_date DATE,
    description TEXT
);
```

**What to Test**:
```bash
# Generate Prisma client
pnpm prisma generate --schema=packages/entitlement-service/prisma/schema.prisma

# Run migrations locally
pnpm prisma migrate dev

# Verify schemas were created
psql -U postgres -d capacity_planner -c "\dn"
# Should show: public, entitlement, assets, work

# Test seed script
pnpm prisma db seed
```

**Success Criteria**:
- All schemas created successfully
- No foreign keys between module schemas
- Seed data includes test organization with entitlements
- Each module can only access its own schema

---

### Step 1.4: Local Development Environment

**Purpose**: Create a consistent, reproducible development environment that mirrors production architecture and allows developers to work offline with hot-reload capabilities.

**Deliverables**:
- `docker-compose.dev.yml` with all services
- Environment variable configuration
- Hot-reload setup for all services
- Development scripts in package.json
- README with setup instructions

**Docker Compose Structure**:
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: capacity_planner
    volumes:
      - ./init-schemas.sql:/docker-entrypoint-initdb.d/
    
  api-gateway:
    build: 
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
    environment:
      - NODE_ENV=development
    command: pnpm nx serve api-gateway
    
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
    command: pnpm nx serve web
```

**What to Test**:
```bash
# Start all services
pnpm docker:up

# Verify all services are running
docker compose ps
# Should show: postgres, api-gateway, web all "Up"

# Test hot-reload
# 1. Change a file in api-gateway
# 2. Should see "Restarting..." in logs
# 3. Changes reflected without manual restart

# Test database connection
curl http://localhost:3000/health
# Should return: {"status": "ok", "database": "connected"}

# Test frontend
open http://localhost:4200
# Should see Next.js default page
```

**Success Criteria**:
- Single command starts entire stack
- All services communicate correctly
- Hot-reload works for both frontend and backend
- Database persists data between restarts
- Can develop without internet connection

---

### Step 1.5: Entitlement Service Implementation

**Purpose**: Build the core authorization system that controls module access per organization, supporting the manual provisioning model without requiring code changes to add/remove module access.

**Deliverables**:
- Entitlement service with CRUD operations
- Middleware for API gateway
- CLI tool for provisioning
- Admin API endpoints
- Integration with all modules

**Core Service Functions**:
```typescript
// packages/entitlement-service/src/index.ts
interface EntitlementService {
  // Check if org has access to module
  hasAccess(orgId: string, moduleKey: string): Promise<boolean>;
  
  // Grant access to module
  grantAccess(orgId: string, moduleKey: string, validUntil?: Date): Promise<void>;
  
  // Revoke access
  revokeAccess(orgId: string, moduleKey: string): Promise<void>;
  
  // List all entitlements for org
  listEntitlements(orgId: string): Promise<Entitlement[]>;
}
```

**CLI Tool**:
```bash
# scripts/provision.ts usage
pnpm provision \
  --org "London Heathrow" \
  --code "LHR" \
  --modules "assets,work" \
  --valid-until "2024-12-31"
```

**What to Test**:
```bash
# Test CLI provisioning
pnpm provision --org "Test Airport" --code "TST" --modules "assets"

# Verify in database
psql -c "SELECT * FROM entitlement.entitlements WHERE organization_id = ..."

# Test API endpoint (should be blocked)
curl http://localhost:3000/api/work/requests \
  -H "X-Organization-Id: <test-org-id>"
# Should return: 403 Forbidden

# Grant work module access
pnpm provision --org-id "<test-org-id>" --add-module "work"

# Test again (should work)
curl http://localhost:3000/api/work/requests \
  -H "X-Organization-Id: <test-org-id>"
# Should return: 200 OK with empty array
```

**Success Criteria**:
- Organizations can be provisioned with specific modules
- API gateway blocks access to unauthorized modules
- Entitlements can be updated without restart
- Audit trail maintained for all changes
- CLI tool works for common operations

---

## Phase 2: CI/CD Pipeline (Week 3)

### Step 2.1: GitHub Actions Setup

**Purpose**: Automate code quality checks, testing, and Docker image building to ensure consistent quality and enable rapid, reliable deployments.

**Deliverables**:
- `.github/workflows/ci.yml` for continuous integration
- `.github/workflows/release.yml` for production deployments
- Docker build configuration per module
- Automated testing pipeline
- Branch protection rules

**CI Workflow Features**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    steps:
      - Checkout code
      - Install dependencies with pnpm
      - Run linting (nx affected:lint)
      - Run tests (nx affected:test)
      - Run e2e tests
      
  build:
    steps:
      - Build affected packages
      - Build Docker images for changed modules
      - Push to GitHub Container Registry
      - Tag with commit SHA
```

**What to Test**:
```bash
# Create a feature branch
git checkout -b test-ci

# Make a change to assets-module
echo "// test" >> packages/assets-module/src/index.ts

# Push and create PR
git add . && git commit -m "test: CI pipeline"
git push origin test-ci

# In GitHub:
# - PR should trigger CI workflow
# - Should see linting, tests, and build steps
# - Should only build assets-module image
# - Check GitHub Container Registry for new image
```

**Success Criteria**:
- CI runs on every push and PR
- Only affected modules are built
- Failed tests block PR merge
- Docker images are versioned with commit SHA
- Build time under 5 minutes for single module change

---

### Step 2.2: Staging Environment Setup

**Purpose**: Create an internet-accessible environment that automatically deploys latest changes for testing and stakeholder review before production release.

**Deliverables**:
- Supabase project for staging database
- Railway configuration for backend services
- Vercel project for frontend
- Environment variable configuration
- Automated deployment pipeline
- Health monitoring setup

**Infrastructure Components**:
- **Database**: Supabase project "capacity-planner-staging"
- **Backend**: Railway service "gateway-staging"
- **Frontend**: Vercel project linked to develop branch
- **Secrets**: GitHub Environments for staging secrets

**What to Test**:
```bash
# After merge to develop branch:

# Check Railway logs
# Should see: "Deployment successful"

# Test staging API
curl https://gateway-staging.railway.app/health
# Should return: {"status": "ok", "environment": "staging"}

# Test database migrations ran
curl https://gateway-staging.railway.app/api/assets/stands \
  -H "X-Organization-Id: <staging-test-org>"
# Should return empty array

# Check Vercel preview
# Visit: https://capacity-planner-staging.vercel.app
# Should see Next.js app with "Staging" indicator
```

**Success Criteria**:
- Pushes to develop auto-deploy to staging
- All services accessible via HTTPS
- Database migrations run automatically
- Environment variables properly configured
- Logs accessible for debugging
- Rollback possible within Railway/Vercel

---

### Step 2.3: Production Environment Setup

**Purpose**: Establish a secure, scalable production environment with proper monitoring, backups, and deployment controls to ensure system reliability.

**Deliverables**:
- Production cloud resources (Supabase, Railway, Vercel)
- Blue-green deployment configuration
- Backup and recovery procedures
- Monitoring and alerting setup
- Production deployment checklist
- Runbook documentation

**Production Safeguards**:
- Manual approval required for production deployments
- Database backups every 6 hours
- Point-in-time recovery enabled
- Health checks before traffic switch
- Automatic rollback on health check failure
- Audit logging for all deployments

**What to Test**:
```bash
# Deployment dry run (without actual deploy)
# 1. Create release PR from develop to main
# 2. Review deployment plan comments
# 3. Check all tests pass

# After approval and merge:

# Monitor deployment
# - Railway should show blue-green switch
# - Old version stays running until health checks pass

# Verify production health
curl https://api.capacity-planner.com/health
# Should return: {"status": "ok", "environment": "production"}

# Test rollback procedure
# In Railway: Click "Rollback" button
# Should revert to previous version within 30 seconds
```

**Success Criteria**:
- Production deployments require explicit approval
- Zero-downtime deployments working
- Rollback takes less than 1 minute
- All production URLs use HTTPS
- Monitoring alerts configured
- Backups tested and recoverable

---

## Phase 3: Admin Tools (Week 4)

### Step 3.1: Admin Portal UI

**Purpose**: Provide internal staff with a web interface to manage customer organizations and module entitlements without requiring database access or technical knowledge.

**Deliverables**:
- Admin section in Next.js app (`/admin/*` routes)
- Authentication for admin users
- Organization management interface
- Entitlement management interface
- Audit log viewer
- User management basics

**Admin Portal Features**:
```typescript
// Key pages to implement:
/admin/login              // Admin authentication
/admin/dashboard          // Overview of all organizations
/admin/organizations      // List and create organizations
/admin/organizations/[id] // Edit specific organization
/admin/entitlements       // Manage module access
/admin/audit-log          // View all system changes
```

**What to Test**:
```bash
# Access admin portal
open http://localhost:4200/admin

# Test authentication
# - Should redirect to login if not authenticated
# - Only users with admin role can access

# Test organization creation
# 1. Click "New Organization"
# 2. Fill form: Name="Test Airport", Code="TST"
# 3. Select modules: assets, work
# 4. Submit

# Verify in database
psql -c "SELECT * FROM public.organizations WHERE code='TST'"
psql -c "SELECT * FROM entitlement.entitlements"

# Test entitlement editing
# 1. Find organization in list
# 2. Toggle capacity module on
# 3. Check audit log shows change
```

**Success Criteria**:
- Admin portal requires authentication
- Can create new organizations
- Can enable/disable modules per organization
- All changes logged with timestamp and user
- Form validation prevents invalid data
- Responsive design works on tablets

---

### Step 3.2: Operational Tooling

**Purpose**: Create command-line tools and scripts for DevOps tasks, bulk operations, and emergency fixes that may be needed before the full admin UI is complete.

**Deliverables**:
- CLI tool for common operations
- Bulk import script for organizations
- Database backup/restore scripts
- Health check aggregator
- Emergency access procedures
- Operations runbook

**CLI Commands**:
```bash
# Package.json scripts
pnpm ops:create-org     # Interactive org creation
pnpm ops:grant-module   # Add module to organization  
pnpm ops:list-orgs      # Show all organizations
pnpm ops:backup         # Backup production database
pnpm ops:health-check   # Check all services
```

**What to Test**:
```bash
# Test bulk import
cat > test-import.csv << EOF
name,code,modules
"Paris Charles de Gaulle",CDG,"assets,work"
"Frankfurt Airport",FRA,"assets,work,capacity"
EOF

pnpm ops:bulk-import test-import.csv

# Verify import
pnpm ops:list-orgs
# Should show both airports with correct modules

# Test health aggregation
pnpm ops:health-check
# Should output:
# ✓ Database: Connected
# ✓ API Gateway: Healthy
# ✓ Frontend: Accessible
# ✓ All systems operational

# Test backup
pnpm ops:backup --output ./backup-test.sql
# Should create backup file with all schemas
```

**Success Criteria**:
- All critical operations possible via CLI
- Bulk operations handle errors gracefully
- Scripts work in both local and production environments
- Clear documentation for each command
- Backup/restore tested and documented
- Health checks cover all critical services

---

## Phase 4: MVP Features (Weeks 5-8)

### Step 4.1: Assets Module - Stand Repository

**Purpose**: Implement the core asset management functionality for aircraft stands, providing CRUD operations and the foundation for all asset types.

**Deliverables**:
- Stand data model implementation
- REST API endpoints for stands
- Admin UI for stand management
- Bulk import functionality
- Data validation rules
- Search and filter capabilities

**API Endpoints**:
```
GET    /api/assets/stands              # List all stands
GET    /api/assets/stands/:id          # Get single stand
POST   /api/assets/stands              # Create stand
PUT    /api/assets/stands/:id          # Update stand
DELETE /api/assets/stands/:id          # Delete stand
POST   /api/assets/stands/bulk-import  # Import from CSV
```

**Stand Data Model**:
```typescript
interface Stand {
  id: string;
  code: string;           // e.g., "A1", "B15"
  name: string;           // e.g., "Alpha 1"
  status: 'operational' | 'maintenance' | 'closed';
  capabilities: {
    aircraftSize: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';  // ICAO codes
    hasPowerSupply: boolean;
    hasGroundSupport: boolean;
    maxWeight: number;      // in tonnes
  };
  geometry: GeoJSON;      // For map display
  organizationId: string;
}
```

**What to Test**:
```bash
# Test API endpoints
# Create a stand
curl -X POST http://localhost:3000/api/assets/stands \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: <test-org>" \
  -d '{
    "code": "A1",
    "name": "Alpha 1",
    "status": "operational",
    "capabilities": {
      "aircraftSize": "C",
      "hasPowerSupply": true
    }
  }'

# List stands
curl http://localhost:3000/api/assets/stands \
  -H "X-Organization-Id: <test-org>"

# Test UI
# 1. Navigate to /assets/stands
# 2. Should see list of stands
# 3. Click "Add Stand"
# 4. Fill form and submit
# 5. Verify stand appears in list

# Test bulk import
# Create CSV file and upload via UI
# Verify all stands imported correctly
```

**Success Criteria**:
- All CRUD operations working
- Data validation enforces required fields
- Only authorized organizations see their stands
- Bulk import handles 1000+ stands
- Search works on code and name
- Changes are audited

---

### Step 4.2: Work Scheduling Module

**Purpose**: Implement the work request and approval workflow system that allows stakeholders to request maintenance windows and asset owners to manage them.

**Deliverables**:
- Work request data model
- Request submission workflow
- Approval/rejection system  
- Status tracking dashboard
- Notification system (email)
- Calendar view of scheduled works

**Work Request Flow**:
```
Draft → Submitted → In Review → {Approved/Rejected/Info Required} → Completed
```

**API Endpoints**:
```
GET    /api/work/requests              # List requests
POST   /api/work/requests              # Create request
PUT    /api/work/requests/:id          # Update request
POST   /api/work/requests/:id/approve  # Approve request
POST   /api/work/requests/:id/reject   # Reject request
GET    /api/work/calendar              # Calendar view
```

**What to Test**:
```bash
# Test request creation
curl -X POST http://localhost:3000/api/work/requests \
  -H "Content-Type: application/json" \
  -H "X-Organization-Id: <org-id>" \
  -H "X-User-Id: <requester-id>" \
  -d '{
    "assetId": "<stand-id>",
    "title": "Runway light maintenance",
    "description": "Replace runway edge lights",
    "startDate": "2024-02-01",
    "endDate": "2024-02-02",
    "impact": "Stand closed for 48 hours"
  }'

# Test approval workflow
# As asset owner:
curl -X POST http://localhost:3000/api/work/requests/<id>/approve \
  -H "X-User-Id: <asset-owner-id>" \
  -d '{"comments": "Approved for overnight work"}'

# Test calendar view
curl http://localhost:3000/api/work/calendar?month=2024-02

# Test UI workflow
# 1. As requester: Submit work request
# 2. As asset owner: See pending request
# 3. Approve/reject with comments
# 4. Verify email notifications sent
```

**Success Criteria**:
- Complete request lifecycle working
- Only asset owners can approve/reject
- Email notifications sent at each status change
- Calendar shows all scheduled works
- Requests linked to specific assets
- Status changes are audited
- Can attach documents to requests

---

### Step 4.3: Integration Features

**Purpose**: Connect the assets and work modules together, implement the visual stand map, and create the unified user experience for the MVP.

**Deliverables**:
- Interactive stand map with status overlay
- Unified dashboard showing assets and work requests
- Cross-module navigation
- Role-based UI elements
- Basic reporting features
- Data export capabilities

**Map Features**:
- Visual representation of all stands
- Color coding by status (operational/maintenance/closed)
- Click stand to see details
- Click stand to create work request
- Real-time status updates

**What to Test**:
```bash
# Test map data endpoint
curl http://localhost:3000/api/assets/stands/map \
  -H "X-Organization-Id: <org-id>"
# Should return GeoJSON with stand data

# Test map UI
# 1. Navigate to /map
# 2. Should see airport layout with stands
# 3. Hover over stand - see tooltip
# 4. Click stand - see details panel
# 5. Click "Request Work" - prefills form

# Test dashboard
# Navigate to /dashboard
# Should see:
# - Asset summary (total stands, by status)
# - Recent work requests
# - Upcoming scheduled works
# - Quick actions based on role

# Test exports
# 1. Go to work requests list
# 2. Click "Export CSV"
# 3. Verify downloaded file has all data
```

**Success Criteria**:
- Map loads and displays all stands
- Map updates when stand status changes
- Dashboard personalizes based on user role
- Navigation between modules is seamless
- All data exportable to CSV
- Mobile responsive design works

---

## Final MVP Validation

### System-Wide Testing Checklist

**Purpose**: Validate that the complete MVP meets all requirements and is ready for first customer deployment.

**Test Scenarios**:

1. **New Customer Onboarding**
   - Create organization via admin portal
   - Grant assets and work modules
   - Create asset owner user
   - Verify login and access

2. **Complete Work Request Flow**
   - Requester submits work request
   - Asset owner receives notification
   - Asset owner approves request
   - Stand status updates on map
   - Work completed and closed

3. **Security Validation**
   - Verify module access control works
   - Test organization data isolation
   - Confirm audit logging complete
   - Check all endpoints require auth

4. **Performance Testing**
   - Load 1000+ stands
   - Submit 50 concurrent requests
   - Verify sub-second response times
   - Test with 10 simultaneous users

**Success Criteria**:
- All user stories from requirements satisfied
- No critical bugs in core workflows
- Performance meets requirements
- Security audit passed
- First customer successfully onboarded
- Operations runbook complete

---

## Next Steps After MVP

Once MVP is validated and first customer is live:

1. **Gather Feedback** - Weekly calls with first customer
2. **Plan Capacity Module** - Design calculation engine
3. **Enhance Map** - Add more visualization options
4. **Mobile App** - If requested by customers
5. **API Documentation** - For potential integrations
6. **Performance Optimization** - Based on real usage

Remember: Each new module (Airfield, Gates, etc.) follows the same pattern as Assets module, just with different data models and business rules.