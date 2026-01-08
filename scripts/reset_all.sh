#!/bin/bash

# Скрипт для полной очистки контейнеров и сертификатов с последующим пересозданием

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  ПОЛНАЯ ОЧИСТКА И ПЕРЕСОЗДАНИЕ"
echo "=========================================="
echo ""
echo -e "${RED}ВНИМАНИЕ: Этот скрипт удалит:${NC}"
echo "  - Все Docker контейнеры"
echo "  - Все сертификаты в nginx/ssl"
echo "  - Все Let's Encrypt сертификаты (опционально)"
echo ""
read -p "Продолжить? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 0
fi

echo ""
echo -e "${BLUE}=== ШАГ 1: ОСТАНОВКА И УДАЛЕНИЕ КОНТЕЙНЕРОВ ===${NC}"
echo ""

# Остановка всех контейнеров
if [ -f "docker-compose.yml" ]; then
    echo "Остановка контейнеров через docker-compose..."
    docker-compose down || true
    echo "✓ Контейнеры остановлены"
else
    echo "Остановка всех контейнеров проекта..."
    docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker stop || true
    docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker rm || true
    echo "✓ Контейнеры остановлены и удалены"
fi

# Удаление всех контейнеров проекта
echo "Удаление всех контейнеров проекта..."
docker ps -a --filter "name=panel_" --format "{{.Names}}" | xargs -r docker rm -f || true
echo "✓ Все контейнеры удалены"

echo ""
echo -e "${BLUE}=== ШАГ 2: УДАЛЕНИЕ СЕРТИФИКАТОВ ===${NC}"
echo ""

# Удаление сертификатов в nginx/ssl
if [ -d "nginx/ssl" ]; then
    echo "Удаление сертификатов в nginx/ssl..."
    rm -rf nginx/ssl/*
    echo "✓ Сертификаты в nginx/ssl удалены"
else
    echo "Директория nginx/ssl не найдена, создаю..."
    mkdir -p nginx/ssl
fi

# Опциональное удаление Let's Encrypt сертификатов
read -p "Удалить Let's Encrypt сертификаты? (yes/no): " delete_letsencrypt
if [ "$delete_letsencrypt" = "yes" ]; then
    if [ -d "letsencrypt" ]; then
        echo "Удаление Let's Encrypt сертификатов..."
        rm -rf letsencrypt/*
        echo "✓ Let's Encrypt сертификаты удалены"
    else
        echo "Директория letsencrypt не найдена"
    fi
else
    echo "Let's Encrypt сертификаты сохранены"
fi

echo ""
echo -e "${BLUE}=== ШАГ 3: СОЗДАНИЕ БАЗОВЫХ СЕРТИФИКАТОВ ===${NC}"
echo ""

# Создание базового CA сертификата
if [ -f "scripts/create_single_ca.sh" ]; then
    echo "Создание базового CA сертификата..."
    bash scripts/create_single_ca.sh
    echo "✓ Базовый CA сертификат создан"
else
    echo "⚠ Скрипт create_single_ca.sh не найден, пропускаю создание CA"
fi

# Создание ca-bundle.pem (копия ca-cert.pem)
if [ -f "nginx/ssl/ca-cert.pem" ]; then
    echo "Создание ca-bundle.pem..."
    cp nginx/ssl/ca-cert.pem nginx/ssl/ca-bundle.pem
    chmod 644 nginx/ssl/ca-bundle.pem
    echo "✓ ca-bundle.pem создан"
fi

echo ""
echo -e "${BLUE}=== ШАГ 4: ПЕРЕСОЗДАНИЕ КОНТЕЙНЕРОВ ===${NC}"
echo ""

# Пересоздание контейнеров
if [ -f "docker-compose.yml" ]; then
    echo "Пересоздание контейнеров..."
    docker-compose up -d --build
    echo "✓ Контейнеры пересозданы"
    
    echo ""
    echo "Ожидание запуска контейнеров..."
    sleep 5
    
    echo ""
    echo "Статус контейнеров:"
    docker-compose ps
else
    echo "⚠ Файл docker-compose.yml не найден"
fi

echo ""
echo -e "${BLUE}=== ШАГ 5: ПРОВЕРКА ===${NC}"
echo ""

# Проверка контейнеров
echo "Запущенные контейнеры:"
docker ps --filter "name=panel_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Сертификаты в nginx/ssl:"
find nginx/ssl -type f 2>/dev/null | head -10 || echo "Сертификаты не найдены"

echo ""
echo -e "${GREEN}=========================================="
echo "  ОЧИСТКА И ПЕРЕСОЗДАНИЕ ЗАВЕРШЕНО"
echo "==========================================${NC}"
echo ""
echo "Следующие шаги:"
echo "  1. Если нужно, получите Let's Encrypt сертификаты:"
echo "     docker-compose run --rm certbot certonly --webroot ..."
echo ""
echo "  2. Проверьте статус контейнеров:"
echo "     docker-compose ps"
echo ""
echo "  3. Проверьте логи, если есть проблемы:"
echo "     docker-compose logs"
