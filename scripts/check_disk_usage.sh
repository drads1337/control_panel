#!/bin/bash

# Скрипт для проверки использования диска

echo "=========================================="
echo "  АНАЛИЗ ИСПОЛЬЗОВАНИЯ ДИСКА"
echo "=========================================="
echo ""

echo "=== Общее использование диска ==="
df -h
echo ""

echo "=== Использование Docker ==="
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        docker system df 2>/dev/null || echo "Не удалось получить информацию о Docker"
    else
        echo "Docker не запущен или нет доступа"
    fi
else
    echo "Docker не установлен"
fi
echo ""

echo "=== Топ-10 самых больших директорий в /var/lib/docker ==="
if [ -d "/var/lib/docker" ]; then
    sudo du -h /var/lib/docker 2>/dev/null | sort -rh | head -10 || echo "Нет доступа к /var/lib/docker"
else
    echo "Директория /var/lib/docker не найдена"
fi
echo ""

echo "=== Размер Docker images ==="
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null | head -20 || echo "Нет образов или ошибка"
else
    echo "Docker недоступен"
fi
echo ""

echo "=== Размер Docker volumes ==="
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    volumes=$(docker volume ls -q 2>/dev/null)
    if [ -n "$volumes" ]; then
        echo "$volumes" | while read vol; do
            path=$(docker volume inspect "$vol" 2>/dev/null | grep -oP '"Mountpoint":\s*"\K[^"]+' || echo "")
            if [ -n "$path" ] && [ -d "$path" ]; then
                size=$(sudo du -sh "$path" 2>/dev/null | cut -f1 || echo "N/A")
                echo "$vol: $size"
            fi
        done
    else
        echo "Нет volumes"
    fi
else
    echo "Docker недоступен"
fi
echo ""

echo "=== Топ-15 самых больших директорий в корне ==="
du -h --max-depth=1 / 2>/dev/null | grep -vE "^[0-9.]+K\s+/$" | sort -rh | head -15 || echo "Нет доступа"
echo ""

echo "=== Размер /var/lib (где обычно Docker) ==="
if [ -d "/var/lib" ]; then
    sudo du -h --max-depth=1 /var/lib 2>/dev/null | sort -rh | head -10 || echo "Нет доступа"
else
    echo "Директория /var/lib не найдена"
fi
echo ""

echo "=== Размер /var/log (логи) ==="
if [ -d "/var/log" ]; then
    sudo du -h --max-depth=1 /var/log 2>/dev/null | sort -rh | head -10 || echo "Нет доступа"
else
    echo "Директория /var/log не найдена"
fi
echo ""

echo "=== Топ-10 самых больших файлов в проекте ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
find "$PROJECT_ROOT" -type f -size +10M 2>/dev/null | xargs -r du -h 2>/dev/null | sort -rh | head -10 || echo "Нет больших файлов"
echo ""

echo "=== Размер директорий проекта ==="
du -sh "$PROJECT_ROOT"/* 2>/dev/null | sort -rh | head -10
echo ""

echo "=== Размер node_modules (если есть) ==="
find "$PROJECT_ROOT" -type d -name "node_modules" -exec du -sh {} \; 2>/dev/null | sort -rh | head -5 || echo "Нет node_modules"
echo ""

echo "=== Размер __pycache__ (если есть) ==="
find "$PROJECT_ROOT" -type d -name "__pycache__" -exec du -sh {} \; 2>/dev/null | sort -rh | head -5 || echo "Нет __pycache__"
echo ""

echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
