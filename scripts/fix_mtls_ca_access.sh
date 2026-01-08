#!/bin/bash

# Скрипт для исправления доступа к CA ключу для mTLS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SSL_DIR="nginx/ssl"
CA_KEY="$SSL_DIR/ca-key.pem"
CA_CERT="$SSL_DIR/ca-cert.pem"

echo "=========================================="
echo "  ИСПРАВЛЕНИЕ ДОСТУПА К CA ДЛЯ mTLS"
echo "=========================================="
echo ""

# 1. Проверка существования CA
if [ ! -f "$CA_KEY" ] || [ ! -f "$CA_CERT" ]; then
    echo "=== Создание CA сертификата ==="
    ./scripts/create_single_ca.sh
    echo ""
fi

# 2. Исправление прав доступа
echo "=== Исправление прав доступа ==="
echo "Текущие права:"
ls -la "$CA_KEY" "$CA_CERT" 2>/dev/null || echo "Файлы не найдены"
echo ""

# Устанавливаем права 644 для CA ключа (читаемый для API контейнера)
echo "Установка прав 644 для CA ключа..."
if chmod 644 "$CA_KEY" 2>/dev/null; then
    echo "✓ Права изменены"
elif sudo chmod 644 "$CA_KEY" 2>/dev/null; then
    echo "✓ Права изменены (через sudo)"
else
    echo "❌ Не удалось изменить права"
    exit 1
fi

# CA сертификат может быть 644
chmod 644 "$CA_CERT" 2>/dev/null || sudo chmod 644 "$CA_CERT" 2>/dev/null || true

echo ""
echo "Новые права:"
ls -la "$CA_KEY" "$CA_CERT"
echo ""

# 3. Проверка доступа из контейнера
echo "=== Проверка доступа из API контейнера ==="
if docker compose ps api 2>/dev/null | grep -q "Up\|Running"; then
    echo "Проверка чтения CA ключа из контейнера..."
    if docker compose exec -T api test -r "/app/nginx/ssl/ca-key.pem" 2>/dev/null; then
        echo "✓ API контейнер может читать CA ключ"
    else
        echo "❌ API контейнер НЕ может читать CA ключ"
        echo "Попытка установить права 666 (временное решение)..."
        chmod 666 "$CA_KEY" 2>/dev/null || sudo chmod 666 "$CA_KEY" 2>/dev/null || true
        if docker compose exec -T api test -r "/app/nginx/ssl/ca-key.pem" 2>/dev/null; then
            echo "✓ Теперь доступен (права 666)"
        else
            echo "❌ Все еще не работает"
            echo "Проверьте монтирование volume в docker-compose.yml"
        fi
    fi
    
    echo ""
    echo "Проверка чтения CA сертификата..."
    if docker compose exec -T api test -r "/app/nginx/ssl/ca-cert.pem" 2>/dev/null; then
        echo "✓ API контейнер может читать CA сертификат"
    else
        echo "❌ API контейнер НЕ может читать CA сертификат"
    fi
else
    echo "⚠ API контейнер не запущен, пропускаем проверку"
fi

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
echo ""
echo "Если API контейнер запущен, перезапустите его:"
echo "  docker compose restart api"
echo ""
