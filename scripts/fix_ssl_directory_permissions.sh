#!/bin/bash
# Исправление прав доступа для SSL директорий

set -e

cd "$(dirname "$0")/.."

echo "Создание структуры директорий для mTLS сертификатов..."

# Создаем директории на хосте с правильными правами
mkdir -p nginx/ssl/projects
mkdir -p nginx/ssl

# Устанавливаем права доступа (775 для записи всем в группе)
chmod -R 775 nginx/ssl

# Пытаемся изменить владельца (может не работать без sudo)
chown -R $(id -u):$(id -g) nginx/ssl 2>/dev/null || {
    echo "⚠️  Не удалось изменить владельца (нужны права root)"
    echo "   Используйте: sudo chown -R \$(id -u):\$(id -g) nginx/ssl"
}

echo "✅ Директории созданы:"
echo "   - nginx/ssl/projects"
echo ""

# Проверяем права доступа
echo "Проверка прав доступа:"
ls -ld nginx/ssl 2>/dev/null || echo "Директория не существует"
ls -ld nginx/ssl/projects 2>/dev/null || echo "Директория не существует"

echo ""
echo "Если возникают ошибки прав доступа, выполните:"
echo "  sudo chmod -R 777 nginx/ssl  # Временное решение"
echo "  sudo chown -R root:root nginx/ssl  # Или установите правильного владельца"
echo ""
echo "Теперь можно создать CA для проекта:"
echo "docker-compose exec api python -c \"...\""

