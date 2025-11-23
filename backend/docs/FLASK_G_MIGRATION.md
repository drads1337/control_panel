# Миграция от flask.g к явной передаче параметров

## Цель
Убрать зависимость от глобального состояния `flask.g` и перейти на явную передачу параметров через kwargs для улучшения тестируемости и понимания зависимостей.

## Стратегия миграции

### 1. Обновление Middleware ✅
Middleware (`require_project_isolation`, `enforce_project_scope`) обновлены для:
- Всегда передавать `current_user`, `project_id`, `current_project` через kwargs
- Сохранять `flask.g` для обратной совместимости и query isolation
- Проверять сигнатуру функции и передавать параметры только если они объявлены

### 2. Миграция Routes
Для каждого route:
1. Изменить сигнатуру функции: `current_user=None` → `current_user`
2. Убрать fallback: `if current_user is None: current_user = g.current_user`
3. Убрать импорт `from flask import g` (если больше не используется)

## Прогресс

### ✅ Завершено
- **middleware/auth.py**: Обновлены декораторы для явной передачи параметров
- **routes/keys/bulk_operations.py**: Все 13 функций мигрированы
  - `bulk_create_keys`
  - `bulk_delete_keys`
  - `bulk_reset_keys`
  - `bulk_pause_keys`
  - `bulk_resume_keys`
  - `bulk_add_hours`
  - `bulk_pause_keys_by_product`
  - `bulk_resume_keys_by_product`
  - `bulk_reset_keys_by_product`
  - `bulk_add_hours_by_product`
  - `bulk_delete_keys_by_filters`
  - `bulk_reset_keys_by_filters`
  - `bulk_extend_keys_by_filters`

### 🔄 В процессе
- **routes/keys/management.py**: 5 функций требуют миграции
- **routes/keys/agent.py**: Требуется миграция
- **routes/users/**: Требуется миграция
- **routes/admin/**: Требуется миграция

### Метрики
- **До миграции**: 39 файлов, 178 обращений к flask.g
- **После bulk_operations.py**: 38 файлов, 165 обращений
- **Цель**: < 50 обращений (только для query isolation и middleware)

## Пример миграции

### До:
```python
@require_project_isolation
def some_route(current_user=None, project_id=None):
    if current_user is None:
        from flask import g
        current_user = g.current_user
    
    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    # ... rest of the code
```

### После:
```python
@require_project_isolation
def some_route(current_user, project_id=None):
    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    # ... rest of the code
```

## Преимущества
1. **Явные зависимости**: Легко видеть, какие параметры нужны функции
2. **Тестируемость**: Можно передавать моки напрямую без Flask context
3. **Типизация**: Можно использовать type hints для параметров
4. **Отладка**: Проще отследить, откуда приходят данные

## Что остается в flask.g
- `g.project_id` - для query isolation (автоматическая фильтрация запросов)
- `g.current_user` - для обратной совместимости (постепенно убирается)
- `g.request_id`, `g.start_time` - для логирования (можно оставить)

