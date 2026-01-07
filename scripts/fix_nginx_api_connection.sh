#!/bin/bash
# Исправление проблемы подключения Nginx к API

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Диагностика и исправление подключения Nginx к API"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

echo "1. Проверка статуса контейнеров..."
docker-compose ps api nginx
echo ""

echo "2. Проверка сети Docker..."
NETWORK_NAME=$(docker-compose ps -q api | xargs docker inspect --format='{{range $net, $v := .NetworkSettings.Networks}}{{$net}}{{end}}' 2>/dev/null | head -1)
if [ -z "$NETWORK_NAME" ]; then
    NETWORK_NAME="panel_panel_network"
fi
echo "Сеть: $NETWORK_NAME"
echo ""

echo "3. Проверка IP адреса API контейнера..."
API_IP=$(docker-compose exec -T api hostname -i 2>/dev/null | awk '{print $1}' || docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' panel_api)
echo "API IP: $API_IP"
echo ""

echo "4. Проверка доступности API напрямую..."
if curl -s -f -m 5 "http://$API_IP:5001/api/health/live" > /dev/null 2>&1; then
    echo "✓ API доступен по IP: $API_IP:5001"
else
    echo "✗ API недоступен по IP: $API_IP:5001"
fi
echo ""

echo "5. Проверка DNS резолвинга из Nginx контейнера..."
if docker-compose exec -T nginx nslookup api > /dev/null 2>&1 || docker-compose exec -T nginx getent hosts api > /dev/null 2>&1; then
    echo "✓ DNS резолвинг работает"
    RESOLVED_IP=$(docker-compose exec -T nginx getent hosts api | awk '{print $1}' || docker-compose exec -T nginx nslookup api | grep -A1 "Name:" | tail -1 | awk '{print $2}')
    echo "  api резолвится в: $RESOLVED_IP"
else
    echo "✗ DNS резолвинг не работает"
fi
echo ""

echo "6. Проверка подключения из Nginx к API..."
if docker-compose exec -T nginx curl -s -f -m 5 "http://api:5001/api/health/live" > /dev/null 2>&1; then
    echo "✓ Nginx может подключиться к API"
else
    echo "✗ Nginx не может подключиться к API"
    echo "  Попытка подключения к api:5001..."
    docker-compose exec -T nginx curl -v -m 5 "http://api:5001/api/health/live" 2>&1 | head -10 || true
fi
echo ""

echo "7. Проверка, что API слушает на правильном порту..."
if docker-compose exec -T api netstat -tlnp 2>/dev/null | grep -q ":5001" || docker-compose exec -T api ss -tlnp 2>/dev/null | grep -q ":5001"; then
    echo "✓ API слушает на порту 5001"
else
    echo "✗ API не слушает на порту 5001"
    echo "  Проверка процессов..."
    docker-compose exec -T api ps aux | grep -E "gunicorn|python" | head -5 || true
fi
echo ""

echo "8. Проверка логов API на наличие ошибок..."
echo "--- Последние 5 строк логов API ---"
docker-compose logs api --tail=5 2>&1 | tail -5
echo ""

echo "9. Попытка исправления..."
echo ""

# Проверка, что контейнеры в одной сети
API_NETWORKS=$(docker inspect panel_api --format='{{range $net, $v := .NetworkSettings.Networks}}{{$net}} {{end}}' 2>/dev/null)
NGINX_NETWORKS=$(docker inspect panel_nginx --format='{{range $net, $v := .NetworkSettings.Networks}}{{$net}} {{end}}' 2>/dev/null)

if [ -z "$API_NETWORKS" ] || [ -z "$NGINX_NETWORKS" ]; then
    echo "⚠ Не удалось определить сети контейнеров"
else
    echo "API сети: $API_NETWORKS"
    echo "Nginx сети: $NGINX_NETWORKS"
    
    # Проверка, есть ли общая сеть
    COMMON_NETWORK=""
    for api_net in $API_NETWORKS; do
        for nginx_net in $NGINX_NETWORKS; do
            if [ "$api_net" = "$nginx_net" ]; then
                COMMON_NETWORK="$api_net"
                break 2
            fi
        done
    done
    
    if [ -n "$COMMON_NETWORK" ]; then
        echo "✓ Контейнеры в общей сети: $COMMON_NETWORK"
    else
        echo "✗ Контейнеры не в общей сети!"
        echo "  Перезапуск контейнеров для исправления..."
        docker-compose restart api nginx
        sleep 5
    fi
fi
echo ""

echo "10. Финальная проверка..."
sleep 3
if docker-compose exec -T nginx curl -s -f -m 5 "http://api:5001/api/health/live" > /dev/null 2>&1; then
    echo "✅ Проблема решена! Nginx может подключиться к API"
else
    echo "⚠ Проблема сохраняется. Рекомендуется:"
    echo "  1. Перезапустить все контейнеры: docker-compose restart"
    echo "  2. Проверить логи: docker-compose logs nginx | grep -i error"
    echo "  3. Проверить, что API запущен: docker-compose ps api"
fi
echo ""

echo "=========================================="
echo "Диагностика завершена"
echo "=========================================="

