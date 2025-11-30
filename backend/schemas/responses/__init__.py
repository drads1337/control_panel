"""
Service response schemas for type-safe return values.

These Pydantic models replace Dict[str, Any] return types in services
to provide better type safety, IDE support, and self-documenting code.
"""

from .service_responses import (

    KeyListItem,
    KeyListResponse,
    KeyDetailsResponse,
    KeyDetailsData,
    DeviceInfo,
    KeyStatsResponse,

    UserListItem,
    UserListResponse,
    UserKeyCounts,
    RBACRoleInfo,
    UserStatsResponse,
    UserActivityItem,
    UserActivitiesResponse,
    UserTransactionItem,
    UserTransactionsResponse,
)

__all__ = [
    "KeyListItem",
    "KeyListResponse",
    "KeyDetailsResponse",
    "KeyDetailsData",
    "DeviceInfo",
    "KeyStatsResponse",
    "UserListItem",
    "UserListResponse",
    "UserKeyCounts",
    "RBACRoleInfo",
    "UserStatsResponse",
    "UserActivityItem",
    "UserActivitiesResponse",
    "UserTransactionItem",
    "UserTransactionsResponse",
]

