#!/bin/bash

# Скрипт для удаления всех контейнеров проекта

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  УДАЛЕНИЕ ВСЕХ КОНТЕЙНЕРОВ"
echo "=========================================="
echo ""

# Остановка и удаление через docker-compose
if [ -f "docker-compose.yml" ]; then
    echo "Остановка контейнеров через docker-compose..."
    docker compose down -v 2>/dev/null || docker-compose down -v 2>/dev/null || true
    echo "✓ Контейнеры остановлены через docker-compose"
fi

# Удаление всех контейнеров проекта по имени
echo "Удаление всех контейнеров проекта..."
docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true
echo "✓ Контейнеры удалены"

# Показать оставшиеся контейнеры
echo ""
echo "Оставшиеся контейнеры:"
docker ps -a

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
