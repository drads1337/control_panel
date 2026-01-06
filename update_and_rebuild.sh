#!/bin/bash
# Обновление кода и пересборка контейнеров на сервере

set -euo pipefail

PROJECT_DIR="/var/www/panel"
cd "$PROJECT_DIR"

echo "🔄 Обновление кода и пересборка контейнеров"
echo ""

# 1. Обновление кода из репозитория
echo "1️⃣  Обновление кода из репозитория..."
git fetch origin
git pull origin main || git pull origin develop || echo "⚠️  Не удалось обновить код"
echo ""

# 2. Проверка изменений в config.py
echo "2️⃣  Проверка изменений в backend/config/config.py..."
if grep -q "BOT_API_KEY = os.environ.get(\"BOT_API_KEY\") or None" backend/config/config.py 2>/dev/null; then
    echo "✅ Изменения применены (BOT_API_KEY опциональный)"
else
    echo "⚠️  Изменения не найдены - возможно нужно обновить код"
fi
echo ""

# 3. Проверка docker-compose.prod.yml
echo "3️⃣  Проверка docker-compose.prod.yml..."
if grep -q "^version:" docker-compose.prod.yml 2>/dev/null; then
    echo "⚠️  Найдено устаревшее поле 'version' - удаляю..."
    sed -i '/^version:/d' docker-compose.prod.yml
    echo "✅ Поле 'version' удалено"
else
    echo "✅ docker-compose.prod.yml в порядке"
fi
echo ""

# 4. Остановка контейнеров
echo "4️⃣  Остановка контейнеров..."
docker compose down
echo ""

# 5. Пересборка образов
echo "5️⃣  Пересборка Docker образов..."
docker compose build --no-cache
echo ""

# 6. Запуск контейнеров
echo "6️⃣  Запуск контейнеров..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
echo ""

# 7. Ожидание готовности
echo "7️⃣  Ожидание готовности сервисов (20 секунд)..."
sleep 20
echo ""

# 8. Проверка статуса
echo "8️⃣  Статус контейнеров:"
docker compose ps
echo ""

# 9. Проверка логов API
echo "9️⃣  Последние 20 строк логов API:"
docker compose logs --tail=20 api
echo ""

# 10. Проверка доступности
echo "🔟 Проверка доступности:"
echo "API health check:"
curl -f http://localhost:5001/api/health/live 2>/dev/null && echo "✅ API работает" || echo "❌ API не отвечает"
echo ""
echo "Nginx (локально):"
curl -k -I https://localhost 2>/dev/null | head -3 || echo "❌ Nginx не отвечает"
echo ""

echo "✅ Обновление завершено!"
echo ""
echo "🌐 Проверьте доступность домена:"
echo "   • https://ovrin.xyz"
echo "   • http://ovrin.xyz (должен редиректить на HTTPS)"

