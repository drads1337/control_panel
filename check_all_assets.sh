#!/bin/bash
# Проверка всех assets и их доступности

echo "🔍 Полная проверка assets"
echo ""

echo "1️⃣  Все JS файлы в index.html:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx grep -o 'src="[^"]*\.js[^"]*"' /app/frontend/dist/index.html
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx grep -o 'href="[^"]*\.js[^"]*"' /app/frontend/dist/index.html
echo ""

echo "2️⃣  Проверка существования всех JS файлов из index.html:"
JS_FILES=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx grep -o 'src="[^"]*\.js[^"]*"' /app/frontend/dist/index.html | sed 's/src="//;s/"//')
for file in $JS_FILES; do
    file_path="/app/frontend/dist$file"
    if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx test -f "$file_path"; then
        echo "✅ $file"
    else
        echo "❌ $file - НЕ НАЙДЕН!"
    fi
done
echo ""

echo "3️⃣  Проверка всех modulepreload файлов:"
PRELOAD_FILES=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx grep -o 'href="[^"]*\.js[^"]*"' /app/frontend/dist/index.html | sed 's/href="//;s/"//')
for file in $PRELOAD_FILES; do
    file_path="/app/frontend/dist$file"
    if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx test -f "$file_path"; then
        echo "✅ $file"
    else
        echo "❌ $file - НЕ НАЙДЕН!"
    fi
done
echo ""

echo "4️⃣  Проверка доступности через HTTPS:"
MAIN_JS=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx grep -o 'src="[^"]*\.js[^"]*"' /app/frontend/dist/index.html | head -1 | sed 's/src="//;s/"//')
echo "Проверка: https://ovrin.xyz$MAIN_JS"
STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://ovrin.xyz$MAIN_JS")
if [ "$STATUS" = "200" ]; then
    echo "✅ Файл доступен (HTTP $STATUS)"
    echo "Проверка заголовков:"
    curl -k -I "https://ovrin.xyz$MAIN_JS" 2>&1 | grep -E "content-type|content-length" | head -2
else
    echo "❌ Файл недоступен (HTTP $STATUS)"
fi
echo ""

echo "5️⃣  Проверка CSP заголовков на главной странице:"
curl -k -I https://ovrin.xyz 2>&1 | grep -i "content-security-policy" || echo "⚠️  CSP заголовок не найден"
echo ""

echo "6️⃣  Проверка всех заголовков безопасности:"
curl -k -I https://ovrin.xyz 2>&1 | grep -E "content-security-policy|cross-origin|x-frame|x-content-type" || echo "Заголовки безопасности не найдены"
echo ""

echo "7️⃣  Тест загрузки JS файла (проверка на ошибки):"
curl -k -s "https://ovrin.xyz$MAIN_JS" | head -c 200
echo "..."
echo ""

echo "✅ Проверка завершена"

