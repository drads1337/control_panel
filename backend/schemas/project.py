"""
Project-related Pydantic schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator

from .common import BaseSchema


class ProjectCreateSchema(BaseSchema):
    """Project creation request schema"""

    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    description: Optional[str] = Field(
        default=None, max_length=500, description="Project description"
    )
    status: str = Field(default="active", description="Project status")
    settings: Optional[dict] = Field(default=None, description="Project settings")

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Project name is required")
        return v.strip()

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "suspended", "archived"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v


class ProjectUpdateSchema(BaseSchema):
    """Project update request schema"""

    name: Optional[str] = Field(
        default=None, min_length=1, max_length=100, description="Project name"
    )
    description: Optional[str] = Field(
        default=None, max_length=500, description="Project description"
    )
    status: Optional[str] = Field(default=None, description="Project status")
    settings: Optional[dict] = Field(default=None, description="Project settings")

    @validator("name")
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError("Project name cannot be empty")
        return v.strip() if v else v

    @validator("status")
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["active", "inactive", "suspended", "archived"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v


class ProjectResponseSchema(BaseSchema):
    """Project response schema"""

    id: int = Field(..., description="Project ID")
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(default=None, description="Project description")
    status: str = Field(..., description="Project status")
    settings: Optional[dict] = Field(default=None, description="Project settings")
    owner_id: int = Field(..., description="Project owner ID")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")
    expiry_date: Optional[str] = Field(default=None, description="Project expiry date")


class ProjectListResponseSchema(BaseSchema):
    """Project list response schema"""

    projects: List[ProjectResponseSchema] = Field(..., description="List of projects")
    total: int = Field(..., description="Total number of projects")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total pages")


class ProjectSettingsUpdateSchema(BaseSchema):
    """Project settings update request schema"""

    settings: dict = Field(..., description="Project settings")

    @validator("settings")
    def validate_settings(cls, v):
        if not isinstance(v, dict):
            raise ValueError("Settings must be a dictionary")
        return v


class ProjectStatusUpdateSchema(BaseSchema):
    """Project status update request schema"""

    status: str = Field(..., description="New project status")
    reason: Optional[str] = Field(default=None, max_length=500, description="Status change reason")

    @validator("status")
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "suspended", "archived"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of: {', '.join(allowed_statuses)}")
        return v


class ProjectSuspensionSchema(BaseSchema):
    """Project suspension request schema"""

    reason: Optional[str] = Field(default=None, max_length=500, description="Suspension reason")

    @validator("reason")
    def validate_reason(cls, v):
        if v is not None and len(v.strip()) == 0:
            return None
        return v


class ProjectReactivationSchema(BaseSchema):
    """Project reactivation request schema"""

    new_expiry_date: Optional[datetime] = Field(default=None, description="New expiry date")

    @validator("new_expiry_date")
    def validate_expiry_date(cls, v):
        if v is not None and v <= datetime.utcnow():
            raise ValueError("New expiry date must be in the future")
        return v
