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
if ! docker compose -f docker-compose.yml -f docker-compose.prod.yml ps nginx 2>/dev/null | grep -q "Up"; then
    echo "⚠️  Nginx не запущен. Запускаю контейнеры..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx
    echo "⏳ Ожидание запуска nginx (10 секунд)..."
    sleep 10
fi

# Проверка доступности домена
echo "🔍 Проверка доступности домена $DOMAIN..."
if ! curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/.well-known/acme-challenge/test" | grep -q "404\|403"; then
    echo "⚠️  Предупреждение: домен может быть недоступен или nginx не настроен для ACME challenge"
    echo "   Убедитесь, что:"
    echo "   1. Домен $DOMAIN указывает на этот сервер (A-запись)"
    echo "   2. Порт 80 открыт"
    echo "   3. Nginx настроен для обработки /.well-known/acme-challenge/"
    read -p "Продолжить? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Получение сертификатов
echo "📜 Запрос сертификатов от Let's Encrypt..."
echo "   Это может занять несколько минут..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" || {
    echo ""
    echo "❌ Ошибка при получении сертификатов!"
    echo ""
    echo "Возможные причины:"
    echo "  1. Домен не указывает на этот сервер"
    echo "  2. Порт 80 закрыт или заблокирован"
    echo "  3. Nginx не настроен для ACME challenge"
    echo "  4. Превышен лимит запросов Let's Encrypt (5 в неделю на домен)"
    echo ""
    echo "Проверьте логи: docker compose logs certbot"
    exit 1
}

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
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload || {
    echo "⚠️  Не удалось перезагрузить nginx. Попробуйте перезапустить контейнер:"
    echo "   docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx"
}

echo ""
echo "✅ Готово! SSL сертификаты Let's Encrypt установлены и применены."
echo ""
echo "📅 Сертификаты автоматически обновляются каждые 12 часов."
echo "   Для ручного обновления выполните: ./renew_ssl_cert.sh"

