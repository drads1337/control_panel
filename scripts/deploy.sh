#!/bin/bash

# Скрипт автоматического деплоя для Panel Project
# Этот скрипт обновляет код из Git и перезапускает Docker контейнеры

set -e  # Остановка при ошибке

echo "🚀 Начало деплоя Panel Project..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Переменные (можно переопределить через окружение)
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$PROJECT_DIR"

echo -e "${YELLOW}📥 Обновление кода из Git...${NC}"
# Сохраняем текущую ветку
CURRENT_BRANCH=$(git branch --show-current)

# Переключаемся на нужную ветку и получаем обновления
git fetch origin
git checkout "$GIT_BRANCH"
git pull origin "$GIT_BRANCH"

echo -e "${YELLOW}🏗️  Сборка Docker образов...${NC}"
# Собираем образы
# Backend сервисы (можно использовать кеш для быстрой сборки)
docker compose build api celery_worker_default celery_worker_server celery_worker_keys flower
# Frontend и Nginx (собирается каждый раз для обновления фронтенда)
docker compose build nginx

echo -e "${YELLOW}📦 Сборка фронтенда...${NC}"
# Если нужно пересобрать фронтенд вне Docker (опционально)
# cd frontend && npm ci && npm run build:prod && cd ..

echo -e "${YELLOW}🔄 Перезапуск контейнеров...${NC}"
# Пересоздаем и перезапускаем контейнеры
docker compose up -d --force-recreate

echo -e "${YELLOW}⏳ Ожидание готовности сервисов...${NC}"
sleep 10

echo -e "${YELLOW}✅ Проверка статуса контейнеров...${NC}"
docker compose ps

echo -e "${YELLOW}📋 Проверка логов API...${NC}"
docker compose logs --tail=50 api

echo -e "${GREEN}✅ Деплой завершен успешно!${NC}"
echo -e "${GREEN}🌐 Приложение доступно по адресу: https://your-domain.com${NC}"

# Опционально: отправка уведомления (например, в Telegram или email)
# Можно добавить отправку уведомлений о статусе деплоя

