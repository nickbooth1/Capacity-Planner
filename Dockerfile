# Simple Dockerfile for Railway
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Create package directories and copy package.json files
RUN mkdir -p packages/shared-kernel packages/entitlement-service packages/assets-module packages/work-module
RUN mkdir -p apps/api-gateway apps/web

COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY packages/entitlement-service/package.json ./packages/entitlement-service/
COPY packages/assets-module/package.json ./packages/assets-module/
COPY packages/work-module/package.json ./packages/work-module/
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma clients
RUN pnpm prisma:generate

# Build the application
RUN pnpm nx build api-gateway --configuration=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/apps/api-gateway/main.js"]