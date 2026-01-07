# Настройка mTLS на сервере

## Пошаговая инструкция

### Шаг 1: Подключиться к серверу
```bash
ssh root@38.242.149.188
# Пароль: elbek2197
```

### Шаг 2: Перейти в директорию проекта
```bash
cd /var/www/panel
```

### Шаг 3: Создать директорию для SSL сертификатов
```bash
mkdir -p nginx/ssl/projects
chmod 755 nginx/ssl
chmod 755 nginx/ssl/projects
```

### Шаг 4: Создать временный CA bundle для запуска Nginx
Nginx требует валидный PEM файл для `ssl_client_certificate`, даже если он пустой. 
Создадим временный CA bundle:

```bash
# Вариант 1: Использовать готовый скрипт
chmod +x scripts/fix_nginx_ca_bundle.sh
./scripts/fix_nginx_ca_bundle.sh

# Вариант 2: Создать вручную
cd nginx/ssl
openssl genrsa -out temp-ca-key.pem 2048
openssl req -new -x509 -days 365 -key temp-ca-key.pem \
    -out temp-ca-cert.pem \
    -subj "/C=US/ST=CA/O=Panel/CN=Temporary-CA"
cat temp-ca-cert.pem > ca-bundle.pem
chmod 644 ca-bundle.pem
cd ../..
```

### Шаг 5: Раскомментировать mTLS настройки в nginx.conf
Отредактируйте `nginx.conf` и раскомментируйте строки:

```bash
nano nginx.conf
# Или используйте vi/vim
```

Найдите секцию с mTLS (около строки 173) и раскомментируйте:
```nginx
ssl_client_certificate /etc/nginx/ssl/ca-bundle.pem;  # Project CA bundle
ssl_verify_client optional;  # Accept client certificate if provided
ssl_verify_depth 2;  # Maximum depth for certificate chain validation
```

### Шаг 6: Убедиться, что MTLS_ENABLED=true в .env
```bash
# Проверить текущее значение
grep MTLS_ENABLED .env

# Если нет или false, добавить/изменить:
echo "MTLS_ENABLED=true" >> .env
# Или отредактировать файл:
nano .env
```

### Шаг 7: Пересобрать и перезапустить контейнеры
```bash
docker-compose down
docker-compose up -d --build
```

### Шаг 8: Дождаться запуска всех контейнеров
```bash
# Проверить статус
docker-compose ps

# Проверить логи API (должен запуститься без ошибок)
docker-compose logs api | tail -20

# Проверить логи Nginx (должен запуститься без ошибок)
docker-compose logs nginx | tail -20
```

### Шаг 9: Проверить, что CA bundle создан
```bash
ls -la nginx/ssl/ca-bundle.pem
cat nginx/ssl/ca-bundle.pem | head -5
```

Должен быть виден валидный PEM сертификат.

### Шаг 10: CA создаётся автоматически! ✅

**ВАЖНО:** CA сертификаты теперь создаются **автоматически**:

1. **Для новых проектов** - CA создаётся при создании проекта через API
2. **Для существующих проектов** - CA создаётся автоматически при первом:
   - Подключении через `/api/connect`, `/api/challenge`, `/api/classic_connect`
   - Запросе CA сертификата через `GET /api/projects/<id>/mtls/ca-cert`
   - Подписании CSR через `POST /api/projects/<id>/mtls/csr-sign`

**Ручное создание CA больше не требуется!**

### Шаг 11: (Опционально) Создать CA для существующего проекта вручную

Если нужно создать CA для конкретного проекта прямо сейчас (до первого подключения):

```bash
# Замените YOUR_PROJECT_ID на реальный unique_id проекта
# Можно найти в базе данных или через API
docker-compose exec api python -c "
from backend.utils.mtls_manager import MTLSProjectManager
from backend.models.core import Project
from backend.core.extensions import db

# Получить все проекты
projects = Project.query.all()
print('Доступные проекты:')
for p in projects:
    print(f'  ID: {p.id}, Unique ID: {p.unique_id}, Name: {p.name}')

# Создать CA для всех проектов
m = MTLSProjectManager()
for p in projects:
    try:
        m.ensure_project_ca(p.unique_id, p.name)
        print(f'✓ CA создан для проекта {p.unique_id} ({p.name})')
    except Exception as e:
        print(f'✗ Ошибка для проекта {p.unique_id}: {e}')
"
```

### Шаг 12: Проверить, что CA bundle обновлён
После создания CA для проектов, bundle должен автоматически обновиться:

```bash
# Проверить содержимое bundle (должны быть все CA проектов)
cat nginx/ssl/ca-bundle.pem

# Проверить количество сертификатов в bundle
grep -c "BEGIN CERTIFICATE" nginx/ssl/ca-bundle.pem
```

### Шаг 13: Перезапустить Nginx (если нужно)
После создания реальных CA проектов, можно перезапустить Nginx:

```bash
docker-compose restart nginx
```

## Проверка работы mTLS

### 1. Проверить логи Nginx
```bash
docker-compose logs nginx | grep -i ssl
```

### 2. Проверить, что API принимает mTLS
```bash
docker-compose logs api | grep -i mtls
```

### 3. Тестовый запрос (без сертификата - должен работать, т.к. optional)
```bash
curl -k https://ovrin.xyz/api/challenge
```

### 4. Проверить, что проект CA создан
```bash
ls -la nginx/ssl/projects/
# Должны быть директории для каждого проекта
```

## Устранение проблем

### Проблема: Nginx не запускается с ошибкой "PEM_read_bio_X509_AUX() failed"
**Решение:** Убедитесь, что `ca-bundle.pem` содержит валидный PEM сертификат (не пустой файл).

### Проблема: "Permission denied" при создании CA
**Решение:** Проверьте права на директорию:
```bash
chmod 755 nginx/ssl
chmod 755 nginx/ssl/projects
```

### Проблема: CA не создаётся автоматически
**Решение:** Проверьте логи API:
```bash
docker-compose logs api | grep -i "mtls\|ca"
```

### Проблема: Bundle не обновляется
**Решение:** Bundle обновляется автоматически при вызове `ensure_project_ca()`. 
Проверьте, что метод вызывается (логи API).

## Важные замечания

1. **Временный CA** будет заменён автоматически при создании реальных CA проектов
2. **CA bundle** обновляется автоматически при создании/обновлении CA проектов
3. **mTLS optional** означает, что клиенты могут подключаться без сертификата, но если сертификат предоставлен - он будет проверен
4. **Для production** рекомендуется установить `ssl_verify_client on;` (требовать сертификат обязательно)

## Следующие шаги

После настройки mTLS на сервере:

1. Клиенты должны получить CA сертификат проекта через API
2. Клиенты должны сгенерировать CSR и получить подписанный сертификат
3. Клиенты должны настроить SSL pinning для CA сертификата проекта
4. Клиенты должны использовать клиентский сертификат при подключении

Подробнее см. документацию по настройке клиентов.

