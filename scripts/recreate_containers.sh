#!/bin/bash

# Скрипт для пересоздания всех контейнеров

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  ПЕРЕСОЗДАНИЕ КОНТЕЙНЕРОВ"
echo "=========================================="
echo ""

# Проверка наличия docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Файл docker-compose.yml не найден!"
    exit 1
fi

# Пересоздание контейнеров
echo "=== Пересоздание контейнеров ==="
echo "Используется: docker-compose.yml"

# Проверка наличия docker-compose.prod.yml
if [ -f "docker-compose.prod.yml" ]; then
    echo "Также используется: docker-compose.prod.yml"
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
else
    docker compose up -d --build
fi

echo ""
echo "⏳ Ожидание запуска контейнеров (5 секунд)..."
sleep 5

echo ""
echo "=== Статус контейнеров ==="
docker compose ps || docker-compose ps

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
echo ""
echo "Проверьте логи, если есть проблемы:"
echo "  docker compose logs"
echo ""
echo "Для просмотра конкретного сервиса:"
echo "  docker compose logs nginx"
echo "  docker compose logs api"
echo ""
