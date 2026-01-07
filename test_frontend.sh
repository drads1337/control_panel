#!/bin/bash
# Тестирование Frontend

echo "🧪 Тестирование Frontend"
echo ""

echo "1️⃣  Проверка health endpoint:"
curl -s http://localhost/health || echo "❌ Health endpoint не работает"
echo ""

echo "2️⃣  Полный ответ от HTTPS (первые 500 символов):"
curl -k -s https://localhost | head -c 500
echo ""
echo ""

echo "3️⃣  Проверка заголовков HTTPS:"
curl -k -I https://localhost 2>&1 | head -15
echo ""

echo "4️⃣  Проверка наличия JavaScript файлов:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx find /app/frontend/dist/assets -name "*.js" 2>/dev/null | head -5
echo ""

echo "5️⃣  Проверка содержимого index.html (первые 20 строк):"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx head -20 /app/frontend/dist/index.html
echo ""

echo "6️⃣  Проверка доступа извне (по IP):"
SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "не определен")
echo "IP сервера: $SERVER_IP"
echo "Проверка HTTP:"
curl -I "http://$SERVER_IP" 2>&1 | head -5
echo "Проверка HTTPS:"
curl -k -I "https://$SERVER_IP" 2>&1 | head -5
echo ""

echo "7️⃣  Проверка по домену:"
echo "HTTP:"
curl -I "http://ovrin.xyz" 2>&1 | head -5
echo "HTTPS:"
curl -k -I "https://ovrin.xyz" 2>&1 | head -5
echo ""

echo "✅ Тестирование завершено"

