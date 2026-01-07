#!/bin/bash
# Исправление прав доступа для SSL директорий

set -e

cd "$(dirname "$0")/.."

echo "Создание структуры директорий для mTLS сертификатов..."

# Создаем директории на хосте
mkdir -p nginx/ssl/projects
mkdir -p nginx/ssl

# Устанавливаем правильные права доступа
chmod -R 755 nginx/ssl
chown -R $(id -u):$(id -g) nginx/ssl 2>/dev/null || true

echo "✅ Директории созданы:"
echo "   - nginx/ssl/projects"
echo ""

# Проверяем права доступа
echo "Проверка прав доступа:"
ls -ld nginx/ssl 2>/dev/null || echo "Директория не существует"
ls -ld nginx/ssl/projects 2>/dev/null || echo "Директория не существует"

echo ""
echo "Теперь можно создать CA для проекта:"
echo "docker-compose exec api python -c \"...\""

