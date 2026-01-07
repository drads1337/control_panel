#!/bin/bash
# Скрипт для диагностики проблем с Frontend

echo "🔍 Диагностика Frontend"
echo ""

# Проверка статуса контейнеров
echo "1️⃣  Статус контейнеров:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps nginx
echo ""

# Проверка наличия frontend/dist в контейнере
echo "2️⃣  Проверка наличия frontend/dist в контейнере nginx:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx ls -la /app/frontend/dist/ 2>/dev/null || echo "❌ Директория /app/frontend/dist не найдена!"
echo ""

# Проверка наличия index.html
echo "3️⃣  Проверка наличия index.html:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx ls -la /app/frontend/dist/index.html 2>/dev/null || echo "❌ index.html не найден!"
echo ""

# Проверка конфигурации nginx
echo "4️⃣  Проверка конфигурации nginx:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -t
echo ""

# Проверка логов nginx
echo "5️⃣  Последние 30 строк логов nginx:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=30 nginx
echo ""

# Проверка доступности через curl
echo "6️⃣  Проверка доступности через curl:"
echo "HTTP (localhost:80):"
curl -I http://localhost 2>&1 | head -5
echo ""
echo "HTTPS (localhost:443):"
curl -k -I https://localhost 2>&1 | head -5
echo ""

# Проверка локальной директории frontend/dist
echo "7️⃣  Проверка локальной директории frontend/dist:"
if [ -d "frontend/dist" ]; then
    echo "✅ Директория существует"
    ls -la frontend/dist/ | head -10
    if [ -f "frontend/dist/index.html" ]; then
        echo "✅ index.html найден локально"
    else
        echo "❌ index.html не найден локально"
    fi
else
    echo "❌ Директория frontend/dist не существует локально"
    echo "   Нужно собрать frontend: cd frontend && npm run build"
fi
echo ""

echo "✅ Диагностика завершена"

