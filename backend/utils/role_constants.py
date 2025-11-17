"""
Role Constants
Constants for user roles to avoid magic strings throughout the codebase
"""

from enum import Enum


class UserRoles(Enum):
    """User role constants"""

    OWNER = "owner"
    ADMIN = "admin"
    MODERATOR = "moderator"
    SELLER = "seller"
    DEVELOPER = "developer"
    CLIENT = "client"
    SUPPORT = "support"
    USER = "user"


class RolePermissions:
    """Role-based permission constants"""

    # Admin roles that can manage users
    ADMIN_ROLES = [UserRoles.OWNER.value, UserRoles.ADMIN.value, UserRoles.SUPPORT.value]

    # Roles that can create users
    USER_CREATION_ROLES = [UserRoles.OWNER.value, UserRoles.ADMIN.value, UserRoles.MODERATOR.value]

    # Roles that can manage balances
    BALANCE_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
    ]

    # Roles that can access game management
    GAME_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
        UserRoles.DEVELOPER.value,
    ]

    # Roles that can manage remote control
    REMOTE_CONTROL_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.DEVELOPER.value,
    ]

    # Roles that can manage webhooks
    WEBHOOK_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
        UserRoles.CLIENT.value,
    ]

    # Roles that can manage security
    SECURITY_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SUPPORT.value,
    ]

    # Roles that can manage files
    FILE_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.DEVELOPER.value,
    ]

    # Roles that can manage applications database
    APPLICATIONS_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
    ]

    # Roles that can manage loaders
    LOADERS_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
    ]

    # Static roles that cannot be assigned through bulk operations
    STATIC_ROLES = [UserRoles.OWNER.value, UserRoles.ADMIN.value]

    # Roles that can be assigned through bulk operations
    ASSIGNABLE_ROLES = [
        UserRoles.SELLER.value,
        UserRoles.DEVELOPER.value,
        UserRoles.MODERATOR.value,
    ]


# Legacy role mappings for backward compatibility
LEGACY_ROLE_MAPPING = {
    "user": UserRoles.CLIENT.value,
    "client": UserRoles.CLIENT.value,
    "admin": UserRoles.ADMIN.value,
    "owner": UserRoles.OWNER.value,
    "moderator": UserRoles.MODERATOR.value,
    "seller": UserRoles.SELLER.value,
    "developer": UserRoles.DEVELOPER.value,
    "support": UserRoles.SUPPORT.value,
}
