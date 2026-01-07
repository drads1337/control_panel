#!/bin/bash
# Тест проверки лицензии на сервере

set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "Тест проверки лицензии"
echo "=========================================="
echo ""

# Проверка наличия скрипта
if [ ! -f "check_license.py" ]; then
    echo "❌ Файл check_license.py не найден"
    exit 1
fi

echo "1. Проверка зависимостей Python..."
echo "---"
docker-compose exec -T api python -c "import requests, cryptography; print('✅ Все зависимости установлены')" || {
    echo "❌ Отсутствуют зависимости"
    exit 1
}

echo ""
echo "2. Копирование check_license.py в контейнер..."
echo "---"
docker cp check_license.py $(docker-compose ps -q api):/app/check_license.py || {
    echo "⚠️  Не удалось скопировать, возможно файл уже есть"
}

echo ""
echo "3. Проверка доступности нового endpoint для получения сертификата..."
echo "---"
# Проверяем, что endpoint существует (должен вернуть ошибку, но не 404)
RESPONSE=$(docker-compose exec -T api curl -s -X POST http://localhost:5001/api/projects/2920317791/mtls/csr-sign-public \
  -H "Content-Type: application/json" \
  -d '{"user_key":"test"}' 2>&1 || true)

if echo "$RESPONSE" | grep -q "404\|Not Found"; then
    echo "❌ Endpoint не найден (404)"
    echo "   Ответ: $RESPONSE"
    exit 1
elif echo "$RESPONSE" | grep -q "user_key and csr_pem are required\|Invalid user_key"; then
    echo "✅ Endpoint доступен (вернул ожидаемую ошибку валидации)"
else
    echo "⚠️  Неожиданный ответ от endpoint:"
    echo "   $RESPONSE" | head -3
fi

echo ""
echo "4. Запуск проверки лицензии..."
echo "---"
echo ""

# Запускаем скрипт проверки лицензии
docker-compose exec -T api python /app/check_license.py 2>&1 || {
    EXIT_CODE=$?
    echo ""
    echo "⚠️  Скрипт завершился с кодом: $EXIT_CODE"
    echo "Проверьте вывод выше"
    exit $EXIT_CODE
}

echo ""
echo "=========================================="
echo "Готово! Проверка завершена."
echo "=========================================="

