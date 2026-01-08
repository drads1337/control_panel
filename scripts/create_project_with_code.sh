#!/bin/bash

# Скрипт для создания проекта с project code через curl
# Использование: ./create_project_with_code.sh [SERVER_URL]
# Пример: ./create_project_with_code.sh https://example.com

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Параметры
SERVER_URL="${1:-http://localhost:5000}"
LOGIN_USERNAME="drads123"
LOGIN_PASSWORD="drads123"
NEW_PROJECT_NAME="bankain"
NEW_USERNAME="bankai123"
NEW_PASSWORD="bankai"

# Файл для сохранения cookies
COOKIE_FILE="/tmp/panel_cookies.txt"

echo -e "${GREEN}=== Создание проекта с project code ===${NC}"
echo "Server URL: $SERVER_URL"
echo ""

# Шаг 1: Логин и получение cookies
echo -e "${YELLOW}[1/4] Логин пользователя $LOGIN_USERNAME...${NC}"
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$LOGIN_USERNAME\", \"password\": \"$LOGIN_PASSWORD\"}")

# Проверка успешности логина
if echo "$LOGIN_RESPONSE" | grep -q "login_success.*true"; then
  echo -e "${GREEN}✓ Логин успешен${NC}"
else
  echo -e "${RED}✗ Ошибка логина:${NC}"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

# Шаг 2: Получение CSRF токена
echo -e "${YELLOW}[2/4] Получение CSRF токена...${NC}"
CSRF_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$SERVER_URL/api/auth/csrf-token" \
  -H "Content-Type: application/json")

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.csrf_token' 2>/dev/null)

if [ -z "$CSRF_TOKEN" ] || [ "$CSRF_TOKEN" = "null" ]; then
  echo -e "${RED}✗ Ошибка получения CSRF токена:${NC}"
  echo "$CSRF_RESPONSE" | jq '.' 2>/dev/null || echo "$CSRF_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ CSRF токен получен: ${CSRF_TOKEN:0:20}...${NC}"

# Шаг 3: Получение project invite code
echo -e "${YELLOW}[3/4] Получение project invite code...${NC}"
INVITE_CODE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$SERVER_URL/api/project-codes/latest" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF_TOKEN")

INVITE_CODE=$(echo "$INVITE_CODE_RESPONSE" | jq -r '.code' 2>/dev/null)

# Если код не найден, создаем новый
if [ -z "$INVITE_CODE" ] || [ "$INVITE_CODE" = "null" ]; then
  echo -e "${YELLOW}  Project invite code не найден, создаю новый...${NC}"
  CREATE_CODE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$SERVER_URL/api/project-codes" \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: $CSRF_TOKEN" \
    -d '{"expires_in_days": 30}')
  
  INVITE_CODE=$(echo "$CREATE_CODE_RESPONSE" | jq -r '.code' 2>/dev/null)
  
  if [ -z "$INVITE_CODE" ] || [ "$INVITE_CODE" = "null" ]; then
    echo -e "${RED}✗ Ошибка создания project invite code:${NC}"
    echo "$CREATE_CODE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_CODE_RESPONSE"
    exit 1
  fi
  echo -e "${GREEN}✓ Новый project invite code создан${NC}"
else
  echo -e "${GREEN}✓ Project invite code получен${NC}"
fi

echo -e "${GREEN}  Project Invite Code: $INVITE_CODE${NC}"

# Шаг 4: Регистрация нового пользователя с project code
echo -e "${YELLOW}[4/4] Регистрация пользователя $NEW_USERNAME с project code...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/register-with-invite" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$NEW_USERNAME\",
    \"password\": \"$NEW_PASSWORD\",
    \"invite_code\": \"$INVITE_CODE\",
    \"project_name\": \"$NEW_PROJECT_NAME\"
  }")

# Проверка успешности регистрации
if echo "$REGISTER_RESPONSE" | grep -q "message"; then
  echo -e "${GREEN}✓ Регистрация успешна!${NC}"
  echo ""
  echo -e "${GREEN}=== Результат ===${NC}"
  echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
else
  echo -e "${RED}✗ Ошибка регистрации:${NC}"
  echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
  exit 1
fi

# Очистка временного файла
rm -f "$COOKIE_FILE"

echo ""
echo -e "${GREEN}=== Готово! ===${NC}"
echo "Проект '$NEW_PROJECT_NAME' создан"
echo "Пользователь: $NEW_USERNAME"
echo "Пароль: $NEW_PASSWORD"
echo "Project Invite Code: $INVITE_CODE"
