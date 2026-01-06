# Быстрый запуск после сборки образов

## Проблема
Образы собраны (`docker compose build` завершен), но домен не работает.

## Решение

### Вариант 1: Использовать готовый скрипт (рекомендуется)

```bash
cd /var/www/panel
./start_containers.sh
```

### Вариант 2: Запустить вручную

```bash
cd /var/www/panel

# Проверьте наличие .env файла
ls -la .env

# Запустите контейнеры с production конфигурацией
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Проверьте статус
docker compose ps

# Проверьте логи
docker compose logs -f nginx
```

## Диагностика проблем

### 1. Проверка статуса контейнеров
```bash
docker compose ps
```

Все контейнеры должны быть в статусе "Up".

### 2. Проверка портов
```bash
# Проверка порта 80
netstat -tuln | grep ":80 " || ss -tuln | grep ":80 "

# Проверка порта 443
netstat -tuln | grep ":443 " || ss -tuln | grep ":443 "
```

### 3. Проверка DNS
```bash
# Проверка A-записи для домена
nslookup ovrin.xyz
# или
dig ovrin.xyz +short
```

A-запись должна указывать на IP вашего сервера.

### 4. Проверка файрвола
```bash
# Ubuntu/Debian
sudo ufw status

# CentOS/RHEL
sudo firewall-cmd --list-all
```

Порты 80 и 443 должны быть открыты.

### 5. Проверка логов
```bash
# Логи nginx
docker compose logs -f nginx

# Логи API
docker compose logs -f api

# Все логи
docker compose logs -f
```

### 6. Проверка локальной доступности
```bash
# HTTP (должен редиректить на HTTPS)
curl -I http://localhost

# HTTPS
curl -k -I https://localhost
```

## Частые проблемы

### Проблема: Контейнеры не запускаются
**Решение:**
```bash
# Проверьте логи
docker compose logs

# Проверьте .env файл
cat .env

# Перезапустите
docker compose down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Проблема: Порт 80/443 уже занят
**Решение:**
```bash
# Найдите процесс, использующий порт
sudo lsof -i :80
sudo lsof -i :443

# Если это внешний nginx, настройте его для проксирования к Docker
# Или остановите его и используйте nginx из Docker
```

### Проблема: DNS не настроен
**Решение:**
1. Зайдите в панель управления вашего домена
2. Добавьте A-запись:
   - Имя: `@` (или `ovrin.xyz`)
   - Значение: IP вашего сервера
   - TTL: 3600

### Проблема: SSL сертификаты отсутствуют
**Решение:**
```bash
cd /var/www/panel
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz"
```

## Полная диагностика

Используйте скрипт для полной диагностики:
```bash
cd /var/www/panel
./check_and_start.sh
```

## Полезные команды

```bash
# Просмотр статуса
docker compose ps

# Просмотр логов
docker compose logs -f [service_name]

# Перезапуск сервиса
docker compose restart [service_name]

# Остановка всех контейнеров
docker compose down

# Пересборка и перезапуск
docker compose build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

