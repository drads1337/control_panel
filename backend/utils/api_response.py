"""
Unified API Response Helper

Provides consistent API response structure across all endpoints.
This ensures all API responses follow the same format: {status, data, error}

Usage:
    from ...utils.api_response import success_response, error_response, paginated_response
    
    # Success response
    return success_response(data={"user_id": 1}, message="User created")
    
    # Error response
    return error_response("USER_NOT_FOUND", "User does not exist", status_code=404)
    
    # Paginated response
    return paginated_response(items=[...], page=1, per_page=20, total=100)
"""

from typing import Any, Dict, List, Optional, Tuple
from flask import jsonify, Response


def success_response(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200,
    **kwargs
) -> Tuple[Response, int]:
    """
    Create a standardized success response.
    
    Args:
        data: Response data (dict, list, or any serializable object)
        message: Optional success message
        status_code: HTTP status code (default: 200)
        **kwargs: Additional fields to include in response
    
    Returns:
        Tuple of (Flask Response, status_code)
    
    Example:
        return success_response(
            data={"user_id": 1, "username": "john"},
            message="User created successfully"
        )
        # Returns: {"status": "success", "data": {...}, "message": "User created successfully"}
    """
    response_data: Dict[str, Any] = {
        "status": "success",
    }
    
    if data is not None:
        response_data["data"] = data
    
    if message:
        response_data["message"] = message
    

    response_data.update(kwargs)
    
    return jsonify(response_data), status_code


def error_response(
    error: str,
    message: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    status_code: int = 400,
    **kwargs
) -> Tuple[Response, int]:
    """
    Create a standardized error response.
    
    Args:
        error: Error code (e.g., "USER_NOT_FOUND", "VALIDATION_ERROR")
        message: Human-readable error message
        details: Optional error details (e.g., validation errors)
        status_code: HTTP status code (default: 400)
        **kwargs: Additional fields to include in response
    
    Returns:
        Tuple of (Flask Response, status_code)
    
    Example:
        return error_response(
            error="VALIDATION_ERROR",
            message="Invalid input data",
            details={"field": "email", "reason": "Invalid format"},
            status_code=422
        )
        # Returns: {"status": "error", "error": "VALIDATION_ERROR", "message": "...", "details": {...}}
    """
    response_data: Dict[str, Any] = {
        "status": "error",
        "error": error,
    }
    
    if message:
        response_data["message"] = message
    
    if details:
        response_data["details"] = details
    

    response_data.update(kwargs)
    
    return jsonify(response_data), status_code


def paginated_response(
    items: List[Any],
    page: int,
    per_page: int,
    total: int,
    message: Optional[str] = None,
    status_code: int = 200,
    **kwargs
) -> Tuple[Response, int]:
    """
    Create a standardized paginated response.
    
    Args:
        items: List of items for current page
        page: Current page number (1-indexed)
        per_page: Number of items per page
        total: Total number of items across all pages
        message: Optional message
        status_code: HTTP status code (default: 200)
        **kwargs: Additional fields to include in response
    
    Returns:
        Tuple of (Flask Response, status_code)
    
    Example:
        return paginated_response(
            items=[{"id": 1}, {"id": 2}],
            page=1,
            per_page=20,
            total=100
        )
        # Returns: {
        #   "status": "success",
        #   "data": {"items": [...], "pagination": {"page": 1, "per_page": 20, "total": 100, "pages": 5}}
        # }
    """
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    
    pagination_data = {
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
    
    data = {
        "items": items,
        "pagination": pagination_data,
    }
    
    return success_response(data=data, message=message, status_code=status_code, **kwargs)


def validation_error_response(
    errors: Dict[str, List[str]],
    message: Optional[str] = None,
    status_code: int = 422
) -> Tuple[Response, int]:
    """
    Create a standardized validation error response.
    
    Args:
        errors: Dictionary mapping field names to list of error messages
        message: Optional general error message
        status_code: HTTP status code (default: 422)
    
    Returns:
        Tuple of (Flask Response, status_code)
    
    Example:
        return validation_error_response(
            errors={"email": ["Invalid format"], "password": ["Too short"]},
            message="Validation failed"
        )
    """
    return error_response(
        error="VALIDATION_ERROR",
        message=message or "Validation failed",
        details={"validation_errors": errors},
        status_code=status_code
    )


def not_found_response(
    resource: str,
    identifier: Optional[str] = None,
    status_code: int = 404
) -> Tuple[Response, int]:
    """
    Create a standardized not found error response.
    
    Args:
        resource: Resource type (e.g., "User", "Project")
        identifier: Optional resource identifier
        status_code: HTTP status code (default: 404)
    
    Returns:
        Tuple of (Flask Response, status_code)
    
    Example:
        return not_found_response("User", identifier="123")
        # Returns: {"status": "error", "error": "NOT_FOUND", "message": "User not found", "details": {"resource": "User", "identifier": "123"}}
    """
    message = f"{resource} not found"
    if identifier:
        message += f" (id: {identifier})"
    
    return error_response(
        error="NOT_FOUND",
        message=message,
        details={"resource": resource, "identifier": identifier},
        status_code=status_code
    )


def unauthorized_response(
    message: Optional[str] = None,
    status_code: int = 401
) -> Tuple[Response, int]:
    """
    Create a standardized unauthorized error response.
    
    Args:
        message: Optional error message
        status_code: HTTP status code (default: 401)
    
    Returns:
        Tuple of (Flask Response, status_code)
    """
    return error_response(
        error="UNAUTHORIZED",
        message=message or "Authentication required",
        status_code=status_code
    )


def forbidden_response(
    message: Optional[str] = None,
    status_code: int = 403
) -> Tuple[Response, int]:
    """
    Create a standardized forbidden error response.
    
    Args:
        message: Optional error message
        status_code: HTTP status code (default: 403)
    
    Returns:
        Tuple of (Flask Response, status_code)
    """
    return error_response(
        error="FORBIDDEN",
        message=message or "Insufficient permissions",
        status_code=status_code
    )


def internal_error_response(
    message: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    status_code: int = 500
) -> Tuple[Response, int]:
    """
    Create a standardized internal server error response.
    
    Args:
        message: Optional error message
        details: Optional error details (should not expose sensitive information)
        status_code: HTTP status code (default: 500)
    
    Returns:
        Tuple of (Flask Response, status_code)
    """
    return error_response(
        error="INTERNAL_ERROR",
        message=message or "An internal error occurred",
        details=details,
        status_code=status_code
    )

