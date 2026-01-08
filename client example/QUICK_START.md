# Быстрый старт: Получение клиентских сертификатов

## Важно: Единый CA для всех клиентов

Используется **один CA сертификат** для всех клиентов (упрощенная конфигурация).

Это означает:
- ✅ `client_name` может быть **любым** - "android", "mobile", "myapp", "client-1", etc.
- ✅ CN сертификата = **просто** `<client_name>` (**БЕЗ** `project-<project_id>-` prefix)
- ✅ Все сертификаты подписываются **одним CA** (`nginx/ssl/ca-cert.pem`)
- ✅ Сертификаты **универсальные** - работают для всех проектов
- ✅ Project ID проверяется через другие поля (в теле запроса), не через CN

## Способ 1: Автоматически (Самый простой)

На сервере выполните:

```bash
cd /var/www/panel
python3 check_license.py
```

Скрипт автоматически создаст сертификаты для проекта с любым `client_name` (по умолчанию "test-client").

## Способ 2: Через скрипт с параметрами

```bash
cd /var/www/panel
./scripts/get_client_certs_for_android.sh <project_id> <любое_имя_клиента> <user_key>
```

**Примеры:**
```bash
# Любое имя клиента работает:
./scripts/get_client_certs_for_android.sh 2920317791 android YOUR_KEY
./scripts/get_client_certs_for_android.sh 2920317791 mobile YOUR_KEY
./scripts/get_client_certs_for_android.sh 2920317791 myapp YOUR_KEY
./scripts/get_client_certs_for_android.sh 2920317791 client-1 YOUR_KEY
```

**Параметры:**
- `<project_id>` - ID проекта (для CN prefix: `project-<project_id>-<client_name>`)
- `<любое_имя_клиента>` - **может быть любым** - "android", "mobile", "myapp", "client-1", etc.
- `<user_key>` - лицензионный ключ (опционально, если есть)

## Где найти созданные сертификаты?

После выполнения скрипта сертификаты будут здесь:

```
nginx/ssl/projects/<project_id>/clients/<любое_имя>/client-cert.pem
nginx/ssl/projects/<project_id>/clients/<любое_имя>/client-key.pem
```

**Пример:**
```
nginx/ssl/projects/2920317791/clients/android/client-cert.pem
nginx/ssl/projects/2920317791/clients/android/client-key.pem
```

## Что дальше?

1. **Скопируйте файлы** с сервера на ваш компьютер
2. **Установите в Android приложение** (см. `INSTALL_CERTIFICATES.md`)
3. **Обновите пути** в `main.cpp`:
   ```cpp
   constexpr const char* CLIENT_CERT_PATH = "/data/data/YOUR.PACKAGE.NAME/files/client-cert.pem";
   constexpr const char* CLIENT_KEY_PATH = "/data/data/YOUR.PACKAGE.NAME/files/client-key.pem";
   ```

## Важные моменты

1. **Имя клиента = CN сертификата** - используйте любое: "android", "mobile", "myapp"
2. **БЕЗ project_id в CN** - сертификаты универсальные, работают для всех проектов
3. **Все сертификаты подписаны единым CA** - не нужно создавать отдельный CA для каждого клиента
4. **Project ID проверяется через request data** - не через CN сертификата
5. **Сертификаты универсальные** - один сертификат работает для всех проектов

## Пример полной команды

```bash
# На сервере:
cd /var/www/panel

# Способ 1: Автоматически (проще всего)
python3 check_license.py

# Способ 2: С указанием параметров
./scripts/get_client_certs_for_android.sh 2920317791 android PUBG-12M-uUakzkGT5FQY

# Проверка созданных сертификатов
ls -la nginx/ssl/projects/2920317791/clients/android/

# Просмотр сертификата
openssl x509 -in nginx/ssl/projects/2920317791/clients/android/client-cert.pem -text -noout | grep "Subject:"
# Должно быть: Subject: CN = android (универсальный, без project_id prefix)
```

## Troubleshooting

### Ошибка: "CA certificate not configured"

Убедитесь, что единый CA создан:

```bash
cd /var/www/panel
./scripts/create_single_ca.sh
```

### Ошибка: "Certificate not signed by CA"

Убедитесь, что используется единый CA для подписания:

```bash
# Проверка CA
openssl x509 -in nginx/ssl/ca-cert.pem -text -noout | grep "Subject:"

# Проверка сертификата клиента
openssl x509 -in nginx/ssl/projects/<project_id>/clients/<client_name>/client-cert.pem -text -noout | grep "Issuer:"
```

Оба должны указывать на "Panel CA".

