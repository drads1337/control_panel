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
    CLIENT = "client"
    USER = "user"

class RolePermissions:
    """Role-based permission constants"""

    ADMIN_ROLES = [UserRoles.OWNER.value, UserRoles.ADMIN.value]

    USER_CREATION_ROLES = [UserRoles.OWNER.value, UserRoles.ADMIN.value, UserRoles.MODERATOR.value]

    BALANCE_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
    ]

    PRODUCT_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
    ]

    REMOTE_CONTROL_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
    ]

    WEBHOOK_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
        UserRoles.CLIENT.value,
    ]

    SECURITY_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
    ]

    FILE_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
    ]

    PRODUCTS_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
    ]

    LOADERS_MANAGEMENT_ROLES = [
        UserRoles.OWNER.value,
        UserRoles.ADMIN.value,
        UserRoles.MODERATOR.value,
        UserRoles.SELLER.value,
    ]

    STATIC_ROLES = [UserRoles.OWNER.value, UserRoles.ADMIN.value]

    ASSIGNABLE_ROLES = [
        UserRoles.SELLER.value,
        UserRoles.MODERATOR.value,
    ]

LEGACY_ROLE_MAPPING = {
    "user": UserRoles.CLIENT.value,
    "client": UserRoles.CLIENT.value,
    "admin": UserRoles.ADMIN.value,
    "owner": UserRoles.OWNER.value,
    "moderator": UserRoles.MODERATOR.value,
    "seller": UserRoles.SELLER.value,
}
