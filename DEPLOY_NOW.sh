#!/bin/bash
# Быстрое развертывание на сервере
# Скопируйте и выполните на сервере: ssh root@38.242.149.188
#
# Альтернативный способ (если файл не на GitHub):
# git clone -b develop https://github.com/drads1337/control_panel.git /tmp/panel && bash /tmp/panel/DEPLOY_NOW.sh

set -e

echo "🚀 Быстрое развертывание Panel на сервере"
echo ""

# Установка Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Установка Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
fi

# Установка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Установка Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Создание директории
mkdir -p /var/www/panel
cd /var/www/panel

# Клонирование репозитория
if [ -d .git ]; then
    echo "📥 Обновление репозитория..."
    git fetch origin
    git checkout develop
    git pull origin develop
else
    echo "📥 Клонирование репозитория..."
    git clone -b develop https://github.com/drads1337/control_panel.git .
fi

# Создание .env если не существует
if [ ! -f .env ]; then
    echo "🔐 Создание .env файла..."
    python3 << 'PYEOF'
import secrets

env_content = f"""# Database
POSTGRES_DB=panel
POSTGRES_USER=panel_user
POSTGRES_PASSWORD={secrets.token_urlsafe(16)}
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD={secrets.token_urlsafe(16)}
REDIS_PORT=6380

# Flask
SECRET_KEY={secrets.token_urlsafe(32)}
FLASK_ENV=production
FLASK_DEBUG=0

# Security Keys
PANEL_MASTER_KEY={secrets.token_hex(32)}
JWT_SECRET_KEY={secrets.token_urlsafe(32)}
TOKEN_STATIC_WORD={secrets.token_urlsafe(32)}
OFFLINE_TICKET_SECRET={secrets.token_urlsafe(32)}
PROJECT_MASTER_KEY={secrets.token_hex(32)}

# Frontend
FRONTEND_URL=https://ovrin.xyz
CORS_ORIGINS=https://ovrin.xyz,https://www.ovrin.xyz

# API Port
API_PORT=5001

# Nginx Ports
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Flower
FLOWER_PORT=5555
FLOWER_BASIC_AUTH=admin:admin
"""

with open('.env', 'w') as f:
    f.write(env_content)
print("✅ .env файл создан")
PYEOF
fi

# SSL сертификаты
if [ ! -f nginx/ssl/cert.pem ]; then
    echo "🔐 Создание SSL сертификатов..."
    mkdir -p nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz" 2>/dev/null
fi

# Развертывание
echo "🚀 Запуск развертывания..."
chmod +x deploy.sh
./deploy.sh develop

echo ""
echo "✅ Развертывание завершено!"
echo "📊 Статус: docker-compose ps"
echo "🌐 Frontend: https://ovrin.xyz"

