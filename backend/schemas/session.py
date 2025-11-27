"""
Session-related Pydantic schemas
"""

from typing import List

from pydantic import Field, field_validator

from .common import BaseSchema


class SessionBulkTerminateSchema(BaseSchema):
    """Schema for bulk session termination"""

    user_ids: List[int] = Field(..., min_items=1, description="List of user IDs")

    @field_validator("user_ids")
    @classmethod
    def validate_user_ids(cls, v: List[int]) -> List[int]:
        """Validate user IDs list"""
        if not v or len(v) == 0:
            raise ValueError("At least one user ID is required")
        if any(uid <= 0 for uid in v):
            raise ValueError("All user IDs must be positive integers")
        return v


class SessionBulkLogoutSchema(BaseSchema):
    """Schema for bulk user logout"""

    user_ids: List[int] = Field(..., min_items=1, description="List of user IDs")

    @field_validator("user_ids")
    @classmethod
    def validate_user_ids(cls, v: List[int]) -> List[int]:
        """Validate user IDs list"""
        if not v or len(v) == 0:
            raise ValueError("At least one user ID is required")
        if not isinstance(v, list):
            raise ValueError("User IDs must be a list")
        if any(uid <= 0 for uid in v):
            raise ValueError("All user IDs must be positive integers")
        return v

