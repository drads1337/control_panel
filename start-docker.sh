#!/bin/bash
# Скрипт для запуска Docker контейнеров проекта Panel

echo "🚀 Запуск Docker контейнеров для проекта Panel..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker Desktop с https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Проверка запущен ли Docker daemon
if ! docker ps &> /dev/null; then
    echo "⚠️  Docker daemon не запущен."
    echo "📋 Пожалуйста, запустите Docker Desktop вручную:"
    echo "   1. Откройте приложение Docker Desktop"
    echo "   2. Дождитесь полной загрузки (иконка в меню перестанет мигать)"
    echo "   3. Затем запустите этот скрипт снова"
    echo ""
    echo "Или попробуйте запустить: open -a Docker"
    exit 1
fi

echo "✅ Docker daemon запущен"

# Проверка .env файла
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден. Создаю базовый .env файл..."
    # Базовые настройки будут использованы из docker-compose.yml
fi

# Проверка SSL сертификатов
if [ ! -f nginx/ssl/cert.pem ] || [ ! -f nginx/ssl/key.pem ]; then
    echo "⚠️  SSL сертификаты не найдены. Создаю самоподписанные сертификаты..."
    mkdir -p nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null
    echo "✅ SSL сертификаты созданы"
fi

echo ""
echo "🔨 Собираю Docker образы (это может занять несколько минут)..."
docker-compose build

echo ""
echo "🚀 Запускаю контейнеры..."
docker-compose up -d

echo ""
echo "⏳ Ожидание готовности сервисов..."
sleep 10

echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "✅ Готово! Проект запущен."
echo ""
echo "📝 Доступные сервисы:"
echo "   - Frontend (Nginx): http://localhost (HTTP) или https://localhost (HTTPS)"
echo "   - API: http://localhost:5001"
echo "   - Flower (Celery): http://localhost:5555"
echo ""
echo "📋 Полезные команды:"
echo "   - Просмотр логов: docker-compose logs -f"
echo "   - Остановка: docker-compose down"
echo "   - Перезапуск: docker-compose restart"
echo "   - Статус: docker-compose ps"
