#!/bin/bash

# Быстрая очистка Docker (только build cache и неиспользуемые образы)
# Освобождает ~32GB места без удаления volumes

echo "=========================================="
echo "  БЫСТРАЯ ОЧИСТКА DOCKER"
echo "=========================================="
echo ""

# Показать текущее использование
echo "=== Текущее использование Docker ==="
docker system df
echo ""

echo "=== Использование диска системы ==="
df -h / | tail -1
echo ""

# Запрос подтверждения
read -p "Очистить build cache и неиспользуемые образы? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 1
fi

echo ""
echo "=== 1. Очистка build cache (16.85GB) ==="
docker builder prune -a -f
echo "✓ Build cache очищен"
echo ""

echo "=== 2. Удаление неиспользуемых образов (15.62GB) ==="
docker image prune -a -f
echo "✓ Неиспользуемые образы удалены"
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
