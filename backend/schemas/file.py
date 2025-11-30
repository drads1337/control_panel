"""
File management Pydantic schemas
"""

from typing import List, Optional, Union

from pydantic import BaseModel, Field, field_validator

from .common import BaseSchema


class FileBulkActionSchema(BaseSchema):
    """Schema for bulk file operations"""

    action: str = Field(..., description="Action to perform (e.g., 'delete')")
    filenames: List[str] = Field(..., min_items=1, description="List of filenames to process")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        """Validate action"""
        allowed_actions = ["delete"]
        if v not in allowed_actions:
            raise ValueError(f"Action must be one of {allowed_actions}")
        return v

    @field_validator("filenames")
    @classmethod
    def validate_filenames(cls, v: List[str]) -> List[str]:
        """Validate filenames list"""
        if not v or len(v) == 0:
            raise ValueError("At least one filename is required")
        return [f.strip() for f in v if f and f.strip()]


class FileStatusUpdateSchema(BaseSchema):
    """Schema for updating file status"""

    status: str = Field(..., description="New file status")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate status"""
        allowed_statuses = ["active", "inactive", "testing", "dangerous"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v


class FileConfigUpdateSchema(BaseSchema):
    """Schema for updating file configuration"""

    name: Optional[str] = Field(default=None, max_length=255, description="File name")
    description: Optional[str] = Field(default=None, max_length=1000, description="File description")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class FileRatingSchema(BaseSchema):
    """Schema for rating a file"""

    rating: float = Field(..., ge=1.0, le=5.0, description="Rating value (1-5)")

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        """Validate rating value"""
        if not isinstance(v, (int, float)):
            raise ValueError("Rating must be a number")
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return float(v)


class FolderCreateSchema(BaseSchema):
    """Schema for creating a folder"""

    name: str = Field(..., min_length=1, max_length=255, description="Folder name")
    parent_path: str = Field(default="/", description="Parent folder path")
    product_id: Optional[Union[int, str]] = Field(default=None, description="Product ID (int) or unique_id (string, optional)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize folder name"""
        if not v or not v.strip():
            raise ValueError("Folder name cannot be empty")

        name = v.strip().replace("/", "").replace("\\", "")
        if not name:
            raise ValueError("Folder name cannot contain only path separators")
        return name

    @field_validator("parent_path")
    @classmethod
    def validate_parent_path(cls, v: str) -> str:
        """Validate parent path"""
        if not v:
            return "/"

        if not v.startswith("/"):
            return "/" + v
        return v

