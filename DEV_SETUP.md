# Development Environment Setup

This guide provides instructions for setting up the CapaCity Planner development environment with Docker and hot reload support.

## Prerequisites

- Docker Desktop installed and running
- Node.js 20+ and pnpm installed
- Git installed
- PostgreSQL client (optional, for direct database access)

## Quick Start

### Option 1: Full Docker Development (Recommended)

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd CapaCity-Planner
   ```

2. Start all services with Docker:
   ```bash
   pnpm docker:up
   ```

3. View logs:
   ```bash
   pnpm docker:logs
   ```

4. Access the applications:
   - Web Frontend: http://localhost:4200
   - API Gateway: http://localhost:3000
   - PostgreSQL: localhost:5432

### Option 2: Hybrid Development (Database in Docker, Apps locally)

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the database:
   ```bash
   pnpm docker:db:up
   ```

3. Set up the database:
   ```bash
   pnpm dev:setup
   ```

4. Start the development servers:
   ```bash
   pnpm dev
   ```

This will concurrently run:
- PostgreSQL database (in Docker)
- API Gateway with hot reload
- Next.js web app with hot reload

## Available Scripts

### Docker Commands

- `pnpm docker:up` - Start all services in Docker
- `pnpm docker:down` - Stop all Docker services
- `pnpm docker:logs` - View logs from all services
- `pnpm docker:reset` - Reset all services and volumes
- `pnpm docker:rebuild` - Rebuild Docker images without cache
- `pnpm docker:db:up` - Start only the PostgreSQL database
- `pnpm docker:db:down` - Stop the PostgreSQL database

### Development Commands

- `pnpm dev` - Run database + all apps locally with hot reload
- `pnpm dev:docker` - Run everything in Docker with hot reload
- `pnpm dev:api` - Run only the API Gateway with hot reload
- `pnpm dev:web` - Run only the web frontend with hot reload
- `pnpm dev:setup` - Initial setup (install deps, start DB, run migrations)

### Database Commands

- `pnpm db:init` - Initialize database schemas
- `pnpm prisma:generate` - Generate Prisma clients for all modules
- `pnpm prisma:migrate:dev` - Run database migrations for all modules
- `pnpm db:seed` - Seed the database with test data

## Environment Configuration

### Local Development (.env.development)

When running apps locally, environment variables are loaded from `.env.development`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/capacity_planner
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Docker Development (.env.docker)

When running in Docker, services use Docker network hostnames:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/capacity_planner
NEXT_PUBLIC_API_URL=http://api-gateway:3000
```

## Hot Reload Configuration

### API Gateway (Express)

The API Gateway uses Nx's built-in watch mode with esbuild for fast rebuilds:
- Changes to TypeScript files trigger automatic rebuilds
- The server restarts automatically on code changes
- Source maps are enabled for debugging

### Web Frontend (Next.js)

The Next.js app runs in development mode with:
- Fast Refresh for instant React component updates
- Automatic page reloads for configuration changes
- Webpack polling enabled for Docker environments

## Service Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Web Frontend  │────▶│   API Gateway   │
│   (Port 4200)   │     │   (Port 3000)   │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   (Port 5432)   │
                        └─────────────────┘
```

## Troubleshooting

### Port Conflicts

If you get port already in use errors:
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :4200
lsof -i :5432

# Stop all Docker containers
docker compose down
docker ps -a | grep capacity-planner | awk '{print $1}' | xargs docker rm -f
```

### Database Connection Issues

1. Ensure PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

2. Check database logs:
   ```bash
   docker compose logs postgres
   ```

3. Reset the database:
   ```bash
   pnpm docker:reset
   ```

### Hot Reload Not Working

1. For Docker on Mac/Windows, ensure file sharing is enabled in Docker Desktop
2. Check that WATCHPACK_POLLING is set to true in Docker environments
3. Restart the affected service:
   ```bash
   docker compose restart api-gateway
   # or
   docker compose restart web
   ```

### Permission Issues

If you encounter permission errors:
```bash
# Fix node_modules permissions
sudo chown -R $(whoami) node_modules

# Or remove and reinstall
rm -rf node_modules
pnpm install
```

## Best Practices

1. **Use Docker for consistency**: The Docker setup ensures all developers have the same environment
2. **Check logs frequently**: Use `pnpm docker:logs` to monitor service health
3. **Clean rebuilds**: If you encounter strange issues, try `pnpm docker:rebuild`
4. **Database migrations**: Always run migrations after pulling new changes
5. **Environment variables**: Never commit `.env` files with sensitive data

## VS Code Integration

Recommended extensions for development:
- Docker
- Prisma
- ESLint
- Prettier
- Nx Console

### Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to API Gateway",
      "port": 9229,
      "restart": true,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app"
    }
  ]
}
```

## Additional Resources

- [Nx Documentation](https://nx.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express Documentation](https://expressjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Documentation](https://docs.docker.com)