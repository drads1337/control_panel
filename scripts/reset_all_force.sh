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
    echo "✓ CA сертификат создан"
fi

# Создание временного самоподписанного сертификата для nginx
DOMAIN="ovrin.xyz"
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "Создание временного самоподписанного сертификата для nginx..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" 2>/dev/null || true
    
    chmod 600 nginx/ssl/key.pem 2>/dev/null || true
    chmod 644 nginx/ssl/cert.pem 2>/dev/null || true
    echo "✓ Временный сертификат для nginx создан"
fi

# Переключение nginx.conf на временный сертификат (если Let's Encrypt не найден)
if [ ! -f "letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "Переключение nginx.conf на временный сертификат..."
    if [ -f "nginx.conf" ]; then
        sed -i.bak \
            -e 's|^ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
            -e 's|^ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
            -e 's|^# ssl_certificate /etc/nginx/ssl/cert.pem;|ssl_certificate /etc/nginx/ssl/cert.pem;|' \
            -e 's|^# ssl_certificate_key /etc/nginx/ssl/key.pem;|ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
            nginx.conf 2>/dev/null || true
        echo "✓ Nginx переключен на временный сертификат"
    fi
fi

echo "✓ Базовые сертификаты созданы"
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
