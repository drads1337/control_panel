#!/bin/bash
# Скрипт для получения клиентских сертификатов для Android приложения
# Использует единый CA для всех клиентов (упрощенная конфигурация)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Параметры (можно задать через переменные окружения)
# NOTE: С единым CA для всех клиентов:
#   - client_name может быть ЛЮБЫМ: "android", "mobile", "my-app", "client-1", etc.
#   - Все сертификаты подписываются единым CA (nginx/ssl/ca-cert.pem)
#   - CN сертификата = просто client_name (универсальный, без project_id prefix)
PROJECT_ID="${1:-${PROJECT_ID:-2920317791}}"
CLIENT_NAME="${2:-${CLIENT_NAME:-android}}"  # Может быть любым: "android", "mobile", "myapp", etc.
USER_KEY="${3:-${USER_KEY:-}}"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CLIENT_DIR="$SSL_DIR/projects/$PROJECT_ID/clients/$CLIENT_NAME"
CERT_FILE="$CLIENT_DIR/client-cert.pem"
KEY_FILE="$CLIENT_DIR/client-key.pem"

echo "============================================================"
echo "Получение клиентских сертификатов для Android приложения"
echo "Используется единый CA для всех клиентов (универсальные сертификаты)"
echo "============================================================"
echo "Project ID: $PROJECT_ID (используется только для организации файлов, не в CN)"
echo "Client Name: $CLIENT_NAME (CN сертификата = просто '$CLIENT_NAME')"
echo ""
echo "NOTE: Сертификаты универсальные - CN может быть любым (без project_id prefix)"
echo "      Все сертификаты подписываются единым CA и работают для всех проектов"
echo ""

# Проверяем, существуют ли сертификаты и правильный ли у них CN
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    # Проверяем CN в сертификате
    CERT_CN=$(openssl x509 -in "$CERT_FILE" -text -noout | grep "Subject:" | grep -o "CN = [^,]*" | cut -d'=' -f2 | tr -d ' ')
    
    # Если CN содержит project- prefix (старый формат), удаляем и создаем заново
    if echo "$CERT_CN" | grep -q "^project-"; then
        echo "⚠ Найден старый сертификат с CN='$CERT_CN' (старый формат с project_id)"
        echo "  Удаляем старый сертификат и создаем новый с универсальным CN='$CLIENT_NAME'..."
        rm -f "$CERT_FILE" "$KEY_FILE"
        echo "✓ Старый сертификат удален"
        echo ""
    else
        # Сертификат с правильным форматом
        echo "✓ Сертификаты уже существуют (CN='$CERT_CN'):"
        echo "  Cert: $CERT_FILE"
        echo "  Key: $KEY_FILE"
        echo ""
        echo "Содержимое сертификата:"
        openssl x509 -in "$CERT_FILE" -text -noout | grep -A 2 "Subject:"
        openssl x509 -in "$CERT_FILE" -fingerprint -sha256 -noout
        echo ""
        echo "============================================================"
        echo "✓ Сертификаты готовы для использования"
        echo "============================================================"
        echo ""
        echo "Инструкция по установке в Android:"
        echo "1. Скопируйте файлы client-cert.pem и client-key.pem в ваше Android приложение"
        echo "2. Разместите их в папке assets или скопируйте во внутреннее хранилище приложения"
        echo "3. Обновите пути в main.cpp:"
        echo "   CLIENT_CERT_PATH = \"/data/data/YOUR.PACKAGE.NAME/files/client-cert.pem\""
        echo "   CLIENT_KEY_PATH = \"/data/data/YOUR.PACKAGE.NAME/files/client-key.pem\""
        echo ""
        exit 0
    fi
fi

# Если сертификатов нет и есть user_key, создаем через API
if [ -n "$USER_KEY" ]; then
    echo "Генерация сертификатов через API с user_key..."
    echo "Project ID: $PROJECT_ID"
    echo "Client Name: $CLIENT_NAME"
    echo "User Key: ${USER_KEY:0:10}..."
    echo ""
    
    cd "$PROJECT_ROOT"
    
    # Создаем сертификаты напрямую через Python с нужным client_name
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
    sys.exit(1)
" 2>&1
    
    if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
        echo ""
        echo "============================================================"
        echo "✓ Сертификаты успешно созданы!"
        echo "============================================================"
        echo "Cert: $CERT_FILE"
        echo "Key: $KEY_FILE"
        echo ""
        echo "Содержимое сертификата:"
        openssl x509 -in "$CERT_FILE" -text -noout | grep -A 2 "Subject:"
        openssl x509 -in "$CERT_FILE" -fingerprint -sha256 -noout
        echo ""
        exit 0
    else
        echo ""
        echo "⚠ Не удалось создать сертификаты через API."
        echo "   Попробуйте создать вручную (см. инструкции ниже)."
        echo ""
    fi
fi

echo "⚠ Сертификаты не найдены."
echo ""
echo "Для создания сертификатов используйте один из способов:"
echo ""
echo "1. Автоматически через скрипт check_license.py (РЕКОМЕНДУЕТСЯ):"
echo "   cd $PROJECT_ROOT"
echo "   python3 check_license.py"
echo "   # Скрипт автоматически создаст сертификаты с правильным CN"
echo ""
echo "2. Вручную через API (для автоматической установки в Android):"
echo "   POST https://ovrin.xyz/api/projects/$PROJECT_ID/mtls/csr-sign-public"
echo "   Body: {\"user_key\": \"YOUR_KEY\", \"csr_pem\": \"...\", \"client_name\": \"$CLIENT_NAME\"}"
echo "   # Вернет сертификат, подписанный единым CA"
echo ""
echo "3. На сервере вручную через OpenSSL:"
echo "   cd $SSL_DIR"
echo "   mkdir -p projects/$PROJECT_ID/clients/$CLIENT_NAME"
echo "   # Генерация ключа:"
echo "   openssl genrsa -out projects/$PROJECT_ID/clients/$CLIENT_NAME/client-key.pem 2048"
echo "   # Создание CSR (ВАЖНО: CN = просто client_name, БЕЗ project_id prefix):"
echo "   openssl req -new -key projects/$PROJECT_ID/clients/$CLIENT_NAME/client-key.pem \\"
echo "     -out projects/$PROJECT_ID/clients/$CLIENT_NAME/client.csr \\"
echo "     -subj \"/C=US/ST=CA/O=Panel/CN=$CLIENT_NAME\""
echo "   # Подписание единым CA (универсальный сертификат):"
echo "   openssl x509 -req -days 365 \\"
echo "     -in projects/$PROJECT_ID/clients/$CLIENT_NAME/client.csr \\"
echo "     -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \\"
echo "     -out projects/$PROJECT_ID/clients/$CLIENT_NAME/client-cert.pem \\"
echo "     -extensions v3_req -extfile <(echo -e \"[v3_req]\\nkeyUsage = digitalSignature, keyEncipherment\\nextendedKeyUsage = clientAuth\")"
echo ""
echo "ВАЖНО: Универсальные сертификаты - CN = просто '$CLIENT_NAME' (БЕЗ project_id prefix)"
echo "       Все сертификаты подписываются единым CA и работают для всех проектов"
echo "       Project ID проверяется через другие поля (в теле запроса), не через CN"
echo ""

