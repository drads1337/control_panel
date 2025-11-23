"""
Users services package
Contains business logic for user management, profiles, invites, and 2FA
"""

# Import user management service facade for backward compatibility
# ⚠️ DEPRECATED: The facade is kept only for backward compatibility.
# All routes have been migrated to specialized services.
# For new code, use specialized services directly:
# - user_crud_service for CRUD operations
# - user_role_service for role management
# - user_permission_service for permission management
# - user_statistics_service for statistics
# - user_invite_service for invitations
from .user_management_service_facade import UserManagementServiceFacade

# Also export specialized services for direct use if needed
from .user_crud_service import UserCRUDService
from .user_role_service import UserRoleService
from .user_permission_service import UserPermissionService
from .user_statistics_service import UserStatisticsService
from .user_invite_service import UserInviteService
from .user_relationships_service import UserRelationshipsService

# Legacy imports (kept for backward compatibility)
from .user_management_service import UserManagementService  # Original service class (deprecated, use UserManagementServiceFacade)
from .user_orchestrator import UserOrchestrator
from .user_profile_service import UserProfileService

# Note: Service instances should be obtained via ServiceContainer:
#   from ...core.service_container import get_service
#   service = get_service('service_name')

__all__ = [
    "UserManagementServiceFacade",
    "UserCRUDService",
    "UserRoleService",
    "UserPermissionService",
    "UserStatisticsService",
    "UserInviteService",
    "UserRelationshipsService",
    "UserManagementService",
    "UserOrchestrator",
    "UserProfileService",
]
