"""
Balance Pydantic schemas
"""

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .common import BaseSchema


class BalanceTopupSchema(BaseSchema):
    """Schema for topping up user balance"""

    user_id: str = Field(..., description="User ID (numeric or unique_id string)")
    amount: float = Field(..., gt=0, description="Amount to top up (must be positive)")

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        """Validate amount is positive"""
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return float(v)


class BalanceDeductSchema(BaseSchema):
    """Schema for deducting from user balance"""

    user_id: str = Field(..., description="User ID (numeric or unique_id string)")
    amount: float = Field(..., gt=0, description="Amount to deduct (must be positive)")
    reason: str = Field(
        default="Balance deduction",
        max_length=500,
        description="Reason for deduction"
    )

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        """Validate amount is positive"""
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return float(v)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        """Validate and normalize reason"""
        if not v or not v.strip():
            return "Balance deduction"
        return v.strip()


class BalanceTransactionsQuerySchema(BaseSchema):
    """Schema for querying user transactions"""

    user_id: str = Field(..., description="User ID (numeric or unique_id string)")
    page: int = Field(default=1, ge=1, description="Page number")
    per_page: int = Field(default=50, ge=1, le=100, description="Items per page")

