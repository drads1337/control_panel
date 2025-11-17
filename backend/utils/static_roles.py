"""
Static Role Utilities
Simple role-based access control using static role field in User model

DEPRECATED: This module is deprecated and will be removed in a future version.
All role checks should use RBACManager from utils.rbac_utils instead.

Migration path:
- Replace StaticRoleManager.is_admin(user) with RBACManager.is_admin(user)
- Replace StaticRoleManager.is_owner(user) with RBACManager.is_owner(user)
- Replace StaticRoleManager.has_role(user, role) with RBACManager.user_has_role(user, role)
- Replace StaticRoleManager.get_user_role(user) with RBACManager.get_user_role_names(user)[0]

The RBAC system (models/rbac.py, services/rbac_service.py) is now the single source of truth
for all authorization checks.
"""

from typing import List

from ..models.core import User


class StaticRoleManager:
    """Manager for static roles using User.role field"""

    @staticmethod
    def is_owner(user: User) -> bool:
        """Check if user has owner role"""
        if not user:
            return False
        return user.role == "owner"

    @staticmethod
    def is_admin(user: User) -> bool:
        """Check if user has admin role or is_admin flag (static roles only)"""
        if not user:
            return False
        return user.role == "admin" or user.is_admin or user.role == "owner"

    @staticmethod
    def has_role(user: User, role_name: str) -> bool:
        """Check if user has specific role"""
        if not user:
            return False
        return user.role == role_name

    @staticmethod
    def has_any_role(user: User, roles: List[str]) -> bool:
        """Check if user has any of the specified roles"""
        if not user:
            return False
        return user.role in roles

    @staticmethod
    def get_user_role(user: User) -> str:
        """Get user's role"""
        if not user:
            return "client"
        return user.role or "client"

    @staticmethod
    def can_access_project(user: User, project_id: int) -> bool:
        """Check if user can access project"""
        if not user:
            return False

        # Owner can access any project
        if StaticRoleManager.is_owner(user):
            return True

        # User can only access their own project
        return user.project_id == project_id
