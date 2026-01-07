#!/bin/bash
# Финальная проверка и диагностика

echo "🔍 Финальная диагностика Frontend"
echo ""

echo "1️⃣  Проверка всех заголовков ответа:"
echo "---"
curl -k -I https://ovrin.xyz 2>&1 | head -20
echo "---"
echo ""

echo "2️⃣  Проверка содержимого HTML (первые 100 символов):"
curl -k -s https://ovrin.xyz | head -c 100
echo "..."
echo ""

echo "3️⃣  Проверка наличия script тегов в HTML:"
curl -k -s https://ovrin.xyz | grep -o '<script[^>]*>' | head -5
echo ""

echo "4️⃣  Проверка доступности JS файла:"
JS_FILE="/assets/js/index-Ck0YAJ-G.js"
STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://ovrin.xyz$JS_FILE")
echo "Статус: $STATUS"
if [ "$STATUS" = "200" ]; then
    echo "✅ JS файл доступен"
    echo "Проверка заголовков JS файла:"
    curl -k -I "https://ovrin.xyz$JS_FILE" 2>&1 | grep -E "content-type|content-length" | head -2
else
    echo "❌ JS файл недоступен"
fi
echo ""

echo "5️⃣  Проверка конфигурации nginx:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -t 2>&1 | tail -3
echo ""

echo "6️⃣  Проверка логов nginx (последние 10 строк):"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=10 nginx | grep -v "ssl_stapling" | tail -5
echo ""

echo "✅ Диагностика завершена"
echo ""
echo "📋 Если frontend всё ещё пустой:"
echo "  1. Откройте https://ovrin.xyz в браузере"
echo "  2. Откройте DevTools (F12)"
echo "  3. Console → скопируйте ВСЕ ошибки (красные сообщения)"
echo "  4. Network → обновите страницу (F5)"
echo "  5. Найдите index-Ck0YAJ-G.js → проверьте статус и ошибки"
echo ""
echo "  Пришлите скриншот или текст ошибок из консоли!"

