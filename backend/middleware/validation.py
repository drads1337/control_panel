"""
Validation middleware for request data validation using Pydantic
"""

import json
import logging
from functools import wraps
from typing import Any, Dict, Optional, Type

from flask import current_app, jsonify, request
from pydantic import BaseModel, ValidationError
from werkzeug.exceptions import BadRequest

try:
    from ..utils.service_exceptions import ServiceError
except ImportError:
    ServiceError = None

logger = logging.getLogger(__name__)

def _sanitize_validation_errors(errors: list) -> list:
    """
    Sanitize validation errors to ensure they are JSON serializable.
    Converts any non-serializable objects (like ValueError) to strings.
    
    Args:
        errors: List of error dictionaries from Pydantic ValidationError
        
    Returns:
        List of sanitized error dictionaries
    """
    def _make_serializable(obj):
        """Recursively convert object to JSON-serializable format"""
        if obj is None:
            return None
        elif isinstance(obj, (str, int, float, bool)):
            return obj
        elif isinstance(obj, (list, tuple)):
            return [_make_serializable(item) for item in obj]
        elif isinstance(obj, dict):
            return {str(k): _make_serializable(v) for k, v in obj.items()}
        else:
            # Convert any other type (like ValueError, Exception) to string
            try:
                # Try to get a meaningful string representation
                return str(obj)
            except Exception:
                return repr(obj)
    
    return [_make_serializable(error) for error in errors]

class ValidationMiddleware:
    """Middleware for validating request data using Pydantic schemas"""

    @staticmethod
    def validate_json(
        schema_class: Type[BaseModel], allow_empty: bool = False, strict: bool = True
    ) -> callable:
        """
        Decorator to validate JSON request data against a Pydantic schema

        Args:
            schema_class: Pydantic schema class to validate against
            allow_empty: Whether to allow empty request body
            strict: Whether to use strict validation mode

        Returns:
            Decorated function with validation
        """

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:
                    # Check if request is JSON - accept both application/json and product/json
                    content_type = request.headers.get('Content-Type', '').lower()
                    is_json_request = (
                        request.is_json or 
                        content_type == 'product/json' or
                        content_type.startswith('product/json;')
                    )

                    if not is_json_request:
                        if allow_empty and not request.get_data():

                            validated_data = {}
                        else:
                            return (
                                jsonify(
                                    {
                                        "error": "INVALID_CONTENT_TYPE",
                                        "message": "Request must be JSON",
                                    }
                                ),
                                400,
                            )
                    else:
                        # Get JSON data - manually parse for product/json, otherwise use Flask's parser
                        json_data = None
                        if content_type == 'product/json' or content_type.startswith('product/json;'):
                            # Manually parse JSON for product/json content type
                            try:
                                raw_data = request.get_data(as_text=True)
                                if raw_data:
                                    json_data = json.loads(raw_data)
                                else:
                                    json_data = {}
                            except (json.JSONDecodeError, UnicodeDecodeError):
                                json_data = None
                        else:
                            json_data = request.get_json(silent=True)
                        
                        if json_data is None:
                            if allow_empty:
                                validated_data = {}
                            else:
                                return (
                                    jsonify(
                                        {"error": "INVALID_JSON", "message": "Invalid JSON data"}
                                    ),
                                    400,
                                )
                        else:

                            try:
                                if strict:
                                    validated_data = schema_class(**json_data).model_dump()
                                else:
                                    validated_data = schema_class(**json_data).model_dump(
                                        exclude_unset=True
                                    )
                            except ValidationError as e:
                                return (
                                    jsonify(
                                        {
                                            "error": "VALIDATION_ERROR",
                                            "message": "Request validation failed",
                                            "details": _sanitize_validation_errors(e.errors()),
                                        }
                                    ),
                                    400,
                                )

                    kwargs["validated_data"] = validated_data

                    return func(*args, **kwargs)

                except BadRequest as e:
                    logger.warning(f"Bad request in validation middleware: {str(e)}")
                    return (
                        jsonify({"error": "BAD_REQUEST", "message": "Invalid request format"}),
                        400,
                    )
                except Exception as e:
                    # Let ServiceError exceptions pass through to be handled by global error handler
                    if ServiceError and isinstance(e, ServiceError):
                        raise
                    
                    import traceback
                    error_traceback = traceback.format_exc()
                    logger.error(f"Unexpected error in validation middleware: {str(e)}\n{error_traceback}")

                    error_response = {
                        "error": "INTERNAL_ERROR",
                        "message": "Internal server error"
                    }

                    if current_app.debug:
                        error_response["details"] = str(e)
                        error_response["traceback"] = error_traceback.split("\n")

                    return jsonify(error_response), 500

            return wrapper

        return decorator

    @staticmethod
    def validate_query_params(schema_class: Type[BaseModel]) -> callable:
        """
        Decorator to validate query parameters against a Pydantic schema

        Args:
            schema_class: Pydantic schema class to validate against

        Returns:
            Decorated function with validation
        """

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:

                    query_params = dict(request.args)

                    converted_params = {}
                    for key, value in query_params.items():
                        if isinstance(value, list) and len(value) == 1:

                            converted_params[key] = value[0]
                        elif isinstance(value, list):

                            converted_params[key] = value
                        else:
                            converted_params[key] = value

                    try:
                        validated_params = schema_class(**converted_params).model_dump()
                    except ValidationError as e:
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Query parameter validation failed",
                                    "details": _sanitize_validation_errors(e.errors()),
                                }
                            ),
                            400,
                        )

                    kwargs["validated_params"] = validated_params

                    return func(*args, **kwargs)

                except Exception as e:
                    # Let ServiceError exceptions pass through to be handled by global error handler
                    if ServiceError and isinstance(e, ServiceError):
                        raise
                    
                    import traceback
                    error_traceback = traceback.format_exc()
                    logger.error(f"Unexpected error in query validation middleware: {str(e)}\n{error_traceback}")

                    error_response = {
                        "error": "INTERNAL_ERROR",
                        "message": "Internal server error"
                    }

                    if current_app.debug:
                        error_response["details"] = str(e)
                        error_response["traceback"] = error_traceback.split("\n")

                    return jsonify(error_response), 500

            return wrapper

        return decorator

    @staticmethod
    def validate_form_data(schema_class: Type[BaseModel]) -> callable:
        """
        Decorator to validate form data against a Pydantic schema

        Args:
            schema_class: Pydantic schema class to validate against

        Returns:
            Decorated function with validation
        """

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:

                    form_data = dict(request.form)

                    files_data = {}
                    for key, file in request.files.items():
                        files_data[key] = file

                    all_data = {**form_data, **files_data}

                    try:
                        validated_data = schema_class(**all_data).model_dump()
                    except ValidationError as e:
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Form data validation failed",
                                    "details": _sanitize_validation_errors(e.errors()),
                                }
                            ),
                            400,
                        )

                    kwargs["validated_data"] = validated_data

                    return func(*args, **kwargs)

                except Exception as e:
                    # Let ServiceError exceptions pass through to be handled by global error handler
                    if ServiceError and isinstance(e, ServiceError):
                        raise
                    
                    import traceback
                    error_traceback = traceback.format_exc()
                    logger.error(f"Unexpected error in form validation middleware: {str(e)}\n{error_traceback}")

                    error_response = {
                        "error": "INTERNAL_ERROR",
                        "message": "Internal server error"
                    }

                    if current_app.debug:
                        error_response["details"] = str(e)
                        error_response["traceback"] = error_traceback.split("\n")

                    return jsonify(error_response), 500

            return wrapper

        return decorator

def validate_request(
    schema_class: Type[BaseModel],
    data_type: str = "json",
    allow_empty: bool = False,
    strict: bool = True,
) -> callable:
    """
    Convenience function for request validation

    Args:
        schema_class: Pydantic schema class to validate against
        data_type: Type of data to validate ('json', 'query', 'form')
        allow_empty: Whether to allow empty request body (for JSON)
        strict: Whether to use strict validation mode

    Returns:
        Decorated function with validation
    """
    if data_type == "json":
        return ValidationMiddleware.validate_json(schema_class, allow_empty, strict)
    elif data_type == "query":
        return ValidationMiddleware.validate_query_params(schema_class)
    elif data_type == "form":
        return ValidationMiddleware.validate_form_data(schema_class)
    else:
        raise ValueError(f"Unsupported data type: {data_type}")

def validate_response(schema_class: Type[BaseModel]) -> callable:
    """
    Decorator to validate response data against a Pydantic schema

    Args:
        schema_class: Pydantic schema class to validate against

    Returns:
        Decorated function with response validation
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:

                response = func(*args, **kwargs)

                if isinstance(response, tuple) and len(response) == 2:
                    data, status_code = response
                else:
                    data = response
                    status_code = 200

                if isinstance(data, dict):
                    try:

                        response_obj = schema_class(**data)

                        validated_data = response_obj.model_dump()

                        return jsonify(validated_data), status_code
                    except ValidationError as e:
                        logger.warning(f"Response validation failed: {e.errors()}")

                        return jsonify(data), status_code

                return response

            except Exception as e:
                logger.error(f"Unexpected error in response validation: {str(e)}")
                return func(*args, **kwargs)

        return wrapper

    return decorator
