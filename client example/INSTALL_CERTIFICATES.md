# Инструкция: Как получить и установить клиентские сертификаты

## Где взять сертификаты?

Клиентские сертификаты (`client-cert.pem` и `client-key.pem`) создаются **на сервере** и должны быть скопированы в ваше Android приложение.

**ВАЖНО:** **Универсальные сертификаты** - единый CA для всех клиентов.
- ✅ CN может быть **любым** - "android", "mobile", "my-app", "client-1" и т.д.
- ✅ **БЕЗ project_id в CN** - сертификаты универсальные для всех проектов
- ✅ Все сертификаты подписываются **одним CA** (`nginx/ssl/ca-cert.pem`)
- ✅ Project ID проверяется через другие поля (в теле запроса), не через CN

## Способ 1: Автоматически через скрипт (Рекомендуется)

**ВАЖНО:** Используется **единый CA для всех клиентов** (упрощенная конфигурация).
`client_name` может быть любым - главное правильный `project_id` для CN prefix.

На сервере выполните:

```bash
cd /var/www/panel
# Способ 1: Основной скрипт (автоматически создаст сертификаты)
python3 check_license.py

# Способ 2: Специальный скрипт для Android (опционально)
./scripts/get_client_certs_for_android.sh <project_id> <client_name> <user_key>
```

**Параметры:**
- `<project_id>` - ID проекта (используется только для организации файлов, **НЕ в CN**)
- `<client_name>` - **CN сертификата** (может быть "android", "mobile", "my-app" и т.д.)
- `<user_key>` - лицензионный ключ для авторизации (опционально, если есть)

**Примеры CN (универсальные, без project_id):**
- `android` - CN = "android"
- `mobile` - CN = "mobile"  
- `my-app` - CN = "my-app"

**ВАЖНО:** CN = просто `<client_name>`, **БЕЗ** `project-<project_id>-` prefix!

Сертификаты будут созданы автоматически в:
- `nginx/ssl/projects/<project_id>/clients/<client_name>/client-cert.pem`
- `nginx/ssl/projects/<project_id>/clients/<client_name>/client-key.pem`

**Все сертификаты подписываются единым CA** (`nginx/ssl/ca-cert.pem`)

## Способ 2: Через API автоматически (для клиента)

Если у вас есть `user_key`, клиент может автоматически запросить сертификаты:

```http
POST https://ovrin.xyz/api/projects/<project_id>/mtls/csr-sign-public
Content-Type: application/json

{
  "user_key": "YOUR-LICENSE-KEY",
  "csr_pem": "-----BEGIN CERTIFICATE REQUEST-----\n...",
  "client_name": "android-client"
}
```

Сервер вернет:
```json
{
  "certificate": "-----BEGIN CERTIFICATE-----\n...",
  "ca_certificate": "-----BEGIN CERTIFICATE-----\n...",
  "fingerprint": "..."
}
```

## Способ 3: Вручную на сервере

На сервере создайте сертификаты:

```bash
cd /var/www/panel

# Параметры (можно использовать любые значения):
PROJECT_ID="2920317791"  # ID вашего проекта
CLIENT_NAME="android"    # ЛЮБОЕ имя - "android", "mobile", "my-app" и т.д.

mkdir -p nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME

# 1. Генерируем приватный ключ
openssl genrsa -out nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-key.pem 2048
chmod 600 nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-key.pem

# 2. Создаем CSR (Certificate Signing Request)
# ВАЖНО: CN = просто client_name (универсальный, БЕЗ project_id prefix)
# client_name может быть любым - "android", "mobile", "myapp" и т.д.
openssl req -new -key nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-key.pem \
  -out nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client.csr \
  -subj "/C=US/ST=CA/O=Panel/CN=$CLIENT_NAME"

# 3. Подписываем CSR единым CA (используется один CA для всех клиентов)
openssl x509 -req -days 365 \
  -in nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client.csr \
  -CA nginx/ssl/ca-cert.pem \
  -CAkey nginx/ssl/ca-key.pem \
  -CAcreateserial \
  -out nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-cert.pem \
  -extensions v3_req -extfile <(echo -e "[v3_req]\nkeyUsage = digitalSignature, keyEncipherment\nextendedKeyUsage = clientAuth")
chmod 644 nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-cert.pem

echo "✓ Сертификаты созданы:"
echo "  Cert: nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-cert.pem"
echo "  Key: nginx/ssl/projects/$PROJECT_ID/clients/$CLIENT_NAME/client-key.pem"
```

**Важно:** 
- `CLIENT_NAME` может быть **любым** - "android", "mobile", "my-app", "client-1" и т.д.
- Все сертификаты подписываются **единым CA** (`ca-cert.pem`)
- Главное - правильный CN: `project-<project_id>-<client_name>`

## Как установить в Android приложение

### Вариант 1: Через внутреннее хранилище (Рекомендуется)

1. **Скопируйте файлы** `client-cert.pem` и `client-key.pem` с сервера на ваш компьютер

2. **В Android Studio** создайте папку `assets` в `src/main/` (если её нет)

3. **Поместите сертификаты** в папку `src/main/assets/`:
   ```
   src/main/assets/client-cert.pem
   src/main/assets/client-key.pem
   ```

4. **В Java/Kotlin коде** при первом запуске скопируйте из assets во внутреннее хранилище:

```java
// Java пример
public void copyCertificatesFromAssets() {
    String[] files = {"client-cert.pem", "client-key.pem"};
    File filesDir = getFilesDir();
    
    for (String filename : files) {
        try {
            InputStream in = getAssets().open(filename);
            File outFile = new File(filesDir, filename);
            FileOutputStream out = new FileOutputStream(outFile);
            
            byte[] buffer = new byte[1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            
            in.close();
            out.close();
            Log.i("Certificates", "Copied " + filename);
        } catch (IOException e) {
            Log.e("Certificates", "Failed to copy " + filename, e);
        }
    }
}
```

```kotlin
// Kotlin пример
fun copyCertificatesFromAssets() {
    val files = listOf("client-cert.pem", "client-key.pem")
    val filesDir = filesDir
    
    files.forEach { filename ->
        try {
            assets.open(filename).use { input ->
                File(filesDir, filename).outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            Log.i("Certificates", "Copied $filename")
        } catch (e: IOException) {
            Log.e("Certificates", "Failed to copy $filename", e)
        }
    }
}
```

5. **Обновите package name** в `main.cpp`:
```cpp
constexpr const char* CLIENT_CERT_PATH = "/data/data/com.your.package.name/files/client-cert.pem";
constexpr const char* CLIENT_KEY_PATH = "/data/data/com.your.package.name/files/client-key.pem";
```

### Вариант 2: Прямо во внутреннем хранилище (для отладки)

Для тестирования можно напрямую скопировать файлы через ADB:

```bash
# С сервера скопируйте файлы на компьютер, затем:
adb push client-cert.pem /data/data/com.your.package.name/files/
adb push client-key.pem /data/data/com.your.package.name/files/
```

### Вариант 3: Через сервер при установке

Если у вас есть серверная часть приложения, можно скачать сертификаты при первом запуске через HTTPS API.

## Проверка

После установки проверьте, что файлы на месте:

```bash
adb shell
run-as com.your.package.name
ls -la files/
# Должны увидеть client-cert.pem и client-key.pem
```

## Важные моменты

1. **CN (Common Name)** в сертификате может быть **любым** (универсальный сертификат)
   - Пример: `android`, `mobile`, `my-app`, `client-1`
   - **БЕЗ** `project-<project_id>-` prefix - сертификаты универсальные
   - Project ID проверяется через другие поля (в теле запроса), не через CN

2. **Безопасность**: 
   - В production используйте Android Keystore для хранения приватного ключа
   - Никогда не коммитьте сертификаты в git
   - Используйте ProGuard/R8 для обфускации путей

3. **Обновление**: 
   - Сертификаты действительны 1 год (по умолчанию)
   - Реализуйте автоматическое обновление через API

4. **Package name**: Замените `com.yourpackage.app` на реальный package name вашего приложения

## Примеры путей для популярных package names

```cpp
// com.example.myapp
constexpr const char* CLIENT_CERT_PATH = "/data/data/com.example.myapp/files/client-cert.pem";
constexpr const char* CLIENT_KEY_PATH = "/data/data/com.example.myapp/files/client-key.pem";

// com.yourcompany.licensecheck
constexpr const char* CLIENT_CERT_PATH = "/data/data/com.yourcompany.licensecheck/files/client-cert.pem";
constexpr const char* CLIENT_KEY_PATH = "/data/data/com.yourcompany.licensecheck/files/client-key.pem";
```

## Troubleshooting

### Ошибка: "Client certificate required" (403)
- Проверьте, что файлы существуют по указанным путям
- Проверьте права доступа (должны быть читаемы)
- Проверьте формат файлов (должны быть PEM)

### Ошибка: "Certificate verification failed"
- Проверьте CN сертификата (должен начинаться с `project-<project_id>-`)
- Убедитесь, что сертификат подписан единым CA
- Проверьте, что CA сертификат существует на сервере

### Файлы не копируются из assets
- Проверьте, что файлы действительно в `src/main/assets/`
- Проверьте имя файлов (чувствительно к регистру)
- Проверьте логи приложения на ошибки копирования

