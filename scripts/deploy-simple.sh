#!/bin/bash

# Простой скрипт деплоя для Docker
# Использование: ./scripts/deploy-simple.sh

set -e

echo "🚀 Простой деплой Panel Project..."

# Обновляем код из Git (если это Git репозиторий)
if [ -d .git ]; then
    echo "📥 Обновление кода..."
    git pull || echo "⚠️  Не удалось обновить из Git (продолжаем...)"
fi

# Собираем и запускаем
echo "🏗️  Сборка и запуск контейнеров..."
docker compose build
docker compose up -d

# Ждем немного
echo "⏳ Ожидание готовности сервисов..."
sleep 5

# Показываем статус
echo "✅ Статус контейнеров:"
docker compose ps

echo ""
echo "✅ Деплой завершен!"
echo "📋 Логи: docker compose logs -f"
echo "🌐 Приложение: https://your-domain.com"

