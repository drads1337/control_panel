"""
Agent (Loader) Pydantic schemas
"""

from typing import List, Optional

from pydantic import Field, field_validator

from .common import BaseSchema


class AgentCreateSchema(BaseSchema):
    """Schema for creating an agent"""

    name: str = Field(..., min_length=1, max_length=255, description="Agent name")
    description: str = Field(..., min_length=1, max_length=2000, description="Agent description")
    status: str = Field(default="active", description="Agent status")
    logo: Optional[str] = Field(default=None, description="Logo filename")
    banner: Optional[str] = Field(default=None, description="Banner filename")
    background: Optional[str] = Field(default=None, description="Background filename")
    file: Optional[str] = Field(default=None, description="Loader file filename")
    changelog: Optional[str] = Field(default=None, max_length=5000, description="Changelog")
    notifications: Optional[str] = Field(default=None, max_length=1000, description="Notifications")
    version: Optional[str] = Field(default="1.0.0", max_length=50, description="Version")
    downloads: int = Field(default=0, ge=0, description="Download count")
    active_users: int = Field(default=0, ge=0, description="Active users count")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize agent name"""
        if not v or not v.strip():
            raise ValueError("Agent name cannot be empty")
        return v.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status"""
        allowed_statuses = ["active", "inactive", "maintenance", "testing"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v


class AgentUpdateSchema(BaseSchema):
    """Schema for updating an agent"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Agent name")
    description: Optional[str] = Field(default=None, min_length=1, max_length=2000, description="Agent description")
    status: Optional[str] = Field(default=None, description="Agent status")
    logo: Optional[str] = Field(default=None, description="Logo filename")
    banner: Optional[str] = Field(default=None, description="Banner filename")
    background: Optional[str] = Field(default=None, description="Background filename")
    file: Optional[str] = Field(default=None, description="Loader file filename")
    changelog: Optional[str] = Field(default=None, max_length=5000, description="Changelog")
    notifications: Optional[str] = Field(default=None, max_length=1000, description="Notifications")
    version: Optional[str] = Field(default=None, max_length=50, description="Version")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize agent name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Agent name cannot be empty")
        return v.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate status"""
        if v is None:
            return v
        allowed_statuses = ["active", "inactive", "maintenance", "testing"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v


class AgentProductAssignSchema(BaseSchema):
    """Schema for assigning products to an agent"""

    product_ids: List[str] = Field(..., min_items=0, description="List of product IDs or unique IDs")

    @field_validator("product_ids")
    @classmethod
    def validate_product_ids(cls, v: List[str]) -> List[str]:
        """Validate product IDs list"""
        if not isinstance(v, list):
            raise ValueError("Product IDs must be a list")
        return v


class AgentStatusUpdateSchema(BaseSchema):
    """Schema for updating agent status"""

    status: str = Field(..., description="New agent status")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status"""
        allowed_statuses = ["active", "inactive", "maintenance", "testing"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v


class AgentLoginTypeUpdateSchema(BaseSchema):
    """Schema for updating agent login type"""

    login_type: str = Field(..., description="Login type")

    @field_validator("login_type")
    @classmethod
    def validate_login_type(cls, v: str) -> str:
        """Validate login type"""
        allowed_login_types = ["license_generation", "invite_code"]
        if v not in allowed_login_types:
            raise ValueError(f"Login type must be one of {allowed_login_types}")
        return v

