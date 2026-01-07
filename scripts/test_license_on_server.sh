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

echo "2. Запуск проверки лицензии..."
echo "---"
echo ""

# Запускаем скрипт проверки лицензии
docker-compose exec -T api python /app/check_license.py || {
    echo ""
    echo "⚠️  Скрипт завершился с ошибкой"
    echo "Проверьте логи выше"
}

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="

