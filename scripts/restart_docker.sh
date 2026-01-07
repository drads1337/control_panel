#!/bin/bash
# Перезапуск Docker контейнеров для применения изменений

set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "Перезапуск Docker контейнеров"
echo "=========================================="
echo ""

echo "1. Остановка контейнеров..."
docker-compose down

echo ""
echo "2. Пересборка API контейнера (только API, быстрее)..."
docker-compose build api

echo ""
echo "3. Запуск контейнеров..."
docker-compose up -d

echo ""
echo "4. Ожидание запуска сервисов..."
sleep 8

echo ""
echo "5. Статус контейнеров:"
docker-compose ps

echo ""
echo "6. Проверка здоровья API..."
sleep 2
curl -s http://localhost:5001/api/health/live | head -3 || echo "⚠️  API еще не готов"

echo ""
echo "7. Проверка логов API (последние 30 строк, ошибки):"
docker-compose logs --tail=30 api | grep -i error || echo "✅ Нет ошибок в последних 30 строках"

echo ""
echo "8. Проверка доступности нового endpoint..."
sleep 2
curl -s -X POST http://localhost:5001/api/projects/2920317791/mtls/csr-sign-public \
  -H "Content-Type: application/json" \
  -d '{"user_key":"test"}' | head -3 || echo "⚠️  Endpoint проверка не выполнена"

echo ""
echo "=========================================="
echo "Готово! Контейнеры перезапущены."
echo "=========================================="
echo ""
echo "Проверка лицензии:"
echo "  python check_license.py"
echo "Или на сервере:"
echo "  docker-compose exec api python /app/check_license.py"

