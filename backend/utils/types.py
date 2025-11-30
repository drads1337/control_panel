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


ServiceResponse = Dict[str, Any]
ErrorResponse = Dict[str, Any]


UserList = List[UserDict]
ProjectList = List[ProjectDict]
KeyList = List[KeyDict]
ProductList = List[ProductDict]
ServerList = List[ServerDict]
PermissionList = List[PermissionDict]
RoleList = List[RoleDict]
ActivityList = List[ActivityDict]


IDType = Union[int, str]
Timestamp = Union[datetime, str]
StatusType = str


CacheKey = str
CacheValue = Any
CacheTTL = Optional[int]


PageNumber = int
PageSize = int
TotalCount = int


FilterDict = Dict[str, Any]
SortOrder = str
SortField = str

