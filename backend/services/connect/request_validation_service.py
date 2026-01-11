"""
Request Validation Service
Handles validation of request data structure
Single Responsibility: Request structure validation
"""

import logging
from typing import Any, Dict

from ...utils.service_exceptions import ValidationError

logger = logging.getLogger(__name__)

class RequestValidationService:
    """Handles request data validation"""

    def validate_request_data(self, data: Dict[str, Any]) -> None:
        """
        Validate required fields in request data.

        Supports both obfuscated field names (for backward compatibility) and normal field names.

        Args:
            data: Request data dictionary (supports both obfuscated and normal field names)

        Raises:
            ValidationError: If validation fails
        """

        field_mapping = {
            "a": "user_key",
            "b": "challenge_response",
            "c": "canary",
            "d": "fingerprint",
            "e": "product",
            "f": "serial",
        }

        normal_fields = {
            "user_key": "user_key",
            "challenge_response": "challenge_response",
            "canary": "canary",
            "fingerprint": "fingerprint",
            "product": "product",
            "serial": "serial",
        }

        using_normal_fields = any(field in data for field in normal_fields.keys())

        if using_normal_fields:

            for field_name in normal_fields.keys():
                if field_name not in data or not isinstance(data[field_name], str):
                    raise ValidationError(
                        f"Missing or invalid field: {field_name}",
                        field=field_name
                    )
        else:

            for obfuscated_field, actual_field in field_mapping.items():
                if obfuscated_field not in data or not isinstance(data[obfuscated_field], str):
                    raise ValidationError(
                        f"Missing or invalid field: {actual_field}",
                        field=actual_field
                    )

    def extract_request_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and normalize request fields (support both obfuscated and normal field names)

        Args:
            data: Request data dictionary

        Returns:
            Dictionary with normalized field names
        """

        result = {
            "user_key": data.get("user_key") or data.get("a"),
            "challenge_response": data.get("challenge_response") or data.get("b"),
            "canary": data.get("canary") or data.get("c"),
            "fingerprint": data.get("fingerprint") or data.get("d"),
            "product": data.get("product") or data.get("e"),
            "serial": data.get("serial") or data.get("f"),
            "device_id": data.get("device_id") or data.get("g") or data.get("android_id"),
            "device_model": data.get("device_model") or data.get("h"),
            "device_brand": data.get("device_brand") or data.get("i"),
            "nonce": data.get("nonce") or data.get("j"),
            "project_id": data.get("project_id") or data.get("k"),
            "library_hash": data.get("library_hash") or data.get("l"),  # Новое поле для SHA-256 библиотеки
        }
        return result

    def validate_user_key_format(self, user_key: Any) -> None:
        """
        Validate user key format

        Args:
            user_key: User key to validate

        Raises:
            ValidationError: If validation fails
        """
        if not user_key or not isinstance(user_key, str):
            raise ValidationError(
                "Invalid user key format",
                field="user_key"
            )

        if any(
            indicator in user_key.lower()
            for indicator in ["error", "exception", "traceback", "null}", "timestamp", "level"]
        ):
            raise ValidationError(
                "Invalid user key data",
                field="user_key"
            )
