"""
User Orchestrator
Coordinates complex user management operations using specialized services
Single Responsibility: Orchestration of complex user operations
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...services.activity import activity_service
from ...services.rbac import rbac_service
from .user_management_service import user_management_service
from .user_profile_service import user_profile_service

logger = logging.getLogger(__name__)

class UserOrchestrator:
    """
    Orchestrates complex user management operations
    Coordinates specialized services to handle complete user lifecycle operations
    """

    def __init__(self):
        """Initialize orchestrator with all required services"""
        self.user_management_service = user_management_service
        self.user_profile_service = user_profile_service
        self.rbac_service = rbac_service
        self.activity_service = activity_service

    def create_user_with_full_setup(
        self,
        current_user: User,
        user_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Create a new user with complete setup: roles, products, permissions, and initial balance
        Orchestrates the complete user creation process

        Args:
            current_user: User creating the new user
            user_data: Complete user data including roles, products, permissions
            ip_address: IP address for activity logging

        Returns:
            Tuple of (User object or None, error message or None)
        """
        try:

            validation_result = self._validate_user_creation_data(user_data)
            if not validation_result[0]:
                return None, validation_result[1]

            permission_result = self._check_creation_permissions(current_user, user_data)
            if not permission_result[0]:
                return None, permission_result[1]

            token_balance = user_data.get("token_balance", 0)
            if token_balance > 0:
                balance_result = self._check_and_reserve_balance(current_user, token_balance)
                if not balance_result[0]:
                    return None, balance_result[1]

            user, error = self.user_management_service.create_user_with_roles_and_products(current_user, user_data)
            if error:

                if token_balance > 0:
                    self._release_reserved_balance(current_user, token_balance)
                return None, error

            try:
                self.activity_service.log_activity(
                    current_user,
                    "create_user",
                    details=f"Created user: {user.username} (ID: {user.id})",
                    ip=ip_address,
                )
            except Exception as e:
                logger.warning(f"Failed to log user creation activity: {e}")

            logger.info(f"Successfully created user {user.username} (ID: {user.id})")
            return user, None

        except Exception as e:
            logger.error(f"Error in create_user_with_full_setup: {str(e)}", exc_info=True)

            token_balance = user_data.get("token_balance", 0)
            if token_balance > 0:
                try:
                    self._release_reserved_balance(current_user, token_balance)
                except Exception:
                    pass
            return None, f"Failed to create user: {str(e)}"

    def update_user_with_full_setup(
        self,
        current_user: User,
        target_user: User,
        user_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Update user with complete setup: profile, roles, products, permissions
        Orchestrates the complete user update process

        Args:
            current_user: User performing the update
            target_user: User being updated
            user_data: Update data including roles, products, permissions
            ip_address: IP address for activity logging

        Returns:
            Tuple of (success, error message)
        """
        try:

            permission_result = self._check_update_permissions(current_user, target_user)
            if not permission_result[0]:
                return False, permission_result[1]

            success, error = self.user_profile_service.update_user_profile(target_user, user_data)
            if not success:
                return False, error

            if "rbac_role_ids" in user_data:
                role_result = self._update_user_roles(target_user, user_data["rbac_role_ids"])
                if not role_result[0]:
                    return False, role_result[1]

            if "product_ids" in user_data:
                product_result = self._update_user_product_permissions(
                    target_user, user_data["product_ids"]
                )
                if not product_result[0]:
                    return False, product_result[1]

            try:
                self.activity_service.log_activity(
                    current_user,
                    "update_user",
                    details=f"Updated user: {target_user.username} (ID: {target_user.id})",
                    ip=ip_address,
                )
            except Exception as e:
                logger.warning(f"Failed to log user update activity: {e}")

            logger.info(f"Successfully updated user {target_user.username} (ID: {target_user.id})")
            return True, None

        except Exception as e:
            logger.error(f"Error in update_user_with_full_setup: {str(e)}", exc_info=True)
            return False, f"Failed to update user: {str(e)}"

    def delete_user_with_cleanup(
        self,
        current_user: User,
        target_user_id: int,
        ip_address: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete user with complete cleanup: roles, products, keys, activities
        Orchestrates the complete user deletion process

        Args:
            current_user: User performing the deletion
            target_user_id: ID of user to delete
            ip_address: IP address for activity logging

        Returns:
            Tuple of (success, error message)
        """
        try:

            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found"

            permission_result = self._check_deletion_permissions(current_user, target_user)
            if not permission_result[0]:
                return False, permission_result[1]

            success, error = self.user_management_service.delete_user_safely(current_user, target_user_id)
            if not success:
                return False, error

            try:
                self.activity_service.log_activity(
                    current_user,
                    "delete_user",
                    details=f"Deleted user ID: {target_user_id}",
                    ip=ip_address,
                )
            except Exception as e:
                logger.warning(f"Failed to log user deletion activity: {e}")

            logger.info(f"Successfully deleted user ID: {target_user_id}")
            return True, None

        except Exception as e:
            logger.error(f"Error in delete_user_with_cleanup: {str(e)}", exc_info=True)
            return False, f"Failed to delete user: {str(e)}"

    def _validate_user_creation_data(self, user_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate user creation data"""
        username = user_data.get("username")
        password = user_data.get("password")

        if not username or not password:
            return False, "Username and password are required"

        if len(password) < 8:
            return False, "Password must be at least 8 characters long"

        if User.query.filter_by(username=username).first():
            return False, "Username already exists"

        return True, None

    def _check_creation_permissions(
        self, current_user: User, user_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Check if current user can create users with specified roles"""
        rbac_role_ids = user_data.get("rbac_role_ids", [])

        if not rbac_role_ids:
            return False, "At least one RBAC role must be selected"

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.create"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.create"
        )

        if not (has_employee_permission or has_client_permission):
            return False, "Insufficient permissions to create users"

        return True, None

    def _check_update_permissions(
        self, current_user: User, target_user: User
    ) -> Tuple[bool, Optional[str]]:
        """Check if current user can update target user"""
        from ...utils.rbac_utils import RBACManager

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.update"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.update"
        )

        if not (has_employee_permission or has_client_permission):
            return False, "Insufficient permissions to update users"

        if not RBACManager.is_owner(current_user):
            if current_user.project_id != target_user.project_id:
                return False, "Cannot update users from different project"

        return True, None

    def _check_deletion_permissions(
        self, current_user: User, target_user: User
    ) -> Tuple[bool, Optional[str]]:
        """Check if current user can delete target user"""
        from ...utils.rbac_utils import RBACManager

        if RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user):
            return False, "Cannot delete admin or owner users"

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.delete"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.delete"
        )

        if not (has_employee_permission or has_client_permission):
            return False, "Insufficient permissions to delete users"

        if not RBACManager.is_owner(current_user):
            if current_user.project_id != target_user.project_id:
                return False, "Cannot delete users from different project"

        return True, None

    def _check_and_reserve_balance(
        self, current_user: User, amount: int
    ) -> Tuple[bool, Optional[str]]:
        """Check and reserve balance for user creation"""
        if current_user.token_balance < amount:
            return (
                False,
                f"Insufficient balance. Required: {amount}, Available: {current_user.token_balance}",
            )
        return True, None

    def _release_reserved_balance(self, current_user: User, amount: int) -> None:
        """Release reserved balance (no-op for now, balance is only deducted on success)"""
        pass

    def _update_user_roles(
        self, target_user: User, rbac_role_ids: List[int]
    ) -> Tuple[bool, Optional[str]]:
        """Update user RBAC roles"""
        try:

            from ...models.rbac import UserRole

            UserRole.query.filter_by(user_id=target_user.id).delete()

            for role_id in rbac_role_ids:
                user_role = UserRole(user_id=target_user.id, role_id=role_id)
                db.session.add(user_role)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating user roles: {str(e)}")
            return False, "Failed to update user roles"

    def _update_user_product_permissions(
        self, target_user: User, product_ids: List[int]
    ) -> Tuple[bool, Optional[str]]:
        """Update user product permissions"""
        try:
            from ...models.core import UserProductPermission

            UserProductPermission.query.filter_by(user_id=target_user.id).delete()

            for product_id in product_ids:
                permission = UserProductPermission(user_id=target_user.id, product_id=product_id)
                db.session.add(permission)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating user product permissions: {str(e)}")
            return False, "Failed to update user product permissions"

user_orchestrator = UserOrchestrator()
