# Users Services

## UserRelationshipsService

**Новый сервис для рефакторинга God Objects**

Предоставляет доступ к связям User без использования прямых backref'ов.

### Зачем это нужно?

Вместо прямого доступа к связям через модель:
```python
# ❌ Плохо: прямое использование backref
user = User.query.get(user_id)
activities = user.activities  # backref
keys = user.keys  # backref (если есть)
permissions = user.product_permissions  # backref
```

Используйте сервис:
```python
# ✅ Хорошо: использование сервиса
from ...services.users import user_relationships_service

activities = user_relationships_service.get_activities(user_id)
keys = user_relationships_service.get_keys(user_id)
permissions = user_relationships_service.get_product_permissions(user_id)
```

### Преимущества

1. **Меньше связанности**: Код не зависит от структуры модели User
2. **Явные зависимости**: Легче понять, какие данные используются
3. **Легче тестировать**: Можно мокировать сервис
4. **Оптимизация**: Можно добавить кэширование или оптимизацию запросов

### Методы

- `get_activities(user_id, limit=None)` - получить активности пользователя
- `get_action_logs(user_id, limit=None)` - получить логи действий
- `get_product_permissions(user_id)` - получить права на продукты
- `get_developer_product_permissions(user_id)` - получить права разработчика
- `get_keys(user_id)` - получить все ключи пользователя
- `get_key_count(user_id)` - получить количество ключей
- `get_roles(user_id)` - получить роли пользователя
- `get_project_roles(user_id)` - получить роли в проектах
- `get_administered_projects(user_id)` - получить проекты, где пользователь админ
- `get_created_api_keys(user_id)` - получить созданные API ключи
- `get_created_backups(user_id)` - получить созданные бэкапы

### Пример использования

```python
from ...services.users import user_relationships_service

# Получить активности пользователя
activities = user_relationships_service.get_activities(user_id, limit=20)
for activity in activities:
    print(f"{activity.action} at {activity.created_at}")

# Получить ключи пользователя
keys = user_relationships_service.get_keys(user_id)
print(f"User has {len(keys)} keys")

# Получить проекты, где пользователь админ
admin_projects = user_relationships_service.get_administered_projects(user_id)
print(f"User is admin of {len(admin_projects)} projects")
```

