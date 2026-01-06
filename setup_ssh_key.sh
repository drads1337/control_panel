#!/bin/bash
# Скрипт для настройки SSH ключа для GitHub
# Использование: bash setup_ssh_key.sh

set -e

EMAIL="${1:-abdikaiumov2197@gmail.com}"
KEY_FILE="${HOME}/.ssh/id_ed25519"

echo "🔑 Настройка SSH ключа для GitHub"
echo "📧 Email: $EMAIL"
echo ""

# Проверка существующего ключа
if [ -f "$KEY_FILE" ]; then
    echo "⚠️  SSH ключ уже существует: $KEY_FILE"
    read -p "Перезаписать? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Используем существующий ключ"
        cat "${KEY_FILE}.pub"
        echo ""
        echo "📋 Скопируйте публичный ключ выше и добавьте его в GitHub:"
        echo "   https://github.com/settings/ssh/new"
        exit 0
    fi
    rm -f "$KEY_FILE" "${KEY_FILE}.pub"
fi

# Создание директории .ssh если не существует
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Генерация SSH ключа
echo "🔨 Генерация SSH ключа..."
ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY_FILE" -N ""

# Отображение публичного ключа
echo ""
echo "✅ SSH ключ создан!"
echo ""
echo "📋 Ваш публичный ключ:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "${KEY_FILE}.pub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Следующие шаги:"
echo "   1. Скопируйте публичный ключ выше"
echo "   2. Откройте: https://github.com/settings/ssh/new"
echo "   3. Вставьте ключ и нажмите 'Add SSH key'"
echo ""
echo "🧪 Проверка подключения (после добавления ключа в GitHub):"
echo "   ssh -T git@github.com"
echo ""

