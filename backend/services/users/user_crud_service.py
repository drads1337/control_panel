"""
User CRUD Service
Handles basic CRUD operations for users: create, read, update, delete
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from sqlalchemy import func as sql_func

from ...core.extensions import db
from ...models.core import (
    DeveloperProductPermission,
    User,
    UserActivity,
    UserProductPermission,
)
from ...models.keys import Key, TokenTransaction
from ...models.notifications import Notification
from ...models.rbac import Role, UserRole, UserPermission
from ...models.project_user import ProjectUserRole
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager
from ...utils.service_exceptions import ValidationError, ConflictError, ServiceError, PermissionDeniedError
from ...utils.structured_logging import get_logger
from werkzeug.security import generate_password_hash


from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.rbac.rbac_service import RBACService
    from ...services.cache.cache_service import CacheService

class UserCRUDService:
    """Service for handling basic CRUD operations on users"""

    def __init__(
        self,
        rbac_service: 'RBACService',
        cache_service: 'CacheService',
        logger=None
    ):
        """
        Initialize UserCRUDService with explicit dependencies.
        
        Args:
            rbac_service: Service for RBAC checks
            cache_service: Service for cache operations
            logger: Optional logger instance
        """
        self.logger = logger or get_logger("user_crud_service")
        

        self._rbac_service = rbac_service
        self._cache_service = cache_service
    
    def create_user(
        self,
        username: str,
        email: Optional[str],
        password: str,
        project_id: Optional[int] = None,
        role: str = "user",
    ) -> User:
        """
        Create a new user

        Args:
            username: Username
            email: Email address
            password: Plain text password
            project_id: Optional project ID
            role: User role

        Returns:
            User object

        Raises:
            ValidationError: If validation fails
            ConflictError: If username or email already exists
            ServiceError: If database operation fails
        """
        try:
            if not username or not password:
                raise ValidationError("Username and password are required", field="username")

            if len(password) < 8:
                raise ValidationError("Password must be at least 8 characters long", field="password")

            if User.query.filter_by(username=username).first():
                raise ConflictError("Username already exists", resource_type="user")

            if email and User.query.filter_by(email=email.lower()).first():
                raise ConflictError("Email already exists", resource_type="user")

            user = User(
                username=username,
                email=email.lower() if email else None,
                password=generate_password_hash(password),
                project_id=project_id,
                created_at=datetime.utcnow(),
            )

            db.session.add(user)
            db.session.flush()

            if project_id:
                role_obj = Role.query.filter_by(name=role, project_id=project_id).first()
                if role_obj:
                    user_role = UserRole(user_id=user.id, role_id=role_obj.id)
                    db.session.add(user_role)

            db.session.commit()

            return user

        except (ValidationError, ConflictError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating user: {str(e)}", exc_info=True)
            raise ServiceError("Failed to create user", status_code=500) from e

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """
        Get user by ID

        Args:
            user_id: User ID

        Returns:
            User object or None if not found
        """
        try:
            return User.query.get(user_id)
        except Exception as e:
            self.logger.error(f"Error getting user by ID {user_id}: {str(e)}")
            return None

    def get_users_with_key_counts(
        self,
        current_user: User,
        page: int = 1,
        per_page: int = 20,
        role_filter: Optional[str] = None,
        roles_filter: Optional[List[str]] = None,
        search: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> Union[Dict[str, Any], Tuple[Dict[str, Any], int]]:
        """
        Get users with optimized key counts (fixes N+1 problem)

        Args:
            current_user: Current user making the request
            page: Page number for pagination
            per_page: Items per page
            role_filter: Single role filter
            roles_filter: Multiple roles filter
            search: Search term
            project_id: Project ID for scoping

        Returns:
            Dictionary with users data and pagination info, or (error_dict, status_code) on error
            
        Note: For backward compatibility, returns Dict. Consider using UserListResponse
        from schemas.responses.service_responses for type safety in new code.
        """
        try:
            query = User.query

            if RBACManager.is_owner(current_user):
                if project_id:
                    query = query.filter_by(project_id=project_id)
            elif RBACManager.is_admin(current_user):
                if current_user.project_id:
                    query = query.filter_by(project_id=current_user.project_id)
                else:
                    raise ValidationError(
                        "Admin must be assigned to a project",
                        field="project_id"
                    )
            else:
                if current_user.project_id:
                    query = query.filter_by(project_id=current_user.project_id)
                else:
                    raise ValidationError(
                        "User must be assigned to a project",
                        field="project_id"
                    )

            if search:
                query = fulltext_search_filter(query, search, "search_vector")

            if role_filter or roles_filter:

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

            pagination = query.order_by(User.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            key_counts_dict = {}
            for user in pagination.items:
                key_counts_dict[user.id] = {
                    "total": user.total_keys or 0,
                    "active": user.active_keys or 0
                }

            rbac_roles_dict = {}
            user_ids = [user.id for user in pagination.items]
            if user_ids:
                try:
                    from sqlalchemy.orm import joinedload

                    user_roles_query = (
                        db.session.query(UserRole)
                        .filter(UserRole.user_id.in_(user_ids))
                        .options(joinedload(UserRole.role))
                        .all()
                    )

                    self.logger.info(f"RBAC_ROLES_DEBUG: Loaded {len(user_roles_query)} user roles for {len(user_ids)} users")

                    for ur in user_roles_query:
                        if ur.user_id not in rbac_roles_dict:
                            rbac_roles_dict[ur.user_id] = []

                        role_data = {
                            "id": ur.role.id,
                            "name": ur.role.name,
                            "description": ur.role.description,
                            "permissions": [],
                            "is_system_role": ur.role.is_system_role,
                            "assigned_at": ur.assigned_at.isoformat() if ur.assigned_at else None,
                        }
                        rbac_roles_dict[ur.user_id].append(role_data)
                        self.logger.debug(f"RBAC_ROLES_DEBUG: User {ur.user_id} has role {ur.role.name}")

                    self.logger.info(f"RBAC_ROLES_DEBUG: Final rbac_roles_dict has {len(rbac_roles_dict)} users with roles")
                    for user_id, roles in rbac_roles_dict.items():
                        self.logger.info(f"RBAC_ROLES_DEBUG: User {user_id} roles: {[r['name'] for r in roles]}")
                except Exception as e:
                    self.logger.error(f"Failed to get RBAC roles in batch: {e}", exc_info=True)

            users = []
            for user in pagination.items:
                user_key_data = key_counts_dict.get(user.id, {"total": 0, "active": 0})

                rbac_roles = rbac_roles_dict.get(user.id, [])
                role_names = [role["name"] for role in rbac_roles] if rbac_roles else []

                if not rbac_roles and user.id in user_ids:
                    self.logger.warning(
                        f"RBAC_ROLES_EMPTY user_id={user.id} username={user.username} - no roles found in database. "
                        f"Check if UserRole records exist for this user."
                    )

                users.append(
                    {
                        "id": user.unique_id,
                        "username": user.username,
                        "roles": role_names,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "email": user.email if hasattr(user, "email") else None,
                        "avatar": user.avatar,
                        "created_at": user.created_at.isoformat() if user.created_at else None,
                        "expires_at": user.expires_at.isoformat() if user.expires_at else None,
                        "last_login": user.last_login.isoformat() if user.last_login else None,
                        "last_ip": user.last_ip,
                        "last_country": user.last_country,
                        "last_city": user.last_city,
                        "total_keys_generated": user.total_keys_generated,
                        "token_balance": user.token_balance,
                        "project_id": user.project_id,
                        "keys_count": user_key_data["total"],
                        "active_keys": user_key_data["active"],
                        "referral_code": user.referral_code,
                        "invited_by": user.invited_by,
                        "rbac_roles": rbac_roles,
                    }
                )

            return {
                "users": users,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }

        except Exception as e:
            import traceback
            self.logger.error(f"Error getting users with key counts: {str(e)}")
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            raise ServiceError(
                "Failed to get users",
                status_code=500,
                context={"current_user_id": current_user.id if current_user else None}
            ) from e

    def update_user_expiry(self, user_id: int, expiry_date: datetime) -> Tuple[bool, Optional[str]]:
        """
        Update user expiry date

        Args:
            user_id: User ID
            expiry_date: New expiry date

        Returns:
            Tuple of (success, error_message)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return False, "User not found"

            user.expires_at = expiry_date
            user.updated_at = datetime.utcnow()
            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating user expiry: {str(e)}", exc_info=True)
            raise ServiceError(
                "Failed to update user expiry",
                status_code=500,
                context={"user_id": user_id}
            ) from e

    def delete_user_safely(
        self, current_user: User, target_user_id: int, project_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Safely delete a user with all related data

        Args:
            current_user: User performing the deletion
            target_user_id: ID of user to delete
            project_id: Optional project ID for scoping (passed by middleware)

        Returns:
            Tuple of (success, error_message)
        """
        try:

            if not self._rbac_service:
                raise ServiceError(
                    "RBACService dependency not injected",
                    status_code=500
                )
            rbac_service = self._rbac_service

            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found"

            # Check if user has delete permissions
            has_employee_delete = rbac_service.check_permission(
                current_user.id, "employees.delete"
            )
            has_client_delete = rbac_service.check_permission(
                current_user.id, "clients.delete"
            )
            
            if not (has_employee_delete or has_client_delete):
                return False, "Access denied: insufficient permissions to delete users"

            # Determine if target user is an employee or client
            # Check if user has employee role
            employee_role = Role.query.filter_by(name="employee", project_id=target_user.project_id).first()
            is_employee = False
            if employee_role:
                user_role = UserRole.query.filter_by(
                    user_id=target_user_id,
                    role_id=employee_role.id
                ).first()
                is_employee = user_role is not None

            # Check permissions based on user type
            if is_employee and not has_employee_delete:
                return False, "Access denied: insufficient permissions to delete employees"
            
            if not is_employee and not has_client_delete:
                return False, "Access denied: insufficient permissions to delete clients"

            # Check project scope
            scoped_project_id = project_id or current_user.project_id
            if scoped_project_id and scoped_project_id != target_user.project_id:
                return False, "Access denied"

            # Prevent deletion of admin or owner users
            if RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user):
                return False, "Cannot delete owner or admin users"

            if current_user.id == target_user.id:
                return False, "Cannot delete yourself"

            target_user.total_keys = 0
            target_user.active_keys = 0
            Key.query.filter_by(user_id=target_user_id).delete()
            UserProductPermission.query.filter_by(user_id=target_user_id).delete()
            DeveloperProductPermission.query.filter_by(user_id=target_user_id).delete()
            UserActivity.query.filter_by(user_id=target_user_id).delete()
            TokenTransaction.query.filter_by(user_id=target_user_id).delete()
            Notification.query.filter_by(user_id=target_user_id).delete()

            UserRole.query.filter_by(user_id=target_user_id).delete()
            UserPermission.query.filter_by(user_id=target_user_id).delete()

            ProjectUserRole.query.filter_by(user_id=target_user_id).delete()

            project_id = target_user.project_id
            if project_id:

                if not self._cache_service:
                    raise ServiceError(
                        "CacheService dependency not injected",
                        status_code=500
                    )
                cache_service = self._cache_service
                cache_service.invalidate_pattern(f"stats:project_id={project_id}:*")

            db.session.delete(target_user)
            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting user: {str(e)}", exc_info=True)
            raise ServiceError(
                f"Failed to delete user: {str(e)}",
                status_code=500,
                context={"target_user_id": target_user_id, "project_id": project_id}
            ) from e

    def bulk_delete_users(
        self, current_user: User, user_ids: List[int], project_id: Optional[int] = None
    ) -> Tuple[int, Optional[str]]:
        """
        Bulk delete users

        Args:
            current_user: User performing the deletion
            user_ids: List of user IDs to delete
            project_id: Optional project ID for scoping

        Returns:
            Tuple of (deleted_count, error_message)
        """
        try:

            if not self._rbac_service:
                raise ServiceError(
                    "RBACService dependency not injected",
                    status_code=500
                )
            rbac_service = self._rbac_service

            query = User.query.filter(User.id.in_(user_ids))

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                query = query.filter_by(project_id=current_user.project_id)
            else:
                if project_id:
                    query = query.filter_by(project_id=project_id)

            users = query.all()

            deleted_count = 0
            for user in users:
                if RBACManager.is_admin(user) or RBACManager.is_owner(user):
                    continue

                user.total_keys = 0
                user.active_keys = 0
                Key.query.filter_by(user_id=user.id).delete()
                UserProductPermission.query.filter_by(user_id=user.id).delete()
                DeveloperProductPermission.query.filter_by(user_id=user.id).delete()
                UserActivity.query.filter_by(user_id=user.id).delete()

                UserRole.query.filter_by(user_id=user.id).delete()
                UserPermission.query.filter_by(user_id=user.id).delete()

                ProjectUserRole.query.filter_by(user_id=user.id).delete()

                if user.project_id:

                    if not self._cache_service:
                        raise ServiceError(
                            "CacheService dependency not injected",
                            status_code=500
                        )
                    cache_service = self._cache_service
                    cache_service.invalidate_pattern(f"stats:project_id={user.project_id}:*")

                db.session.delete(user)
                deleted_count += 1

            db.session.commit()
            return deleted_count, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error bulk deleting users: {str(e)}", exc_info=True)
            raise ServiceError(
                f"Failed to delete users: {str(e)}",
                status_code=500,
                context={"user_ids": user_ids, "project_id": project_id}
            ) from e




