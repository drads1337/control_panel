#!/bin/bash
# Скрипт для проверки CA сертификата и ключа внутри Docker контейнера

echo "============================================================"
echo "Проверка CA сертификата и ключа внутри Docker контейнера"
echo "============================================================"

cd /var/www/panel

CA_CERT="/app/nginx/ssl/ca-cert.pem"
CA_KEY="/app/nginx/ssl/ca-key.pem"

echo "Проверка наличия файлов в контейнере:"
docker-compose exec -T api ls -la "$CA_CERT" "$CA_KEY" 2>&1 || echo "Файлы не найдены"

echo ""
echo "Проверка прав доступа:"
docker-compose exec -T api test -r "$CA_CERT" && echo "✓ ca-cert.pem читаемый" || echo "✗ ca-cert.pem НЕ читаемый"
docker-compose exec -T api test -r "$CA_KEY" && echo "✓ ca-key.pem читаемый" || echo "✗ ca-key.pem НЕ читаемый"

echo ""
echo "Проверка совпадения CA сертификата и ключа внутри контейнера:"
docker-compose exec -T api bash -c "
    if openssl x509 -in $CA_CERT -noout -pubkey 2>/dev/null | openssl rsa -pubin -in /dev/stdin -outform PEM 2>/dev/null > /tmp/cert_pub.pem 2>/dev/null; then
        if openssl rsa -in $CA_KEY -pubout 2>/dev/null > /tmp/key_pub.pem 2>/dev/null; then
            if diff -q /tmp/cert_pub.pem /tmp/key_pub.pem > /dev/null 2>&1; then
                echo '✓ CA сертификат и ключ совпадают в контейнере!'
                rm -f /tmp/cert_pub.pem /tmp/key_pub.pem
                exit 0
            else
                echo '✗ CA сертификат и ключ НЕ совпадают в контейнере!'
                rm -f /tmp/cert_pub.pem /tmp/key_pub.pem
                exit 1
            fi
        fi
    fi
    echo '⚠ Не удалось проверить совпадение'
    exit 1
"

echo ""
echo "Проверка содержимого CA сертификата:"
docker-compose exec -T api openssl x509 -in "$CA_CERT" -text -noout 2>/dev/null | grep -E "Subject:|Issuer:" || echo "Не удалось прочитать сертификат"

echo ""
echo "============================================================"
echo "✓ Проверка завершена"
echo "============================================================"

