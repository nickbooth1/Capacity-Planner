#!/bin/bash

# Production Database Recovery Script
# ===================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/var/backups/capacity-planner"

echo -e "${YELLOW}Production Database Recovery Tool${NC}"
echo "================================="

# Check if required environment variables are set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
    exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo -e "${RED}ERROR: BACKUP_ENCRYPTION_KEY environment variable not set${NC}"
    exit 1
fi

# Function to list available backups
list_backups() {
    echo -e "\n${BLUE}Available backups:${NC}"
    ls -la "${BACKUP_DIR}"/production_backup_*.sql.enc 2>/dev/null | \
        awk '{print NR ". " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}'
}

# Function to download from S3 if needed
download_from_s3() {
    local filename=$1
    if [ -n "${AWS_S3_BUCKET:-}" ] && [ ! -f "${BACKUP_DIR}/${filename}" ]; then
        echo "Backup not found locally. Attempting to download from S3..."
        if aws s3 cp "s3://${AWS_S3_BUCKET}/database-backups/${filename}" "${BACKUP_DIR}/${filename}"; then
            echo -e "${GREEN}✓ Backup downloaded from S3${NC}"
        else
            echo -e "${RED}✗ Failed to download backup from S3${NC}"
            return 1
        fi
    fi
    return 0
}

# Safety check
echo -e "${RED}⚠️  WARNING: This will restore the production database!${NC}"
echo -e "${RED}   All current data will be replaced with the backup.${NC}"
echo -n "Are you sure you want to continue? (type 'YES' to confirm): "
read -r confirmation

if [ "$confirmation" != "YES" ]; then
    echo "Recovery cancelled."
    exit 0
fi

# List available backups
list_backups

# Get backup selection
echo -n -e "\n${YELLOW}Enter backup filename (or number from list above): ${NC}"
read -r backup_selection

# Resolve backup filename
if [[ "$backup_selection" =~ ^[0-9]+$ ]]; then
    # User entered a number
    BACKUP_FILE=$(ls "${BACKUP_DIR}"/production_backup_*.sql.enc 2>/dev/null | sed -n "${backup_selection}p" | xargs basename)
else
    # User entered a filename
    BACKUP_FILE=$(basename "$backup_selection")
fi

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Invalid selection${NC}"
    exit 1
fi

# Check if backup exists locally or in S3
if ! download_from_s3 "$BACKUP_FILE"; then
    if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        echo -e "${RED}Backup file not found: ${BACKUP_FILE}${NC}"
        exit 1
    fi
fi

echo -e "\n${YELLOW}Selected backup: ${BACKUP_FILE}${NC}"

# Create temporary directory for recovery
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Decrypt backup
echo "Decrypting backup..."
DECRYPTED_FILE="${TEMP_DIR}/decrypted_backup.sql.gz"
if openssl enc -d -aes-256-cbc -in "${BACKUP_DIR}/${BACKUP_FILE}" \
    -out "$DECRYPTED_FILE" -k "${BACKUP_ENCRYPTION_KEY}"; then
    echo -e "${GREEN}✓ Backup decrypted successfully${NC}"
else
    echo -e "${RED}✗ Failed to decrypt backup${NC}"
    exit 1
fi

# Decompress backup
echo "Decompressing backup..."
if gunzip "$DECRYPTED_FILE"; then
    RESTORE_FILE="${TEMP_DIR}/decrypted_backup.sql"
    echo -e "${GREEN}✓ Backup decompressed successfully${NC}"
else
    echo -e "${RED}✗ Failed to decompress backup${NC}"
    exit 1
fi

# Create current backup before restore
echo "Creating safety backup of current database..."
SAFETY_BACKUP="${BACKUP_DIR}/pre_restore_safety_$(date +%Y%m%d_%H%M%S).sql"
if pg_dump "${DATABASE_URL}" --no-owner > "$SAFETY_BACKUP"; then
    echo -e "${GREEN}✓ Safety backup created: ${SAFETY_BACKUP}${NC}"
else
    echo -e "${YELLOW}⚠ Failed to create safety backup, continuing anyway...${NC}"
fi

# Final confirmation
echo -e "\n${RED}FINAL WARNING: About to restore database from backup${NC}"
echo "Backup date: ${BACKUP_FILE}"
echo -n "Type 'RESTORE' to proceed: "
read -r final_confirmation

if [ "$final_confirmation" != "RESTORE" ]; then
    echo "Recovery cancelled."
    exit 0
fi

# Stop application connections
echo -e "\n${YELLOW}Stopping application connections...${NC}"
echo "Please ensure all services are stopped or in maintenance mode."
echo -n "Press Enter when ready to continue..."
read -r

# Perform restore
echo -e "\n${YELLOW}Restoring database...${NC}"
if psql "${DATABASE_URL}" < "$RESTORE_FILE"; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    echo -e "${YELLOW}Attempting to restore safety backup...${NC}"
    if [ -f "$SAFETY_BACKUP" ] && psql "${DATABASE_URL}" < "$SAFETY_BACKUP"; then
        echo -e "${GREEN}✓ Safety backup restored${NC}"
    else
        echo -e "${RED}✗ Failed to restore safety backup. Manual intervention required!${NC}"
    fi
    exit 1
fi

# Verify restore
echo -e "\n${YELLOW}Verifying restore...${NC}"
VERIFY_QUERY="SELECT COUNT(*) as org_count FROM public.organizations;"
ORG_COUNT=$(psql "${DATABASE_URL}" -t -c "$VERIFY_QUERY" | xargs)
echo "Organizations in database: $ORG_COUNT"

if [ "$ORG_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Database appears to be restored correctly${NC}"
else
    echo -e "${YELLOW}⚠ Warning: No organizations found. Please verify data manually.${NC}"
fi

echo -e "\n${GREEN}✅ Recovery completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify data integrity manually"
echo "2. Run application health checks"
echo "3. Re-enable application connections"
echo "4. Monitor logs for any issues"
echo -e "\nSafety backup saved at: ${SAFETY_BACKUP}"

exit 0