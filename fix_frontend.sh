#!/bin/bash
# Быстрое исправление проблемы с Frontend

set -e

echo "🔧 Быстрое исправление Frontend"
echo ""

# Остановка nginx
echo "1️⃣  Остановка nginx..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop nginx 2>/dev/null || true

# Пересборка nginx образа
echo "2️⃣  Пересборка образа nginx (это может занять несколько минут)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache nginx

# Запуск nginx
echo "3️⃣  Запуск nginx..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx

# Ожидание
echo "4️⃣  Ожидание запуска (10 секунд)..."
sleep 10

# Проверка
echo "5️⃣  Проверка:"
echo ""
echo "Статус контейнера:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps nginx
echo ""

echo "Содержимое /app/frontend/dist:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx ls -la /app/frontend/dist/ 2>/dev/null | head -10 || echo "❌ Директория не найдена!"
echo ""

echo "Проверка index.html:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx test -f /app/frontend/dist/index.html && echo "✅ index.html найден" || echo "❌ index.html не найден"
echo ""

echo "Логи nginx (последние 20 строк):"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 nginx
echo ""

echo "✅ Готово!"
echo ""
echo "Проверьте доступность:"
echo "  - http://your-server-ip"
echo "  - https://ovrin.xyz"
echo ""
echo "Если проблема сохраняется, выполните: ./check_frontend.sh"

