#!/bin/bash

# Stand Capabilities Deployment Script
# This script handles the complete deployment of the stand capabilities feature

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV="${ENV:-staging}"
VERSION="${VERSION:-$(date +%Y%m%d-%H%M%S)}"
DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-blue-green}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_debug() {
    if [ "$DEBUG" = "true" ]; then
        echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
    fi
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if required files exist
    local required_files=(
        "$PROJECT_ROOT/package.json"
        "$PROJECT_ROOT/Dockerfile"
        "$PROJECT_ROOT/prisma/schema.prisma"
        "$PROJECT_ROOT/src/types/stand-capabilities.ts"
        "$PROJECT_ROOT/src/validation/capability-validation.engine.ts"
        "$PROJECT_ROOT/src/services/stand-capability.service.ts"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Check if dependencies are installed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log_error "Dependencies not installed. Run 'npm install' first."
        exit 1
    fi
    
    # Check environment configuration
    local env_file="$PROJECT_ROOT/.env.$ENV"
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    
    # Validate database connectivity
    if ! npx prisma db pull --preview-feature > /dev/null 2>&1; then
        log_error "Database connectivity check failed"
        exit 1
    fi
    
    log_info "Pre-deployment checks passed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --production=false
    
    # Run tests
    log_info "Running tests..."
    npm run test:unit
    
    # Build application
    log_info "Building application..."
    npm run build
    
    # Build Docker image
    log_info "Building Docker image..."
    docker build -t "capacity-planner/assets-module:$VERSION" .
    docker tag "capacity-planner/assets-module:$VERSION" "capacity-planner/assets-module:latest"
    
    log_info "Application build completed"
}

# Deploy to staging
deploy_to_staging() {
    log_info "Deploying to staging environment..."
    
    # Update Docker Compose for staging
    local compose_file="$PROJECT_ROOT/docker-compose.staging.yml"
    
    if [ ! -f "$compose_file" ]; then
        log_error "Staging compose file not found: $compose_file"
        exit 1
    fi
    
    # Update image version in compose file
    sed -i.bak "s/image: capacity-planner\/assets-module:.*/image: capacity-planner\/assets-module:$VERSION/" "$compose_file"
    
    # Deploy with Docker Compose
    docker-compose -f "$compose_file" down
    docker-compose -f "$compose_file" up -d
    
    log_info "Staging deployment completed"
}

# Deploy to production
deploy_to_production() {
    log_info "Deploying to production environment..."
    
    case "$DEPLOYMENT_MODE" in
        "blue-green")
            deploy_blue_green
            ;;
        "rolling")
            deploy_rolling
            ;;
        "canary")
            deploy_canary
            ;;
        *)
            log_error "Unknown deployment mode: $DEPLOYMENT_MODE"
            exit 1
            ;;
    esac
    
    log_info "Production deployment completed"
}

# Blue-green deployment
deploy_blue_green() {
    log_info "Performing blue-green deployment..."
    
    # Determine current and target environments
    local current_env=$(get_current_environment)
    local target_env=$([ "$current_env" = "blue" ] && echo "green" || echo "blue")
    
    log_info "Current environment: $current_env"
    log_info "Target environment: $target_env"
    
    # Deploy to target environment
    deploy_to_environment "$target_env"
    
    # Run health checks
    if run_health_checks "$target_env"; then
        # Switch traffic
        switch_traffic "$target_env"
        
        # Stop old environment
        stop_environment "$current_env"
        
        log_info "Blue-green deployment successful"
    else
        log_error "Health checks failed, rolling back"
        stop_environment "$target_env"
        exit 1
    fi
}

# Rolling deployment
deploy_rolling() {
    log_info "Performing rolling deployment..."
    
    # Get list of instances
    local instances=$(get_production_instances)
    
    for instance in $instances; do
        log_info "Updating instance: $instance"
        
        # Update instance
        update_instance "$instance"
        
        # Wait for instance to be healthy
        if ! wait_for_instance_health "$instance"; then
            log_error "Instance $instance failed health check"
            if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                rollback_deployment
            fi
            exit 1
        fi
        
        log_info "Instance $instance updated successfully"
    done
    
    log_info "Rolling deployment completed"
}

# Canary deployment
deploy_canary() {
    log_info "Performing canary deployment..."
    
    # Deploy canary instance
    deploy_canary_instance
    
    # Route small percentage of traffic to canary
    route_canary_traffic 5
    
    # Monitor canary for errors
    if monitor_canary_health; then
        # Gradually increase traffic
        route_canary_traffic 25
        sleep 300
        
        if monitor_canary_health; then
            route_canary_traffic 50
            sleep 300
            
            if monitor_canary_health; then
                # Complete canary deployment
                complete_canary_deployment
                log_info "Canary deployment successful"
            else
                log_error "Canary failed at 50% traffic"
                rollback_canary
                exit 1
            fi
        else
            log_error "Canary failed at 25% traffic"
            rollback_canary
            exit 1
        fi
    else
        log_error "Canary failed at 5% traffic"
        rollback_canary
        exit 1
    fi
}

# Run database migrations
run_database_migrations() {
    log_info "Running database migrations..."
    
    local migration_script="$SCRIPT_DIR/migrate-capabilities.sh"
    
    if [ ! -f "$migration_script" ]; then
        log_error "Migration script not found: $migration_script"
        exit 1
    fi
    
    # Run migration
    bash "$migration_script" --env "$ENV"
    
    log_info "Database migrations completed"
}

# Health checks
run_health_checks() {
    local environment="${1:-production}"
    log_info "Running health checks for $environment..."
    
    local health_url=$(get_health_url "$environment")
    local timeout="$HEALTH_CHECK_TIMEOUT"
    local start_time=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $timeout ]; then
            log_error "Health check timeout after ${timeout}s"
            return 1
        fi
        
        if curl -f -s "$health_url" > /dev/null; then
            log_info "Health check passed"
            return 0
        fi
        
        log_info "Health check failed, retrying in 10s..."
        sleep 10
    done
}

# Smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    local api_url=$(get_api_url)
    local auth_token=$(get_auth_token)
    
    # Test basic API endpoints
    log_info "Testing basic API endpoints..."
    
    # Health check
    if ! curl -f -s "$api_url/health" > /dev/null; then
        log_error "Health endpoint failed"
        return 1
    fi
    
    # Capabilities endpoint
    if ! curl -f -s -H "Authorization: Bearer $auth_token" "$api_url/api/v1/stands/test-stand/capabilities" > /dev/null; then
        log_error "Capabilities endpoint failed"
        return 1
    fi
    
    # Validation endpoint
    local test_data='{"dimensions":{"length":60,"width":45}}'
    if ! curl -f -s -H "Authorization: Bearer $auth_token" -H "Content-Type: application/json" -d "$test_data" "$api_url/api/v1/stands/capabilities/validate" > /dev/null; then
        log_error "Validation endpoint failed"
        return 1
    fi
    
    log_info "Smoke tests passed"
    return 0
}

# Performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    local load_test_script="$PROJECT_ROOT/tests/load/run-load-tests.sh"
    
    if [ ! -f "$load_test_script" ]; then
        log_warn "Load test script not found, skipping performance tests"
        return 0
    fi
    
    # Run performance tests
    bash "$load_test_script" --url "$(get_api_url)" --token "$(get_auth_token)"
    
    log_info "Performance tests completed"
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    case "$DEPLOYMENT_MODE" in
        "blue-green")
            rollback_blue_green
            ;;
        "rolling")
            rollback_rolling
            ;;
        "canary")
            rollback_canary
            ;;
        *)
            log_error "Unknown deployment mode for rollback: $DEPLOYMENT_MODE"
            exit 1
            ;;
    esac
    
    log_info "Rollback completed"
}

# Utility functions
get_current_environment() {
    # Implementation depends on your infrastructure
    # This is a placeholder
    echo "blue"
}

get_health_url() {
    local environment="$1"
    case "$environment" in
        "staging")
            echo "https://staging-assets-api.capacity-planner.com/health"
            ;;
        "blue"|"green")
            echo "https://$environment-assets-api.capacity-planner.com/health"
            ;;
        *)
            echo "https://assets-api.capacity-planner.com/health"
            ;;
    esac
}

get_api_url() {
    case "$ENV" in
        "staging")
            echo "https://staging-assets-api.capacity-planner.com"
            ;;
        "production")
            echo "https://assets-api.capacity-planner.com"
            ;;
        *)
            echo "http://localhost:3000"
            ;;
    esac
}

get_auth_token() {
    # Get auth token from environment or secret management
    echo "${DEPLOY_AUTH_TOKEN:-test-token}"
}

# Notification functions
send_deployment_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Deployment $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [ -n "$EMAIL_NOTIFICATION" ]; then
        echo "$message" | mail -s "Deployment $status" "$EMAIL_NOTIFICATION"
    fi
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting deployment of Stand Capabilities feature"
    log_info "Environment: $ENV"
    log_info "Version: $VERSION"
    log_info "Deployment mode: $DEPLOYMENT_MODE"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENV="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --mode)
                DEPLOYMENT_MODE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --rollback)
                rollback_deployment
                exit 0
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Trap errors for notifications
    trap 'send_deployment_notification "FAILED" "Deployment failed at $(date)"; exit 1' ERR
    
    # Run deployment steps
    if [ "$DRY_RUN" != "true" ]; then
        pre_deployment_checks
        build_application
        
        if [ "$ENV" = "staging" ]; then
            deploy_to_staging
        elif [ "$ENV" = "production" ]; then
            run_database_migrations
            deploy_to_production
        fi
        
        run_health_checks
        run_smoke_tests
        
        if [ "$ENV" = "production" ]; then
            run_performance_tests
        fi
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Deployment completed successfully in ${duration}s"
        send_deployment_notification "SUCCESS" "Deployment completed successfully in ${duration}s"
    else
        log_info "DRY RUN: Deployment steps would be executed here"
    fi
}

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --env ENV              Environment (staging|production)"
    echo "  --version VERSION      Version tag for deployment"
    echo "  --mode MODE            Deployment mode (blue-green|rolling|canary)"
    echo "  --dry-run              Run in dry-run mode"
    echo "  --rollback             Rollback deployment"
    echo "  --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENV                    Environment (default: staging)"
    echo "  VERSION                Version tag"
    echo "  DEPLOYMENT_MODE        Deployment mode (default: blue-green)"
    echo "  HEALTH_CHECK_TIMEOUT   Health check timeout in seconds (default: 300)"
    echo "  ROLLBACK_ON_FAILURE    Rollback on failure (default: true)"
    echo "  SLACK_WEBHOOK_URL      Slack webhook for notifications"
    echo "  EMAIL_NOTIFICATION     Email for notifications"
    echo "  DEBUG                  Enable debug logging"
    echo ""
    echo "Examples:"
    echo "  $0 --env staging                    # Deploy to staging"
    echo "  $0 --env production --mode rolling  # Rolling deployment to production"
    echo "  $0 --dry-run                        # Test deployment process"
    echo "  $0 --rollback                       # Rollback deployment"
}

# Execute main function
main "$@"