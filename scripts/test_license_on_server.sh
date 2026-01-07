#!/bin/bash
# Тест проверки лицензии на сервере

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Тест проверки лицензии на сервере"
echo "=========================================="
echo ""

# Проверка наличия скрипта
if [ ! -f "check_license.py" ]; then
    echo "❌ Файл check_license.py не найден"
    exit 1
fi

echo "1. Проверка зависимостей Python..."
echo "---"
docker-compose exec -T api python -c "
import sys
try:
    import requests
    import cryptography
    print('✅ Все зависимости установлены')
except ImportError as e:
    print(f'❌ Отсутствует зависимость: {e}')
    sys.exit(1)
" || {
    echo "⚠️  Некоторые зависимости могут отсутствовать"
}
echo ""

echo "2. Проверка mTLS сертификатов для проекта..."
echo "---"
PROJECT_ID="2920317791"
CLIENT_NAME="test-client"

# Проверяем наличие CA для проекта
CA_CERT_PATH="/app/nginx/ssl/projects/${PROJECT_ID}/ca/ca-cert.pem"
CLIENT_CERT_PATH="/app/nginx/ssl/projects/${PROJECT_ID}/clients/${CLIENT_NAME}/client-cert.pem"
CLIENT_KEY_PATH="/app/nginx/ssl/projects/${PROJECT_ID}/clients/${CLIENT_NAME}/client-key.pem"

docker-compose exec -T api bash -c "
if [ -f \"${CA_CERT_PATH}\" ]; then
    echo '✅ CA сертификат найден'
else
    echo '⚠️  CA сертификат не найден'
    echo '   Попытка создания CA через Python...'
    python /app/scripts/create_project_ca.py ${PROJECT_ID} || {
        echo '⚠️  Ошибка создания CA, попробуем автоматически при подключении'
    }
fi

if [ -f \"${CLIENT_CERT_PATH}\" ] && [ -f \"${CLIENT_KEY_PATH}\" ]; then
    echo '✅ Клиентские сертификаты найдены'
else
    echo '⚠️  Клиентские сертификаты не найдены'
    echo '   Они будут созданы автоматически при первом запуске check_license.py'
fi
" || {
    echo "⚠️  Ошибка при проверке сертификатов"
}
echo ""

echo "3. Запуск проверки лицензии..."
echo "---"
echo ""

# Копируем скрипт в контейнер если его там нет
docker-compose exec -T api test -f /app/check_license.py || {
    echo "Копирование check_license.py в контейнер..."
    docker cp check_license.py panel_api_1:/app/check_license.py 2>/dev/null || \
    docker cp check_license.py $(docker-compose ps -q api):/app/check_license.py 2>/dev/null || {
        echo "⚠️  Не удалось скопировать скрипт, используем локальный путь"
    }
}

# Запускаем скрипт проверки лицензии
docker-compose exec -T api python /app/check_license.py 2>&1 || {
    echo ""
    echo "⚠️  Скрипт завершился с ошибкой"
    echo "Проверьте логи выше"
    exit 1
}

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="
