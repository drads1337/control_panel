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
from ...utils.rbac_utils import RBACManager
from ...utils.service_exceptions import ServiceError

from ...utils.role_constants import UserRoles

class RoleService:
    """Service for managing roles"""

    def __init__(self, permission_service=None, default_roles: Dict = None, get_all_permissions_func=None, project_id: Optional[int] = None, cache_service=None):
        """Initialize RoleService with permission service and defaults
        
        Args:
            permission_service: Service for permission operations
            default_roles: Default roles definition
            get_all_permissions_func: Function to get all permissions
            project_id: Optional project ID
            cache_service: Service for cache operations
        """
        self.permission_service = permission_service
        self.default_roles = default_roles or {}
        self.get_all_permissions_func = get_all_permissions_func
        self._cache_service = cache_service
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

            if name.lower() == "owner":
                raise ValueError("Owner role cannot be created through RBAC management")

            # Normalize role name (strip whitespace, lowercase for comparison)
            normalized_name = name.strip()
            if not normalized_name:
                raise ValueError("Role name cannot be empty or only whitespace")

            # Check for existing role (case-insensitive comparison with normalized name)
            from sqlalchemy import func
            existing = Role.query.filter(
                func.lower(func.trim(Role.name)) == func.lower(normalized_name),
                Role.project_id == project_id
            ).first()

            if existing:
                # Provide more helpful error message
                role_type = "system role" if existing.is_system_role else "custom role"
                user_count = existing.users.count()
                user_info = f" ({user_count} user{'s' if user_count != 1 else ''} assigned)" if user_count > 0 else ""
                raise ValueError(
                    f"A role with the name '{normalized_name}' already exists as a {role_type}{user_info}. "
                    f"Please choose a different name or edit the existing role (ID: {existing.id})."
                )
            
            # Use normalized name for the role
            name = normalized_name

            hierarchy_level = 0
            if parent_role_id:
                parent_role = Role.query.filter_by(id=parent_role_id, project_id=project_id).first()
                if not parent_role:
                    raise ValueError("Parent role not found")

                if self._would_create_circular_inheritance(parent_role_id, None):
                    raise ValueError("Cannot create circular inheritance")

                hierarchy_level = parent_role.hierarchy_level + 1

            if self.get_all_permissions_func:
                valid_permissions = self.get_all_permissions_func()
            else:
                valid_permissions = []

            for permission in permissions:
                if permission not in valid_permissions:
                    raise ValueError(f"Invalid permission: {permission}")

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
            db.session.flush()


            permission_objects = []
            for perm_name in permissions:
                perm = Permission.query.filter_by(name=perm_name, project_id=project_id).first()
                if perm:
                    permission_objects.append(perm)

            for permission in permission_objects:
                role_permission = RolePermission(
                    role_id=role.id, permission_id=permission.id, created_at=datetime.utcnow()
                )
                db.session.add(role_permission)

            db.session.commit()

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            cache_service.invalidate_rbac_role_instantly(role.id, project_id)
            cache_service.invalidate_rbac_project_instantly(project_id)

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

            if role.is_system_role:
                logging.warning(
                    f"RBAC_SYSTEM_ROLE_UPDATE role_id={role_id} name={role.name} - System role is being modified"
                )

                if role.name in ["owner", "admin"] and "permissions" in kwargs:

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

            if "name" in kwargs:
                # Normalize role name
                normalized_name = kwargs["name"].strip()
                if not normalized_name:
                    raise ValueError("Role name cannot be empty or only whitespace")
                
                # Check for existing role with same name (case-insensitive, excluding current role)
                from sqlalchemy import func
                existing = Role.query.filter(
                    func.lower(func.trim(Role.name)) == func.lower(normalized_name),
                    Role.project_id == role.project_id,
                    Role.id != role_id
                ).first()

                if existing:
                    role_type = "system role" if existing.is_system_role else "custom role"
                    user_count = existing.users.count()
                    user_info = f" ({user_count} user{'s' if user_count != 1 else ''} assigned)" if user_count > 0 else ""
                    raise ValueError(
                        f"A role with the name '{normalized_name}' already exists as a {role_type}{user_info}. "
                        f"Please choose a different name or edit the existing role (ID: {existing.id})."
                    )
                
                # Use normalized name
                kwargs["name"] = normalized_name

                role.name = kwargs["name"]

            if "description" in kwargs:
                role.description = kwargs["description"]

            if "permissions" in kwargs:

                if self.get_all_permissions_func:
                    valid_permissions = self.get_all_permissions_func()
                else:
                    valid_permissions = []

                for permission in kwargs["permissions"]:
                    if permission not in valid_permissions:
                        raise ValueError(f"Invalid permission: {permission}")

                RolePermission.query.filter_by(role_id=role_id).delete()


                permission_objects = []
                for perm_name in kwargs["permissions"]:
                    perm = Permission.query.filter_by(name=perm_name, project_id=role.project_id).first()
                    if perm:
                        permission_objects.append(perm)

                for permission in permission_objects:
                    role_permission = RolePermission(
                        role_id=role_id, permission_id=permission.id, created_at=datetime.utcnow()
                    )
                    db.session.add(role_permission)

            role.updated_at = datetime.utcnow()
            db.session.commit()

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            cache_service.invalidate_rbac_role_instantly(role.id, project_id)
            cache_service.invalidate_rbac_project_instantly(project_id)

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

            if role.is_system_role:
                raise ValueError("Cannot delete system roles")

            child_roles = Role.query.filter_by(parent_role_id=role_id).all()
            for child_role in child_roles:
                child_role.parent_role_id = None
                db.session.add(child_role)

            user_ids_to_invalidate = set()

            user_role_objs = UserRole.query.filter_by(role_id=role_id).all()
            user_ids_to_invalidate = {ur.user_id for ur in user_role_objs}

            user_roles = len(user_role_objs)
            if user_roles > 0:
                if not force:
                    raise ValueError(
                        f"Cannot delete role: {user_roles} users are assigned to this role. Use force=True to delete with reassignment."
                    )

                if reassign_to_role_id:

                    target_role = Role.query.filter_by(id=reassign_to_role_id, project_id=project_id).first()
                    if not target_role:
                        raise ValueError(f"Target role {reassign_to_role_id} not found")

                    for user_role in user_role_objs:

                        existing = UserRole.query.filter_by(
                            user_id=user_role.user_id, role_id=reassign_to_role_id
                        ).first()

                        if not existing:

                            new_user_role = UserRole(
                                user_id=user_role.user_id,
                                role_id=reassign_to_role_id,
                                assigned_at=datetime.utcnow(),
                            )
                            db.session.add(new_user_role)

                        db.session.delete(user_role)

                    logging.info(
                        f"RBAC_ROLE_REASSIGNED role_id={role_id} target_role_id={reassign_to_role_id} users_count={user_roles}"
                    )
                else:

                    for user_role_obj in user_role_objs:
                        db.session.delete(user_role_obj)
                    logging.warning(
                        f"RBAC_ROLE_FORCE_DELETED role_id={role_id} users_lost_role={user_roles}"
                    )

            role_permissions = RolePermission.query.filter_by(role_id=role_id).all()
            for role_permission in role_permissions:
                db.session.delete(role_permission)

            db.session.delete(role)
            db.session.commit()

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            cache_service.invalidate_rbac_role_instantly(role.id, project_id)
            cache_service.invalidate_rbac_project_instantly(project_id)

            for user_id in user_ids_to_invalidate:
                if not self._cache_service:
                    from ...utils.service_exceptions import ServiceError
                    raise ServiceError(
                        "CacheService dependency not injected",
                        status_code=500
                    )
                cache_service = self._cache_service
                cache_service.invalidate_rbac_user_instantly(user_id)

            logging.info(f"RBAC_ROLE_DELETED role_id={role_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_ROLE_DELETION_ERROR role_id={role_id} error={e}")
            raise ValueError(f"Failed to delete role: {str(e)}")

    def get_roles(self, project_id: int, force_refresh: bool = False) -> List[Dict]:
        """Get all roles for a project (excluding system roles from RBAC management)"""
        try:

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            
            # Skip cache if force_refresh is True
            if not force_refresh:
                cached_data = cache_service.get("rbac:roles", project_id=project_id)
                if cached_data:
                    return cached_data.get("data", [])


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
                if role.name not in ["owner", "admin"]
            ]

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
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

            user = User.query.get(user_id)
            if not user:
                raise ValueError("User not found")

            if not user.project_id:
                raise ValueError("User must be assigned to a project")



            role = Role.query.filter_by(id=role_id).first()
            if not role:
                raise ValueError(f"Role with id {role_id} does not exist")

            if role.project_id != user.project_id:
                logging.error(
                    f"RBAC_ROLE_ASSIGNMENT_ERROR: Role {role_id} (project_id={role.project_id}) does not match user {user_id} project_id={user.project_id}"
                )
                raise ValueError(
                    f"Role '{role.name}' belongs to a different project. Role project_id: {role.project_id}, User project_id: {user.project_id}"
                )

            if role.name.lower() in ["owner", "admin"]:
                raise ValueError(
                    f"{role.name.title()} role cannot be assigned through RBAC management"
                )


            existing = UserRole.query.filter_by(user_id=user_id, role_id=role_id).first()
            if existing:
                logging.info(f"RBAC_ROLE_ALREADY_ASSIGNED user_id={user_id} role_id={role_id}")
                return True

            user_role = UserRole(user_id=user_id, role_id=role_id, assigned_at=datetime.utcnow())

            db.session.add(user_role)
            db.session.commit()

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            cache_service.invalidate_rbac_user_instantly(user_id)

            logging.info(
                f"RBAC_ROLE_ASSIGNED user_id={user_id} role_id={role_id} role_name={role.name}"
            )
            return True

        except ValueError:

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

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            cache_service.invalidate_rbac_user_instantly(user_id)

            logging.info(f"RBAC_ROLE_REMOVED user_id={user_id} role_id={role_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_ROLE_REMOVAL_ERROR user_id={user_id} role_id={role_id} error={e}")
            return False

    def get_user_roles(self, user_id: int) -> List[Dict]:
        """Get all roles assigned to a user"""
        try:

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
            cached_data = cache_service.get("rbac:user_roles", user_id=user_id)
            if cached_data:
                return cached_data.get("data", [])


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

            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service
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
                    ),
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

            roles = Role.query.filter_by(project_id=project_id).order_by(Role.hierarchy_level).all()

            roles = sorted(roles, key=lambda r: (r.hierarchy_level, r.name))

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

        permission_lookup = {p.name: p for p in permissions}

        default_roles_copy = dict(self.default_roles)
        if default_roles_copy.get("owner", {}).get("permissions") == []:
            default_roles_copy["owner"]["permissions"] = list(permission_lookup.keys())

        for role_name, role_data in default_roles_copy.items():


            existing = Role.query.filter_by(name=role_name, project_id=project_id).first()

            if not existing:
                role = Role(
                    name=role_name,
                    description=role_data["description"],
                    project_id=project_id,
                    is_system_role=True,
                    created_at=datetime.utcnow(),
                )

                db.session.add(role)
                db.session.flush()

                for permission_name in role_data["permissions"]:
                    if permission_name in permission_lookup:
                        role_permission = RolePermission(
                            role_id=role.id,
                            permission_id=permission_lookup[permission_name].id,
                            permission_type="allow",
                            created_at=datetime.utcnow(),
                        )
                        db.session.add(role_permission)

                roles.append(role)

        db.session.commit()
        
        # Invalidate cache if any roles were created
        if roles and self._cache_service:
            try:
                self._cache_service.invalidate_rbac_project_instantly(project_id)
                logging.debug(f"Invalidated RBAC cache for project {project_id} after creating {len(roles)} roles")
            except Exception as cache_error:
                logging.warning(f"Failed to invalidate RBAC cache after role creation: {cache_error}")
        
        return roles

    def _would_create_circular_inheritance(
        self, parent_role_id: int, child_role_id: int = None
    ) -> bool:
        """Check if setting parent_role_id would create circular inheritance"""
        if not parent_role_id:
            return False

        if child_role_id:
            current_role = Role.query.get(parent_role_id)
            while current_role:
                if current_role.id == child_role_id:
                    return True
                current_role = current_role.parent_role

        return False

    def _invalidate_users_with_role_cache(self, role_id: int) -> None:
        """Invalidate cache for all users with a specific role (granular invalidation with instant markers)"""
        try:
            if not self._cache_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "CacheService dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service

            user_roles = UserRole.query.filter_by(role_id=role_id).all()
            for user_role in user_roles:
                cache_service.invalidate_rbac_user_instantly(user_role.user_id)
            logging.debug(f"Invalidated cache for {len(user_roles)} users with role_id={role_id}")
        except Exception as e:
            logging.error(f"Error invalidating users cache for role_id={role_id}: {e}")