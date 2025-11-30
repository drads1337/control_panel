"""
Type definitions and DTOs for the application.

This module centralizes type definitions to avoid circular imports and
reduce the need for imports inside functions/methods.

Usage:
    from ..utils.types import UserDict, ProjectDict, ServiceResult
    
    def get_user(user_id: int) -> UserDict:
        ...
"""

from typing import Dict, Any, Optional, List, Union
from datetime import datetime

# Type aliases for common data structures
UserDict = Dict[str, Any]
ProjectDict = Dict[str, Any]
KeyDict = Dict[str, Any]
ProductDict = Dict[str, Any]
ServerDict = Dict[str, Any]
PermissionDict = Dict[str, Any]
RoleDict = Dict[str, Any]
ActivityDict = Dict[str, Any]
NotificationDict = Dict[str, Any]
WebhookDict = Dict[str, Any]
SettingsDict = Dict[str, Any]

# Generic response types
ServiceResponse = Dict[str, Any]
ErrorResponse = Dict[str, Any]

# List types
UserList = List[UserDict]
ProjectList = List[ProjectDict]
KeyList = List[KeyDict]
ProductList = List[ProductDict]
ServerList = List[ServerDict]
PermissionList = List[PermissionDict]
RoleList = List[RoleDict]
ActivityList = List[ActivityDict]

# Common field types
IDType = Union[int, str]
Timestamp = Union[datetime, str]
StatusType = str

# Cache-related types
CacheKey = str
CacheValue = Any
CacheTTL = Optional[int]

# Pagination types
PageNumber = int
PageSize = int
TotalCount = int

# Filter types
FilterDict = Dict[str, Any]
SortOrder = str  # 'asc' or 'desc'
SortField = str

