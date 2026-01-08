#!/bin/bash
# Скрипт для проверки и исправления формата клиентского ключа
# Проверяет формат ключа, конвертирует PKCS#8 в RSA если нужно

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${1:-${PROJECT_ID:-2920317791}}"
CLIENT_NAME="${2:-${CLIENT_NAME:-test-client}}"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CLIENT_DIR="$SSL_DIR/projects/$PROJECT_ID/clients/$CLIENT_NAME"
KEY_FILE="$CLIENT_DIR/client-key.pem"
CERT_FILE="$CLIENT_DIR/client-cert.pem"

echo "============================================================"
echo "Проверка формата клиентского ключа и сертификата"
echo "============================================================"
echo "Project ID: $PROJECT_ID"
echo "Client Name: $CLIENT_NAME"
echo ""

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Файл ключа не найден: $KEY_FILE"
    exit 1
fi

if [ ! -f "$CERT_FILE" ]; then
    echo "❌ Файл сертификата не найден: $CERT_FILE"
    exit 1
fi

# Проверяем формат ключа
echo "Проверка формата ключа..."
KEY_FORMAT=$(head -1 "$KEY_FILE")
if [[ "$KEY_FORMAT" == *"BEGIN RSA PRIVATE KEY"* ]]; then
    echo "✓ Ключ в RSA формате (-----BEGIN RSA PRIVATE KEY-----)"
    KEY_FORMAT_NAME="RSA"
    NEED_CONVERSION=false
elif [[ "$KEY_FORMAT" == *"BEGIN PRIVATE KEY"* ]]; then
    echo "⚠ Ключ в PKCS#8 формате (-----BEGIN PRIVATE KEY-----)"
    KEY_FORMAT_NAME="PKCS#8"
    NEED_CONVERSION=true
else
    echo "❌ Неизвестный формат ключа: $KEY_FORMAT"
    exit 1
fi

# Проверяем соответствие ключа и сертификата
echo ""
echo "Проверка соответствия ключа и сертификата..."
if openssl x509 -noout -modulus -in "$CERT_FILE" 2>/dev/null | openssl md5 > /tmp/cert_modulus.txt && \
   openssl rsa -noout -modulus -in "$KEY_FILE" 2>/dev/null | openssl md5 > /tmp/key_modulus.txt && \
   cmp -s /tmp/cert_modulus.txt /tmp/key_modulus.txt; then
    echo "✓ Ключ и сертификат соответствуют друг другу"
    KEY_MATCHES=true
else
    echo "❌ Ключ и сертификат НЕ соответствуют друг другу!"
    KEY_MATCHES=false
fi
rm -f /tmp/cert_modulus.txt /tmp/key_modulus.txt

# Проверяем подпись сертификата
echo ""
echo "Проверка подписи сертификата..."
CA_CERT="$SSL_DIR/ca-cert.pem"
if [ -f "$CA_CERT" ]; then
    if openssl verify -CAfile "$CA_CERT" "$CERT_FILE" > /dev/null 2>&1; then
        echo "✓ Сертификат подписан правильным CA"
        CERT_VALID=true
    else
        echo "⚠ Сертификат НЕ подписан правильным CA (или проверка не прошла)"
        CERT_VALID=false
    fi
else
    echo "⚠ CA сертификат не найден: $CA_CERT"
    CERT_VALID=false
fi

# Показываем информацию о сертификате
echo ""
echo "Информация о сертификате:"
openssl x509 -in "$CERT_FILE" -text -noout | grep -E "Subject:|Issuer:|CN =|Validity"

# Если ключ в PKCS#8 формате, конвертируем в RSA
if [ "$NEED_CONVERSION" = true ]; then
    echo ""
    echo "============================================================"
    echo "Конвертация ключа из PKCS#8 в RSA формат"
    echo "============================================================"
    
    # Создаем резервную копию
    BACKUP_FILE="${KEY_FILE}.pkcs8.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$KEY_FILE" "$BACKUP_FILE"
    echo "✓ Создана резервная копия: $BACKUP_FILE"
    
    # Конвертируем PKCS#8 в RSA формат
    TEMP_RSA_KEY="${KEY_FILE}.rsa.tmp"
    if openssl rsa -in "$KEY_FILE" -out "$TEMP_RSA_KEY" 2>/dev/null; then
        # Проверяем, что конвертированный ключ соответствует сертификату
        if openssl x509 -noout -modulus -in "$CERT_FILE" 2>/dev/null | openssl md5 > /tmp/cert_modulus.txt && \
           openssl rsa -noout -modulus -in "$TEMP_RSA_KEY" 2>/dev/null | openssl md5 > /tmp/key_modulus.txt && \
           cmp -s /tmp/cert_modulus.txt /tmp/key_modulus.txt; then
            # Ключ соответствует сертификату - заменяем оригинал
            mv "$TEMP_RSA_KEY" "$KEY_FILE"
            chmod 600 "$KEY_FILE"
            echo "✓ Ключ успешно сконвертирован в RSA формат"
            echo "✓ Конвертированный ключ соответствует сертификату"
            KEY_FORMAT_NAME="RSA"
            NEED_CONVERSION=false
        else
            echo "❌ Конвертированный ключ НЕ соответствует сертификату!"
            echo "   Возвращаем оригинальный ключ из резервной копии"
            mv "$BACKUP_FILE" "$KEY_FILE"
            rm -f "$TEMP_RSA_KEY"
            exit 1
        fi
        rm -f /tmp/cert_modulus.txt /tmp/key_modulus.txt
    else
        echo "❌ Ошибка при конвертации ключа"
        rm -f "$TEMP_RSA_KEY"
        exit 1
    fi
fi

echo ""
echo "============================================================"
echo "Результаты проверки:"
echo "============================================================"
echo "Формат ключа: $KEY_FORMAT_NAME"
if [ "$KEY_MATCHES" = true ]; then
    echo "Соответствие ключа и сертификата: ✓"
else
    echo "Соответствие ключа и сертификата: ❌ (требует внимания)"
fi
if [ "$CERT_VALID" = true ]; then
    echo "Подпись сертификата: ✓"
else
    echo "Подпись сертификата: ⚠ (требует внимания)"
fi
echo ""
echo "Файлы:"
echo "  Cert: $CERT_FILE"
echo "  Key:  $KEY_FILE"

