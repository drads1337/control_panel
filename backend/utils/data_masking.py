"""
Data Masking Utilities
Provides functions to mask sensitive data in logs and responses
"""

import logging
import re
from typing import Any, Dict, List, Union

logger = logging.getLogger(__name__)

def mask_sensitive_data(data: Any, mask_char: str = "*") -> Any:
    """
    Recursively mask sensitive data in various data structures

    Args:
        data: Data to mask (string, dict, list, etc.)
        mask_char: Character to use for masking

    Returns:
        Masked data with same structure
    """
    if isinstance(data, str):
        return mask_string(data, mask_char)
    elif isinstance(data, dict):
        return {key: mask_sensitive_data(value, mask_char) for key, value in data.items()}
    elif isinstance(data, list):
        return [mask_sensitive_data(item, mask_char) for item in data]
    elif isinstance(data, tuple):
        return tuple(mask_sensitive_data(item, mask_char) for item in data)
    else:
        return data

def mask_string(text: str, mask_char: str = "*") -> str:
    """
    Mask sensitive information in a string

    Args:
        text: String to mask
        mask_char: Character to use for masking

    Returns:
        Masked string
    """
    if not isinstance(text, str):
        return text

    text = re.sub(
        r"(?i)(password|passwd|pwd|pass)[:=]\s*([^\s,;}\]]+)",
        lambda m: f"{m.group(1)}:***",
        text,
    )

    text = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        lambda m: mask_email(m.group()),
        text,
    )

    text = re.sub(
        r"\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b",
        lambda m: mask_key(m.group()),
        text,
    )

    text = re.sub(r"\b[A-Za-z0-9]{32,}\b", lambda m: mask_key(m.group()), text)

    text = re.sub(
        r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b", lambda m: mask_credit_card(m.group()), text
    )

    text = re.sub(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", lambda m: mask_phone(m.group()), text)

    text = re.sub(
        r"\b(\d{1,3})\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", lambda m: f"{m.group(1)}.***.***.***", text
    )

    return text

def mask_email(email: str) -> str:
    """Mask email address while keeping domain readable"""
    if "@" not in email:
        return mask_string(email)

    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*" * (len(local) - 1)
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]

    return f"{masked_local}@{domain}"

def mask_key(key: str) -> str:
    """Mask API keys and tokens"""
    if len(key) <= 8:
        return "*" * len(key)
    else:
        return key[:4] + "*" * (len(key) - 8) + key[-4:]

def mask_license_key(key: str) -> str:
    """
    Mask license keys for list endpoints - only show last 4 characters

    SECURITY: This is used to prevent mass data leakage in list endpoints.
    Full keys should only be returned in detail endpoints or during creation.

    Format: XXXX-XXXX-XXXX-ABCD (shows only last 4 chars)

    Args:
        key: License key to mask

    Returns:
        Masked license key (e.g., "XXXX-XXXX-XXXX-ABCD")
    """
    if not key or not isinstance(key, str):
        return "XXXX-XXXX-XXXX-XXXX"

    if len(key) <= 4:
        return "*" * len(key)

    if "-" in key:
        parts = key.split("-")
        if len(parts) > 1:

            last_part = parts[-1]
            if len(last_part) >= 4:
                masked_parts = ["XXXX"] * (len(parts) - 1) + [last_part[-4:]]
            else:
                masked_parts = ["XXXX"] * (len(parts) - 1) + [last_part]
            return "-".join(masked_parts)

    if len(key) <= 8:
        return "*" * (len(key) - 4) + key[-4:]
    else:

        return "XXXX-XXXX-XXXX-" + key[-4:]

def mask_credit_card(card: str) -> str:
    """Mask credit card numbers"""

    digits = re.sub(r"\D", "", card)
    if len(digits) >= 4:
        return "*" * (len(digits) - 4) + digits[-4:]
    return "*" * len(digits)

def mask_phone(phone: str) -> str:
    """Mask phone numbers"""
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 4:
        return "*" * (len(digits) - 4) + digits[-4:]
    return "*" * len(digits)

def mask_username(username: str) -> str:
    """Mask username while keeping some readability"""
    if len(username) <= 2:
        return "*" * len(username)
    elif len(username) <= 4:
        return username[0] + "*" * (len(username) - 1)
    else:
        return username[:2] + "*" * (len(username) - 4) + username[-2:]

def mask_password(password: str) -> str:
    """
    Mask password completely - never expose passwords in logs

    Args:
        password: Password to mask

    Returns:
        Masked password string (always "***" regardless of length)
    """
    if not password:
        return ""

    return "***"

def mask_user_data(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mask sensitive user data in a dictionary

    Args:
        user_data: Dictionary containing user data

    Returns:
        Dictionary with masked sensitive fields
    """
    sensitive_fields = {
        "email",
        "username",
        "password",
        "api_key",
        "token",
        "secret",
        "key",
        "phone",
        "credit_card",
        "ssn",
    }

    masked_data = {}
    for key, value in user_data.items():
        key_lower = key.lower()

        if any(sensitive in key_lower for sensitive in sensitive_fields):
            if isinstance(value, str):
                if "password" in key_lower:

                    masked_data[key] = mask_password(value)
                elif "email" in key_lower:
                    masked_data[key] = mask_email(value)
                elif "username" in key_lower:
                    masked_data[key] = mask_username(value)
                elif "key" in key_lower or "token" in key_lower:
                    masked_data[key] = mask_key(value)
                else:
                    masked_data[key] = mask_string(value)
            else:
                masked_data[key] = value
        else:
            masked_data[key] = value

    return masked_data

def create_safe_log_details(action: str, **kwargs) -> str:
    """
    Create safe log details that don't expose sensitive information

    Args:
        action: Action being performed
        **kwargs: Additional details to include

    Returns:
        Safe log details string
    """
    safe_details = [action]

    for key, value in kwargs.items():
        if key in ["user_id", "project_id", "game_id", "key_id"]:

            safe_details.append(f"{key}: {value}")
        elif key in ["username", "email"]:

            safe_details.append(
                f"{key}: {mask_username(str(value)) if key == 'username' else mask_email(str(value))}"
            )
        elif key in ["password", "current_password", "new_password", "old_password"]:

            safe_details.append(f"{key}: {mask_password(str(value))}")
        elif key in ["key", "token", "api_key", "access_token", "refresh_token"]:

            safe_details.append(f"{key}: {mask_key(str(value))}")
        elif key == "details":

            safe_details.append(f"details: {mask_string(str(value))}")
        else:

            if isinstance(value, str) and len(value) > 10:
                safe_details.append(f"{key}: {mask_string(str(value))}")
            else:
                safe_details.append(f"{key}: {value}")

    return " | ".join(safe_details)
