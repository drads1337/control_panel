#!/bin/bash
# Автоматическая настройка mTLS на сервере
# Использование: ./scripts/setup_mtls_server.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Настройка mTLS на сервере"
echo "=========================================="
echo ""

# Шаг 1: Создать директории
echo "Шаг 1: Создание директорий для SSL сертификатов..."
mkdir -p "$PROJECT_ROOT/nginx/ssl/projects"
chmod 755 "$PROJECT_ROOT/nginx/ssl"
chmod 755 "$PROJECT_ROOT/nginx/ssl/projects"
echo "✓ Директории созданы"
echo ""

# Шаг 2: Создать временный CA bundle
echo "Шаг 2: Создание временного CA bundle для Nginx..."
BUNDLE_PATH="$PROJECT_ROOT/nginx/ssl/ca-bundle.pem"

if [ -f "$BUNDLE_PATH" ] && grep -q "BEGIN CERTIFICATE" "$BUNDLE_PATH" 2>/dev/null; then
    echo "✓ CA bundle уже существует"
else
    cd "$PROJECT_ROOT/nginx/ssl"
    openssl genrsa -out temp-ca-key.pem 2048 2>/dev/null || {
        echo "✗ Ошибка: Не удалось создать временный CA ключ"
        echo "  Убедитесь, что OpenSSL установлен"
        exit 1
    }
    
    openssl req -new -x509 -days 365 -key temp-ca-key.pem \
        -out temp-ca-cert.pem \
        -subj "/C=US/ST=CA/O=Panel/CN=Temporary-CA" 2>/dev/null || {
        echo "✗ Ошибка: Не удалось создать временный CA сертификат"
        exit 1
    }
    
    cat temp-ca-cert.pem > ca-bundle.pem
    chmod 644 ca-bundle.pem
    echo "✓ Временный CA bundle создан"
    cd "$PROJECT_ROOT"
fi
echo ""

# Шаг 3: Проверить/установить MTLS_ENABLED
echo "Шаг 3: Проверка настройки MTLS_ENABLED..."
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    if grep -q "^MTLS_ENABLED=" "$ENV_FILE"; then
        # Обновить существующую строку
        sed -i.bak 's/^MTLS_ENABLED=.*/MTLS_ENABLED=true/' "$ENV_FILE"
        echo "✓ MTLS_ENABLED установлен в true"
    else
        # Добавить новую строку
        echo "MTLS_ENABLED=true" >> "$ENV_FILE"
        echo "✓ MTLS_ENABLED добавлен в .env"
    fi
else
    echo "MTLS_ENABLED=true" > "$ENV_FILE"
    echo "✓ Создан .env файл с MTLS_ENABLED=true"
fi
echo ""

# Шаг 4: Проверить nginx.conf
echo "Шаг 4: Проверка конфигурации Nginx..."
NGINX_CONF="$PROJECT_ROOT/nginx.conf"
if grep -q "^[[:space:]]*ssl_client_certificate" "$NGINX_CONF"; then
    echo "✓ mTLS настройки уже раскомментированы в nginx.conf"
elif grep -q "^[[:space:]]*#.*ssl_client_certificate" "$NGINX_CONF"; then
    echo "⚠ ВНИМАНИЕ: mTLS настройки закомментированы в nginx.conf"
    echo "  Нужно раскомментировать следующие строки:"
    echo "    - ssl_client_certificate /etc/nginx/ssl/ca-bundle.pem;"
    echo "    - ssl_verify_client optional;"
    echo "    - ssl_verify_depth 2;"
    echo ""
    read -p "Раскомментировать автоматически? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Раскомментировать строки
        sed -i.bak 's/^[[:space:]]*#.*ssl_client_certificate/        ssl_client_certificate/' "$NGINX_CONF"
        sed -i.bak 's/^[[:space:]]*#.*ssl_verify_client optional/        ssl_verify_client optional/' "$NGINX_CONF"
        sed -i.bak 's/^[[:space:]]*#.*ssl_verify_depth 2/        ssl_verify_depth 2/' "$NGINX_CONF"
        echo "✓ mTLS настройки раскомментированы"
    else
        echo "⚠ Пропущено. Раскомментируйте вручную перед перезапуском Nginx"
    fi
else
    echo "⚠ Не найдены настройки mTLS в nginx.conf"
    echo "  Убедитесь, что конфигурация правильная"
fi
echo ""

# Шаг 5: Информация о перезапуске
echo "=========================================="
echo "Следующие шаги:"
echo "=========================================="
echo ""
echo "1. Пересобрать и перезапустить контейнеры:"
echo "   docker-compose down"
echo "   docker-compose up -d --build"
echo ""
echo "2. Проверить статус контейнеров:"
echo "   docker-compose ps"
echo ""
echo "3. Проверить логи:"
echo "   docker-compose logs nginx | tail -20"
echo "   docker-compose logs api | tail -20"
echo ""
echo "4. CA сертификаты создаются автоматически:"
echo "   - При создании нового проекта"
echo "   - При первом подключении существующего проекта"
echo "   - При запросе CA через API"
echo ""
echo "5. (Опционально) Создать CA для всех существующих проектов:"
echo "   docker-compose exec api python -c \""
echo "   from backend.utils.mtls_manager import MTLSProjectManager"
echo "   from backend.models.core import Project"
echo "   m = MTLSProjectManager()"
echo "   for p in Project.query.all():"
echo "       m.ensure_project_ca(p.unique_id, p.name)"
echo "       print(f'CA создан для {p.unique_id}')"
echo "   \""
echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="

