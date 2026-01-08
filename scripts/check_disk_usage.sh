#!/bin/bash

# Скрипт для проверки использования диска

set -e

echo "=========================================="
echo "  АНАЛИЗ ИСПОЛЬЗОВАНИЯ ДИСКА"
echo "=========================================="
echo ""

echo "=== Общее использование диска ==="
df -h
echo ""

echo "=== Использование Docker ==="
docker system df
echo ""

echo "=== Топ-10 самых больших директорий в /var/lib/docker ==="
if [ -d "/var/lib/docker" ]; then
    sudo du -h /var/lib/docker 2>/dev/null | sort -rh | head -10 || echo "Нет доступа к /var/lib/docker"
else
    echo "Директория /var/lib/docker не найдена"
fi
echo ""

echo "=== Размер Docker images ==="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -20
echo ""

echo "=== Размер Docker volumes ==="
docker volume ls -q | xargs -r docker volume inspect 2>/dev/null | grep -E '"Mountpoint"|"Name"' | paste - - | awk '{print $4, $2}' | sed 's/"//g' | while read name path; do
    if [ -d "$path" ]; then
        size=$(sudo du -sh "$path" 2>/dev/null | cut -f1 || echo "N/A")
        echo "$name: $size"
    fi
done
echo ""

echo "=== Топ-10 самых больших файлов в проекте ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
find "$PROJECT_ROOT" -type f -size +10M 2>/dev/null | xargs -r du -h 2>/dev/null | sort -rh | head -10 || echo "Нет больших файлов"
echo ""

echo "=== Размер директорий проекта ==="
du -sh "$PROJECT_ROOT"/* 2>/dev/null | sort -rh | head -10
echo ""

echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
