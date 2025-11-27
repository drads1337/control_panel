"""
Common utilities and helper functions for keys routes
"""

from ...models import Key, User
from ...utils.rbac_utils import RBACManager
from ...utils.service_helpers import get_service

def can_manage_key(user: User, key: Key, action_permission: str) -> bool:
    """
    Check if user can manage a key for a specific action.

    Args:
        user: User making the request
        key: Key to check
        action_permission: Permission required for the action (e.g., 'keys.edit', 'keys.delete')

    Returns:
        True if user can manage the key, False otherwise
    """

    if RBACManager.is_owner(user) or RBACManager.is_admin(user):
        return True

    is_own_key = key.user_id == user.id

    rbac_service = get_service('rbac_service')
    if is_own_key:
        return rbac_service.check_permission(user.id, action_permission)

    has_manage = rbac_service.check_permission(user.id, "keys.manage")
    has_action = rbac_service.check_permission(user.id, action_permission)
    return has_manage and has_action
