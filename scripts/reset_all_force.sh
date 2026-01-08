#!/bin/bash

# Скрипт для полной автоматической очистки контейнеров и сертификатов
# БЕЗ запросов подтверждения - используйте с осторожностью!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Параметры
DELETE_LETSENCRYPT="${1:-no}"  # Передайте "yes" как первый аргумент для удаления Let's Encrypt

echo "=========================================="
echo "  АВТОМАТИЧЕСКАЯ ОЧИСТКА И ПЕРЕСОЗДАНИЕ"
echo "=========================================="
echo ""

# 1. Остановка и удаление контейнеров
echo "=== Остановка и удаление контейнеров ==="
if [ -f "docker-compose.yml" ]; then
    docker-compose down -v 2>/dev/null || true
fi
docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true
echo "✓ Контейнеры удалены"
echo ""

# 2. Удаление сертификатов
echo "=== Удаление сертификатов ==="
if [ -d "nginx/ssl" ]; then
    rm -rf nginx/ssl/*
    echo "✓ Сертификаты в nginx/ssl удалены"
fi
mkdir -p nginx/ssl

if [ "$DELETE_LETSENCRYPT" = "yes" ]; then
    if [ -d "letsencrypt" ]; then
        rm -rf letsencrypt/*
        echo "✓ Let's Encrypt сертификаты удалены"
    fi
else
    echo "Let's Encrypt сертификаты сохранены (используйте 'yes' как аргумент для удаления)"
fi
echo ""

# 3. Создание базовых сертификатов
echo "=== Создание базовых сертификатов ==="
if [ -f "scripts/create_single_ca.sh" ]; then
    bash scripts/create_single_ca.sh
    if [ -f "nginx/ssl/ca-cert.pem" ]; then
        cp nginx/ssl/ca-cert.pem nginx/ssl/ca-bundle.pem
        chmod 644 nginx/ssl/ca-bundle.pem
    fi
    echo "✓ Базовые сертификаты созданы"
fi
echo ""

# 4. Пересоздание контейнеров
echo "=== Пересоздание контейнеров ==="
if [ -f "docker-compose.yml" ]; then
    docker-compose up -d --build
    echo "✓ Контейнеры пересозданы"
    sleep 3
    docker-compose ps
fi
echo ""

echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
