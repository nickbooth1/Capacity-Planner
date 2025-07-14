# CapaCity Planner

[![CI](https://github.com/nick/CapaCity-Planner/actions/workflows/ci.yml/badge.svg)](https://github.com/nick/CapaCity-Planner/actions/workflows/ci.yml)
[![Docker Build](https://github.com/nick/CapaCity-Planner/actions/workflows/docker-build.yml/badge.svg)](https://github.com/nick/CapaCity-Planner/actions/workflows/docker-build.yml)

Airport capacity management platform for tracking and scheduling maintenance work on airport assets.

## Technology Stack

- **Monorepo**: Nx with pnpm workspaces
- **Frontend**: Next.js (React)
- **Backend**: Node.js with Express/Nest.js
- **Database**: PostgreSQL
- **Package Manager**: pnpm

## Project Structure

```
capacity-planner/
├── apps/                   # Applications
│   ├── api-gateway/       # Backend API gateway
│   └── web/               # Next.js frontend
├── packages/              # Shared libraries and modules
│   ├── shared-kernel/     # Common utilities and types
│   ├── assets-module/     # Asset management functionality
│   ├── work-module/       # Work scheduling functionality
│   └── entitlement-service/ # Module access control
├── 1.Docs/                # Project documentation
└── tools/                 # Build and deployment tools
```

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 9.x or higher

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm start
```

## Development

### Commands

- `pnpm lint` - Run linting across all projects
- `pnpm test` - Run tests across all projects
- `pnpm build` - Build all projects
- `pnpm affected:lint` - Lint only affected projects
- `pnpm affected:test` - Test only affected projects

### Module Boundaries

The project enforces strict module boundaries:
- `shared-kernel` can be imported by any module
- Modules cannot import from each other directly
- Apps can import from any module or service

### Commit Hooks

This project uses Husky for Git hooks:
- Pre-commit: Runs linting and formatting on staged files

## Architecture

The system follows a modular monolith architecture:
- Each module has its own PostgreSQL schema
- Modules communicate via events (Postgres LISTEN/NOTIFY)
- Entitlement service controls module access per organization
- Can be split into microservices in the future