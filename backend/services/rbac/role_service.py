"""
Role Service
Manages roles for RBAC system
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

from ...core.extensions import db
from ...models.core import User
from ...models.rbac import Permission, Role, RolePermission, UserRole
from ...services.cache import cache_service
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles


class RoleService:
    """Service for managing roles"""

    def __init__(self, permission_service=None, default_roles: Dict = None, get_all_permissions_func=None):
        """Initialize RoleService with permission service and defaults"""
        self.permission_service = permission_service
        self.default_roles = default_roles or {}
        self.get_all_permissions_func = get_all_permissions_func
        self.logger = logging.getLogger(__name__)

    def create_role(
        self,
        project_id: int,
        name: str,
        description: str,
        permissions: List[str],
        is_system_role: bool = False,
        parent_role_id: int = None,
    ) -> Dict:
        """Create a new custom role"""
        try:
            # Prevent creation of owner role through RBAC management
            if name.lower() == "owner":
                raise ValueError("Owner role cannot be created through RBAC management")

            # Check if role already exists
            existing = Role.query.filter_by(name=name, project_id=project_id).first()

            if existing:
                raise ValueError(f"Role '{name}' already exists")

            # Validate parent role if specified
            hierarchy_level = 0
            if parent_role_id:
                parent_role = Role.query.filter_by(id=parent_role_id, project_id=project_id).first()
                if not parent_role:
                    raise ValueError("Parent role not found")

                # Check for circular inheritance
                if self._would_create_circular_inheritance(parent_role_id, None):
                    raise ValueError("Cannot create circular inheritance")

                hierarchy_level = parent_role.hierarchy_level + 1

            # Validate permissions
            if self.get_all_permissions_func:
                valid_permissions = self.get_all_permissions_func()
            else:
                valid_permissions = []
                
            for permission in permissions:
                if permission not in valid_permissions:
                    raise ValueError(f"Invalid permission: {permission}")

            # Create role
            role = Role(
                name=name,
                description=description,
                project_id=project_id,
                is_system_role=is_system_role,
                parent_role_id=parent_role_id,
                hierarchy_level=hierarchy_level,
                created_at=datetime.utcnow(),
            )

            db.session.add(role)
            db.session.flush()  # Get the ID

            # Get permission objects
            permission_objects = Permission.query.filter(
                Permission.name.in_(permissions), Permission.project_id == project_id
            ).all()

            # Assign permissions to role
            for permission in permission_objects:
                role_permission = RolePermission(
                    role_id=role.id, permission_id=permission.id, created_at=datetime.utcnow()
                )
                db.session.add(role_permission)

            db.session.commit()

            # Invalidate cache for roles list
            cache_service.delete("rbac:roles", project_id=project_id)

            logging.info(
                f"RBAC_ROLE_CREATED role_id={role.id} project_id={project_id} name={name} parent_role_id={parent_role_id}"
            )

            return {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permissions": permissions,
                "is_system_role": role.is_system_role,
                "parent_role_id": role.parent_role_id,
                "hierarchy_level": role.hierarchy_level,
                "created_at": role.created_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_ROLE_CREATION_ERROR project_id={project_id} name={name} error={e}")
            raise ValueError(f"Failed to create role: {str(e)}")

    def update_role(self, role_id: int, project_id: int, **kwargs) -> Dict:
        """Update an existing role"""
        try:
            role = Role.query.filter_by(id=role_id, project_id=project_id).first()
            if not role:
                raise ValueError("Role not found")

            # Log warning for system role updates
            if role.is_system_role:
                logging.warning(
                    f"RBAC_SYSTEM_ROLE_UPDATE role_id={role_id} name={role.name} - System role is being modified"
                )

                # Additional safety check for critical roles
                if role.name in ["owner", "admin"] and "permissions" in kwargs:
                    # Ensure critical roles maintain essential permissions
                    critical_permissions = [
                        "employees.view",
                        "employees.create",
                        "employees.edit",
                        "rbac.view",
                        "rbac.create_role",
                    ]
                    provided_permissions = set(kwargs["permissions"])

                    missing_critical = set(critical_permissions) - provided_permissions
                    if missing_critical:
                        logging.error(
                            f"RBAC_CRITICAL_ROLE_SAFETY_CHECK role={role.name} missing_critical_permissions={list(missing_critical)}"
                        )
                        # Don't block, but log the warning

            # Update fields
            if "name" in kwargs:
                # Check if name already exists
                existing = Role.query.filter(
                    Role.name == kwargs["name"],
                    Role.project_id == role.project_id,
                    Role.id != role_id,
                ).first()

                if existing:
                    raise ValueError(f"Role '{kwargs['name']}' already exists")

                role.name = kwargs["name"]

            if "description" in kwargs:
                role.description = kwargs["description"]

            if "permissions" in kwargs:
                # Validate permissions
                if self.get_all_permissions_func:
                    valid_permissions = self.get_all_permissions_func()
                else:
                    valid_permissions = []
                    
                for permission in kwargs["permissions"]:
                    if permission not in valid_permissions:
                        raise ValueError(f"Invalid permission: {permission}")

                # Remove existing permissions
                RolePermission.query.filter_by(role_id=role_id).delete()

                # Add new permissions
                permission_objects = Permission.query.filter(
                    Permission.name.in_(kwargs["permissions"]),
                    Permission.project_id == role.project_id,
                ).all()

                for permission in permission_objects:
                    role_permission = RolePermission(
                        role_id=role_id, permission_id=permission.id, created_at=datetime.utcnow()
                    )
                    db.session.add(role_permission)

            role.updated_at = datetime.utcnow()
            db.session.commit()

            # Invalidate cache for roles list
            cache_service.delete("rbac:roles", project_id=project_id)

            # Invalidate cache for all users with this role (granular invalidation)
            self._invalidate_users_with_role_cache(role_id)

            logging.info(f"RBAC_ROLE_UPDATED role_id={role_id}")

            return {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permissions": [rp.permission.name for rp in role.permissions],
                "is_system_role": role.is_system_role,
                "updated_at": role.updated_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_ROLE_UPDATE_ERROR role_id={role_id} error={e}")
            raise ValueError(f"Failed to update role: {str(e)}")

    def delete_role(
        self, role_id: int, project_id: int, force: bool = False, reassign_to_role_id: int = None
    ) -> bool:
        """Delete a role"""
        try:
            role = Role.query.filter_by(id=role_id, project_id=project_id).first()
            if not role:
                return False

            # Check if it's a system role
            if role.is_system_role:
                raise ValueError("Cannot delete system roles")

            # Handle child roles - set their parent_role_id to NULL before deletion
            child_roles = Role.query.filter_by(parent_role_id=role_id).all()
            for child_role in child_roles:
                child_role.parent_role_id = None
                db.session.add(child_role)

            # Get user IDs before deletion for cache invalidation
            user_ids_to_invalidate = set()
            user_role_objs = UserRole.query.filter_by(role_id=role_id).all()
            user_ids_to_invalidate = {ur.user_id for ur in user_role_objs}

            # Check if role is assigned to users
            user_roles = len(user_role_objs)
            if user_roles > 0:
                if not force:
                    raise ValueError(
                        f"Cannot delete role: {user_roles} users are assigned to this role. Use force=True to delete with reassignment."
                    )

                # Force delete with reassignment
                if reassign_to_role_id:
                    # Verify target role exists and belongs to same project
                    target_role = Role.query.filter_by(
                        id=reassign_to_role_id, project_id=project_id
                    ).first()
                    if not target_role:
                        raise ValueError(f"Target role {reassign_to_role_id} not found")

                    # Reassign users to target role
                    for user_role in user_role_objs:
                        # Check if user already has target role
                        existing = UserRole.query.filter_by(
                            user_id=user_role.user_id, role_id=reassign_to_role_id
                        ).first()

                        if not existing:
                            # Add target role to user
                            new_user_role = UserRole(
                                user_id=user_role.user_id,
                                role_id=reassign_to_role_id,
                                assigned_at=datetime.utcnow(),
                            )
                            db.session.add(new_user_role)

                        # Remove old role
                        db.session.delete(user_role)

                    logging.info(
                        f"RBAC_ROLE_REASSIGNED role_id={role_id} target_role_id={reassign_to_role_id} users_count={user_roles}"
                    )
                else:
                    # Force delete without reassignment (remove role from users)
                    # Use individual deletes to properly handle relationships
                    for user_role_obj in user_role_objs:
                        db.session.delete(user_role_obj)
                    logging.warning(
                        f"RBAC_ROLE_FORCE_DELETED role_id={role_id} users_lost_role={user_roles}"
                    )

            # Delete role permissions - use individual deletes to properly handle relationships
            role_permissions = RolePermission.query.filter_by(role_id=role_id).all()
            for role_permission in role_permissions:
                db.session.delete(role_permission)

            # Delete role
            db.session.delete(role)
            db.session.commit()

            # Invalidate cache for roles list
            cache_service.delete("rbac:roles", project_id=project_id)

            # Invalidate cache for all users who had this role (granular invalidation)
            for user_id in user_ids_to_invalidate:
                cache_service.delete("rbac", user_id=user_id, cache_type="user_roles")
                cache_service.delete("rbac:user_permissions", user_id=user_id)

            logging.info(f"RBAC_ROLE_DELETED role_id={role_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_ROLE_DELETION_ERROR role_id={role_id} error={e}")
            raise ValueError(f"Failed to delete role: {str(e)}")

    def get_roles(self, project_id: int) -> List[Dict]:
        """Get all roles for a project (excluding system roles from RBAC management)"""
        try:
            # Try to get from cache first
            cached_data = cache_service.get("rbac:roles", project_id=project_id)
            if cached_data:
                return cached_data.get("data", [])

            # Cache miss - fetch from database
            roles = Role.query.filter_by(project_id=project_id).order_by(Role.name).all()

            result = [
                {
                    "id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "permissions": [rp.permission.name for rp in role.permissions],
                    "is_system_role": role.is_system_role,
                    "user_count": role.users.count(),
                    "created_at": role.created_at.isoformat(),
                    "updated_at": role.updated_at.isoformat() if role.updated_at else None,
                }
                for role in roles
                if role.name not in ["owner", "admin"]  # Exclude system roles from RBAC management
            ]

            # Cache the result
            cache_service.set("rbac:roles", result, project_id=project_id)

            return result

        except Exception as e:
            logging.error(f"RBAC_ROLES_GET_ERROR project_id={project_id} error={e}")
            return []

    def get_role_by_id(self, role_id: int) -> Optional[Dict]:
        """Get role information by ID"""
        try:
            role = Role.query.get(role_id)
            if not role:
                return None

            return {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "is_system_role": role.is_system_role,
            }

        except Exception as e:
            logging.error(f"RBAC_ROLE_GET_ERROR role_id={role_id} error={e}")
            return None

    def assign_role_to_user(self, user_id: int, role_id: int) -> bool:
        """Assign a role to a user"""
        try:
            # Check if user exists
            user = User.query.get(user_id)
            if not user:
                raise ValueError("User not found")

            # SECURITY FIX: Ensure user has project_id
            if not user.project_id:
                raise ValueError("User must be assigned to a project")

            # Check if role exists - first check without project_id filter for better error message
            role = Role.query.filter_by(id=role_id).first()
            if not role:
                raise ValueError(f"Role with id {role_id} does not exist")

            # Check if role belongs to the same project
            if role.project_id != user.project_id:
                logging.error(
                    f"RBAC_ROLE_ASSIGNMENT_ERROR: Role {role_id} (project_id={role.project_id}) does not match user {user_id} project_id={user.project_id}"
                )
                raise ValueError(
                    f"Role '{role.name}' belongs to a different project. Role project_id: {role.project_id}, User project_id: {user.project_id}"
                )

            # Prevent assignment of system roles through RBAC management
            if role.name.lower() in ["owner", "admin"]:
                raise ValueError(
                    f"{role.name.title()} role cannot be assigned through RBAC management"
                )

            # Check if user already has this role
            existing = UserRole.query.filter_by(user_id=user_id, role_id=role_id).first()
            if existing:
                logging.info(f"RBAC_ROLE_ALREADY_ASSIGNED user_id={user_id} role_id={role_id}")
                return True  # Already assigned

            # Assign role
            user_role = UserRole(user_id=user_id, role_id=role_id, assigned_at=datetime.utcnow())

            db.session.add(user_role)
            db.session.commit()

            # Invalidate cache for this user (granular invalidation)
            cache_service.delete("rbac:user_roles", user_id=user_id)
            cache_service.delete("rbac:user_permissions", user_id=user_id)

            logging.info(
                f"RBAC_ROLE_ASSIGNED user_id={user_id} role_id={role_id} role_name={role.name}"
            )
            return True

        except ValueError:
            # Re-raise ValueError as-is (already has error message)
            raise
        except Exception as e:
            db.session.rollback()
            logging.error(
                f"RBAC_ROLE_ASSIGNMENT_ERROR user_id={user_id} role_id={role_id} error={e}"
            )
            raise ValueError(f"Failed to assign role: {str(e)}")

    def remove_role_from_user(self, user_id: int, role_id: int) -> bool:
        """Remove a role from a user"""
        try:
            user_role = UserRole.query.filter_by(user_id=user_id, role_id=role_id).first()
            if not user_role:
                return False

            db.session.delete(user_role)
            db.session.commit()

            # Invalidate cache for this user (granular invalidation)
            cache_service.delete("rbac:user_roles", user_id=user_id)
            cache_service.delete("rbac:user_permissions", user_id=user_id)

            logging.info(f"RBAC_ROLE_REMOVED user_id={user_id} role_id={role_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_ROLE_REMOVAL_ERROR user_id={user_id} role_id={role_id} error={e}")
            return False

    def get_user_roles(self, user_id: int) -> List[Dict]:
        """Get all roles assigned to a user"""
        try:
            # Try to get from cache first
            cached_data = cache_service.get("rbac:user_roles", user_id=user_id)
            if cached_data:
                return cached_data.get("data", [])

            # Cache miss - fetch from database
            user_roles = UserRole.query.filter_by(user_id=user_id).all()

            result = [
                {
                    "id": ur.role.id,
                    "name": ur.role.name,
                    "description": ur.role.description,
                    "permissions": [rp.permission.name for rp in ur.role.permissions],
                    "is_system_role": ur.role.is_system_role,
                    "assigned_at": ur.assigned_at.isoformat(),
                }
                for ur in user_roles
            ]

            # Cache the result
            cache_service.set("rbac:user_roles", result, user_id=user_id)

            return result

        except Exception as e:
            logging.error(f"RBAC_USER_ROLES_GET_ERROR user_id={user_id} error={e}")
            return []

    def get_role_users(self, role_id: int) -> List[Dict]:
        """Get all users assigned to a role"""
        try:
            user_roles = UserRole.query.filter_by(role_id=role_id).all()

            return [
                {
                    "id": ur.user.id,
                    "username": ur.user.username,
                    "email": ur.user.email,
                    "role": (
                        RBACManager.get_user_role_names(ur.user)[0]
                        if RBACManager.get_user_role_names(ur.user)
                        else UserRoles.CLIENT.value
                    ),  # Legacy role
                    "assigned_at": ur.assigned_at.isoformat(),
                }
                for ur in user_roles
            ]

        except Exception as e:
            logging.error(f"RBAC_ROLE_USERS_GET_ERROR role_id={role_id} error={e}")
            return []

    def get_role_hierarchy(self, project_id: int) -> Dict:
        """Get the complete role hierarchy for a project"""
        try:
            roles = (
                Role.query.filter_by(project_id=project_id)
                .order_by(Role.hierarchy_level, Role.name)
                .all()
            )

            # Build hierarchy tree
            role_dict = {}
            root_roles = []

            for role in roles:
                role_dict[role.id] = {
                    "id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "hierarchy_level": role.hierarchy_level,
                    "parent_role_id": role.parent_role_id,
                    "is_system_role": role.is_system_role,
                    "children": [],
                }

            # Build parent-child relationships
            for role in roles:
                if role.parent_role_id:
                    if role.parent_role_id in role_dict:
                        role_dict[role.parent_role_id]["children"].append(role_dict[role.id])
                else:
                    root_roles.append(role_dict[role.id])

            return {"hierarchy": root_roles, "flat_list": [role_dict[role.id] for role in roles]}

        except Exception as e:
            logging.error(f"RBAC_ROLE_HIERARCHY_ERROR project_id={project_id} error={e}")
            return {"hierarchy": [], "flat_list": []}

    def get_role_inheritance_chain(self, role_id: int) -> List[Dict]:
        """Get the inheritance chain for a specific role"""
        try:
            role = Role.query.get(role_id)
            if not role:
                return []

            chain = role.get_inheritance_chain()
            return [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "hierarchy_level": r.hierarchy_level,
                }
                for r in chain
            ]

        except Exception as e:
            logging.error(f"RBAC_ROLE_INHERITANCE_CHAIN_ERROR role_id={role_id} error={e}")
            return []

    def _create_roles(self, project_id: int, permissions: List[Permission]) -> List[Role]:
        """Create default roles for a project"""
        roles = []

        # Create permission lookup
        permission_lookup = {p.name: p for p in permissions}
        
        # For owner role, use all permissions if permissions list is empty
        default_roles_copy = dict(self.default_roles)
        if default_roles_copy.get("owner", {}).get("permissions") == []:
            default_roles_copy["owner"]["permissions"] = list(permission_lookup.keys())

        for role_name, role_data in default_roles_copy.items():
            # Check if role already exists
            existing = Role.query.filter_by(name=role_name, project_id=project_id).first()

            if not existing:
                role = Role(
                    name=role_name,
                    description=role_data["description"],
                    project_id=project_id,
                    is_system_role=True,  # Default roles are system roles
                    created_at=datetime.utcnow(),
                )

                db.session.add(role)
                db.session.flush()  # Get the ID

                # Assign permissions to role
                for permission_name in role_data["permissions"]:
                    if permission_name in permission_lookup:
                        role_permission = RolePermission(
                            role_id=role.id,
                            permission_id=permission_lookup[permission_name].id,
                            permission_type="allow",  # Explicitly set to allow
                            created_at=datetime.utcnow(),
                        )
                        db.session.add(role_permission)

                roles.append(role)

        db.session.commit()
        return roles

    def _would_create_circular_inheritance(
        self, parent_role_id: int, child_role_id: int = None
    ) -> bool:
        """Check if setting parent_role_id would create circular inheritance"""
        if not parent_role_id:
            return False

        # If we're updating an existing role, check if parent is a descendant
        if child_role_id:
            current_role = Role.query.get(parent_role_id)
            while current_role:
                if current_role.id == child_role_id:
                    return True
                current_role = current_role.parent_role

        return False

    def _invalidate_users_with_role_cache(self, role_id: int) -> None:
        """Invalidate cache for all users with a specific role (granular invalidation)"""
        try:
            user_roles = UserRole.query.filter_by(role_id=role_id).all()
            for user_role in user_roles:
                cache_service.delete("rbac", user_id=user_role.user_id, cache_type="user_roles")
                cache_service.delete("rbac", user_id=user_role.user_id, cache_type="user_permissions")
            logging.debug(f"Invalidated cache for {len(user_roles)} users with role_id={role_id}")
        except Exception as e:
            logging.error(f"Error invalidating users cache for role_id={role_id}: {e}")


# Global instance - will be initialized with dependencies from RBACService
role_service = RoleService()

