#!/bin/bash
# Исправление проблемы с пустым frontend

set -e

echo "🔧 Исправление пустого frontend"
echo ""

echo "1️⃣  Перезагрузка nginx с обновленной конфигурацией..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload
echo "✅ Nginx перезагружен"
echo ""

echo "2️⃣  Проверка доступности главной страницы:"
curl -k -s https://ovrin.xyz | grep -o '<script[^>]*>' | head -3
echo ""

echo "3️⃣  Проверка CSP заголовков:"
CSP=$(curl -k -s -I https://ovrin.xyz | grep -i "content-security-policy" || echo "")
if [ -n "$CSP" ]; then
    echo "✅ CSP установлен:"
    echo "$CSP"
else
    echo "⚠️  CSP не найден в заголовках"
fi
echo ""

echo "4️⃣  Проверка доступности основного JS файла:"
JS_FILE="/assets/js/index-Ck0YAJ-G.js"
STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://ovrin.xyz$JS_FILE")
if [ "$STATUS" = "200" ]; then
    echo "✅ JS файл доступен (HTTP $STATUS)"
    SIZE=$(curl -k -s -I "https://ovrin.xyz$JS_FILE" | grep -i content-length | awk '{print $2}' | tr -d '\r')
    echo "   Размер: $SIZE байт"
else
    echo "❌ JS файл недоступен (HTTP $STATUS)"
fi
echo ""

echo "5️⃣  Проверка MIME типа JS файла:"
curl -k -I "https://ovrin.xyz$JS_FILE" 2>&1 | grep -i "content-type"
echo ""

echo "✅ Проверка завершена"
echo ""
echo "📋 Следующие шаги:"
echo "  1. Откройте https://ovrin.xyz в браузере"
echo "  2. Очистите кеш браузера (Ctrl+Shift+Delete или Ctrl+F5)"
echo "  3. Откройте DevTools (F12) → Console"
echo "  4. Проверьте ошибки JavaScript"
echo "  5. Проверьте вкладку Network → найдите все JS файлы"
echo "  6. Проверьте, загружаются ли они (статус 200)"
echo ""
echo "Если проблема сохраняется, выполните:"
echo "  ./check_all_assets.sh"

