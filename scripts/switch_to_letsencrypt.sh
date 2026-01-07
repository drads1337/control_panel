#!/bin/bash
# Переключение nginx.conf на использование Let's Encrypt сертификатов

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

DOMAIN="ovrin.xyz"
CERT_PATH="letsencrypt/live/$DOMAIN/fullchain.pem"

echo "=========================================="
echo "Переключение на Let's Encrypt сертификаты"
echo "=========================================="
echo ""

# Проверить наличие сертификатов
if [ ! -f "$CERT_PATH" ]; then
    echo "❌ Let's Encrypt сертификаты не найдены: $CERT_PATH"
    echo "   Получите сертификаты: ./scripts/ssl_cert.sh [email]"
    exit 1
fi

echo "✅ Let's Encrypt сертификаты найдены: $CERT_PATH"
echo ""

# Создать резервную копию
cp nginx.conf nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Резервная копия создана: nginx.conf.backup.*"
echo ""

# Переключить на Let's Encrypt
echo "🔄 Обновление nginx.conf для использования Let's Encrypt..."
sed -i.bak \
    -e 's|# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
    -e 's|# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
    -e 's|ssl_certificate /etc/nginx/ssl/cert.pem;|# ssl_certificate /etc/nginx/ssl/cert.pem;|' \
    -e 's|ssl_certificate_key /etc/nginx/ssl/key.pem;|# ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
    nginx.conf

echo "✅ Конфигурация обновлена!"
echo ""

# Проверить синтаксис nginx
echo "🔍 Проверка синтаксиса nginx.conf..."
if docker-compose exec -T nginx nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo "✅ Синтаксис nginx.conf корректен"
else
    echo "❌ Ошибка в nginx.conf!"
    echo "Восстановление из резервной копии..."
    cp nginx.conf.backup.* nginx.conf 2>/dev/null || true
    exit 1
fi
echo ""

# Перезагрузить nginx
echo "🔄 Перезагрузка Nginx..."
docker-compose exec nginx nginx -s reload || {
    echo "⚠️  Не удалось перезагрузить nginx. Перезапускаю контейнер..."
    docker-compose restart nginx
    sleep 3
}

echo ""
echo "✅ Готово! Nginx теперь использует Let's Encrypt сертификаты."
echo ""
echo "Проверьте доступность:"
echo "  https://ovrin.xyz"
echo ""
echo "Если всё работает, очистите HSTS кэш в браузере:"
echo "  Chrome: chrome://net-internals/#hsts"
echo "  Удалите домен: ovrin.xyz"
echo ""

