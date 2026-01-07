#!/bin/bash
# Проверка статуса всех сервисов после настройки mTLS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Проверка статуса сервисов"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

echo "1. Статус контейнеров:"
echo "---"
docker-compose ps
echo ""

echo "2. Проверка API (должен быть healthy):"
echo "---"
if docker-compose ps api | grep -q "healthy"; then
    echo "✓ API работает (healthy)"
else
    echo "✗ API не healthy - проверьте логи"
    docker-compose logs api --tail=10
fi
echo ""

echo "3. Проверка Nginx (логи последних 10 строк):"
echo "---"
docker-compose logs nginx --tail=10 2>&1 | tail -10
echo ""

echo "4. Проверка доступности Nginx:"
echo "---"
if curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null | grep -q "200"; then
    echo "✓ Nginx отвечает на /health"
else
    echo "⚠ Nginx не отвечает на /health (возможно, это нормально, если healthcheck не настроен)"
fi
echo ""

echo "5. Проверка доступности API через Nginx:"
echo "---"
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health/live 2>/dev/null | grep -q "200"; then
    echo "✓ API доступен через Nginx"
else
    echo "⚠ API не доступен через Nginx - проверьте конфигурацию"
fi
echo ""

echo "6. Проверка CA bundle:"
echo "---"
BUNDLE_PATH="$PROJECT_ROOT/nginx/ssl/ca-bundle.pem"
if [ -f "$BUNDLE_PATH" ]; then
    CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" "$BUNDLE_PATH" 2>&1 || echo "0")
    echo "✓ CA bundle существует: $BUNDLE_PATH"
    echo "  Сертификатов: $CERT_COUNT"
else
    echo "✗ CA bundle не найден: $BUNDLE_PATH"
fi
echo ""

echo "7. Проверка директории проектов:"
echo "---"
PROJECTS_DIR="$PROJECT_ROOT/nginx/ssl/projects"
if [ -d "$PROJECTS_DIR" ]; then
    PROJECT_COUNT=$(find "$PROJECTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    echo "✓ Директория проектов существует: $PROJECTS_DIR"
    echo "  Проектов с CA: $PROJECT_COUNT"
else
    echo "✗ Директория проектов не найдена: $PROJECTS_DIR"
fi
echo ""

echo "8. Проверка переменных окружения mTLS:"
echo "---"
if docker-compose exec -T api printenv | grep -q "MTLS_ENABLED=true"; then
    echo "✓ MTLS_ENABLED=true установлен"
else
    echo "⚠ MTLS_ENABLED не установлен в true"
fi
echo ""

echo "=========================================="
echo "Итоговая оценка:"
echo "=========================================="
echo ""

# Проверка критических компонентов
CRITICAL_OK=true

if ! docker-compose ps api | grep -q "healthy"; then
    echo "✗ API не healthy - КРИТИЧНО"
    CRITICAL_OK=false
else
    echo "✓ API работает"
fi

if [ ! -f "$BUNDLE_PATH" ]; then
    echo "✗ CA bundle не найден - КРИТИЧНО для mTLS"
    CRITICAL_OK=false
else
    echo "✓ CA bundle существует"
fi

if [ ! -d "$PROJECTS_DIR" ]; then
    echo "✗ Директория проектов не найдена - КРИТИЧНО"
    CRITICAL_OK=false
else
    echo "✓ Директория проектов существует"
fi

echo ""
if [ "$CRITICAL_OK" = true ]; then
    echo "✅ Все критические компоненты работают!"
    echo ""
    echo "mTLS настроен и готов к использованию."
    echo "CA сертификаты будут создаваться автоматически для проектов."
else
    echo "⚠ Есть критические проблемы - проверьте выше"
fi

echo ""

