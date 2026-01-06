# Быстрый старт развертывания

## На сервере

### 1. Первоначальная настройка

```bash
# Клонирование репозитория
sudo mkdir -p /var/www/panel
sudo chown $USER:$USER /var/www/panel
cd /var/www/panel
git clone https://github.com/drads1337/control_panel.git .

# Создание .env файла
nano .env
# (скопируйте переменные из SERVER_SETUP.md)

# Создание SSL сертификатов
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=ovrin.xyz"

# Развертывание
chmod +x deploy.sh
sudo ./deploy.sh main
```

### 2. Обновление проекта

```bash
cd /var/www/panel

# Production (main)
git checkout main
git pull origin main
sudo ./deploy.sh main

# Development (develop)
git checkout develop
git pull origin develop
sudo ./deploy.sh develop
```

## Git Workflow

### Ветки:
- **main** - Production (стабильная версия)
- **develop** - Development (версия для разработки)

### Работа с ветками:

```bash
# Разработка новой функции
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# ... делаем изменения ...
git add .
git commit -m "Add my feature"
git push origin feature/my-feature

# Слияние в develop
git checkout develop
git merge feature/my-feature
git push origin develop

# Развертывание develop на сервере
# (на сервере: git pull origin develop && sudo ./deploy.sh develop)

# Когда готово к production
git checkout main
git merge develop
git push origin main

# Развертывание main на сервере
# (на сервере: git pull origin main && sudo ./deploy.sh main)
```

## Полезные команды

```bash
# Статус контейнеров
docker-compose ps

# Логи
docker-compose logs -f

# Перезапуск
docker-compose restart

# Остановка
docker-compose down

# Полная пересборка
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```
