#!/bin/bash
# Diagnostic script for 502 Bad Gateway errors on /api/auth/login

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================"
echo "Diagnosing 502 Bad Gateway Error for /api/auth/login"
echo "============================================================"
echo ""

cd "$PROJECT_ROOT"

# Check 1: Docker containers status
echo "1. Checking Docker container status..."
echo "---"
if command -v docker-compose &> /dev/null; then
    docker-compose ps api nginx postgres redis 2>/dev/null || docker ps -a | grep -E "panel_api|panel_nginx|panel_postgres|panel_redis" || echo "⚠ Cannot access Docker. Please run with sudo or check Docker permissions."
else
    echo "⚠ docker-compose not found. Trying docker compose..."
    docker compose ps api nginx postgres redis 2>/dev/null || echo "⚠ Cannot access Docker Compose"
fi
echo ""

# Check 2: API container health
echo "2. Checking API container health..."
echo "---"
if docker ps --format "{{.Names}}\t{{.Status}}" | grep -q "panel_api"; then
    API_STATUS=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep "panel_api" | awk '{print $2" "$3" "$4" "$5}')
    echo "API Container Status: $API_STATUS"
    
    if echo "$API_STATUS" | grep -q "Up"; then
        echo "✓ API container is running"
    else
        echo "✗ API container is not running properly"
    fi
    
    if echo "$API_STATUS" | grep -q "(healthy)"; then
        echo "✓ API container is healthy"
    else
        echo "⚠ API container health check may be failing"
    fi
else
    echo "✗ API container not found or not running"
fi
echo ""

# Check 3: Check API logs for errors
echo "3. Checking recent API logs for errors..."
echo "---"
docker logs panel_api --tail 30 2>&1 | grep -i -E "(error|exception|traceback|failed|cannot|unable|timeout|502|bad gateway)" | tail -10 || echo "⚠ Cannot access API logs"
echo ""

# Check 4: Test direct connection to API
echo "4. Testing direct connection to API container..."
echo "---"
if docker exec panel_api curl -s -f -m 5 "http://localhost:5001/api/health/live" > /dev/null 2>&1; then
    echo "✓ API responds to health check from inside container"
    docker exec panel_api curl -s "http://localhost:5001/api/health/live" | head -3
else
    echo "✗ API does not respond to health check from inside container"
    echo "  This indicates the API application itself is not running or crashed"
fi
echo ""

# Check 5: Test connection from Nginx to API
echo "5. Testing connection from Nginx container to API..."
echo "---"
if docker exec panel_nginx curl -s -f -m 5 "http://api:5001/api/health/live" > /dev/null 2>&1; then
    echo "✓ Nginx can connect to API (network connectivity OK)"
    docker exec panel_nginx curl -s "http://api:5001/api/health/live" | head -3
else
    echo "✗ Nginx cannot connect to API"
    echo "  Attempting detailed connection test..."
    docker exec panel_nginx curl -v -m 5 "http://api:5001/api/health/live" 2>&1 | head -20 || true
    echo ""
    echo "  Checking DNS resolution from Nginx..."
    docker exec panel_nginx getent hosts api 2>&1 || docker exec panel_nginx nslookup api 2>&1 || echo "  DNS resolution may be failing"
fi
echo ""

# Check 6: Check if Gunicorn process is running
echo "6. Checking if Gunicorn process is running in API container..."
echo "---"
if docker exec panel_api ps aux 2>/dev/null | grep -q "[g]unicorn"; then
    echo "✓ Gunicorn process is running"
    docker exec panel_api ps aux 2>/dev/null | grep "[g]unicorn" | head -3
else
    echo "✗ Gunicorn process is not running"
    echo "  Checking all Python processes..."
    docker exec panel_api ps aux 2>/dev/null | grep python | head -5 || echo "  No Python processes found"
fi
echo ""

# Check 7: Check if port 5001 is listening
echo "7. Checking if port 5001 is listening in API container..."
echo "---"
if docker exec panel_api netstat -tlnp 2>/dev/null | grep -q ":5001" || docker exec panel_api ss -tlnp 2>/dev/null | grep -q ":5001"; then
    echo "✓ Port 5001 is listening"
    docker exec panel_api netstat -tlnp 2>/dev/null | grep ":5001" || docker exec panel_api ss -tlnp 2>/dev/null | grep ":5001"
else
    echo "✗ Port 5001 is not listening"
    echo "  This means the API server is not running or crashed"
fi
echo ""

# Check 8: Check Nginx error logs
echo "8. Checking Nginx error logs..."
echo "---"
if docker exec panel_nginx tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i -E "(502|bad gateway|upstream|api)" | tail -10; then
    echo "Found relevant Nginx errors above"
else
    echo "⚠ No relevant errors found in Nginx logs (or cannot access logs)"
    echo "  Last 5 lines of Nginx error log:"
    docker exec panel_nginx tail -5 /var/log/nginx/error.log 2>/dev/null || echo "  Cannot access Nginx logs"
fi
echo ""

# Check 9: Database and Redis connectivity
echo "9. Checking database and Redis connectivity from API..."
echo "---"
if docker exec panel_api curl -s -f -m 5 "http://localhost:5001/api/health/ready" > /dev/null 2>&1; then
    echo "✓ API readiness check passed (DB and Redis OK)"
    docker exec panel_api curl -s "http://localhost:5001/api/health/ready" | head -5
else
    echo "✗ API readiness check failed"
    echo "  This may indicate database or Redis connectivity issues"
    docker exec panel_api curl -s "http://localhost:5001/api/health/ready" 2>&1 | head -10 || echo "  Cannot check readiness"
fi
echo ""

# Check 10: Network connectivity
echo "10. Checking Docker network configuration..."
echo "---"
API_NETWORK=$(docker inspect panel_api --format='{{range $net, $v := .NetworkSettings.Networks}}{{$net}}{{end}}' 2>/dev/null | head -1)
NGINX_NETWORK=$(docker inspect panel_nginx --format='{{range $net, $v := .NetworkSettings.Networks}}{{$net}}{{end}}' 2>/dev/null | head -1)

if [ -n "$API_NETWORK" ] && [ -n "$NGINX_NETWORK" ]; then
    echo "API Network: $API_NETWORK"
    echo "Nginx Network: $NGINX_NETWORK"
    if [ "$API_NETWORK" = "$NGINX_NETWORK" ]; then
        echo "✓ Both containers are on the same network"
    else
        echo "✗ Containers are on different networks!"
        echo "  This will prevent Nginx from connecting to API"
    fi
else
    echo "⚠ Cannot determine network configuration"
fi
echo ""

# Summary and recommendations
echo "============================================================"
echo "Diagnostic Summary and Recommendations"
echo "============================================================"
echo ""

# Determine likely cause and provide fix
if ! docker ps --format "{{.Names}}" | grep -q "panel_api"; then
    echo "❌ ISSUE FOUND: API container is not running"
    echo ""
    echo "RECOMMENDED FIX:"
    echo "  cd $PROJECT_ROOT"
    echo "  docker-compose up -d api"
    echo "  docker-compose logs -f api"
    echo ""
elif ! docker exec panel_api ps aux 2>/dev/null | grep -q "[g]unicorn"; then
    echo "❌ ISSUE FOUND: Gunicorn process is not running in API container"
    echo ""
    echo "RECOMMENDED FIX:"
    echo "  1. Check API logs for startup errors:"
    echo "     docker-compose logs api --tail=100"
    echo ""
    echo "  2. Restart the API container:"
    echo "     docker-compose restart api"
    echo ""
    echo "  3. If issues persist, rebuild:"
    echo "     docker-compose up -d --build api"
    echo ""
elif ! docker exec panel_api curl -s -f -m 5 "http://localhost:5001/api/health/live" > /dev/null 2>&1; then
    echo "❌ ISSUE FOUND: API is not responding to requests"
    echo ""
    echo "RECOMMENDED FIX:"
    echo "  1. Check for application errors:"
    echo "     docker-compose logs api --tail=100 | grep -i error"
    echo ""
    echo "  2. Check database/Redis connectivity:"
    echo "     docker-compose logs postgres redis"
    echo ""
    echo "  3. Restart all services:"
    echo "     docker-compose restart"
    echo ""
elif ! docker exec panel_nginx curl -s -f -m 5 "http://api:5001/api/health/live" > /dev/null 2>&1; then
    echo "❌ ISSUE FOUND: Network connectivity problem between Nginx and API"
    echo ""
    echo "RECOMMENDED FIX:"
    echo "  1. Restart both containers:"
    echo "     docker-compose restart api nginx"
    echo ""
    echo "  2. Verify they're on the same network:"
    echo "     docker network inspect panel_panel_network"
    echo ""
    echo "  3. If network issue persists, recreate containers:"
    echo "     docker-compose down"
    echo "     docker-compose up -d"
    echo ""
else
    echo "⚠ No obvious issues found, but 502 error persists"
    echo ""
    echo "RECOMMENDED ACTIONS:"
    echo "  1. Check Nginx configuration:"
    echo "     Review nginx.conf upstream configuration"
    echo ""
    echo "  2. Test login endpoint directly:"
    echo "     curl -X POST https://ovrin.xyz/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' -v"
    echo ""
    echo "  3. Check for rate limiting:"
    echo "     Review Nginx access logs for rate limit errors"
    echo ""
    echo "  4. Restart all services:"
    echo "     docker-compose restart"
    echo ""
fi

echo ""
echo "For detailed logs, run:"
echo "  docker-compose logs api --tail=100"
echo "  docker-compose logs nginx --tail=100"
echo ""
