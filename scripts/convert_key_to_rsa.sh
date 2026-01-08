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
echo "Конвертация: $KEY_FILE -> $RSA_KEY_FILE"
if openssl rsa -in "$KEY_FILE" -out "$RSA_KEY_FILE" 2>/dev/null; then
    chmod 600 "$RSA_KEY_FILE"
    echo "✓ Ключ успешно сконвертирован в RSA формат"
    echo ""
    echo "Файлы:"
    echo "  Original (PKCS#8): $KEY_FILE"
    echo "  RSA format:        $RSA_KEY_FILE"
    echo ""
    echo "⚠ ВАЖНО: Теперь используйте client-key-rsa.pem вместо client-key.pem"
    echo ""
    echo "Обновите пути в вашем Android приложении:"
    echo "  CLIENT_KEY_PATH = \".../client-key-rsa.pem\""
    echo ""
    echo "Или замените оригинальный файл (ОСТОРОЖНО - создаст резервную копию):"
    echo "  mv $KEY_FILE ${KEY_FILE}.pkcs8.backup"
    echo "  mv $RSA_KEY_FILE $KEY_FILE"
else
    echo "❌ Ошибка при конвертации ключа"
    echo ""
    echo "Возможные причины:"
    echo "  1. OpenSSL не установлен"
    echo "  2. Ключ защищен паролем (не поддерживается)"
    echo "  3. Ключ поврежден"
    exit 1
fi

