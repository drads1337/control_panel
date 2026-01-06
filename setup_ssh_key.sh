#!/bin/bash
# Скрипт для настройки SSH ключа на сервере
# Выполните на сервере

echo "🔑 Настройка SSH ключа для доступа к GitHub"
echo ""

# Генерация SSH ключа
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "📝 Генерация SSH ключа..."
    ssh-keygen -t ed25519 -C "server@ovrin.xyz" -f ~/.ssh/id_ed25519 -N ""
    echo "✅ SSH ключ создан"
else
    echo "✅ SSH ключ уже существует"
fi

# Вывод публичного ключа
echo ""
echo "📋 Публичный ключ (скопируйте и добавьте в GitHub):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat ~/.ssh/id_ed25519.pub
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Инструкция:"
echo "  1. Скопируйте ключ выше"
echo "  2. Перейдите на GitHub: https://github.com/settings/keys"
echo "  3. Нажмите 'New SSH key'"
echo "  4. Вставьте ключ и сохраните"
echo "  5. Затем выполните:"
echo "     git clone git@github.com:drads1337/control_panel.git /var/www/panel"
