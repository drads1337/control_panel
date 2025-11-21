"""
Users services package
Contains business logic for user management, profiles, invites, and 2FA
"""

# Import user management service facade for backward compatibility
# The facade delegates to specialized services while maintaining the original interface
from .user_management_service_facade import UserManagementServiceFacade, user_management_service

# Also export specialized services for direct use if needed
from .user_crud_service import UserCRUDService, user_crud_service
from .user_role_service import UserRoleService, user_role_service
from .user_permission_service import UserPermissionService, user_permission_service
from .user_statistics_service import UserStatisticsService, user_statistics_service
from .user_invite_service import UserInviteService, user_invite_service
from .user_relationships_service import (
    UserRelationshipsService,
    user_relationships_service,
)

# Legacy imports (kept for backward compatibility)
from .user_management_service import UserManagementService  # Original service class (deprecated, use UserManagementServiceFacade)
from .invite_service import invite_service
from .two_factor_service import two_factor_service
from .user_orchestrator import UserOrchestrator
from .user_profile_service import UserProfileService, user_profile_service

import sys
_current_module = sys.modules[__name__]
__all__ = sorted([
    name for name in dir(_current_module)
    if not name.startswith('_') and name not in ('sys', '_current_module')
])
del sys, _current_module
