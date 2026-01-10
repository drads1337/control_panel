#!/bin/bash
# Quick fix script for 502 Bad Gateway errors

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================"
echo "Quick Fix for 502 Bad Gateway Error"
echo "============================================================"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Check if Docker Compose is available
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Error: docker-compose or docker compose not found"
    exit 1
fi

# Step 2: Check current status
echo "Step 1: Checking current container status..."
echo "---"
$DOCKER_COMPOSE ps api nginx postgres redis 2>/dev/null || echo "⚠ Cannot get container status"
echo ""

# Step 3: Restart API container (most common fix)
echo "Step 2: Restarting API container..."
echo "---"
$DOCKER_COMPOSE restart api
echo "✓ API container restarted"
sleep 5
echo ""

# Step 4: Check if API is responding
echo "Step 3: Waiting for API to be ready (max 30 seconds)..."
echo "---"
MAX_WAIT=30
WAITED=0
API_READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec panel_api curl -s -f -m 3 "http://localhost:5001/api/health/live" > /dev/null 2>&1; then
        API_READY=true
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo -n "."
done
echo ""

if [ "$API_READY" = true ]; then
    echo "✓ API is responding"
else
    echo "⚠ API is not responding after $MAX_WAIT seconds"
    echo "  Checking API logs..."
    $DOCKER_COMPOSE logs api --tail=30 | grep -i -E "(error|exception|traceback|failed)" | tail -10 || true
fi
echo ""

# Step 5: Restart Nginx if API is ready
if [ "$API_READY" = true ]; then
    echo "Step 4: Restarting Nginx to refresh connections..."
    echo "---"
    $DOCKER_COMPOSE restart nginx
    sleep 3
    echo "✓ Nginx restarted"
    echo ""
    
    # Step 6: Test connection from Nginx to API
    echo "Step 5: Testing connection from Nginx to API..."
    echo "---"
    if docker exec panel_nginx curl -s -f -m 5 "http://api:5001/api/health/live" > /dev/null 2>&1; then
        echo "✅ SUCCESS: Nginx can now connect to API"
        echo ""
        echo "The 502 error should be resolved. Test the login endpoint:"
        echo "  curl -X POST https://ovrin.xyz/api/auth/login \\"
        echo "    -H 'Content-Type: application/json' \\"
        echo "    -d '{\"username\":\"your_username\",\"password\":\"your_password\"}'"
    else
        echo "⚠ Nginx still cannot connect to API"
        echo "  This may indicate a deeper issue. Running full diagnostic..."
        echo ""
        if [ -f "$PROJECT_ROOT/scripts/diagnose_502_error.sh" ]; then
            bash "$PROJECT_ROOT/scripts/diagnose_502_error.sh"
        fi
    fi
else
    echo "Step 4: API is not responding. Investigating..."
    echo "---"
    
    # Check if API container is running
    if docker ps --format "{{.Names}}" | grep -q "panel_api"; then
        echo "⚠ API container is running but not responding"
        echo ""
        echo "Checking logs for errors..."
        $DOCKER_COMPOSE logs api --tail=50 | tail -30
        
        echo ""
        echo "Possible causes:"
        echo "  1. Database connection failure"
        echo "  2. Redis connection failure"
        echo "  3. Application crash during startup"
        echo "  4. Port binding issues"
        echo ""
        echo "Try these fixes:"
        echo "  1. Check database and Redis:"
        echo "     $DOCKER_COMPOSE ps postgres redis"
        echo ""
        echo "  2. Restart all services:"
        echo "     $DOCKER_COMPOSE restart"
        echo ""
        echo "  3. Check full API logs:"
        echo "     $DOCKER_COMPOSE logs api --tail=100"
        echo ""
        echo "  4. Rebuild and restart:"
        echo "     $DOCKER_COMPOSE up -d --build api"
    else
        echo "❌ API container is not running"
        echo ""
        echo "Starting API container..."
        $DOCKER_COMPOSE up -d api
        echo ""
        echo "Waiting for startup (10 seconds)..."
        sleep 10
        echo ""
        echo "Check API logs:"
        $DOCKER_COMPOSE logs api --tail=30
    fi
fi

echo ""
echo "============================================================"
echo "Fix attempt completed"
echo "============================================================"
echo ""
