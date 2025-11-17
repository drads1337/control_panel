"""
Admin-related Pydantic schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator

from .common import BaseSchema, CodeValidator


class InviteCreateSchema(BaseSchema):
    """Invite creation request schema"""

    duration_days: Optional[int] = Field(
        default=30, ge=1, le=365, description="Invite duration in days"
    )
    max_uses: Optional[int] = Field(default=1, ge=1, le=1000, description="Maximum number of uses")
    description: Optional[str] = Field(
        default=None, max_length=200, description="Invite description"
    )


class InviteResponseSchema(BaseSchema):
    """Invite response schema"""

    id: int = Field(..., description="Invite ID")
    code: str = Field(..., description="Invite code")
    duration_days: int = Field(..., description="Invite duration in days")
    max_uses: int = Field(..., description="Maximum number of uses")
    used_count: int = Field(..., description="Number of times used")
    description: Optional[str] = Field(default=None, description="Invite description")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    expires_at: Optional[str] = Field(default=None, description="Expiration timestamp")
    status: str = Field(..., description="Invite status")


class InviteListResponseSchema(BaseSchema):
    """Invite list response schema"""

    invites: List[InviteResponseSchema] = Field(..., description="List of invites")
    total: int = Field(..., description="Total number of invites")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total pages")


class InviteUseSchema(BaseSchema):
    """Invite use request schema"""

    code: str = Field(..., description="Invite code")

    @validator("code")
    def validate_code(cls, v):
        return CodeValidator.validate_code(v)


class SystemSettingsUpdateSchema(BaseSchema):
    """System settings update request schema"""

    settings: dict = Field(..., description="System settings")

    @validator("settings")
    def validate_settings(cls, v):
        if not isinstance(v, dict):
            raise ValueError("Settings must be a dictionary")
        return v


class SecurityRuleCreateSchema(BaseSchema):
    """Security rule creation request schema"""

    name: str = Field(..., min_length=1, max_length=100, description="Rule name")
    description: Optional[str] = Field(default=None, max_length=500, description="Rule description")
    rule_type: str = Field(..., description="Rule type")
    pattern: str = Field(..., min_length=1, description="Rule pattern")
    action: str = Field(..., description="Rule action")
    enabled: bool = Field(default=True, description="Whether rule is enabled")

    @validator("rule_type")
    def validate_rule_type(cls, v):
        allowed_types = ["ip_whitelist", "ip_blacklist", "user_agent", "rate_limit", "geo_block"]
        if v not in allowed_types:
            raise ValueError(f"Rule type must be one of: {', '.join(allowed_types)}")
        return v

    @validator("action")
    def validate_action(cls, v):
        allowed_actions = ["allow", "block", "rate_limit", "log"]
        if v not in allowed_actions:
            raise ValueError(f"Action must be one of: {', '.join(allowed_actions)}")
        return v


class SecurityRuleUpdateSchema(BaseSchema):
    """Security rule update request schema"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Rule name")
    description: Optional[str] = Field(default=None, max_length=500, description="Rule description")
    rule_type: Optional[str] = Field(default=None, description="Rule type")
    pattern: Optional[str] = Field(default=None, min_length=1, description="Rule pattern")
    action: Optional[str] = Field(default=None, description="Rule action")
    enabled: Optional[bool] = Field(default=None, description="Whether rule is enabled")

    @validator("rule_type")
    def validate_rule_type(cls, v):
        if v is not None:
            allowed_types = [
                "ip_whitelist",
                "ip_blacklist",
                "user_agent",
                "rate_limit",
                "geo_block",
            ]
            if v not in allowed_types:
                raise ValueError(f"Rule type must be one of: {', '.join(allowed_types)}")
        return v

    @validator("action")
    def validate_action(cls, v):
        if v is not None:
            allowed_actions = ["allow", "block", "rate_limit", "log"]
            if v not in allowed_actions:
                raise ValueError(f"Action must be one of: {', '.join(allowed_actions)}")
        return v


class SecurityRuleResponseSchema(BaseSchema):
    """Security rule response schema"""

    id: int = Field(..., description="Rule ID")
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(default=None, description="Rule description")
    rule_type: str = Field(..., description="Rule type")
    pattern: str = Field(..., description="Rule pattern")
    action: str = Field(..., description="Rule action")
    enabled: bool = Field(..., description="Whether rule is enabled")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")


class BackupCreateSchema(BaseSchema):
    """Backup creation request schema"""

    backup_type: str = Field(default="full", description="Backup type")
    include_files: bool = Field(default=True, description="Include uploaded files")
    description: Optional[str] = Field(
        default=None, max_length=200, description="Backup description"
    )

    @validator("backup_type")
    def validate_backup_type(cls, v):
        allowed_types = ["full", "database_only", "files_only"]
        if v not in allowed_types:
            raise ValueError(f"Backup type must be one of: {', '.join(allowed_types)}")
        return v


class BackupResponseSchema(BaseSchema):
    """Backup response schema"""

    id: int = Field(..., description="Backup ID")
    backup_type: str = Field(..., description="Backup type")
    include_files: bool = Field(..., description="Include uploaded files")
    description: Optional[str] = Field(default=None, description="Backup description")
    status: str = Field(..., description="Backup status")
    file_path: Optional[str] = Field(default=None, description="Backup file path")
    file_size: Optional[int] = Field(default=None, description="Backup file size in bytes")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    completed_at: Optional[str] = Field(default=None, description="Completion timestamp")


class AdminStatsResponseSchema(BaseSchema):
    """Admin statistics response schema"""

    total_users: int = Field(..., description="Total number of users")
    active_users: int = Field(..., description="Number of active users")
    total_projects: int = Field(..., description="Total number of projects")
    active_projects: int = Field(..., description="Number of active projects")
    total_games: int = Field(..., description="Total number of games")
    total_keys: int = Field(..., description="Total number of keys")
    active_sessions: int = Field(..., description="Number of active sessions")
    system_uptime: Optional[str] = Field(default=None, description="System uptime")
    last_backup: Optional[str] = Field(default=None, description="Last backup timestamp")
