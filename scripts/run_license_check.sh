#!/bin/bash
# Запуск проверки лицензии на сервере

set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "Проверка лицензии"
echo "=========================================="
echo ""

# Проверка наличия скрипта
if [ ! -f "check_license.py" ]; then
    echo "❌ Файл check_license.py не найден"
    exit 1
fi

# Копируем скрипт в контейнер (если его там нет)
echo "1. Подготовка скрипта..."
echo "---"
docker-compose exec -T api test -f /app/check_license.py || {
    echo "Копирование check_license.py в контейнер..."
    docker cp check_license.py $(docker-compose ps -q api):/app/check_license.py || {
        echo "⚠️  Не удалось скопировать скрипт"
        echo "   Попробуйте вручную: docker cp check_license.py \$(docker-compose ps -q api):/app/check_license.py"
    }
}

echo ""
echo "2. Проверка зависимостей..."
echo "---"
docker-compose exec -T api python -c "import requests, cryptography; print('✅ Все зависимости установлены')" || {
    echo "❌ Отсутствуют зависимости"
    exit 1
}

echo ""
echo "3. Запуск проверки лицензии..."
echo "---"
echo ""

# Запускаем скрипт проверки лицензии
docker-compose exec api python /app/check_license.py

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="

