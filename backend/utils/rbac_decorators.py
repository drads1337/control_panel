"""
RBAC Decorators
Decorators for checking permissions in routes

DEPRECATED: This module is deprecated. All decorators have been unified in middleware/auth.py.

Migration path:
- Replace imports from utils.rbac_decorators with middleware.auth
- All decorators are now available in middleware.auth with the same names

The unified authorization system is now in middleware/auth.py and uses RBACManager
as the single source of truth for all authorization checks.

This module now re-exports decorators from middleware.auth for backward compatibility only.
All new code should import directly from middleware.auth.
"""

# Re-export all decorators from middleware.auth for backward compatibility
# All decorators are now unified in middleware/auth.py
from ..middleware.auth import (
    require_auth,
    require_user,
    require_role,
    require_permission,
    require_admin,
    require_owner,
    require_project_active,
    require_project_assignment,
    require_project_with_grace_period,
    require_project_isolation,
    enforce_project_scope,
    check_permission_in_route,
    get_user_permissions_in_route,
    require_any_permission,
    validate_project_access,
)

# All decorators above are re-exported from middleware.auth.
# This module exists only for backward compatibility.
# All new code should import directly from middleware.auth.
