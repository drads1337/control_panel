# Команды curl для создания проекта с project code

Выполняйте команды по порядку на сервере. Замените `YOUR_SERVER_URL` на адрес вашего сервера.

---

## ШАГ 1: Логин и получение cookies

```bash
curl -c /tmp/panel_cookies.txt -X POST "YOUR_SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "drads123", "password": "drads123"}'
```

**Ожидаемый результат:** JSON с `"login_success": true`

---

## ШАГ 2: Получение CSRF токена

```bash
curl -b /tmp/panel_cookies.txt -X GET "YOUR_SERVER_URL/api/auth/csrf-token" \
  -H "Content-Type: application/json"
```

**Ожидаемый результат:** JSON вида `{"csrf_token": "abc123-def456-..."}`

**⚠️ ВАЖНО:** Скопируйте значение `csrf_token` из ответа и замените `CSRF_TOKEN_HERE` в следующих командах!

---

## ШАГ 3: Получение project invite code

```bash
curl -b /tmp/panel_cookies.txt -X GET "YOUR_SERVER_URL/api/project-codes/latest" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: CSRF_TOKEN_HERE"
```

**Ожидаемый результат:** JSON вида `{"code": "ABC123XYZ", ...}`

**Если код не найден (null), создайте новый:**

```bash
curl -b /tmp/panel_cookies.txt -X POST "YOUR_SERVER_URL/api/project-codes" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: CSRF_TOKEN_HERE" \
  -d '{"expires_in_days": 30}'
```

**⚠️ ВАЖНО:** Скопируйте значение `code` из ответа и замените `INVITE_CODE_HERE` в следующей команде!

---

## ШАГ 4: Регистрация пользователя с project code

```bash
curl -X POST "YOUR_SERVER_URL/api/auth/register-with-invite" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bankai123",
    "password": "bankai",
    "invite_code": "INVITE_CODE_HERE",
    "project_name": "bankain"
  }'
```

**Ожидаемый результат:** JSON с сообщением об успешной регистрации

---

## ✅ Готово!

Проект **bankain** создан:
- **Пользователь:** bankai123
- **Пароль:** bankai
- **Project Invite Code:** (использован из шага 3)

---

## Пример с реальными значениями

Если ваш сервер: `https://example.com`
CSRF токен: `abc123-def456-ghi789`
Invite код: `XYZ123ABC`

То команды будут выглядеть так:

```bash
# Шаг 1
curl -c /tmp/panel_cookies.txt -X POST "https://example.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "drads123", "password": "drads123"}'

# Шаг 2
curl -b /tmp/panel_cookies.txt -X GET "https://example.com/api/auth/csrf-token" \
  -H "Content-Type: application/json"

# Шаг 3
curl -b /tmp/panel_cookies.txt -X GET "https://example.com/api/project-codes/latest" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: abc123-def456-ghi789"

# Шаг 4
curl -X POST "https://example.com/api/auth/register-with-invite" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bankai123",
    "password": "bankai",
    "invite_code": "XYZ123ABC",
    "project_name": "bankain"
  }'
```
