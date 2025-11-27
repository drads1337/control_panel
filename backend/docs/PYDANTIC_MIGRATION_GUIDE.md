# Pydantic Migration Guide

## Обзор

Этот документ описывает процесс миграции роутов с `request.get_json()` на использование Pydantic схем через декоратор `@validate_request`.

## Преимущества миграции

1. **Безопасность**: Автоматическая валидация типов и форматов данных
2. **Надежность**: Защита от ошибок типизации и отсутствующих полей
3. **Документация**: Схемы служат документацией API
4. **Единообразие**: Единый подход к валидации во всех роутах

## Процесс миграции

### Шаг 1: Создание Pydantic схемы

Создайте схему в `backend/schemas/`:

```python
from pydantic import BaseModel, Field, HttpUrl
from .common import BaseSchema

class MyResourceCreateSchema(BaseSchema):
    """Schema for creating a resource"""
    name: str = Field(..., min_length=1, max_length=255)
    url: Optional[HttpUrl] = Field(default=None)
    is_active: bool = Field(default=True)
```

### Шаг 2: Обновление роута

**До:**
```python
@my_bp.route("/", methods=["POST"])
@jwt_required()
def create_resource():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request data required"}), 400
    
    name = data.get("name")
    url = data.get("url")
    # ... валидация вручную
```

**После:**
```python
from ..middleware.validation import validate_request
from ..schemas.my_resource import MyResourceCreateSchema

@my_bp.route("/", methods=["POST"])
@jwt_required()
@validate_request(MyResourceCreateSchema)
def create_resource(validated_data=None):
    data = MyResourceCreateSchema(**validated_data)
    
    # data.name, data.url уже валидированы
    # ...
```

### Шаг 3: Обработка обновлений (PUT/PATCH)

Для частичных обновлений используйте `strict=False`:

```python
@my_bp.route("/<int:resource_id>", methods=["PUT"])
@jwt_required()
@validate_request(MyResourceUpdateSchema, strict=False)
def update_resource(resource_id, validated_data=None):
    data = MyResourceUpdateSchema(**validated_data)
    update_data = data.model_dump(exclude_none=True)
    # ...
```

## Примеры

### ✅ Пример: Webhooks (завершено)

- Схемы: `backend/schemas/webhook.py`
- Роуты: `backend/routes/webhooks.py`
- Эндпоинты: `POST /webhooks/`, `PUT /webhooks/<id>`

### ✅ Пример: Settings (частично завершено)

- Схемы: `backend/schemas/settings.py`
- Роуты: `backend/routes/settings.py`
- Эндпоинты:
  - `POST /api/settings/fingerprint-lists/blocked` - Block fingerprint
  - `POST /api/settings/ip-lists/blocked` - Block IP
  - `POST /api/settings/hwid-lists/blocked` - Block HWID
  - `POST /api/settings/security/rules` - Create security rule
  - `PUT /api/settings/security/rules/<id>` - Update security rule
  - `PUT /api/settings/keys` - Update encryption keys
  - `POST /api/settings/keys` - Regenerate keys (action parameter)

### ✅ Пример: Projects (завершено)

- Схемы: `backend/schemas/project.py` (обновлены)
- Роуты: `backend/routes/projects.py`
- Эндпоинты:
  - `POST /projects` - Create project (убраны fallback на request.get_json())
  - `PUT /projects/<id>` - Update project (убраны fallback на request.get_json())
  - `POST /project-codes` - Create invite code (новый с Pydantic)

### ✅ Пример: Balance (завершено)

- Схемы: `backend/schemas/balance.py`
- Роуты: `backend/routes/users/balance.py`
- Эндпоинты:
  - `POST /users/balance/topup` - Top up user balance
  - `POST /users/balance/deduct` - Deduct from user balance
  - `GET /users/balance/transactions` - Get transaction history (query params)

### ✅ Пример: Tokens (завершено)

- Схемы: `backend/schemas/token.py`
- Роуты: `backend/routes/users/tokens.py`
- Эндпоинты:
  - `POST /users/<user_id>/tokens` - Create API token
  - `PUT /users/<user_id>/tokens/<token_id>` - Update API token

### ✅ Пример: Profile (завершено)

- Схемы: `backend/schemas/user.py` (UserProfileUpdateSchema), `backend/schemas/auth.py` (ChangePasswordRequestSchema)
- Роуты: `backend/routes/users/profile.py`
- Эндпоинты:
  - `PUT /users/profile` - Update user profile
  - `POST /users/change_password` - Change password

### ✅ Пример: Files (завершено)

- Схемы: `backend/schemas/file.py`
- Роуты: `backend/routes/files.py`
- Эндпоинты:
  - `POST /files/bulk` - Bulk file operations (delete)
  - `PUT /files/product-files/extra/<file_id>/status` - Update file status
  - `PUT /files/product-files/config/<config_id>` - Update file config
  - `POST /files/product-files/config/<config_id>/rate` - Rate file
  - `POST /files/folders` - Create folder

### ✅ Пример: Notifications (завершено)

- Схемы: `backend/schemas/notification.py` (обновлены)
- Роуты: `backend/routes/notifications.py`
- Эндпоинты:
  - `POST /notifications` - Create notification (убраны fallback на request.get_json())
  - `POST /notifications/send` - Send notifications (убраны fallback на request.get_json())
  - `POST /notifications/bulk-action` - Bulk actions (убраны fallback на request.get_json())
  - `POST /notifications/system` - System notification (новый с Pydantic)
  - `POST /notifications/bulk-create` - Bulk create (новый с Pydantic)
  - `POST /notifications/product-update` - Product update notification (новый с Pydantic)
  - `POST /notifications/cleanup` - Cleanup notifications (новый с Pydantic)
  - `POST /notifications/loader-update` - Loader update notification (новый с Pydantic)
  - `POST /notifications/products/<product_id>` - Product notification (новый с Pydantic)
  - `POST /notifications/agents/<agent_id>` - Agent notification (новый с Pydantic)

### ✅ Пример: RBAC (завершено)

- Схемы: `backend/schemas/rbac.py`
- Роуты: `backend/routes/rbac.py`
- Эндпоинты:
  - `POST /rbac/roles` - Create role (новый с Pydantic)
  - `PUT /rbac/roles/<role_id>` - Update role (новый с Pydantic)
  - `DELETE /rbac/roles/<role_id>` - Delete role (новый с Pydantic)
  - `POST /rbac/permissions` - Create permission (новый с Pydantic)
  - `PUT /rbac/permissions/<permission_id>` - Update permission (новый с Pydantic)
  - `POST /rbac/users/<user_id>/roles` - Assign role to user (новый с Pydantic)
  - `POST /rbac/users/<user_id>/permissions` - Assign permissions to user (новый с Pydantic)
  - `POST /rbac/check-permission` - Check permission (новый с Pydantic)
  - `POST /rbac/abac/rules` - Create ABAC rule (новый с Pydantic)
  - `POST /rbac/abac/users/<user_id>/attributes` - Set user attribute (новый с Pydantic)
  - `POST /rbac/abac/resources/attributes` - Set resource attribute (новый с Pydantic)
  - `POST /rbac/roles/<role_id>/permissions` - Assign permission to role (новый с Pydantic)
  - `PUT /rbac/roles/<role_id>/permissions` - Update role permissions (новый с Pydantic)

### ✅ Пример: Auth (завершено)

- Схемы: `backend/schemas/auth.py` (обновлены)
- Роуты: `backend/routes/auth.py`
- Эндпоинты:
  - `POST /auth/register-with-invite` - Register with invite code (новый с Pydantic)
  - `POST /auth/validate-code` - Validate access code (новый с Pydantic)
  - `POST /auth/activate-code` - Activate access code (новый с Pydantic)
  - `POST /auth/register-classic` - Classic Login registration (новый с Pydantic)
  - `POST /auth/validate-invite` - Validate invite code (новый с Pydantic)

### ✅ Пример: Agents (завершено)

- Схемы: `backend/schemas/agent.py`
- Роуты: `backend/routes/agents.py`
- Эндпоинты:
  - `POST /agents` - Create agent (новый с Pydantic)
  - `PUT /agents/<agent_id>` - Update agent (новый с Pydantic)
  - `POST /agents/<agent_id>/assign-products` - Assign products to agent (новый с Pydantic)
  - `PUT /agents/<agent_id>/status` - Update agent status (новый с Pydantic)
  - `PUT /agents/<agent_id>/config` - Update agent config (login type) (новый с Pydantic)

### ✅ Пример: Product Prices (завершено)

- Схемы: `backend/schemas/price.py`
- Роуты: `backend/routes/products/prices.py`
- Эндпоинты:
  - `PUT /products/<product_id>/prices` - Update product prices (новый с Pydantic)
  - `POST /products/<product_id>/prices/custom` - Create custom price period (новый с Pydantic)

### ✅ Пример: User Management (завершено)

- Схемы: `backend/schemas/user.py` (обновлены)
- Роуты: `backend/routes/users/management.py`
- Эндпоинты:
  - `POST /users` - Create user (убраны fallback на request.get_json())
  - `PUT /users/<user_id>` - Update user (убраны fallback на request.get_json())
  - `POST /users/bulk-action` - Bulk user actions (новый с Pydantic)
  - `POST /users/invite` - Invite user (новый с Pydantic)

### ✅ Пример: Key Management (завершено)

- Схемы: `backend/schemas/key.py` (уже существовали)
- Роуты: `backend/routes/keys/management.py`
- Эндпоинты:
  - `POST /keys` - Create key (убраны fallback на request.get_json())
  - `POST /keys/custom` - Create custom key (убраны fallback на request.get_json())
  - `PUT /keys/<key_id>` - Update key (убраны fallback на request.get_json())
  - `POST /keys/<key_id>/extend` - Extend key (убраны fallback на request.get_json())
  - `POST /keys/<key_id>/move` - Move key (убраны fallback на request.get_json())

### ✅ Пример: Product Bulk Operations (завершено)

- Схемы: `backend/schemas/product.py` (обновлены)
- Роуты: `backend/routes/products/bulk_operations.py`
- Эндпоинты:
  - `PUT /products/bulk-status` - Bulk update product status (новый с Pydantic)
  - `DELETE /products/bulk` - Bulk delete products (новый с Pydantic)

### ✅ Пример: Key Bulk Operations (завершено)

- Схемы: `backend/schemas/key.py` (обновлены)
- Роуты: `backend/routes/keys/bulk_operations.py`
- Эндпоинты:
  - `POST /keys/bulk` - Bulk create keys (новый с Pydantic)
  - `DELETE /keys/bulk` - Bulk delete keys (новый с Pydantic)
  - `POST /keys/bulk/reset` - Bulk reset keys (новый с Pydantic)
  - `POST /keys/bulk/pause` - Bulk pause keys (новый с Pydantic)
  - `POST /keys/bulk/resume` - Bulk resume keys (новый с Pydantic)
  - `POST /keys/bulk/extend` - Bulk extend keys (новый с Pydantic)
  - `POST /keys/bulk/pause-by-product` - Bulk pause keys by product (новый с Pydantic)
  - `POST /keys/bulk/resume-by-product` - Bulk resume keys by product (новый с Pydantic)
  - `POST /keys/bulk/reset-by-product` - Bulk reset keys by product (новый с Pydantic)
  - `POST /keys/bulk/extend-by-product` - Bulk extend keys by product (новый с Pydantic)
  - `DELETE /keys/bulk/by-filters` - Bulk delete keys by filters (новый с Pydantic)
  - `POST /keys/bulk/reset-by-filters` - Bulk reset keys by filters (новый с Pydantic)
  - `POST /keys/bulk/extend-by-filters` - Bulk extend keys by filters (новый с Pydantic)

### ✅ Пример: Key Validation (завершено)

- Схемы: `backend/schemas/key.py` (KeyValidateSchema уже существовала)
- Роуты: `backend/routes/keys/validation.py`
- Эндпоинты:
  - `POST /keys/validate` - Validate key (убраны fallback на request.get_json())

### ✅ Пример: Sessions (завершено)

- Схемы: `backend/schemas/session.py`
- Роуты: `backend/routes/sessions.py`
- Эндпоинты:
  - `POST /sessions/bulk-terminate` - Bulk terminate sessions (новый с Pydantic)
  - `POST /sessions/bulk-logout` - Bulk logout users (новый с Pydantic)

### ✅ Пример: Servers (завершено)

- Схемы: `backend/schemas/server.py`
- Роуты: `backend/routes/servers.py`
- Эндпоинты:
  - `POST /servers` - Create server (новый с Pydantic)
  - `DELETE /servers/bulk` - Bulk delete servers (новый с Pydantic)

### ✅ Пример: Referral Codes (завершено)

- Схемы: `backend/schemas/referral.py`
- Роуты: `backend/routes/users/referral_codes.py`
- Эндпоинты:
  - `POST /refcodes` - Create referral code (новый с Pydantic)

### ✅ Пример: Changelog (завершено)

- Схемы: `backend/schemas/changelog.py`
- Роуты: `backend/routes/changelog.py`
- Эндпоинты:
  - `POST /products/<product_id>/changelog` - Create product changelog entry (новый с Pydantic)
  - `PUT /products/<product_id>/changelog/<entry_id>` - Update changelog entry (новый с Pydantic)
  - `POST /agents/<agent_id>/changelog` - Create agent changelog entry (новый с Pydantic)

### ✅ Пример: Remote Control (завершено)

- Схемы: `backend/schemas/remote_control.py`
- Роуты: `backend/routes/remote_control.py`
- Эндпоинты:
  - `POST /remote/categories` - Create remote category (новый с Pydantic)
  - `PUT /remote/categories/<category_id>` - Update remote category (новый с Pydantic)
  - `POST /remote/features` - Create remote feature (новый с Pydantic)
  - `PUT /remote/features/<feature_id>` - Update remote feature (новый с Pydantic)

### 📋 Осталось мигрировать

Следующие файлы все еще используют `request.get_json()`:

- `backend/routes/chat.py`
- `backend/routes/settings.py`
- `backend/routes/files.py`
- `backend/routes/projects.py`
- `backend/routes/analytics.py`
- `backend/routes/servers.py`
- И другие (см. `grep -r "request.get_json" backend/routes/`)

## Рекомендации

1. **Начните с критичных эндпоинтов**: Auth, Settings, Webhooks
2. **Используйте существующие схемы**: Проверьте `backend/schemas/` перед созданием новых
3. **Тестируйте валидацию**: Убедитесь, что все edge cases покрыты
4. **Обновляйте документацию**: Добавьте примеры использования в API документацию

## Полезные ссылки

- [Pydantic Documentation](https://docs.pydantic.dev/)
- Существующие схемы: `backend/schemas/`
- Middleware валидации: `backend/middleware/validation.py`

