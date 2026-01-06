#!/bin/bash
# Команды для выполнения на сервере
# Скопируйте и выполните эти команды на сервере: ssh root@38.242.149.188
#
# Альтернатива: Быстрое развертывание через curl (попробует main, затем develop):
# curl -s https://raw.githubusercontent.com/drads1337/control_panel/main/DEPLOY_NOW.sh | bash || \
# curl -s https://raw.githubusercontent.com/drads1337/control_panel/develop/DEPLOY_NOW.sh | bash

# 1. Установка Docker (если не установлен)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Установка Docker Compose (если не установлен)
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 3. Создание директории проекта
mkdir -p /var/www/panel
cd /var/www/panel

# 4. Клонирование репозитория
git clone -b develop https://github.com/drads1337/control_panel.git .

# 5. Создание .env файла (отредактируйте значения!)
cat > .env << 'EOF'
# Database
POSTGRES_DB=panel
POSTGRES_USER=panel_user
POSTGRES_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")
REDIS_PORT=6380

# Flask
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
FLASK_ENV=production
FLASK_DEBUG=0

# Security Keys
PANEL_MASTER_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
TOKEN_STATIC_WORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
OFFLINE_TICKET_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
PROJECT_MASTER_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

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
EOF

# 6. Генерация значений для .env
python3 << 'PYTHON'
import secrets
import re

with open('.env', 'r') as f:
    content = f.read()

# Заменяем команды на реальные значения
replacements = {
    '$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")': secrets.token_urlsafe(16),
    '$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")': secrets.token_urlsafe(32),
    '$(python3 -c "import secrets; print(secrets.token_hex(32))")': secrets.token_hex(32),
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('.env', 'w') as f:
    f.write(content)

print("✅ .env файл создан с безопасными ключами")
PYTHON

# 7. Создание SSL сертификатов
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz"

# 8. Запуск развертывания
chmod +x deploy.sh
./deploy.sh develop

echo ""
echo "✅ Развертывание завершено!"
echo "🌐 Проверьте статус: docker-compose ps"

