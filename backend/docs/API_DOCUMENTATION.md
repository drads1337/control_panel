# API Documentation Guide

## Swagger/OpenAPI Documentation

Проект использует **Flasgger** для автоматической генерации интерактивной документации API на основе Swagger/OpenAPI спецификации.

### Доступ к документации

- **Swagger UI**: `http://localhost:5001/api/docs`
- **OpenAPI Spec (JSON)**: `http://localhost:5001/api/spec.json`

### Добавление документации к endpoints

Документация добавляется через docstring в формате YAML. Пример:

```python
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    User login endpoint
    
    ---
    tags:
      - Authentication
    summary: User login
    description: Authenticate user with username and password
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - username
              - password
            properties:
              username:
                type: string
                example: "admin"
              password:
                type: string
                format: password
                example: "password123"
    responses:
      200:
        description: Login successful
        content:
          application/json:
            schema:
              type: object
              properties:
                access_token:
                  type: string
                user_id:
                  type: string
    security: []
    """
    # Implementation...
```

### Использование Pydantic схем

Для автоматической генерации схем из Pydantic моделей можно использовать:

```python
from flasgger import swag_from
from ..schemas.auth import LoginRequestSchema, LoginResponseSchema

@auth_bp.route("/login", methods=["POST"])
@swag_from({
    'tags': ['Authentication'],
    'summary': 'User login',
    'requestBody': {
        'content': {
            'application/json': {
                'schema': LoginRequestSchema.schema()
            }
        }
    },
    'responses': {
        200: {
            'description': 'Login successful',
            'content': {
                'application/json': {
                    'schema': LoginResponseSchema.schema()
                }
            }
        }
    }
})
def login():
    # Implementation...
```

### Теги для организации

Endpoints автоматически группируются по тегам:
- `Authentication` - Аутентификация
- `Users` - Управление пользователями
- `Products` - Управление продуктами
- `Agents` - Управление агентами
- `Keys` - Управление ключами
- `Projects` - Управление проектами
- `Admin` - Административные функции

### Безопасность

Документация доступна только в **non-production** окружении для безопасности.

### Следующие шаги

1. Добавить документацию к основным endpoints:
   - `/api/users/*` - User management
   - `/api/products/*` - Product management
   - `/api/agents/*` - Agent management
   - `/api/keys/*` - Key management

2. Использовать Pydantic схемы для автоматической генерации:
   - Все схемы из `backend/schemas/` можно использовать
   - Схемы автоматически конвертируются в OpenAPI format

3. Добавить примеры запросов/ответов для каждого endpoint

### Полезные ссылки

- [Flasgger Documentation](https://github.com/flasgger/flasgger)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)

