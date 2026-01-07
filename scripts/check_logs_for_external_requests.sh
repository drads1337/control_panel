#!/bin/bash
# Проверка логов на наличие внешних запросов

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Анализ логов на наличие внешних запросов"
echo "=========================================="
echo ""

# Проверить последние 100 строк логов Nginx
echo "1. Последние 100 строк логов Nginx:"
echo "---"
docker-compose logs nginx --tail=100 2>&1 | tail -100
echo ""

# Проверить, есть ли запросы с внешних IP (не 172.18.x.x и не 127.0.0.1)
echo "2. Поиск запросов с внешних IP адресов:"
echo "---"
EXTERNAL_REQUESTS=$(docker-compose logs nginx 2>&1 | grep -v "172.18.0" | grep -v "127.0.0.1" | grep -v "::1" | grep "remote_addr" | tail -20)

if [ -z "$EXTERNAL_REQUESTS" ]; then
    echo "❌ Нет запросов с внешних IP адресов!"
    echo "   Это означает, что трафик блокируется до Nginx."
    echo ""
    echo "   Возможные причины:"
    echo "   1. Файрвол провайдера (Contabo) блокирует порты 80/443"
    echo "   2. iptables блокирует (но мы уже открыли)"
    echo "   3. Доменное имя ещё не распространилось в DNS"
    echo ""
else
    echo "✅ Найдены запросы с внешних IP:"
    echo "$EXTERNAL_REQUESTS"
fi
echo ""

# Проверить последние ошибки Nginx
echo "3. Последние ошибки Nginx:"
echo "---"
ERRORS=$(docker-compose logs nginx 2>&1 | grep -i "error\|failed\|timeout" | tail -10)
if [ -z "$ERRORS" ]; then
    echo "✅ Нет ошибок в логах Nginx"
else
    echo "⚠️  Найдены ошибки:"
    echo "$ERRORS"
fi
echo ""

# Проверить последние ошибки API
echo "4. Последние ошибки API:"
echo "---"
API_ERRORS=$(docker-compose logs api --tail=50 2>&1 | grep -i "error\|exception\|failed" | tail -10)
if [ -z "$API_ERRORS" ]; then
    echo "✅ Нет критических ошибок в логах API"
else
    echo "⚠️  Найдены ошибки:"
    echo "$API_ERRORS"
fi
echo ""

# Проверить подключения Nginx к API
echo "5. Проверка подключений Nginx к API:"
echo "---"
NGINX_API_CONN=$(docker-compose logs nginx 2>&1 | grep -i "connect.*failed\|upstream" | tail -5)
if [ -z "$NGINX_API_CONN" ]; then
    echo "✅ Нет ошибок подключения Nginx к API"
else
    echo "⚠️  Найдены проблемы подключения:"
    echo "$NGINX_API_CONN"
fi
echo ""

# Статистика запросов
echo "6. Статистика запросов (последние 50):"
echo "---"
echo "Всего запросов в логах: $(docker-compose logs nginx 2>&1 | grep -c "remote_addr" || echo "0")"
echo "Запросов с Docker сети (172.18.0.x): $(docker-compose logs nginx 2>&1 | grep -c "172.18.0" || echo "0")"
echo "Запросов с localhost (127.0.0.1): $(docker-compose logs nginx 2>&1 | grep -c "127.0.0.1" || echo "0")"
echo "Запросов с внешних IP: $(docker-compose logs nginx 2>&1 | grep -v "172.18.0" | grep -v "127.0.0.1" | grep -c "remote_addr" || echo "0")"
echo ""

echo "=========================================="
echo "Рекомендации:"
echo "=========================================="
echo ""
echo "Если нет запросов с внешних IP:"
echo "  1. Проверьте файрвол провайдера (Contabo) - разрешите порты 80/443"
echo "  2. Проверьте через онлайн-сервис: https://www.canyouseeme.org/"
echo "  3. Попробуйте подключиться напрямую по IP: curl http://38.242.149.188"
echo ""
echo "Для мониторинга в реальном времени запустите:"
echo "  ./scripts/monitor_logs.sh"
echo ""
echo "=========================================="

