"""
Common Pydantic schemas and validators
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class BaseSchema(BaseModel):
    """Base schema with common configuration"""

    class Config:
        # Allow extra fields to be ignored
        extra = "ignore"
        # Use enum values instead of names
        use_enum_values = True
        # Validate assignment
        validate_assignment = True


class PaginationSchema(BaseSchema):
    """Pagination parameters"""

    page: int = Field(default=1, ge=1, description="Page number")
    per_page: int = Field(default=20, ge=1, le=100, description="Items per page")


class ResponseSchema(BaseSchema):
    """Standard API response schema"""

    success: bool = Field(description="Request success status")
    message: Optional[str] = Field(default=None, description="Response message")
    data: Optional[Any] = Field(default=None, description="Response data")
    errors: Optional[List[str]] = Field(default=None, description="Error messages")


class ErrorResponseSchema(BaseSchema):
    """Error response schema"""

    error: str = Field(description="Error code")
    message: Optional[str] = Field(default=None, description="Error message")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Error details")


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields"""

    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")


class IDSchema(BaseSchema):
    """Schema with ID field"""

    id: int = Field(ge=1, description="Entity ID")


class UsernameValidator:
    """Username validation utilities"""

    @staticmethod
    def validate_username(username: str) -> str:
        """Validate and normalize username"""
        if not username:
            raise ValueError("Username is required")

        username = username.strip()

        if len(username) < 3:
            raise ValueError("Username must be at least 3 characters long")

        if len(username) > 50:
            raise ValueError("Username must be no more than 50 characters long")

        # Check for valid characters (alphanumeric, underscore, hyphen)
        if not re.match(r"^[a-zA-Z0-9_-]+$", username):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")

        return username


class PasswordValidator:
    """Password validation utilities"""

    @staticmethod
    def validate_password(password: str, min_length: int = 8) -> str:
        """Validate password strength"""
        if not password:
            raise ValueError("Password is required")

        if len(password) < min_length:
            raise ValueError(f"Password must be at least {min_length} characters long")

        if len(password) > 128:
            raise ValueError("Password is too long")

        # Check for at least one letter and one number
        if not re.search(r"[A-Za-z]", password):
            raise ValueError("Password must contain at least one letter")

        if not re.search(r"[0-9]", password):
            raise ValueError("Password must contain at least one number")

        return password


class PhoneValidator:
    """Phone number validation utilities"""

    @staticmethod
    def validate_phone(phone: str) -> str:
        """Validate and normalize phone number"""
        if not phone:
            return phone

        phone = phone.strip()

        # Basic phone validation
        phone_clean = re.sub(r"[^\d+]", "", phone)
        if len(phone_clean) < 10 or len(phone_clean) > 15:
            raise ValueError("Invalid phone number format")

        return phone


class CodeValidator:
    """Code validation utilities (invite codes, referral codes, etc.)"""

    @staticmethod
    def validate_code(code: str, min_length: int = 6, max_length: int = 20) -> str:
        """Validate and normalize code"""
        if not code:
            raise ValueError("Code is required")

        code = code.strip().upper()

        if len(code) < min_length:
            raise ValueError(f"Code is too short (minimum {min_length} characters)")

        if len(code) > max_length:
            raise ValueError(f"Code is too long (maximum {max_length} characters)")

        # Check for valid characters (alphanumeric)
        if not re.match(r"^[A-Z0-9]+$", code):
            raise ValueError("Code can only contain letters and numbers")

        return code
