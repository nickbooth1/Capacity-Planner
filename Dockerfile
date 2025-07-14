# Simple Dockerfile for Railway
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./

# Create package directories
RUN mkdir -p packages/shared-kernel packages/entitlement-service packages/assets-module packages/work-module

# Copy package.json files for packages only
COPY packages/shared-kernel/package.json ./packages/shared-kernel/
COPY packages/entitlement-service/package.json ./packages/entitlement-service/
COPY packages/assets-module/package.json ./packages/assets-module/
COPY packages/work-module/package.json ./packages/work-module/

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