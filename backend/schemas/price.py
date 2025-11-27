"""
Product Price Pydantic schemas
"""

from typing import Dict, Optional

from pydantic import Field, field_validator

from .common import BaseSchema


class ProductPricesUpdateSchema(BaseSchema):
    """Schema for updating product prices"""

    prices: Dict[str, float] = Field(..., description="Dictionary of period -> price mappings")

    @field_validator("prices")
    @classmethod
    def validate_prices(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Validate prices dictionary"""
        if not isinstance(v, dict):
            raise ValueError("Prices must be a dictionary")
        if len(v) == 0:
            raise ValueError("At least one price must be provided")
        
        # Validate price values
        for period, price_value in v.items():
            if not isinstance(price_value, (int, float)):
                raise ValueError(f"Price for period '{period}' must be a number")
            if price_value < 0:
                raise ValueError(f"Price for period '{period}' cannot be negative")
        
        return v


class CustomPriceCreateSchema(BaseSchema):
    """Schema for creating a custom price period"""

    period_name: str = Field(..., min_length=1, max_length=255, description="Custom period name")
    price: float = Field(..., ge=0, description="Price value")
    meta_data: Optional[Dict] = Field(default=None, description="Additional metadata")

    @field_validator("period_name")
    @classmethod
    def validate_period_name(cls, v: str) -> str:
        """Validate and normalize period name"""
        if not v or not v.strip():
            raise ValueError("Period name cannot be empty")
        # Ensure it starts with "custom_" prefix
        name = v.strip()
        if not name.startswith("custom_"):
            name = f"custom_{name}"
        return name

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        """Validate price value"""
        if v < 0:
            raise ValueError("Price cannot be negative")
        return float(v)

