"""
User Orchestrator
Coordinates complex user management operations using specialized services
Single Responsibility: Orchestration of complex user operations
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from ...core.extensions import db
from ...utils.service_helpers import get_service
from ...utils.service_exceptions import ValidationError, NotFoundError, PermissionDeniedError, BusinessLogicError
from ...models.core import User

logger = logging.getLogger(__name__)


class UserOrchestrator:
    """
    Orchestrates complex user management operations
    Coordinates specialized services to handle complete user lifecycle operations
    """

    def __init__(self):
        """Initialize orchestrator with all required services"""
        self.user_crud_service = get_service('user_crud_service')
        self.user_role_service = get_service('user_role_service')
        self.user_permission_service = get_service('user_permission_service')
        self.user_profile_service = get_service('user_profile_service')
        self.rbac_service = get_service('rbac_service')
        self.activity_service = get_service('activity_service')

    def create_user_with_full_setup(
        self,
        current_user: User,
        user_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Create a new user with complete setup: roles, products, permissions, and initial balance
        Orchestrates the complete user creation process

        Args:
            current_user: User creating the new user
            user_data: Complete user data including roles, products, permissions
            ip_address: IP address for activity logging

        Returns:
            Created User object

        Raises:
            ValidationError: If input validation fails
            PermissionDeniedError: If user doesn't have permission
            BusinessLogicError: For business rule violations
        """
        try:
            # Validate (raises ValidationError if invalid)
            self._validate_user_creation_data(user_data)
            
            # Check permissions (raises PermissionDeniedError if not allowed)
            self._check_creation_permissions(current_user, user_data)

            token_balance = user_data.get("token_balance", 0)
            if token_balance > 0:
                # Check balance (raises BusinessLogicError if insufficient)
                self._check_and_reserve_balance(current_user, token_balance)

            try:
                user = self._create_user_with_roles_and_products(current_user, user_data)
            except (ValidationError, NotFoundError, PermissionDeniedError, BusinessLogicError):
                if token_balance > 0:
                    self._release_reserved_balance(current_user, token_balance)
                raise
            except Exception as e:
                if token_balance > 0:
                    self._release_reserved_balance(current_user, token_balance)
                logger.error(f"Error creating user: {str(e)}", exc_info=True)
                raise BusinessLogicError(f"Failed to create user: {str(e)}")

            try:
                activity_service = get_service('activity_service')
                activity_service = get_service('activity_service')
                self.activity_service.log_activity(
                    current_user,
                    "create_user",
                    details=f"Created user: {user.username} (ID: {user.id})",
                    ip=ip_address,
                )
            except Exception as e:
                logger.warning(f"Failed to log user creation activity: {e}")

            logger.info(f"Successfully created user {user.username} (ID: {user.id})")
            return user

        except (ValidationError, PermissionDeniedError, BusinessLogicError, NotFoundError):
            raise
        except Exception as e:
            logger.error(f"Error in create_user_with_full_setup: {str(e)}", exc_info=True)
            token_balance = user_data.get("token_balance", 0)
            if token_balance > 0:
                try:
                    self._release_reserved_balance(current_user, token_balance)
                except Exception:
                    pass
            raise BusinessLogicError(f"Failed to create user: {str(e)}")

    def update_user_with_full_setup(
        self,
        current_user: User,
        target_user: User,
        user_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Update user with complete setup: profile, roles, products, permissions
        Orchestrates the complete user update process

        Args:
            current_user: User performing the update
            target_user: User being updated
            user_data: Update data including roles, products, permissions
            ip_address: IP address for activity logging

        Raises:
            PermissionDeniedError: If user doesn't have permission
            BusinessLogicError: For business rule violations
        """
        # Check permissions (raises PermissionDeniedError if not allowed)
        self._check_update_permissions(current_user, target_user)

        user_profile_service = get_service('user_profile_service')
        user_profile_service = get_service('user_profile_service')
        # Update profile (user_profile_service still returns tuple, will be migrated later)
        user_profile_service = get_service('user_profile_service')
        success, error = self.user_profile_service.update_user_profile(target_user, user_data)
        if not success:
            raise BusinessLogicError(error or "Failed to update user profile")

        # Update roles (raises BusinessLogicError on failure)
        if "rbac_role_ids" in user_data:
            self._update_user_roles(target_user, user_data["rbac_role_ids"])

        # Update product permissions (raises BusinessLogicError on failure)
        if "product_ids" in user_data:
            self._update_user_product_permissions(target_user, user_data["product_ids"])

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

    def delete_user_with_cleanup(
        self,
        current_user: User,
        target_user_id: int,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Delete user with complete cleanup: roles, products, keys, activities
        Orchestrates the complete user deletion process

        Args:
            current_user: User performing the deletion
            target_user_id: ID of user to delete
            ip_address: IP address for activity logging

        Raises:
            NotFoundError: If user not found
            PermissionDeniedError: If user doesn't have permission
            BusinessLogicError: For business rule violations
        """
        target_user = User.query.get(target_user_id)
        if not target_user:
            raise NotFoundError("User", str(target_user_id))

        # Check permissions (raises PermissionDeniedError if not allowed)
        self._check_deletion_permissions(current_user, target_user)

        # Delete user (user_crud_service still returns tuple, will be migrated later)
        success, error = self.user_crud_service.delete_user_safely(current_user, target_user_id)
        if not success:
            raise BusinessLogicError(error or "Failed to delete user")

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

    def _validate_user_creation_data(self, user_data: Dict[str, Any]) -> None:
        """Validate user creation data. Raises ValidationError if invalid."""
        username = user_data.get("username")
        password = user_data.get("password")

        if not username or not password:
            raise ValidationError("Username and password are required")

        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long", field="password")

        if User.query.filter_by(username=username).first():
            raise ValidationError("Username already exists", field="username")

    def _check_creation_permissions(
        self, current_user: User, user_data: Dict[str, Any]
    ) -> None:
        """Check if current user can create users with specified roles. Raises exception if not."""
        rbac_role_ids = user_data.get("rbac_role_ids", [])

        if not rbac_role_ids:
            rbac_service = get_service('rbac_service')
            rbac_service = get_service('rbac_service')
            raise ValidationError("At least one RBAC role must be selected", field="rbac_role_ids")

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.create"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.create"
        )

        if not (has_employee_permission or has_client_permission):
            raise PermissionDeniedError("Insufficient permissions to create users", action="create_user")

    def _check_update_permissions(
        self, current_user: User, target_user: User
    ) -> None:
        """Check if current user can update target user. Raises exception if not."""
        from ...utils.rbac_utils import RBACManager

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.update"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.update"
        )

        if not (has_employee_permission or has_client_permission):
            raise PermissionDeniedError("Insufficient permissions to update users", action="update_user")

        if not RBACManager.is_owner(current_user):
            if current_user.project_id != target_user.project_id:
                raise PermissionDeniedError("Cannot update users from different project", action="update_user")

    def _check_deletion_permissions(
        self, current_user: User, target_user: User
    ) -> None:
        """Check if current user can delete target user. Raises exception if not."""
        from ...utils.rbac_utils import RBACManager

        if RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user):
            raise BusinessLogicError("Cannot delete admin or owner users")

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.delete"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.delete"
        )

        if not (has_employee_permission or has_client_permission):
            raise PermissionDeniedError("Insufficient permissions to delete users", action="delete_user")

        if not RBACManager.is_owner(current_user):
            if current_user.project_id != target_user.project_id:
                raise PermissionDeniedError("Cannot delete users from different project", action="delete_user")

    def _check_and_reserve_balance(
        self, current_user: User, amount: int
    ) -> None:
        """Check and reserve balance for user creation. Raises BusinessLogicError if insufficient."""
        if current_user.token_balance < amount:
            raise BusinessLogicError(
                f"Insufficient balance. Required: {amount}, Available: {current_user.token_balance}"
            )

    def _release_reserved_balance(self, current_user: User, amount: int) -> None:
        """Release reserved balance (no-op for now, balance is only deducted on success)"""
        pass

    def _update_user_roles(
        self, target_user: User, rbac_role_ids: List[int]
    ) -> None:
        """Update user RBAC roles. Raises BusinessLogicError on failure."""
        try:
            from ...models.rbac import UserRole

            UserRole.query.filter_by(user_id=target_user.id).delete()

            for role_id in rbac_role_ids:
                user_role = UserRole(user_id=target_user.id, role_id=role_id)
                db.session.add(user_role)

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating user roles: {str(e)}")
            raise BusinessLogicError("Failed to update user roles")

    def _update_user_product_permissions(
        self, target_user: User, product_ids: List[int]
    ) -> None:
        """Update user product permissions. Raises BusinessLogicError on failure."""
        try:
            from ...models.core import UserProductPermission

            UserProductPermission.query.filter_by(user_id=target_user.id).delete()

            for product_id in product_ids:
                permission = UserProductPermission(user_id=target_user.id, product_id=product_id)
                db.session.add(permission)

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating user product permissions: {str(e)}")
            raise BusinessLogicError("Failed to update user product permissions")

    def _create_user_with_roles_and_products(
        self, current_user: User, data: Dict[str, Any]
    ) -> User:
        """
        Create user with RBAC roles and product permissions
        This method combines CRUD, Role, and Permission services

        Raises:
            ValidationError: If input validation fails
            BusinessLogicError: For business rule violations
        """
        try:
            from datetime import datetime, timedelta
            from werkzeug.security import generate_password_hash
            from ...models.keys import TokenTransaction
            from ...utils.project_counters import increment_project_user_counters

            username = data.get("username")
            password = data.get("password")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            email = data.get("email")
            token_balance = data.get("token_balance", 0)
            product_ids = data.get("product_ids", [])
            rbac_role_ids = data.get("rbac_role_ids", [])

            if not username or not password:
                raise ValidationError("Username and password are required")

            if User.query.filter_by(username=username).first():
                raise ValidationError("Username already exists", field="username")

            if not rbac_role_ids:
                raise ValidationError("At least one RBAC role must be selected", field="rbac_role_ids")

            has_moderator_permission = self.rbac_service.check_permission(
                current_user.id, "employees.create"
            ) or self.rbac_service.check_permission(current_user.id, "clients.create")
            if has_moderator_permission and token_balance > 0:
                if current_user.token_balance < token_balance:
                    raise BusinessLogicError(
                        f"Insufficient balance. Required: {token_balance}, Available: {current_user.token_balance}"
                    )

            project_id = data.get("project_id")
            can_manage_all = self.rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or self.rbac_service.check_permission(current_user.id, "clients.view")
            if not can_manage_all:
                project_id = project_id or current_user.project_id

            # Validate roles
            if rbac_role_ids and project_id:
                from ...models.rbac import Role

                for role_id in rbac_role_ids:
                    role = Role.query.filter_by(id=role_id).first()
                    if not role:
                        raise NotFoundError("Role", str(role_id))
                    if role.project_id != project_id:
                        raise BusinessLogicError(
                            f"Role '{role.name}' belongs to a different project (role project_id: {role.project_id}, target project_id: {project_id})"
                        )

            # Create user
            user = User(
                username=username,
                password=generate_password_hash(password),
                first_name=first_name,
                last_name=last_name,
                email=email,
                project_id=project_id,
                token_balance=token_balance,
                created_at=datetime.utcnow(),
            )

            if data.get("expires_at"):
                try:
                    user.expires_at = datetime.fromisoformat(
                        data["expires_at"].replace("Z", "+00:00")
                    )
                except:
                    pass
            elif data.get("work_duration_days"):
                work_duration_days = data.get("work_duration_days")
                if work_duration_days and work_duration_days > 0:
                    user.expires_at = datetime.utcnow() + timedelta(days=work_duration_days)

            db.session.add(user)
            db.session.flush()

            # Handle token transactions
            if has_moderator_permission and token_balance > 0:
                current_user.token_balance -= token_balance

                moderator_transaction = TokenTransaction(
                    user_id=current_user.id,
                    amount=token_balance,
                    type="debit",
                    description=f"User creation: {username} (RBAC roles: {len(rbac_role_ids)})",
                    project_id=current_user.project_id,
                    created_at=datetime.utcnow(),
                )
                db.session.add(moderator_transaction)

                user_transaction = TokenTransaction(
                    user_id=user.id,
                    amount=token_balance,
                    type="credit",
                    description=f"Initial balance from moderator {current_user.username}",
                    project_id=user.project_id,
                    created_at=datetime.utcnow(),
                )
                db.session.add(user_transaction)

            # Assign product permissions
            if project_id and product_ids:
                processed_product_ids = self.user_permission_service.process_product_ids_from_data(product_ids)
                if processed_product_ids:
                    self.user_permission_service.assign_product_permissions(
                        user.id, project_id, processed_product_ids
                    )

            # Assign roles
            if rbac_role_ids and project_id:
                user_role_service = get_service('user_role_service')
                user_role_service.assign_roles_to_user(user.id, project_id, rbac_role_ids)

            # Update project counters
            if project_id:
                is_active = user.expires_at is None or user.expires_at > datetime.utcnow()
                increment_project_user_counters(project_id, is_active=is_active)

            db.session.commit()

            return user

        except (ValidationError, NotFoundError, BusinessLogicError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating user with roles and products: {str(e)}")
            raise BusinessLogicError(f"Failed to create user: {str(e)}")

# NOTE: Global singleton removed for better testability.
# Use ServiceContainer to get service instances:
#   from ...utils.service_helpers import get_service
#   user_orchestrator = get_service('user_orchestrator')
