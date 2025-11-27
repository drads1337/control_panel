"""
RBAC Pydantic schemas
"""

from typing import Dict, List, Optional

from pydantic import Field, field_validator

from .common import BaseSchema


class RoleCreateSchema(BaseSchema):
    """Schema for creating a role"""

    name: str = Field(..., min_length=1, max_length=255, description="Role name")
    description: Optional[str] = Field(default="", max_length=1000, description="Role description")
    permissions: List[str] = Field(default_factory=list, description="List of permission names")
    parent_role_id: Optional[int] = Field(default=None, ge=1, description="Parent role ID")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize role name"""
        if not v or not v.strip():
            raise ValueError("Role name cannot be empty")
        return v.strip()

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: List[str]) -> List[str]:
        """Validate permissions list"""
        if not isinstance(v, list):
            raise ValueError("Permissions must be a list")
        return v


class RoleUpdateSchema(BaseSchema):
    """Schema for updating a role"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Role name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Role description")
    permissions: Optional[List[str]] = Field(default=None, description="List of permission names")
    parent_role_id: Optional[int] = Field(default=None, ge=1, description="Parent role ID")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize role name"""
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError("Role name cannot be empty")
        return v.strip()


class RoleDeleteSchema(BaseSchema):
    """Schema for deleting a role"""

    force: bool = Field(default=False, description="Force delete even if role has users")
    reassign_to_role_id: Optional[int] = Field(default=None, ge=1, description="Reassign users to this role")


class PermissionCreateSchema(BaseSchema):
    """Schema for creating a permission"""

    name: str = Field(..., min_length=1, max_length=255, description="Permission name")
    description: Optional[str] = Field(default="", max_length=1000, description="Permission description")
    resource: str = Field(..., min_length=1, max_length=255, description="Resource name")
    action: str = Field(..., min_length=1, max_length=255, description="Action name")
    product_id: Optional[int] = Field(default=None, ge=1, description="Product ID")
    resource_type: Optional[str] = Field(default=None, max_length=255, description="Resource type")
    resource_id: Optional[int] = Field(default=None, ge=1, description="Resource ID")
    scope: str = Field(default="global", description="Permission scope")

    @field_validator("name", "resource", "action")
    @classmethod
    def validate_required_fields(cls, v: str, info) -> str:
        """Validate required string fields"""
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} cannot be empty")
        return v.strip()

    @field_validator("scope")
    @classmethod
    def validate_scope(cls, v: str) -> str:
        """Validate scope"""
        allowed_scopes = ["global", "project", "product"]
        if v not in allowed_scopes:
            raise ValueError(f"Scope must be one of {allowed_scopes}")
        return v


class PermissionUpdateSchema(BaseSchema):
    """Schema for updating a permission"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Permission name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Permission description")
    resource: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Resource name")
    action: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Action name")
    product_id: Optional[int] = Field(default=None, ge=1, description="Product ID")
    resource_type: Optional[str] = Field(default=None, max_length=255, description="Resource type")
    resource_id: Optional[int] = Field(default=None, ge=1, description="Resource ID")
    scope: Optional[str] = Field(default=None, description="Permission scope")


class UserRoleAssignSchema(BaseSchema):
    """Schema for assigning a role to a user"""

    role_id: int = Field(..., ge=1, description="Role ID to assign")


class UserPermissionsAssignSchema(BaseSchema):
    """Schema for assigning permissions to a user"""

    permissions: List[str] = Field(..., min_items=1, description="List of permission names")

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: List[str]) -> List[str]:
        """Validate permissions list"""
        if not v or len(v) == 0:
            raise ValueError("At least one permission is required")
        return v


class PermissionCheckSchema(BaseSchema):
    """Schema for checking a permission"""

    permission: str = Field(..., min_length=1, description="Permission name to check")
    resource_type: Optional[str] = Field(default=None, description="Resource type")
    resource_id: Optional[int] = Field(default=None, ge=1, description="Resource ID")
    context: Optional[Dict] = Field(default_factory=dict, description="Additional context")


class AttributeRuleCreateSchema(BaseSchema):
    """Schema for creating an attribute rule"""

    name: str = Field(..., min_length=1, max_length=255, description="Rule name")
    description: Optional[str] = Field(default="", max_length=1000, description="Rule description")
    rule_type: str = Field(..., description="Rule type")
    conditions: Dict = Field(default_factory=dict, description="Rule conditions")
    target_resource: Optional[str] = Field(default=None, description="Target resource")
    target_action: Optional[str] = Field(default=None, description="Target action")
    priority: int = Field(default=100, ge=0, description="Rule priority")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and normalize rule name"""
        if not v or not v.strip():
            raise ValueError("Rule name cannot be empty")
        return v.strip()


class UserAttributeSetSchema(BaseSchema):
    """Schema for setting a user attribute"""

    attribute_name: str = Field(..., min_length=1, max_length=255, description="Attribute name")
    attribute_value: str = Field(..., description="Attribute value")
    attribute_type: str = Field(default="string", description="Attribute type")

    @field_validator("attribute_name")
    @classmethod
    def validate_attribute_name(cls, v: str) -> str:
        """Validate attribute name"""
        if not v or not v.strip():
            raise ValueError("Attribute name cannot be empty")
        return v.strip()

    @field_validator("attribute_type")
    @classmethod
    def validate_attribute_type(cls, v: str) -> str:
        """Validate attribute type"""
        allowed_types = ["string", "integer", "boolean", "float"]
        if v not in allowed_types:
            raise ValueError(f"Attribute type must be one of {allowed_types}")
        return v


class ResourceAttributeSetSchema(BaseSchema):
    """Schema for setting a resource attribute"""

    attribute_name: str = Field(..., min_length=1, max_length=255, description="Attribute name")
    attribute_value: str = Field(..., description="Attribute value")
    attribute_type: str = Field(default="string", description="Attribute type")

    @field_validator("attribute_name")
    @classmethod
    def validate_attribute_name(cls, v: str) -> str:
        """Validate attribute name"""
        if not v or not v.strip():
            raise ValueError("Attribute name cannot be empty")
        return v.strip()

    @field_validator("attribute_type")
    @classmethod
    def validate_attribute_type(cls, v: str) -> str:
        """Validate attribute type"""
        allowed_types = ["string", "integer", "boolean", "float"]
        if v not in allowed_types:
            raise ValueError(f"Attribute type must be one of {allowed_types}")
        return v


class RolePermissionAssignSchema(BaseSchema):
    """Schema for assigning a permission to a role"""

    permission_id: int = Field(..., ge=1, description="Permission ID")
    permission_type: str = Field(default="allow", description="Permission type (allow/deny)")

    @field_validator("permission_type")
    @classmethod
    def validate_permission_type(cls, v: str) -> str:
        """Validate permission type"""
        if v not in ["allow", "deny"]:
            raise ValueError("Permission type must be 'allow' or 'deny'")
        return v


class RolePermissionsUpdateSchema(BaseSchema):
    """Schema for updating role permissions"""

    permission_ids: List[int] = Field(..., min_items=0, description="List of permission IDs")

    @field_validator("permission_ids")
    @classmethod
    def validate_permission_ids(cls, v: List[int]) -> List[int]:
        """Validate permission IDs"""
        if not isinstance(v, list):
            raise ValueError("Permission IDs must be a list")
        if any(pid <= 0 for pid in v):
            raise ValueError("All permission IDs must be positive integers")
        return v

