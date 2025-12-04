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

            try:

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
                logger.info(f"Validation middleware ENTRY for {request.method} {request.path}")
                logger.info(f"Function: {func.__name__}, Schema: {schema_class.__name__}")
                validated_data = None
                try:

                    request_data = request.get_data()
                    logger.debug(f"Request data length: {len(request_data) if request_data else 0}, allow_empty: {allow_empty}")
                    if not request_data and not allow_empty:
                        logger.debug(f"Empty request body detected for {request.method} {request.path}")
                        return (
                            jsonify(
                                {
                                    "error": "INVALID_JSON",
                                    "message": "Request body is required and must be valid JSON"
                                }
                            ),
                            400,
                        )
                    

                    content_type = request.headers.get('Content-Type', '').lower()
                    is_json_request = (
                        request.is_json or 
                        content_type == 'application/json' or
                        content_type.startswith('application/json;')
                    )
                    logger.debug(f"Content-Type: {content_type}, is_json: {request.is_json}, is_json_request: {is_json_request}")

                    if not is_json_request:
                        logger.debug(f"Not a JSON request for {request.method} {request.path}")
                        if allow_empty and not request.get_data():
                            logger.debug(f"Setting validated_data to empty dict (allow_empty=True)")
                            validated_data = {}
                        else:
                            logger.debug(f"Returning INVALID_CONTENT_TYPE error")
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
                        logger.debug(f"Processing JSON request for {request.method} {request.path}")

                        json_data = None
                        if content_type == 'application/json' or content_type.startswith('application/json;'):

                            try:
                                raw_data = request.get_data(as_text=True)
                                if raw_data and raw_data.strip():
                                    json_data = json.loads(raw_data)
                                else:

                                    json_data = None
                            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                                logger.warning(f"JSON decode error for {request.method} {request.path}: {str(e)}")
                                json_data = None
                        else:

                            try:
                                json_data = request.get_json(silent=True, force=True)
                            except Exception as json_error:
                                logger.warning(f"Error parsing JSON for {request.method} {request.path}: {str(json_error)}")
                                json_data = None
                        

                        if json_data is not None and not isinstance(json_data, dict):
                            logger.warning(f"JSON data is not a dict (type: {type(json_data)}) for {request.method} {request.path}, converting or rejecting")
                            if allow_empty:
                                json_data = {}
                            else:
                                return (
                                    jsonify(
                                        {"error": "INVALID_JSON", "message": "Request body must be a JSON object"}
                                    ),
                                    400,
                                )
                        
                        logger.debug(f"Parsed json_data: {json_data} (type: {type(json_data)})")
                        if json_data is None:
                            logger.debug(f"json_data is None, allow_empty: {allow_empty}")
                            if allow_empty:
                                logger.debug(f"Setting validated_data to empty dict (allow_empty=True, json_data=None)")
                                validated_data = {}
                            else:
                                logger.debug(f"Returning INVALID_JSON error (json_data=None, allow_empty=False)")
                                return (
                                    jsonify(
                                        {"error": "INVALID_JSON", "message": "Invalid JSON data or empty request body"}
                                    ),
                                    400,
                                )
                        elif json_data == {}:
                            logger.debug(f"json_data is empty dict, allow_empty: {allow_empty}")

                            if allow_empty:
                                validated_data = {}
                            else:

                                try:
                                    validated_data = schema_class(**json_data).model_dump()
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
                        else:

                            logger.debug(f"Attempting to validate JSON data for {request.method} {request.path}: {json_data}")
                            logger.debug(f"Schema class: {schema_class.__name__}, strict: {strict}")
                            try:
                                if strict:
                                    validated_data = schema_class(**json_data).model_dump()
                                else:
                                    validated_data = schema_class(**json_data).model_dump(
                                        exclude_unset=True
                                    )
                                logger.info(f"✅ Validation successful for {request.method} {request.path}, validated_data keys: {list(validated_data.keys()) if validated_data else 'None'}")
                            except ValidationError as e:
                                logger.warning(f"ValidationError for {request.method} {request.path}: {e.errors()}")
                                logger.warning(f"JSON data that failed validation: {json_data}")
                                
                                # Format validation errors into a readable message
                                error_messages = []
                                for error in e.errors():
                                    field = ".".join(str(loc) for loc in error.get("loc", []))
                                    msg = error.get("msg", "Validation error")
                                    error_messages.append(f"{field}: {msg}")
                                
                                return (
                                    jsonify(
                                        {
                                            "error": "VALIDATION_ERROR",
                                            "message": error_messages[0] if error_messages else "Request validation failed",
                                            "details": error_messages if len(error_messages) > 1 else None,
                                        }
                                    ),
                                    400,
                                )
                            except Exception as e:

                                logger.error(f"Unexpected error during schema validation for {request.method} {request.path}: {str(e)}")
                                logger.error(f"JSON data type: {type(json_data)}, value: {json_data}")
                                logger.error(f"Schema class: {schema_class.__name__}")
                                import traceback
                                logger.error(traceback.format_exc())
                                return (
                                    jsonify(
                                        {
                                            "error": "VALIDATION_ERROR",
                                            "message": "Request validation failed - invalid data format",
                                            "details": str(e) if current_app.debug else None,
                                        }
                                    ),
                                    400,
                                )


                    if validated_data is None:
                        logger.error(f"CRITICAL: validated_data is None for {request.method} {request.path} - this should not happen")
                        logger.error(f"Request data: {request.get_data(as_text=True)[:200]}")
                        logger.error(f"Content-Type: {request.headers.get('Content-Type')}")
                        logger.error(f"is_json: {request.is_json}")
                        logger.error(f"is_json_request: {is_json_request}")
                        logger.error(f"allow_empty: {allow_empty}")
                        import traceback
                        logger.error(f"Stack trace:\n{traceback.format_stack()}")
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Request validation failed - no data provided"
                                }
                            ),
                            400,
                        )
                    

                    if not isinstance(validated_data, dict):
                        logger.error(f"CRITICAL: validated_data is not a dict: {type(validated_data)} for {request.method} {request.path}")
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Request validation failed - invalid data format"
                                }
                            ),
                            400,
                        )
                    

                    if validated_data is None:
                        logger.critical(f"CRITICAL: validated_data is None right before calling function for {request.method} {request.path}")
                        logger.critical(f"This should never happen - validation should have returned an error earlier")
                        import traceback
                        logger.critical(f"Stack trace:\n{traceback.format_stack()}")
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Request validation failed - internal error"
                                }
                            ),
                            500,
                        )
                    
                    if not isinstance(validated_data, dict):
                        logger.critical(f"CRITICAL: validated_data is not a dict (type: {type(validated_data)}) right before calling function for {request.method} {request.path}")
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Request validation failed - internal error",
                                }
                            ),
                            500,
                        )
                    

                    if validated_data is None:
                        logger.critical(f"CRITICAL: validated_data is None at final check for {request.method} {request.path}")
                        logger.critical(f"This is a critical bug - validation should have returned an error earlier")
                        import traceback
                        logger.critical(f"Stack trace:\n{traceback.format_stack()}")
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Request validation failed - internal validation error"
                                }
                            ),
                            500,
                        )
                    

                    logger.info(f"✅ Validation middleware passing validated_data to function: {type(validated_data)}, keys: {list(validated_data.keys()) if isinstance(validated_data, dict) else 'N/A'} for {request.method} {request.path}")
                    

                    if validated_data is None:
                        logger.critical(f"CRITICAL: validated_data is None right before function call for {request.method} {request.path}")
                        logger.critical(f"This is a critical bug - validation should have returned an error earlier")
                        import traceback
                        logger.critical(f"Stack trace:\n{traceback.format_stack()}")
                        return (
                            jsonify(
                                {
                                    "error": "VALIDATION_ERROR",
                                    "message": "Request validation failed - internal validation error"
                                }
                            ),
                            500,
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

                    if ServiceError and isinstance(e, ServiceError):
                        raise
                    
                    import traceback
                    error_traceback = traceback.format_exc()
                    logger.error(f"Unexpected error in validation middleware for {request.method} {request.path}: {str(e)}\n{error_traceback}")
                    logger.error(f"Request data: {request.get_data(as_text=True)[:200]}")
                    logger.error(f"Content-Type: {request.headers.get('Content-Type')}")



                    error_response = {
                        "error": "VALIDATION_ERROR",
                        "message": "Request validation failed - invalid request data"
                    }

                    if current_app.debug:
                        error_response["details"] = str(e)
                        error_response["traceback"] = error_traceback.split("\n")


                    try:
                        return jsonify(error_response), 400
                    except Exception as return_error:
                        logger.critical(f"CRITICAL: Failed to return error response: {str(return_error)}")

                        raise

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
