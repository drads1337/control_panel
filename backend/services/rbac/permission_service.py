"""
Permission Service
Manages permissions for RBAC system
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Set

from ...core.extensions import db
from ...models.core import User
from ...models.rbac import Permission, RolePermission, UserRole
from ...services.cache import cache_service
from ...utils.rbac_utils import RBACManager


class PermissionService:
    """Service for managing permissions"""

    def __init__(self, default_permissions: Dict = None):
        """Initialize PermissionService with default permissions definition"""
        # Default permissions - should be passed from RBACService
        # This allows sharing the same default_permissions structure
        self.default_permissions = default_permissions or {}
        self.logger = logging.getLogger(__name__)

    def create_permission(
        self,
        project_id: int,
        name: str,
        description: str,
        resource: str,
        action: str,
        game_id: int = None,
        resource_type: str = None,
        resource_id: int = None,
        scope: str = "global",
    ) -> Dict:
        """Create a new permission"""
        try:
            # Check if permission already exists
            existing = Permission.query.filter_by(
                name=name,
                project_id=project_id,
                game_id=game_id,
                resource_type=resource_type,
                resource_id=resource_id,
            ).first()

            if existing:
                raise ValueError(f"Permission '{name}' already exists")

            # Validate scope
            if scope not in ["global", "resource", "instance"]:
                raise ValueError("Scope must be 'global', 'resource', or 'instance'")

            # Validate scope-specific requirements
            if scope == "resource" and not resource_type:
                raise ValueError("resource_type is required for 'resource' scope")
            if scope == "instance" and not (resource_type and resource_id):
                raise ValueError("resource_type and resource_id are required for 'instance' scope")

            # Create permission
            permission = Permission(
                name=name,
                description=description,
                resource=resource,
                action=action,
                game_id=game_id,
                resource_type=resource_type,
                resource_id=resource_id,
                scope=scope,
                project_id=project_id,
                created_at=datetime.utcnow(),
            )

            db.session.add(permission)
            db.session.commit()

            # Invalidate cache for permissions list with instant update markers
            cache_service.invalidate_rbac_permission_instantly(permission.id, project_id)
            cache_service.invalidate_rbac_project_instantly(project_id)

            logging.info(
                f"RBAC_PERMISSION_CREATED permission_id={permission.id} project_id={project_id} name={name} scope={scope}"
            )

            return {
                "id": permission.id,
                "name": permission.name,
                "description": permission.description,
                "resource": permission.resource,
                "action": permission.action,
                "game_id": permission.game_id,
                "resource_type": permission.resource_type,
                "resource_id": permission.resource_id,
                "scope": permission.scope,
                "resource_identifier": permission.get_resource_identifier(),
                "created_at": permission.created_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(
                f"RBAC_PERMISSION_CREATION_ERROR project_id={project_id} name={name} error={e}"
            )
            raise ValueError(f"Failed to create permission: {str(e)}")

    def update_permission(self, permission_id: int, project_id: int, **kwargs) -> Dict:
        """Update an existing permission"""
        try:
            permission = Permission.query.filter_by(id=permission_id, project_id=project_id).first()
            if not permission:
                raise ValueError("Permission not found")

            # Update fields
            if "name" in kwargs:
                # Check if name already exists
                existing = Permission.query.filter(
                    Permission.name == kwargs["name"],
                    Permission.project_id == project_id,
                    Permission.game_id == permission.game_id,
                    Permission.id != permission_id,
                ).first()

                if existing:
                    raise ValueError(f"Permission '{kwargs['name']}' already exists")

                permission.name = kwargs["name"]

            if "description" in kwargs:
                permission.description = kwargs["description"]

            if "resource" in kwargs:
                permission.resource = kwargs["resource"]

            if "action" in kwargs:
                permission.action = kwargs["action"]

            if "game_id" in kwargs:
                permission.game_id = kwargs["game_id"]

            db.session.commit()

            # Invalidate cache for permissions list with instant update markers
            cache_service.invalidate_rbac_permission_instantly(permission.id, project_id)
            cache_service.invalidate_rbac_project_instantly(project_id)

            # Invalidate cache for all users with roles that have this permission (granular invalidation)
            self._invalidate_users_with_permission_cache(permission_id)

            logging.info(f"RBAC_PERMISSION_UPDATED permission_id={permission_id}")

            return {
                "id": permission.id,
                "name": permission.name,
                "description": permission.description,
                "resource": permission.resource,
                "action": permission.action,
                "game_id": permission.game_id,
                "created_at": permission.created_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_PERMISSION_UPDATE_ERROR permission_id={permission_id} error={e}")
            raise ValueError(f"Failed to update permission: {str(e)}")

    def delete_permission(self, permission_id: int, project_id: int) -> bool:
        """Delete a permission"""
        try:
            permission = Permission.query.filter_by(id=permission_id, project_id=project_id).first()
            if not permission:
                return False

            # Check if permission is assigned to roles
            role_permissions = RolePermission.query.filter_by(permission_id=permission_id).count()
            if role_permissions > 0:
                raise ValueError(
                    f"Cannot delete permission: {role_permissions} roles are using this permission"
                )

            # Get permission_id before deletion for cache invalidation
            # Invalidate cache for all users with roles that have this permission (granular invalidation)
            self._invalidate_users_with_permission_cache(permission_id)

            # Delete permission
            db.session.delete(permission)
            db.session.commit()

            # Invalidate cache for permissions list with instant update markers
            cache_service.invalidate_rbac_permission_instantly(permission.id, project_id)
            cache_service.invalidate_rbac_project_instantly(project_id)

            logging.info(f"RBAC_PERMISSION_DELETED permission_id={permission_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"RBAC_PERMISSION_DELETION_ERROR permission_id={permission_id} error={e}")
            raise ValueError(f"Failed to delete permission: {str(e)}")

    def get_permissions(self, project_id: int) -> Dict:
        """Get all permissions for a project"""
        try:
            # Try to get from cache first
            cached_data = cache_service.get("rbac:permissions", project_id=project_id)
            if cached_data:
                return cached_data.get("data", {})

            # Ensure any newly added default permissions are backfilled into the DB
            # This keeps existing projects up to date with the latest default_permissions
            if self.default_permissions:
                self._create_permissions(project_id)

            permissions = (
                Permission.query.filter_by(project_id=project_id)
                .order_by(Permission.resource, Permission.action)
                .all()
            )

            # Build allow-list of valid permission names from current default_permissions
            allowed_permission_names = set()
            for resource, actions in self.default_permissions.items():
                for action in actions.keys():
                    allowed_permission_names.add(f"{resource}.{action}")

            # Group by resource
            grouped_permissions = {}
            for permission in permissions:
                # Exclude unwanted groups and unknown permissions from API response
                if permission.resource in ("notifications", "changelog", "files"):
                    continue
                if permission.name not in allowed_permission_names:
                    continue
                if permission.resource not in grouped_permissions:
                    grouped_permissions[permission.resource] = []

                grouped_permissions[permission.resource].append(
                    {
                        "id": permission.id,
                        "name": permission.name,
                        "description": permission.description,
                        "action": permission.action,
                    }
                )

            # Cache the result
            cache_service.set("rbac:permissions", grouped_permissions, project_id=project_id)

            return grouped_permissions

        except Exception as e:
            logging.error(f"RBAC_PERMISSIONS_GET_ERROR project_id={project_id} error={e}")
            return {}

    def get_user_permissions(self, user_id: int) -> Set[str]:
        """Get all permissions for a user (from all their roles including inherited)"""
        try:
            # Try to get from cache first
            cached_data = cache_service.get("rbac:user_permissions", user_id=user_id)
            if cached_data:
                data = cached_data.get("data", {})
                # Handle both old format (list) and new format (dict with permissions key)
                if isinstance(data, list):
                    return set(data)
                elif isinstance(data, dict) and "permissions" in data:
                    return set(data.get("permissions", []))
                return set()

            user = User.query.get(user_id)
            if not user:
                logging.warning(f"RBAC_USER_NOT_FOUND user_id={user_id}")
                return set()

            # Check if user is owner or admin - return all permissions
            if RBACManager.is_owner(user):
                all_permissions = self._get_all_permissions(
                    user.project_id if user.project_id else None
                )
                logging.debug(
                    f"RBAC_OWNER_PERMISSIONS user_id={user_id} permissions_count={len(all_permissions)}"
                )
                result = set(all_permissions)
                # Cache owner permissions (they don't change often)
                cache_service.set("rbac:user_permissions", {"permissions": list(result)}, user_id=user_id)
                return result

            # Check if user is admin - return all permissions (using RBAC only)
            if RBACManager.is_admin(user):
                all_permissions = self._get_all_permissions(
                    user.project_id if user.project_id else None
                )
                logging.debug(
                    f"RBAC_ADMIN_PERMISSIONS user_id={user_id} permissions_count={len(all_permissions)}"
                )
                result = set(all_permissions)
                # Cache admin permissions (they don't change often)
                cache_service.set("rbac:user_permissions", {"permissions": list(result)}, user_id=user_id)
                return result

            # Get user roles from RBAC
            user_roles = UserRole.query.filter_by(user_id=user_id).all()

            # Check if user has admin or owner role in RBAC (before checking individual permissions)
            if user_roles:
                for user_role in user_roles:
                    if user_role.role.name in ["admin", "owner"]:
                        all_permissions = self._get_all_permissions(
                            user.project_id if user.project_id else None
                        )
                        logging.debug(
                            f"RBAC_ADMIN_ROLE_PERMISSIONS user_id={user_id} role={user_role.role.name} permissions_count={len(all_permissions)}"
                        )
                        result = set(all_permissions)
                        # Cache admin/owner role permissions
                        cache_service.set("rbac:user_permissions", {"permissions": list(result)}, user_id=user_id)
                        return result

            # For other users, get permissions from RBAC roles
            if not user_roles:
                logging.warning(
                    f"RBAC_NO_ROLES_ASSIGNED user_id={user_id} project_id={user.project_id}"
                )
                result = set()
                # Cache empty permissions
                cache_service.set("rbac:user_permissions", {"permissions": list(result)}, user_id=user_id)
                return result

            allow_permissions = set()
            deny_permissions = set()

            for user_role in user_roles:
                # Get direct permissions from role
                for role_permission in user_role.role.permissions:
                    permission_name = role_permission.permission.name
                    if role_permission.permission_type == "allow":
                        allow_permissions.add(permission_name)
                    elif role_permission.permission_type == "deny":
                        deny_permissions.add(permission_name)

                # Get inherited permissions from parent roles
                if user_role.role.parent_role:
                    inherited_permissions = self._get_inherited_permissions(
                        user_role.role.parent_role
                    )
                    allow_permissions.update(inherited_permissions["allow"])
                    deny_permissions.update(inherited_permissions["deny"])

            # Deny rules override allow rules
            final_permissions = allow_permissions - deny_permissions

            logging.debug(
                f"RBAC_USER_PERMISSIONS user_id={user_id} roles={[ur.role.name for ur in user_roles]} permissions_count={len(final_permissions)}"
            )

            # Cache the result
            cache_service.set("rbac:user_permissions", {"permissions": list(final_permissions)}, user_id=user_id)

            return final_permissions

        except Exception as e:
            logging.error(
                f"RBAC_USER_PERMISSIONS_GET_ERROR user_id={user_id} error={e}", exc_info=True
            )
            return set()

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, permission_type: str = "allow"
    ) -> bool:
        """Assign a permission to a role with allow/deny type"""
        try:
            # Validate permission type
            if permission_type not in ["allow", "deny"]:
                raise ValueError("Permission type must be 'allow' or 'deny'")

            # Check if assignment already exists
            existing = RolePermission.query.filter_by(
                role_id=role_id, permission_id=permission_id
            ).first()

            if existing:
                # Update existing assignment
                existing.permission_type = permission_type
            else:
                # Create new assignment
                role_permission = RolePermission(
                    role_id=role_id,
                    permission_id=permission_id,
                    permission_type=permission_type,
                    created_at=datetime.utcnow(),
                )
                db.session.add(role_permission)

            db.session.commit()

            # Invalidate cache for all users with this role (granular invalidation)
            # Note: Cache invalidation for role is handled by RoleService
            # This method can be called directly or by RoleService

            logging.info(
                f"RBAC_PERMISSION_ASSIGNED role_id={role_id} permission_id={permission_id} type={permission_type}"
            )
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(
                f"RBAC_PERMISSION_ASSIGNMENT_ERROR role_id={role_id} permission_id={permission_id} error={e}"
            )
            raise ValueError(f"Failed to assign permission: {str(e)}")

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> bool:
        """Remove a permission from a role"""
        try:
            role_permission = RolePermission.query.filter_by(
                role_id=role_id, permission_id=permission_id
            ).first()

            if not role_permission:
                return False

            db.session.delete(role_permission)
            db.session.commit()

            # Invalidate cache for all users with this role (granular invalidation)
            # Note: Cache invalidation for role is handled by RoleService
            # This method can be called directly or by RoleService

            logging.info(f"RBAC_PERMISSION_REMOVED role_id={role_id} permission_id={permission_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(
                f"RBAC_PERMISSION_REMOVAL_ERROR role_id={role_id} permission_id={permission_id} error={e}"
            )
            return False

    def get_role_permissions_detailed(self, role_id: int) -> Dict:
        """Get detailed permissions for a role including allow/deny types"""
        try:
            from ...models.rbac import Role

            role = Role.query.get(role_id)
            if not role:
                return {"allow": [], "deny": []}

            allow_permissions = []
            deny_permissions = []

            # Get direct permissions
            for role_permission in role.permissions:
                permission_data = {
                    "id": role_permission.permission.id,
                    "name": role_permission.permission.name,
                    "description": role_permission.permission.description,
                    "resource": role_permission.permission.resource,
                    "action": role_permission.permission.action,
                    "scope": role_permission.permission.scope,
                    "resource_identifier": role_permission.permission.get_resource_identifier(),
                }

                if role_permission.permission_type == "allow":
                    allow_permissions.append(permission_data)
                elif role_permission.permission_type == "deny":
                    deny_permissions.append(permission_data)

            # Get inherited permissions
            if role.parent_role:
                inherited = self._get_inherited_permissions(role.parent_role)
                # Convert inherited permission names to detailed data
                for perm_name in inherited["allow"]:
                    # Find permission by name
                    permission = Permission.query.filter_by(name=perm_name).first()
                    if permission:
                        allow_permissions.append(
                            {
                                "id": permission.id,
                                "name": permission.name,
                                "description": permission.description,
                                "resource": permission.resource,
                                "action": permission.action,
                                "scope": permission.scope,
                                "resource_identifier": permission.get_resource_identifier(),
                                "inherited": True,
                            }
                        )

                for perm_name in inherited["deny"]:
                    # Find permission by name
                    permission = Permission.query.filter_by(name=perm_name).first()
                    if permission:
                        deny_permissions.append(
                            {
                                "id": permission.id,
                                "name": permission.name,
                                "description": permission.description,
                                "resource": permission.resource,
                                "action": permission.action,
                                "scope": permission.scope,
                                "resource_identifier": permission.get_resource_identifier(),
                                "inherited": True,
                            }
                        )

            return {"allow": allow_permissions, "deny": deny_permissions}

        except Exception as e:
            logging.error(f"RBAC_ROLE_PERMISSIONS_DETAILED_ERROR role_id={role_id} error={e}")
            return {"allow": [], "deny": []}

    def _create_permissions(self, project_id: int) -> List[Permission]:
        """Create default permissions for a project"""
        permissions = []

        for resource, actions in self.default_permissions.items():
            for action, description in actions.items():
                permission_name = f"{resource}.{action}"

                # Check if permission already exists
                existing = Permission.query.filter_by(
                    name=permission_name, project_id=project_id
                ).first()

                if not existing:
                    permission = Permission(
                        name=permission_name,
                        description=description,
                        resource=resource,
                        action=action,
                        project_id=project_id,
                        created_at=datetime.utcnow(),
                    )

                    db.session.add(permission)
                    permissions.append(permission)

        db.session.commit()
        return permissions

    def _get_all_permissions(self, project_id: int = None) -> List[str]:
        """Get all available permissions"""
        try:
            # Get permissions from database first
            if project_id:
                db_permissions = [
                    p.name for p in Permission.query.filter_by(project_id=project_id).all()
                ]
            else:
                db_permissions = [p.name for p in Permission.query.all()]
        except:
            # If no app context, return only default permissions
            db_permissions = []

        # Add default permissions that might not be in DB yet
        default_permissions = []
        for resource, actions in self.default_permissions.items():
            for action in actions.keys():
                default_permissions.append(f"{resource}.{action}")

        # Combine and deduplicate
        all_permissions = list(set(db_permissions + default_permissions))
        return all_permissions

    def _invalidate_users_with_permission_cache(self, permission_id: int) -> None:
        """Invalidate cache for all users with roles that have a specific permission"""
        try:
            # Get all roles that have this permission
            role_permissions = RolePermission.query.filter_by(permission_id=permission_id).all()
            role_ids = {rp.role_id for rp in role_permissions}

            # Get all users with these roles
            user_ids = set()
            for role_id in role_ids:
                user_roles = UserRole.query.filter_by(role_id=role_id).all()
                user_ids.update({ur.user_id for ur in user_roles})

            # Invalidate cache for affected users with instant markers
            for user_id in user_ids:
                cache_service.invalidate_rbac_user_instantly(user_id)

            logging.debug(f"Invalidated cache for {len(user_ids)} users with permission_id={permission_id}")
        except Exception as e:
            logging.error(f"Error invalidating users cache for permission_id={permission_id}: {e}")

    def _get_inherited_permissions(self, role) -> Dict[str, Set[str]]:
        """Get inherited permissions from a role hierarchy"""
        allow_permissions = set()
        deny_permissions = set()

        # Get direct permissions
        for role_permission in role.permissions:
            permission_name = role_permission.permission.name
            if role_permission.permission_type == "allow":
                allow_permissions.add(permission_name)
            elif role_permission.permission_type == "deny":
                deny_permissions.add(permission_name)

        # Get inherited permissions from parent
        if role.parent_role:
            parent_permissions = self._get_inherited_permissions(role.parent_role)
            allow_permissions.update(parent_permissions["allow"])
            deny_permissions.update(parent_permissions["deny"])

        return {"allow": allow_permissions, "deny": deny_permissions}


# Global instance - will be initialized with default_permissions from RBACService
permission_service = PermissionService()

