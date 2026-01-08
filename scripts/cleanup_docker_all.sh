#!/bin/bash

# Скрипт для полной очистки Docker (контейнеры, образы, volumes, кэш)
# Освобождает место на диске

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  ПОЛНАЯ ОЧИСТКА DOCKER"
echo "=========================================="
echo ""

# Показать текущее использование диска Docker
echo "=== Текущее использование Docker ==="
docker system df
echo ""

# Показать использование диска системы
echo "=== Использование диска системы ==="
df -h / | tail -1
echo ""

# Запрос подтверждения
read -p "Продолжить очистку? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 1
fi

echo ""
echo "=== 1. Остановка всех контейнеров ==="
docker ps -q | xargs -r docker stop 2>/dev/null || true
echo "✓ Контейнеры остановлены"
echo ""

echo "=== 2. Удаление всех контейнеров ==="
docker ps -aq | xargs -r docker rm -f 2>/dev/null || true
echo "✓ Контейнеры удалены"
echo ""

echo "=== 3. Удаление через docker-compose ==="
if [ -f "docker-compose.yml" ]; then
    docker compose down -v --remove-orphans 2>/dev/null || docker-compose down -v --remove-orphans 2>/dev/null || true
    echo "✓ Docker-compose контейнеры и volumes удалены"
fi
echo ""

echo "=== 4. Удаление неиспользуемых образов ==="
docker image prune -a -f
echo "✓ Неиспользуемые образы удалены"
echo ""

echo "=== 5. Удаление неиспользуемых volumes ==="
read -p "Удалить ВСЕ неиспользуемые volumes? (yes/no): " delete_volumes
if [ "$delete_volumes" = "yes" ]; then
    docker volume prune -f
    echo "✓ Неиспользуемые volumes удалены"
else
    echo "Volumes сохранены"
fi
echo ""

echo "=== 6. Удаление неиспользуемых networks ==="
docker network prune -f
echo "✓ Неиспользуемые networks удалены"
echo ""

echo "=== 7. Очистка build cache ==="
docker builder prune -a -f
echo "✓ Build cache очищен"
echo ""

echo "=== 8. Полная очистка системы Docker ==="
docker system prune -a --volumes -f
echo "✓ Полная очистка выполнена"
echo ""

# Показать результат
echo "=== Результат очистки ==="
echo "Использование Docker после очистки:"
docker system df
echo ""

echo "Использование диска системы:"
df -h / | tail -1
echo ""

echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
