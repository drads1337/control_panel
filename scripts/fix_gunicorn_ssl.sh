#!/bin/bash
# Исправление ошибки Gunicorn SSL на сервере

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Исправление ошибки Gunicorn SSL"
echo "=========================================="
echo ""
echo "Проблема: Gunicorn пытается использовать SSL сертификаты,"
echo "но SSL обрабатывается Nginx, а Gunicorn работает по HTTP."
echo ""
echo "Решение: Обновлена конфигурация Gunicorn."
echo ""

cd "$PROJECT_ROOT"

echo "Шаг 1: Пересборка API контейнера..."
docker-compose build api

echo ""
echo "Шаг 2: Перезапуск контейнеров..."
docker-compose up -d

echo ""
echo "Шаг 3: Ожидание запуска (10 секунд)..."
sleep 10

echo ""
echo "Шаг 4: Проверка статуса..."
docker-compose ps

echo ""
echo "Шаг 5: Проверка логов API..."
echo "--- Последние 15 строк логов API ---"
docker-compose logs api --tail=15 2>&1 | tail -15

echo ""
if docker-compose logs api 2>&1 | grep -q "certfile.*does not exist"; then
    echo "✗ Ошибка всё ещё присутствует"
    echo "  Проверьте, что изменения в gunicorn.conf.py применены"
else
    echo "✓ API должен работать без ошибок SSL"
fi

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="
echo ""
echo "Проверьте статус:"
echo "  docker-compose ps"
echo ""
echo "Проверьте логи:"
echo "  docker-compose logs api | tail -20"
echo ""

