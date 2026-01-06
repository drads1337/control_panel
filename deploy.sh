#!/bin/bash
# Универсальный скрипт развертывания
# Работает даже если DEPLOY_NOW.sh недоступен через curl
# Использование: curl -fsSL https://raw.githubusercontent.com/drads1337/control_panel/main/DEPLOY.sh | bash

set -e

BRANCH="${1:-develop}"
TMP_DIR="/tmp/panel-deploy-$$"

echo "🚀 Быстрое развертывание Panel на сервере"
echo "📦 Ветка: $BRANCH"
echo ""

# Очистка при выходе
trap "rm -rf $TMP_DIR" EXIT

# Попытка скачать через curl, если не получается - клонируем репозиторий
if curl -fsSL "https://raw.githubusercontent.com/drads1337/control_panel/$BRANCH/DEPLOY_NOW.sh" > "$TMP_DIR/deploy.sh" 2>/dev/null; then
    echo "✅ Скрипт загружен через curl"
    chmod +x "$TMP_DIR/deploy.sh"
    bash "$TMP_DIR/deploy.sh"
else
    echo "📥 Клонирование репозитория..."
    git clone -b "$BRANCH" https://github.com/drads1337/control_panel.git "$TMP_DIR" || {
        echo "⚠️  Ветка $BRANCH не найдена, пробуем main..."
        git clone -b main https://github.com/drads1337/control_panel.git "$TMP_DIR"
    }
    
    if [ -f "$TMP_DIR/DEPLOY_NOW.sh" ]; then
        echo "✅ Запуск DEPLOY_NOW.sh из репозитория"
        chmod +x "$TMP_DIR/DEPLOY_NOW.sh"
        bash "$TMP_DIR/DEPLOY_NOW.sh"
    else
        echo "❌ Файл DEPLOY_NOW.sh не найден в репозитории"
        exit 1
    fi
fi
