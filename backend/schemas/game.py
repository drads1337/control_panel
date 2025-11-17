"""
Game-related Pydantic schemas
"""

from typing import List, Optional

from pydantic import BaseModel, Field, validator

from .common import BaseSchema


class GameCreateSchema(BaseSchema):
    """Game creation request schema"""

    name: str = Field(..., min_length=1, max_length=100, description="Game name")
    description: Optional[str] = Field(default=None, max_length=500, description="Game description")
    version: Optional[str] = Field(default=None, max_length=50, description="Game version")
    status: str = Field(default="active", description="Game status")
    is_multi_app: Optional[bool] = Field(
        default=False, description="True for multi-app, False for application library"
    )
    login_type: Optional[str] = Field(
        default="license_generation",
        description="'license_generation' | 'invite_code' | 'classic_login'",
    )
    invite_code_required: Optional[bool] = Field(
        default=False, description="Require invite code for registration"
    )
    config: Optional[dict] = Field(default=None, description="Game configuration")

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Game name is required")
        return v.strip()

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "maintenance", "testing", "deprecated"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v

    @validator("login_type")
    def validate_login_type(cls, v):
        if v is None:
            return v
        allowed_login_types = ["license_generation", "invite_code", "classic_login"]
        if v not in allowed_login_types:
            raise ValueError(f"login_type must be one of: {', '.join(allowed_login_types)}")
        return v


class GameUpdateSchema(BaseSchema):
    """Game update request schema"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Game name")
    description: Optional[str] = Field(default=None, max_length=500, description="Game description")
    version: Optional[str] = Field(default=None, max_length=50, description="Game version")
    status: Optional[str] = Field(default=None, description="Game status")
    is_multi_app: Optional[bool] = Field(
        default=None, description="True for multi-app, False for application library"
    )
    login_type: Optional[str] = Field(
        default=None, description="'license_generation' | 'invite_code' | 'classic_login'"
    )
    invite_code_required: Optional[bool] = Field(
        default=None, description="Require invite code for registration"
    )
    config: Optional[dict] = Field(default=None, description="Game configuration")

    @validator("name")
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError("Game name cannot be empty")
        return v.strip() if v else v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["active", "inactive", "maintenance", "testing", "deprecated"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v

    @validator("login_type")
    def validate_update_login_type(cls, v):
        if v is None:
            return v
        allowed_login_types = ["license_generation", "invite_code", "classic_login"]
        if v not in allowed_login_types:
            raise ValueError(f"login_type must be one of: {', '.join(allowed_login_types)}")
        return v


class GameResponseSchema(BaseSchema):
    """Game response schema"""

    id: int = Field(..., description="Game ID")
    name: str = Field(..., description="Game name")
    description: Optional[str] = Field(default=None, description="Game description")
    version: Optional[str] = Field(default=None, description="Game version")
    status: str = Field(..., description="Game status")
    is_multi_app: bool = Field(..., description="True for multi-app, False for application library")
    login_type: Optional[str] = Field(
        default=None, description="'license_generation' | 'invite_code' | 'classic_login'"
    )
    invite_code_required: Optional[bool] = Field(
        default=None, description="Require invite code for registration"
    )
    config: Optional[dict] = Field(default=None, description="Game configuration")
    project_id: int = Field(..., description="Project ID")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")


class GameListResponseSchema(BaseSchema):
    """Game list response schema"""

    games: List[GameResponseSchema] = Field(..., description="List of games")
    total: int = Field(..., description="Total number of games")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total pages")


class GameConfigUpdateSchema(BaseSchema):
    """Game configuration update request schema"""

    config: dict = Field(..., description="Game configuration")

    @validator("config")
    def validate_config(cls, v):
        if not isinstance(v, dict):
            raise ValueError("Configuration must be a dictionary")
        return v


class GameStatusUpdateSchema(BaseSchema):
    """Game status update request schema"""

    status: str = Field(..., description="New game status")

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "maintenance", "testing", "deprecated"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v
