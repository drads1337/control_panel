"""
User Management Service Facade
Provides backward compatibility by delegating to specialized services.

This facade maintains the original UserManagementService interface while delegating
to the new specialized services. This allows gradual migration without
breaking existing code.

⚠️ MIGRATION NOTE:
This facade is a temporary solution for backward compatibility during refactoring.
For new code, use specialized services directly:
- UserCRUDService for CRUD operations
- UserRoleService for role management
- UserPermissionService for permission management
- UserStatisticsService for statistics
- UserInviteService for invitations

See: backend/docs/FACADE_PATTERN_MIGRATION.md for migration strategy.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ...models.core import User
from .user_crud_service import user_crud_service
from .user_invite_service import user_invite_service
from .user_permission_service import user_permission_service
from .user_role_service import user_role_service
from .user_statistics_service import user_statistics_service


class UserManagementServiceFacade:
    """
    Facade for UserManagementService that delegates to specialized services.
    
    ⚠️ DEPRECATED: This facade is for backward compatibility only.
    Use specialized services directly in new code.
    
    This maintains backward compatibility with the original UserManagementService
    interface while using the new refactored services internally.
    
    Migration path:
    1. Old code: user_management_service.create_user(...)
    2. New code: user_crud_service.create_user(...)
    
    See: backend/docs/FACADE_PATTERN_MIGRATION.md
    """

    def __init__(self, logger=None):
        # Delegate to specialized services
        self.crud_service = user_crud_service
        self.role_service = user_role_service
        self.permission_service = user_permission_service
        self.statistics_service = user_statistics_service
        self.invite_service = user_invite_service

        # Keep logger for compatibility
        import logging
        self.logger = logger or logging.getLogger(__name__)

    # CRUD operations - delegate to UserCRUDService
    def create_user(
        self,
        username: str,
        email: Optional[str],
        password: str,
        project_id: Optional[int] = None,
        role: str = "user",
    ) -> Tuple[Optional[User], Optional[str]]:
        """Create a new user"""
        return self.crud_service.create_user(username, email, password, project_id, role)

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.crud_service.get_user_by_id(user_id)

    def get_users_with_key_counts(
        self,
        current_user: User,
        page: int = 1,
        per_page: int = 20,
        role_filter: Optional[str] = None,
        roles_filter: Optional[List[str]] = None,
        search: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get users with optimized key counts"""
        return self.crud_service.get_users_with_key_counts(
            current_user, page, per_page, role_filter, roles_filter, search, project_id
        )

    def update_user_expiry(self, user_id: int, expiry_date: datetime) -> Tuple[bool, Optional[str]]:
        """Update user expiry date"""
        return self.crud_service.update_user_expiry(user_id, expiry_date)

    def delete_user_safely(
        self, current_user: User, target_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """Safely delete a user with all related data"""
        return self.crud_service.delete_user_safely(current_user, target_user_id)

    def bulk_delete_users(
        self, current_user: User, user_ids: List[int], project_id: Optional[int] = None
    ) -> Tuple[int, Optional[str]]:
        """Bulk delete users"""
        return self.crud_service.bulk_delete_users(current_user, user_ids, project_id)

    # Role operations - delegate to UserRoleService
    def bulk_change_role(
        self, current_user: User, user_ids: List[int], new_role: str, project_id: Optional[int] = None
    ) -> Tuple[int, Optional[str]]:
        """Bulk change user roles"""
        return self.role_service.bulk_change_role(current_user, user_ids, new_role, project_id)

    # Invite operations - delegate to UserInviteService
    def invite_user(
        self, current_user: User, email: str, role: str, message: str = ""
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Create an invitation for a new user"""
        return self.invite_service.invite_user(current_user, email, role, message)

    # Statistics operations - delegate to UserStatisticsService
    def get_users_stats(
        self, current_user: User, project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get user statistics"""
        return self.statistics_service.get_users_stats(current_user, project_id)

    def get_user_stats(
        self, current_user: User, user_id: int, project_id: Optional[int] = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get statistics for a specific user"""
        return self.statistics_service.get_user_stats(current_user, user_id, project_id)

    def get_user_activities(
        self, current_user: User, user_id: int, page: int = 1, per_page: int = 20
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get activities for a specific user"""
        return self.statistics_service.get_user_activities(current_user, user_id, page, per_page)

    def get_user_transactions(
        self, current_user: User, user_id: int, page: int = 1, per_page: int = 50
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get transaction history for a specific user"""
        return self.statistics_service.get_user_transactions(current_user, user_id, page, per_page)

    # Complex operations that combine multiple services
    def create_user_with_roles_and_products(
        self, current_user: User, data: Dict[str, Any]
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Create user with RBAC roles and product permissions
        This method combines CRUD, Role, and Permission services
        """
        try:
            from ...core.extensions import db
            from ...models.keys import TokenTransaction
            from ...services.rbac import rbac_service
            from werkzeug.security import generate_password_hash

            username = data.get("username")
            password = data.get("password")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            email = data.get("email")
            token_balance = data.get("token_balance", 0)
            product_ids = data.get("product_ids", [])
            rbac_role_ids = data.get("rbac_role_ids", [])

            if not username or not password:
                return None, "Username and password are required"

            if User.query.filter_by(username=username).first():
                return None, "Username already exists"

            if not rbac_role_ids:
                return None, "At least one RBAC role must be selected"

            has_moderator_permission = rbac_service.check_permission(
                current_user.id, "employees.create"
            ) or rbac_service.check_permission(current_user.id, "clients.create")
            if has_moderator_permission and token_balance > 0:
                if current_user.token_balance < token_balance:
                    return (
                        None,
                        f"Insufficient balance. Required: {token_balance}, Available: {current_user.token_balance}",
                    )

            project_id = data.get("project_id")
            can_manage_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_manage_all:
                project_id = current_user.project_id
            else:
                from flask import g

                project_id = getattr(g, "project_id", project_id)

            # Validate roles
            if rbac_role_ids and project_id:
                from ...models.rbac import Role

                for role_id in rbac_role_ids:
                    role = Role.query.filter_by(id=role_id).first()
                    if not role:
                        return None, f"Role with id {role_id} does not exist"
                    if role.project_id != project_id:
                        return (
                            None,
                            f"Role '{role.name}' belongs to a different project (role project_id: {role.project_id}, target project_id: {project_id})",
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
                from datetime import timedelta

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
                processed_product_ids = self.permission_service.process_product_ids_from_data(product_ids)
                if processed_product_ids:
                    self.permission_service.assign_product_permissions(
                        user.id, project_id, processed_product_ids
                    )

            # Assign roles
            if rbac_role_ids and project_id:
                self.role_service.assign_roles_to_user(user.id, project_id, rbac_role_ids)

            # Update project counters
            if project_id:
                from ...utils.project_counters import increment_project_user_counters
                is_active = user.expires_at is None or user.expires_at > datetime.utcnow()
                increment_project_user_counters(project_id, is_active=is_active)

            db.session.commit()

            return user, None

        except Exception as e:
            from ...core.extensions import db
            db.session.rollback()
            self.logger.error(f"Error creating user with roles and products: {str(e)}")
            return None, f"Failed to create user: {str(e)}"


# Create singleton instance for backward compatibility
user_management_service = UserManagementServiceFacade()

