#!/bin/bash

# Load Test Runner for Stand Capabilities Feature
# This script runs all load tests for the stand capabilities system

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token}"
ORGANIZATION_ID="${ORGANIZATION_ID:-test-org}"
OUTPUT_DIR="${OUTPUT_DIR:-./test-results/load}"
K6_VERSION="${K6_VERSION:-0.47.0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install k6 first."
        log_info "Install k6: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    # Check k6 version
    K6_CURRENT_VERSION=$(k6 version | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | sed 's/v//')
    log_info "k6 version: $K6_CURRENT_VERSION"
    
    # Check if API is running
    log_info "Checking API availability at $BASE_URL..."
    if ! curl -f -s "$BASE_URL/health" > /dev/null; then
        log_error "API is not accessible at $BASE_URL"
        log_info "Please start the API server first"
        exit 1
    fi
    
    log_info "Dependencies check passed"
}

setup_output_dir() {
    log_info "Setting up output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    
    # Create a timestamp for this test run
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    RUN_DIR="$OUTPUT_DIR/run_$TIMESTAMP"
    mkdir -p "$RUN_DIR"
    
    log_info "Test results will be saved to: $RUN_DIR"
}

run_capabilities_load_test() {
    log_info "Running capabilities load test..."
    
    local test_name="capabilities-load-test"
    local output_file="$RUN_DIR/${test_name}.json"
    local html_report="$RUN_DIR/${test_name}.html"
    
    # Run the test
    BASE_URL="$BASE_URL" \
    AUTH_TOKEN="$AUTH_TOKEN" \
    ORGANIZATION_ID="$ORGANIZATION_ID" \
    k6 run \
        --out json="$output_file" \
        --summary-time-unit=ms \
        --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
        ./capabilities-load-test.js
    
    local exit_code=$?
    
    # Generate HTML report if jq is available
    if command -v jq &> /dev/null; then
        log_info "Generating HTML report..."
        generate_html_report "$output_file" "$html_report" "$test_name"
    fi
    
    if [ $exit_code -eq 0 ]; then
        log_info "Capabilities load test completed successfully"
    else
        log_error "Capabilities load test failed with exit code $exit_code"
    fi
    
    return $exit_code
}

run_validation_load_test() {
    log_info "Running validation load test..."
    
    local test_name="validation-load-test"
    local output_file="$RUN_DIR/${test_name}.json"
    local html_report="$RUN_DIR/${test_name}.html"
    
    # Run the test
    BASE_URL="$BASE_URL" \
    AUTH_TOKEN="$AUTH_TOKEN" \
    ORGANIZATION_ID="$ORGANIZATION_ID" \
    k6 run \
        --out json="$output_file" \
        --summary-time-unit=ms \
        --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
        ./validation-load-test.js
    
    local exit_code=$?
    
    # Generate HTML report if jq is available
    if command -v jq &> /dev/null; then
        log_info "Generating HTML report..."
        generate_html_report "$output_file" "$html_report" "$test_name"
    fi
    
    if [ $exit_code -eq 0 ]; then
        log_info "Validation load test completed successfully"
    else
        log_error "Validation load test failed with exit code $exit_code"
    fi
    
    return $exit_code
}

generate_html_report() {
    local json_file="$1"
    local html_file="$2"
    local test_name="$3"
    
    cat > "$html_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Load Test Report - $test_name</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .success { background-color: #d4edda; }
        .warning { background-color: #fff3cd; }
        .error { background-color: #f8d7da; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Load Test Report: $test_name</h1>
    <p>Generated: $(date)</p>
    
    <h2>Test Summary</h2>
    <div id="summary">
        <p>Processing results from: $json_file</p>
    </div>
    
    <h2>Performance Metrics</h2>
    <div id="metrics">
        <p>See JSON file for detailed metrics: $json_file</p>
    </div>
    
    <h2>Test Configuration</h2>
    <ul>
        <li>Base URL: $BASE_URL</li>
        <li>Organization ID: $ORGANIZATION_ID</li>
        <li>Test Duration: See k6 stages configuration</li>
    </ul>
</body>
</html>
EOF
}

run_stress_test() {
    log_info "Running stress test..."
    
    local test_name="stress-test"
    local output_file="$RUN_DIR/${test_name}.json"
    
    # Create a stress test configuration
    cat > "./stress-test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 500 },  // Ramp up to 500 users (stress)
    { duration: '10m', target: 500 }, // Stay at 500 users
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s (relaxed for stress)
    http_req_failed: ['rate<0.2'],     // 20% error rate acceptable under stress
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';
const ORGANIZATION_ID = __ENV.ORGANIZATION_ID || 'test-org';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'X-Organization-ID': ORGANIZATION_ID,
  };
}

export default function() {
  const standId = 'stand-001';
  const url = `${BASE_URL}/api/v1/stands/${standId}/capabilities`;
  
  const response = http.get(url, { headers: getHeaders() });
  
  const success = check(response, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  sleep(0.1); // Minimal sleep for stress testing
}
EOF
    
    # Run stress test
    BASE_URL="$BASE_URL" \
    AUTH_TOKEN="$AUTH_TOKEN" \
    ORGANIZATION_ID="$ORGANIZATION_ID" \
    k6 run \
        --out json="$output_file" \
        --summary-time-unit=ms \
        ./stress-test.js
    
    local exit_code=$?
    
    # Clean up temporary stress test file
    rm -f "./stress-test.js"
    
    if [ $exit_code -eq 0 ]; then
        log_info "Stress test completed successfully"
    else
        log_warn "Stress test failed with exit code $exit_code (expected under extreme load)"
    fi
    
    return $exit_code
}

generate_summary_report() {
    log_info "Generating summary report..."
    
    local summary_file="$RUN_DIR/summary.md"
    
    cat > "$summary_file" << EOF
# Load Test Summary Report

**Test Run:** $(date)
**Base URL:** $BASE_URL
**Organization:** $ORGANIZATION_ID

## Test Results

### Capabilities Load Test
- **File:** capabilities-load-test.json
- **Status:** $([ -f "$RUN_DIR/capabilities-load-test.json" ] && echo "Completed" || echo "Failed")

### Validation Load Test
- **File:** validation-load-test.json
- **Status:** $([ -f "$RUN_DIR/validation-load-test.json" ] && echo "Completed" || echo "Failed")

### Stress Test
- **File:** stress-test.json
- **Status:** $([ -f "$RUN_DIR/stress-test.json" ] && echo "Completed" || echo "Failed")

## Performance Criteria

### Expected Performance
- **Single Stand Query:** < 200ms (95th percentile)
- **Capability Update:** < 1000ms (95th percentile)
- **Validation:** < 500ms (95th percentile)
- **Bulk Operations:** < 2000ms (95th percentile)

### Load Handling
- **Concurrent Users:** Up to 100 users
- **Requests per Second:** 1000+ RPS
- **Error Rate:** < 10%

## Files Generated
- JSON results for each test
- HTML reports (if jq available)
- This summary report

## Next Steps
1. Review JSON files for detailed metrics
2. Check HTML reports for visual analysis
3. Compare results against performance criteria
4. Identify bottlenecks and optimization opportunities
EOF
    
    log_info "Summary report generated: $summary_file"
}

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL          Base URL for API (default: http://localhost:3000)"
    echo "  -t, --token TOKEN      Authentication token"
    echo "  -o, --org ORG_ID       Organization ID"
    echo "  -d, --output DIR       Output directory (default: ./test-results/load)"
    echo "  -s, --stress           Run stress test only"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL               Base URL for API"
    echo "  AUTH_TOKEN             Authentication token"
    echo "  ORGANIZATION_ID        Organization ID"
    echo "  OUTPUT_DIR             Output directory"
    echo ""
    echo "Examples:"
    echo "  $0                                          # Run all tests with defaults"
    echo "  $0 -u http://localhost:3000 -t mytoken     # Run with custom URL and token"
    echo "  $0 --stress                                 # Run stress test only"
}

# Main execution
main() {
    log_info "Starting load test suite for Stand Capabilities"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--url)
                BASE_URL="$2"
                shift 2
                ;;
            -t|--token)
                AUTH_TOKEN="$2"
                shift 2
                ;;
            -o|--org)
                ORGANIZATION_ID="$2"
                shift 2
                ;;
            -d|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -s|--stress)
                STRESS_ONLY=true
                shift
                ;;
            -h|--help)
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
    
    # Setup
    check_dependencies
    setup_output_dir
    
    # Run tests
    local overall_exit_code=0
    
    if [ "$STRESS_ONLY" = true ]; then
        run_stress_test
        overall_exit_code=$?
    else
        run_capabilities_load_test
        if [ $? -ne 0 ]; then overall_exit_code=1; fi
        
        run_validation_load_test
        if [ $? -ne 0 ]; then overall_exit_code=1; fi
        
        run_stress_test
        # Don't fail overall if stress test fails (expected under extreme load)
    fi
    
    # Generate summary
    generate_summary_report
    
    # Final status
    if [ $overall_exit_code -eq 0 ]; then
        log_info "All load tests completed successfully"
        log_info "Results saved to: $RUN_DIR"
    else
        log_error "Some load tests failed"
        log_info "Check results in: $RUN_DIR"
    fi
    
    exit $overall_exit_code
}

# Run main function
main "$@"