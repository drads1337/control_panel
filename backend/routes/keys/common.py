"""
Common utilities and helper functions for keys routes
"""

from ...models import Key, User
from ...services.rbac import rbac_service
from ...utils.rbac_utils import RBACManager


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
    # Owner and admin can always manage keys
    if RBACManager.is_owner(user) or RBACManager.is_admin(user):
        return True

    # Check if key belongs to the user
    is_own_key = key.user_id == user.id

    # If it's their own key, check if they have the action permission
    if is_own_key:
        return rbac_service.check_permission(user.id, action_permission)

    # If it's not their own key, they need both manage permission and action permission
    has_manage = rbac_service.check_permission(user.id, "keys.manage")
    has_action = rbac_service.check_permission(user.id, action_permission)
    return has_manage and has_action
