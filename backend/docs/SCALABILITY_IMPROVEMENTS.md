# Улучшения масштабируемости и производительности

## Обзор

Этот документ описывает реализованные улучшения для повышения масштабируемости и производительности системы, особенно при работе с большими объемами данных.

## 1. Индексы для полнотекстового поиска

### Проблема

Использование `ILIKE` и `fulltext_search` без индексов GIN/GiST на больших объемах данных может привести к полному сканированию таблиц (full table scan), что значительно замедляет работу базы данных и может "положить" систему при больших нагрузках.

### Решение

Создана миграция `add_gin_indexes_for_fulltext_search`, которая добавляет GIN (Generalized Inverted Index) индексы на колонки `search_vector` для всех таблиц, использующих полнотекстовый поиск.

#### Затронутые таблицы:
- `user_activity` (партиционированная таблица)
- `project`
- `user`
- `server`
- `game`
- `changelog_entry`
- `key`

#### Применение миграции:

```bash
cd backend
flask db upgrade
```

#### Проверка индексов:

```sql
-- Проверить наличие GIN индексов
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE indexname LIKE '%search_vector_gin%'
ORDER BY tablename;
```

### Производительность

- **До**: Полное сканирование таблицы для каждого поискового запроса
- **После**: Использование индекса GIN для быстрого поиска по tsvector
- **Улучшение**: 10-100x ускорение для поисковых запросов на больших таблицах

### Важные замечания

1. **Партиционированные таблицы**: Для `user_activity` (партиционированная таблица) индексы автоматически создаются на всех партициях при создании индекса на родительской таблице.

2. **Проверка существования**: Миграция проверяет наличие колонки `search_vector` перед созданием индекса, поэтому безопасна для запуска даже если некоторые таблицы еще не имеют этой колонки.

3. **Откат**: Миграция поддерживает откат (downgrade), который удаляет индексы, но это не рекомендуется в production, так как это ухудшит производительность.

## 2. Разделение Redis инстансов

### Проблема

Использование одного Redis инстанса для всех типов данных (rate limit, cache, sessions, config, analytics buffer) создает единую точку отказа (SPOF - Single Point of Failure). При проблемах с Redis все компоненты системы перестают работать.

### Решение

Реализовано разделение Redis на два инстанса:

1. **Cache Instance (неперсистентный)**
   - Используется для кеша, который можно потерять без последствий
   - Настроен без персистентности (no AOF/RDB)
   - Быстрее и дешевле в обслуживании

2. **Persistent Instance (персистентный)**
   - Используется для критических данных: sessions, queues (Celery), rate limiting, dynamic config, analytics
   - Настроен с персистентностью (AOF/RDB)
   - Гарантирует сохранность данных

### Конфигурация

#### Переменные окружения:

```bash
# Cache Instance (non-persistent)
REDIS_CACHE_HOST=127.0.0.1
REDIS_CACHE_PORT=6379
REDIS_CACHE_DB=0
REDIS_CACHE_PASSWORD=

# Persistent Instance
REDIS_PERSISTENT_HOST=127.0.0.1
REDIS_PERSISTENT_PORT=6380  # Другой порт для разделения
REDIS_PERSISTENT_DB=0
REDIS_PERSISTENT_PASSWORD=
```

#### Разделение по базам данных (REDIS_DB_MAPPING):

Код уже поддерживает разделение через `REDIS_DB_MAPPING` в `backend/utils/redis_client.py`:

```python
REDIS_DB_MAPPING = {
    "sessions": {"db": Config.REDIS_DB_SESSIONS, "instance": "persistent"},
    "rate_limit": {"db": Config.REDIS_DB_RATE_LIMIT, "instance": "persistent"},
    "dynamic_config": {"db": Config.REDIS_DB_DYNAMIC_CONFIG, "instance": "persistent"},
    "analytics": {"db": Config.REDIS_DB_ANALYTICS, "instance": "persistent"},
    "cache": {"db": Config.REDIS_DB_CACHE, "instance": "cache"},
}
```

### Использование в коде

```python
from ..utils.redis_client import get_redis_client_for_db

# Для кеша (cache instance)
cache_client = get_redis_client_for_db("cache")
cache_client.set("cache:key", "value", ex=3600)

# Для сессий (persistent instance)
session_client = get_redis_client_for_db("sessions")
session_client.set("session:key", "value")

# Для rate limiting (persistent instance)
rate_limit_client = get_redis_client_for_db("rate_limit")
rate_limit_client.incr("rate:limit:key")
```

### Рекомендации по развертыванию

#### Вариант 1: Разные порты на одном сервере (для разработки/тестирования)

```bash
# Cache instance
redis-server --port 6379 --save "" --appendonly no

# Persistent instance
redis-server --port 6380 --save "" --appendonly yes
```

#### Вариант 2: Разные серверы (рекомендуется для production)

```bash
# Cache instance (можно терять данные)
redis-server --port 6379 --save "" --appendonly no --maxmemory 2gb --maxmemory-policy allkeys-lru

# Persistent instance (критические данные)
redis-server --port 6380 --save "" --appendonly yes --maxmemory 4gb --maxmemory-policy volatile-lru
```

#### Вариант 3: Redis Cluster (для высокой доступности)

Для production рекомендуется использовать Redis Cluster или Redis Sentinel для обеспечения высокой доступности и отказоустойчивости.

### Преимущества разделения

1. **Изоляция отказов**: Проблемы с кешем не влияют на сессии и rate limiting
2. **Оптимизация производительности**: Cache instance может быть настроен агрессивнее (LRU, no persistence)
3. **Масштабируемость**: Можно масштабировать инстансы независимо
4. **Безопасность**: Разделение снижает blast radius при компрометации

## 3. Асинхронные задачи (Celery)

### Текущая реализация

Использование Celery для тяжелых задач уже реализовано правильно:
- Рассылки уведомлений
- Создание ключей пачками
- Другие долгие операции

### Рекомендации

1. **Разделение воркеров**: Использовать разные воркеры для разных типов задач
   ```bash
   # Воркер для ключей
   celery -A backend.core.celery_app worker -Q key_tasks --loglevel=info
   
   # Воркер для серверов
   celery -A backend.core.celery_app worker -Q server_tasks --loglevel=info
   ```

2. **Мониторинг**: Настроить мониторинг Celery задач через Flower или аналогичные инструменты

3. **Retry стратегии**: Использовать exponential backoff для повторных попыток

## 4. Партиционирование таблиц

### Реализовано

Партиционирование таблицы `user_activity` по дате (created_at) уже реализовано в миграции `add_user_activity_partitioning`.

### Преимущества

- Улучшение производительности запросов по дате
- Упрощение управления данными (удаление старых партиций)
- Параллельная обработка запросов

## 5. Read Replica

### Реализовано

Использование read replica через SQLAlchemy binds реализовано грамотно в `backend/config/config.py`:

```python
SQLALCHEMY_BINDS = {}
if SQLALCHEMY_DATABASE_READ_URI:
    SQLALCHEMY_BINDS['read'] = SQLALCHEMY_DATABASE_READ_URI
```

### Использование

```python
# Для чтения использовать read replica
User.query.using_bind('read').filter_by(id=user_id).first()

# Для записи использовать primary
db.session.add(user)
db.session.commit()
```

## Чеклист для production

- [ ] Применить миграцию для GIN индексов
- [ ] Настроить раздельные Redis инстансы (cache и persistent)
- [ ] Настроить мониторинг производительности индексов
- [ ] Настроить мониторинг Redis (использование памяти, latency)
- [ ] Настроить алерты для медленных запросов
- [ ] Провести нагрузочное тестирование после изменений
- [ ] Документировать конфигурацию Redis для команды

## Мониторинг

### Проверка производительности индексов

```sql
-- Статистика использования индексов
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%search_vector_gin%'
ORDER BY idx_scan DESC;
```

### Проверка Redis

```bash
# Проверка использования памяти
redis-cli -p 6379 INFO memory

# Проверка подключений
redis-cli -p 6379 INFO clients

# Мониторинг команд
redis-cli -p 6379 MONITOR
```

## Дополнительные рекомендации

1. **Connection Pooling**: Использовать PgBouncer для connection pooling к PostgreSQL
2. **Query Optimization**: Регулярно анализировать медленные запросы через `pg_stat_statements`
3. **Caching Strategy**: Использовать многоуровневое кеширование (Redis + application cache)
4. **Database Maintenance**: Регулярно выполнять VACUUM и ANALYZE на больших таблицах
