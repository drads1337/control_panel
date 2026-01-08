#!/bin/bash
# Скрипт для исправления прав доступа к CA сертификатам для Docker контейнеров

echo "============================================================"
echo "Исправление прав доступа к CA сертификатам"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CA_KEY="$SSL_DIR/ca-key.pem"
CA_CERT="$SSL_DIR/ca-cert.pem"

if [ ! -f "$CA_KEY" ]; then
    echo "⚠ CA ключ не найден: $CA_KEY"
    echo "   Создайте его с помощью: ./scripts/create_single_ca.sh"
    exit 1
fi

if [ ! -f "$CA_CERT" ]; then
    echo "⚠ CA сертификат не найден: $CA_CERT"
    echo "   Создайте его с помощью: ./scripts/create_single_ca.sh"
    exit 1
fi

echo "Проверка текущих прав доступа:"
ls -la "$CA_KEY" "$CA_CERT"

echo ""
echo "Установка прав доступа для Docker контейнеров..."

# Устанавливаем права так, чтобы:
# - ca-key.pem: 644 (читаемый для всех, но не изменяемый случайно)
#   ИЛИ 640 (читаемый для группы)
# - ca-cert.pem: 644 (читаемый для всех - это публичный сертификат)

# Для ca-key.pem: 640 (владелец читает/пишет, группа читает)
chmod 640 "$CA_KEY"
chown $(whoami):$(id -gn) "$CA_KEY"

# Для ca-cert.pem: 644 (все могут читать)
chmod 644 "$CA_CERT"
chown $(whoami):$(id -gn) "$CA_CERT"

echo ""
echo "✓ Права доступа обновлены:"
ls -la "$CA_KEY" "$CA_CERT"

echo ""
echo "Проверка доступности из Docker контейнера..."

# Проверяем, может ли контейнер прочитать файлы
if docker-compose ps api | grep -q "Up"; then
    echo "Проверка чтения ca-cert.pem из контейнера:"
    docker-compose exec -T api test -r /app/nginx/ssl/ca-cert.pem && echo "  ✓ ca-cert.pem читаемый" || echo "  ✗ ca-cert.pem НЕ читаемый"
    
    echo "Проверка чтения ca-key.pem из контейнера:"
    docker-compose exec -T api test -r /app/nginx/ssl/ca-key.pem && echo "  ✓ ca-key.pem читаемый" || echo "  ✗ ca-key.pem НЕ читаемый"
    
    echo ""
    echo "Если файлы не читаемые, возможно нужно:"
    echo "1. Убедиться, что Docker контейнер запущен от правильного пользователя"
    echo "2. Или установить более открытые права: chmod 644 $CA_KEY"
else
    echo "⚠ API контейнер не запущен. Запустите его: docker-compose up -d api"
fi

echo ""
echo "============================================================"
echo "✓ Готово!"
echo "============================================================"

