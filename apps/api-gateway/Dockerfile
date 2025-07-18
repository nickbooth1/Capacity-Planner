# Production Dockerfile for API Gateway
FROM node:24-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Install dependencies for building
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json tsconfig.base.json ./

# Copy all packages and apps
COPY packages/ ./packages/
COPY apps/api-gateway/ ./apps/api-gateway/

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules

# Generate Prisma clients
RUN pnpm prisma:generate

# Build the application
RUN pnpm nx build api-gateway

# Production stage
FROM node:24-alpine AS runner

RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist/apps/api-gateway ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Set user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "main.js"]