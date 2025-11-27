"""
API Token Pydantic schemas
"""

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .common import BaseSchema


class APITokenCreateSchema(BaseSchema):
    """Schema for creating an API token"""

    name: str = Field(..., min_length=1, max_length=255, description="Token name")
    permissions: List[str] = Field(
        default_factory=list,
        description="List of permissions for the token"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize token name"""
        if not v or not v.strip():
            raise ValueError("Token name cannot be empty")
        return v.strip()


class APITokenUpdateSchema(BaseSchema):
    """Schema for updating an API token"""

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Token name"
    )
    is_active: Optional[bool] = Field(default=None, description="Whether token is active")
    permissions: Optional[List[str]] = Field(
        default=None,
        description="List of permissions for the token"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize token name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Token name cannot be empty")
        return v.strip()

