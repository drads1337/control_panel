"""
User Role Service
Handles user role assignments and role-based filtering
"""

from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import func as sql_func

from ...core.extensions import db
from ...models.core import User
from ...models.rbac import Role, UserRole
from ...utils.rbac_utils import RBACManager
from ...utils.structured_logging import get_logger

class UserRoleService:
    """Service for handling user role operations"""

    def __init__(self):
        self.logger = get_logger("user_role_service")

    def assign_user_role(self, user_id: int, project_id: int, role_name: str) -> None:
        """
        Assign role to user in project

        Args:
            user_id: User ID
            project_id: Project ID
            role_name: Role name
        """
        try:
            role = Role.query.filter_by(name=role_name, project_id=project_id).first()
            if role:
                user_role = UserRole(user_id=user_id, role_id=role.id)
                db.session.add(user_role)
        except Exception as e:
            self.logger.error(f"Error assigning role: {str(e)}")

    def assign_roles_to_user(
        self, user_id: int, project_id: int, role_ids: List[int]
    ) -> bool:
        """
        Assign multiple roles to user

        Args:
            user_id: User ID
            project_id: Project ID
            role_ids: List of role IDs

        Returns:
            True if successful, False otherwise
        """
        try:
            assigned_role_ids = set()
            for role_id in role_ids:
                if role_id in assigned_role_ids:
                    continue

                role = Role.query.get(role_id)
                if not role:
                    self.logger.warning(f"Role with id {role_id} does not exist")
                    continue

                if role.project_id != project_id:
                    self.logger.warning(
                        f"Role '{role.name}' belongs to a different project (role project_id: {role.project_id}, target project_id: {project_id})"
                    )
                    continue

                user_role = UserRole(
                    user_id=user_id, role_id=role_id, assigned_at=datetime.utcnow()
                )
                db.session.add(user_role)
                assigned_role_ids.add(role_id)
                role_name = role.name if role else f"unknown_role_id_{role_id}"
                self.logger.info(
                    f"RBAC_ROLE_ASSIGNED user_id={user_id} role_id={role_id} role_name={role_name} project_id={project_id}"
                )

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error assigning roles to user: {str(e)}")
            return False

    def remove_user_role(self, user_id: int, role_id: int) -> bool:
        """
        Remove role from user

        Args:
            user_id: User ID
            role_id: Role ID

        Returns:
            True if successful, False otherwise
        """
        try:
            user_role = UserRole.query.filter_by(user_id=user_id, role_id=role_id).first()
            if user_role:
                db.session.delete(user_role)
                db.session.commit()
                return True
            return False
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error removing role from user: {str(e)}")
            return False

    def get_user_roles(self, user_id: int) -> List[Role]:
        """
        Get all roles for a user

        Args:
            user_id: User ID

        Returns:
            List of Role objects
        """
        try:
            user_roles = UserRole.query.filter_by(user_id=user_id).all()
            return [ur.role for ur in user_roles if ur.role]
        except Exception as e:
            self.logger.error(f"Error getting user roles: {str(e)}")
            return []

    def filter_users_by_roles(
        self,
        query,
        role_filter: Optional[str],
        roles_filter: Optional[List[str]],
        current_user: User,
        project_id: Optional[int] = None,
    ):
        """
        Filter users query by roles

        Args:
            query: SQLAlchemy query
            role_filter: Single role filter
            roles_filter: Multiple roles filter
            current_user: Current user making the request
            project_id: Optional project ID

        Returns:
            Filtered query
        """
        roles_to_filter = []
        if role_filter:
            roles_to_filter.append(role_filter)
        if roles_filter:
            roles_to_filter.extend(roles_filter)

        roles_to_filter = list(set(roles_to_filter))

        self.logger.info(f"Filtering users by roles: {roles_to_filter}")

        if roles_to_filter:
            project_id_for_roles = None
            if RBACManager.is_owner(current_user):
                project_id_for_roles = project_id
            elif RBACManager.is_admin(current_user) or current_user.project_id:
                project_id_for_roles = current_user.project_id

            self.logger.info(f"Filtering users by roles in project: {project_id_for_roles}")

            roles_to_filter_lower = [r.lower() for r in roles_to_filter]

            if project_id_for_roles:
                role_subquery = (
                    db.session.query(UserRole.user_id)
                    .join(Role, UserRole.role_id == Role.id)
                    .filter(
                        sql_func.lower(Role.name).in_(roles_to_filter_lower),
                        Role.project_id == project_id_for_roles,
                    )
                    .distinct()
                )
            else:
                role_subquery = (
                    db.session.query(UserRole.user_id)
                    .join(Role, UserRole.role_id == Role.id)
                    .filter(sql_func.lower(Role.name).in_(roles_to_filter_lower))
                    .distinct()
                )

            query = query.filter(User.id.in_(role_subquery))

            self.logger.info(
                f"Applied RBAC role filter, query will return users matching roles: {roles_to_filter}"
            )

        return query

    def bulk_change_role(
        self, current_user: User, user_ids: List[int], new_role: str, project_id: Optional[int] = None
    ) -> Tuple[int, Optional[str]]:
        """
        Bulk change user roles

        Args:
            current_user: User performing the change
            user_ids: List of user IDs
            new_role: New role name
            project_id: Optional project ID for scoping

        Returns:
            Tuple of (affected_count, error_message)
        """
        try:
            from ...utils.role_constants import RolePermissions
            from ...utils.service_helpers import get_service
            
            # Use ServiceContainer to avoid circular imports
            rbac_service = get_service('rbac_service')

            if new_role not in RolePermissions.ASSIGNABLE_ROLES:
                return 0, f'Invalid role. Allowed: {", ".join(RolePermissions.ASSIGNABLE_ROLES)}'

            query = User.query.filter(User.id.in_(user_ids))

            rbac_service = get_service('rbac_service')
            rbac_service = get_service('rbac_service')
            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                query = query.filter_by(project_id=current_user.project_id)
            else:
                if project_id:
                    query = query.filter_by(project_id=project_id)

            users = query.all()

            # Remove old roles and assign new role
            for user in users:
                # Remove all existing roles
                UserRole.query.filter_by(user_id=user.id).delete()

                # Assign new role
                target_project_id = project_id or user.project_id
                if target_project_id:
                    self.assign_user_role(user.id, target_project_id, new_role)

            db.session.commit()
            return len(users), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error bulk changing roles: {str(e)}")
            return 0, f"Failed to change roles: {str(e)}"

