#!/bin/bash
# Скрипт для пересборки frontend и nginx

set -e

echo "🔨 Пересборка Frontend и Nginx"
echo ""

# Вариант 1: Собрать frontend локально и смонтировать
echo "Выберите вариант:"
echo "1) Собрать frontend локально и смонтировать в контейнер (быстрее для разработки)"
echo "2) Пересобрать Docker образ nginx с frontend внутри (production)"
read -p "Выберите вариант (1 или 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "📦 Сборка frontend локально..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo "Установка зависимостей..."
        npm install --legacy-peer-deps
    fi
    echo "Сборка frontend..."
    npm run build
    cd ..
    
    echo ""
    echo "🔄 Обновление docker-compose.yml для монтирования локального frontend/dist..."
    # Временно раскомментируем volume для frontend/dist
    sed -i.bak 's|# - ./frontend/dist:/app/frontend/dist:ro|- ./frontend/dist:/app/frontend/dist:ro|' docker-compose.yml
    
    echo "✅ Frontend собран локально"
    echo "🔄 Перезапуск nginx..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate nginx
    
elif [ "$choice" = "2" ]; then
    echo ""
    echo "🐳 Пересборка Docker образа nginx с frontend..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache nginx
    
    echo ""
    echo "🔄 Перезапуск nginx..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate nginx
else
    echo "❌ Неверный выбор"
    exit 1
fi

echo ""
echo "⏳ Ожидание запуска nginx (5 секунд)..."
sleep 5

echo ""
echo "🔍 Проверка статуса:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps nginx

echo ""
echo "📋 Проверка наличия frontend/dist в контейнере:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx ls -la /app/frontend/dist/ 2>/dev/null || echo "❌ Директория не найдена!"

echo ""
echo "✅ Готово!"
echo ""
echo "Проверьте доступность:"
echo "  - http://your-server-ip"
echo "  - https://ovrin.xyz"

