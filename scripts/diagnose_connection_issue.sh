#!/bin/bash
# Полная диагностика проблемы подключения

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

DOMAIN="ovrin.xyz"
SERVER_IP="38.242.149.188"

echo "=========================================="
echo "Диагностика проблемы подключения"
echo "=========================================="
echo ""

echo "1. Проверка статуса контейнеров:"
echo "---"
docker-compose ps | head -10
echo ""

echo "2. Проверка SSL конфигурации в nginx.conf:"
echo "---"
echo "Используется Let's Encrypt?"
if grep -q "^[[:space:]]*ssl_certificate /etc/letsencrypt/live" nginx.conf; then
    echo "✅ Да, используется Let's Encrypt"
    grep "^[[:space:]]*ssl_certificate" nginx.conf | head -2
elif grep -q "^[[:space:]]*ssl_certificate /etc/nginx/ssl" nginx.conf; then
    echo "❌ Нет, используется самоподписанный сертификат"
    grep "^[[:space:]]*ssl_certificate" nginx.conf | head -2
    echo ""
    echo "⚠️  Нужно переключиться на Let's Encrypt:"
    echo "   ./scripts/switch_to_letsencrypt.sh"
else
    echo "⚠️  SSL конфигурация не найдена"
fi
echo ""

echo "3. Проверка наличия Let's Encrypt сертификатов:"
echo "---"
if [ -f "letsencrypt/live/ovrin.xyz/fullchain.pem" ]; then
    echo "✅ Let's Encrypt сертификаты найдены"
    ls -lh letsencrypt/live/ovrin.xyz/*.pem 2>/dev/null || echo "Сертификаты есть, но пути могут отличаться"
else
    echo "❌ Let's Encrypt сертификаты не найдены"
fi
echo ""

echo "4. Проверка доступности домена по HTTP (локально):"
echo "---"
if curl -s -f -m 5 -H "Host: $DOMAIN" "http://localhost" > /dev/null 2>&1; then
    echo "✅ HTTP работает локально"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $DOMAIN" "http://localhost" 2>&1)
    echo "   HTTP статус: $HTTP_STATUS"
else
    echo "❌ HTTP не работает локально"
fi
echo ""

echo "5. Проверка доступности домена по HTTPS (локально):"
echo "---"
if curl -s -k -f -m 5 -H "Host: $DOMAIN" "https://localhost" > /dev/null 2>&1; then
    echo "✅ HTTPS работает локально"
    HTTPS_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" -H "Host: $DOMAIN" "https://localhost" 2>&1)
    echo "   HTTPS статус: $HTTPS_STATUS"
else
    HTTPS_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" -H "Host: $DOMAIN" "https://localhost" 2>&1 || echo "FAILED")
    echo "⚠️  HTTPS локально: $HTTPS_STATUS"
fi
echo ""

echo "6. Проверка API через Nginx (локально):"
echo "---"
if curl -s -f -m 5 -H "Host: $DOMAIN" "http://localhost/api/health/live" > /dev/null 2>&1; then
    echo "✅ API доступен через Nginx (HTTP)"
    API_RESPONSE=$(curl -s -H "Host: $DOMAIN" "http://localhost/api/health/live" 2>&1 | head -1)
    echo "   Ответ: $API_RESPONSE"
else
    echo "❌ API недоступен через Nginx (HTTP)"
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $DOMAIN" "http://localhost/api/health/live" 2>&1 || echo "FAILED")
    echo "   Статус: $API_STATUS"
fi
echo ""

echo "7. Проверка последних запросов в логах Nginx:"
echo "---"
LAST_REQUESTS=$(docker-compose logs nginx --tail=20 2>&1 | grep "remote_addr" | tail -5)
if [ -z "$LAST_REQUESTS" ]; then
    echo "⚠️  Нет запросов в логах Nginx (возможно, трафик не доходит до сервера)"
else
    echo "Последние запросы:"
    echo "$LAST_REQUESTS"
fi
echo ""

echo "8. Проверка ошибок в логах Nginx:"
echo "---"
NGINX_ERRORS=$(docker-compose logs nginx --tail=50 2>&1 | grep -i "error\|failed\|timeout" | tail -5)
if [ -z "$NGINX_ERRORS" ]; then
    echo "✅ Нет критических ошибок в логах Nginx"
else
    echo "⚠️  Найдены ошибки:"
    echo "$NGINX_ERRORS"
fi
echo ""

echo "9. Проверка подключений Nginx к API:"
echo "---"
NGINX_API=$(docker-compose logs nginx --tail=50 2>&1 | grep -i "connect.*failed\|upstream.*failed" | tail -3)
if [ -z "$NGINX_API" ]; then
    echo "✅ Нет ошибок подключения Nginx к API"
else
    echo "⚠️  Найдены проблемы подключения:"
    echo "$NGINX_API"
fi
echo ""

echo "10. Проверка портов:"
echo "---"
if netstat -tlnp 2>/dev/null | grep -q ":80\|:443" || ss -tlnp 2>/dev/null | grep -q ":80\|:443"; then
    echo "✅ Порты 80 и 443 открыты на сервере"
    netstat -tlnp 2>/dev/null | grep ":80\|:443" || ss -tlnp 2>/dev/null | grep ":80\|:443"
else
    echo "❌ Порты 80 и 443 не слушаются"
fi
echo ""

echo "=========================================="
echo "Диагностика завершена"
echo "=========================================="
echo ""
echo "Если HTTP работает локально, но недоступен извне:"
echo "  1. Проверьте файрвол провайдера (Contabo) - разрешите порты 80/443"
echo "  2. Попробуйте подключиться напрямую по IP: http://$SERVER_IP"
echo ""
echo "Если используется самоподписанный сертификат:"
echo "  ./scripts/switch_to_letsencrypt.sh"
echo ""
echo "Для мониторинга в реальном времени:"
echo "  docker-compose logs -f nginx"
echo ""

