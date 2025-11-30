"""
Webhook Pydantic schemas
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator

from .common import BaseSchema


class WebhookCreateSchema(BaseSchema):
    """Schema for creating a webhook"""

    name: str = Field(..., min_length=1, max_length=255, description="Webhook name")
    webhook_type: str = Field(
        default="custom",
        description="Webhook type: custom, telegram, or discord"
    )
    url: Optional[HttpUrl] = Field(
        default=None,
        description="Webhook URL (required for custom type)"
    )
    events: List[str] = Field(
        default_factory=list,
        description="List of events to subscribe to"
    )
    secret: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Webhook secret for signature verification"
    )
    is_active: bool = Field(default=True, description="Whether webhook is active")
    headers: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        description="Custom headers to include in webhook requests"
    )
    

    telegram_bot_token: Optional[str] = Field(
        default=None,
        description="Telegram bot token (required for telegram type)"
    )
    telegram_chat_id: Optional[str] = Field(
        default=None,
        description="Telegram chat ID (required for telegram type)"
    )
    

    discord_webhook_url: Optional[HttpUrl] = Field(
        default=None,
        description="Discord webhook URL (required for discord type)"
    )
    discord_bot_token: Optional[str] = Field(
        default=None,
        description="Discord bot token (optional for discord type)"
    )
    discord_channel_id: Optional[str] = Field(
        default=None,
        description="Discord channel ID (optional for discord type)"
    )

    @field_validator("webhook_type")
    @classmethod
    def validate_webhook_type(cls, v: str) -> str:
        """Validate webhook type"""
        allowed_types = ["custom", "telegram", "discord"]
        if v not in allowed_types:
            raise ValueError(f"webhook_type must be one of {allowed_types}")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate webhook name"""
        if not v or not v.strip():
            raise ValueError("Webhook name cannot be empty")
        return v.strip()


class WebhookUpdateSchema(BaseSchema):
    """Schema for updating a webhook"""

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Webhook name"
    )
    webhook_type: Optional[str] = Field(
        default=None,
        description="Webhook type: custom, telegram, or discord"
    )
    url: Optional[HttpUrl] = Field(
        default=None,
        description="Webhook URL (required for custom type)"
    )
    events: Optional[List[str]] = Field(
        default=None,
        description="List of events to subscribe to"
    )
    secret: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Webhook secret for signature verification"
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Whether webhook is active"
    )
    headers: Optional[Dict[str, str]] = Field(
        default=None,
        description="Custom headers to include in webhook requests"
    )
    

    telegram_bot_token: Optional[str] = Field(
        default=None,
        description="Telegram bot token (required for telegram type)"
    )
    telegram_chat_id: Optional[str] = Field(
        default=None,
        description="Telegram chat ID (required for telegram type)"
    )
    

    discord_webhook_url: Optional[HttpUrl] = Field(
        default=None,
        description="Discord webhook URL (required for discord type)"
    )
    discord_bot_token: Optional[str] = Field(
        default=None,
        description="Discord bot token (optional for discord type)"
    )
    discord_channel_id: Optional[str] = Field(
        default=None,
        description="Discord channel ID (optional for discord type)"
    )

    @field_validator("webhook_type")
    @classmethod
    def validate_webhook_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate webhook type"""
        if v is None:
            return v
        allowed_types = ["custom", "telegram", "discord"]
        if v not in allowed_types:
            raise ValueError(f"webhook_type must be one of {allowed_types}")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate webhook name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Webhook name cannot be empty")
        return v.strip()

