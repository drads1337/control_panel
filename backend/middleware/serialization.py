"""
Serialization helpers.

Provides `@serialize_response` decorator to wrap route handlers and ensure all output passes
through a Pydantic schema so only whitelisted fields reach the client.
"""

from functools import wraps
from typing import Iterable, Tuple, Type, Union

from flask import Response, jsonify
from pydantic import BaseModel


Serializable = Union[BaseModel, dict, list, tuple]


def _extract_data_and_status(result: Union[Serializable, Tuple[Serializable, int]]):
    """Normalize a view return value to (data, status_code)."""
    if isinstance(result, Response):
        return result, None

    status_code = 200
    data = result
    if isinstance(result, tuple):
        if len(result) == 2:
            data, status_code = result
        else:
            data = result[0]
            status_code = result[1] if len(result) > 1 else 200
    return data, status_code


def serialize_response(schema: Type[BaseModel], many: bool = False):
    """
    Decorator for validating and filtering API responses via Pydantic schemas.

    Args:
        schema: Pydantic schema class that defines allowed fields.
        many: Whether the endpoint returns a collection.
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)


            if isinstance(result, Response):
                return result

            data, status_code = _extract_data_and_status(result)
            status_code = status_code or 200


            if isinstance(data, Response):
                return data
            if isinstance(data, dict) and (
                "error" in data or ("message" in data and len(data) == 1)
            ):
                return jsonify(data), status_code

            try:
                if many:
                    if isinstance(data, dict):
                        key = next(iter(data)) if data else "items"
                        items = data.get(key, [])
                        validated = [schema.model_validate(item).model_dump() for item in items]
                        response_payload = {key: validated, "count": len(validated)}
                    else:
                        iterable = list(data) if isinstance(data, Iterable) else [data]
                        validated = [schema.model_validate(item).model_dump() for item in iterable]
                        response_payload = validated
                    return jsonify(response_payload), status_code

                validated = schema.model_validate(data).model_dump()
                return jsonify(validated), status_code
            except Exception as exc:
                import logging

                logging.error("Serialization error: %s", exc, exc_info=True)
                return (
                    jsonify(
                        {
                            "error": "Internal server error during data processing",
                        }
                    ),
                    500,
                )

        return wrapper

    return decorator

