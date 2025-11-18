"""
User Management Service
Handles user CRUD operations, role assignments, and user listing
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func as sql_func

from ...core.extensions import db
from ...models.core import (
    DeveloperGamePermission,
    Project,
    User,
    UserActivity,
    UserGamePermission,
)
from ...models.games import Game
from ...models.keys import Key, ReferralCode, TokenTransaction
from ...models.project_user import ProjectUserRole
from ...models.rbac import Role, UserRole
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager
from werkzeug.security import generate_password_hash

class UserManagementService:
    """Service for handling user management operations"""

    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger(__name__)

    def create_user(
        self,
        username: str,
        email: Optional[str],
        password: str,
        project_id: Optional[int] = None,
        role: str = "user",
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Create a new user

        Args:
            username: Username
            email: Email address
            password: Plain text password
            project_id: Optional project ID
            role: User role

        Returns:
            Tuple of (User object or None, error message or None)
        """
        try:

            if not username or not password:
                return None, "Username and password are required"

            if len(password) < 8:
                return None, "Password must be at least 8 characters long"

            if User.query.filter_by(username=username).first():
                return None, "Username already exists"

            if email and User.query.filter_by(email=email.lower()).first():
                return None, "Email already exists"

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
                self._assign_user_role(user.id, project_id, role)

            db.session.commit()

            return user, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating user: {str(e)}")
            return None, "Failed to create user"

    def _assign_user_role(self, user_id: int, project_id: int, role_name: str) -> None:
        """Assign role to user in project"""
        try:
            role = Role.query.filter_by(name=role_name, project_id=project_id).first()
            if role:
                user_role = UserRole(user_id=user_id, role_id=role.id)
                db.session.add(user_role)
        except Exception as e:
            self.logger.error(f"Error assigning role: {str(e)}")

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
            self.logger.error(f"Error updating user expiry: {str(e)}")
            return False, "Failed to update user expiry"

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
            Dictionary with users data and pagination info
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
                    return {"error": "Admin must be assigned to a project"}, 403
            else:
                if current_user.project_id:
                    query = query.filter_by(project_id=current_user.project_id)
                else:
                    return {"error": "User must be assigned to a project"}, 403

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
                        "id": user.id,
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
            return {"error": "Failed to get users"}, 500

    def create_user_with_roles_and_games(
        self, current_user: User, data: Dict[str, Any]
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Create user with RBAC roles and game permissions

        Args:
            current_user: User creating the new user
            data: User creation data

        Returns:
            Tuple of (User object or None, error message or None)
        """
        try:
            username = data.get("username")
            password = data.get("password")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            email = data.get("email")
            token_balance = data.get("token_balance", 0)
            game_ids = data.get("game_ids", [])
            rbac_role_ids = data.get("rbac_role_ids", [])

            self.logger.info(
                f"CREATE_USER_DEBUG: Received game_ids={game_ids}, type={type(game_ids)}"
            )
            self.logger.info(f"CREATE_USER_DEBUG: Received rbac_role_ids={rbac_role_ids}")

            if not username or not password:
                return None, "Username and password are required"

            if User.query.filter_by(username=username).first():
                return None, "Username already exists"

            if not rbac_role_ids:
                return None, "At least one RBAC role must be selected"

            from ...services.rbac import rbac_service

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

            if rbac_role_ids and project_id:
                for role_id in rbac_role_ids:
                    role = Role.query.filter_by(id=role_id).first()
                    if not role:
                        return None, f"Role with id {role_id} does not exist"
                    if role.project_id != project_id:
                        return (
                            None,
                            f"Role '{role.name}' belongs to a different project (role project_id: {role.project_id}, target project_id: {project_id})",
                        )

            user = User(
                username=username,
                password=generate_password_hash(password),
                role="user",
                first_name=first_name,
                last_name=last_name,
                email=email,
                project_id=project_id,
                is_admin=False,
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

            db.session.add(user)
            db.session.flush()

            has_moderator_permission = rbac_service.check_permission(
                current_user.id, "employees.create"
            ) or rbac_service.check_permission(current_user.id, "clients.create")
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

            if project_id:

                processed_game_ids = []
                if game_ids:

                    if isinstance(game_ids, str):

                        try:
                            import json

                            game_ids = json.loads(game_ids)
                        except:
                            game_ids = []
                    elif isinstance(game_ids, (list, tuple)):
                        game_ids = list(game_ids)
                    else:
                        self.logger.warning(
                            f"Unexpected game_ids type: {type(game_ids)}, value: {game_ids}"
                        )
                        game_ids = []

                    processed_game_ids = []
                    for gid in game_ids:
                        try:
                            gid_int = int(gid)
                            if gid_int > 0:
                                processed_game_ids.append(gid_int)
                        except (ValueError, TypeError):
                            self.logger.warning(f"Invalid game_id: {gid}, skipping")
                            continue

                self.logger.info(
                    f"Creating user {user.id} with game_ids: {processed_game_ids} (raw: {game_ids})"
                )

                all_project_games = Game.query.filter_by(project_id=project_id).all()
                all_game_ids = {game.id for game in all_project_games}
                selected_game_ids = set(processed_game_ids) if processed_game_ids else set()

                self.logger.info(
                    f"Project has {len(all_game_ids)} games, selected: {len(selected_game_ids)}"
                )

                existing_permissions = UserGamePermission.query.filter_by(user_id=user.id).all()
                existing_game_ids = {perm.game_id for perm in existing_permissions}

                if existing_game_ids:
                    self.logger.warning(
                        f"User {user.id} already has permissions for games: {existing_game_ids}"
                    )

                    for perm in existing_permissions:
                        db.session.delete(perm)
                    db.session.flush()

                for game_id in selected_game_ids:
                    if game_id in all_game_ids:
                        try:

                            permission = UserGamePermission.query.filter_by(
                                user_id=user.id, game_id=game_id
                            ).first()

                            if permission:

                                permission.has_access = True
                                permission.can_generate_keys = True
                                permission.max_keys_per_day = 100
                                permission.project_id = project_id
                                self.logger.info(
                                    f"Updated permission for user {user.id}, game {game_id} to has_access=True"
                                )
                            else:

                                permission = UserGamePermission(
                                    user_id=user.id,
                                    game_id=game_id,
                                    can_generate_keys=True,
                                    max_keys_per_day=100,
                                    has_access=True,
                                    project_id=project_id,
                                )
                                db.session.add(permission)
                                self.logger.info(
                                    f"Created permission for user {user.id}, game {game_id} with has_access=True"
                                )
                        except Exception as e:
                            self.logger.error(f"Error creating permission for game {game_id}: {e}")
                else:

                    self.logger.info(
                        f"No games selected for user {user.id}, no permissions will be created"
                    )

            if rbac_role_ids and project_id:
                assigned_role_ids = set()
                for role_id in rbac_role_ids:

                    if role_id in assigned_role_ids:
                        continue

                    role = Role.query.get(role_id)
                    user_role = UserRole(
                        user_id=user.id, role_id=role_id, assigned_at=datetime.utcnow()
                    )
                    db.session.add(user_role)
                    assigned_role_ids.add(role_id)
                    role_name = role.name if role else f"unknown_role_id_{role_id}"
                    self.logger.info(
                        f"RBAC_ROLE_ASSIGNED user_id={user.id} username={user.username} role_id={role_id} role_name={role_name} project_id={project_id} during user creation"
                    )
            else:
                self.logger.warning(
                    f"RBAC_ROLES_NOT_ASSIGNED user_id={user.id} username={user.username} rbac_role_ids={rbac_role_ids} project_id={project_id} - missing required data"
                )

            if project_id:
                from ...utils.project_counters import increment_project_user_counters
                is_active = user.expires_at is None or user.expires_at > datetime.utcnow()
                increment_project_user_counters(project_id, is_active=is_active)

            db.session.commit()

            return user, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating user with roles and games: {str(e)}")
            return None, f"Failed to create user: {str(e)}"

    def delete_user_safely(
        self, current_user: User, target_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Safely delete a user with all related data

        Args:
            current_user: User performing the deletion
            target_user_id: ID of user to delete

        Returns:
            Tuple of (success, error_message)
        """
        try:
            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found"

            from ...services.rbac import rbac_service

            can_delete_all = rbac_service.check_permission(
                current_user.id, "employees.delete"
            ) or rbac_service.check_permission(current_user.id, "clients.delete")
            if not can_delete_all:
                if current_user.project_id != target_user.project_id:
                    return False, "Access denied"

                if RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user):
                    return False, "Cannot delete owner or admin users"
            else:
                from flask import g

                if getattr(g, "project_id", None) != target_user.project_id:
                    return False, "Access denied"

                if RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user):
                    return False, "Cannot delete owner or admin users"

            if current_user.id == target_user.id:
                return False, "Cannot delete yourself"

            target_user.total_keys = 0
            target_user.active_keys = 0
            Key.query.filter_by(user_id=target_user_id).delete()
            UserGamePermission.query.filter_by(user_id=target_user_id).delete()
            DeveloperGamePermission.query.filter_by(user_id=target_user_id).delete()
            UserActivity.query.filter_by(user_id=target_user_id).delete()

            UserRole.query.filter_by(user_id=target_user_id).delete()

            ProjectUserRole.query.filter_by(user_id=target_user_id).delete()

            project_id = target_user.project_id
            if project_id:
                from ...utils.project_counters import decrement_project_user_counters
                was_active = target_user.expires_at is None or target_user.expires_at > datetime.utcnow()
                decrement_project_user_counters(project_id, was_active=was_active)

            db.session.delete(target_user)
            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting user: {str(e)}")
            return False, f"Failed to delete user: {str(e)}"

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
            from ...utils.role_constants import RolePermissions
            from ...services.rbac import rbac_service

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
                UserGamePermission.query.filter_by(user_id=user.id).delete()
                DeveloperGamePermission.query.filter_by(user_id=user.id).delete()
                UserActivity.query.filter_by(user_id=user.id).delete()

                UserRole.query.filter_by(user_id=user.id).delete()

                ProjectUserRole.query.filter_by(user_id=user.id).delete()

                if user.project_id:
                    from ...utils.project_counters import decrement_project_user_counters
                    was_active = user.expires_at is None or user.expires_at > datetime.utcnow()
                    decrement_project_user_counters(user.project_id, was_active=was_active)

                db.session.delete(user)
                deleted_count += 1

            db.session.commit()
            return deleted_count, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error bulk deleting users: {str(e)}")
            return 0, f"Failed to delete users: {str(e)}"

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
            from ...services.rbac import rbac_service

            if new_role not in RolePermissions.ASSIGNABLE_ROLES:
                return 0, f'Invalid role. Allowed: {", ".join(RolePermissions.ASSIGNABLE_ROLES)}'

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

            db.session.commit()
            return len(users), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error bulk changing roles: {str(e)}")
            return 0, f"Failed to change roles: {str(e)}"

    def invite_user(
        self, current_user: User, email: str, role: str, message: str = ""
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Create an invitation for a new user

        Args:
            current_user: User creating the invitation
            email: Email address
            role: Role for the new user
            message: Optional invitation message

        Returns:
            Tuple of (invite_data dict or None, error_message)
        """
        try:
            from datetime import timedelta
            import secrets
            import string
            from ...utils.role_constants import RolePermissions
            from ...services.rbac import rbac_service

            if not email:
                return None, "Email is required"

            allowed_roles = RolePermissions.ASSIGNABLE_ROLES.copy()
            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:

                allowed_roles = [r for r in allowed_roles if r not in RolePermissions.ADMIN_ROLES]

            if role not in allowed_roles:
                return None, f'Invalid role. Allowed: {", ".join(allowed_roles)}'

            def generate_invite_code():
                return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

            invite_code = generate_invite_code()

            ref = ReferralCode(
                code=invite_code,
                role=role,
                project_id=current_user.project_id,
                expires_at=datetime.utcnow() + timedelta(days=7),
            )

            db.session.add(ref)
            db.session.commit()

            return {
                "invite_code": invite_code,
                "expires_at": ref.expires_at.isoformat(),
            }, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error inviting user: {str(e)}")
            return None, f"Failed to invite user: {str(e)}"

    def get_users_stats(
        self, current_user: User, project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get user statistics

        Args:
            current_user: User requesting stats
            project_id: Optional project ID for scoping

        Returns:
            Dictionary with user statistics
        """
        try:
            from sqlalchemy import func, select
            from ...services.rbac import rbac_service
            from ...utils.role_constants import RolePermissions

            query = User.query

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                query = query.filter_by(project_id=current_user.project_id)
            elif project_id:
                query = query.filter_by(project_id=project_id)

            total_users = query.count()

            active_users = query.filter(
                (User.expires_at.is_(None)) | (User.expires_at > datetime.utcnow())
            ).count()

            today = datetime.utcnow().date()
            new_users_today = query.filter(func.date(User.created_at) == today).count()

            premium_users = query.filter(
                User.id.in_(
                    select(UserRole.user_id).join(Role).where(Role.name.in_(RolePermissions.ADMIN_ROLES))
                )
            ).count()

            return {
                "total_users": total_users,
                "active_users": active_users,
                "new_users_today": new_users_today,
                "premium_users": premium_users,
            }

        except Exception as e:
            self.logger.error(f"Error getting users stats: {str(e)}")
            return {
                "total_users": 0,
                "active_users": 0,
                "new_users_today": 0,
                "premium_users": 0,
            }

    def get_user_stats(
        self, current_user: User, user_id: int, project_id: Optional[int] = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get statistics for a specific user

        Args:
            current_user: User requesting stats
            user_id: Target user ID
            project_id: Optional project ID for scoping

        Returns:
            Tuple of (stats dict or None, error_message)
        """
        try:
            from datetime import timedelta
            from sqlalchemy import and_, case, func
            from ...services.rbac import rbac_service

            target_user = User.query.get(user_id)
            if not target_user:
                return None, "User not found"

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")

            if not can_view_all:
                if current_user.project_id != target_user.project_id:
                    return None, "Access denied"
            else:
                if project_id and target_user.project_id != project_id:
                    return None, "Access denied"

            if not project_id:
                project_id = target_user.project_id

            key_stats = (
                db.session.query(
                    func.count(Key.id).label("total_keys"),
                    func.sum(case((Key.status == 1, 1), else_=0)).label("active_keys"),
                )
                .filter(and_(Key.user_id == user_id, Key.project_id == project_id))
                .first()
            )

            total_keys = key_stats.total_keys if key_stats else 0
            active_keys = key_stats.active_keys if key_stats else 0
            expired_keys = Key.query.filter(
                and_(
                    Key.user_id == user_id,
                    Key.project_id == project_id,
                    Key.expires_at <= datetime.utcnow(),
                )
            ).count()

            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            keys_30d = Key.query.filter(
                and_(
                    Key.user_id == user_id, Key.project_id == project_id, Key.created_at >= thirty_days_ago
                )
            ).count()

            activity_count = UserActivity.query.filter(
                and_(UserActivity.user_id == user_id, UserActivity.project_id == project_id)
            ).count()
            recent_activity = UserActivity.query.filter(
                and_(
                    UserActivity.user_id == user_id,
                    UserActivity.project_id == project_id,
                    UserActivity.created_at >= thirty_days_ago,
                )
            ).count()

            game_permissions = UserGamePermission.query.filter_by(user_id=user_id).count()
            developer_permissions = DeveloperGamePermission.query.filter_by(user_id=user_id).count()

            user_roles = RBACManager.get_user_role_names(target_user)
            primary_role = user_roles[0] if user_roles else "client"

            return {
                "user": {
                    "id": target_user.id,
                    "username": target_user.username,
                    "role": primary_role,
                    "created_at": target_user.created_at.isoformat(),
                    "last_login": (
                        target_user.last_login.isoformat() if target_user.last_login else None
                    ),
                },
                "keys": {
                    "total": total_keys,
                    "active": active_keys,
                    "expired": expired_keys,
                    "last_30_days": keys_30d,
                },
                "activity": {"total": activity_count, "last_30_days": recent_activity},
                "permissions": {"games": game_permissions, "developer_games": developer_permissions},
                "balance": {"tokens": target_user.token_balance},
            }, None

        except Exception as e:
            self.logger.error(f"Error getting user stats: {str(e)}")
            return None, f"Failed to get user stats: {str(e)}"

    def get_user_activities(
        self, current_user: User, user_id: int, page: int = 1, per_page: int = 20
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get activities for a specific user

        Args:
            current_user: User requesting activities
            user_id: Target user ID
            page: Page number
            per_page: Items per page

        Returns:
            Tuple of (activities dict or None, error_message)
        """
        try:
            from ...services.rbac import rbac_service

            target_user = User.query.get(user_id)
            if not target_user:
                return None, "User not found"

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                if current_user.project_id != target_user.project_id:
                    return None, "Access denied"

            query = UserActivity.query.filter_by(user_id=user_id)

            pagination = query.order_by(UserActivity.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            activities = []
            for activity in pagination.items:
                activities.append(
                    {
                        "id": activity.id,
                        "action": activity.action,
                        "ip_address": activity.ip_address,
                        "country": activity.country,
                        "city": activity.city,
                        "created_at": activity.created_at.isoformat(),
                        "details": activity.details,
                        "user_agent": activity.user_agent,
                    }
                )

            return {
                "activities": activities,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }, None

        except Exception as e:
            self.logger.error(f"Error getting user activities: {str(e)}")
            return None, f"Failed to get user activities: {str(e)}"

    def get_user_transactions(
        self, current_user: User, user_id: int, page: int = 1, per_page: int = 50
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get transaction history for a specific user

        Args:
            current_user: User requesting transactions
            user_id: Target user ID
            page: Page number
            per_page: Items per page

        Returns:
            Tuple of (transactions dict or None, error_message)
        """
        try:
            from ...services.rbac import rbac_service

            target_user = User.query.get(user_id)
            if not target_user:
                return None, "User not found"

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                if current_user.project_id != target_user.project_id:
                    return None, "Access denied"

            if per_page > 1000:
                per_page = 1000

            query = TokenTransaction.query.filter_by(user_id=user_id).order_by(
                TokenTransaction.created_at.desc()
            )

            pagination = query.paginate(page=page, per_page=per_page, error_out=False)

            transaction_list = []
            for transaction in pagination.items:
                transaction_list.append(
                    {
                        "id": transaction.id,
                        "amount": transaction.amount,
                        "type": transaction.type if hasattr(transaction, "type") else "credit",
                        "description": (
                            transaction.description
                            if hasattr(transaction, "description")
                            else "Balance transaction"
                        ),
                        "created_at": (
                            transaction.created_at.isoformat() if transaction.created_at else None
                        ),
                    }
                )

            return {
                "transactions": transaction_list,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }, None

        except Exception as e:
            self.logger.error(f"Error getting user transactions: {str(e)}")
            return {
                "transactions": [],
                "total": 0,
                "pages": 0,
                "current_page": page,
                "per_page": per_page,
            }, None

user_management_service = UserManagementService()
