"""
Changelog Pydantic schemas
"""

from datetime import datetime
from typing import List, Optional

from pydantic import Field, field_validator

from .common import BaseSchema


class ChangelogEntryCreateSchema(BaseSchema):
    """Schema for creating a changelog entry"""

    version: str = Field(..., min_length=1, max_length=50, description="Version number")
    title: str = Field(..., min_length=1, max_length=255, description="Changelog title")
    changes: List[str] = Field(default_factory=list, description="List of changes")
    description: Optional[str] = Field(default=None, max_length=2000, description="Changelog description")
    release_date: Optional[datetime] = Field(default=None, description="Release date (ISO format)")

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: str) -> str:
        """Validate and normalize version"""
        if not v or not v.strip():
            raise ValueError("Version cannot be empty")
        return v.strip()

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        """Validate and normalize title"""
        if not v or not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()

    @field_validator("changes")
    @classmethod
    def validate_changes(cls, v: List[str]) -> List[str]:
        """Validate changes list"""
        if not isinstance(v, list):
            raise ValueError("Changes must be a list")
        return v


class ChangelogEntryUpdateSchema(BaseSchema):
    """Schema for updating a changelog entry"""

    version: Optional[str] = Field(default=None, min_length=1, max_length=50, description="Version number")
    title: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Changelog title")
    changes: Optional[List[str]] = Field(default=None, description="List of changes")
    description: Optional[str] = Field(default=None, max_length=2000, description="Changelog description")
    release_date: Optional[datetime] = Field(default=None, description="Release date (ISO format)")

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize version"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Version cannot be empty")
        return v.strip()

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize title"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()


class AgentChangelogEntryCreateSchema(BaseSchema):
    """Schema for creating an agent changelog entry"""

    version: str = Field(..., min_length=1, max_length=50, description="Version number")
    title: str = Field(..., min_length=1, max_length=255, description="Changelog title")
    changes: List[str] = Field(default_factory=list, description="List of changes")
    change_type: str = Field(default="release", description="Change type")
    custom_type_name: Optional[str] = Field(default=None, max_length=100, description="Custom type name")
    description: Optional[str] = Field(default=None, max_length=2000, description="Changelog description")
    release_date: Optional[datetime] = Field(default=None, description="Release date (ISO format)")

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: str) -> str:
        """Validate and normalize version"""
        if not v or not v.strip():
            raise ValueError("Version cannot be empty")
        return v.strip()

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        """Validate and normalize title"""
        if not v or not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()

    @field_validator("change_type")
    @classmethod
    def validate_change_type(cls, v: str) -> str:
        """Validate change type"""
        allowed_types = ["release", "update", "fix", "feature", "custom"]
        if v not in allowed_types:
            raise ValueError(f"Change type must be one of {allowed_types}")
        return v

    @field_validator("changes")
    @classmethod
    def validate_changes(cls, v: List[str]) -> List[str]:
        """Validate changes list"""
        if not isinstance(v, list):
            raise ValueError("Changes must be a list")
        return v

