"""
Server-related Pydantic schemas
"""

from typing import List, Optional

from pydantic import Field, field_validator, IPvAnyAddress

from .common import BaseSchema


class ServerCreateSchema(BaseSchema):
    """Schema for creating a server"""

    name: str = Field(..., min_length=1, max_length=255, description="Server name")
    ip_address: IPvAnyAddress = Field(..., description="Server IP address")
    username: str = Field(..., min_length=1, max_length=255, description="SSH username")
    password: str = Field(..., min_length=1, description="SSH password")
    port: int = Field(default=22, ge=1, le=65535, description="SSH port")
    description: Optional[str] = Field(default=None, max_length=1000, description="Server description")
    is_active: bool = Field(default=True, description="Whether the server is active")
    project_id: Optional[int] = Field(default=None, ge=1, description="Project ID (for owners)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize server name"""
        if not v or not v.strip():
            raise ValueError("Server name cannot be empty")
        return v.strip()

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username"""
        if not v or not v.strip():
            raise ValueError("Username cannot be empty")
        return v.strip()


class ServerBulkDeleteSchema(BaseSchema):
    """Schema for bulk server deletion"""

    server_ids: List[int] = Field(..., min_items=1, description="List of server IDs")

    @field_validator("server_ids")
    @classmethod
    def validate_server_ids(cls, v: List[int]) -> List[int]:
        """Validate server IDs list"""
        if not v or len(v) == 0:
            raise ValueError("At least one server ID is required")
        if any(sid <= 0 for sid in v):
            raise ValueError("All server IDs must be positive integers")
        return v

