#!/bin/bash

# Production Database Backup Script
# =================================

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/capacity-planner"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="production_backup_${TIMESTAMP}.sql"
ENCRYPTED_FILENAME="${BACKUP_FILENAME}.enc"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo -e "${YELLOW}Starting production database backup...${NC}"

# Check if required environment variables are set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
    exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo -e "${RED}ERROR: BACKUP_ENCRYPTION_KEY environment variable not set${NC}"
    exit 1
fi

# Function to send alert
send_alert() {
    local status=$1
    local message=$2
    
    # Send to monitoring system (example using curl to webhook)
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
        curl -X POST "${ALERT_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"Database Backup ${status}: ${message}\"}" \
            > /dev/null 2>&1 || true
    fi
}

# Perform backup
echo "Creating backup: ${BACKUP_FILENAME}"
if pg_dump "${DATABASE_URL}" --no-owner --clean --if-exists > "${BACKUP_DIR}/${BACKUP_FILENAME}"; then
    echo -e "${GREEN}✓ Database backup created successfully${NC}"
else
    echo -e "${RED}✗ Database backup failed${NC}"
    send_alert "FAILED" "Failed to create database backup"
    exit 1
fi

# Compress backup
echo "Compressing backup..."
if gzip -9 "${BACKUP_DIR}/${BACKUP_FILENAME}"; then
    BACKUP_FILENAME="${BACKUP_FILENAME}.gz"
    echo -e "${GREEN}✓ Backup compressed successfully${NC}"
else
    echo -e "${RED}✗ Compression failed${NC}"
    send_alert "FAILED" "Failed to compress backup"
    exit 1
fi

# Encrypt backup
echo "Encrypting backup..."
if openssl enc -aes-256-cbc -salt -in "${BACKUP_DIR}/${BACKUP_FILENAME}" \
    -out "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" \
    -k "${BACKUP_ENCRYPTION_KEY}"; then
    echo -e "${GREEN}✓ Backup encrypted successfully${NC}"
    rm "${BACKUP_DIR}/${BACKUP_FILENAME}"  # Remove unencrypted file
else
    echo -e "${RED}✗ Encryption failed${NC}"
    send_alert "FAILED" "Failed to encrypt backup"
    exit 1
fi

# Upload to cloud storage (example using AWS S3)
if [ -n "${AWS_S3_BUCKET:-}" ]; then
    echo "Uploading to S3..."
    if aws s3 cp "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" \
        "s3://${AWS_S3_BUCKET}/database-backups/${ENCRYPTED_FILENAME}" \
        --storage-class STANDARD_IA; then
        echo -e "${GREEN}✓ Backup uploaded to S3${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to upload to S3 (backup kept locally)${NC}"
        send_alert "WARNING" "Failed to upload backup to S3"
    fi
fi

# Test backup integrity
echo "Verifying backup integrity..."
BACKUP_SIZE=$(stat -f%z "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${ENCRYPTED_FILENAME}")
if [ "$BACKUP_SIZE" -gt 1000000 ]; then  # Expect at least 1MB
    echo -e "${GREEN}✓ Backup size verified: $(numfmt --to=iec-i --suffix=B "$BACKUP_SIZE")${NC}"
else
    echo -e "${RED}✗ Backup seems too small: $BACKUP_SIZE bytes${NC}"
    send_alert "WARNING" "Backup file unusually small"
fi

# Clean up old backups
echo "Cleaning up old backups..."
find "${BACKUP_DIR}" -name "production_backup_*.sql.enc" -mtime +${RETENTION_DAYS} -delete
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "production_backup_*.sql.enc" -mtime +${RETENTION_DAYS} | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Deleted $DELETED_COUNT old backup(s)${NC}"
fi

# Record backup metadata
cat > "${BACKUP_DIR}/latest_backup.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "filename": "${ENCRYPTED_FILENAME}",
  "size_bytes": ${BACKUP_SIZE},
  "database_url": "${DATABASE_URL%%@*}@***",
  "retention_days": ${RETENTION_DAYS},
  "status": "success"
}
EOF

echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "Backup saved to: ${BACKUP_DIR}/${ENCRYPTED_FILENAME}"

# Send success notification
send_alert "SUCCESS" "Database backup completed successfully"

# Exit successfully
exit 0