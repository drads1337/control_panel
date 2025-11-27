# ProjectService Refactoring Plan

## Текущее состояние

**ProjectService** (1085 строк) - "God Object" с множественной ответственностью:

### Текущие ответственности:
1. **CRUD операции**: create, update, delete, get
2. **Кэширование**: get_projects_cached, get_project_cached, invalidate_project_cache
3. **Статистика**: get_project_stats_cached
4. **Invite Codes**: create_project_invite_code, delete_project_invite_code, get_project_invite_codes, get_latest_project_invite_code

## План рефакторинга

### 1. ProjectCRUDService
**Ответственность**: Базовые CRUD операции с проектами
- `create_project()` - создание проекта
- `update_project()` - обновление проекта
- `delete_project()` - удаление проекта
- `get_project()` - получение проекта (без кэша)
- `_find_project_by_id_or_unique_id()` - helper метод

### 2. ProjectCacheService
**Ответственность**: Кэширование проектов
- `get_projects_cached()` - получение списка с кэшем
- `get_project_cached()` - получение одного проекта с кэшем
- `get_project_stats_cached()` - получение статистики с кэшем
- `invalidate_project_cache()` - инвалидация кэша

### 3. ProjectInviteService
**Ответственность**: Управление invite кодами
- `create_project_invite_code()` - создание invite кода
- `delete_project_invite_code()` - удаление invite кода
- `get_project_invite_codes()` - получение всех кодов
- `get_latest_project_invite_code()` - получение последнего кода

### 4. ProjectService (Facade)
**Ответственность**: Фасад для обратной совместимости
- Делегирует вызовы специализированным сервисам
- Сохраняет публичный API

## Преимущества

1. **Single Responsibility**: Каждый сервис отвечает за одну область
2. **Тестируемость**: Легче тестировать отдельные компоненты
3. **Поддерживаемость**: Изменения в одной области не влияют на другие
4. **Масштабируемость**: Легче добавлять новую функциональность

## Порядок выполнения

1. ✅ Создать ProjectCRUDService
2. ✅ Создать ProjectCacheService
3. ✅ Создать ProjectInviteService
4. ✅ Обновить ProjectService как фасад
5. ✅ Обновить все места использования
6. ✅ Тестирование

## Обратная совместимость

ProjectService останется как фасад, поэтому все существующие вызовы продолжат работать без изменений.

