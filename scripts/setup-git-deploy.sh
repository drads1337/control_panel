#!/bin/bash

# Скрипт настройки автоматического деплоя через Git hook
# Запустите этот скрипт на сервере для настройки автоматического деплоя

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Настройка автоматического деплоя через Git...${NC}"

# Вопросы для настройки
read -p "Путь к проекту на сервере (например: /opt/panel): " DEPLOY_DIR
read -p "Путь к bare Git репозиторию (например: /opt/panel.git): " GIT_REPO_DIR

if [ -z "$DEPLOY_DIR" ] || [ -z "$GIT_REPO_DIR" ]; then
    echo -e "${RED}❌ Ошибка: необходимо указать оба пути${NC}"
    exit 1
fi

# Создаем bare репозиторий если его нет
if [ ! -d "$GIT_REPO_DIR" ]; then
    echo -e "${YELLOW}📦 Создание bare репозитория...${NC}"
    mkdir -p "$GIT_REPO_DIR"
    git init --bare "$GIT_REPO_DIR"
fi

# Копируем post-receive hook
HOOK_FILE="$GIT_REPO_DIR/hooks/post-receive"
if [ -f "scripts/post-receive" ]; then
    cp scripts/post-receive "$HOOK_FILE"
    # Заменяем путь к проекту в hook
    sed -i "s|DEPLOY_DIR=\"/path/to/panel\"|DEPLOY_DIR=\"$DEPLOY_DIR\"|g" "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    echo -e "${GREEN}✅ Git hook установлен${NC}"
else
    echo -e "${RED}❌ Файл scripts/post-receive не найден${NC}"
    exit 1
fi

# Инициализируем Git в директории проекта если нужно
if [ ! -d "$DEPLOY_DIR/.git" ]; then
    echo -e "${YELLOW}📦 Инициализация Git в директории проекта...${NC}"
    cd "$DEPLOY_DIR"
    git init
    git remote add origin "$GIT_REPO_DIR" || true
    git add .
    git commit -m "Initial commit" || true
else
    # Добавляем remote если его нет
    cd "$DEPLOY_DIR"
    git remote remove origin 2>/dev/null || true
    git remote add origin "$GIT_REPO_DIR"
    echo -e "${GREEN}✅ Git remote настроен${NC}"
fi

echo ""
echo -e "${GREEN}✅ Настройка завершена!${NC}"
echo ""
echo -e "${YELLOW}📝 Для использования автоматического деплоя:${NC}"
echo -e "1. На вашем локальном компьютере добавьте remote:"
echo -e "   ${GREEN}git remote add production user@server:$GIT_REPO_DIR${NC}"
echo ""
echo -e "2. Для деплоя делайте push:"
echo -e "   ${GREEN}git push production main${NC}"
echo ""
echo -e "3. После каждого push сервер автоматически обновит код и перезапустит контейнеры"

