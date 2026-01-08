#!/bin/bash

# Агрессивный скрипт для удаления ВСЕХ контейнеров проекта
# Используйте с осторожностью!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ ВСЕХ КОНТЕЙНЕРОВ"
echo "=========================================="
echo ""

# 1. Остановка всех контейнеров проекта
echo "=== Остановка всех контейнеров ==="
docker ps --filter "name=panel_" --format "{{.Names}}" | xargs -r docker stop 2>/dev/null || true
docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker stop 2>/dev/null || true
echo "✓ Контейнеры остановлены"
echo ""

# 2. Удаление через docker-compose
echo "=== Удаление через docker-compose ==="
if [ -f "docker-compose.yml" ]; then
    docker compose down -v --remove-orphans 2>/dev/null || docker-compose down -v --remove-orphans 2>/dev/null || true
    echo "✓ Docker-compose контейнеры удалены"
fi
echo ""

# 3. Принудительное удаление всех контейнеров проекта
echo "=== Принудительное удаление контейнеров ==="
for container in $(docker ps -a --filter "name=panel_" --format "{{.Names}}" 2>/dev/null); do
    echo "Удаление: $container"
    docker rm -f "$container" 2>/dev/null || true
done
echo "✓ Контейнеры удалены"
echo ""

# 4. Удаление по шаблону имени (на случай, если фильтр не сработал)
echo "=== Удаление по шаблону ==="
docker ps -a --format "{{.Names}}" | grep -E "^panel_" | xargs -r docker rm -f 2>/dev/null || true
echo "✓ Дополнительная очистка выполнена"
echo ""

# 5. Показать результат
echo "=== Результат ==="
echo "Оставшиеся контейнеры:"
docker ps -a --filter "name=panel_" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" || echo "Нет контейнеров panel_"

echo ""
echo "Все контейнеры в системе:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | head -20

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
