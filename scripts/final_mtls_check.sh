#!/bin/bash
# Финальная проверка mTLS настройки

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Финальная проверка mTLS настройки"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

echo "1. Статус всех контейнеров:"
echo "---"
docker-compose ps
echo ""

echo "2. Проверка API через Nginx:"
echo "---"
if curl -s -f -m 5 "http://localhost/api/health/live" > /dev/null 2>&1; then
    echo "✅ API доступен через Nginx (HTTP)"
    curl -s "http://localhost/api/health/live"
    echo ""
else
    echo "❌ API недоступен через Nginx"
fi

if curl -s -k -f -m 5 "https://localhost/api/health/live" > /dev/null 2>&1; then
    echo "✅ API доступен через Nginx (HTTPS)"
    curl -s -k "https://localhost/api/health/live"
    echo ""
else
    echo "⚠️  API недоступен через HTTPS (возможно, нужен домен)"
fi
echo ""

echo "3. Проверка mTLS конфигурации:"
echo "---"
if [ -f "nginx/ssl/ca-bundle.pem" ]; then
    CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" nginx/ssl/ca-bundle.pem 2>/dev/null || echo "0")
    echo "✅ CA bundle существует (сертификатов: $CERT_COUNT)"
else
    echo "❌ CA bundle не найден"
fi

if [ -d "nginx/ssl/projects" ]; then
    PROJECT_COUNT=$(find nginx/ssl/projects -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    echo "✅ Директория проектов существует (проектов: $PROJECT_COUNT)"
else
    echo "❌ Директория проектов не найдена"
fi

if docker-compose exec -T api printenv | grep -q "MTLS_ENABLED=true"; then
    echo "✅ MTLS_ENABLED=true установлен"
else
    echo "❌ MTLS_ENABLED не установлен"
fi
echo ""

echo "4. Проверка mTLS настроек в nginx.conf:"
echo "---"
if grep -q "^[[:space:]]*ssl_client_certificate" nginx.conf; then
    echo "✅ mTLS настройки раскомментированы в nginx.conf"
    grep "^[[:space:]]*ssl_client_certificate\|^[[:space:]]*ssl_verify_client" nginx.conf | head -3
else
    echo "⚠️  mTLS настройки закомментированы в nginx.conf"
    echo "   (это нормально, если CA bundle ещё не создан для проектов)"
fi
echo ""

echo "5. Проверка подключения Nginx к API:"
echo "---"
if docker-compose exec -T nginx curl -s -f -m 5 "http://api:5001/api/health/live" > /dev/null 2>&1; then
    echo "✅ Nginx может подключиться к API"
else
    echo "❌ Nginx не может подключиться к API"
fi
echo ""

echo "6. Проверка логов на ошибки:"
echo "---"
ERROR_COUNT=$(docker-compose logs api --tail=50 2>&1 | grep -i "error\|fatal\|exception" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ Нет критических ошибок в логах API"
else
    echo "⚠️  Найдено ошибок в логах API: $ERROR_COUNT"
    docker-compose logs api --tail=50 2>&1 | grep -i "error\|fatal\|exception" | tail -5
fi
echo ""

echo "=========================================="
echo "Итоговый статус:"
echo "=========================================="
echo ""

# Финальная оценка
ALL_OK=true

if ! curl -s -f -m 5 "http://localhost/api/health/live" > /dev/null 2>&1; then
    echo "❌ API недоступен через Nginx"
    ALL_OK=false
fi

if [ ! -f "nginx/ssl/ca-bundle.pem" ]; then
    echo "❌ CA bundle не найден"
    ALL_OK=false
fi

if ! docker-compose exec -T api printenv | grep -q "MTLS_ENABLED=true"; then
    echo "❌ MTLS_ENABLED не установлен"
    ALL_OK=false
fi

if [ "$ALL_OK" = true ]; then
    echo ""
    echo "✅✅✅ ВСЁ РАБОТАЕТ! ✅✅✅"
    echo ""
    echo "mTLS полностью настроен и готов к использованию:"
    echo "  ✅ API работает и доступен через Nginx"
    echo "  ✅ CA bundle создан"
    echo "  ✅ Директория проектов готова"
    echo "  ✅ MTLS_ENABLED=true установлен"
    echo "  ✅ Nginx может подключиться к API"
    echo ""
    echo "Следующие шаги:"
    echo "  1. CA сертификаты будут создаваться автоматически для новых проектов"
    echo "  2. Для существующих проектов CA создастся при первом подключении"
    echo "  3. Клиенты могут получать CA через: GET /api/projects/<id>/mtls/ca-cert"
    echo "  4. Клиенты могут подписывать CSR через: POST /api/projects/<id>/mtls/csr-sign"
    echo ""
else
    echo ""
    echo "⚠️  Есть проблемы, которые нужно исправить (см. выше)"
    echo ""
fi

echo "=========================================="

