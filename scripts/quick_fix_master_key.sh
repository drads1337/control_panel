#!/bin/bash
# Быстрое исправление PANEL_MASTER_KEY

set -e

cd /var/www/panel

echo "Генерация нового PANEL_MASTER_KEY (64 hex символа)..."
NEW_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || python -c "import secrets; print(secrets.token_hex(32))")

if [ ${#NEW_KEY} -ne 64 ]; then
    echo "Ошибка: не удалось сгенерировать ключ правильной длины"
    exit 1
fi

echo "Новый ключ: ${NEW_KEY:0:20}...${NEW_KEY: -10}"

# Резервная копия
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "Резервная копия создана"

# Обновление ключа
if grep -q "^PANEL_MASTER_KEY=" .env; then
    sed -i "s|^PANEL_MASTER_KEY=.*|PANEL_MASTER_KEY=$NEW_KEY|" .env
    echo "PANEL_MASTER_KEY обновлен в .env"
else
    echo "PANEL_MASTER_KEY=$NEW_KEY" >> .env
    echo "PANEL_MASTER_KEY добавлен в .env"
fi

# Проверка
VERIFIED=$(grep "^PANEL_MASTER_KEY=" .env | cut -d '=' -f2)
if [ ${#VERIFIED} -eq 64 ]; then
    echo "✅ Ключ успешно обновлен (длина: ${#VERIFIED} символов)"
else
    echo "❌ Ошибка: длина ключа ${#VERIFIED} (должно быть 64)"
    exit 1
fi

echo ""
echo "Перезапуск API контейнера..."
docker-compose restart api

echo ""
echo "Ожидание запуска (15 секунд)..."
sleep 15

echo ""
echo "Проверка API..."
if docker exec panel_api curl -s -f -m 5 http://localhost:5001/api/health/live > /dev/null 2>&1; then
    echo "✅ API успешно запущен!"
    docker exec panel_api curl -s http://localhost:5001/api/health/live
else
    echo "⚠ API еще не отвечает. Проверьте логи:"
    echo "   docker logs panel_api --tail 30"
fi
