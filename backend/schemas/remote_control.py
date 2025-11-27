"""
Remote Control Pydantic schemas
"""

from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from .common import BaseSchema


class RemoteCategoryCreateSchema(BaseSchema):
    """Schema for creating a remote category"""

    name: str = Field(..., min_length=1, max_length=255, description="Category name")
    product_id: int = Field(..., ge=1, description="Product ID")
    description: Optional[str] = Field(default="", max_length=1000, description="Category description")
    color: str = Field(default="#3b82f6", max_length=20, description="Category color (hex)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize category name"""
        if not v or not v.strip():
            raise ValueError("Category name cannot be empty")
        return v.strip()

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        """Validate color format"""
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("Color must be a valid hex color (e.g., #3b82f6)")
        return v


class RemoteCategoryUpdateSchema(BaseSchema):
    """Schema for updating a remote category"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Category name")
    product_id: Optional[int] = Field(default=None, ge=1, description="Product ID")
    description: Optional[str] = Field(default=None, max_length=1000, description="Category description")
    color: Optional[str] = Field(default=None, max_length=20, description="Category color (hex)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize category name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Category name cannot be empty")
        return v.strip()

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        """Validate color format"""
        if v is None:
            return v
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("Color must be a valid hex color (e.g., #3b82f6)")
        return v


class RemoteFeatureCreateSchema(BaseSchema):
    """Schema for creating a remote feature"""

    name: str = Field(..., min_length=1, max_length=255, description="Feature name")
    category_id: int = Field(..., ge=1, description="Category ID")
    description: Optional[str] = Field(default="", max_length=1000, description="Feature description")
    enabled: bool = Field(default=False, description="Whether the feature is enabled")
    status: str = Field(default="offline", description="Feature status")
    configuration: Optional[Dict[str, Any]] = Field(default=None, description="Feature configuration")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize feature name"""
        if not v or not v.strip():
            raise ValueError("Feature name cannot be empty")
        return v.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status"""
        allowed_statuses = ["offline", "online", "maintenance"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v


class RemoteFeatureUpdateSchema(BaseSchema):
    """Schema for updating a remote feature"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Feature name")
    category_id: Optional[int] = Field(default=None, ge=1, description="Category ID")
    description: Optional[str] = Field(default=None, max_length=1000, description="Feature description")
    enabled: Optional[bool] = Field(default=None, description="Whether the feature is enabled")
    status: Optional[str] = Field(default=None, description="Feature status")
    configuration: Optional[Dict[str, Any]] = Field(default=None, description="Feature configuration")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize feature name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Feature name cannot be empty")
        return v.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate status"""
        if v is None:
            return v
        allowed_statuses = ["offline", "online", "maintenance"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

