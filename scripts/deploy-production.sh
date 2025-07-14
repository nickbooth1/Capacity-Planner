#!/bin/bash

# Production Deployment Script
# ============================
# Handles blue-green deployment with health checks and rollback

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HEALTH_CHECK_URL="https://api.capacity-planner.com/health"
HEALTH_CHECK_TIMEOUT=30
HEALTH_CHECK_RETRIES=10
TRAFFIC_MIGRATION_STEPS=(10 50 100)
TRAFFIC_MIGRATION_WAIT=(300 600 0)  # Wait times in seconds

echo -e "${BLUE}Production Deployment Script${NC}"
echo "============================"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    # Check if on main branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "main" ]; then
        echo -e "${RED}✗ Not on main branch (current: $CURRENT_BRANCH)${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ On main branch${NC}"
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${RED}✗ Uncommitted changes detected${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ No uncommitted changes${NC}"
    
    # Check if up to date with remote
    git fetch origin main
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    if [ "$LOCAL" != "$REMOTE" ]; then
        echo -e "${RED}✗ Local branch not up to date with remote${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Up to date with remote${NC}"
}

# Run pre-deployment checks
pre_deployment_checks() {
    echo -e "\n${YELLOW}Running pre-deployment checks...${NC}"
    
    # Check staging health
    echo -n "Checking staging environment health... "
    if curl -sf https://gateway-staging.railway.app/health > /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Staging health check failed (non-critical)${NC}"
    fi
    
    # Check production health
    echo -n "Checking current production health... "
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Current production unhealthy!${NC}"
        echo -n "Continue anyway? (y/N): "
        read -r response
        if [ "$response" != "y" ]; then
            exit 1
        fi
    fi
    
    # Run tests
    echo "Running test suite..."
    if pnpm test:ci; then
        echo -e "${GREEN}✓ All tests passed${NC}"
    else
        echo -e "${RED}✗ Tests failed${NC}"
        exit 1
    fi
}

# Create deployment record
create_deployment_record() {
    local version=$1
    local commit_sha=$2
    
    cat > /tmp/deployment_record.json <<EOF
{
  "version": "$version",
  "commit_sha": "$commit_sha",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployed_by": "$(git config user.name)",
  "deployment_type": "blue_green"
}
EOF
}

# Deploy to blue environment
deploy_blue() {
    local version=$1
    
    echo -e "\n${YELLOW}Deploying to blue environment...${NC}"
    
    # Tag the release
    git tag -a "v$version" -m "Production release v$version"
    git push origin "v$version"
    
    # This triggers the deployment via GitHub Actions
    echo "Deployment triggered via GitHub Actions..."
    echo "Waiting for blue environment to be ready..."
    
    # Poll for deployment completion
    local attempts=0
    while [ $attempts -lt 30 ]; do
        sleep 10
        echo -n "."
        
        # Check if blue environment is responding
        if curl -sf "$HEALTH_CHECK_URL-blue" > /dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Blue environment is ready${NC}"
            return 0
        fi
        
        ((attempts++))
    done
    
    echo -e "\n${RED}✗ Blue environment failed to become ready${NC}"
    return 1
}

# Perform health checks on blue environment
health_check_blue() {
    echo -e "\n${YELLOW}Running health checks on blue environment...${NC}"
    
    local attempts=0
    while [ $attempts -lt $HEALTH_CHECK_RETRIES ]; do
        if curl -sf "$HEALTH_CHECK_URL-blue" -o /tmp/health_response.json; then
            local status=$(jq -r '.status' /tmp/health_response.json)
            local db_status=$(jq -r '.database' /tmp/health_response.json)
            
            if [ "$status" = "ok" ] && [ "$db_status" = "connected" ]; then
                echo -e "${GREEN}✓ Health check passed${NC}"
                return 0
            fi
        fi
        
        ((attempts++))
        echo "Health check attempt $attempts/$HEALTH_CHECK_RETRIES failed, retrying..."
        sleep 3
    done
    
    echo -e "${RED}✗ Health checks failed${NC}"
    return 1
}

# Migrate traffic to blue environment
migrate_traffic() {
    echo -e "\n${YELLOW}Starting traffic migration...${NC}"
    
    for i in "${!TRAFFIC_MIGRATION_STEPS[@]}"; do
        local percentage=${TRAFFIC_MIGRATION_STEPS[$i]}
        local wait_time=${TRAFFIC_MIGRATION_WAIT[$i]}
        
        echo -e "\n${BLUE}Migrating ${percentage}% traffic to blue environment${NC}"
        
        # Update Railway traffic split
        railway up --service gateway \
            --environment production \
            --traffic-split "blue:$percentage"
        
        # Monitor for errors
        echo "Monitoring for errors..."
        sleep 30
        
        # Check error rate
        local error_rate=$(curl -s "$HEALTH_CHECK_URL/metrics" | jq -r '.error_rate')
        if (( $(echo "$error_rate > 0.01" | bc -l) )); then
            echo -e "${RED}✗ High error rate detected: ${error_rate}${NC}"
            echo "Rolling back..."
            rollback
            exit 1
        fi
        
        echo -e "${GREEN}✓ No issues detected at ${percentage}% traffic${NC}"
        
        if [ $wait_time -gt 0 ]; then
            echo "Waiting $wait_time seconds before next step..."
            sleep $wait_time
        fi
    done
    
    echo -e "\n${GREEN}✓ Traffic migration completed successfully${NC}"
}

# Rollback function
rollback() {
    echo -e "\n${RED}Initiating rollback...${NC}"
    
    # Switch all traffic back to green
    railway up --service gateway \
        --environment production \
        --traffic-split "green:100"
    
    # Remove blue deployment
    railway down --service gateway-blue \
        --environment production
    
    echo -e "${GREEN}✓ Rollback completed${NC}"
}

# Finalize deployment
finalize_deployment() {
    echo -e "\n${YELLOW}Finalizing deployment...${NC}"
    
    # Make blue the new green
    railway up --service gateway \
        --environment production \
        --promote-blue-to-green
    
    # Clean up old green environment
    railway down --service gateway-old-green \
        --environment production
    
    echo -e "${GREEN}✓ Deployment finalized${NC}"
}

# Main deployment flow
main() {
    echo -n "Enter version number (e.g., 1.2.3): "
    read -r VERSION
    
    if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}Invalid version format${NC}"
        exit 1
    fi
    
    COMMIT_SHA=$(git rev-parse HEAD)
    
    echo -e "\n${BLUE}Deployment Summary:${NC}"
    echo "Version: v$VERSION"
    echo "Commit: $COMMIT_SHA"
    echo "Branch: main"
    echo "Target: Production"
    echo -e "\n${YELLOW}This will deploy to production. Are you sure? (yes/no):${NC} "
    read -r confirmation
    
    if [ "$confirmation" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    # Create deployment record
    create_deployment_record "$VERSION" "$COMMIT_SHA"
    
    # Run through deployment steps
    check_prerequisites
    pre_deployment_checks
    
    if deploy_blue "$VERSION"; then
        if health_check_blue; then
            migrate_traffic
            finalize_deployment
            
            echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
            echo "Version v$VERSION is now live in production."
            
            # Send success notification
            if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
                curl -X POST "$SLACK_WEBHOOK_URL" \
                    -H 'Content-Type: application/json' \
                    -d "{\"text\": \"✅ Production deployment successful: v$VERSION\"}"
            fi
        else
            echo -e "${RED}Blue environment health checks failed${NC}"
            rollback
            exit 1
        fi
    else
        echo -e "${RED}Failed to deploy blue environment${NC}"
        exit 1
    fi
}

# Run main function
main "$@"