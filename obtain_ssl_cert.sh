#!/bin/bash
# Скрипт для получения SSL сертификатов от Let's Encrypt
# Использование: ./obtain_ssl_cert.sh [email]

set -e

EMAIL=${1:-admin@ovrin.xyz}
DOMAIN="ovrin.xyz"
DOMAINS="$DOMAIN www.$DOMAIN"

echo "🔐 Получение SSL сертификатов от Let's Encrypt"
echo "Email: $EMAIL"
echo "Домены: $DOMAINS"
echo ""

# Создание необходимых директорий
mkdir -p letsencrypt/var/www/certbot
mkdir -p letsencrypt/var/lib/letsencrypt
mkdir -p letsencrypt/var/log/letsencrypt

# Проверка, что nginx запущен
if ! docker compose ps nginx | grep -q "Up"; then
    echo "⚠️  Nginx не запущен. Запускаю контейнеры..."
    docker compose up -d nginx
    echo "⏳ Ожидание запуска nginx (5 секунд)..."
    sleep 5
fi

# Получение сертификатов
echo "📜 Запрос сертификатов от Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo ""
echo "✅ Сертификаты получены!"
echo ""
echo "📋 Пути к сертификатам:"
echo "   Certificate: letsencrypt/live/$DOMAIN/fullchain.pem"
echo "   Private Key: letsencrypt/live/$DOMAIN/privkey.pem"
echo ""

# Переключение nginx.conf на использование Let's Encrypt сертификатов
echo "🔄 Обновление конфигурации nginx для использования Let's Encrypt сертификатов..."
sed -i.bak \
    -e 's|# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
    -e 's|# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
    -e 's|ssl_certificate /etc/nginx/ssl/cert.pem;|# ssl_certificate /etc/nginx/ssl/cert.pem;|' \
    -e 's|ssl_certificate_key /etc/nginx/ssl/key.pem;|# ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
    nginx.conf

echo "✅ Конфигурация обновлена!"
echo ""
echo "🔄 Перезагрузка nginx для применения сертификатов..."
docker compose exec nginx nginx -s reload

echo ""
echo "✅ Готово! SSL сертификаты Let's Encrypt установлены и применены."
echo ""
echo "📅 Сертификаты автоматически обновляются каждые 12 часов."
echo "   Для ручного обновления выполните: ./renew_ssl_cert.sh"

