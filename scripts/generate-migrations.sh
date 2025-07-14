#!/bin/bash

# Script to generate Prisma migrations for all modules

echo "Generating Prisma migrations for all modules..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Generate migrations for shared-kernel (public schema)
echo -e "${BLUE}Generating migration for shared-kernel...${NC}"
cd packages/shared-kernel
npx prisma migrate dev --name init_public_schema --create-only
cd ../..

# Generate migrations for entitlement-service
echo -e "${BLUE}Generating migration for entitlement-service...${NC}"
cd packages/entitlement-service
npx prisma migrate dev --name init_entitlement_schema --create-only
cd ../..

# Generate migrations for assets-module
echo -e "${BLUE}Generating migration for assets-module...${NC}"
cd packages/assets-module
npx prisma migrate dev --name init_assets_schema --create-only
cd ../..

# Generate migrations for work-module
echo -e "${BLUE}Generating migration for work-module...${NC}"
cd packages/work-module
npx prisma migrate dev --name init_work_schema --create-only
cd ../..

echo -e "${GREEN}✅ All migrations generated successfully!${NC}"
echo "To apply migrations, run: pnpm migrate:dev"