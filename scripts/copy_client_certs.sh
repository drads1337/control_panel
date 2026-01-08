#!/bin/bash
# Скрипт для копирования клиентских сертификатов с сервера

echo "============================================================"
echo "Копирование клиентских сертификатов"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${1:-2920317791}"
CLIENT_NAME="${2:-android}"
OUTPUT_DIR="${3:-./certs}"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CLIENT_DIR="$SSL_DIR/projects/$PROJECT_ID/clients/$CLIENT_NAME"
CERT_FILE="$CLIENT_DIR/client-cert.pem"
KEY_FILE="$CLIENT_DIR/client-key.pem"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "⚠ Сертификаты не найдены:"
    echo "  Cert: $CERT_FILE"
    echo "  Key: $KEY_FILE"
    echo ""
    echo "Сначала создайте сертификаты:"
    echo "  ./scripts/get_client_certs_for_android.sh $PROJECT_ID $CLIENT_NAME <user_key>"
    exit 1
fi

# Создаем выходную директорию
mkdir -p "$OUTPUT_DIR"

# Копируем файлы
echo "Копирование сертификатов..."
cp "$CERT_FILE" "$OUTPUT_DIR/client-cert.pem"
cp "$KEY_FILE" "$OUTPUT_DIR/client-key.pem"

echo ""
echo "✓ Сертификаты скопированы в: $OUTPUT_DIR"
echo ""
echo "Содержимое директории:"
ls -lh "$OUTPUT_DIR"/*.pem 2>/dev/null || ls -lh "$OUTPUT_DIR"

echo ""
echo "Информация о сертификате:"
openssl x509 -in "$OUTPUT_DIR/client-cert.pem" -text -noout | grep -E "Subject:|Issuer:|Validity" | head -3

echo ""
echo "============================================================"
echo "✓ Готово!"
echo "============================================================"
echo ""
echo "Теперь вы можете:"
echo "1. Скопировать файлы в Android приложение"
echo "2. Разместить в assets/ или скопировать во внутреннее хранилище"
echo "3. Обновить пути в main.cpp:"
echo "   CLIENT_CERT_PATH = \"/data/data/YOUR.PACKAGE.NAME/files/client-cert.pem\""
echo "   CLIENT_KEY_PATH = \"/data/data/YOUR.PACKAGE.NAME/files/client-key.pem\""
echo ""

