#!/bin/bash

# Пример команд curl для создания проекта с project code
# Скопируйте и выполните команды вручную на сервере

SERVER_URL="http://localhost:5000"  # Замените на ваш URL сервера
COOKIE_FILE="/tmp/panel_cookies.txt"

# ============================================
# ШАГ 1: Логин и получение cookies
# ============================================
echo "Шаг 1: Логин"
curl -v -c "$COOKIE_FILE" -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "drads123", "password": "drads123"}'

# ============================================
# ШАГ 2: Получение CSRF токена
# ============================================
echo ""
echo "Шаг 2: Получение CSRF токена"
CSRF_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$SERVER_URL/api/auth/csrf-token" \
  -H "Content-Type: application/json")

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.csrf_token')
echo "CSRF Token: $CSRF_TOKEN"

# ============================================
# ШАГ 3: Получение project invite code
# ============================================
echo ""
echo "Шаг 3: Получение project invite code"
INVITE_CODE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$SERVER_URL/api/project-codes/latest" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF_TOKEN")

INVITE_CODE=$(echo "$INVITE_CODE_RESPONSE" | jq -r '.code')
echo "Invite Code: $INVITE_CODE"

# Если код не найден, создаем новый
if [ -z "$INVITE_CODE" ] || [ "$INVITE_CODE" = "null" ]; then
  echo "Создание нового project invite code..."
  CREATE_CODE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$SERVER_URL/api/project-codes" \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: $CSRF_TOKEN" \
    -d '{"expires_in_days": 30}')
  
  INVITE_CODE=$(echo "$CREATE_CODE_RESPONSE" | jq -r '.code')
  echo "Новый Invite Code: $INVITE_CODE"
fi

# ============================================
# ШАГ 4: Регистрация пользователя с project code
# ============================================
echo ""
echo "Шаг 4: Регистрация пользователя bankai123 с project code"
curl -v -X POST "$SERVER_URL/api/auth/register-with-invite" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"bankai123\",
    \"password\": \"bankai\",
    \"invite_code\": \"$INVITE_CODE\",
    \"project_name\": \"bankain\"
  }"

echo ""
echo "Готово!"
