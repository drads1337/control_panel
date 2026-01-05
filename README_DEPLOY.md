# 🚀 Быстрый старт: Деплой Panel Project

## Что было сделано

✅ Проект полностью контейнеризирован:
- Backend: `Dockerfile` 
- Frontend: `Dockerfile.frontend` (multi-stage build)
- Nginx: добавлен в `docker-compose.yml`
- Все сервисы работают в Docker контейнерах

✅ Настроен автоматический деплой:
- **Git Hook** - простой способ (см. `DEPLOY_AUTO.md`)
- **GitHub Actions** - с веб-интерфейсом (см. `DEPLOY_AUTO.md`)

## 📦 Самый простой способ (рекомендуется)

Смотрите **`DEPLOY_SIMPLE.md`** - самая простая инструкция для начала работы!

## 📦 Быстрый деплой (в первый раз)

### 1. На сервере

```bash
# Клонируйте проект
git clone <your-repo-url> panel
cd panel

# Настройте .env (скопируйте и заполните)
cp .env.example .env  # если есть
nano .env

# Соберите и запустите
docker compose build
docker compose up -d

# Проверьте статус
docker compose ps
docker compose logs -f
```

### 2. Настройка автоматического обновления

**Вариант A: Git Hook (простой)**

```bash
# На сервере
./scripts/setup-git-deploy.sh

# На локальной машине
git remote add production user@server:/path/to/repo.git
```

**Вариант B: GitHub Actions**

1. Настройте GitHub Secrets (см. `DEPLOY_AUTO.md`)
2. Отредактируйте `.github/workflows/deploy.yml` (путь к проекту)
3. Готово! При `git push origin main` - автоматический деплой

## 🔄 Обновление проекта

После настройки автоматического деплоя:

```bash
# Локально
git add .
git commit -m "Ваши изменения"
git push production main  # или git push origin main для GitHub Actions
```

Сервер автоматически:
1. Получит изменения из Git
2. Пересоберет Docker образы
3. Перезапустит контейнеры

## 📚 Подробная документация

- **Полная инструкция по деплою**: `DEPLOYMENT_RU.md`
- **Автоматический деплой**: `DEPLOY_AUTO.md`
- **Основной README**: `README.md`

## ⚠️ Важно

1. **`.env` файл** - должен быть настроен на сервере (не в Git!)
2. **SSL сертификаты** - поместите в `nginx/ssl/` для HTTPS
3. **Первая настройка** - выполните миграции БД и создайте администратора (см. `DEPLOYMENT_RU.md`)

---

**Вопросы?** Смотрите `DEPLOYMENT_RU.md` и `DEPLOY_AUTO.md` для детальной информации.

