#!/bin/bash
# Детальная диагностика Frontend

echo "🔍 Детальная диагностика Frontend"
echo ""

echo "1️⃣  Проверка содержимого index.html (первые 30 строк):"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx head -30 /app/frontend/dist/index.html
echo ""

echo "2️⃣  Проверка JavaScript файлов в assets:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx ls -la /app/frontend/dist/assets/ 2>/dev/null | head -10
echo ""

echo "3️⃣  Проверка CSS файлов:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx find /app/frontend/dist/assets -name "*.css" 2>/dev/null | head -5
echo ""

echo "4️⃣  Полный ответ от HTTPS (сохраняем в файл):"
curl -k -s https://localhost > /tmp/frontend_response.html
echo "Размер ответа: $(wc -c < /tmp/frontend_response.html) байт"
echo "Первые 50 строк:"
head -50 /tmp/frontend_response.html
echo ""

echo "5️⃣  Проверка заголовков ответа:"
curl -k -I https://localhost 2>&1
echo ""

echo "6️⃣  Проверка доступности assets:"
# Получаем имя JS файла из index.html
JS_FILE=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx grep -oP 'src="[^"]*\.js[^"]*"' /app/frontend/dist/index.html | head -1 | sed 's/src="//;s/"//')
if [ -n "$JS_FILE" ]; then
    echo "Найден JS файл: $JS_FILE"
    echo "Проверка доступности:"
    curl -k -I "https://localhost$JS_FILE" 2>&1 | head -5
else
    echo "❌ JS файлы не найдены в index.html"
fi
echo ""

echo "7️⃣  Проверка логов nginx на ошибки:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 nginx | grep -i "error\|warn\|404\|403" || echo "Ошибок не найдено"
echo ""

echo "8️⃣  Проверка прав доступа к файлам:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx ls -la /app/frontend/dist/ | head -10
echo ""

echo "✅ Диагностика завершена"
echo ""
echo "Если frontend пустой, проверьте:"
echo "  1. Содержимое index.html (должен содержать <!DOCTYPE html>)"
echo "  2. Наличие JavaScript файлов в /app/frontend/dist/assets/"
echo "  3. Логи nginx на наличие ошибок"

