#!/bin/bash
# Скрипт для перезапуска API контейнера (для применения изменений mTLS)

echo "============================================================"
echo "Перезапуск API контейнера для применения изменений mTLS"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Очищаем __pycache__ чтобы удалить старые скомпилированные файлы
echo "Очистка __pycache__ директорий..."
find backend -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
echo "✓ __pycache__ очищен"

# Перезапускаем только API контейнер (быстрее чем все)
echo ""
echo "Перезапуск API контейнера..."
docker-compose restart api

echo ""
echo "✓ API контейнер перезапущен"
echo ""
echo "Ожидание запуска контейнера (5 секунд)..."
sleep 5

echo ""
echo "Проверка логов (Ctrl+C для выхода):"
docker-compose logs --tail=50 api

