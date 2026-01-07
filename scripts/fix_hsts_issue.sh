#!/bin/bash
# Исправление проблемы HSTS - временное решение

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Исправление проблемы HSTS"
echo "=========================================="
echo ""
echo "Проблема: Браузер помнит HSTS для домена ovrin.xyz"
echo "Решение: Временно отключить HSTS или использовать правильный SSL сертификат"
echo ""

# Проверить текущую конфигурацию
echo "1. Проверка текущей конфигурации HSTS в nginx.conf:"
echo "---"
if grep -q "add_header.*Strict-Transport-Security" nginx.conf; then
    echo "HSTS найден в конфигурации:"
    grep "add_header.*Strict-Transport-Security" nginx.conf
else
    echo "HSTS не найден в nginx.conf (может быть в HTTPS блоке)"
fi
echo ""

# Варианты решения
echo "2. Варианты решения:"
echo "---"
echo ""
echo "ВАРИАНТ 1 (РЕКОМЕНДУЕТСЯ): Настроить Let's Encrypt SSL сертификат"
echo "  - Это правильное решение для production"
echo "  - Команда: ./scripts/ssl_cert.sh или certbot"
echo ""
echo "ВАРИАНТ 2: Временно отключить HSTS (только для тестирования)"
echo "  - Закомментировать строки с Strict-Transport-Security в nginx.conf"
echo "  - НЕ рекомендуется для production!"
echo ""
echo "ВАРИАНТ 3: Использовать HTTP (браузер может блокировать из-за HSTS)"
echo "  - Попробовать: http://ovrin.xyz (без s)"
echo ""
echo "ВАРИАНТ 4: Очистить HSTS кэш в браузере"
echo "  - Chrome: chrome://net-internals/#hsts"
echo "  - Firefox: about:preferences#privacy (HSTS)"
echo ""

# Проверить наличие Let's Encrypt сертификатов
echo "3. Проверка Let's Encrypt сертификатов:"
echo "---"
if [ -d "letsencrypt/live/ovrin.xyz" ]; then
    echo "✅ Let's Encrypt директория найдена: letsencrypt/live/ovrin.xyz"
    if [ -f "letsencrypt/live/ovrin.xyz/fullchain.pem" ]; then
        echo "✅ Сертификат найден: fullchain.pem"
        echo ""
        echo "⚠️  ПРОБЛЕМА: Сертификат есть, но nginx.conf использует самоподписанный!"
        echo "   Нужно раскомментировать строки с Let's Encrypt в nginx.conf"
    else
        echo "❌ Сертификат не найден"
    fi
else
    echo "❌ Let's Encrypt директория не найдена"
    echo "   Нужно создать сертификат через certbot"
fi
echo ""

# Проверить конфигурацию SSL в nginx.conf
echo "4. Проверка SSL конфигурации в nginx.conf:"
echo "---"
SSL_CONFIG=$(grep -A 5 "ssl_certificate" nginx.conf | head -10)
echo "$SSL_CONFIG"
echo ""

echo "=========================================="
echo "Рекомендации:"
echo "=========================================="
echo ""
echo "1. Для production: Настройте Let's Encrypt сертификат"
echo "   Это правильное решение с валидным SSL сертификатом"
echo ""
echo "2. Для тестирования: Временно очистите HSTS кэш в браузере"
echo "   Chrome: Откройте chrome://net-internals/#hsts"
echo "   Найдите 'Delete domain security policies'"
echo "   Введите: ovrin.xyz и нажмите Delete"
echo ""
echo "3. Альтернатива: Используйте режим инкогнито или другой браузер"
echo ""

