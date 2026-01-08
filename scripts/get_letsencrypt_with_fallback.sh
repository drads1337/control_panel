#!/bin/bash

# Скрипт для получения Let's Encrypt сертификата с автоматическим fallback на временный сертификат

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

DOMAIN="ovrin.xyz"
EMAIL="${1:-abdikaiumov2197@gmail.com}"
SSL_DIR="nginx/ssl"
LETSENCRYPT_CERT="letsencrypt/live/$DOMAIN/fullchain.pem"

echo "=========================================="
echo "  ПОЛУЧЕНИЕ LET'S ENCRYPT С FALLBACK"
echo "=========================================="
echo ""

# Шаг 1: Создание временного сертификата, если его нет
echo "=== ШАГ 1: Подготовка временного сертификата ==="
mkdir -p "$SSL_DIR"

if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
    echo "Создание временного самоподписанного сертификата..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" 2>/dev/null || true
    
    chmod 600 "$SSL_DIR/key.pem" 2>/dev/null || true
    chmod 644 "$SSL_DIR/cert.pem" 2>/dev/null || true
    echo "✓ Временный сертификат создан"
else
    echo "✓ Временный сертификат уже существует"
fi
echo ""

# Шаг 2: Переключение nginx на временный сертификат
echo "=== ШАГ 2: Переключение nginx на временный сертификат ==="

# Создание резервной копии
cp nginx.conf "nginx.conf.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

# Переключение на самоподписанный сертификат (более надежный способ)
# Используем прямой поиск и замену
sed -i.bak \
    -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;|        # ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
    -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;|        # ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
    -e 's|^[[:space:]]*# ssl_certificate[[:space:]]\+/etc/nginx/ssl/cert\.pem;|        ssl_certificate /etc/nginx/ssl/cert.pem;|' \
    -e 's|^[[:space:]]*# ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/key\.pem;|        ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
    nginx.conf 2>/dev/null || {
    # Если sed не сработал, используем прямой подход
    echo "Использование прямого подхода для переключения..."
    python3 << 'PYEOF'
import re

with open('nginx.conf', 'r') as f:
    content = f.read()

# Замены
content = re.sub(r'^(\s*)ssl_certificate\s+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;', r'\1# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_certificate_key\s+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;', r'\1# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_certificate\s+/etc/nginx/ssl/cert\.pem;', r'\1ssl_certificate /etc/nginx/ssl/cert.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_certificate_key\s+/etc/nginx/ssl/key\.pem;', r'\1ssl_certificate_key /etc/nginx/ssl/key.pem;', content, flags=re.MULTILINE)

with open('nginx.conf', 'w') as f:
    f.write(content)
PYEOF
}

echo "✓ Nginx переключен на временный сертификат"
echo ""

# Шаг 3: Запуск nginx
echo "=== ШАГ 3: Запуск nginx ==="
if docker compose ps nginx 2>/dev/null | grep -q "Up\|Running"; then
    echo "Перезапуск nginx..."
    docker compose restart nginx || docker compose up -d nginx
else
    echo "Запуск nginx..."
    docker compose up -d nginx
fi

echo "⏳ Ожидание запуска nginx (10 секунд)..."
sleep 10

# Проверка статуса nginx
if docker compose ps nginx 2>/dev/null | grep -q "Up\|Running"; then
    echo "✓ Nginx запущен"
else
    echo "⚠️  Nginx не запустился, проверьте логи: docker compose logs nginx"
    exit 1
fi
echo ""

# Шаг 4: Получение Let's Encrypt сертификата
echo "=== ШАГ 4: Получение Let's Encrypt сертификата ==="

# Создание необходимых директорий
mkdir -p letsencrypt/var/www/certbot
mkdir -p letsencrypt/var/lib/letsencrypt
mkdir -p letsencrypt/var/log/letsencrypt

# Получение сертификата
echo "Запрос сертификатов от Let's Encrypt..."
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
    echo "   Проверьте:"
    echo "   1. Домен $DOMAIN указывает на IP сервера"
    echo "   2. Порт 80 открыт и доступен из интернета"
    echo "   3. Nginx запущен и отвечает на порту 80"
    exit 0
}

echo ""
echo "✓ Let's Encrypt сертификат получен!"
echo ""

# Шаг 5: Переключение обратно на Let's Encrypt
echo "=== ШАГ 5: Переключение на Let's Encrypt сертификат ==="

# Переключение обратно на Let's Encrypt
sed -i.bak \
    -e 's|^[[:space:]]*# ssl_certificate[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;|        ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
    -e 's|^[[:space:]]*# ssl_certificate_key[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;|        ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
    -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/cert\.pem;|        # ssl_certificate /etc/nginx/ssl/cert.pem;|' \
    -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/key\.pem;|        # ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
    nginx.conf 2>/dev/null || {
    # Если sed не сработал, используем прямой подход
    python3 << 'PYEOF'
import re

with open('nginx.conf', 'r') as f:
    content = f.read()

# Замены обратно на Let's Encrypt
content = re.sub(r'^(\s*)# ssl_certificate\s+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;', r'\1ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_certificate_key\s+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;', r'\1ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_certificate\s+/etc/nginx/ssl/cert\.pem;', r'\1# ssl_certificate /etc/nginx/ssl/cert.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_certificate_key\s+/etc/nginx/ssl/key\.pem;', r'\1# ssl_certificate_key /etc/nginx/ssl/key.pem;', content, flags=re.MULTILINE)

with open('nginx.conf', 'w') as f:
    f.write(content)
PYEOF
}

echo "✓ Nginx переключен на Let's Encrypt сертификат"

# Перезагрузка nginx
echo "Перезагрузка nginx..."
docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx
sleep 3

echo "✓ Готово! Nginx использует Let's Encrypt сертификат"

echo ""
echo "=========================================="
echo "  ЗАВЕРШЕНО"
echo "=========================================="
echo ""
echo "Проверьте статус:"
echo "  docker compose ps nginx"
echo "  curl -I https://$DOMAIN"
echo ""
