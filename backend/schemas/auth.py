"""
Authentication-related Pydantic schemas
"""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, validator

from .common import BaseSchema, PasswordValidator, UsernameValidator

class LoginRequestSchema(BaseSchema):
    """Login request schema"""

    username: str = Field(..., min_length=3, max_length=50, description="Username or email")
    password: str = Field(..., min_length=8, max_length=128, description="Password")

    @validator("username")
    def validate_username(cls, v):
        return UsernameValidator.validate_username(v)

    @validator("password")
    def validate_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

class RegisterRequestSchema(BaseSchema):
    """User registration request schema"""

    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password")
    invite_code: Optional[str] = Field(default=None, description="Invite code")
    referral_code: Optional[str] = Field(default=None, description="Referral code")
    project_name: Optional[str] = Field(default=None, max_length=255, description="Project name (if creating new project)")

    @validator("username")
    def validate_username(cls, v):
        return UsernameValidator.validate_username(v)

    @validator("password")
    def validate_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

class ChangePasswordRequestSchema(BaseSchema):
    """Change password request schema"""

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=6, max_length=128, description="New password")

    @validator("new_password")
    def validate_new_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

class ForgotPasswordRequestSchema(BaseSchema):
    """Forgot password request schema"""

    email: str = Field(..., description="Email address")

class ResetPasswordRequestSchema(BaseSchema):
    """Reset password request schema"""

    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=6, max_length=128, description="New password")

    @validator("new_password")
    def validate_new_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

class TwoFactorSetupRequestSchema(BaseSchema):
    """Two-factor authentication setup request schema"""

    password: str = Field(..., description="Current password for verification")

    @validator("password")
    def validate_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

class TwoFactorVerifyRequestSchema(BaseSchema):
    """Two-factor authentication verification request schema"""

    code: str = Field(..., min_length=6, max_length=6, description="2FA verification code")

    @validator("code")
    def validate_code(cls, v):
        if not v.isdigit():
            raise ValueError("2FA code must contain only digits")
        return v

class TwoFactorDisableRequestSchema(BaseSchema):
    """Two-factor authentication disable request schema"""

    password: str = Field(..., description="Current password for verification")
    code: str = Field(..., min_length=6, max_length=6, description="2FA verification code")

    @validator("password")
    def validate_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

    @validator("code")
    def validate_code(cls, v):
        if not v.isdigit():
            raise ValueError("2FA code must contain only digits")
        return v

class AccessCodeValidateSchema(BaseSchema):
    """Access code validation request schema"""

    access_code: str = Field(..., min_length=1, description="Access code to validate")

    @validator("access_code")
    def validate_access_code(cls, v):
        if not v or not v.strip():
            raise ValueError("Access code cannot be empty")
        return v.strip()

class AccessCodeRegisterSchema(BaseSchema):
    """Access code registration request schema"""

    access_code: str = Field(..., min_length=1, description="Access code")
    product_name: str = Field(..., min_length=1, max_length=255, description="Product name")

    @validator("access_code")
    def validate_access_code(cls, v):
        if not v or not v.strip():
            raise ValueError("Access code cannot be empty")
        return v.strip()

    @validator("product_name")
    def validate_product_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Product name cannot be empty")
        return v.strip()

class ClassicLoginRegisterSchema(BaseSchema):
    """Classic Login registration request schema"""

    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=8, max_length=128, description="Password")
    email: Optional[str] = Field(default=None, description="Email address")
    invite_code: str = Field(..., min_length=1, description="Invite code (access code)")

    @validator("username")
    def validate_username(cls, v):
        return UsernameValidator.validate_username(v)

    @validator("password")
    def validate_password(cls, v):
        return PasswordValidator.validate_password(v, min_length=8)

    @validator("invite_code")
    def validate_invite_code(cls, v):
        if not v or not v.strip():
            raise ValueError("Invite code cannot be empty")
        return v.strip()

class InviteCodeValidateSchema(BaseSchema):
    """Invite code validation request schema"""

    invite_code: str = Field(..., min_length=1, description="Invite code to validate")

    @validator("invite_code")
    def validate_invite_code(cls, v):
        if not v or not v.strip():
            raise ValueError("Invite code cannot be empty")
        return v.strip()

class LoginResponseSchema(BaseSchema):
    """Login response schema"""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: Optional[str] = Field(default=None, description="JWT refresh token")
    user_id: int = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    two_factor_required: bool = Field(default=False, description="Whether 2FA is required")

class TwoFactorSetupResponseSchema(BaseSchema):
    """Two-factor setup response schema"""

    qr_code: str = Field(..., description="QR code for 2FA setup")
    secret: str = Field(..., description="2FA secret key")
    backup_codes: list = Field(..., description="Backup codes for 2FA")
