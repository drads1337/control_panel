#!/bin/bash
# Проверка доступности домена

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Проверка доступности домена ovrin.xyz"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

DOMAIN="ovrin.xyz"
SERVER_IP="38.242.149.188"

echo "1. Проверка DNS:"
echo "---"
echo "Доменное имя: $DOMAIN"
echo "IP сервера: $SERVER_IP"

# Проверка DNS
DNS_IP=$(dig +short A $DOMAIN | head -1)
echo "DNS A запись: $DNS_IP"

if [ "$DNS_IP" = "$SERVER_IP" ]; then
    echo "✅ DNS указывает на правильный IP ($SERVER_IP)"
else
    echo "❌ DNS указывает на $DNS_IP, но сервер на $SERVER_IP"
    echo "   Обновите DNS запись A для $DOMAIN на $SERVER_IP"
fi

# Проверка www
WWW_DNS_IP=$(dig +short A www.$DOMAIN | head -1)
echo "DNS www запись: $WWW_DNS_IP"
echo ""

echo "2. Проверка портов на сервере:"
echo "---"
if netstat -tlnp 2>/dev/null | grep -q ":80 " || ss -tlnp 2>/dev/null | grep -q ":80 "; then
    echo "✅ Порт 80 открыт"
else
    echo "❌ Порт 80 не слушается"
fi

if netstat -tlnp 2>/dev/null | grep -q ":443 " || ss -tlnp 2>/dev/null | grep -q ":443 "; then
    echo "✅ Порт 443 открыт"
else
    echo "❌ Порт 443 не слушается"
fi
echo ""

echo "3. Проверка Nginx через localhost:"
echo "---"
# Проверка HTTP
if curl -s -f -m 5 "http://localhost" > /dev/null 2>&1; then
    echo "✅ Nginx отвечает на HTTP (localhost)"
else
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "http://localhost" 2>&1 || echo "FAILED")
    echo "⚠️  HTTP статус: $HTTP_STATUS"
fi

# Проверка с Host header
if curl -s -f -m 5 -H "Host: $DOMAIN" "http://localhost" > /dev/null 2>&1; then
    echo "✅ Nginx отвечает на домен через Host header"
    curl -s -I -H "Host: $DOMAIN" "http://localhost" | head -3
else
    echo "❌ Nginx не отвечает на домен через Host header"
fi
echo ""

echo "4. Проверка HTTPS через localhost:"
echo "---"
if curl -s -k -f -m 5 "https://localhost" > /dev/null 2>&1; then
    echo "✅ Nginx отвечает на HTTPS (localhost)"
else
    HTTPS_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" -m 5 "https://localhost" 2>&1 || echo "FAILED")
    echo "⚠️  HTTPS статус: $HTTPS_STATUS"
fi

# Проверка с Host header
if curl -s -k -f -m 5 -H "Host: $DOMAIN" "https://localhost" > /dev/null 2>&1; then
    echo "✅ Nginx отвечает на домен через HTTPS с Host header"
    curl -s -k -I -H "Host: $DOMAIN" "https://localhost" | head -3
else
    echo "⚠️  Nginx не отвечает на домен через HTTPS с Host header (возможно, самоподписанный сертификат)"
fi
echo ""

echo "5. Проверка API через Nginx с доменом:"
echo "---"
if curl -s -f -m 5 -H "Host: $DOMAIN" "http://localhost/api/health/live" > /dev/null 2>&1; then
    echo "✅ API доступен через Nginx с доменом"
    curl -s -H "Host: $DOMAIN" "http://localhost/api/health/live"
    echo ""
else
    echo "❌ API недоступен через Nginx с доменом"
fi
echo ""

echo "6. Проверка файрвола:"
echo "---"
if command -v ufw > /dev/null 2>&1; then
    UFW_STATUS=$(ufw status | head -1)
    echo "UFW статус: $UFW_STATUS"
    if ufw status | grep -q "Status: active"; then
        if ufw status | grep -q "80/tcp"; then
            echo "✅ Порт 80 разрешён в UFW"
        else
            echo "⚠️  Порт 80 не разрешён в UFW"
        fi
        if ufw status | grep -q "443/tcp"; then
            echo "✅ Порт 443 разрешён в UFW"
        else
            echo "⚠️  Порт 443 не разрешён в UFW"
        fi
    fi
elif command -v firewall-cmd > /dev/null 2>&1; then
    echo "Проверка firewalld..."
    firewall-cmd --list-ports 2>/dev/null | grep -q "80" && echo "✅ Порт 80 разрешён" || echo "⚠️  Порт 80 не разрешён"
    firewall-cmd --list-ports 2>/dev/null | grep -q "443" && echo "✅ Порт 443 разрешён" || echo "⚠️  Порт 443 не разрешён"
else
    echo "Файрвол не найден (ufw/firewalld)"
fi
echo ""

echo "7. Проверка доступности извне (через внешний сервис):"
echo "---"
echo "Проверьте вручную:"
echo "  curl -I http://$DOMAIN"
echo "  curl -I -k https://$DOMAIN"
echo ""
echo "Или через браузер:"
echo "  http://$DOMAIN"
echo "  https://$DOMAIN"
echo ""

echo "8. Последние запросы в логах Nginx:"
echo "---"
docker-compose logs nginx --tail=10 2>&1 | tail -10 | grep -v "^$" || echo "Нет запросов в логах"
echo ""

echo "9. Проверка конфигурации Nginx:"
echo "---"
if grep -q "server_name $DOMAIN\|server_name www.$DOMAIN" nginx.conf; then
    echo "✅ Домен $DOMAIN указан в nginx.conf"
    grep "server_name" nginx.conf | grep "$DOMAIN"
else
    echo "❌ Домен $DOMAIN не найден в nginx.conf"
fi
echo ""

echo "=========================================="
echo "Рекомендации:"
echo "=========================================="
echo ""

# Проверка проблем
HAS_ISSUES=false

if [ "$DNS_IP" != "$SERVER_IP" ]; then
    echo "❌ ПРОБЛЕМА: DNS не указывает на сервер"
    echo "   Решение: Обновите DNS запись A для $DOMAIN на $SERVER_IP"
    echo "   Это может занять до 24 часов (обычно 5-15 минут)"
    HAS_ISSUES=true
fi

if ! curl -s -f -m 5 -H "Host: $DOMAIN" "http://localhost" > /dev/null 2>&1; then
    echo "❌ ПРОБЛЕМА: Nginx не отвечает на домен локально"
    echo "   Решение: Проверьте конфигурацию nginx.conf (server_name)"
    HAS_ISSUES=true
fi

if ! netstat -tlnp 2>/dev/null | grep -q ":80 " && ! ss -tlnp 2>/dev/null | grep -q ":80 "; then
    echo "❌ ПРОБЛЕМА: Порт 80 не открыт"
    echo "   Решение: Проверьте docker-compose.yml и убедитесь, что порт проброшен"
    HAS_ISSUES=true
fi

if [ "$HAS_ISSUES" = false ]; then
    echo "✅ Все основные проверки пройдены!"
    echo ""
    echo "Если домен всё ещё недоступен:"
    echo "  1. Подождите распространения DNS (может занять время)"
    echo "  2. Проверьте файрвол провайдера (может блокировать порты)"
    echo "  3. Проверьте, что домен не заблокирован на стороне клиента"
    echo "  4. Попробуйте доступ из другого места/сети"
fi

echo ""
echo "=========================================="

