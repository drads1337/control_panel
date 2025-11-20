"""
RBAC Service
Facade service that delegates to specialized RBAC services (RoleService, PermissionService, ABACService)
Maintains backward compatibility while improving separation of concerns
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from ...core.extensions import db
from ...models.core import User
from ...models.rbac import Permission, Role, UserRole
from ...services.cache import cache_service
from ...utils.rbac_utils import RBACManager
from .abac_service import ABACService
from .permission_service import PermissionService
from .role_service import RoleService

class RBACService:
    """Facade service for managing Role-Based Access Control - delegates to specialized services"""

    def __init__(self):

        self.default_permissions = {
            "employees": {
                "view": "View employees",
                "create": "Create employee",
                "send_notification": "Send notification to employee",
                "edit": "Edit employee",
                "delete": "Delete employee",
            },
            "clients": {
                "view": "View clients",
                "create": "Create client",
                "send_notification": "Send notification to client",
                "edit": "Edit client",
                "delete": "Delete client",
            },
            "rbac": {
                "view": "View RBAC",
                "create_role": "Create role",
                "edit": "Edit role",
                "delete": "Delete role",
            },
            "referrals": {
                "view": "View referrals",
                "create": "Create referral",
                "delete": "Delete referral",
            },
            "keys": {
                "view": "View keys",
                "create": "Create keys",
                "edit": "Edit keys",
                "delete": "Delete keys",
                "generate": "Generate keys",
                "reset_pc_binding": "Reset PC binding",
                "pause_resume": "Pause/Resume keys",
                "extend": "Extend keys",
                "block": "Block keys",
                "manage": "Manage other users' keys",
                "copy": "Copy key",
                "see_analytics": "See analytics",
            },
            "analytics": {"view": "View analytics", "export": "Export analytics data"},
            "webhooks": {
                "view": "View webhooks",
                "create": "Create webhooks",
                "edit": "Edit webhooks",
                "delete": "Delete webhooks",
                "test": "Test webhooks",
                "view_logs": "View webhook logs",
            },
            "security": {
                "view_fingerprints": "View blocked fingerprints",
                "block_fingerprints": "Block device fingerprints",
                "unblock_fingerprints": "Unblock device fingerprints",
                "view_ips": "View blocked IP addresses",
                "block_ips": "Block IP addresses",
                "unblock_ips": "Unblock IP addresses",
                "view_hwids": "View blocked hardware IDs",
                "block_hwids": "Block hardware IDs",
                "unblock_hwids": "Unblock hardware IDs",
                "manage_rules": "Manage security rules",
                "view_logs": "View security logs",
            },
            "system": {
                "view_health": "View system health",
                "manage_maintenance": "Manage system maintenance",
                "view_logs": "View system logs",
                "manage_all_projects": "Manage all projects (owner-level access)",
            },
            "billing": {
                "view_balance": "View user balance",
                "top_up_balance": "Top up user balance",
                "deduct_balance": "Deduct from user balance",
                "view_transactions": "View transaction history",
            },
            "remote_control": {
                "view": "View remote control features",
                "create": "Create remote control features",
                "edit": "Edit remote control features",
                "delete": "Delete remote control features",
                "toggle": "Toggle remote control features",
            },
            "games": {
                "view": "View applications",
                "create": "Create application",
                "edit": "Edit application",
                "upload_files": "Upload files for application",
                "files_view": "View application files (configs, resources)",
                "files_upload": "Upload files for application",
                "files_delete": "Delete application files",
                "files_download": "Download application files",
                "files_manage_configs": "Manage application config files",
                "files_manage_resources": "Manage application resource files",
                "manage_prices": "Manage prices",
                "notifications_create": "Create application notifications",
                "notifications_edit": "Edit application notifications",
                "notifications_delete": "Delete application notifications",
                "changelog_view": "View application changelog",
                "changelog_create": "Create application changelog",
                "changelog_edit": "Edit application changelog",
                "changelog_delete": "Delete application changelog",
                "status": "Manage application status",
                "delete": "Delete application",
            },
            "loaders": {
                "view": "View loaders",
                "create": "Create loader",
                "edit": "Edit loader",
                "configuration_settings": "Configuration settings",
                "assign_games": "Assign games to loader",
                "upload_files": "Upload files for loader",
                "files_view": "View application files (configs, resources)",
                "files_upload": "Upload files for application",
                "files_delete": "Delete application files",
                "files_download": "Download application files",
                "files_manage_configs": "Manage application config files",
                "files_manage_resources": "Manage application resource files",
                "multi_upload_files": "Upload multiple files for loader",
                "notifications_view": "View loader notifications",
                "notifications_create": "Create loader notifications",
                "notifications_edit": "Edit loader notifications",
                "notifications_delete": "Delete loader notifications",
                "changelog_view": "View loader changelog",
                "changelog_create": "Create loader changelog",
                "changelog_edit": "Edit loader changelog",
                "changelog_delete": "Delete loader changelog",
                "status": "Manage loader status",
                "delete": "Delete loader",
            },
            "logs": {"view": "View logs"},
        }

        self.default_roles = {
            "owner": {
                "description": "Full system access",
                "permissions": [],
            },
            "admin": {
                "description": "Administrative access",
                "permissions": [

                    "employees.view",
                    "employees.create",
                    "employees.edit",
                    "employees.send_notification",
                    "employees.delete",

                    "clients.view",
                    "clients.create",
                    "clients.edit",
                    "clients.send_notification",
                    "clients.delete",

                    "rbac.view",
                    "rbac.create_role",
                    "rbac.edit",
                    "rbac.delete",

                    "referrals.view",
                    "referrals.create",
                    "referrals.delete",

                    "keys.view",
                    "keys.create",
                    "keys.edit",
                    "keys.delete",
                    "keys.generate",
                    "keys.reset_pc_binding",
                    "keys.pause_resume",
                    "keys.extend",
                    "keys.block",
                    "keys.copy",
                    "keys.see_analytics",

                    "analytics.view",
                    "analytics.export",

                    "webhooks.view",
                    "webhooks.create",
                    "webhooks.edit",
                    "webhooks.delete",
                    "webhooks.test",
                    "webhooks.view_logs",

                    "security.view_fingerprints",
                    "security.block_fingerprints",
                    "security.unblock_fingerprints",
                    "security.view_ips",
                    "security.block_ips",
                    "security.unblock_ips",
                    "security.view_hwids",
                    "security.block_hwids",
                    "security.unblock_hwids",
                    "security.manage_rules",
                    "security.view_logs",

                    "remote_control.view",
                    "remote_control.create",
                    "remote_control.edit",
                    "remote_control.delete",
                    "remote_control.toggle",

                    "system.view_health",
                    "system.view_logs",

                    "billing.view_balance",
                    "billing.top_up_balance",
                    "billing.deduct_balance",
                    "billing.view_transactions",

                    "games.view",
                    "games.create",
                    "games.edit",
                    "games.upload_files",
                    "games.manage_prices",
                    "games.notifications_view",
                    "games.notifications_create",
                    "games.notifications_edit",
                    "games.notifications_delete",
                    "games.changelog_view",
                    "games.changelog_create",
                    "games.changelog_edit",
                    "games.changelog_delete",
                    "games.status",
                    "games.delete",
                    "games.files_view",
                    "games.files_upload",
                    "games.files_delete",
                    "games.files_download",
                    "games.files_manage_configs",
                    "games.files_manage_resources",

                    "loaders.view",
                    "loaders.create",
                    "loaders.edit",
                    "loaders.configuration_settings",
                    "loaders.assign_games",
                    "loaders.upload_files",
                    "loaders.multi_upload_files",
                    "loaders.notifications_view",
                    "loaders.notifications_create",
                    "loaders.notifications_edit",
                    "loaders.notifications_delete",
                    "loaders.changelog_view",
                    "loaders.changelog_create",
                    "loaders.changelog_edit",
                    "loaders.changelog_delete",
                    "loaders.status",
                    "loaders.delete",
                    "loaders.files_view",
                    "loaders.files_upload",
                    "loaders.files_multi_upload",
                    "loaders.files_delete",
                    "loaders.files_download",
                    "loaders.files_manage_configs",
                    "loaders.files_manage_resources",

                    "logs.view",
                ],
            },
            "seller": {
                "description": "Sales and key management",
                "permissions": [

                    "employees.view",
                    "employees.create",
                    "employees.edit",
                    "employees.send_notification",

                    "clients.view",
                    "clients.create",
                    "clients.edit",
                    "clients.send_notification",

                    "rbac.view",

                    "referrals.view",
                    "referrals.create",
                    "referrals.delete",

                    "keys.view",
                    "keys.create",
                    "keys.edit",
                    "keys.generate",
                    "keys.reset_pc_binding",
                    "keys.pause_resume",
                    "keys.extend",
                    "keys.block",
                    "keys.copy",
                    "keys.see_analytics",
                    "analytics.view",
                    "webhooks.view",
                    "webhooks.create",
                    "webhooks.edit",
                    "webhooks.test",
                    "webhooks.view_logs",
                    "webhooks.view_stats",
                    "webhooks.view_templates",
                    "webhooks.view_secrets",
                    "webhooks.view_retry",
                    "webhooks.view_filters",
                    "webhooks.view_headers",
                    "webhooks.view_payload",
                    "security.view_fingerprints",
                    "security.view_ips",
                    "security.view_hwids",
                    "security.view_analytics",
                    "security.view_events",
                    "security.view_2fa",
                    "security.view_logs",
                    "security.view_sessions",
                    "security.view_audit",
                    "security.view_threats",
                    "security.view_compliance",
                    "remote_control.view",
                    "remote_control.view_stats",
                    "remote_control.view_sessions",
                    "remote_control.view_permissions",
                    "remote_control.view_templates",
                    "remote_control.view_logs",
                    "billing.view_balance",
                    "billing.top_up_balance",
                    "billing.view_transactions",

                    "games.view",
                    "games.create",
                    "games.edit",
                    "games.upload_files",
                    "games.files_view",
                    "games.files_upload",
                    "games.files_delete",
                    "games.files_download",
                    "games.manage_prices",
                    "games.notifications_view",
                    "games.notifications_create",
                    "games.notifications_edit",
                    "games.notifications_delete",
                    "games.changelog_view",
                    "games.changelog_create",
                    "games.changelog_edit",
                    "games.changelog_delete",
                    "games.status",

                    "loaders.view",
                    "loaders.create",
                    "loaders.edit",
                    "loaders.configuration_settings",
                    "loaders.assign_games",
                    "loaders.upload_files",
                    "loaders.notifications_view",
                    "loaders.notifications_create",
                    "loaders.notifications_edit",
                    "loaders.notifications_delete",
                    "loaders.changelog_view",
                    "loaders.changelog_create",
                    "loaders.changelog_edit",
                    "loaders.changelog_delete",
                    "loaders.status",
                ],
            },
            "support": {
                "description": "Customer support access",
                "permissions": [

                    "clients.view",
                    "clients.edit",

                    "keys.view",
                    "keys.reset_pc_binding",

                    "security.view_fingerprints",
                    "security.view_ips",
                    "security.view_hwids",
                    "security.view_analytics",
                    "security.view_events",
                    "security.view_2fa",
                    "security.view_logs",
                    "security.view_sessions",
                    "security.view_audit",
                    "security.view_threats",
                    "security.view_compliance",
                    "remote_control.view",
                    "remote_control.view_stats",
                    "remote_control.view_sessions",
                    "remote_control.view_permissions",
                    "remote_control.view_templates",
                    "remote_control.view_logs",
                    "billing.view_balance",
                    "billing.view_transactions",
                ],
            },
            "client": {
                "description": "Basic client access",
                "permissions": ["keys.view", "billing.view_balance", "billing.view_transactions"],
            },
            "billing_manager": {
                "description": "Billing and balance management",
                "permissions": [

                    "clients.view",
                    "clients.edit",

                    "billing.view_balance",
                    "billing.top_up_balance",
                    "billing.deduct_balance",
                    "billing.view_transactions",
                    "analytics.view",
                ],
            },
            "developer": {
                "description": "Developer access with file management and remote control",
                "permissions": [

                    "remote_control.view",
                    "remote_control.create",
                    "remote_control.edit",
                    "remote_control.delete",
                    "remote_control.toggle",

                    "analytics.view",
                ],
            },
        }

        self.permission_service = PermissionService(default_permissions=self.default_permissions)
        self.role_service = RoleService(
            permission_service=self.permission_service,
            default_roles=self.default_roles,
            get_all_permissions_func=self._get_all_permissions,
        )
        self.abac_service = ABACService()

    def initialize_default_data(self, project_id: int) -> bool:
        """Initialize default roles and permissions for a project"""
        try:

            permissions = self.permission_service._create_permissions(project_id)

            roles = self.role_service._create_roles(project_id, permissions)

            logging.info(
                f"RBAC_INITIALIZED project_id={project_id} permissions={len(permissions)} roles={len(roles)}"
            )
            return True

        except Exception as e:
            logging.error(f"RBAC_INITIALIZATION_ERROR project_id={project_id} error={e}")
            return False

    def _create_permissions(self, project_id: int) -> List[Permission]:
        """Create default permissions for a project - delegates to PermissionService"""
        return self.permission_service._create_permissions(project_id)

    def _create_roles(self, project_id: int, permissions: List[Permission]) -> List[Role]:
        """Create default roles for a project - delegates to RoleService"""
        return self.role_service._create_roles(project_id, permissions)

    def _get_all_permissions(self, project_id: int = None) -> List[str]:
        """Get all available permissions - delegates to PermissionService"""
        return self.permission_service._get_all_permissions(project_id)

    def create_role(
        self,
        project_id: int,
        name: str,
        description: str,
        permissions: List[str],
        is_system_role: bool = False,
        parent_role_id: int = None,
    ) -> Dict:
        """Create a new custom role - delegates to RoleService"""
        return self.role_service.create_role(
            project_id=project_id,
            name=name,
            description=description,
            permissions=permissions,
            is_system_role=is_system_role,
            parent_role_id=parent_role_id,
        )

    def update_role(self, role_id: int, project_id: int, **kwargs) -> Dict:
        """Update an existing role - delegates to RoleService"""
        return self.role_service.update_role(role_id, project_id, **kwargs)

    def delete_role(
        self, role_id: int, project_id: int, force: bool = False, reassign_to_role_id: int = None
    ) -> bool:
        """Delete a role - delegates to RoleService"""
        return self.role_service.delete_role(role_id, project_id, force, reassign_to_role_id)

    def get_roles(self, project_id: int) -> List[Dict]:
        """Get all roles for a project - delegates to RoleService"""
        return self.role_service.get_roles(project_id)

    def get_permissions(self, project_id: int) -> Dict:
        """Get all permissions for a project - delegates to PermissionService"""
        return self.permission_service.get_permissions(project_id)

    def assign_role_to_user(self, user_id: int, role_id: int) -> bool:
        """Assign a role to a user - delegates to RoleService"""
        return self.role_service.assign_role_to_user(user_id, role_id)

    def remove_role_from_user(self, user_id: int, role_id: int) -> bool:
        """Remove a role from a user - delegates to RoleService"""
        return self.role_service.remove_role_from_user(user_id, role_id)

    def get_user_roles(self, user_id: int) -> List[Dict]:
        """Get all roles assigned to a user - delegates to RoleService"""
        return self.role_service.get_user_roles(user_id)

    def get_user_permissions(self, user_id: int) -> Set[str]:
        """Get all permissions for a user - delegates to PermissionService"""

        try:
            from ...models.rbac import Permission
            user = User.query.get(user_id)
            if user and user.project_id:
                existing_permissions = Permission.query.filter_by(
                    project_id=user.project_id
                ).count()
                if existing_permissions == 0:
                    logging.info(
                        f"RBAC_AUTO_INITIALIZE project_id={user.project_id} user_id={user_id}"
                    )
                    self.initialize_default_data(user.project_id)
        except Exception as e:
            logging.warning(f"RBAC_AUTO_INIT_ERROR user_id={user_id} error={e}")

        return self.permission_service.get_user_permissions(user_id)

    def _invalidate_users_with_role_cache(self, role_id: int) -> None:
        """Invalidate cache for all users with a specific role - delegates to RoleService"""
        return self.role_service._invalidate_users_with_role_cache(role_id)

    def _invalidate_users_with_permission_cache(self, permission_id: int) -> None:
        """Invalidate cache for all users with roles that have a specific permission - delegates to PermissionService"""
        return self.permission_service._invalidate_users_with_permission_cache(permission_id)

    def _get_inherited_permissions(self, role) -> Dict[str, Set[str]]:
        """Get inherited permissions from a role hierarchy - delegates to PermissionService"""
        return self.permission_service._get_inherited_permissions(role)

    def _would_create_circular_inheritance(
        self, parent_role_id: int, child_role_id: int = None
    ) -> bool:
        """Check if setting parent_role_id would create circular inheritance - delegates to RoleService"""
        return self.role_service._would_create_circular_inheritance(parent_role_id, child_role_id)

    def get_role_hierarchy(self, project_id: int) -> Dict:
        """Get the complete role hierarchy for a project - delegates to RoleService"""
        return self.role_service.get_role_hierarchy(project_id)

    def get_role_inheritance_chain(self, role_id: int) -> List[Dict]:
        """Get the inheritance chain for a specific role - delegates to RoleService"""
        return self.role_service.get_role_inheritance_chain(role_id)

    def check_permission(
        self,
        user_id: int,
        permission: str,
        game_id: int = None,
        resource_type: str = None,
        resource_id: int = None,
        context: Dict = None,
    ) -> bool:
        """Check if a user has a specific permission with ABAC and resource-level support"""
        try:
            from ...models.core import User
            from ...utils.rbac_utils import RBACManager

            user = User.query.get(user_id)
            if not user:
                return False

            if RBACManager.is_owner(user):
                return True

            if RBACManager.is_admin(user):
                return True

            user_permissions = self.get_user_permissions(user_id)

            resource_permission_result = self._check_resource_permissions(
                user_id, permission, resource_type, resource_id
            )
            if resource_permission_result is not None:

                abac_result = self._check_abac_rules(
                    user_id, permission, resource_type, resource_id, context
                )
                if abac_result is not None:
                    return abac_result
                return resource_permission_result

            if permission in user_permissions:

                abac_result = self._check_abac_rules(
                    user_id, permission, resource_type, resource_id, context
                )
                if abac_result is not None:
                    return abac_result
                return True

            if game_id:

                if "." in permission:
                    resource, action = permission.split(".", 1)
                else:
                    resource = permission
                    action = "view"

                from ...models.rbac import Permission, RolePermission, UserRole
                user_roles = UserRole.query.filter_by(user_id=user_id).all()
                role_ids = [ur.role_id for ur in user_roles]

                if role_ids:

                    game_specific_permission = (
                        db.session.query(Permission)
                        .join(RolePermission, RolePermission.permission_id == Permission.id)
                        .filter(
                            RolePermission.role_id.in_(role_ids),
                            Permission.resource == resource,
                            Permission.action == action,
                            Permission.game_id == game_id,
                            Permission.project_id == user.project_id,
                        )
                        .first()
                    )

                    if game_specific_permission:

                        abac_result = self._check_abac_rules(
                            user_id, permission, resource_type, resource_id, context
                        )
                        if abac_result is not None:
                            return abac_result
                        return True

                game_permission = f"{permission}.game.{game_id}"
                if game_permission in user_permissions:

                    abac_result = self._check_abac_rules(
                        user_id, game_permission, resource_type, resource_id, context
                    )
                    if abac_result is not None:
                        return abac_result
                    return True

            abac_result = self._check_abac_rules(
                user_id, permission, resource_type, resource_id, context
            )
            if abac_result is not None:
                return abac_result

            return False

        except Exception as e:
            logging.error(
                f"RBAC_PERMISSION_CHECK_ERROR user_id={user_id} permission={permission} game_id={game_id} error={e}"
            )
            return False

    def _check_resource_permissions(
        self, user_id: int, permission: str, resource_type: str = None, resource_id: int = None
    ) -> Optional[bool]:
        """Check for resource-specific permissions"""
        try:
            if not resource_type:
                return None

            user = User.query.get(user_id)
            if not user or not user.project_id:
                return None

            if "." in permission:
                resource, action = permission.split(".", 1)
            else:
                resource = permission
                action = "view"

            user_roles = UserRole.query.filter_by(user_id=user_id).all()

            for user_role in user_roles:
                role_permissions = user_role.role.permissions.join(Permission).filter(
                    Permission.project_id == user.project_id,
                    Permission.resource == resource,
                    Permission.action == action,
                )

                for role_permission in role_permissions:
                    perm = role_permission.permission

                    if perm.scope == "global":
                        return True
                    elif perm.scope == "resource" and perm.resource_type == resource_type:
                        return True
                    elif (
                        perm.scope == "instance"
                        and perm.resource_type == resource_type
                        and perm.resource_id == resource_id
                    ):
                        return True

            return None

        except Exception as e:
            logging.error(
                f"RBAC_RESOURCE_PERMISSION_CHECK_ERROR user_id={user_id} permission={permission} error={e}"
            )
            return None

    def _check_abac_rules(
        self,
        user_id: int,
        permission: str,
        resource_type: str = None,
        resource_id: int = None,
        context: Dict = None,
    ) -> Optional[bool]:
        """Check ABAC rules for permission - delegates to ABACService"""
        return self.abac_service.check_abac_rules(
            user_id=user_id,
            permission=permission,
            resource_type=resource_type,
            resource_id=resource_id,
            context=context,
        )

    def _get_user_attributes(self, user_id: int) -> Dict[str, Any]:
        """Get all attributes for a user - delegates to ABACService"""
        return self.abac_service.get_user_attributes(user_id)

    def _get_resource_attributes(
        self, project_id: int, resource_type: str, resource_id: int
    ) -> Dict[str, Any]:
        """Get all attributes for a resource - delegates to ABACService"""
        return self.abac_service.get_resource_attributes(project_id, resource_type, resource_id)

    def create_attribute_rule(
        self,
        project_id: int,
        name: str,
        description: str,
        rule_type: str,
        conditions: Dict,
        target_resource: str = None,
        target_action: str = None,
        priority: int = 100,
    ) -> Dict:
        """Create a new ABAC attribute rule - delegates to ABACService"""
        return self.abac_service.create_attribute_rule(
            project_id=project_id,
            name=name,
            description=description,
            rule_type=rule_type,
            conditions=conditions,
            target_resource=target_resource,
            target_action=target_action,
            priority=priority,
        )

    def set_user_attribute(
        self,
        user_id: int,
        attribute_name: str,
        attribute_value: str,
        attribute_type: str = "string",
    ) -> Dict:
        """Set a user attribute for ABAC - delegates to ABACService"""
        return self.abac_service.set_user_attribute(
            user_id=user_id,
            attribute_name=attribute_name,
            attribute_value=attribute_value,
            attribute_type=attribute_type,
        )

    def set_resource_attribute(
        self,
        project_id: int,
        resource_type: str,
        resource_id: int,
        attribute_name: str,
        attribute_value: str,
        attribute_type: str = "string",
    ) -> Dict:
        """Set a resource attribute for ABAC - delegates to ABACService"""
        return self.abac_service.set_resource_attribute(
            project_id=project_id,
            resource_type=resource_type,
            resource_id=resource_id,
            attribute_name=attribute_name,
            attribute_value=attribute_value,
            attribute_type=attribute_type,
        )

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, permission_type: str = "allow"
    ) -> bool:
        """Assign a permission to a role with allow/deny type - delegates to PermissionService"""
        result = self.permission_service.assign_permission_to_role(role_id, permission_id, permission_type)

        self.role_service._invalidate_users_with_role_cache(role_id)
        return result

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> bool:
        """Remove a permission from a role - delegates to PermissionService"""
        result = self.permission_service.remove_permission_from_role(role_id, permission_id)

        self.role_service._invalidate_users_with_role_cache(role_id)
        return result

    def get_role_permissions_detailed(self, role_id: int) -> Dict:
        """Get detailed permissions for a role including allow/deny types - delegates to PermissionService"""
        return self.permission_service.get_role_permissions_detailed(role_id)

    def get_role_users(self, role_id: int) -> List[Dict]:
        """Get all users assigned to a role - delegates to RoleService"""
        return self.role_service.get_role_users(role_id)

    def get_role_by_id(self, role_id: int) -> Optional[Dict]:
        """Get role information by ID - delegates to RoleService"""
        return self.role_service.get_role_by_id(role_id)

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
        """Create a new permission - delegates to PermissionService"""
        return self.permission_service.create_permission(
            project_id=project_id,
            name=name,
            description=description,
            resource=resource,
            action=action,
            game_id=game_id,
            resource_type=resource_type,
            resource_id=resource_id,
            scope=scope,
        )

    def update_permission(self, permission_id: int, project_id: int, **kwargs) -> Dict:
        """Update an existing permission - delegates to PermissionService"""
        return self.permission_service.update_permission(permission_id, project_id, **kwargs)

    def delete_permission(self, permission_id: int, project_id: int) -> bool:
        """Delete a permission - delegates to PermissionService"""
        return self.permission_service.delete_permission(permission_id, project_id)

    def get_rbac_statistics(self, project_id: int) -> Dict:
        """Get RBAC statistics for a project"""
        try:

            total_roles = Role.query.filter_by(project_id=project_id).count()
            system_roles = Role.query.filter_by(project_id=project_id, is_system_role=True).count()
            custom_roles = total_roles - system_roles

            total_permissions = Permission.query.filter_by(project_id=project_id).count()

            total_assignments = (
                UserRole.query.join(Role).filter(Role.project_id == project_id).count()
            )

            users_with_roles = (
                db.session.query(UserRole.user_id)
                .join(Role)
                .filter(Role.project_id == project_id)
                .distinct()
                .count()
            )

            total_users = User.query.filter_by(project_id=project_id).count()
            users_without_roles = total_users - users_with_roles

            return {
                "total_roles": total_roles,
                "system_roles": system_roles,
                "custom_roles": custom_roles,
                "total_permissions": total_permissions,
                "total_assignments": total_assignments,
                "users_with_roles": users_with_roles,
                "users_without_roles": users_without_roles,
                "total_users": total_users,
            }

        except Exception as e:
            logging.error(f"RBAC_STATISTICS_ERROR project_id={project_id} error={e}")
            return {}

rbac_service = RBACService()
