#!/bin/bash
# Завершение настройки mTLS - пересборка и проверка

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Завершение настройки mTLS"
echo "=========================================="
echo ""

# Шаг 1: Пересобрать и перезапустить контейнеры
echo "Шаг 1: Остановка контейнеров..."
cd "$PROJECT_ROOT"
docker-compose down
echo "✓ Контейнеры остановлены"
echo ""

echo "Шаг 2: Пересборка и запуск контейнеров..."
docker-compose up -d --build
echo "✓ Контейнеры пересобраны и запущены"
echo ""

# Шаг 2: Дождаться запуска
echo "Шаг 3: Ожидание запуска контейнеров (10 секунд)..."
sleep 10
echo ""

# Шаг 3: Проверить статус
echo "Шаг 4: Проверка статуса контейнеров..."
docker-compose ps
echo ""

# Шаг 4: Проверить логи Nginx
echo "Шаг 5: Проверка логов Nginx..."
echo "--- Последние 20 строк логов Nginx ---"
docker-compose logs nginx --tail=20 2>&1 | tail -20
echo ""

# Проверить наличие ошибок
if docker-compose logs nginx 2>&1 | grep -i "error\|fatal\|failed" | tail -5; then
    echo "⚠ Обнаружены ошибки в логах Nginx (см. выше)"
else
    echo "✓ Логи Nginx без критических ошибок"
fi
echo ""

# Шаг 5: Проверить логи API
echo "Шаг 6: Проверка логов API..."
echo "--- Последние 20 строк логов API ---"
docker-compose logs api --tail=20 2>&1 | tail -20
echo ""

# Проверить наличие ошибок
if docker-compose logs api 2>&1 | grep -i "error\|fatal\|failed\|exception" | tail -5; then
    echo "⚠ Обнаружены ошибки в логах API (см. выше)"
else
    echo "✓ Логи API без критических ошибок"
fi
echo ""

# Шаг 6: Проверить CA bundle
echo "Шаг 7: Проверка CA bundle..."
BUNDLE_PATH="$PROJECT_ROOT/nginx/ssl/ca-bundle.pem"
if [ -f "$BUNDLE_PATH" ]; then
    CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" "$BUNDLE_PATH" 2>/dev/null || echo "0")
    echo "✓ CA bundle существует: $BUNDLE_PATH"
    echo "  Количество сертификатов: $CERT_COUNT"
    if [ "$CERT_COUNT" -gt 0 ]; then
        echo "  Первые строки:"
        head -5 "$BUNDLE_PATH" | sed 's/^/    /'
    fi
else
    echo "✗ CA bundle не найден: $BUNDLE_PATH"
fi
echo ""

# Шаг 7: Опционально создать CA для существующих проектов
echo "Шаг 8: Создание CA для существующих проектов..."
read -p "Создать CA для всех существующих проектов? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Создание CA для проектов..."
    docker-compose exec -T api python -c "
from backend.utils.mtls_manager import MTLSProjectManager
from backend.models.core import Project
from backend.core.extensions import db

try:
    m = MTLSProjectManager()
    projects = Project.query.all()
    
    if not projects:
        print('  Нет проектов в базе данных')
    else:
        print(f'  Найдено проектов: {len(projects)}')
        for p in projects:
            try:
                m.ensure_project_ca(p.unique_id, p.name)
                print(f'  ✓ CA создан для проекта {p.unique_id} ({p.name})')
            except Exception as e:
                print(f'  ✗ Ошибка для проекта {p.unique_id}: {e}')
        
        print('')
        print('  Проверка обновления CA bundle...')
        import os
        bundle_path = '/app/nginx/ssl/ca-bundle.pem'
        if os.path.exists(bundle_path):
            with open(bundle_path, 'r') as f:
                content = f.read()
                cert_count = content.count('BEGIN CERTIFICATE')
                print(f'  ✓ CA bundle обновлён, сертификатов: {cert_count}')
        else:
            print('  ⚠ CA bundle не найден')
except Exception as e:
    print(f'  ✗ Ошибка: {e}')
    import traceback
    traceback.print_exc()
" || {
        echo "  ⚠ Не удалось выполнить создание CA (возможно, контейнер ещё не готов)"
        echo "  Попробуйте выполнить команду вручную позже:"
        echo "  docker-compose exec api python -c \"...\""
    }
else
    echo "  Пропущено. CA будет создан автоматически при первом подключении проекта."
fi
echo ""

# Итоговая информация
echo "=========================================="
echo "Настройка завершена!"
echo "=========================================="
echo ""
echo "Проверьте:"
echo "1. Все контейнеры запущены: docker-compose ps"
echo "2. Nginx работает без ошибок: docker-compose logs nginx"
echo "3. API работает без ошибок: docker-compose logs api"
echo "4. CA bundle существует: ls -la nginx/ssl/ca-bundle.pem"
echo ""
echo "CA сертификаты будут создаваться автоматически:"
echo "- При создании нового проекта"
echo "- При первом подключении существующего проекта"
echo "- При запросе CA через API: GET /api/projects/<id>/mtls/ca-cert"
echo ""
echo "Для проверки работы mTLS:"
echo "curl -k https://ovrin.xyz/api/challenge"
echo ""

