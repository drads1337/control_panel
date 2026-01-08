#!/bin/bash

# Скрипт для исправления прав доступа к CA ключу для API контейнера

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SSL_DIR="nginx/ssl"
CA_KEY="$SSL_DIR/ca-key.pem"
CA_CERT="$SSL_DIR/ca-cert.pem"

echo "=========================================="
echo "  ИСПРАВЛЕНИЕ ПРАВ ДОСТУПА К CA КЛЮЧУ"
echo "=========================================="
echo ""

# Проверка существования файлов
if [ ! -f "$CA_KEY" ]; then
    echo "❌ CA ключ не найден: $CA_KEY"
    echo "Создание CA ключа..."
    ./scripts/create_single_ca.sh
fi

if [ ! -f "$CA_CERT" ]; then
    echo "❌ CA сертификат не найден: $CA_CERT"
    echo "Создание CA сертификата..."
    ./scripts/create_single_ca.sh
fi

echo "=== Текущие права доступа ==="
ls -la "$CA_KEY" "$CA_CERT" 2>/dev/null || echo "Файлы не найдены"
echo ""

# Исправление прав доступа
echo "=== Исправление прав доступа ==="

# CA ключ должен быть доступен для чтения контейнеру API
# В контейнере работает пользователь appuser (UID 1000)
# Устанавливаем права 644 для CA ключа (читаемый всеми, но не изменяемый)
# Это нужно для API контейнера, который работает от appuser

if [ -f "$CA_KEY" ]; then
    # Пробуем изменить права без sudo
    if chmod 644 "$CA_KEY" 2>/dev/null; then
        echo "✓ Права на CA ключ изменены на 644"
    else
        # Если не получилось, пробуем с sudo
        echo "Попытка с sudo..."
        if sudo chmod 644 "$CA_KEY" 2>/dev/null; then
            echo "✓ Права на CA ключ изменены на 644 (через sudo)"
        else
            echo "❌ Не удалось изменить права на $CA_KEY"
            echo "Проверьте права доступа вручную"
        fi
    fi
else
    echo "❌ CA ключ не найден: $CA_KEY"
    exit 1
fi

# CA сертификат может быть 644
chmod 644 "$CA_CERT" 2>/dev/null || sudo chmod 644 "$CA_CERT" 2>/dev/null || true

# Проверяем, работает ли контейнер API
if docker compose ps api 2>/dev/null | grep -q "Up\|Running"; then
    API_USER=$(docker compose exec -T api id -u 2>/dev/null | tr -d '\r\n' || echo "1000")
    echo "Пользователь в API контейнере: UID $API_USER"
    
    # Устанавливаем владельца, если возможно
    if [ "$API_USER" != "0" ] && [ "$API_USER" != "" ]; then
        echo "Попытка установить владельца файла на UID $API_USER..."
        sudo chown "$API_USER:$API_USER" "$CA_KEY" 2>/dev/null || {
            echo "⚠ Не удалось изменить владельца, но права доступа установлены"
        }
    fi
fi

echo ""
echo "=== Новые права доступа ==="
ls -la "$CA_KEY" "$CA_CERT"
echo ""

# Проверка доступа из контейнера
echo "=== Проверка доступа из API контейнера ==="
if docker compose ps api 2>/dev/null | grep -q "Up\|Running"; then
    if docker compose exec -T api test -r "/app/nginx/ssl/ca-key.pem" 2>/dev/null; then
        echo "✓ API контейнер может читать CA ключ"
    else
        echo "❌ API контейнер НЕ может читать CA ключ"
        echo "Попытка исправить через изменение прав на 666 (временное решение)..."
        chmod 666 "$CA_KEY" 2>/dev/null || sudo chmod 666 "$CA_KEY" 2>/dev/null || true
        if docker compose exec -T api test -r "/app/nginx/ssl/ca-key.pem" 2>/dev/null; then
            echo "✓ Теперь API контейнер может читать CA ключ"
        else
            echo "❌ Все еще не работает. Проверьте монтирование volume в docker-compose.yml"
        fi
    fi
else
    echo "⚠ API контейнер не запущен, пропускаем проверку"
fi

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
echo ""
echo "Если проблема сохраняется, перезапустите API контейнер:"
echo "  docker compose restart api"
echo ""
