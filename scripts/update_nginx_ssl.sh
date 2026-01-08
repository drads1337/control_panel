#!/bin/bash

# Скрипт для автоматического переключения nginx между Let's Encrypt и self-signed сертификатами

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

DOMAIN="ovrin.xyz"
LETSENCRYPT_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
LETSENCRYPT_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
SELF_SIGNED_CERT="/etc/nginx/ssl/cert.pem"
SELF_SIGNED_KEY="/etc/nginx/ssl/key.pem"

echo "=========================================="
echo "  ОБНОВЛЕНИЕ SSL КОНФИГУРАЦИИ NGINX"
echo "=========================================="
echo ""

# Проверка наличия Let's Encrypt сертификатов
USE_LETSENCRYPT=false
if [ -f "letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "letsencrypt/live/$DOMAIN/privkey.pem" ]; then
    USE_LETSENCRYPT=true
    echo "✓ Let's Encrypt сертификаты найдены"
else
    echo "⚠ Let's Encrypt сертификаты не найдены, используем self-signed"
fi

# Создание резервной копии
cp nginx.conf "nginx.conf.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

# Обновление конфигурации
if [ "$USE_LETSENCRYPT" = true ]; then
    echo ""
    echo "=== Переключение на Let's Encrypt сертификаты ==="
    
    # Раскомментируем Let's Encrypt, комментируем self-signed
    sed -i.bak \
        -e 's|^[[:space:]]*# ssl_certificate[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;|        ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
        -e 's|^[[:space:]]*# ssl_certificate_key[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;|        ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
        -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/cert\.pem;|        # ssl_certificate /etc/nginx/ssl/cert.pem;|' \
        -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/key\.pem;|        # ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
        -e 's|^[[:space:]]*# ssl_stapling on;|        ssl_stapling on;|' \
        -e 's|^[[:space:]]*# ssl_stapling_verify on;|        ssl_stapling_verify on;|' \
        -e 's|^[[:space:]]*# ssl_trusted_certificate[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/chain\.pem;|        ssl_trusted_certificate /etc/letsencrypt/live/ovrin.xyz/chain.pem;|' \
        nginx.conf 2>/dev/null || {
        echo "⚠ Ошибка при обновлении конфигурации через sed, используем Python..."
        python3 << 'PYEOF'
import re

with open('nginx.conf', 'r') as f:
    content = f.read()

# Переключение на Let's Encrypt
content = re.sub(r'^(\s*)# ssl_certificate\s+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;', r'\1ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_certificate_key\s+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;', r'\1ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_certificate\s+/etc/nginx/ssl/cert\.pem;', r'\1# ssl_certificate /etc/nginx/ssl/cert.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_certificate_key\s+/etc/nginx/ssl/key\.pem;', r'\1# ssl_certificate_key /etc/nginx/ssl/key.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_stapling on;', r'\1ssl_stapling on;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_stapling_verify on;', r'\1ssl_stapling_verify on;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_trusted_certificate\s+/etc/letsencrypt/live/ovrin\.xyz/chain\.pem;', r'\1ssl_trusted_certificate /etc/letsencrypt/live/ovrin.xyz/chain.pem;', content, flags=re.MULTILINE)

with open('nginx.conf', 'w') as f:
    f.write(content)
PYEOF
    }
    
    echo "✓ Nginx переключен на Let's Encrypt сертификаты"
else
    echo ""
    echo "=== Переключение на self-signed сертификаты ==="
    
    # Комментируем Let's Encrypt, раскомментируем self-signed
    sed -i.bak \
        -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;|        # ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;|' \
        -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;|        # ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;|' \
        -e 's|^[[:space:]]*# ssl_certificate[[:space:]]\+/etc/nginx/ssl/cert\.pem;|        ssl_certificate /etc/nginx/ssl/cert.pem;|' \
        -e 's|^[[:space:]]*# ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/key\.pem;|        ssl_certificate_key /etc/nginx/ssl/key.pem;|' \
        -e 's|^[[:space:]]*ssl_stapling on;|        # ssl_stapling on;|' \
        -e 's|^[[:space:]]*ssl_stapling_verify on;|        # ssl_stapling_verify on;|' \
        -e 's|^[[:space:]]*ssl_trusted_certificate[[:space:]]\+/etc/letsencrypt/live/ovrin\.xyz/chain\.pem;|        # ssl_trusted_certificate /etc/letsencrypt/live/ovrin.xyz/chain.pem;|' \
        nginx.conf 2>/dev/null || {
        echo "⚠ Ошибка при обновлении конфигурации через sed, используем Python..."
        python3 << 'PYEOF'
import re

with open('nginx.conf', 'r') as f:
    content = f.read()

# Переключение на self-signed
content = re.sub(r'^(\s*)ssl_certificate\s+/etc/letsencrypt/live/ovrin\.xyz/fullchain\.pem;', r'\1# ssl_certificate /etc/letsencrypt/live/ovrin.xyz/fullchain.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_certificate_key\s+/etc/letsencrypt/live/ovrin\.xyz/privkey\.pem;', r'\1# ssl_certificate_key /etc/letsencrypt/live/ovrin.xyz/privkey.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_certificate\s+/etc/nginx/ssl/cert\.pem;', r'\1ssl_certificate /etc/nginx/ssl/cert.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)# ssl_certificate_key\s+/etc/nginx/ssl/key\.pem;', r'\1ssl_certificate_key /etc/nginx/ssl/key.pem;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_stapling on;', r'\1# ssl_stapling on;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_stapling_verify on;', r'\1# ssl_stapling_verify on;', content, flags=re.MULTILINE)
content = re.sub(r'^(\s*)ssl_trusted_certificate\s+/etc/letsencrypt/live/ovrin\.xyz/chain\.pem;', r'\1# ssl_trusted_certificate /etc/letsencrypt/live/ovrin.xyz/chain.pem;', content, flags=re.MULTILINE)

with open('nginx.conf', 'w') as f:
    f.write(content)
PYEOF
    }
    
    echo "✓ Nginx переключен на self-signed сертификаты"
fi

# Проверка синтаксиса nginx
echo ""
echo "=== Проверка синтаксиса nginx ==="
if docker compose exec nginx nginx -t 2>/dev/null; then
    echo "✓ Синтаксис nginx.conf корректен"
    
    # Перезагрузка nginx
    echo ""
    echo "=== Перезагрузка nginx ==="
    docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx
    echo "✓ Nginx перезагружен"
else
    echo "❌ Ошибка в синтаксисе nginx.conf!"
    echo "Восстановление из резервной копии..."
    # Восстановление последней резервной копии
    ls -t nginx.conf.backup.* 2>/dev/null | head -1 | xargs -r cp -f {} nginx.conf
    echo "✓ Конфигурация восстановлена"
    exit 1
fi

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
