"""
Product-related Pydantic schemas
Universal terminology for B2B/SaaS applications
"""

from typing import List, Optional

from pydantic import BaseModel, Field, validator

from .common import BaseSchema

class ProductCreateSchema(BaseSchema):
    """Product creation request schema"""

    name: str = Field(..., min_length=1, max_length=100, description="Product name")
    description: Optional[str] = Field(default=None, max_length=500, description="Product description")
    version: Optional[str] = Field(default=None, max_length=50, description="Product version")
    status: str = Field(default="active", description="Product status")
    is_multi_app: Optional[bool] = Field(
        default=False, description="True for multi-app, False for application library"
    )
    login_type: Optional[str] = Field(
        default="license_generation",
        description="'license_generation' | 'invite_code' | 'classic_login'",
    )
    invite_code_required: Optional[bool] = Field(
        default=False, description="Require invite code for registration"
    )
    config: Optional[dict] = Field(default=None, description="Product configuration")

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Product name is required")
        return v.strip()

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "maintenance", "testing", "deprecated"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v

    @validator("login_type")
    def validate_login_type(cls, v):
        if v is None:
            return v
        allowed_login_types = ["license_generation", "invite_code", "classic_login"]
        if v not in allowed_login_types:
            raise ValueError(f"login_type must be one of: {', '.join(allowed_login_types)}")
        return v

class ProductUpdateSchema(BaseSchema):
    """Product update request schema"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Product name")
    description: Optional[str] = Field(default=None, max_length=500, description="Product description")
    version: Optional[str] = Field(default=None, max_length=50, description="Product version")
    status: Optional[str] = Field(default=None, description="Product status")
    is_multi_app: Optional[bool] = Field(
        default=None, description="True for multi-app, False for application library"
    )
    login_type: Optional[str] = Field(
        default=None, description="'license_generation' | 'invite_code' | 'classic_login'"
    )
    invite_code_required: Optional[bool] = Field(
        default=None, description="Require invite code for registration"
    )
    config: Optional[dict] = Field(default=None, description="Product configuration")

    @validator("name")
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError("Product name cannot be empty")
        return v.strip() if v else v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["active", "inactive", "maintenance", "testing", "deprecated"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v

    @validator("login_type")
    def validate_update_login_type(cls, v):
        if v is None:
            return v
        allowed_login_types = ["license_generation", "invite_code", "classic_login"]
        if v not in allowed_login_types:
            raise ValueError(f"login_type must be one of: {', '.join(allowed_login_types)}")
        return v

class ProductResponseSchema(BaseSchema):
    """Product response schema"""

    id: str = Field(..., description="Product ID (unique random identifier)")
    name: str = Field(..., description="Product name")
    description: Optional[str] = Field(default=None, description="Product description")
    version: Optional[str] = Field(default=None, description="Product version")
    status: str = Field(..., description="Product status")
    is_multi_app: bool = Field(..., description="True for multi-app, False for application library")
    login_type: Optional[str] = Field(
        default=None, description="'license_generation' | 'invite_code' | 'classic_login'"
    )
    invite_code_required: Optional[bool] = Field(
        default=None, description="Require invite code for registration"
    )
    config: Optional[dict] = Field(default=None, description="Product configuration")
    project_id: int = Field(..., description="Project ID")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")

class ProductListResponseSchema(BaseSchema):
    """Product list response schema"""

    products: List[ProductResponseSchema] = Field(..., description="List of products")
    total: int = Field(..., description="Total number of products")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total pages")

class ProductConfigUpdateSchema(BaseSchema):
    """Product configuration update request schema"""

    config: dict = Field(..., description="Product configuration")

    @validator("config")
    def validate_config(cls, v):
        if not isinstance(v, dict):
            raise ValueError("Configuration must be a dictionary")
        return v

class ProductStatusUpdateSchema(BaseSchema):
    """Product status update request schema"""

    status: str = Field(..., description="New product status")

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "maintenance", "testing", "deprecated"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v

class ProductBulkStatusUpdateSchema(BaseSchema):
    """Schema for bulk product status update"""

    product_ids: List[int] = Field(..., min_items=1, description="List of product IDs")
    status: str = Field(..., description="New status")

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(pid <= 0 for pid in v):
            raise ValueError("All product IDs must be positive integers")
        return v

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "maintenance"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class ProductBulkDeleteSchema(BaseSchema):
    """Schema for bulk product deletion"""

    product_ids: List[int] = Field(..., min_items=1, description="List of product IDs")

    @validator("product_ids")
    def validate_product_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one product ID is required")
        if any(pid <= 0 for pid in v):
            raise ValueError("All product IDs must be positive integers")
        return v
