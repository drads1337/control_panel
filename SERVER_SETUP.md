# Инструкция по развертыванию на сервере

## Предварительные требования

1. **Сервер с установленным Docker и Docker Compose**
   ```bash
   # Установка Docker (Ubuntu/Debian)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Установка Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Git установлен на сервере**
   ```bash
   sudo apt-get update
   sudo apt-get install git -y
   ```

3. **Открытые порты**
   - 80 (HTTP)
   - 443 (HTTPS)
   - 5001 (API, опционально, если нужен прямой доступ)
   - 5432 (PostgreSQL, опционально, только для локального доступа)

## Настройка Git на сервере

### 1. Клонирование репозитория

```bash
# Создание директории для проекта
sudo mkdir -p /var/www/panel
sudo chown $USER:$USER /var/www/panel

# Клонирование репозитория
cd /var/www/panel
git clone https://github.com/drads1337/control_panel.git .

# Создание ветки develop (если еще не создана)
git checkout -b develop
git push -u origin develop
```

### 2. Настройка веток

```bash
# Основная ветка (production)
git checkout main

# Ветка разработки
git checkout develop
```

## Настройка переменных окружения

### 1. Создание .env файла

```bash
cd /var/www/panel
cp .env.example .env  # Если есть пример
nano .env
```

### 2. Необходимые переменные

```env
# Database
POSTGRES_DB=panel
POSTGRES_USER=panel_user
POSTGRES_PASSWORD=<сгенерируйте_безопасный_пароль>
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=<сгенерируйте_безопасный_пароль>
REDIS_PORT=6380

# Flask
SECRET_KEY=<сгенерируйте_безопасный_ключ>
FLASK_ENV=production
FLASK_DEBUG=0

# Security Keys (сгенерируйте через: python -c "import secrets; print(secrets.token_hex(32))")
PANEL_MASTER_KEY=<64_символа_hex>
JWT_SECRET_KEY=<сгенерируйте_безопасный_ключ>
TOKEN_STATIC_WORD=<сгенерируйте_безопасный_ключ>
OFFLINE_TICKET_SECRET=<сгенерируйте_безопасный_ключ>
PROJECT_MASTER_KEY=<64_символа_hex>

# Frontend
FRONTEND_URL=https://ovrin.xyz
CORS_ORIGINS=https://ovrin.xyz,https://www.ovrin.xyz

# API Port
API_PORT=5001

# Nginx Ports
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# Flower
FLOWER_PORT=5555
FLOWER_BASIC_AUTH=admin:<сгенерируйте_пароль>
```

### 3. Генерация безопасных ключей

```bash
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('PANEL_MASTER_KEY=' + secrets.token_hex(32))"
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('TOKEN_STATIC_WORD=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('OFFLINE_TICKET_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('REDIS_PASSWORD=' + secrets.token_urlsafe(16))"
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(16))"
```

## Развертывание

### Автоматическое развертывание (рекомендуется)

```bash
cd /var/www/panel
chmod +x deploy.sh
sudo ./deploy.sh main    # Для production
# или
sudo ./deploy.sh develop # Для development
```

### Ручное развертывание

```bash
cd /var/www/panel

# Выбор ветки
git checkout main  # или develop
git pull origin main

# Создание SSL сертификатов (если нужно)
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz"

# Сборка и запуск
docker-compose down
docker-compose build
docker-compose up -d

# Применение миграций
docker-compose exec api python -c "
from backend.core.app import create_app
from flask_migrate import upgrade
import os
os.chdir('/app/backend')
app = create_app()
app.app_context().push()
upgrade()
"
```

## Обновление проекта

### Обновление из ветки main (production)

```bash
cd /var/www/panel
git checkout main
git pull origin main
sudo ./deploy.sh main
```

### Обновление из ветки develop (development)

```bash
cd /var/www/panel
git checkout develop
git pull origin develop
sudo ./deploy.sh develop
```

## Управление контейнерами

```bash
cd /var/www/panel

# Просмотр статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f
docker-compose logs -f api
docker-compose logs -f nginx

# Перезапуск сервисов
docker-compose restart
docker-compose restart api

# Остановка
docker-compose stop

# Запуск
docker-compose start

# Полная остановка и удаление
docker-compose down

# Остановка с удалением volumes (⚠️ удалит данные!)
docker-compose down -v
```

## Резервное копирование базы данных

```bash
# Создание бэкапа
docker-compose exec postgres pg_dump -U panel_user panel > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
docker-compose exec -T postgres psql -U panel_user panel < backup_20260106_120000.sql
```

## Мониторинг

```bash
# Использование ресурсов
docker stats

# Логи в реальном времени
docker-compose logs -f --tail=100

# Health checks
curl http://localhost:5001/api/health
curl https://ovrin.xyz/health
```

## Troubleshooting

### Проблемы с портами

```bash
# Проверка занятых портов
sudo netstat -tulpn | grep -E ':(80|443|5001|5432)'

# Освобождение портов (если нужно)
sudo kill -9 <PID>
```

### Проблемы с правами доступа

```bash
# Исправление прав на директории
sudo chown -R $USER:$USER /var/www/panel
sudo chmod -R 755 /var/www/panel
```

### Пересборка контейнеров

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Git Workflow

### Работа с ветками

```bash
# Переключение на ветку разработки
git checkout develop

# Создание feature ветки
git checkout -b feature/new-feature
# ... делаем изменения ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Слияние в develop
git checkout develop
git merge feature/new-feature
git push origin develop

# Слияние develop в main (для production)
git checkout main
git merge develop
git push origin main
```

### Автоматическое развертывание через GitHub Actions

1. Добавьте secrets в GitHub:
   - `SERVER_HOST` - IP адрес сервера
   - `SERVER_USER` - пользователь для SSH
   - `SERVER_SSH_KEY` - приватный SSH ключ

2. При push в `main` или `develop` автоматически запустится развертывание

