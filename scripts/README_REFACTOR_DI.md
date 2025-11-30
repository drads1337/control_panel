# Скрипт рефакторинга ленивых импортов get_service()

## Описание

Скрипт `refactor_di_imports.py` автоматически находит все случаи использования `get_service()` внутри методов и функций, что является антипаттерном для Dependency Injection.

## Проблема

Использование `get_service()` внутри методов:
- Усложняет статический анализ
- Замедляет выполнение (незначительно)
- Делает граф зависимостей неочевидным
- Усложняет тестирование

## Решение

Все зависимости должны получаться:
- **Для классов**: через `__init__` (Dependency Injection)
- **Для функций**: один раз в начале функции

## Использование

### Анализ проблем (dry-run)

```bash
python scripts/refactor_di_imports.py --dry-run
```

Это покажет:
- Сколько файлов имеют проблемы
- Сколько использований `get_service()` внутри методов
- Детальный отчет по каждому файлу

### Сохранение отчета в файл

```bash
python scripts/refactor_di_imports.py --dry-run --output di_report.txt
```

### Рефакторинг (требует ручной проверки)

```bash
python scripts/refactor_di_imports.py
```

⚠️ **Внимание**: Автоматический рефакторинг требует ручной проверки, так как:
- Нужно правильно определить место для добавления зависимостей
- Нужно учесть контекст использования
- Нужно проверить, что зависимости доступны в нужном месте

## Текущая статистика

По результатам последнего анализа:
- **101 файл** с проблемами
- **613 использований** `get_service()` внутри методов

## Категории проблем

1. **Routes** (функции-роуты) - получать сервисы в начале функции
2. **Services** (классы) - добавлять в `__init__`
3. **Tasks** (Celery задачи) - получать в начале функции
4. **Utils** (утилиты) - получать в начале функции или через параметры

## Примеры рефакторинга

### До (плохо):
```python
def some_function():
    # ... код ...
    service = get_service('some_service')  # Ленивая загрузка
    service.do_something()
```

### После (хорошо):
```python
def some_function():
    # Получаем сервисы один раз в начале
    service = get_service('some_service')
    # ... код ...
    service.do_something()
```

### Для классов:

#### До (плохо):
```python
class MyService:
    def some_method(self):
        service = get_service('other_service')  # Ленивая загрузка
        service.do_something()
```

#### После (хорошо):
```python
class MyService:
    def __init__(self, other_service=None):
        self._other_service = other_service
    
    def some_method(self):
        if not self._other_service:
            self._other_service = get_service('other_service')
        self._other_service.do_something()
```

## Следующие шаги

1. ✅ Создан скрипт для анализа
2. ⏳ Рефакторинг routes (получать сервисы в начале функций)
3. ⏳ Рефакторинг services (добавить зависимости в `__init__`)
4. ⏳ Обновить регистрацию в `service_container.py` для автоматического DI
5. ⏳ Удалить все ленивые импорты внутри методов

