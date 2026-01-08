#!/bin/bash

# Скрипт для создания всех необходимых сертификатов перед запуском Docker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SSL_DIR="nginx/ssl"
DOMAIN="ovrin.xyz"

echo "=========================================="
echo "  НАСТРОЙКА СЕРТИФИКАТОВ"
echo "=========================================="
echo ""

# Создание директории для сертификатов
mkdir -p "$SSL_DIR"

# 1. Создание mTLS CA (если не существует)
echo "=== 1. Создание mTLS CA ==="
if [ ! -f "$SSL_DIR/ca-cert.pem" ] || [ ! -f "$SSL_DIR/ca-key.pem" ]; then
    echo "Создание CA для mTLS..."
    ./scripts/create_single_ca.sh
    # Создание ca-bundle.pem (копия ca-cert.pem для совместимости)
    if [ -f "$SSL_DIR/ca-cert.pem" ] && [ ! -f "$SSL_DIR/ca-bundle.pem" ]; then
        cp "$SSL_DIR/ca-cert.pem" "$SSL_DIR/ca-bundle.pem"
        chmod 644 "$SSL_DIR/ca-bundle.pem"
        echo "✓ ca-bundle.pem создан"
    fi
else
    echo "✓ CA для mTLS уже существует"
fi
echo ""

# 2. Создание временного self-signed сертификата для HTTPS (если не существует)
echo "=== 2. Создание временного HTTPS сертификата ==="
if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
    echo "Создание временного self-signed сертификата для HTTPS..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" 2>/dev/null || {
        echo "⚠ Ошибка при создании self-signed сертификата"
    }
    
    chmod 600 "$SSL_DIR/key.pem" 2>/dev/null || true
    chmod 644 "$SSL_DIR/cert.pem" 2>/dev/null || true
    echo "✓ Временный HTTPS сертификат создан"
else
    echo "✓ Временный HTTPS сертификат уже существует"
fi
echo ""

# 3. Проверка Let's Encrypt сертификатов
echo "=== 3. Проверка Let's Encrypt сертификатов ==="
if [ -f "letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "letsencrypt/live/$DOMAIN/privkey.pem" ]; then
    echo "✓ Let's Encrypt сертификаты найдены"
    echo "  Nginx будет использовать Let's Encrypt сертификаты"
else
    echo "⚠ Let's Encrypt сертификаты не найдены"
    echo "  Nginx будет использовать временный self-signed сертификат"
    echo "  Для получения Let's Encrypt сертификата запустите:"
    echo "    ./scripts/get_letsencrypt_with_fallback.sh"
fi
echo ""

# 4. Итоговая информация
echo "=== Итоговая информация ==="
echo "Сертификаты в $SSL_DIR:"
ls -lh "$SSL_DIR"/*.pem 2>/dev/null | awk '{print "  " $9, "(" $5 ")"}' || echo "  Нет сертификатов"
echo ""

echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
echo ""
echo "Теперь можно запускать Docker контейнеры:"
echo "  docker compose up -d"
echo ""
