#!/bin/bash
# Скрипт для обновления frontend на сервере
# Использование: ./update_frontend.sh

set -e

PROJECT_DIR="/var/www/panel"

echo "🔄 Обновление frontend на сервере..."
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Запустите скрипт с правами root: sudo ./update_frontend.sh"
    exit 1
fi

cd "$PROJECT_DIR"

# Обновление кода из Git
echo "📥 Обновление кода из Git..."
git fetch origin
git pull origin main || git pull origin develop

# Пересборка frontend образа (nginx содержит frontend)
echo "🔨 Пересборка frontend образа..."
docker compose build --no-cache nginx || docker-compose build --no-cache nginx

# Перезапуск nginx контейнера (frontend)
echo "🔄 Перезапуск nginx контейнера..."
docker compose up -d --force-recreate nginx || docker-compose up -d --force-recreate nginx

# Ожидание готовности
echo "⏳ Ожидание готовности..."
sleep 5

# Проверка статуса
echo ""
echo "📊 Статус nginx (frontend):"
docker compose ps nginx || docker-compose ps nginx

echo ""
echo "✅ Frontend обновлен!"
echo "🌐 Проверьте: https://ovrin.xyz"
echo "📋 Логи: docker compose logs -f nginx"

