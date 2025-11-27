"""
Notification-related Pydantic schemas
"""

from typing import Optional

from pydantic import Field, validator

from .common import BaseSchema

class NotificationCreateSchema(BaseSchema):
    """Notification creation request schema"""

    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    type: str = Field(default="info", description="Notification type")
    target_user_id: Optional[int] = Field(default=None, ge=1, description="Target user ID")
    user_id: Optional[int] = Field(default=None, ge=1, description="User ID (alias for target_user_id)")
    repeat_count: int = Field(default=1, ge=1, le=10, description="Repeat count")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["info", "warning", "error", "success"]
        if v not in allowed_types:
            raise ValueError(f'Invalid type. Allowed: {", ".join(allowed_types)}')
        return v

    @validator("message")
    def validate_message(cls, v):
        if not v or not v.strip():
            raise ValueError("Message is required")
        return v.strip()

class NotificationSendSchema(BaseSchema):
    """Send notification request schema"""

    title: Optional[str] = Field(default="", max_length=200, description="Notification title")
    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    type: str = Field(default="info", description="Notification type")
    target_users: list[int] = Field(..., min_items=1, description="List of target user IDs")
    repeat_count: int = Field(default=1, ge=1, le=10, description="Repeat count")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["info", "warning", "error", "success"]
        if v not in allowed_types:
            raise ValueError(f'Invalid type. Allowed: {", ".join(allowed_types)}')
        return v

    @validator("message")
    def validate_message(cls, v):
        if not v or not v.strip():
            raise ValueError("Message is required")
        return v.strip()

    @validator("target_users")
    def validate_target_users(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one target user is required")
        if any(uid <= 0 for uid in v):
            raise ValueError("All user IDs must be positive integers")
        return v

class NotificationBulkActionSchema(BaseSchema):
    """Bulk notification action request schema"""

    action: str = Field(..., description="Action to perform")
    notification_ids: list[int] = Field(..., min_items=1, description="List of notification IDs")

    @validator("action")
    def validate_action(cls, v):
        allowed_actions = ["mark_read", "mark_unread", "delete"]
        if v not in allowed_actions:
            raise ValueError(f'Invalid action. Allowed: {", ".join(allowed_actions)}')
        return v

    @validator("notification_ids")
    def validate_notification_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one notification ID is required")
        if any(nid <= 0 for nid in v):
            raise ValueError("All notification IDs must be positive integers")
        return v

class NotificationBulkCreateSchema(BaseSchema):
    """Bulk notification creation request schema"""

    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    type: str = Field(default="info", description="Notification type")
    target_roles: Optional[list[str]] = Field(default=None, description="Target roles")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["info", "warning", "error", "success"]
        if v not in allowed_types:
            raise ValueError(f'Invalid type. Allowed: {", ".join(allowed_types)}')
        return v

    @validator("message")
    def validate_message(cls, v):
        if not v or not v.strip():
            raise ValueError("Message is required")
        return v.strip()

class ProductUpdateNotificationSchema(BaseSchema):
    """Product update notification request schema"""

    product_id: int = Field(..., ge=1, description="Product ID")
    version: str = Field(..., min_length=1, max_length=50, description="Product version")
    message: str = Field(..., min_length=1, max_length=1000, description="Update message")
    type: str = Field(default="info", description="Notification type")
    repeat_count: int = Field(default=1, ge=1, le=10, description="Repeat count")
    is_scheduled: bool = Field(default=False, description="Is scheduled")
    scheduled_at: Optional[str] = Field(default=None, description="Scheduled at (ISO format)")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["info", "warning", "error", "success"]
        if v not in allowed_types:
            raise ValueError(f'Invalid type. Allowed: {", ".join(allowed_types)}')
        return v

class LoaderNotificationCreateSchema(BaseSchema):
    """Agent notification creation request schema"""

    agent_id: Optional[int] = Field(default=None, ge=1, description="Agent ID")
    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    type: str = Field(default="info", description="Notification type")
    repeat_count: Optional[int] = Field(default=1, ge=1, le=10, description="Repeat count")
    is_scheduled: bool = Field(default=False, description="Is scheduled")
    scheduled_at: Optional[str] = Field(default=None, description="Scheduled at (ISO format)")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["info", "warning", "error", "success"]
        if v not in allowed_types:
            raise ValueError(f'Invalid type. Allowed: {", ".join(allowed_types)}')
        return v

    @validator("message")
    def validate_message(cls, v):
        if not v or not v.strip():
            raise ValueError("Message is required")
        return v.strip()

class NotificationCleanupSchema(BaseSchema):
    """Notification cleanup request schema"""

    days_old: int = Field(default=30, ge=1, le=365, description="Days old threshold")

class SystemNotificationCreateSchema(BaseSchema):
    """System notification creation request schema (admin only)"""

    message: str = Field(..., min_length=1, max_length=1000, description="Notification message")
    type: str = Field(default="info", description="Notification type")
    user_id: Optional[int] = Field(default=None, ge=1, description="Target user ID")
    project_id: Optional[int] = Field(default=None, ge=1, description="Project ID")

    @validator("type")
    def validate_type(cls, v):
        allowed_types = ["info", "warning", "error", "success"]
        if v not in allowed_types:
            raise ValueError(f'Invalid type. Allowed: {", ".join(allowed_types)}')
        return v

    @validator("message")
    def validate_message(cls, v):
        if not v or not v.strip():
            raise ValueError("Message is required")
        return v.strip()
