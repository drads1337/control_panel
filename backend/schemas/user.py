"""
User-related Pydantic schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, field_serializer, validator, model_validator

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

class UserPublicResponse(BaseSchema):
    """Fields that can be safely exposed to any authenticated user when describing another profile."""

    id: str = Field(..., description="User ID (unique random identifier)")
    username: str = Field(..., description="Public username")
    avatar: Optional[str] = Field(default=None, description="Avatar file reference")
    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration timestamp")
    project_id: Optional[int] = Field(default=None, description="Project ID")
    referral_code: Optional[str] = Field(default=None, description="Referral code")

    @model_validator(mode='before')
    @classmethod
    def convert_id_to_unique_id(cls, data):
        """Convert SQLAlchemy model id to unique_id for API responses"""
        if hasattr(data, 'unique_id'):
            # SQLAlchemy model - convert to dict
            if hasattr(data, '__dict__'):
                data_dict = {}
                for k, v in data.__dict__.items():
                    if not k.startswith('_'):
                        data_dict[k] = v
                # Replace id with unique_id
                if 'unique_id' in data_dict:
                    data_dict['id'] = data_dict['unique_id']
                return data_dict
        elif isinstance(data, dict):
            # Already a dict - replace id with unique_id if present
            if 'unique_id' in data and 'id' not in data:
                data['id'] = data['unique_id']
        return data

class UserPrivateResponse(UserPublicResponse):
    """
    Fields visible only to the profile owner. Combines public data with personally identifiable fields.
    """

    email: Optional[EmailStr] = Field(default=None, description="Email address")
    first_name: Optional[str] = Field(default=None, description="First name")
    last_name: Optional[str] = Field(default=None, description="Last name")
    bio: Optional[str] = Field(default=None, description="Short biography")
    token_balance: int = Field(default=0, description="Current token balance")
    total_keys_generated: int = Field(default=0, description="Total keys generated by the user")
    last_login: Optional[datetime] = Field(default=None, description="Last login timestamp")
    is_admin: Optional[bool] = Field(default=None, description="Whether the user is admin")
    role: Optional[str] = Field(default=None, description="Primary role label")
    roles: List[str] = Field(default_factory=list, description="Assigned roles")
    permissions: List[str] = Field(default_factory=list, description="Permission list")
    keys_count: Optional[int] = Field(default=None, description="Total keys owned by user")
    active_keys: Optional[int] = Field(default=None, description="Active keys count")
    needs_project_assignment: bool = Field(default=False, description="Flag requiring project assignment")


class UserAdminResponse(UserPrivateResponse):
    """Fields that should only be visible to admins or support staff."""

    last_ip: Optional[str] = Field(default=None, description="Last observed IP")
    last_country: Optional[str] = Field(default=None, description="Last observed country")
    last_city: Optional[str] = Field(default=None, description="Last observed city")
    invited_by: Optional[int] = Field(default=None, description="User ID who invited this user")
