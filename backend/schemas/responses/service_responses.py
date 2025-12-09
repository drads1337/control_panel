"""
Pydantic models for service return values.

These models replace Dict[str, Any] return types to provide:
- Type safety
- Better IDE support
- Self-documenting code
- Validation of return values
"""

from datetime import datetime
from typing import List, Optional
from pydantic import Field
from ..common import BaseSchema

class KeyListItem(BaseSchema):
    """Single key item in a list response"""

    id: str = Field(..., description="Key unique ID")
    key: str = Field(..., description="Key value (may be masked)")
    user_id: int = Field(..., description="User ID who owns the key")
    product_id: int = Field(..., description="Product ID")
    product_name: Optional[str] = Field(default=None, description="Product name")
    agent_id: Optional[int] = Field(default=None, description="Agent ID")
    expires_at: Optional[str] = Field(default=None, description="Expiration timestamp (ISO format)")
    max_devices: int = Field(..., description="Maximum allowed devices")
    devices: Optional[str] = Field(default=None, description="Devices string")
    device_count: int = Field(default=0, description="Number of devices")
    status: int = Field(..., description="Key status (1=active, 2=blocked, 3=paused)")
    is_active: bool = Field(..., description="Whether key is currently active")
    is_expired: bool = Field(default=False, description="Whether key is expired")
    created_at: str = Field(..., description="Creation timestamp (ISO format)")
    activated_at: Optional[str] = Field(default=None, description="Activation timestamp (ISO format)")
    duration_hours: Optional[int] = Field(default=None, description="Key duration in hours")
    key_metadata: Optional[dict] = Field(default=None, description="Additional key metadata")
    created_by: Optional[int] = Field(default=None, description="User ID who created the key")
    creator_username: Optional[str] = Field(default=None, description="Username of the user who created the key")


class KeyListResponse(BaseSchema):
    """Response for get_keys service method"""

    keys: List[KeyListItem] = Field(..., description="List of keys")
    total: int = Field(..., description="Total number of keys matching filters")


class DeviceInfo(BaseSchema):
    """Device information"""

    id: int = Field(..., description="Device info ID")
    device_id: str = Field(..., description="Device identifier")
    device_model: Optional[str] = Field(default=None, description="Device model")
    device_brand: Optional[str] = Field(default=None, description="Device brand")
    serial: Optional[str] = Field(default=None, description="Serial number")
    ip_address: Optional[str] = Field(default=None, description="IP address")
    user_agent: Optional[str] = Field(default=None, description="User agent string")
    connected_at: Optional[str] = Field(default=None, description="Connection timestamp (ISO format)")
    last_seen: Optional[str] = Field(default=None, description="Last seen timestamp (ISO format)")


class KeyDetailsData(BaseSchema):
    """Key details data"""

    id: int = Field(..., description="Key ID")
    key: str = Field(..., description="Key value (may be masked)")
    key_masked: bool = Field(default=False, description="Whether key is masked")
    product_id: int = Field(..., description="Product ID")
    product_name: Optional[str] = Field(default=None, description="Product name")
    agent_id: Optional[int] = Field(default=None, description="Agent ID")
    status: int = Field(..., description="Key status")
    is_active: bool = Field(..., description="Whether key is active")
    is_expired: bool = Field(default=False, description="Whether key is expired")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp (ISO format)")
    expires_at: Optional[str] = Field(default=None, description="Expiration timestamp (ISO format)")
    activated_at: Optional[str] = Field(default=None, description="Activation timestamp (ISO format)")
    max_devices: int = Field(..., description="Maximum allowed devices")
    device_count: int = Field(default=0, description="Number of devices")
    duration_hours: Optional[int] = Field(default=None, description="Key duration in hours")
    project_id: int = Field(..., description="Project ID")
    fingerprint: Optional[str] = Field(default=None, description="Key fingerprint")
    key_metadata: Optional[dict] = Field(default=None, description="Additional key metadata")


class KeyDetailsResponse(BaseSchema):
    """Response for get_key_details service method"""

    key: KeyDetailsData = Field(..., description="Key details")
    devices: List[DeviceInfo] = Field(default_factory=list, description="List of devices")
    usage_history: List[dict] = Field(default_factory=list, description="Usage history")


class KeyStatsResponse(BaseSchema):
    """Response for get_key_stats service method"""

    total_keys: int = Field(..., description="Total number of keys")
    active_keys: int = Field(..., description="Number of active keys")
    expired_keys: int = Field(..., description="Number of expired keys")
    blocked_keys: int = Field(..., description="Number of blocked keys")
    paused_keys: int = Field(..., description="Number of paused keys")






class UserKeyCounts(BaseSchema):
    """User key counts"""

    total: int = Field(default=0, description="Total keys")
    active: int = Field(default=0, description="Active keys")


class RBACRoleInfo(BaseSchema):
    """RBAC role information"""

    id: int = Field(..., description="Role ID")
    name: str = Field(..., description="Role name")
    description: Optional[str] = Field(default=None, description="Role description")
    permissions: List[str] = Field(default_factory=list, description="Role permissions")
    is_system_role: bool = Field(default=False, description="Whether role is a system role")
    assigned_at: Optional[str] = Field(default=None, description="Assignment timestamp (ISO format)")


class UserListItem(BaseSchema):
    """Single user item in a list response"""

    id: str = Field(..., description="User unique ID")
    username: str = Field(..., description="Username")
    roles: List[str] = Field(default_factory=list, description="List of role names")
    rbac_roles: List[RBACRoleInfo] = Field(default_factory=list, description="Detailed RBAC roles")
    first_name: Optional[str] = Field(default=None, description="First name")
    last_name: Optional[str] = Field(default=None, description="Last name")
    email: Optional[str] = Field(default=None, description="Email address")
    avatar: Optional[str] = Field(default=None, description="Avatar file reference")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp (ISO format)")
    expires_at: Optional[str] = Field(default=None, description="Expiration timestamp (ISO format)")
    last_login: Optional[str] = Field(default=None, description="Last login timestamp (ISO format)")
    last_ip: Optional[str] = Field(default=None, description="Last IP address")
    last_country: Optional[str] = Field(default=None, description="Last country")
    last_city: Optional[str] = Field(default=None, description="Last city")
    total_keys_generated: int = Field(default=0, description="Total keys generated")
    token_balance: int = Field(default=0, description="Token balance")
    project_id: Optional[int] = Field(default=None, description="Project ID")
    key_counts: UserKeyCounts = Field(default_factory=lambda: UserKeyCounts(), description="Key counts")


class UserListResponse(BaseSchema):
    """Response for get_users_with_key_counts service method"""

    users: List[UserListItem] = Field(..., description="List of users")
    total: int = Field(..., description="Total number of users")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


class UserStatsResponse(BaseSchema):
    """Response for get_users_stats service method"""

    total_users: int = Field(..., description="Total number of users")
    active_users: int = Field(..., description="Number of active users")
    expired_users: int = Field(..., description="Number of expired users")
    total_keys: int = Field(..., description="Total number of keys")
    active_keys: int = Field(..., description="Number of active keys")


class UserActivityItem(BaseSchema):
    """User activity item"""

    id: int = Field(..., description="Activity ID")
    activity_type: str = Field(..., description="Type of activity")
    description: str = Field(..., description="Activity description")
    created_at: str = Field(..., description="Activity timestamp (ISO format)")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")


class UserActivitiesResponse(BaseSchema):
    """Response for get_user_activities service method"""

    activities: List[UserActivityItem] = Field(..., description="List of activities")
    total: int = Field(..., description="Total number of activities")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


class UserTransactionItem(BaseSchema):
    """User transaction item"""

    id: int = Field(..., description="Transaction ID")
    amount: int = Field(..., description="Transaction amount")
    type: str = Field(..., description="Transaction type (credit/debit)")
    description: str = Field(..., description="Transaction description")
    created_at: str = Field(..., description="Transaction timestamp (ISO format)")


class UserTransactionsResponse(BaseSchema):
    """Response for get_user_transactions service method"""

    transactions: List[UserTransactionItem] = Field(..., description="List of transactions")
    total: int = Field(..., description="Total number of transactions")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")






class SettingsResponse(BaseSchema):
    """Response for get_settings_cached service method"""




    pass



