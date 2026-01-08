#!/bin/bash

# Скрипт для создания проекта напрямую через API (без регистрации пользователя)
# Использование: ./create_project_direct.sh [SERVER_URL]
# Пример: ./create_project_direct.sh https://example.com

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

# Файл для сохранения cookies
COOKIE_FILE="/tmp/panel_cookies.txt"

echo -e "${GREEN}=== Создание проекта через API ===${NC}"
echo "Server URL: $SERVER_URL"
echo ""

# Шаг 1: Логин и получение cookies
echo -e "${YELLOW}[1/3] Логин пользователя $LOGIN_USERNAME...${NC}"
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
echo -e "${YELLOW}[2/3] Получение CSRF токена...${NC}"
CSRF_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$SERVER_URL/api/auth/csrf-token" \
  -H "Content-Type: application/json")

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.csrf_token' 2>/dev/null)

if [ -z "$CSRF_TOKEN" ] || [ "$CSRF_TOKEN" = "null" ]; then
  echo -e "${RED}✗ Ошибка получения CSRF токена:${NC}"
  echo "$CSRF_RESPONSE" | jq '.' 2>/dev/null || echo "$CSRF_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ CSRF токен получен: ${CSRF_TOKEN:0:20}...${NC}"

# Шаг 3: Создание проекта
echo -e "${YELLOW}[3/3] Создание проекта '$NEW_PROJECT_NAME'...${NC}"
CREATE_PROJECT_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$SERVER_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -d "{
    \"name\": \"$NEW_PROJECT_NAME\",
    \"description\": \"Project created via API\",
    \"status\": \"active\"
  }")

# Проверка успешности создания проекта
if echo "$CREATE_PROJECT_RESPONSE" | grep -q "message.*successfully"; then
  echo -e "${GREEN}✓ Проект успешно создан!${NC}"
  echo ""
  echo -e "${GREEN}=== Результат ===${NC}"
  echo "$CREATE_PROJECT_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_PROJECT_RESPONSE"
else
  echo -e "${RED}✗ Ошибка создания проекта:${NC}"
  echo "$CREATE_PROJECT_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_PROJECT_RESPONSE"
  exit 1
fi

# Очистка временного файла
rm -f "$COOKIE_FILE"

echo ""
echo -e "${GREEN}=== Готово! ===${NC}"
echo "Проект '$NEW_PROJECT_NAME' создан"
