# Миграция с ProjectSettings на специализированные модели

## Проблема

`ProjectSettings` является God-object, который нарушает принцип Single Responsibility (SRP). В нём смешаны настройки безопасности, бэкапов, чатов, внешнего вида и т.д. Это усложняет:
- Миграции базы данных
- Поддержку кода
- Тестирование
- Понимание зависимостей

## Решение

Созданы специализированные модели для каждого типа настроек:
- `ProjectSecuritySettings` - настройки безопасности
- `ProjectSystemSettings` - системные настройки
- `ProjectEncryptionSettings` - настройки шифрования
- `ProjectBackupSettings` - настройки бэкапов
- `ProjectChatSettings` - настройки чата
- `ProjectOfflineAuthSettings` - настройки офлайн-аутентификации
- `ProjectAppearanceSettings` - настройки внешнего вида
- `ProjectInviteSettings` - настройки приглашений

## Использование

### Рекомендуемый способ (новый код)

Используйте `ProjectSettingsHelper` для доступа к настройкам:

```python
from backend.utils.project_settings_migration import ProjectSettingsHelper

# В функции/методе
helper = ProjectSettingsHelper(project_id)

# Получить настройки безопасности
security_settings = helper.get_security_settings()
min_password_length = security_settings.min_password_length

# Получить системные настройки
system_settings = helper.get_system_settings()
max_connections = system_settings.max_connections

# Получить ключ шифрования (наиболее часто используемое поле)
master_key = helper.get_project_master_key()
```

### Миграция существующего кода

**Было:**
```python
from backend.models.core import ProjectSettings

settings = ProjectSettings.query.filter_by(project_id=project_id).first()
if settings:
    min_password_length = settings.min_password_length
    max_connections = settings.max_connections
```

**Стало:**
```python
from backend.utils.project_settings_migration import ProjectSettingsHelper

helper = ProjectSettingsHelper(project_id)
security_settings = helper.get_security_settings()
system_settings = helper.get_system_settings()

min_password_length = security_settings.min_password_length
max_connections = system_settings.max_connections
```

### Миграция всех настроек проекта

Для миграции всех настроек проекта сразу:

```python
from backend.utils.project_settings_migration import migrate_project_settings

# Мигрировать все настройки для проекта
results = migrate_project_settings(project_id)
# results = {
#     "security": True,
#     "system": True,
#     "encryption": True,
#     ...
# }
```

## Преимущества

1. **SRP (Single Responsibility)**: Каждая модель отвечает только за свой домен
2. **Проще миграции**: Изменения в одной области не затрагивают другие
3. **Лучшая производительность**: Загружаем только нужные настройки
4. **Чище код**: Понятно, какие настройки используются в каждом месте
5. **Легче тестировать**: Можно мокировать только нужные настройки

## Обратная совместимость

`ProjectSettingsHelper` автоматически мигрирует данные из `ProjectSettings` при первом обращении. Это означает:
- Старый код продолжает работать
- Миграция происходит постепенно (lazy migration)
- Нет необходимости в массовой миграции всех проектов сразу

## План миграции

1. ✅ Созданы специализированные модели
2. ✅ Создан `ProjectSettingsHelper` для доступа
3. ⏳ Постепенная миграция существующего кода
4. ⏳ После полной миграции - удаление `ProjectSettings` модели

## Примечания

- `ProjectSettings` помечен как DEPRECATED, но пока остаётся для обратной совместимости
- Новый код должен использовать `ProjectSettingsHelper` или напрямую специализированные модели
- При доступе через `ProjectSettingsHelper` данные автоматически мигрируются из `ProjectSettings`

