"""
RBAC Utilities
Centralized role-based access control utilities to eliminate code duplication
"""

import logging
from functools import wraps
from typing import List, Tuple

from flask import g, jsonify

from ..core.extensions import db
from ..models.core import User
from ..models.rbac import Permission, Role, RolePermission, UserRole

class RBACManager:
    """Centralized RBAC management"""

    @staticmethod
    def get_user_roles(user_id: int, project_id: int) -> List[str]:
        """Get all roles for a user in a project"""
        try:
            user_roles = (
                db.session.query(Role.name)
                .join(UserRole)
                .filter(UserRole.user_id == user_id, Role.project_id == project_id)
                .all()
            )
            return [role.name for role in user_roles]
        except Exception as e:
            logging.error(f"Error getting user roles: {e}")
            return []

    @staticmethod
    def get_role_permissions(role_id: int) -> List[str]:
        """Get all permissions for a role"""
        try:
            permissions = (
                db.session.query(Permission.name)
                .join(RolePermission)
                .filter(RolePermission.role_id == role_id)
                .all()
            )
            return [perm.name for perm in permissions]
        except Exception as e:
            logging.error(f"Error getting role permissions: {e}")
            return []

    @staticmethod
    def get_user_permissions(user_id: int, project_id: int) -> List[str]:
        """Get all permissions for a user in a project"""
        try:
            permissions = (
                db.session.query(Permission.name)
                .join(RolePermission)
                .join(Role, RolePermission.role_id == Role.id)
                .join(UserRole)
                .filter(UserRole.user_id == user_id, Role.project_id == project_id)
                .all()
            )
            return [perm.name for perm in permissions]
        except Exception as e:
            logging.error(f"Error getting user permissions: {e}")
            return []

    @staticmethod
    def has_permission(user_id: int, project_id: int, permission: str) -> bool:
        """Check if user has specific permission"""
        try:
            from ..services.rbac import rbac_service

            return rbac_service.check_permission(user_id, permission)
        except Exception as e:
            logging.error(
                f"RBAC_HAS_PERMISSION_ERROR user_id={user_id} permission={permission} error={e}"
            )

            permissions = RBACManager.get_user_permissions(user_id, project_id)
            return permission in permissions

    @staticmethod
    def has_role(user_id: int, project_id: int, role: str) -> bool:
        """Check if user has specific role"""
        roles = RBACManager.get_user_roles(user_id, project_id)
        return role in roles

    @staticmethod
    def is_admin(user: User) -> bool:
        """
        Check if user is admin using RBAC system only.

        NOTE: This method uses ONLY RBAC roles. Static roles (user.role, user.is_admin)
        are deprecated and no longer supported. All users must be migrated to RBAC.
        """
        if not user:
            return False

        try:

            user_roles = RBACManager.get_user_role_names(user)

            admin_roles = ["admin", "owner"]
            return any(role in user_roles for role in admin_roles)
        except Exception as e:
            logging.error(f"Error checking admin status: {e}")

            return False

    @staticmethod
    def is_owner(user: User) -> bool:
        """
        Check if user is owner using RBAC system only.

        NOTE: This method uses ONLY RBAC roles. Static roles (user.role) are deprecated
        and no longer supported. All users must be migrated to RBAC.
        """
        if not user:
            return False

        try:

            user_roles = RBACManager.get_user_role_names(user)

            return "owner" in user_roles
        except Exception as e:
            logging.error(f"Error checking owner status: {e}")

            return False

    @staticmethod
    def can_access_project(user: User, project_id: int) -> bool:
        """Check if user can access project"""
        if not user:
            return False

        if RBACManager.is_owner(user):
            return True

        return user.project_id == project_id

    @staticmethod
    def user_has_role(user: User, role_name: str) -> bool:
        """
        Check if user has specific role using RBAC system only.

        NOTE: This method uses ONLY RBAC roles. Static roles (user.role) are deprecated
        and no longer supported. All users must be migrated to RBAC.
        """
        if not user:
            return False

        user_roles = RBACManager.get_user_role_names(user)
        return role_name in user_roles

    @staticmethod
    def get_user_role_names(user: User) -> List[str]:
        """
        Get all role names for a user using RBAC system only.

        NOTE: This method uses ONLY RBAC roles. Static roles (user.role, user.is_admin)
        are deprecated and no longer supported. All users must be migrated to RBAC.

        EXCEPTION: For owners without project_id, we check the legacy user.role field
        as a fallback to maintain backward compatibility during migration.

        Returns:
            List of role names. Returns ["client"] as default if user has no RBAC roles.
        """

        try:
            from .role_constants import UserRoles
            default_role = UserRoles.CLIENT.value
        except (ImportError, AttributeError) as import_error:
            logging.error(f"Error importing UserRoles: {import_error}")

            default_role = "client"

        try:
            if not user:
                return [default_role]

            if user.project_id:
                try:
                    from ..models.rbac import Role, UserRole

                    user_roles = (
                        db.session.query(Role.name)
                        .join(UserRole)
                        .filter(UserRole.user_id == user.id, Role.project_id == user.project_id)
                        .all()
                    )
                    rbac_roles = [role.name for role in user_roles]

                    if rbac_roles:
                        return rbac_roles

                except Exception as e:
                    logging.error(f"Error getting RBAC roles for user {getattr(user, 'username', 'unknown')}: {e}")

                    return [default_role]
            
            # For users without project_id, check legacy role field as fallback
            # This is specifically for owners who don't have project_id assigned
            if not user.project_id and hasattr(user, 'role') and user.role == "owner":
                logging.debug(f"Using legacy role 'owner' for user {getattr(user, 'username', 'unknown')} without project_id")
                return ["owner"]

            return [default_role]

        except Exception as e:
            logging.error(f"Error getting user role names: {e}")
            return [default_role]

    @staticmethod
    def has_any_role(user: User, roles: List[str]) -> bool:
        """
        Check if user has any of the specified roles using RBAC system only.

        NOTE: This method uses ONLY RBAC roles. Static roles (user.role) are deprecated
        and no longer supported. All users must be migrated to RBAC.
        """
        if not user:
            return False

        user_roles = RBACManager.get_user_role_names(user)
        return any(role in user_roles for role in roles)

def require_permission(permission: str):
    """
    Decorator to require specific permission.

    NOTE: This decorator expects current_user to be passed explicitly via kwargs
    (typically by middleware decorators like enforce_project_scope, require_project_isolation).
    Prefer using middleware decorators that pass dependencies explicitly.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):

            current_user = kwargs.get("current_user")
            if not current_user:

                current_user = getattr(g, "current_user", None)

            if not current_user:
                return jsonify({"error": "Authentication required"}), 401

            if not current_user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403

            if not RBACManager.has_permission(current_user.id, current_user.project_id, permission):
                return jsonify({"error": "Insufficient permissions"}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator

def require_role(role: str):
    """
    Decorator to require specific role.

    NOTE: This decorator expects current_user to be passed explicitly via kwargs
    (typically by middleware decorators like enforce_project_scope, require_project_isolation).
    Prefer using middleware decorators that pass dependencies explicitly.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):

            current_user = kwargs.get("current_user")
            if not current_user:

                current_user = getattr(g, "current_user", None)

            if not current_user:
                return jsonify({"error": "Authentication required"}), 401

            if not current_user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403

            if not RBACManager.has_role(current_user.id, current_user.project_id, role):
                return jsonify({"error": "Insufficient role"}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator

def require_admin(f):
    """
    Decorator to require admin role.

    NOTE: This decorator expects current_user to be passed explicitly via kwargs
    (typically by middleware decorators like enforce_project_scope, require_project_isolation).
    Prefer using middleware decorators that pass dependencies explicitly.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):

        current_user = kwargs.get("current_user")
        if not current_user:

            current_user = getattr(g, "current_user", None)

        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if not RBACManager.is_admin(current_user):
            return jsonify({"error": "Admin access required"}), 403

        return f(*args, **kwargs)

    return decorated_function

def require_owner(f):
    """
    Decorator to require owner role.

    NOTE: This decorator expects current_user to be passed explicitly via kwargs
    (typically by middleware decorators like enforce_project_scope, require_project_isolation).
    Prefer using middleware decorators that pass dependencies explicitly.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):

        current_user = kwargs.get("current_user")
        if not current_user:

            current_user = getattr(g, "current_user", None)

        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if not RBACManager.is_owner(current_user):
            return jsonify({"error": "Owner access required"}), 403

        return f(*args, **kwargs)

    return decorated_function

def validate_project_access(user: User, project_id: int) -> Tuple[bool, str]:
    """Validate if user can access project"""
    if not user:
        return False, "User not found"

    if not RBACManager.can_access_project(user, project_id):
        return False, "Access denied to project"

    return True, ""

def requires_project_assignment(user: User) -> Tuple[bool, str]:
    """
    Check if user requires project assignment.
    Owners don't need project assignment.

    Returns:
        Tuple of (requires_assignment, error_message)
    """
    if not user:
        return True, "User not found"

    if RBACManager.is_owner(user):
        return False, ""

    if not user.project_id:
        return True, "User must be assigned to a project"

    return False, ""

def validate_game_access(user: User, game_id: int) -> Tuple[bool, str]:
    """Validate if user can access game"""
    if not user:
        return False, "User not found"

    from ..models.games import Game

    game = Game.query.get(game_id)
    if not game:
        return False, "Game not found"

    return validate_project_access(user, game.project_id)
