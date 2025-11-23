"""
Users services package
Contains business logic for user management, profiles, invites, and 2FA
"""

# Export specialized services for direct use
from .user_crud_service import UserCRUDService
from .user_role_service import UserRoleService
from .user_permission_service import UserPermissionService
from .user_statistics_service import UserStatisticsService
from .user_invite_service import UserInviteService
from .user_relationships_service import UserRelationshipsService

# Additional services
from .user_orchestrator import UserOrchestrator
from .user_profile_service import UserProfileService

# Note: Service instances should be obtained via ServiceContainer:
#   from ...core.service_container import get_service
#   service = get_service('service_name')

__all__ = [
    "UserCRUDService",
    "UserRoleService",
    "UserPermissionService",
    "UserStatisticsService",
    "UserInviteService",
    "UserRelationshipsService",
    "UserOrchestrator",
    "UserProfileService",
]