#!/bin/bash

# Prepare for Production Deployment
# =================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Production Deployment Preparation${NC}"
echo "================================="

# Check if we have the Supabase keys
echo -e "\n${YELLOW}Checking configuration...${NC}"

if [ ! -f ".env.production" ]; then
    echo -e "${RED}✗ .env.production file not found${NC}"
    exit 1
fi

# Source the env file to check values
set -a
source .env.production
set +a

# Check required environment variables
MISSING_VARS=()

if [[ "$SUPABASE_ANON_KEY" == *"YOUR-PRODUCTION"* ]]; then
    MISSING_VARS+=("SUPABASE_ANON_KEY")
fi

if [[ "$SUPABASE_SERVICE_KEY" == *"YOUR-PRODUCTION"* ]]; then
    MISSING_VARS+=("SUPABASE_SERVICE_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo -e "\n${YELLOW}Please get these from:${NC}"
    echo "  1. Go to Supabase Dashboard"
    echo "  2. Select your production project (xwyzzwaxaciuspjwdmbn)"
    echo "  3. Go to Settings → API"
    echo "  4. Copy the 'anon' and 'service_role' keys"
    exit 1
fi

echo -e "${GREEN}✓ All required variables configured${NC}"

# Generate additional secure values
echo -e "\n${YELLOW}Generating secure values...${NC}"

JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

echo -e "${GREEN}✓ Generated JWT secret${NC}"
echo -e "${GREEN}✓ Generated encryption key${NC}"

# Create the Railway variables file
echo -e "\n${YELLOW}Creating Railway environment variables...${NC}"

cat > railway-env-production.txt <<EOF
# Copy and paste these into Railway Dashboard
# Project: capacity-planner-prod
# Environment: production

DATABASE_URL=$DATABASE_URL
PGSSLMODE=$PGSSLMODE

SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_PROJECT_REF=$SUPABASE_PROJECT_REF

NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info

JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

ALLOWED_ORIGINS=https://capacity-planner-nine.vercel.app,https://capacity-planner.com,https://app.capacity-planner.com

# Redis (if using Railway Redis)
REDIS_URL=\${{REDIS_URL}}

# Feature flags
ENABLE_RATE_LIMITING=true
ENABLE_HEALTH_CHECKS=true
ENABLE_METRICS=true
EOF

echo -e "${GREEN}✓ Created railway-env-production.txt${NC}"

# Create deployment checklist
echo -e "\n${YELLOW}Creating deployment checklist...${NC}"

cat > deployment-checklist.txt <<EOF
Production Deployment Checklist
==============================

[ ] 1. Supabase Production Database
    [✓] Database created and migrations run
    [✓] Initial data seeded
    [ ] Backup schedule configured
    [ ] Point-in-time recovery enabled

[ ] 2. Railway Configuration
    [ ] Create new service in Railway project
    [ ] Copy environment variables from railway-env-production.txt
    [ ] Connect GitHub repository to main branch
    [ ] Configure custom domain (api.capacity-planner.com)
    [ ] Enable automatic deployments

[ ] 3. Vercel Configuration
    [ ] Update environment variables:
        - NEXT_PUBLIC_API_URL=https://your-railway-domain.up.railway.app
        - NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
        - NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
    [ ] Ensure production branch is 'main'
    [ ] Configure domain (if not done)

[ ] 4. GitHub Repository
    [ ] Create production branch protection rules
    [ ] Require PR reviews before merge to main
    [ ] Set up GitHub secrets for CI/CD

[ ] 5. Monitoring
    [ ] Set up error tracking (Sentry)
    [ ] Configure uptime monitoring
    [ ] Set up alerts

[ ] 6. Security
    [ ] Review all environment variables
    [ ] Ensure no secrets in code
    [ ] Test authentication flow
    [ ] Verify CORS settings

[ ] 7. Testing
    [ ] Run full test suite
    [ ] Test API endpoints manually
    [ ] Verify database connectivity
    [ ] Check health endpoints

[ ] 8. DNS Configuration
    [ ] Point api.capacity-planner.com to Railway
    [ ] Verify SSL certificates
    [ ] Test domain resolution

[ ] 9. Documentation
    [ ] Update README with production URLs
    [ ] Document deployment process
    [ ] Create incident response plan

[ ] 10. Go Live
    [ ] Deploy to Railway
    [ ] Monitor logs for errors
    [ ] Test all critical paths
    [ ] Announce go-live to team
EOF

echo -e "${GREEN}✓ Created deployment-checklist.txt${NC}"

echo -e "\n${GREEN}✅ Production deployment preparation complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Get the missing Supabase keys and update .env.production"
echo "2. Run this script again to generate the Railway variables"
echo "3. Follow the deployment-checklist.txt"
echo -e "\n${BLUE}Files created:${NC}"
echo "  - railway-env-production.txt (Railway environment variables)"
echo "  - deployment-checklist.txt (Step-by-step checklist)"