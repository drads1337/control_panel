# Архитектурный анализ и рекомендации по улучшению

## Обзор

Этот документ содержит детальный анализ архитектуры проекта, выявленные проблемы и конкретные рекомендации по их устранению.

---

## 1. Сильные стороны архитектуры

### 1.1 PostgreSQL Row Level Security (RLS)

**Реализация:** `backend/utils/postgresql_rls.py`, `backend/migrations/versions/add_postgresql_rls.py`

**Описание:**
- Использование PostgreSQL RLS для изоляции данных на уровне БД — это "золотой стандарт" для мультитенантных приложений
- Даже если разработчик забудет добавить `filter_by(project_id=...)` в ORM, база данных сама не отдаст чужие данные
- Защита от SQL-инъекций на уровне БД

**Статус:** ✅ Отлично реализовано

**Рекомендации:**
- Убедиться, что все таблицы с `project_id` покрыты RLS политиками
- Добавить автоматические тесты, проверяющие работу RLS при отсутствии фильтрации в коде

---

### 1.2 Envelope Encryption (DEK/KEK)

**Реализация:** `backend/utils/envelope_encryption.py`

**Описание:**
- Реализация EnvelopeKeyManager для шифрования ключей проектов мастер-ключом из переменных окружения
- Защищает данные при дампе БД: даже при компрометации БД ключи нельзя расшифровать без KEK

**Статус:** ✅ Хорошо реализовано

**Рекомендации:**
- Добавить ротацию KEK (key rotation) для долгосрочной безопасности
- Документировать процесс восстановления после потери KEK

---

### 1.3 Dependency Injection (ServiceContainer)

**Реализация:** `backend/core/service_container.py`

**Описание:**
- Внедрение ServiceContainer позволяет развязать зависимости и облегчает тестирование
- Поддержка разных scope (singleton, request-scoped, transient)
- Автоматическое разрешение зависимостей через конструкторы

**Статус:** ⚠️ Частично реализовано (миграция не завершена)

**Проблемы:**
- Много сервисов все еще используют `get_service()` внутри методов вместо DI через конструктор
- Циклические зависимости обходятся через lazy loading

**Рекомендации:** См. раздел 2.1

---

### 1.4 Write-Behind Caching (AnalyticsBufferService)

**Реализация:** `backend/services/analytics/analytics_buffer_service.py`

**Описание:**
- Сервис AnalyticsBufferService для буферизации записей аналитики в Redis перед сбросом в БД
- Отличное решение для снижения нагрузки на запись (IOPS)
- Многоуровневая система fallback (Redis → in-memory queue → structured logging → direct DB)

**Статус:** ✅ Отлично реализовано

**Рекомендации:**
- Мониторинг размера буфера и частоты flush операций
- Настройка алертов при переполнении буфера

---

### 1.5 Read Replicas (Масштабирование чтения)

**Реализация:** `backend/core/extensions.py`, `backend/utils/db_replica.py`, `backend/config/config.py`

**Описание:**
- Реализована поддержка `SQLALCHEMY_DATABASE_READ_URI` и маршрутизация запросов через нативные SQLAlchemy binds
- Автоматическое определение read-only запросов (GET) и маршрутизация на read replica
- Настройка read-only режима на уровне БД через `SET default_transaction_read_only = on`
- Отдельные пулы соединений для primary и read replica с независимой конфигурацией

**Статус:** ✅ Отлично реализовано

**Рекомендации:**
- Использовать read replicas для всех GET запросов, которые не требуют строгой консистентности
- Мониторить лаг репликации и автоматически переключаться на primary при высоком лаге
- Добавить метрики использования read vs write соединений

---

### 1.6 Redis Separation (Изоляция данных)

**Реализация:** `backend/utils/redis_client.py`, `backend/config/config.py`

**Описание:**
- Данные разделены по разным БД Redis: кэш, сессии, лимиты, динамическая конфигурация, аналитика
- Поддержка отдельных Redis инстансов для cache (non-persistent) и persistent данных
- Уменьшает blast radius при очистке кэша: очистка кэша не затрагивает сессии и лимиты
- Позволяет масштабировать Redis инстансы независимо

**Статус:** ✅ Отлично реализовано

**Рекомендации:**
- Документировать стратегию масштабирования для каждого типа данных
- Добавить мониторинг использования памяти по каждой БД Redis
- Рассмотреть использование Redis Cluster для горизонтального масштабирования

---

### 1.7 Slow Query Monitor (Мониторинг медленных запросов)

**Реализация:** `backend/utils/slow_query_monitor.py`

**Описание:**
- Встроенный мониторинг медленных запросов с настраиваемым порогом
- Трекинг статистики по типам запросов, таблицам и эндпоинтам
- Анализ паттернов запросов для оптимизации
- Интеграция с Redis для хранения статистики

**Статус:** ⚠️ Полезно, но требует оптимизации

**Проблемы:**
- В проде лучше полагаться на `pg_stat_statements` и внешние APM (Datadog/NewRelic)
- Встроенный мониторинг добавляет overhead на каждое выполнение запроса
- Может создавать дополнительную нагрузку на приложение при анализе своих же запросов

**Рекомендации:**
1. **В production:**
   - Отключить встроенный мониторинг или использовать только для критичных эндпоинтов
   - Использовать `pg_stat_statements` для анализа медленных запросов на уровне БД
   - Интегрировать внешние APM инструменты (Datadog, NewRelic, Sentry) для мониторинга производительности

2. **В development/staging:**
   - Оставить встроенный мониторинг для быстрой диагностики проблем
   - Использовать для выявления проблемных запросов перед деплоем

3. **Оптимизация:**
   - Добавить sampling (только 10-20% запросов) для снижения overhead
   - Использовать асинхронную отправку метрик в Redis
   - Добавить флаг для включения/выключения мониторинга через конфигурацию

---

### 1.8 Качество кода (SOLID, DRY, KISS)

#### SOLID принципы

**Сильные стороны:**
- **Single Responsibility Principle (SRP):** Хорошо соблюдается в новых сервисах
  - `DecryptionService` (`backend/services/connect/decryption_service.py`) занимается только расшифровкой
  - `ChallengeValidationService` (`backend/services/connect/challenge_validation_service.py`) управляет только жизненным циклом challenge
  - Сервисы четко разделены по ответственности

**Проблемы:**
- **Старые контроллеры все еще толстоваты:** Смешивают валидацию, бизнес-логику и форматирование ответов
- **UserOrchestrator:** См. раздел 2.3 - смешивает создание пользователя, назначение ролей, транзакции токенов и обновление счетчиков

**Рекомендации:**
- Продолжить рефакторинг контроллеров: вынести бизнес-логику в сервисы
- Разделить `UserOrchestrator` на несколько специализированных сервисов (см. раздел 2.3)

---

#### DRY (Don't Repeat Yourself)

**Сильные стороны:**
- **Валидация вынесена в `request_validation_pipeline.py`:** Централизованная валидация IP и User-Agent
  - Устраняет дублирование логики валидации между `SecurityChecker`, `AuthService` и middleware
  - Единая точка изменения правил валидации

- **Pydantic схемы используются повторно:** Схемы валидации определены один раз и переиспользуются
  - `backend/schemas/` содержит переиспользуемые схемы
  - Middleware `validation.py` использует эти схемы для валидации запросов и ответов

**Рекомендации:**
- Продолжить вынос общей логики в переиспользуемые сервисы
- Избегать дублирования бизнес-логики между сервисами

---

#### KISS (Keep It Simple, Stupid)

**Нарушения в угоду безопасности:**
- **ChallengeService с "memory challenge" и "anti-debug":** 
  - Реализация: `backend/services/auth/challenge_service.py`
  - Сложная логика с timing checks, performance monitoring, anti-debug detection
  - Тяжело поддерживать и тестировать
  - **Оправдано:** Для защиты ПО от взлома и reverse engineering это необходимо

**Компромисс:**
- Сложность оправдана требованиями безопасности
- Важно документировать логику работы challenge системы
- Добавить unit-тесты для проверки корректности работы

**Рекомендации:**
1. **Документация:**
   - Добавить подробные комментарии к сложным алгоритмам в `ChallengeService`
   - Описать, почему используется именно такая логика (защита от конкретных атак)

2. **Тестирование:**
   - Добавить unit-тесты для всех типов challenge
   - Тестировать edge cases (timing attacks, debug detection)

3. **Мониторинг:**
   - Логировать случаи, когда challenge не проходит валидацию
   - Отслеживать false positives (легитимные запросы, отклоненные challenge)

---

#### Читаемость кода

**Сильные стороны:**
- **Отличная документация:** Docstrings присутствуют везде
- **Структурированное логирование:** Использование structured logging для лучшей читаемости логов
- **Понятные имена:** Сервисы и функции имеют описательные имена

**Рекомендации:**
- Продолжать поддерживать высокий уровень документации
- Добавить примеры использования в docstrings для сложных сервисов
- Использовать type hints везде, где возможно (улучшает читаемость и поддержку IDE)

---

## 2. Проблемы и уязвимости

### 2.1 Circular Imports & Lazy Loading (Code Smell)

**Проблема:**
В коде очень много импортов внутри функций/методов (например, `from ...utils.service_helpers import get_service` внутри методов). Это сделано для обхода циклических зависимостей.

**Примеры:**
```python
# backend/services/products/product_service.py:54
def some_method(self):
    from ...utils.service_helpers import get_service
    service = get_service('some_service')
```

**Риски:**
1. Усложняет статический анализ (IDE не может определить зависимости)
2. Замедляет выполнение (незначительно, но накапливается)
3. Делает граф зависимостей неочевидным
4. Усложняет рефакторинг и тестирование
5. Может скрывать циклические зависимости, которые должны быть решены архитектурно

**Статистика:**
- Найдено **153+** использования `get_service()` внутри методов
- Затронуто **50+** файлов

**Решение:**

#### Шаг 1: Рефакторинг сервисов для использования DI через конструктор

**До:**
```python
class ProductService:
    def some_method(self):
        from ...utils.service_helpers import get_service
        user_service = get_service('user_crud_service')
        # ...
```

**После:**
```python
class ProductService:
    def __init__(self, user_crud_service=None, rbac_service=None):
        # Автоматическая инъекция через ServiceContainer
        self.user_crud_service = user_crud_service or get_service('user_crud_service')
        self.rbac_service = rbac_service or get_service('rbac_service')
    
    def some_method(self):
        # Используем инжектированные зависимости
        self.user_crud_service.create_user(...)
```

#### Шаг 2: Регистрация сервисов с автоматическим DI

ServiceContainer уже поддерживает автоматическое разрешение зависимостей через `_create_with_di()`. Нужно использовать это при регистрации:

```python
# backend/core/service_container.py
container.register('product_service', ProductService, scope=ServiceScope.SINGLETON)
# ServiceContainer автоматически разрешит зависимости через конструктор
```

#### Шаг 3: Приоритизация рефакторинга

**Высокий приоритет:**
1. `backend/services/products/product_service.py` (3 lazy imports)
2. `backend/services/users/user_orchestrator.py` (множественные вызовы get_service)
3. `backend/services/keys/key_crud_service.py` (9 lazy imports)
4. `backend/routes/agents.py` (8 lazy imports)

**Средний приоритет:**
- Все остальные сервисы с lazy imports

**План миграции:**
1. Начать с сервисов, которые не имеют циклических зависимостей
2. Разбить циклические зависимости через введение промежуточных сервисов или событий
3. Постепенно мигрировать остальные сервисы

---

### 2.2 Redis Integrity Protection (Over-engineering?)

**Реализация:** `backend/utils/redis_integrity.py`

**Проблема:**
Модуль `redis_integrity.py` подписывает данные в Redis через HMAC. Если Redis находится внутри защищенного VPC и используется TLS (`REDIS_PERSISTENT_SSL`), это создает лишний CPU overhead.

**Текущее состояние:**
- Защита опциональна через `REDIS_INTEGRITY_ENABLED` (по умолчанию `False`)
- Хорошо документировано в коде

**Рекомендации:**

1. **Улучшить документацию:**
   - Добавить в `README.md` или `SECURITY.md` раздел о том, когда включать/выключать эту защиту
   - Указать, что при использовании TLS внутри VPC это избыточно

2. **Мониторинг:**
   - Добавить метрики CPU overhead при включенной защите
   - Логировать предупреждения, если защита включена при активном TLS

3. **Автоматическое определение:**
   ```python
   # backend/utils/redis_integrity.py
   def __init__(self):
       self.signing_key = self._get_signing_key()
       from ..config.config import Config
       
       # Автоматически отключать, если используется TLS
       if Config.REDIS_PERSISTENT_SSL:
           logger.info(
               "Redis Integrity Protection disabled: Redis uses TLS encryption. "
               "HMAC signing is redundant in this configuration."
           )
           self.protection_enabled = False
       else:
           self.protection_enabled = getattr(Config, 'REDIS_INTEGRITY_ENABLED', False)
   ```

**Статус:** ⚠️ Требует улучшения документации и автоматического определения

---

### 2.3 Сложность UserOrchestrator

**Реализация:** `backend/services/users/user_orchestrator.py`

**Проблема:**
Попытка собрать всю логику создания пользователя в `UserOrchestrator` похвальна, но текущая реализация смешивает:
- Создание в БД
- Проверки прав
- Транзакции токенов
- Назначение ролей
- Обновление счетчиков проектов

Все это в одной огромной транзакции (`_create_user_with_roles_and_products`).

**Риски:**
1. **Блокировки БД при высокой нагрузке:** Долгая транзакция блокирует строки в таблицах `users`, `user_roles`, `token_transactions`, `project_counters`
2. **Бутылочное горлышко:** Если Redis (для проверки лимитов) отвалится, фолбэк на БД может создать проблемы
3. **Сложность отладки:** При ошибке в середине транзакции сложно понять, что именно пошло не так
4. **Проблемы с масштабированием:** При росте нагрузки транзакции будут конфликтовать

**Текущая реализация:**
```python
def _create_user_with_roles_and_products(self, current_user: User, data: Dict[str, Any]) -> User:
    # Вся логика в одной транзакции:
    # 1. Валидация
    # 2. Создание пользователя
    # 3. Транзакции токенов
    # 4. Назначение продуктов
    # 5. Назначение ролей
    # 6. Обновление счетчиков
    db.session.commit()  # Одна большая транзакция
```

**Решение:**

#### Вариант 1: Разделение на несколько транзакций (рекомендуется)

```python
def _create_user_with_roles_and_products(self, current_user: User, data: Dict[str, Any]) -> User:
    # Транзакция 1: Создание пользователя (быстрая, минимальные блокировки)
    user = self._create_user_core(data)
    db.session.commit()
    
    # Транзакция 2: Назначение ролей и продуктов (может быть отложено)
    try:
        self._assign_roles_and_products(user, data)
        db.session.commit()
    except Exception as e:
        logger.error(f"Failed to assign roles/products for user {user.id}: {e}")
        # Пользователь уже создан, можно повторить позже через фоновую задачу
    
    # Транзакция 3: Токены и счетчики (может быть асинхронной)
    if data.get("token_balance", 0) > 0:
        self._handle_token_transactions(current_user, user, data["token_balance"])
        db.session.commit()
    
    return user
```

#### Вариант 2: Использование Saga Pattern для распределенных транзакций

Если операции должны быть атомарными, но могут выполняться в разных сервисах:

```python
def _create_user_with_roles_and_products(self, current_user: User, data: Dict[str, Any]) -> User:
    saga = UserCreationSaga(current_user, data)
    
    try:
        # Шаг 1: Создание пользователя
        user = saga.create_user()
        
        # Шаг 2: Назначение ролей
        saga.assign_roles(user)
        
        # Шаг 3: Транзакции токенов
        saga.handle_tokens(user)
        
        # Шаг 4: Обновление счетчиков
        saga.update_counters(user)
        
        saga.commit_all()
        return user
    except Exception as e:
        saga.rollback_all()  # Компенсирующие транзакции
        raise
```

#### Вариант 3: Асинхронная обработка некритичных операций

```python
def _create_user_with_roles_and_products(self, current_user: User, data: Dict[str, Any]) -> User:
    # Критичная часть: создание пользователя
    user = self._create_user_core(data)
    db.session.commit()
    
    # Некритичная часть: отправить в фоновую задачу
    from ...tasks.user_tasks import assign_user_roles_and_products_async
    assign_user_roles_and_products_async.delay(user.id, data)
    
    return user
```

**Рекомендации:**
1. Разделить большую транзакцию на несколько меньших
2. Использовать оптимистичные блокировки для счетчиков проектов
3. Вынести некритичные операции (логирование, счетчики) в фоновые задачи
4. Добавить retry механизм для операций, которые могут временно не выполниться

---

### 2.4 Celery & Database Session Management

**Проблема:**
В `task_service.py` и декораторах задач есть ручное управление сессиями (`self._db_session = Session()`). Это частый источник утечек соединений (connection leaks), если `finally: session.close()` не отработает корректно при жестком падении воркера.

**Текущая реализация:**
```python
# backend/tasks/server_tasks.py
class DatabaseTask(Task):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._db_session = None

    def before_start(self, task_id, args, kwargs):
        self._db_session = Session()

    def after_return(self, *args, **kwargs):
        if self._db_session:
            try:
                self._db_session.commit()
            except:
                self._db_session.rollback()
            finally:
                self._db_session.close()
                self._db_session = None

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        if self._db_session:
            try:
                self._db_session.rollback()
            finally:
                self._db_session.close()
                self._db_session = None
```

**Риски:**
1. **Утечки соединений:** Если воркер упадет между `before_start` и `after_return`, сессия не закроется
2. **Нет гарантии закрытия:** При жестком kill процесса (`SIGKILL`) `finally` блоки не выполняются
3. **Дублирование кода:** Одинаковая логика в 4 файлах (`server_tasks.py`, `key_tasks.py`, `analytics_tasks.py`, `webhook_tasks.py`, `chat_tasks.py`)
4. **Нет контекстного менеджера:** Нельзя использовать `with session_scope():`

**Решение:**

#### Шаг 1: Создать контекстный менеджер для сессий в Celery задачах

```python
# backend/utils/celery_db_session.py
from contextlib import contextmanager
from sqlalchemy.orm import sessionmaker
from ...config.config import Config
from sqlalchemy import create_engine

# Создаем отдельный engine для Celery задач
_celery_db_engine = None
_CelerySession = None

def get_celery_db_engine():
    """Получить или создать engine для Celery задач"""
    global _celery_db_engine
    if _celery_db_engine is None:
        _celery_db_engine = create_engine(
            Config.SQLALCHEMY_DATABASE_URI,
            pool_pre_ping=True,  # Проверка соединений перед использованием
            pool_recycle=3600,   # Переиспользование соединений каждый час
        )
    return _celery_db_engine

def get_celery_session_factory():
    """Получить session factory для Celery задач"""
    global _CelerySession
    if _CelerySession is None:
        engine = get_celery_db_engine()
        _CelerySession = sessionmaker(bind=engine)
    return _CelerySession

@contextmanager
def celery_db_session():
    """
    Контекстный менеджер для работы с БД в Celery задачах.
    
    Гарантирует закрытие сессии даже при исключениях.
    
    Usage:
        with celery_db_session() as session:
            user = session.query(User).get(user_id)
            session.commit()
    """
    Session = get_celery_session_factory()
    session = Session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

#### Шаг 2: Рефакторинг DatabaseTask для использования контекстного менеджера

```python
# backend/tasks/server_tasks.py
from ...utils.celery_db_session import celery_db_session

class DatabaseTask(Task):
    """
    Base task class that provides database session management.
    
    Использует контекстный менеджер для гарантированного закрытия сессий.
    """
    
    def __call__(self, *args, **kwargs):
        """
        Переопределяем __call__ для использования контекстного менеджера.
        Это гарантирует закрытие сессии даже при жестком падении.
        """
        with celery_db_session() as session:
            # Передаем сессию в задачу через kwargs
            kwargs['_db_session'] = session
            return super().__call__(*args, **kwargs)
```

#### Шаг 3: Обновить задачи для использования сессии из kwargs

```python
@task_decorator(
    bind=True,
    base=DatabaseTask,
    name="backend.tasks.server_tasks.server_status_check",
)
def server_status_check(self, server_id, task_id=None, project_id=None, _db_session=None):
    """
    Check server status via SSH connection.
    
    Args:
        server_id: ID of the server to check
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
        _db_session: Database session (injected by DatabaseTask)
    """
    session = _db_session
    
    # Используем сессию как обычно
    if project_id:
        server = session.query(Server).filter_by(id=server_id, project_id=project_id).first()
    else:
        server = session.query(Server).get(server_id)
    
    # Сессия автоматически закроется после выхода из контекстного менеджера
    # ...
```

#### Шаг 4: Добавить мониторинг утечек соединений

```python
# backend/utils/celery_db_session.py
import logging
from sqlalchemy import event
from sqlalchemy.pool import Pool

logger = logging.getLogger(__name__)

@event.listens_for(Pool, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Логирование новых соединений"""
    logger.debug(f"New DB connection created: {id(dbapi_conn)}")

@event.listens_for(Pool, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Логирование checkout соединений"""
    logger.debug(f"DB connection checked out: {id(dbapi_conn)}")

@event.listens_for(Pool, "checkin")
def receive_checkin(dbapi_conn, connection_record):
    """Логирование checkin соединений"""
    logger.debug(f"DB connection checked in: {id(dbapi_conn)}")

@event.listens_for(Pool, "invalidate")
def receive_invalidate(dbapi_conn, connection_record, exception):
    """Логирование невалидных соединений"""
    logger.warning(f"DB connection invalidated: {id(dbapi_conn)}, exception: {exception}")
```

**Альтернативное решение: Использование Flask-SQLAlchemy session scoping**

Если возможно использовать Flask контекст в Celery задачах:

```python
from flask import Flask
from ...core.app import create_app

app = create_app()

@task_decorator(bind=True, base=DatabaseTask)
def server_status_check(self, server_id, task_id=None, project_id=None):
    with app.app_context():
        # Используем db.session из Flask-SQLAlchemy
        server = Server.query.filter_by(id=server_id).first()
        # Сессия автоматически управляется Flask-SQLAlchemy
```

**Рекомендации:**
1. Использовать контекстные менеджеры для гарантированного закрытия сессий
2. Добавить мониторинг пула соединений
3. Настроить `pool_pre_ping=True` для автоматического восстановления соединений
4. Установить разумные лимиты на размер пула (`pool_size`, `max_overflow`)

---

## 3. План действий

### Приоритет 1 (Критично - безопасность и стабильность)

1. **Рефакторинг DatabaseTask для предотвращения утечек соединений**
   - Создать `backend/utils/celery_db_session.py`
   - Обновить все `DatabaseTask` классы
   - Добавить мониторинг пула соединений
   - **Срок:** 1-2 недели

2. **Разделение транзакций в UserOrchestrator**
   - Разбить большую транзакцию на несколько меньших
   - Вынести некритичные операции в фоновые задачи
   - **Срок:** 2-3 недели

### Приоритет 2 (Важно - качество кода)

3. **Миграция на полный DI через конструкторы**
   - Начать с сервисов без циклических зависимостей
   - Постепенно мигрировать остальные
   - **Срок:** 1-2 месяца (постепенная миграция)

4. **Улучшение документации Redis Integrity Protection**
   - Добавить раздел в `SECURITY.md`
   - Автоматическое определение необходимости защиты
   - **Срок:** 1 неделя

### Приоритет 3 (Желательно - оптимизация)

5. **Оптимизация производительности**
   - Мониторинг использования `get_service()` внутри методов
   - Профилирование для выявления узких мест
   - **Срок:** Постоянно

---

## 4. Метрики успеха

### Для рефакторинга DI:
- Количество lazy imports `get_service()` внутри методов: **153 → < 20**
- Время выполнения тестов: не должно увеличиться
- Покрытие тестами: должно остаться на том же уровне или улучшиться

### Для DatabaseTask:
- Количество утечек соединений: **0** (мониторинг через логи)
- Размер пула соединений: стабильный, без роста
- Время жизни соединений: в пределах нормы

### Для UserOrchestrator:
- Время выполнения транзакций: уменьшение на 30-50%
- Количество блокировок БД: уменьшение на 40-60%
- Успешность операций: > 99.9%

---

## 5. Дополнительные рекомендации

### 5.1 Мониторинг и алертинг

Добавить метрики для:
- Количество активных соединений к БД
- Время выполнения транзакций
- Количество блокировок
- Использование пула соединений

### 5.2 Тестирование

Добавить тесты для:
- Проверки закрытия сессий в Celery задачах
- Проверки работы RLS при отсутствии фильтрации в коде
- Проверки работы DI контейнера

### 5.3 Документация

Создать/обновить:
- `SECURITY.md` - описание мер безопасности
- `ARCHITECTURE.md` - описание архитектуры и паттернов
- `DEVELOPMENT.md` - руководство для разработчиков

---

## Заключение

Проект имеет солидную архитектурную основу с хорошими практиками безопасности (RLS, Envelope Encryption). Основные проблемы связаны с:

1. **Незавершенной миграцией на DI** - требует постепенного рефакторинга
2. **Риском утечек соединений в Celery** - требует немедленного исправления
3. **Сложностью транзакций** - требует оптимизации для масштабирования

Рекомендуется начать с приоритета 1 (критичные проблемы), затем перейти к приоритету 2 (качество кода).