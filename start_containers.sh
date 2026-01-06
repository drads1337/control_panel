#!/bin/bash
# Быстрый запуск контейнеров после сборки

set -e

PROJECT_DIR="/var/www/panel"
cd "$PROJECT_DIR"

echo "🚀 Запуск контейнеров Panel..."

# Проверка .env
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

# Проверка SSL сертификатов
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "🔐 Создание SSL сертификатов..."
    mkdir -p nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz" 2>/dev/null
    echo "✅ SSL сертификаты созданы"
fi

# Остановка старых контейнеров (если есть)
echo "🛑 Остановка старых контейнеров..."
docker compose down 2>/dev/null || true

# Запуск контейнеров с production конфигурацией
echo "🚀 Запуск контейнеров..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Ожидание готовности
echo "⏳ Ожидание готовности сервисов..."
sleep 15

# Проверка статуса
echo ""
echo "📊 Статус контейнеров:"
docker compose ps

echo ""
echo "✅ Контейнеры запущены!"
echo ""
echo "🌐 Проверьте доступность:"
echo "   • https://ovrin.xyz"
echo "   • http://localhost (должен редиректить на HTTPS)"
echo ""
echo "📋 Если домен не работает, проверьте:"
echo "   1. DNS настройки (A-запись для ovrin.xyz должна указывать на IP сервера)"
echo "   2. Файрвол (порты 80 и 443 должны быть открыты)"
echo "   3. Логи: docker compose logs -f nginx"

