"""
Key-related Pydantic schemas
"""

from typing import Optional

from pydantic import Field, validator

from .common import BaseSchema

class KeyCreateSchema(BaseSchema):
    """Key creation request schema"""

    product_id: int = Field(..., ge=1, description="Product ID")
    duration_hours: int = Field(default=24, ge=1, le=8760, description="Key duration in hours")
    max_devices: int = Field(default=1, ge=1, le=1000, description="Maximum devices")
    length: Optional[int] = Field(default=32, ge=16, le=128, description="Key length")

    @validator("product_id")
    def validate_product_id(cls, v):
        if v <= 0:
            raise ValueError("Product ID must be a positive integer")
        return v

class KeyUpdateSchema(BaseSchema):
    """Key update request schema"""

    max_devices: Optional[int] = Field(default=None, ge=1, le=1000, description="Maximum devices")
    duration: Optional[int] = Field(default=None, ge=1, le=8760, description="Duration in hours")

    @validator("max_devices")
    def validate_max_devices(cls, v):
        if v is not None and v < 1:
            raise ValueError("Max devices must be at least 1")
        return v

    @validator("duration")
    def validate_duration(cls, v):
        if v is not None and v < 1:
            raise ValueError("Duration must be at least 1 hour")
        return v

class KeyMoveSchema(BaseSchema):
    """Key move request schema (move key to another user)"""

    user_id: int = Field(..., ge=1, description="Target user ID")

    @validator("user_id")
    def validate_user_id(cls, v):
        if v <= 0:
            raise ValueError("User ID must be a positive integer")
        return v

class KeyExtendSchema(BaseSchema):
    """Key extend request schema"""

    hours: int = Field(..., ge=1, le=8760, description="Hours to extend")

    @validator("hours")
    def validate_hours(cls, v):
        if v <= 0:
            raise ValueError("Hours must be positive")
        return v

class LoaderKeyCreateSchema(BaseSchema):
    """Agent key creation request schema"""

    agent_id: int = Field(..., ge=1, description="Agent ID")
    product_ids: list[int] = Field(..., min_items=1, description="List of product IDs")
    duration_hours: int = Field(default=24, ge=1, le=8760, description="Key duration in hours")
    max_devices: int = Field(default=1, ge=1, le=1000, description="Maximum devices")

    @validator("agent_id")
    def validate_loader_id(cls, v):
        if v <= 0:
            raise ValueError("Agent ID must be a positive integer")
        return v

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(gid <= 0 for gid in v):
            raise ValueError("All product IDs must be positive integers")
        return v

class CustomLoaderKeyCreateSchema(BaseSchema):
    """Custom agent key creation request schema"""

    custom_key: str = Field(..., min_length=1, max_length=64, description="Custom key string")
    agent_id: int = Field(..., ge=1, description="Agent ID")
    product_ids: list[int] = Field(..., min_items=1, description="List of product IDs")
    duration_hours: int = Field(default=24, ge=1, le=8760, description="Key duration in hours")
    max_devices: int = Field(default=1, ge=1, le=1000, description="Maximum devices")

    @validator("custom_key")
    def validate_custom_key(cls, v):
        if not v or not v.strip():
            raise ValueError("Custom key is required")
        if len(v) > 64:
            raise ValueError("Custom key must be 64 characters or less")
        return v.strip()

    @validator("agent_id")
    def validate_loader_id(cls, v):
        if v <= 0:
            raise ValueError("Agent ID must be a positive integer")
        return v

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(gid <= 0 for gid in v):
            raise ValueError("All product IDs must be positive integers")
        return v

class BulkLoaderKeyCreateSchema(BaseSchema):
    """Bulk agent key creation request schema"""

    count: int = Field(..., ge=1, le=100, description="Number of keys to create")
    agent_id: int = Field(..., ge=1, description="Agent ID")
    product_ids: list[int] = Field(..., min_items=1, description="List of product IDs")
    duration_hours: int = Field(default=24, ge=1, le=8760, description="Key duration in hours")
    max_devices: int = Field(default=1, ge=1, le=1000, description="Maximum devices")

    @validator("agent_id")
    def validate_loader_id(cls, v):
        if v <= 0:
            raise ValueError("Agent ID must be a positive integer")
        return v

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(gid <= 0 for gid in v):
            raise ValueError("All product IDs must be positive integers")
        return v

class BulkLoaderKeyActionSchema(BaseSchema):
    """Bulk agent key action request schema"""

    agent_id: int = Field(..., ge=1, description="Agent ID")
    product_ids: list[int] = Field(..., min_items=1, description="List of product IDs")

    @validator("agent_id")
    def validate_loader_id(cls, v):
        if v <= 0:
            raise ValueError("Agent ID must be a positive integer")
        return v

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(gid <= 0 for gid in v):
            raise ValueError("All product IDs must be positive integers")
        return v

class BulkAddHoursSchema(BaseSchema):
    """Bulk add hours to agent keys schema"""

    agent_id: int = Field(..., ge=1, description="Agent ID")
    product_ids: list[int] = Field(..., min_items=1, description="List of product IDs")
    hours: int = Field(..., ge=1, le=8760, description="Hours to add")

    @validator("agent_id")
    def validate_loader_id(cls, v):
        if v <= 0:
            raise ValueError("Agent ID must be a positive integer")
        return v

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(gid <= 0 for gid in v):
            raise ValueError("All product IDs must be positive integers")
        return v

class KeyValidateSchema(BaseSchema):
    """Key validation request schema"""

    key: str = Field(..., min_length=1, description="Key to validate")
    device_id: Optional[str] = Field(default=None, description="Device ID")
    product_id: Optional[int] = Field(default=None, ge=1, description="Product ID")

    @validator("key")
    def validate_key(cls, v):
        if not v or not v.strip():
            raise ValueError("Key is required")
        return v.strip()
