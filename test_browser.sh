#!/bin/bash
# Тестирование доступности frontend из браузера

echo "🌐 Тестирование доступности Frontend"
echo ""

echo "1️⃣  Проверка основного HTML:"
curl -k -s https://ovrin.xyz | grep -o '<script[^>]*>' | head -3
echo ""

echo "2️⃣  Проверка доступности JS файла:"
JS_FILE="/assets/js/index-Ck0YAJ-G.js"
echo "Проверка: https://ovrin.xyz$JS_FILE"
STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://ovrin.xyz$JS_FILE")
if [ "$STATUS" = "200" ]; then
    echo "✅ JS файл доступен (HTTP $STATUS)"
    echo "Размер файла: $(curl -k -s -I "https://ovrin.xyz$JS_FILE" | grep -i content-length | awk '{print $2}' | tr -d '\r') байт"
else
    echo "❌ JS файл недоступен (HTTP $STATUS)"
fi
echo ""

echo "3️⃣  Проверка CSP заголовков:"
curl -k -I https://ovrin.xyz 2>&1 | grep -i "content-security-policy" || echo "CSP заголовок не найден"
echo ""

echo "4️⃣  Проверка CORS заголовков для assets:"
curl -k -I "https://ovrin.xyz$JS_FILE" 2>&1 | grep -i "access-control" || echo "CORS заголовки не найдены"
echo ""

echo "5️⃣  Проверка MIME типа JS файла:"
curl -k -I "https://ovrin.xyz$JS_FILE" 2>&1 | grep -i "content-type"
echo ""

echo "6️⃣  Тест загрузки JS файла (первые 100 символов):"
curl -k -s "https://ovrin.xyz$JS_FILE" | head -c 100
echo "..."
echo ""

echo "✅ Тестирование завершено"
echo ""
echo "Если JS файл недоступен или CSP блокирует, проверьте:"
echo "  1. Откройте https://ovrin.xyz в браузере"
echo "  2. Откройте DevTools (F12) → Console"
echo "  3. Посмотрите ошибки загрузки скриптов"
echo "  4. Проверьте вкладку Network → найдите index-Ck0YAJ-G.js"
echo "  5. Проверьте статус загрузки и ошибки CSP"

