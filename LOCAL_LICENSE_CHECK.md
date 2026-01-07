# Локальная проверка лицензии

Скрипт `check_license.py` можно запускать локально для отправки запросов на `ovrin.xyz`.

## Требования

1. Python 3.8+
2. Установленные зависимости:
   ```bash
   pip install requests cryptography
   ```
3. OpenSSL (для генерации сертификатов)
4. JWT токен для доступа к API (для получения клиентского сертификата)

## Получение клиентского mTLS сертификата

### Способ 1: Автоматически с логином (рекомендуется) ⭐

Самый простой способ - скрипт автоматически логинится и получает сертификат:

```bash
python scripts/get_client_cert_auto.py <project_id> <username> <password> [client_name]
```

Примеры:
```bash
# С паролем в командной строке
python scripts/get_client_cert_auto.py 2920317791 admin@example.com mypassword

# Безопаснее - пароль запросится интерактивно
python scripts/get_client_cert_auto.py 2920317791 admin@example.com -

# С указанием имени клиента
python scripts/get_client_cert_auto.py 2920317791 admin@example.com mypassword my-client
```

Скрипт автоматически:
- ✅ Авторизуется на сервере
- ✅ Получает JWT токен
- ✅ Создает приватный ключ
- ✅ Генерирует CSR
- ✅ Отправляет CSR на сервер для подписания
- ✅ Сохраняет клиентский сертификат

### Способ 2: Вручную с JWT токеном

1. Получите JWT токен через веб-интерфейс (войдите в систему на `https://ovrin.xyz`)

2. Запустите скрипт для получения клиентского сертификата:
   ```bash
   python scripts/get_client_cert_local.py <project_id> <jwt_token> [client_name]
   ```
   
   Пример:
   ```bash
   python scripts/get_client_cert_local.py 2920317791 'eyJ0eXAiOiJKV1QiLCJhbGc...' my-client
   ```

3. Скрипт автоматически:
   - Создаст приватный ключ
   - Сгенерирует CSR
   - Отправит CSR на сервер для подписания
   - Сохранит клиентский сертификат в `./nginx/ssl/projects/<project_id>/clients/<client_name>/`

### Способ 2: Вручную через веб-интерфейс

1. Войдите в систему на `https://ovrin.xyz`
2. Перейдите в настройки проекта
3. Найдите раздел mTLS
4. Скачайте CA сертификат проекта
5. Сгенерируйте клиентский сертификат локально:
   ```bash
   # Создать директорию
   mkdir -p nginx/ssl/projects/2920317791/clients/local-client
   
   # Генерация ключа
   openssl genrsa -out nginx/ssl/projects/2920317791/clients/local-client/client-key.pem 2048
   
   # Генерация CSR
   openssl req -new -key nginx/ssl/projects/2920317791/clients/local-client/client-key.pem \
     -out nginx/ssl/projects/2920317791/clients/local-client/client.csr \
     -subj "/C=US/ST=CA/L=San Francisco/O=Panel/CN=project-2920317791-local-client"
   
   # Отправить CSR через API или веб-интерфейс для подписания
   ```

## Запуск проверки лицензии

После получения клиентского сертификата:

```bash
# Запуск проверки
python check_license.py
```

Скрипт автоматически:
- Найдет клиентские сертификаты в `./nginx/ssl/projects/<project_id>/clients/<client_name>/`
- Использует их для mTLS подключения к серверу
- Отправит запросы на `https://ovrin.xyz/api/challenge` и `/api/connect`

## Настройка

Вы можете изменить параметры в начале файла `check_license.py`:

```python
SERVER_URL = "https://ovrin.xyz"
USER_KEY = "PUBG-12M-uUakzkGT5FQY"
GAME_NAME = "PUBG"
PROJECT_ID = "2920317791"
CLIENT_NAME = "local-client"  # Или установите через переменную окружения: export MTLS_CLIENT_NAME=my-client
```

## Проверка работы

1. Убедитесь, что сертификаты на месте:
   ```bash
   ls -la nginx/ssl/projects/2920317791/clients/local-client/
   # Должны быть:
   # - client-key.pem (приватный ключ)
   # - client-cert.pem (клиентский сертификат)
   ```

2. Запустите проверку:
   ```bash
   python check_license.py
   ```

3. Ожидаемый результат:
   - `✓ ЛИЦЕНЗИЯ ДЕЙСТВИТЕЛЬНА!` - если лицензия валидна
   - `✓ КЛЮЧ НАЙДЕН НА СЕРВЕРЕ!` - если ключ существует
   - Ошибки mTLS - если сертификаты не найдены или неверны

## Устранение проблем

### Ошибка "Client certificate not provided"
- Убедитесь, что сертификаты созданы и находятся в правильной директории
- Проверьте имя клиента (`CLIENT_NAME`)

### Ошибка "mTLS validation failed"
- Проверьте, что сертификат подписан правильным CA проекта
- Убедитесь, что CN сертификата имеет формат `project-<project_id>-<client_name>`

### Ошибка подключения
- Проверьте, что `SERVER_URL` правильный
- Убедитесь, что сервер доступен: `curl https://ovrin.xyz/api/health/live`

