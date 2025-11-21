# Projects Services

## ProjectService

Основной сервис для работы с проектами. Предоставляет кэшированный доступ к данным проектов.

## ProjectRelationshipsService

**Новый сервис для рефакторинга God Objects**

Предоставляет доступ к связям Project без использования прямых backref'ов.

### Зачем это нужно?

Вместо прямого доступа к связям через модель:
```python
# ❌ Плохо: прямое использование backref
project = Project.query.get(project_id)
admin = project.admin_user  # backref
users = project.users  # backref
roles = project.roles  # backref
```

Используйте сервис:
```python
# ✅ Хорошо: использование сервиса
from ...services.projects import project_relationships_service

admin = project_relationships_service.get_admin_user(project_id)
users = project_relationships_service.get_users(project_id)
roles = project_relationships_service.get_roles(project_id)
```

### Преимущества

1. **Меньше связанности**: Код не зависит от структуры модели Project
2. **Явные зависимости**: Легче понять, какие данные используются
3. **Легче тестировать**: Можно мокировать сервис
4. **Оптимизация**: Можно добавить кэширование или оптимизацию запросов

### Методы

- `get_admin_user(project_id)` - получить админа проекта
- `get_admin_id(project_id)` - получить ID админа
- `set_admin(project_id, user_id)` - установить админа
- `get_users(project_id)` - получить всех пользователей проекта
- `get_user_count(project_id)` - получить количество пользователей
- `get_project_user_roles(project_id)` - получить роли пользователей проекта
- `get_roles(project_id)` - получить все роли проекта
- `get_invite_codes(project_id)` - получить инвайт-коды
- `get_user_activities(project_id, limit=None)` - получить активности пользователей
- `get_action_logs(project_id, limit=None)` - получить логи действий

### Пример использования

```python
from ...services.projects import project_relationships_service

# Получить админа проекта
admin = project_relationships_service.get_admin_user(project_id)
if admin:
    print(f"Admin: {admin.username}")

# Получить всех пользователей
users = project_relationships_service.get_users(project_id)
print(f"Total users: {len(users)}")

# Получить последние 10 активностей
activities = project_relationships_service.get_user_activities(project_id, limit=10)
```

