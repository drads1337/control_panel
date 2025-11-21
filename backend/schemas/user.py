"""
User-related Pydantic schemas
"""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, validator

from .common import BaseSchema, PhoneValidator, UsernameValidator

class UserProfileUpdateSchema(BaseSchema):
    """User profile update request schema"""

    username: Optional[str] = Field(
        default=None, min_length=3, max_length=50, description="Username"
    )
    email: Optional[EmailStr] = Field(default=None, description="Email address")
    first_name: Optional[str] = Field(default=None, max_length=100, description="First name")
    last_name: Optional[str] = Field(default=None, max_length=100, description="Last name")
    phone: Optional[str] = Field(default=None, description="Phone number")
    timezone: Optional[str] = Field(default=None, max_length=50, description="Timezone")

    @validator("username")
    def validate_username(cls, v):
        if v is not None:
            return UsernameValidator.validate_username(v)
        return v

    @validator("phone")
    def validate_phone(cls, v):
        if v is not None:
            return PhoneValidator.validate_phone(v)
        return v

class UserCreateSchema(BaseSchema):
    """User creation request schema"""

    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: Optional[str] = Field(default=None, description="Email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password")
    first_name: Optional[str] = Field(default=None, max_length=100, description="First name")
    last_name: Optional[str] = Field(default=None, max_length=100, description="Last name")
    phone: Optional[str] = Field(default=None, description="Phone number")
    timezone: Optional[str] = Field(default=None, max_length=50, description="Timezone")
    role: Optional[str] = Field(default="user", description="User role")
    token_balance: Optional[int] = Field(default=0, description="Initial token balance")
    work_duration_days: Optional[int] = Field(default=None, description="Work duration in days")
    product_ids: Optional[list] = Field(default_factory=list, description="List of product IDs")
    rbac_role_ids: Optional[list] = Field(default_factory=list, description="List of RBAC role IDs")
    expires_at: Optional[str] = Field(default=None, description="Expiration date (ISO format)")
    project_id: Optional[int] = Field(default=None, description="Project ID")

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v):

        if v == "" or v is None:
            return None

        if "@" not in str(v):
            raise ValueError("Invalid email format")
        return v

    @validator("username")
    def validate_username(cls, v):
        return UsernameValidator.validate_username(v)

    @validator("phone")
    def validate_phone(cls, v):
        if v is not None:
            return PhoneValidator.validate_phone(v)
        return v

class UserUpdateSchema(BaseSchema):
    """User update request schema (admin)"""

    username: Optional[str] = Field(
        default=None, min_length=3, max_length=50, description="Username"
    )
    email: Optional[EmailStr] = Field(default=None, description="Email address")
    first_name: Optional[str] = Field(default=None, max_length=100, description="First name")
    last_name: Optional[str] = Field(default=None, max_length=100, description="Last name")
    phone: Optional[str] = Field(default=None, description="Phone number")
    timezone: Optional[str] = Field(default=None, max_length=50, description="Timezone")
    role: Optional[str] = Field(default=None, description="User role")
    status: Optional[str] = Field(default=None, description="User status")

    @validator("username")
    def validate_username(cls, v):
        if v is not None:
            return UsernameValidator.validate_username(v)
        return v

    @validator("phone")
    def validate_phone(cls, v):
        if v is not None:
            return PhoneValidator.validate_phone(v)
        return v

class UserResponseSchema(BaseSchema):
    """User response schema"""

    id: int = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    first_name: Optional[str] = Field(default=None, description="First name")
    last_name: Optional[str] = Field(default=None, description="Last name")
    phone: Optional[str] = Field(default=None, description="Phone number")
    timezone: Optional[str] = Field(default=None, description="Timezone")
    role: str = Field(..., description="User role")
    status: str = Field(..., description="User status")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")
    two_factor_enabled: bool = Field(default=False, description="Whether 2FA is enabled")

class UserListResponseSchema(BaseSchema):
    """User list response schema"""

    users: list = Field(..., description="List of users")
    total: int = Field(..., description="Total number of users")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total pages")
