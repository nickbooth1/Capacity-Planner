# Deployment Workflow & Branching Strategy

## Overview

This document outlines the deployment workflow and branching strategy for the CapaCity Planner application. We use a Git-based deployment pipeline with automatic deployments triggered by pushes to specific branches.

## Branch Structure

```
main ─────────────────────► Production Environment
 │
 └── develop ──────────────► Staging Environment
      │
      └── feature/* ───────► Local Development
```

## Environments

### 1. Local Development
- **Branch:** Feature branches (`feature/*`)
- **URL:** http://localhost:4200
- **Database:** Local PostgreSQL in Docker
- **Purpose:** Active development and testing

### 2. Staging Environment
- **Branch:** `develop`
- **Trigger:** Push to `develop` branch
- **Purpose:** Integration testing, UAT, demo to stakeholders
- **Database:** Staging database (separate from production)
- **Features:**
  - Mirrors production environment
  - Safe for testing new features
  - Used for final validation before production

### 3. Production Environment
- **Branch:** `main`
- **Trigger:** Push to `main` branch
- **Purpose:** Live application for end users
- **Database:** Production database
- **Features:**
  - Stable, tested code only
  - Monitored and backed up
  - High availability

## Deployment Process

### 1. Feature Development
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/stand-management

# Make changes and commit
git add .
git commit -m "feat: implement stand CRUD operations"

# Push feature branch
git push origin feature/stand-management
```

### 2. Deploy to Staging
```bash
# Merge feature to develop (via PR or directly)
git checkout develop
git merge feature/stand-management
git push origin develop

# ✅ Automatically deploys to STAGING
```

### 3. Deploy to Production
```bash
# After staging validation, merge develop to main
git checkout main
git pull origin main
git merge develop
git push origin main

# ✅ Automatically deploys to PRODUCTION
```

## Best Practices

### Branch Naming Conventions
- `feature/` - New features (e.g., `feature/stand-management`)
- `fix/` - Bug fixes (e.g., `fix/dialog-overlay`)
- `hotfix/` - Urgent production fixes (e.g., `hotfix/api-error`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### Commit Message Format
Follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Maintenance tasks

Example:
```
feat: add stand CRUD operations

- Implement create, read, update, delete for stands
- Add form validation with Zod
- Include soft delete functionality
```

### Pull Request Process
1. Create PR from feature branch to `develop`
2. Code review required
3. All tests must pass
4. Merge to `develop`
5. Validate in staging
6. Create PR from `develop` to `main`
7. Final approval required
8. Merge to `main` for production deployment

## Rollback Procedures

### Staging Rollback
```bash
# Revert last commit on develop
git checkout develop
git revert HEAD
git push origin develop
```

### Production Rollback
```bash
# Option 1: Revert last commit
git checkout main
git revert HEAD
git push origin main

# Option 2: Reset to previous commit (use with caution)
git checkout main
git reset --hard <previous-commit-hash>
git push --force origin main
```

## Environment Variables

Each environment has its own configuration:

### Local
- `.env.local`
- Database: `postgresql://localhost:5432/capacity_planner`
- API: `http://localhost:3001`

### Staging
- `.env.staging`
- Database: Staging database URL
- API: Staging API URL

### Production
- `.env.production`
- Database: Production database URL
- API: Production API URL

## CI/CD Pipeline

### Staging Pipeline (develop branch)
1. Run tests
2. Build application
3. Run database migrations
4. Deploy to staging servers
5. Run smoke tests
6. Send notification

### Production Pipeline (main branch)
1. Run tests
2. Build application
3. Create backup of current production
4. Run database migrations
5. Deploy to production servers
6. Run smoke tests
7. Monitor for errors
8. Send notification

## Database Migrations

### Staging
```bash
# Migrations run automatically on deploy
# Manual migration if needed:
npm run prisma:migrate:deploy
```

### Production
```bash
# Always backup before migrations
# Migrations run automatically on deploy
# Manual migration if needed:
npm run prisma:migrate:deploy
```

## Monitoring

### What to Check After Deployment
1. Application loads correctly
2. API endpoints respond
3. Database connections are healthy
4. No console errors in browser
5. Key features work (e.g., stand management)

### Staging Checks
- Basic functionality testing
- Performance testing
- Integration testing
- User acceptance testing

### Production Checks
- Health check endpoints
- Error monitoring (Sentry, etc.)
- Performance metrics
- User reports

## Emergency Contacts

- **DevOps Lead:** [Contact info]
- **Database Admin:** [Contact info]
- **On-Call Engineer:** [Contact info]

## Related Documentation

- [Local Development Environment](./local-development-environment.md)
- [API Documentation](./api-documentation.md)
- [Database Schema](../packages/assets-module/prisma/schema.prisma)