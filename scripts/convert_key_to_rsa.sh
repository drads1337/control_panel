#!/bin/bash
# Скрипт для конвертации клиентского ключа из PKCS#8 в RSA формат
# RSA формат лучше работает с libcurl на Android, особенно с VerifyPeer=false

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${1:-${PROJECT_ID:-2920317791}}"
CLIENT_NAME="${2:-${CLIENT_NAME:-android}}"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CLIENT_DIR="$SSL_DIR/projects/$PROJECT_ID/clients/$CLIENT_NAME"
KEY_FILE="$CLIENT_DIR/client-key.pem"
RSA_KEY_FILE="$CLIENT_DIR/client-key-rsa.pem"

echo "============================================================"
echo "Конвертация клиентского ключа из PKCS#8 в RSA формат"
echo "============================================================"
echo "Project ID: $PROJECT_ID"
echo "Client Name: $CLIENT_NAME"
echo ""

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Файл ключа не найден: $KEY_FILE"
    echo ""
    echo "Использование:"
    echo "  $0 [project_id] [client_name]"
    echo ""
    echo "Пример:"
    echo "  $0 2920317791 android"
    exit 1
fi

# Проверяем формат ключа
KEY_FORMAT=$(head -1 "$KEY_FILE")
if [[ "$KEY_FORMAT" == *"BEGIN RSA PRIVATE KEY"* ]]; then
    echo "✓ Ключ уже в RSA формате (-----BEGIN RSA PRIVATE KEY-----)"
    echo "  Файл: $KEY_FILE"
    exit 0
elif [[ "$KEY_FORMAT" == *"BEGIN PRIVATE KEY"* ]]; then
    echo "⚠ Ключ в PKCS#8 формате (-----BEGIN PRIVATE KEY-----)"
    echo "  Конвертируем в RSA формат..."
else
    echo "❌ Неизвестный формат ключа: $KEY_FORMAT"
    exit 1
fi

# Конвертируем PKCS#8 в RSA формат
echo ""
echo "Конвертация: $KEY_FILE -> RSA формат"

# Создаем резервную копию
BACKUP_FILE="${KEY_FILE}.pkcs8.backup.$(date +%Y%m%d_%H%M%S)"
cp "$KEY_FILE" "$BACKUP_FILE"
echo "✓ Создана резервная копия: $BACKUP_FILE"

# Конвертируем во временный файл
TEMP_RSA_KEY="${KEY_FILE}.rsa.tmp"
if openssl rsa -in "$KEY_FILE" -out "$TEMP_RSA_KEY" 2>/dev/null; then
    chmod 600 "$TEMP_RSA_KEY"
    
    # Проверяем, что конвертированный ключ соответствует сертификату (если есть)
    if [ -f "$CLIENT_DIR/client-cert.pem" ]; then
        CERT_FILE="$CLIENT_DIR/client-cert.pem"
        if openssl x509 -noout -modulus -in "$CERT_FILE" 2>/dev/null | openssl md5 > /tmp/cert_mod.txt && \
           openssl rsa -noout -modulus -in "$TEMP_RSA_KEY" 2>/dev/null | openssl md5 > /tmp/key_mod.txt && \
           cmp -s /tmp/cert_mod.txt /tmp/key_mod.txt 2>/dev/null; then
            echo "✓ Конвертированный ключ соответствует сертификату"
            KEY_MATCHES=true
            rm -f /tmp/cert_mod.txt /tmp/key_mod.txt
        else
            echo "⚠ Предупреждение: конвертированный ключ может не соответствовать сертификату"
            KEY_MATCHES=false
            rm -f /tmp/cert_mod.txt /tmp/key_mod.txt
        fi
    else
        echo "⚠ Сертификат не найден, пропускаем проверку соответствия"
        KEY_MATCHES=true
    fi
    
    # Заменяем оригинальный файл
    if [ "$KEY_MATCHES" = true ]; then
        mv "$TEMP_RSA_KEY" "$KEY_FILE"
        chmod 600 "$KEY_FILE"
        echo "✓ Ключ успешно сконвертирован и заменен на RSA формат"
        echo ""
        echo "Файлы:"
        echo "  Original (PKCS#8): $BACKUP_FILE (резервная копия)"
        echo "  RSA format:        $KEY_FILE (заменен)"
        echo ""
        echo "✓ Готово! Теперь используйте client-key.pem (в RSA формате)"
    else
        echo "❌ Конвертация отменена из-за несоответствия ключа и сертификата"
        mv "$BACKUP_FILE" "$KEY_FILE"
        rm -f "$TEMP_RSA_KEY"
        exit 1
    fi
else
    echo "❌ Ошибка при конвертации ключа"
    rm -f "$TEMP_RSA_KEY"
    mv "$BACKUP_FILE" "$KEY_FILE"
    echo ""
    echo "Возможные причины:"
    echo "  1. OpenSSL не установлен или версия не поддерживает эту команду"
    echo "  2. Ключ защищен паролем (не поддерживается)"
    echo "  3. Ключ поврежден"
    echo ""
    echo "Попробуйте использовать команду вручную:"
    echo "  openssl rsa -in $KEY_FILE -out ${KEY_FILE}.rsa"
    exit 1
fi

