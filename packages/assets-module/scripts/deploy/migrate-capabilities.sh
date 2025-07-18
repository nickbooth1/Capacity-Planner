#!/bin/bash

# Stand Capabilities Migration Script
# This script handles database migrations for the stand capabilities feature

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV="${ENV:-development}"
DRY_RUN="${DRY_RUN:-false}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
LOG_DIR="${LOG_DIR:-$PROJECT_ROOT/logs}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_debug() {
    if [ "$DEBUG" = "true" ]; then
        echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
    fi
}

# Setup logging
setup_logging() {
    mkdir -p "$LOG_DIR"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    LOG_FILE="$LOG_DIR/migration_$timestamp.log"
    
    log_info "Starting stand capabilities migration"
    log_info "Environment: $ENV"
    log_info "Dry run: $DRY_RUN"
    log_info "Log file: $LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the correct directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "Not in project root directory"
        exit 1
    fi
    
    # Check if Prisma is available
    if ! command -v npx &> /dev/null; then
        log_error "npx is not available"
        exit 1
    fi
    
    # Check if database is accessible
    if ! npx prisma db pull --preview-feature > /dev/null 2>&1; then
        log_error "Database is not accessible"
        exit 1
    fi
    
    # Check if Redis is available (for caching)
    if [ "$ENV" != "development" ]; then
        if ! command -v redis-cli &> /dev/null; then
            log_warn "Redis CLI not available, skipping Redis checks"
        else
            if ! redis-cli ping > /dev/null 2>&1; then
                log_warn "Redis is not accessible, caching may not work"
            fi
        fi
    fi
    
    log_info "Prerequisites check passed"
}

# Create backup
create_backup() {
    log_info "Creating database backup..."
    
    mkdir -p "$BACKUP_DIR"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/pre_capabilities_migration_$timestamp.sql"
    
    # Extract database connection info
    local db_url=$(npx prisma db pull --print-datasource-url 2>/dev/null || echo "")
    
    if [ -z "$db_url" ]; then
        log_error "Could not determine database URL"
        exit 1
    fi
    
    # Create backup based on database type
    if [[ "$db_url" == postgresql* ]]; then
        log_info "Creating PostgreSQL backup..."
        pg_dump "$db_url" > "$backup_file"
    elif [[ "$db_url" == mysql* ]]; then
        log_info "Creating MySQL backup..."
        mysqldump "$db_url" > "$backup_file"
    else
        log_warn "Unknown database type, skipping backup"
        return 0
    fi
    
    log_info "Backup created: $backup_file"
    echo "$backup_file" > "$BACKUP_DIR/latest_backup.txt"
}

# Run database migration
run_migration() {
    log_info "Running database migration..."
    
    cd "$PROJECT_ROOT"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would execute migration"
        npx prisma migrate diff --preview-feature
        return 0
    fi
    
    # Generate migration if needed
    log_info "Generating migration..."
    npx prisma migrate dev --name add_stand_capabilities
    
    # Apply migration
    log_info "Applying migration..."
    npx prisma migrate deploy
    
    # Update Prisma client
    log_info "Updating Prisma client..."
    npx prisma generate
    
    log_info "Database migration completed"
}

# Apply custom SQL scripts
apply_custom_sql() {
    log_info "Applying custom SQL scripts..."
    
    local sql_dir="$PROJECT_ROOT/prisma/sql"
    
    if [ ! -d "$sql_dir" ]; then
        log_info "No custom SQL directory found, skipping"
        return 0
    fi
    
    # Apply GIN indexes
    local gin_indexes_file="$sql_dir/gin_indexes.sql"
    if [ -f "$gin_indexes_file" ]; then
        log_info "Applying GIN indexes..."
        if [ "$DRY_RUN" = "true" ]; then
            log_info "DRY RUN: Would apply GIN indexes"
            cat "$gin_indexes_file"
        else
            npx prisma db execute --file "$gin_indexes_file"
        fi
    fi
    
    # Apply RLS policies
    local rls_policies_file="$sql_dir/rls-policies.sql"
    if [ -f "$rls_policies_file" ]; then
        log_info "Applying RLS policies..."
        if [ "$DRY_RUN" = "true" ]; then
            log_info "DRY RUN: Would apply RLS policies"
            cat "$rls_policies_file"
        else
            npx prisma db execute --file "$rls_policies_file"
        fi
    fi
    
    # Apply materialized views
    local materialized_views_file="$sql_dir/materialized_views.sql"
    if [ -f "$materialized_views_file" ]; then
        log_info "Applying materialized views..."
        if [ "$DRY_RUN" = "true" ]; then
            log_info "DRY RUN: Would apply materialized views"
            cat "$materialized_views_file"
        else
            npx prisma db execute --file "$materialized_views_file"
        fi
    fi
    
    log_info "Custom SQL scripts applied"
}

# Migrate existing data
migrate_existing_data() {
    log_info "Migrating existing data..."
    
    local migration_script="$PROJECT_ROOT/src/services/migration/capability-migration.service.ts"
    
    if [ ! -f "$migration_script" ]; then
        log_warn "No data migration script found, skipping data migration"
        return 0
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would migrate existing data"
        return 0
    fi
    
    # Run data migration
    log_info "Running data migration service..."
    cd "$PROJECT_ROOT"
    
    # Create a temporary migration runner
    cat > "/tmp/run_migration.js" << 'EOF'
const { CapabilityMigrationService } = require('./dist/services/migration/capability-migration.service');
const { PrismaClient } = require('@prisma/client');

async function runMigration() {
    const prisma = new PrismaClient();
    const migrationService = new CapabilityMigrationService(prisma);
    
    try {
        console.log('Starting data migration...');
        const result = await migrationService.migrateAll();
        console.log('Migration completed:', result);
        
        if (result.errors.length > 0) {
            console.error('Migration errors:', result.errors);
            process.exit(1);
        }
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
EOF
    
    # Build the project first
    npm run build
    
    # Run the migration
    node /tmp/run_migration.js
    
    # Clean up
    rm -f /tmp/run_migration.js
    
    log_info "Data migration completed"
}

# Validate migration
validate_migration() {
    log_info "Validating migration..."
    
    cd "$PROJECT_ROOT"
    
    # Check if tables exist
    log_info "Checking database schema..."
    npx prisma db pull --preview-feature > /dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "Database schema validation failed"
        exit 1
    fi
    
    # Run any validation scripts
    local validation_script="$PROJECT_ROOT/scripts/validate-capabilities.js"
    if [ -f "$validation_script" ]; then
        log_info "Running validation script..."
        if [ "$DRY_RUN" = "true" ]; then
            log_info "DRY RUN: Would run validation script"
        else
            node "$validation_script"
        fi
    fi
    
    log_info "Migration validation completed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    if [ "$ENV" = "production" ]; then
        # Enable monitoring in production
        log_info "Enabling production monitoring..."
        
        # Update environment variables for monitoring
        if [ -f "$PROJECT_ROOT/.env.production" ]; then
            if ! grep -q "ENABLE_METRICS=true" "$PROJECT_ROOT/.env.production"; then
                echo "ENABLE_METRICS=true" >> "$PROJECT_ROOT/.env.production"
            fi
            if ! grep -q "ENABLE_HEALTH_CHECKS=true" "$PROJECT_ROOT/.env.production"; then
                echo "ENABLE_HEALTH_CHECKS=true" >> "$PROJECT_ROOT/.env.production"
            fi
        fi
    fi
    
    log_info "Monitoring setup completed"
}

# Rollback function
rollback_migration() {
    log_error "Rolling back migration..."
    
    local latest_backup_file="$BACKUP_DIR/latest_backup.txt"
    
    if [ ! -f "$latest_backup_file" ]; then
        log_error "No backup file found, cannot rollback"
        exit 1
    fi
    
    local backup_file=$(cat "$latest_backup_file")
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring from backup: $backup_file"
    
    # Restore database
    local db_url=$(npx prisma db pull --print-datasource-url 2>/dev/null || echo "")
    
    if [[ "$db_url" == postgresql* ]]; then
        psql "$db_url" < "$backup_file"
    elif [[ "$db_url" == mysql* ]]; then
        mysql "$db_url" < "$backup_file"
    else
        log_error "Unknown database type, cannot restore"
        exit 1
    fi
    
    log_info "Rollback completed"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    # Setup
    setup_logging
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --env)
                ENV="$2"
                shift 2
                ;;
            --rollback)
                rollback_migration
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
    
    # Trap errors for rollback
    trap 'log_error "Migration failed, consider running with --rollback"; exit 1' ERR
    
    # Run migration steps
    check_prerequisites
    
    if [ "$ENV" != "development" ]; then
        create_backup
    fi
    
    run_migration
    apply_custom_sql
    migrate_existing_data
    validate_migration
    setup_monitoring
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "Migration completed successfully in ${duration}s"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "This was a dry run. No changes were made."
    else
        log_info "Stand capabilities feature has been deployed successfully"
    fi
}

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run              Run in dry-run mode (no changes made)"
    echo "  --env ENV              Environment (development|staging|production)"
    echo "  --rollback             Rollback to previous state"
    echo "  --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENV                    Environment (default: development)"
    echo "  DRY_RUN                Dry run mode (default: false)"
    echo "  BACKUP_DIR             Backup directory (default: ./backups)"
    echo "  LOG_DIR                Log directory (default: ./logs)"
    echo "  DEBUG                  Enable debug logging"
    echo ""
    echo "Examples:"
    echo "  $0                     # Run migration in development"
    echo "  $0 --dry-run           # Test migration without changes"
    echo "  $0 --env production    # Run migration in production"
    echo "  $0 --rollback          # Rollback to previous state"
}

# Run main function
main "$@"