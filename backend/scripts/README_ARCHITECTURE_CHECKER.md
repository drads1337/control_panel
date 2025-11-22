# Architecture Issues Checker

Утилита для автоматического обнаружения архитектурных проблем в кодовой базе.

## Использование

### Базовое использование

```bash
# Проверить весь проект
python backend/scripts/check_architecture_issues.py

# Проверить с подробным выводом
python backend/scripts/check_architecture_issues.py --verbose

# Сохранить отчет в JSON
python backend/scripts/check_architecture_issues.py --json report.json
```

### Что проверяет скрипт

1. **Прямые импорты моделей в routes** (HIGH)
   - Находит `from ..models.` в файлах routes
   - Должно быть заменено на использование сервисов

2. **Прямые вызовы `.query`** (HIGH)
   - Находит `Model.query.get()`, `Model.query.filter()`, etc.
   - Должно быть заменено на методы сервисов

3. **Использование Facade сервисов** (MEDIUM)
   - Находит `KeyServiceFacade`, `UserManagementServiceFacade`
   - Должно быть заменено на специализированные сервисы

4. **Legacy импорты** (MEDIUM)
   - Находит импорты из deprecated модулей
   - Должно быть заменено на новые импорты

5. **Дублированные helper-функции** (LOW)
   - Находит одинаковые функции в разных файлах
   - Должно быть вынесено в общие сервисы

6. **Отсутствие DI** (LOW)
   - Находит прямые импорты сервисов вместо использования DI-контейнера
   - Должно быть заменено на `get_service()`

## Интерпретация результатов

### HIGH Severity
Критичные проблемы, которые нужно исправить в первую очередь:
- Прямые импорты моделей нарушают слоистую архитектуру
- Прямые `.query` вызовы обходят Query Isolation и усложняют тестирование

### MEDIUM Severity
Важные проблемы, которые нужно исправить:
- Facade сервисы добавляют лишний слой абстракции
- Legacy импорты могут привести к использованию устаревшего кода

### LOW Severity
Улучшения, которые можно сделать постепенно:
- Дублирование кода усложняет поддержку
- DI улучшает тестируемость и управление зависимостями

## Интеграция в CI/CD

Добавьте проверку в CI pipeline:

```yaml
# .github/workflows/architecture-check.yml
- name: Check Architecture Issues
  run: |
    python backend/scripts/check_architecture_issues.py --json architecture-report.json
    # Fail if high severity issues found
    python -c "import json; data=json.load(open('architecture-report.json')); exit(1 if sum(data['summary'].values()) > 0 else 0)"
```

## Примеры исправлений

### ❌ Плохо
```python
# routes/dashboard.py
from ..models.core import User
from ..models.keys import Key

@dashboard_bp.route("/stats")
def get_stats():
    user = User.query.get(user_id)
    total_keys = Key.query.filter(Key.project_id == project_id).count()
```

### ✅ Хорошо
```python
# routes/dashboard.py
from ...utils.service_helpers import get_service

@dashboard_bp.route("/stats")
def get_stats():
    user_service = get_service('user_service')
    key_service = get_service('key_service')
    
    user = user_service.get_user_by_id(user_id)
    total_keys = key_service.count_keys(project_id=project_id)
```

## Связанные документы

- [Architecture Maturity Analysis](../docs/ARCHITECTURE_MATURITY_ANALYSIS.md) - полный анализ архитектурных проблем
- [Service Container Documentation](../core/service_container.py) - документация DI-контейнера

