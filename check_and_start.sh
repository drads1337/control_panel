#!/bin/bash
# Скрипт для проверки и запуска контейнеров после сборки

set -e

PROJECT_DIR="/var/www/panel"

echo "🔍 Проверка статуса контейнеров..."
cd "$PROJECT_DIR"

# Проверка статуса контейнеров
echo ""
echo "📊 Текущий статус контейнеров:"
docker compose ps

echo ""
echo "🔍 Проверка запущенных контейнеров..."
RUNNING=$(docker compose ps --format json | jq -r 'select(.State == "running") | .Name' 2>/dev/null || docker compose ps | grep -c "Up" || echo "0")

if [ "$RUNNING" = "0" ] || [ -z "$RUNNING" ]; then
    echo "⚠️  Контейнеры не запущены. Запускаю..."
    
    # Проверка наличия .env файла
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        echo "❌ Файл .env не найден! Создайте его перед запуском."
        exit 1
    fi
    
    # Запуск контейнеров с production конфигурацией
    echo "🚀 Запуск контейнеров..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    echo ""
    echo "⏳ Ожидание готовности сервисов (15 секунд)..."
    sleep 15
    
    echo ""
    echo "📊 Статус после запуска:"
    docker compose ps
    
    echo ""
    echo "📋 Логи последних 20 строк nginx:"
    docker compose logs --tail=20 nginx
    
    echo ""
    echo "📋 Логи последних 20 строк api:"
    docker compose logs --tail=20 api
else
    echo "✅ Контейнеры уже запущены"
fi

echo ""
echo "🔍 Проверка портов..."
echo "Порт 80 (HTTP):"
netstat -tuln | grep ":80 " || ss -tuln | grep ":80 " || echo "⚠️  Порт 80 не слушается"

echo ""
echo "Порт 443 (HTTPS):"
netstat -tuln | grep ":443 " || ss -tuln | grep ":443 " || echo "⚠️  Порт 443 не слушается"

echo ""
echo "🔍 Проверка DNS для ovrin.xyz..."
nslookup ovrin.xyz 2>/dev/null || dig ovrin.xyz +short || echo "⚠️  Не удалось проверить DNS"

echo ""
echo "🌐 Проверка доступности домена локально..."
curl -k -I https://localhost 2>/dev/null | head -5 || echo "⚠️  HTTPS не отвечает на localhost"
curl -I http://localhost 2>/dev/null | head -5 || echo "⚠️  HTTP не отвечает на localhost"

echo ""
echo "✅ Диагностика завершена!"
echo ""
echo "📋 Полезные команды:"
echo "   • Просмотр всех логов: docker compose logs -f"
echo "   • Логи nginx: docker compose logs -f nginx"
echo "   • Логи api: docker compose logs -f api"
echo "   • Перезапуск: docker compose restart"
echo "   • Остановка: docker compose down"
echo "   • Статус: docker compose ps"

