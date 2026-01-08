#!/bin/bash

# Скрипт для удаления ВСЕХ контейнеров на сервере
# ВНИМАНИЕ: Этот скрипт удалит ВСЕ контейнеры Docker, не только контейнеры проекта!
# Используйте с осторожностью!

set -e

echo "=========================================="
echo "  УДАЛЕНИЕ ВСЕХ КОНТЕЙНЕРОВ НА СЕРВЕРЕ"
echo "=========================================="
echo ""
echo "⚠️  ВНИМАНИЕ: Будет удалено ВСЕ контейнеры Docker на сервере!"
echo ""

# Запрос подтверждения
read -p "Вы уверены? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 1
fi

echo ""
echo "=== Остановка всех контейнеров ==="
# Остановка всех запущенных контейнеров
docker ps -q | xargs -r docker stop 2>/dev/null || true
echo "✓ Все контейнеры остановлены"
echo ""

echo "=== Удаление всех контейнеров ==="
# Удаление всех контейнеров (остановленных и запущенных)
docker ps -aq | xargs -r docker rm -f 2>/dev/null || true
echo "✓ Все контейнеры удалены"
echo ""

echo "=== Очистка через docker-compose ==="
# Если есть docker-compose файлы, также очистим их
if [ -f "docker-compose.yml" ]; then
    docker compose down -v --remove-orphans 2>/dev/null || docker-compose down -v --remove-orphans 2>/dev/null || true
    echo "✓ Docker-compose контейнеры удалены"
fi
echo ""

echo "=== Результат ==="
echo "Оставшиеся контейнеры:"
if [ "$(docker ps -aq | wc -l)" -eq 0 ]; then
    echo "✓ Все контейнеры успешно удалены!"
else
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
fi

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
