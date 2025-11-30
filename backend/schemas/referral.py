"""
Referral Code Pydantic schemas
"""

from typing import List, Optional

from pydantic import Field, field_validator

from .common import BaseSchema


class ReferralCodeCreateSchema(BaseSchema):
    """Schema for creating a referral code"""

    code: Optional[str] = Field(default=None, max_length=50, description="Custom referral code (auto-generated if not provided)")
    token_balance: int = Field(default=0, ge=0, description="Token balance to grant")
    work_duration_days: Optional[int] = Field(default=None, ge=0, description="Work duration in days")
    product_ids: List[int] = Field(default_factory=list, description="List of product IDs")
    rbac_role_ids: List[int] = Field(default_factory=list, description="List of RBAC role IDs")
    expires_days: Optional[int] = Field(default=None, ge=1, le=3650, description="Expiration in days (deprecated, use expires_in_days)")
    expires_in_days: Optional[int] = Field(default=90, ge=1, le=3650, description="Expiration in days")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize referral code"""
        if v is None:
            return v
        code = v.strip()
        if len(code) > 50:
            raise ValueError("Referral code must be 50 characters or less")
        return code

    @field_validator("product_ids")
    @classmethod
    def validate_product_ids(cls, v: List[int]) -> List[int]:
        """Validate product IDs list"""
        if not isinstance(v, list):
            raise ValueError("Product IDs must be a list")

        valid_ids = [pid for pid in v if isinstance(pid, int) and pid > 0]
        return valid_ids

    @field_validator("rbac_role_ids")
    @classmethod
    def validate_rbac_role_ids(cls, v: List[int]) -> List[int]:
        """Validate RBAC role IDs list"""
        if not isinstance(v, list):
            raise ValueError("RBAC role IDs must be a list")

        valid_ids = [rid for rid in v if isinstance(rid, int) and rid > 0]
        return valid_ids

    @field_validator("expires_days", "expires_in_days")
    @classmethod
    def validate_expires_days(cls, v: Optional[int]) -> Optional[int]:
        """Validate expiration days"""
        if v is not None and (v < 1 or v > 3650):
            raise ValueError("Expiration days must be between 1 and 3650")
        return v

