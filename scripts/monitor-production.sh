#!/bin/bash

# Production Health Monitoring Script
# ===================================

set -euo pipefail

# Configuration
API_URL="https://api.capacity-planner.com"
APP_URL="https://app.capacity-planner.com"
CHECK_INTERVAL=60  # seconds
ALERT_THRESHOLD=3  # consecutive failures before alert

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
API_FAILURES=0
APP_FAILURES=0
DB_FAILURES=0

# Function to check API health
check_api_health() {
    local response
    local status
    
    response=$(curl -sf -w "\n%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" = "200" ]; then
        API_FAILURES=0
        local health_data=$(echo "$response" | head -n-1)
        local db_status=$(echo "$health_data" | jq -r '.database' 2>/dev/null || echo "unknown")
        
        if [ "$db_status" != "connected" ]; then
            ((DB_FAILURES++))
            echo -e "${YELLOW}⚠ Database not connected${NC}"
        else
            DB_FAILURES=0
        fi
        
        return 0
    else
        ((API_FAILURES++))
        echo -e "${RED}✗ API health check failed (HTTP $status)${NC}"
        return 1
    fi
}

# Function to check app health
check_app_health() {
    local status
    
    status=$(curl -sf -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        APP_FAILURES=0
        return 0
    else
        ((APP_FAILURES++))
        echo -e "${RED}✗ App health check failed (HTTP $status)${NC}"
        return 1
    fi
}

# Function to check response times
check_response_times() {
    local api_time
    local app_time
    
    api_time=$(curl -sf -o /dev/null -w "%{time_total}" "$API_URL/health" 2>/dev/null || echo "0")
    app_time=$(curl -sf -o /dev/null -w "%{time_total}" "$APP_URL" 2>/dev/null || echo "0")
    
    # Convert to milliseconds
    api_time_ms=$(echo "$api_time * 1000" | bc | cut -d. -f1)
    app_time_ms=$(echo "$app_time * 1000" | bc | cut -d. -f1)
    
    if [ "$api_time_ms" -gt 1000 ]; then
        echo -e "${YELLOW}⚠ API response time high: ${api_time_ms}ms${NC}"
    fi
    
    if [ "$app_time_ms" -gt 2000 ]; then
        echo -e "${YELLOW}⚠ App response time high: ${app_time_ms}ms${NC}"
    fi
    
    echo "API: ${api_time_ms}ms | App: ${app_time_ms}ms"
}

# Function to send alert
send_alert() {
    local service=$1
    local message=$2
    
    # Log to file
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ALERT: $service - $message" >> /var/log/capacity-planner-alerts.log
    
    # Send to monitoring system
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
        curl -X POST "$ALERT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"🚨 Production Alert: $service - $message\"}" \
            > /dev/null 2>&1 || true
    fi
    
    # Send PagerDuty alert for critical issues
    if [ -n "${PAGERDUTY_TOKEN:-}" ] && [ "$service" = "API" ]; then
        curl -X POST "https://events.pagerduty.com/v2/enqueue" \
            -H "Content-Type: application/json" \
            -d "{
                \"routing_key\": \"$PAGERDUTY_TOKEN\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"Production $service is down\",
                    \"severity\": \"critical\",
                    \"source\": \"monitoring-script\"
                }
            }" > /dev/null 2>&1 || true
    fi
}

# Function to display status
display_status() {
    clear
    echo -e "${GREEN}Production Health Monitor${NC}"
    echo "========================"
    echo "Time: $(date)"
    echo ""
    
    # API Status
    echo -n "API Gateway: "
    if check_api_health; then
        echo -e "${GREEN}✓ Healthy${NC}"
    fi
    
    # App Status
    echo -n "Web App: "
    if check_app_health; then
        echo -e "${GREEN}✓ Healthy${NC}"
    fi
    
    # Response Times
    echo ""
    echo "Response Times:"
    check_response_times
    
    # Alert Status
    echo ""
    echo "Alert Status:"
    echo "API Failures: $API_FAILURES/$ALERT_THRESHOLD"
    echo "App Failures: $APP_FAILURES/$ALERT_THRESHOLD"
    echo "DB Failures: $DB_FAILURES/$ALERT_THRESHOLD"
}

# Main monitoring loop
main() {
    echo "Starting production health monitoring..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; exit 0' INT TERM
    
    while true; do
        display_status
        
        # Check if we need to send alerts
        if [ $API_FAILURES -ge $ALERT_THRESHOLD ]; then
            send_alert "API" "Service has been down for $API_FAILURES consecutive checks"
        fi
        
        if [ $APP_FAILURES -ge $ALERT_THRESHOLD ]; then
            send_alert "App" "Service has been down for $APP_FAILURES consecutive checks"
        fi
        
        if [ $DB_FAILURES -ge $ALERT_THRESHOLD ]; then
            send_alert "Database" "Database connection failed for $DB_FAILURES consecutive checks"
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Run main function
main