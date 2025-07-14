#!/bin/bash

# Development Helper Script for CapaCity Planner

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $port is already in use."
        read -p "Kill the process using port $port? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -ti:$port | xargs kill -9
            print_status "Process killed."
        else
            print_error "Cannot continue with port $port in use."
            exit 1
        fi
    fi
}

# Main script
case "$1" in
    start)
        print_status "Starting CapaCity Planner development environment..."
        check_docker
        check_port 3000
        check_port 4200
        check_port 5432
        docker compose up -d
        print_status "Services started!"
        print_status "API Gateway: http://localhost:3000"
        print_status "Web Frontend: http://localhost:4200"
        print_status "PostgreSQL: localhost:5432"
        print_status "Run 'pnpm docker:logs' to view logs"
        ;;
    stop)
        print_status "Stopping CapaCity Planner services..."
        docker compose down
        print_status "Services stopped."
        ;;
    restart)
        print_status "Restarting CapaCity Planner services..."
        docker compose restart
        print_status "Services restarted."
        ;;
    rebuild)
        print_status "Rebuilding CapaCity Planner services..."
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        print_status "Services rebuilt and started."
        ;;
    logs)
        docker compose logs -f
        ;;
    status)
        print_status "Checking service status..."
        docker compose ps
        ;;
    shell)
        service=${2:-api-gateway}
        print_status "Opening shell in $service container..."
        docker compose exec $service sh
        ;;
    reset)
        print_warning "This will delete all data and volumes!"
        read -p "Are you sure? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose down -v
            docker compose up -d
            print_status "Environment reset complete."
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|rebuild|logs|status|shell|reset}"
        echo ""
        echo "Commands:"
        echo "  start    - Start all services"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  rebuild  - Rebuild and start all services"
        echo "  logs     - View logs from all services"
        echo "  status   - Check service status"
        echo "  shell    - Open shell in container (default: api-gateway)"
        echo "  reset    - Reset environment (deletes all data)"
        exit 1
        ;;
esac