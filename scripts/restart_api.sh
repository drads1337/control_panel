#!/bin/bash
# Скрипт для перезапуска API контейнера (для применения изменений mTLS)

echo "============================================================"
echo "Перезапуск API контейнера для применения изменений mTLS"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Перезапускаем только API контейнер (быстрее чем все)
echo "Перезапуск API контейнера..."
docker-compose restart api

echo ""
echo "✓ API контейнер перезапущен"
echo ""
echo "Проверка логов (Ctrl+C для выхода):"
docker-compose logs -f api | tail -20

