# Рефакторинг циклических импортов

## Проблема

В проекте есть множество импортов внутри функций, которые используются для обхода циклических зависимостей между сервисами. Это создает проблемы:
- Сложность понимания зависимостей
- Невозможность использовать статические анализаторы типов
- Медленнее выполнение (импорт при каждом вызове)
- Сложность тестирования

## Принципы решения

### 1. Использование Dependency Injection через ServiceContainer

Вместо:
```python
def some_method(self):
    from ...services.rbac import rbac_service
    rbac_service.check_permission(...)
```

Использовать:
```python
from flask import current_app

def some_method(self):
    rbac_service = current_app.service_container.get('rbac_service')
    rbac_service.check_permission(...)
```

Или лучше - внедрять зависимости через конструктор:
```python
class SomeService:
    def __init__(self, rbac_service=None):
        self.rbac_service = rbac_service or get_service('rbac_service')
    
    def some_method(self):
        self.rbac_service.check_permission(...)
```

### 2. Использование helper функции `get_service()`

Для удобства можно использовать:
```python
from ...utils.service_helpers import get_service

def some_method(self):
    rbac_service = get_service('rbac_service')
    rbac_service.check_permission(...)
```

### 3. Опциональные зависимости через свойства (lazy loading)

Если зависимость не всегда нужна:
```python
@property
def rbac_service(self):
    if not hasattr(self, '_rbac_service'):
        from ...utils.service_helpers import get_service
        self._rbac_service = get_service('rbac_service')
    return self._rbac_service
```

## Приоритетные области для рефакторинга

### Высокий приоритет

1. **rbac_service** - импортируется внутри функций в:
   - `webhook_service.py` (строки 1481, 1525)
   - `webhook_validation_service.py` (строки 184, 228)
   - `key_crud_service.py` (строки 288, 438)
   - `user_crud_service.py` (строки 356, 427)
   - `balance_service.py` (строки 55, 335)
   - `product_service.py` (строки 472, 664)
   - `user_profile_service.py` (строка 247)
   - `notification_service.py` (строки 285, 339)
   - `dynamic_config_service.py` (строка 469)
   - И других...

2. **webhook_service** - импортируется внутри функций в:
   - `key_crud_service.py` (строка 234)
   - `login_service.py` (строка 340)

3. **product_service** - импортируется внутри функций в:
   - `key_bulk_operations_service.py` (строки 128, 407, 432, 454, 476)
   - `key_crud_service.py` (строка 150)

### Средний приоритет

4. **security_*_service** - взаимные импорты внутри методов
5. **settings_*_service** - импорты через try/except блоки

## Пример рефакторинга

### До (проблемный код):
```python
class WebhookService:
    def validate_webhook_access(self, user_id: int, project_id: int = None):
        # Импорт внутри метода для обхода циклической зависимости
        from ...services.rbac import rbac_service
        from ...utils.rbac_utils import RBACManager
        
        user = User.query.get(user_id)
        has_permission = rbac_service.check_permission(user_id, "webhooks.view")
        ...
```

### После (рефакторинг):
```python
from ...utils.service_helpers import get_service

class WebhookService:
    def __init__(self):
        # Можно загрузить зависимости при инициализации
        # или использовать lazy loading через свойство
        pass
    
    @property
    def _rbac_service(self):
        """Lazy loading для rbac_service"""
        if not hasattr(self, '_rbac_service_cache'):
            self._rbac_service_cache = get_service('rbac_service')
        return self._rbac_service_cache
    
    def validate_webhook_access(self, user_id: int, project_id: int = None):
        from ...utils.rbac_utils import RBACManager
        
        user = User.query.get(user_id)
        has_permission = self._rbac_service.check_permission(user_id, "webhooks.view")
        ...
```

Или еще лучше - через конструктор с DI:
```python
from ...utils.service_helpers import get_service
from typing import Optional

class WebhookService:
    def __init__(self, rbac_service=None):
        # Разрешаем внедрение зависимости для тестирования
        self._rbac_service = rbac_service or get_service('rbac_service')
    
    def validate_webhook_access(self, user_id: int, project_id: int = None):
        from ...utils.rbac_utils import RBACManager
        
        user = User.query.get(user_id)
        has_permission = self._rbac_service.check_permission(user_id, "webhooks.view")
        ...
```

## План рефакторинга

### Этап 1: Создать helper для получения сервисов
- [x] `service_helpers.py` уже существует
- [ ] Убедиться что все сервисы зарегистрированы в `ServiceContainer`

### Этап 2: Рефакторинг наиболее частых случаев
1. Заменить все `from ...services.rbac import rbac_service` на `get_service('rbac_service')`
2. Заменить все `from ...services.webhooks import get_webhook_service` на `get_service('webhook_service')`
3. Заменить все `from ...services.products import product_service` на `get_service('product_service')`

### Этап 3: Оптимизация (по необходимости)
- Использовать lazy loading через свойства для опциональных зависимостей
- Внедрять зависимости через конструктор для лучшей тестируемости

## Контрольный список

- [ ] Все сервисы зарегистрированы в `ServiceContainer`
- [ ] Убраны все импорты сервисов внутри функций
- [ ] Используется `get_service()` или DI через конструктор
- [ ] Все тесты проходят
- [ ] Статический анализатор типов (mypy/pyright) не выдает ошибок

## Примечания

- Не все импорты внутри функций проблемны (например, импорты стандартных библиотек или импорты для обхода опциональных зависимостей)
- Приоритет - убрать циклические зависимости между сервисами
- Использование ServiceContainer уже реализовано, нужно только расширить его использование