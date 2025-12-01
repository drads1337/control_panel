"""
Custom exceptions for service layer.

These exceptions replace the tuple return pattern (result, error) with
proper exception handling, making code more readable and Pythonic.

Usage:
    from ..utils.service_exceptions import ValidationError, NotFoundError, PermissionDeniedError
    
    def create_user(username: str):
        if not username:
            raise ValidationError("Username is required")
        
        if User.query.filter_by(username=username).first():
            raise ValidationError("Username already exists")
        
        return user  # Just return the result, no tuple
"""
class ServiceError(Exception):
    """Base exception for all service errors"""
    
    def __init__(self, message: str, status_code: int = 500, context: dict = None):
        self.message = message
        self.status_code = status_code
        self.context = context or {}
        super().__init__(self.message)

class ValidationError(ServiceError):
    """Raised when input validation fails"""
    
    def __init__(self, message: str, field: str = None, context: dict = None):
        self.field = field
        super().__init__(message, status_code=400, context=context or {})
        if field:
            self.context['field'] = field


class NotFoundError(ServiceError):
    """Raised when a requested resource is not found"""
    
    def __init__(self, resource_type: str, resource_id: str = None, context: dict = None):
        if resource_id:
            message = f"{resource_type} with id '{resource_id}' not found"
        else:
            message = f"{resource_type} not found"
        self.resource_type = resource_type
        self.resource_id = resource_id
        super().__init__(message, status_code=404, context=context or {})


class PermissionDeniedError(ServiceError):
    """Raised when user doesn't have permission to perform an action"""
    
    def __init__(self, message: str = "Permission denied", action: str = None, context: dict = None):
        if action:
            message = f"Permission denied: {action}"
        self.action = action
        super().__init__(message, status_code=403, context=context or {})


class ConflictError(ServiceError):
    """Raised when a resource conflict occurs (e.g., duplicate entry)"""
    
    def __init__(self, message: str, resource_type: str = None, context: dict = None):
        self.resource_type = resource_type
        super().__init__(message, status_code=409, context=context or {})


class BusinessLogicError(ServiceError):
    """Raised when business logic validation fails"""
    
    def __init__(self, message: str, context: dict = None):
        super().__init__(message, status_code=400, context=context or {})


class AuthenticationError(ServiceError):
    """Raised when authentication fails (invalid credentials)"""
    
    def __init__(self, message: str = "Invalid credentials", context: dict = None):
        super().__init__(message, status_code=401, context=context or {})


class SecurityError(ServiceError):
    """Raised when security constraints are violated"""
    
    def __init__(self, message: str, error_code: str = None, context: dict = None):
        self.error_code = error_code
        super().__init__(message, status_code=403, context=context or {})

