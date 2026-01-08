#!/bin/bash

# Скрипт для исправления проблемы с отсутствующими SSL сертификатами
# 1. Создает временный самоподписанный сертификат
# 2. Переключает nginx на его использование
# 3. Получает Let's Encrypt сертификат
# 4. Переключает обратно на Let's Encrypt

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

DOMAIN="ovrin.xyz"
EMAIL="${1:-abdikaiumov2197@gmail.com}"
SSL_DIR="nginx/ssl"
LETSENCRYPT_CERT="letsencrypt/live/$DOMAIN/fullchain.pem"

echo "=========================================="
echo "  ИСПРАВЛЕНИЕ SSL СЕРТИФИКАТОВ NGINX"
echo "=========================================="
echo ""

# Шаг 1: Создание временного самоподписанного сертификата
echo "=== ШАГ 1: Создание временного самоподписанного сертификата ==="
mkdir -p "$SSL_DIR"

if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
    echo "Создание самоподписанного сертификата..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN"
    
    chmod 600 "$SSL_DIR/key.pem"
    chmod 644 "$SSL_DIR/cert.pem"
    echo "✓ Временный сертификат создан: $SSL_DIR/cert.pem"
else
    echo "✓ Временный сертификат уже существует"
fi
echo ""

# Шаг 2: Переключение nginx на временный сертификат
echo "=== ШАГ 2: Переключение nginx на временный сертификат ==="

# Создание резервной копии
cp nginx.conf "nginx.conf.backup.$(date +%Y%m%d_%H%M%S)"

# Переключение на самоподписанный сертификат
sed -i.bak \
    -e 's|^ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
    -e 's|^ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
    -e 's|^# ssl_certificate /etc/nginx/ssl/cert.pem;|ssl_certificate /etc/nginx/ssl/cert.pem;|' \
    -e 's|^# ssl_certificate_key /etc/nginx/ssl/key.pem;|ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
    nginx.conf

echo "✓ Nginx переключен на временный сертификат"
echo ""

# Шаг 3: Перезапуск nginx
echo "=== ШАГ 3: Перезапуск nginx ==="
if docker compose ps nginx 2>/dev/null | grep -q "Up\|Running"; then
    echo "Перезапуск контейнера nginx..."
    docker compose restart nginx || docker compose up -d nginx
    sleep 5
    
    # Проверка статуса
    if docker compose ps nginx | grep -q "Up\|Running"; then
        echo "✓ Nginx успешно запущен"
    else
        echo "⚠️  Nginx не запустился, проверьте логи: docker compose logs nginx"
    fi
else
    echo "Запуск контейнера nginx..."
    docker compose up -d nginx
    sleep 5
fi
echo ""

# Шаг 4: Получение Let's Encrypt сертификата
echo "=== ШАГ 4: Получение Let's Encrypt сертификата ==="
read -p "Получить Let's Encrypt сертификат сейчас? (yes/no): " get_letsencrypt

if [ "$get_letsencrypt" = "yes" ]; then
    echo ""
    echo "Получение Let's Encrypt сертификата..."
    
    # Создание необходимых директорий
    mkdir -p letsencrypt/var/www/certbot
    mkdir -p letsencrypt/var/lib/letsencrypt
    mkdir -p letsencrypt/var/log/letsencrypt
    
    # Получение сертификата
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" || {
        echo ""
        echo "⚠️  Не удалось получить Let's Encrypt сертификат"
        echo "   Nginx будет использовать временный самоподписанный сертификат"
        echo "   Попробуйте позже: ./scripts/ssl_cert.sh $EMAIL"
        exit 0
    }
    
    echo ""
    echo "✓ Let's Encrypt сертификат получен!"
    
    # Шаг 5: Переключение обратно на Let's Encrypt
    echo ""
    echo "=== ШАГ 5: Переключение на Let's Encrypt сертификат ==="
    
    sed -i.bak \
        -e 's|^# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
        -e 's|^# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
        -e 's|^ssl_certificate /etc/nginx/ssl/cert.pem;|# ssl_certificate /etc/nginx/ssl/cert.pem;|' \
        -e 's|^ssl_certificate_key /etc/nginx/ssl/key.pem;|# ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
        nginx.conf
    
    echo "✓ Nginx переключен на Let's Encrypt сертификат"
    
    # Перезагрузка nginx
    echo "Перезагрузка nginx..."
    docker compose exec nginx nginx -s reload || docker compose restart nginx
    sleep 3
    
    echo "✓ Готово! Nginx использует Let's Encrypt сертификат"
else
    echo "Пропущено. Nginx использует временный самоподписанный сертификат"
    echo "Для получения Let's Encrypt сертификата выполните:"
    echo "  ./scripts/ssl_cert.sh $EMAIL"
fi

echo ""
echo "=========================================="
echo "  ЗАВЕРШЕНО"
echo "=========================================="
echo ""
echo "Проверьте статус nginx:"
echo "  docker compose ps nginx"
echo ""
echo "Проверьте логи nginx:"
echo "  docker compose logs nginx"
echo ""
