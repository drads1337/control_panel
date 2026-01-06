#!/bin/bash
# Диагностика проблемы с доменом

set -euo pipefail

PROJECT_DIR="/var/www/panel"
cd "$PROJECT_DIR"

echo "🔍 Диагностика проблемы с доменом ovrin.xyz"
echo ""

# 1. Проверка статуса контейнеров
echo "1️⃣  Проверка статуса контейнеров:"
docker compose ps
echo ""

# 2. Проверка логов API
echo "2️⃣  Последние 30 строк логов API:"
docker compose logs --tail=30 api
echo ""

# 3. Проверка логов Nginx
echo "3️⃣  Последние 30 строк логов Nginx:"
docker compose logs --tail=30 nginx
echo ""

# 4. Проверка доступности API внутри контейнера
echo "4️⃣  Проверка доступности API внутри Docker сети:"
docker compose exec -T api curl -f http://localhost:5001/api/health/live 2>/dev/null || echo "❌ API не отвечает внутри контейнера"
echo ""

# 5. Проверка доступности API с хоста
echo "5️⃣  Проверка доступности API с хоста (localhost:5001):"
curl -f http://localhost:5001/api/health/live 2>/dev/null || echo "❌ API не доступен на localhost:5001"
echo ""

# 6. Проверка доступности через Nginx локально
echo "6️⃣  Проверка доступности через Nginx (localhost):"
curl -k -I https://localhost 2>/dev/null | head -10 || echo "❌ HTTPS не работает локально"
curl -I http://localhost 2>/dev/null | head -10 || echo "❌ HTTP не работает локально"
echo ""

# 7. Проверка доступности через Nginx по домену
echo "7️⃣  Проверка доступности через Nginx по домену:"
curl -k -I https://ovrin.xyz 2>/dev/null | head -10 || echo "❌ HTTPS не работает по домену"
curl -I http://ovrin.xyz 2>/dev/null | head -10 || echo "❌ HTTP не работает по домену"
echo ""

# 8. Проверка портов
echo "8️⃣  Проверка открытых портов:"
(ss -tuln 2>/dev/null | grep -E ":(80|443) ") || (netstat -tuln 2>/dev/null | grep -E ":(80|443) ") || echo "⚠️  Порты 80/443 не слушаются"
echo ""

# 9. Проверка файрвола
echo "9️⃣  Проверка файрвола:"
if command -v ufw &> /dev/null; then
    echo "UFW статус:"
    ufw status | head -5
elif command -v firewall-cmd &> /dev/null; then
    echo "Firewalld статус:"
    firewall-cmd --list-all 2>/dev/null | head -10 || echo "⚠️  Не удалось проверить firewalld"
else
    echo "⚠️  Файрвол не найден (ufw/firewalld)"
fi
echo ""

# 10. Проверка DNS
echo "🔟 Проверка DNS:"
echo "A-запись для ovrin.xyz:"
dig +short ovrin.xyz A 2>/dev/null || nslookup ovrin.xyz 2>/dev/null | grep -A 2 "Name:" || echo "⚠️  Не удалось проверить DNS"
echo ""

# 11. Проверка IP сервера
echo "1️⃣1️⃣  IP адрес сервера:"
curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}' || echo "⚠️  Не удалось определить IP"
echo ""

# 12. Проверка конфигурации Nginx
echo "1️⃣2️⃣  Проверка конфигурации Nginx:"
docker compose exec -T nginx nginx -t 2>&1 || echo "⚠️  Ошибка в конфигурации Nginx"
echo ""

# 13. Проверка сетевых подключений
echo "1️⃣3️⃣  Проверка сетевых подключений к API:"
docker compose exec -T nginx wget -qO- --spider http://api:5001/api/health/live 2>&1 | head -3 || echo "⚠️  Nginx не может подключиться к API"
echo ""

echo "✅ Диагностика завершена!"
echo ""
echo "📋 Рекомендации:"
echo "   • Если API не отвечает - проверьте логи: docker compose logs -f api"
echo "   • Если Nginx не может подключиться к API - проверьте сеть Docker"
echo "   • Если домен не доступен извне - проверьте файрвол и DNS"
echo "   • Если порты не слушаются - проверьте, что контейнеры запущены"

