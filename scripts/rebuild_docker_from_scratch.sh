#!/bin/bash

# Скрипт для полной пересборки Docker с нуля
# Останавливает контейнеры, удаляет образы, создает сертификаты и пересобирает все заново

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  ПОЛНАЯ ПЕРЕСБОРКА DOCKER С НУЛЯ"
echo "=========================================="
echo ""
echo "⚠️  ВНИМАНИЕ: Это удалит все контейнеры и образы проекта!"
echo ""

# Запрос подтверждения
read -p "Продолжить? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 1
fi

echo ""
echo "=== ШАГ 1: Остановка всех контейнеров ==="
docker compose down -v --remove-orphans 2>/dev/null || true
docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker stop 2>/dev/null || true
docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true
echo "✓ Контейнеры остановлены и удалены"
echo ""

echo "=== ШАГ 2: Удаление образов проекта ==="
read -p "Удалить образы проекта? (yes/no): " delete_images
if [ "$delete_images" = "yes" ]; then
    # Удаление образов проекта
    docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "^panel-" | xargs -r docker rmi -f 2>/dev/null || true
    echo "✓ Образы проекта удалены"
else
    echo "Образы сохранены"
fi
echo ""

echo "=== ШАГ 3: Создание сертификатов ==="
# Создание всех необходимых сертификатов
if [ -f "scripts/setup_certificates.sh" ]; then
    ./scripts/setup_certificates.sh
else
    # Fallback: создание базовых сертификатов вручную
    mkdir -p nginx/ssl
    
    # mTLS CA
    if [ ! -f "nginx/ssl/ca-cert.pem" ]; then
        echo "Создание mTLS CA..."
        ./scripts/create_single_ca.sh
        if [ -f "nginx/ssl/ca-cert.pem" ] && [ ! -f "nginx/ssl/ca-bundle.pem" ]; then
            cp nginx/ssl/ca-cert.pem nginx/ssl/ca-bundle.pem
            chmod 644 nginx/ssl/ca-bundle.pem
        fi
    fi
    
    # Self-signed HTTPS сертификат
    if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
        echo "Создание временного HTTPS сертификата..."
        DOMAIN="ovrin.xyz"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=RU/ST=State/L=City/O=Organization/CN=$DOMAIN" \
            -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" 2>/dev/null || true
        chmod 600 nginx/ssl/key.pem 2>/dev/null || true
        chmod 644 nginx/ssl/cert.pem 2>/dev/null || true
    fi
fi
echo "✓ Сертификаты готовы"
echo ""

echo "=== ШАГ 4: Очистка build cache (опционально) ==="
read -p "Очистить build cache? (yes/no): " clean_cache
if [ "$clean_cache" = "yes" ]; then
    docker builder prune -a -f
    echo "✓ Build cache очищен"
else
    echo "Build cache сохранен"
fi
echo ""

echo "=== ШАГ 5: Пересборка и запуск контейнеров ==="
echo "Пересборка образов..."
docker compose build --no-cache

echo ""
echo "Запуск контейнеров..."
docker compose up -d

echo ""
echo "⏳ Ожидание запуска сервисов (10 секунд)..."
sleep 10

echo ""
echo "=== ШАГ 6: Проверка статуса ==="
docker compose ps

echo ""
echo "=== Проверка логов (первые 20 строк) ==="
echo "Nginx:"
docker compose logs --tail=20 nginx 2>/dev/null || echo "Nginx не запущен"
echo ""
echo "API:"
docker compose logs --tail=20 api 2>/dev/null || echo "API не запущен"

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
echo ""
echo "Проверьте статус:"
echo "  docker compose ps"
echo "  docker compose logs -f"
echo ""
echo "Проверьте доступность:"
echo "  curl -k https://localhost/health"
echo ""
