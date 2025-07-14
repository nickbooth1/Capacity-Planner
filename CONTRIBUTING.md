# Contributing to CapaCity Planner

Thank you for considering contributing to CapaCity Planner! This document provides guidelines and information for contributors.

## Table of Contents

- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Pull Request Process](#pull-request-process)
- [Commit Messages](#commit-messages)

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- pnpm 10.13.1 or higher
- Docker and Docker Compose
- PostgreSQL client tools (optional, for direct DB access)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/capacity-planner.git
cd capacity-planner

# Install dependencies
pnpm install

# Start the development database
pnpm docker:db:up

# Generate Prisma clients
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate:dev

# Start development servers
pnpm dev
```

## Development Workflow

### Branch Strategy

We use a feature branch workflow:

1. Create a feature branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit regularly
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Push your branch and create a pull request
   ```bash
   git push -u origin feature/your-feature-name
   ```

### Using Nx Affected Commands

To improve development efficiency, use Nx affected commands:

```bash
# Lint only affected projects
pnpm affected:lint

# Test only affected projects
pnpm affected:test

# Build only affected projects
pnpm nx affected --target=build
```

## Code Style

### Linting

We use ESLint for code linting:

```bash
# Lint all projects
pnpm lint

# Lint a specific project
pnpm nx lint api-gateway
```

### Formatting

Prettier is configured for consistent code formatting:

```bash
# Format staged files (automatic via git hooks)
# Manual formatting
pnpm prettier --write "apps/**/*.{ts,tsx,js,jsx,json}"
```

### TypeScript

- Use TypeScript for all new code
- Maintain strict type safety
- Avoid `any` types unless absolutely necessary
- Document complex types with JSDoc comments

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific project
pnpm nx test api-gateway

# Run tests in watch mode
pnpm nx test api-gateway --watch

# Run tests with coverage
pnpm nx test api-gateway --coverage
```

### Integration Tests

Integration tests should be placed in `__tests__` directories within each app/package.

### E2E Tests

E2E tests are located in `apps/e2e` (when implemented) and can be run with:

```bash
pnpm nx e2e e2e
```

## CI/CD Pipeline

Our CI/CD pipeline runs on GitHub Actions and includes:

### Continuous Integration (CI)

The CI workflow (`ci.yml`) runs on every pull request and push to main:

1. **Setup**: Installs dependencies and determines affected projects
2. **Lint**: Runs ESLint on affected projects
3. **Test**: Runs Jest tests on affected projects (parallelized across 3 shards)
4. **Build**: Builds affected projects and generates Prisma clients
5. **Security Scan**: Runs security audit on dependencies

### Docker Build Pipeline

The Docker build workflow (`docker-build.yml`) handles containerization:

1. **Change Detection**: Identifies which apps need rebuilding
2. **Multi-platform Build**: Builds images for linux/amd64 and linux/arm64
3. **Registry Push**: Pushes images to GitHub Container Registry (ghcr.io)
4. **Vulnerability Scan**: Scans images with Trivy for security issues

### Triggering Workflows

- **CI**: Automatically triggered on PR and main branch pushes
- **Docker Build**: Triggered on main branch pushes and can be manually triggered
- **Manual Trigger**: Use workflow_dispatch for on-demand builds

## Pull Request Process

### Before Submitting

1. Ensure all tests pass locally:
   ```bash
   pnpm affected:test
   pnpm affected:lint
   ```

2. Update documentation if needed

3. Add tests for new functionality

4. Ensure your branch is up to date with main:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

### PR Requirements

- **Title**: Use conventional commit format (e.g., "feat: add user authentication")
- **Description**: Clearly describe what changes were made and why
- **Tests**: Include tests for new functionality
- **Documentation**: Update relevant documentation
- **Screenshots**: Include screenshots for UI changes

### Review Process

1. At least one approval is required before merging
2. All CI checks must pass
3. All conversations must be resolved
4. Branch must be up to date with main

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes that don't modify src or test files

### Examples

```bash
# Feature
feat(api-gateway): add user authentication endpoint

# Bug fix
fix(web): resolve navigation menu overflow issue

# Documentation
docs: update API documentation with new endpoints

# Performance
perf(assets-module): optimize database queries for asset lookup
```

## Getting Help

- Create an issue for bugs or feature requests
- Join our Discord server (link in README)
- Check existing issues and PRs before creating new ones

## License

By contributing to CapaCity Planner, you agree that your contributions will be licensed under the same license as the project (MIT).