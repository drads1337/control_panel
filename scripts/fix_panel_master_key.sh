#!/bin/bash
# Скрипт для исправления PANEL_MASTER_KEY - должен быть 64 hex символа

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================"
echo "Исправление PANEL_MASTER_KEY"
echo "============================================================"
echo ""

cd "$PROJECT_ROOT"

# Проверка существования .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

echo "1. Проверка текущего PANEL_MASTER_KEY..."
echo "---"

# Получаем текущий ключ
CURRENT_KEY=$(grep "^PANEL_MASTER_KEY=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")

if [ -z "$CURRENT_KEY" ]; then
    echo "⚠ PANEL_MASTER_KEY не найден в .env файле"
else
    CURRENT_LENGTH=${#CURRENT_KEY}
    echo "Текущий ключ: ${CURRENT_KEY:0:20}...${CURRENT_KEY: -10}"
    echo "Длина: $CURRENT_LENGTH символов"
    
    if [ "$CURRENT_LENGTH" -eq 64 ]; then
        echo "✅ Ключ имеет правильную длину (64 символа)"
        exit 0
    elif [ "$CURRENT_LENGTH" -eq 60 ]; then
        echo "⚠ Ключ имеет 60 символов вместо 64"
        echo "   Возможно, ключ был обрезан. Нужно создать новый."
    else
        echo "⚠ Ключ имеет неправильную длину: $CURRENT_LENGTH (должно быть 64)"
    fi
fi

echo ""
echo "2. Генерация нового PANEL_MASTER_KEY (64 hex символа)..."
echo "---"

# Генерируем новый ключ (32 байта = 64 hex символа)
NEW_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || python -c "import secrets; print(secrets.token_hex(32))")

if [ -z "$NEW_KEY" ]; then
    echo "❌ Не удалось сгенерировать новый ключ"
    exit 1
fi

NEW_LENGTH=${#NEW_KEY}
echo "Новый ключ: ${NEW_KEY:0:20}...${NEW_KEY: -10}"
echo "Длина: $NEW_LENGTH символов"

if [ "$NEW_LENGTH" -ne 64 ]; then
    echo "❌ Ошибка: сгенерированный ключ имеет неправильную длину!"
    exit 1
fi

echo ""
echo "3. Обновление .env файла..."
echo "---"

# Делаем резервную копию
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✓ Создана резервная копия: .env.backup.*"

# Обновляем или добавляем PANEL_MASTER_KEY в .env
if grep -q "^PANEL_MASTER_KEY=" .env 2>/dev/null; then
    # Заменяем существующий ключ
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^PANEL_MASTER_KEY=.*|PANEL_MASTER_KEY=$NEW_KEY|" .env
    else
        # Linux
        sed -i "s|^PANEL_MASTER_KEY=.*|PANEL_MASTER_KEY=$NEW_KEY|" .env
    fi
    echo "✓ Обновлен существующий PANEL_MASTER_KEY"
else
    # Добавляем новый ключ в конец файла
    echo "" >> .env
    echo "PANEL_MASTER_KEY=$NEW_KEY" >> .env
    echo "✓ Добавлен новый PANEL_MASTER_KEY"
fi

# Проверяем, что ключ записан правильно
VERIFIED_KEY=$(grep "^PANEL_MASTER_KEY=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
VERIFIED_LENGTH=${#VERIFIED_KEY}

if [ "$VERIFIED_LENGTH" -eq 64 ]; then
    echo "✅ Ключ успешно обновлен в .env файле"
else
    echo "❌ Ошибка: ключ в файле имеет неправильную длину ($VERIFIED_LENGTH вместо 64)"
    echo "   Восстанавливаем резервную копию..."
    mv .env.backup.* .env 2>/dev/null || true
    exit 1
fi

echo ""
echo "4. Перезапуск API контейнера..."
echo "---"

# Проверка docker-compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "⚠ docker-compose не найден. Перезапустите контейнеры вручную:"
    echo "   docker-compose restart api"
    exit 0
fi

$DOCKER_COMPOSE restart api
echo "✓ API контейнер перезапущен"

echo ""
echo "5. Ожидание запуска API (15 секунд)..."
echo "---"
sleep 15

echo ""
echo "6. Проверка статуса API..."
echo "---"
if docker exec panel_api curl -s -f -m 5 http://localhost:5001/api/health/live > /dev/null 2>&1; then
    echo "✅ API успешно запустился и отвечает на запросы!"
    echo ""
    echo "Проверка готовности (база данных и Redis)..."
    docker exec panel_api curl -s http://localhost:5001/api/health/ready | head -5
else
    echo "⚠ API еще не отвечает. Проверьте логи:"
    echo "   docker logs panel_api --tail 50"
    echo ""
    echo "Если проблема сохраняется, проверьте логи выше."
fi

echo ""
echo "============================================================"
echo "Исправление завершено"
echo "============================================================"
echo ""
echo "ВАЖНО: Новый PANEL_MASTER_KEY был создан."
echo "Если у вас есть зашифрованные данные, которые были зашифрованы"
echo "старым ключом, они могут быть недоступны."
echo ""
echo "Резервная копия .env сохранена в .env.backup.*"
echo ""
