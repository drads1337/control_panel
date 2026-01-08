#!/bin/bash

# Скрипт для просмотра всех контейнеров и сертификатов на сервере

echo "=========================================="
echo "  ПРОСМОТР КОНТЕЙНЕРОВ И СЕРТИФИКАТОВ"
echo "=========================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Просмотр всех Docker контейнеров
echo -e "${BLUE}=== DOCKER КОНТЕЙНЕРЫ ===${NC}"
echo ""
echo "Все контейнеры (включая остановленные):"
docker ps -a
echo ""

echo "Только запущенные контейнеры:"
docker ps
echo ""

echo "Статус контейнеров через docker-compose:"
if [ -f "docker-compose.yml" ]; then
    docker-compose ps
else
    echo "Файл docker-compose.yml не найден в текущей директории"
fi
echo ""

# 2. Просмотр сертификатов в nginx/ssl
echo -e "${BLUE}=== СЕРТИФИКАТЫ В nginx/ssl ===${NC}"
echo ""
if [ -d "nginx/ssl" ]; then
    echo "Структура директории nginx/ssl:"
    find nginx/ssl -type f -name "*.pem" -o -name "*.crt" -o -name "*.key" -o -name "*.csr" -o -name "*.cert" 2>/dev/null | sort
    echo ""
    
    echo "Детальная информация о сертификатах:"
    echo ""
    for cert in $(find nginx/ssl -type f \( -name "*.pem" -o -name "*.crt" -o -name "*.cert" \) 2>/dev/null); do
        echo -e "${GREEN}Сертификат: $cert${NC}"
        if openssl x509 -in "$cert" -text -noout 2>/dev/null | head -20; then
            echo "---"
        else
            echo "Не удалось прочитать сертификат (возможно, это не X.509 сертификат)"
            echo "---"
        fi
        echo ""
    done
    
    # Просмотр проектных сертификатов
    if [ -d "nginx/ssl/projects" ]; then
        echo -e "${YELLOW}Проектные сертификаты:${NC}"
        find nginx/ssl/projects -type f 2>/dev/null | sort
        echo ""
    fi
else
    echo "Директория nginx/ssl не найдена"
fi
echo ""

# 3. Просмотр Let's Encrypt сертификатов
echo -e "${BLUE}=== LET'S ENCRYPT СЕРТИФИКАТЫ ===${NC}"
echo ""
if [ -d "letsencrypt/live" ]; then
    echo "Домены с Let's Encrypt сертификатами:"
    for domain_dir in letsencrypt/live/*/; do
        if [ -d "$domain_dir" ]; then
            domain=$(basename "$domain_dir")
            echo -e "${GREEN}Домен: $domain${NC}"
            if [ -f "$domain_dir/fullchain.pem" ]; then
                echo "  Сертификат: $domain_dir/fullchain.pem"
                openssl x509 -in "$domain_dir/fullchain.pem" -noout -subject -dates 2>/dev/null || echo "  Не удалось прочитать сертификат"
            fi
            if [ -f "$domain_dir/privkey.pem" ]; then
                echo "  Приватный ключ: $domain_dir/privkey.pem"
            fi
            echo ""
        fi
    done
elif [ -d "letsencrypt" ]; then
    echo "Структура директории letsencrypt:"
    find letsencrypt -type f -name "*.pem" -o -name "*.crt" -o -name "*.key" 2>/dev/null | head -20
    echo ""
    echo "Полная структура:"
    tree letsencrypt 2>/dev/null || find letsencrypt -type d | head -20
else
    echo "Директория letsencrypt не найдена"
fi
echo ""

# 4. Просмотр сертификатов внутри контейнеров
echo -e "${BLUE}=== СЕРТИФИКАТЫ В КОНТЕЙНЕРАХ ===${NC}"
echo ""
if docker ps --format "{{.Names}}" | grep -q "panel_nginx"; then
    echo "Сертификаты в контейнере nginx:"
    docker exec panel_nginx find /etc/nginx/ssl -type f 2>/dev/null | head -10 || echo "Не удалось получить доступ к контейнеру"
    echo ""
    docker exec panel_nginx find /etc/letsencrypt -type f -name "*.pem" 2>/dev/null | head -10 || echo "Не удалось получить доступ к контейнеру"
    echo ""
fi

# 5. Сводная информация
echo -e "${BLUE}=== СВОДНАЯ ИНФОРМАЦИЯ ===${NC}"
echo ""
echo "Количество контейнеров:"
echo "  Всего: $(docker ps -a --format '{{.Names}}' | wc -l | tr -d ' ')"
echo "  Запущено: $(docker ps --format '{{.Names}}' | wc -l | tr -d ' ')"
echo ""

echo "Количество сертификатов:"
echo "  В nginx/ssl: $(find nginx/ssl -type f \( -name "*.pem" -o -name "*.crt" -o -name "*.cert" \) 2>/dev/null | wc -l | tr -d ' ')"
if [ -d "letsencrypt/live" ]; then
    echo "  Let's Encrypt доменов: $(ls -d letsencrypt/live/*/ 2>/dev/null | wc -l | tr -d ' ')"
fi
echo ""

echo "=========================================="
echo "  ЗАВЕРШЕНО"
echo "=========================================="
