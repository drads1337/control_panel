# Error Handling Migration Guide

## Overview

This document outlines the migration from tuple return pattern `(result, error)` to exception-based error handling using `ServiceError` and its subclasses.

## Current State

Many services currently return tuples:
```python
def create_user(...) -> Tuple[Optional[User], Optional[str]]:
    if validation_fails:
        return None, "Error message"
    return user, None
```

Routes then check for errors:
```python
user, error = service.create_user(...)
if error:
    return jsonify({"error": error}), 400
```

## Target State

Services should raise exceptions:
```python
from ..utils.service_exceptions import ValidationError, NotFoundError

def create_user(...) -> User:
    if validation_fails:
        raise ValidationError("Error message", field="username")
    return user
```

Routes let the global exception handler catch errors:
```python
user = service.create_user(...)  # May raise ValidationError
return jsonify({"user": user.to_dict()}), 201
```

## Exception Types

Available exception classes in `utils/service_exceptions.py`:

- `ServiceError` - Base exception (status_code=500)
- `ValidationError` - Input validation failures (status_code=400)
- `NotFoundError` - Resource not found (status_code=404)
- `PermissionDeniedError` - Authorization failures (status_code=403)
- `ConflictError` - Resource conflicts (status_code=409)
- `BusinessLogicError` - Business rule violations (status_code=400)

## Migration Steps

### Step 1: Update Service Method

**Before:**
```python
def create_user(self, username: str, password: str) -> Tuple[Optional[User], Optional[str]]:
    if not username or not password:
        return None, "Username and password are required"
    
    if User.query.filter_by(username=username).first():
        return None, "Username already exists"
    
    try:
        user = User(username=username, password=hash_password(password))
        db.session.add(user)
        db.session.commit()
        return user, None
    except Exception as e:
        db.session.rollback()
        self.logger.error(f"Error creating user: {e}")
        return None, "Failed to create user"
```

**After:**
```python
from ...utils.service_exceptions import ValidationError, ConflictError

def create_user(self, username: str, password: str) -> User:
    if not username or not password:
        raise ValidationError("Username and password are required", field="username")
    
    if User.query.filter_by(username=username).first():
        raise ConflictError("Username already exists", resource_type="user")
    
    try:
        user = User(username=username, password=hash_password(password))
        db.session.add(user)
        db.session.commit()
        return user
    except Exception as e:
        db.session.rollback()
        self.logger.error(f"Error creating user: {e}", exc_info=True)
        raise ServiceError("Failed to create user", status_code=500) from e
```

### Step 2: Update Route Handler

**Before:**
```python
@route("/users", methods=["POST"])
def create_user():
    user, error = user_service.create_user(...)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"user": user.to_dict()}), 201
```

**After:**
```python
@route("/users", methods=["POST"])
def create_user():
    # Exception handler will catch ValidationError, ConflictError, etc.
    user = user_service.create_user(...)
    return jsonify({"user": user.to_dict()}), 201
```

### Step 3: Update Helper Functions

If helper functions call services, update them too:

**Before:**
```python
def create_user_with_roles(user_data):
    user, error = user_crud_service.create_user(...)
    if error:
        return None, error
    # ... assign roles
    return user, None
```

**After:**
```python
def create_user_with_roles(user_data):
    user = user_crud_service.create_user(...)  # Raises exception on error
    # ... assign roles
    return user
```

## Migration Priority

### High Priority (Critical Services)
1. `UserCRUDService.create_user()` - Used in user registration
2. `KeyCRUDService.create_key()` - Core functionality
3. `AuthService.login()` - Critical path
4. `ProjectService.create_project()` - Core functionality

### Medium Priority
5. All CRUD services (update, delete methods)
6. Permission/authorization services
7. Settings services

### Low Priority
8. Statistics/reporting services
9. Export services
10. Helper utilities

## Testing

After migrating a service:

1. **Unit Tests**: Update tests to expect exceptions instead of tuple returns:
   ```python
   # Before
   user, error = service.create_user("", "")
   assert error is not None
   
   # After
   with pytest.raises(ValidationError) as exc_info:
       service.create_user("", "")
   assert "required" in str(exc_info.value)
   ```

2. **Integration Tests**: Verify routes return correct status codes:
   ```python
   response = client.post("/api/users", json={"username": ""})
   assert response.status_code == 400
   assert "error" in response.json
   ```

## Benefits

1. **Cleaner Code**: No more `if error:` checks everywhere
2. **Type Safety**: Return types are explicit (no `Optional[User]`)
3. **Automatic Handling**: Global exception handler formats responses consistently
4. **Better Stack Traces**: Exceptions preserve call stack
5. **IDE Support**: Better autocomplete and type checking

## Rollback Plan

If issues arise, the global exception handler will catch unhandled exceptions and return 500 errors. Services can be migrated incrementally - old tuple-returning services will continue to work.

## Notes

- The global exception handler in `core/error_handlers.py` automatically handles all `ServiceError` subclasses
- In development mode, additional error details are included in responses
- All exceptions are logged with appropriate levels based on status code

