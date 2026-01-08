#!/bin/bash
# Скрипт для пересоздания клиентского сертификата с правильным единым CA
# Удаляет старый сертификат (подписанный per-project CA) и создает новый (подписанный единым CA)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${1:-${PROJECT_ID:-2920317791}}"
CLIENT_NAME="${2:-${CLIENT_NAME:-test-client}}"
USER_KEY="${3:-${USER_KEY:-}}"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CLIENT_DIR="$SSL_DIR/projects/$PROJECT_ID/clients/$CLIENT_NAME"
CERT_FILE="$CLIENT_DIR/client-cert.pem"
KEY_FILE="$CLIENT_DIR/client-key.pem"

echo "============================================================"
echo "Пересоздание клиентского сертификата с единым CA"
echo "============================================================"
echo "Project ID: $PROJECT_ID"
echo "Client Name: $CLIENT_NAME"
echo ""

# Проверяем наличие user_key
if [ -z "$USER_KEY" ]; then
    echo "❌ USER_KEY не предоставлен"
    echo ""
    echo "Использование:"
    echo "  $0 [project_id] [client_name] [user_key]"
    echo ""
    echo "Пример:"
    echo "  $0 2920317791 android PUBG-12M-uUakzkGT5FQY"
    echo ""
    echo "Или через переменные окружения:"
    echo "  export USER_KEY='PUBG-12M-uUakzkGT5FQY'"
    echo "  $0 2920317791 android"
    exit 1
fi

# Проверяем существующие сертификаты
if [ -f "$CERT_FILE" ]; then
    echo "Найден существующий сертификат:"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -E "Subject:|Issuer:" | head -2
    echo ""
    
    # Проверяем Issuer
    ISSUER=$(openssl x509 -in "$CERT_FILE" -text -noout | grep "Issuer:" | grep -o "CN = [^,]*" | cut -d'=' -f2 | tr -d ' ')
    if [[ "$ISSUER" == *"Project-"* ]]; then
        echo "⚠ Сертификат подписан старым per-project CA: $ISSUER"
        echo "  Нужно пересоздать с единым CA (Panel CA)"
    elif [[ "$ISSUER" == *"Panel CA"* ]]; then
        echo "✓ Сертификат уже подписан единым CA: $ISSUER"
        echo "  Но пересоздаем для обновления CN (универсальный формат)"
    fi
    
    # Проверяем CN
    CN=$(openssl x509 -in "$CERT_FILE" -text -noout | grep "Subject:" | grep -o "CN = [^,]*" | cut -d'=' -f2 | tr -d ' ')
    if [[ "$CN" == project-* ]]; then
        echo "⚠ CN содержит старый формат с project_id: $CN"
        echo "  Нужно пересоздать с универсальным CN (без project_id prefix)"
    fi
    
    echo ""
    read -p "Удалить старый сертификат и создать новый? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отменено"
        exit 0
    fi
    
    # Создаем резервную копию
    BACKUP_DIR="${CLIENT_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp "$CERT_FILE" "$BACKUP_DIR/" 2>/dev/null || true
    cp "$KEY_FILE" "$BACKUP_DIR/" 2>/dev/null || true
    echo "✓ Резервная копия создана: $BACKUP_DIR"
    
    # Удаляем старые сертификаты
    rm -f "$CERT_FILE" "$KEY_FILE"
    echo "✓ Старые сертификаты удалены"
fi

# Пересоздаем сертификаты через API
echo ""
echo "Создание нового сертификата через API..."
echo "Project ID: $PROJECT_ID"
echo "Client Name: $CLIENT_NAME"
echo "User Key: ${USER_KEY:0:10}..."
echo ""

cd "$PROJECT_ROOT"

python3 -c "
import sys
sys.path.insert(0, '.')
from check_license import generate_client_certificates
import os

try:
    cert_path, key_path = generate_client_certificates(
        project_id='$PROJECT_ID',
        client_name='$CLIENT_NAME',
        user_key='$USER_KEY'
    )
    print(f'[mTLS] ✓ Сертификаты успешно созданы!')
    print(f'[mTLS]   Cert: {cert_path}')
    print(f'[mTLS]   Key: {key_path}')
except Exception as e:
    print(f'[mTLS] ❌ Ошибка при создании сертификатов: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
" 2>&1

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Не удалось создать сертификаты через API"
    exit 1
fi

# Проверяем новый сертификат
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo ""
    echo "============================================================"
    echo "✓ Новый сертификат создан!"
    echo "============================================================"
    echo ""
    echo "Информация о новом сертификате:"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -E "Subject:|Issuer:|CN =|Validity" | head -4
    
    # Проверяем Issuer
    NEW_ISSUER=$(openssl x509 -in "$CERT_FILE" -text -noout | grep "Issuer:" | grep -o "CN = [^,]*" | cut -d'=' -f2 | tr -d ' ')
    if [[ "$NEW_ISSUER" == *"Panel CA"* ]]; then
        echo ""
        echo "✓ Сертификат подписан единым CA: $NEW_ISSUER"
    else
        echo ""
        echo "⚠ ВНИМАНИЕ: Сертификат подписан другим CA: $NEW_ISSUER"
    fi
    
    # Проверяем CN
    NEW_CN=$(openssl x509 -in "$CERT_FILE" -text -noout | grep "Subject:" | grep -o "CN = [^,]*" | cut -d'=' -f2 | tr -d ' ')
    if [[ "$NEW_CN" != project-* ]]; then
        echo "✓ CN в универсальном формате: $NEW_CN"
    else
        echo "⚠ CN все еще содержит project_id: $NEW_CN"
    fi
    
    # Проверяем формат ключа
    KEY_FORMAT=$(head -1 "$KEY_FILE")
    if [[ "$KEY_FORMAT" == *"BEGIN RSA PRIVATE KEY"* ]]; then
        echo "✓ Ключ в RSA формате"
    elif [[ "$KEY_FORMAT" == *"BEGIN PRIVATE KEY"* ]]; then
        echo "⚠ Ключ в PKCS#8 формате - конвертируем в RSA..."
        ./scripts/convert_key_to_rsa.sh "$PROJECT_ID" "$CLIENT_NAME"
    fi
    
    echo ""
    echo "Файлы:"
    echo "  Cert: $CERT_FILE"
    echo "  Key:  $KEY_FILE"
    echo ""
    echo "✓ Готово! Теперь используйте эти сертификаты"
else
    echo ""
    echo "❌ Файлы сертификатов не найдены после создания"
    exit 1
fi

