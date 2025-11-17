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
