#!/bin/bash
# Скрипт для развертывания проекта на сервере
# Использование: ./deploy.sh [main|develop]

set -e

BRANCH=${1:-main}
PROJECT_DIR="/var/www/panel"
GIT_REPO="https://github.com/drads1337/control_panel.git"

echo "🚀 Развертывание проекта Panel"
echo "Ветка: $BRANCH"
echo "Директория: $PROJECT_DIR"
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Запустите скрипт с правами root: sudo ./deploy.sh"
    exit 1
fi

# Создание директории проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo "📁 Создание директории проекта..."
    mkdir -p "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    git clone "$GIT_REPO" .
else
    echo "📁 Обновление проекта..."
    cd "$PROJECT_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
fi

# Проверка наличия .env файла
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  Файл .env не найден!"
    echo "🔐 Создание .env файла с автоматически сгенерированными ключами..."
    
    cd "$PROJECT_DIR"
    python3 << 'PYEOF'
import secrets
import os

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
print("✅ .env файл создан с автоматически сгенерированными ключами")
print("⚠️  ВАЖНО: Проверьте и при необходимости обновите значения в .env файле")
PYEOF
fi

# Проверка SSL сертификатов
if [ ! -f "$PROJECT_DIR/nginx/ssl/cert.pem" ] || [ ! -f "$PROJECT_DIR/nginx/ssl/key.pem" ]; then
    echo "🔐 SSL сертификаты не найдены. Создание самоподписанных сертификатов..."
    mkdir -p "$PROJECT_DIR/nginx/ssl"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$PROJECT_DIR/nginx/ssl/key.pem" \
        -out "$PROJECT_DIR/nginx/ssl/cert.pem" \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz" 2>/dev/null
    echo "✅ SSL сертификаты созданы"
fi

# Остановка старых контейнеров
echo "🛑 Остановка старых контейнеров..."
cd "$PROJECT_DIR"
docker-compose down

# Сборка образов
echo "🔨 Сборка Docker образов..."
docker-compose build --no-cache

# Запуск контейнеров
echo "🚀 Запуск контейнеров..."
docker-compose up -d

# Ожидание готовности сервисов
echo "⏳ Ожидание готовности сервисов..."
sleep 15

# Применение миграций
echo "📊 Применение миграций базы данных..."
docker-compose exec -T api python -c "
from backend.core.app import create_app
from flask_migrate import upgrade
import os
os.chdir('/app/backend')
app = create_app()
app.app_context().push()
upgrade()
" || echo "⚠️  Миграции могут быть уже применены"

# Проверка статуса
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "🌐 Доступные сервисы:"
echo "   • Frontend: https://ovrin.xyz"
echo "   • API: http://localhost:5001"
echo "   • Flower: http://localhost:5555"
echo ""
echo "📋 Полезные команды:"
echo "   • Просмотр логов: docker-compose logs -f"
echo "   • Остановка: docker-compose down"
echo "   • Перезапуск: docker-compose restart"
echo "   • Статус: docker-compose ps"

