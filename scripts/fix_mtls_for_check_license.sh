#!/bin/bash
# Скрипт для диагностики и исправления проблемы mTLS для check_license.py

set -e

echo "=========================================="
echo "Диагностика mTLS для check_license.py"
echo "=========================================="
echo ""

# Проверка 1: Существует ли CA сертификат
echo "1. Проверка CA сертификата..."
CA_CERT="/var/www/panel/nginx/ssl/ca-cert.pem"
if [ -f "$CA_CERT" ]; then
    echo "   ✓ CA сертификат найден: $CA_CERT"
    echo "   Размер: $(stat -c%s "$CA_CERT") байт"
else
    echo "   ❌ CA сертификат НЕ найден: $CA_CERT"
    echo "   Создайте его: ./scripts/create_single_ca.sh"
    exit 1
fi

# Проверка 2: Существует ли клиентский сертификат для проекта
echo ""
echo "2. Проверка клиентских сертификатов..."
PROJECT_ID="6117759936"
CLIENT_CERT="/var/www/panel/nginx/ssl/projects/${PROJECT_ID}/clients/test-client/client-cert.pem"
CLIENT_KEY="/var/www/panel/nginx/ssl/projects/${PROJECT_ID}/clients/test-client/client-key.pem"

if [ -f "$CLIENT_CERT" ] && [ -f "$CLIENT_KEY" ]; then
    echo "   ✓ Клиентские сертификаты найдены:"
    echo "     Cert: $CLIENT_CERT"
    echo "     Key: $CLIENT_KEY"
else
    echo "   ❌ Клиентские сертификаты НЕ найдены"
    echo "   Cert: $CLIENT_CERT"
    echo "   Key: $CLIENT_KEY"
    exit 1
fi

# Проверка 3: Валидация сертификатов
echo ""
echo "3. Валидация сертификатов..."
if openssl verify -CAfile "$CA_CERT" "$CLIENT_CERT" > /dev/null 2>&1; then
    echo "   ✓ Клиентский сертификат подписан правильным CA"
else
    echo "   ❌ Клиентский сертификат НЕ подписан правильным CA"
    exit 1
fi

# Проверка 4: Проверка в контейнере nginx
echo ""
echo "4. Проверка в контейнере nginx..."
if command -v docker-compose > /dev/null 2>&1; then
    if docker-compose ps nginx | grep -q "Up"; then
        echo "   ✓ Контейнер nginx запущен"
        
        # Проверяем, существует ли файл в контейнере
        if docker-compose exec -T nginx test -f /etc/nginx/ssl/ca-cert.pem 2>/dev/null; then
            echo "   ✓ CA сертификат доступен в контейнере: /etc/nginx/ssl/ca-cert.pem"
        else
            echo "   ❌ CA сертификат НЕ доступен в контейнере"
            echo "   Проверьте монтирование volumes в docker-compose.yml"
        fi
        
        # Проверяем конфигурацию nginx
        echo ""
        echo "5. Проверка конфигурации nginx..."
        if docker-compose exec -T nginx nginx -t 2>&1 | grep -q "successful"; then
            echo "   ✓ Конфигурация nginx валидна"
            
            # Проверяем, указан ли правильный путь к CA
            if docker-compose exec -T nginx grep -q "ssl_client_certificate /etc/nginx/ssl/ca-cert.pem" /etc/nginx/nginx.conf 2>/dev/null; then
                echo "   ✓ Путь к CA сертификату правильный в nginx.conf"
            else
                echo "   ⚠ Путь к CA сертификату может быть неправильным"
            fi
        else
            echo "   ❌ Ошибка в конфигурации nginx"
            docker-compose exec -T nginx nginx -t 2>&1 | tail -5
        fi
        
        # Предложение перезагрузить nginx
        echo ""
        echo "6. Рекомендации..."
        echo "   Если все проверки пройдены, но проблема остается:"
        echo "   - Перезагрузите nginx: docker-compose exec nginx nginx -s reload"
        echo "   - Или перезапустите: docker-compose restart nginx"
    else
        echo "   ⚠ Контейнер nginx не запущен"
        echo "   Запустите: docker-compose up -d nginx"
    fi
else
    echo "   ⚠ docker-compose не найден, пропускаем проверку контейнера"
fi

echo ""
echo "=========================================="
echo "Диагностика завершена"
echo "=========================================="
echo ""
echo "Если все проверки пройдены, но проблема остается:"
echo "1. Проверьте логи nginx: docker-compose logs nginx | grep -i ssl"
echo "2. Проверьте, что MTLS_ENABLED=true в .env файле"
echo "3. Убедитесь, что сертификаты имеют правильные права доступа"
