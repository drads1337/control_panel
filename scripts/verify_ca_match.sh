#!/bin/bash
# Скрипт для проверки совпадения CA сертификата и ключа

echo "============================================================"
echo "Проверка совпадения CA сертификата и ключа"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CA_KEY="$SSL_DIR/ca-key.pem"
CA_CERT="$SSL_DIR/ca-cert.pem"

if [ ! -f "$CA_KEY" ]; then
    echo "⚠ CA ключ не найден: $CA_KEY"
    exit 1
fi

if [ ! -f "$CA_CERT" ]; then
    echo "⚠ CA сертификат не найден: $CA_CERT"
    exit 1
fi

echo "Проверка совпадения CA сертификата и ключа..."
echo ""

# Извлекаем публичный ключ из CA сертификата
CERT_PUBKEY=$(openssl x509 -in "$CA_CERT" -pubkey -noout 2>/dev/null | openssl pkey -pubin -text -noout 2>/dev/null | grep -A 20 "Public-Key:" | head -20)

# Извлекаем публичный ключ из CA приватного ключа
KEY_PUBKEY=$(openssl rsa -in "$CA_KEY" -pubout 2>/dev/null | openssl pkey -pubin -text -noout 2>/dev/null | grep -A 20 "Public-Key:" | head -20)

# Проверяем совпадение через OpenSSL
echo "Проверка через OpenSSL..."
if openssl x509 -in "$CA_CERT" -noout -pubkey 2>/dev/null | openssl rsa -pubin -in /dev/stdin -outform PEM 2>/dev/null > /tmp/cert_pub.pem; then
    if openssl rsa -in "$CA_KEY" -pubout 2>/dev/null > /tmp/key_pub.pem; then
        if diff -q /tmp/cert_pub.pem /tmp/key_pub.pem > /dev/null 2>&1; then
            echo "✓ CA сертификат и ключ совпадают!"
            rm -f /tmp/cert_pub.pem /tmp/key_pub.pem
            exit 0
        else
            echo "✗ CA сертификат и ключ НЕ совпадают!"
            rm -f /tmp/cert_pub.pem /tmp/key_pub.pem
            echo ""
            echo "Решение:"
            echo "1. Создайте новую пару CA сертификат/ключ:"
            echo "   ./scripts/create_single_ca.sh"
            echo ""
            echo "2. Или проверьте, что используются правильные файлы"
            exit 1
        fi
    fi
fi

# Альтернативная проверка - проверка через fingerprint
echo "Альтернативная проверка..."
CERT_MODULUS=$(openssl x509 -in "$CA_CERT" -noout -modulus 2>/dev/null | openssl md5)
KEY_MODULUS=$(openssl rsa -in "$CA_KEY" -noout -modulus 2>/dev/null | openssl md5)

if [ "$CERT_MODULUS" = "$KEY_MODULUS" ]; then
    echo "✓ CA сертификат и ключ совпадают (по модулю)!"
    exit 0
else
    echo "✗ CA сертификат и ключ НЕ совпадают (по модулю)!"
    echo ""
    echo "Cert modulus: $CERT_MODULUS"
    echo "Key modulus:  $KEY_MODULUS"
    echo ""
    echo "Решение:"
    echo "1. Удалите старые файлы:"
    echo "   rm -f $CA_KEY $CA_CERT"
    echo ""
    echo "2. Создайте новую пару CA сертификат/ключ:"
    echo "   ./scripts/create_single_ca.sh"
    exit 1
fi

