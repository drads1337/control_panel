#!/bin/bash
# Скрипт для автоматического развертывания на сервере
# Использование: ./deploy_to_server.sh

SERVER_IP="38.242.149.188"
SERVER_USER="root"
SERVER_PASS="elbek2197"
PROJECT_DIR="/var/www/panel"
GIT_REPO="https://github.com/drads1337/control_panel.git"
BRANCH="develop"

echo "🚀 Развертывание проекта на сервере $SERVER_IP"
echo ""

# Функция для выполнения команд на сервере
ssh_exec() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SERVER_USER@$SERVER_IP" "$1"
}

# Проверка установки sshpass
if ! command -v sshpass &> /dev/null; then
    echo "📦 Установка sshpass..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass 2>/dev/null || echo "⚠️  Установите sshpass: brew install hudochenkov/sshpass/sshpass"
    else
        sudo apt-get update && sudo apt-get install -y sshpass 2>/dev/null || echo "⚠️  Установите sshpass: sudo apt-get install sshpass"
    fi
fi

echo "🔌 Подключение к серверу..."
if ! ssh_exec "echo 'Connected'" &>/dev/null; then
    echo "❌ Не удалось подключиться к серверу"
    echo "📝 Выполните вручную на сервере:"
    echo ""
    echo "mkdir -p $PROJECT_DIR"
    echo "cd $PROJECT_DIR"
    echo "git clone -b $BRANCH $GIT_REPO ."
    echo "chmod +x deploy.sh"
    echo "./deploy.sh $BRANCH"
    exit 1
fi

echo "✅ Подключение установлено"

# Проверка Docker
echo "🐳 Проверка Docker..."
if ! ssh_exec "docker --version" &>/dev/null; then
    echo "⚠️  Docker не установлен. Установка..."
    ssh_exec "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
fi

# Проверка Docker Compose
echo "🐳 Проверка Docker Compose..."
if ! ssh_exec "docker-compose --version" &>/dev/null; then
    echo "⚠️  Docker Compose не установлен. Установка..."
    ssh_exec "curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose"
fi

# Создание директории проекта
echo "📁 Настройка директории проекта..."
ssh_exec "mkdir -p $PROJECT_DIR"

# Клонирование/обновление репозитория
echo "📥 Клонирование репозитория..."
if ssh_exec "cd $PROJECT_DIR && [ -d .git ]" &>/dev/null; then
    echo "  Обновление существующего репозитория..."
    ssh_exec "cd $PROJECT_DIR && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH"
else
    echo "  Клонирование нового репозитория..."
    ssh_exec "cd $PROJECT_DIR && git clone -b $BRANCH $GIT_REPO ."
fi

# Проверка .env файла
echo "🔐 Проверка .env файла..."
if ! ssh_exec "cd $PROJECT_DIR && [ -f .env ]" &>/dev/null; then
    echo "⚠️  Файл .env не найден!"
    echo "📝 Создайте .env файл на сервере с необходимыми переменными"
    echo "   См. SERVER_SETUP.md для списка переменных"
    echo ""
    echo "Выполните на сервере:"
    echo "  cd $PROJECT_DIR"
    echo "  nano .env"
    exit 1
fi

# Запуск развертывания
echo "🚀 Запуск развертывания..."
ssh_exec "cd $PROJECT_DIR && chmod +x deploy.sh && ./deploy.sh $BRANCH"

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "🌐 Проверьте статус:"
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $PROJECT_DIR && docker-compose ps'"

