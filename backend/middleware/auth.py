"""
Unified Authentication and Authorization Middleware
Consolidates all authentication and authorization decorators in one place

This module provides a canonical set of decorators for authentication and authorization.
This is the SINGLE SOURCE OF TRUTH for all authorization checks in the product.

All authorization is based on RBAC (Role-Based Access Control) system only.
Static roles (user.role, user.is_admin) are no longer supported - all users must use RBAC.

Available decorators:
- @require_auth: Basic authentication decorator
- @require_user: Get current user and add to g.current_user
- @require_role(role_name): Role-based access control (single role)
- @require_role(roles): Role-based access control (list of roles)
- @require_permission(permission_name): Permission-based access control
- @require_any_permission(permissions): Any of the specified permissions
- @require_all_permissions(permissions): All of the specified permissions
- @require_admin: Admin access
- @require_owner: Owner access
- @require_project_active: Active project requirement
- @require_project_with_grace_period: Project with grace period
- @require_project_assignment: Ensure user is assigned to a project
- @enforce_project_scope: Project scope enforcement
- @require_project_isolation: Project isolation security
- @validate_project_access: Resource project validation

All decorators use RBACManager from utils.rbac_utils as the single source of truth.
"""

import logging
from datetime import datetime, timedelta
from functools import wraps

from flask import current_app, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..core.extensions import db
from ..models.core import Project, User
from ..models.rbac import Permission, Role, RolePermission, UserRole
from ..utils.ip_utils import get_real_ip
from ..utils.rbac_utils import RBACManager

logger = logging.getLogger(__name__)

def _is_owner_safe(user):
    """
    Check if user is owner using RBAC system only.

    NOTE: This function uses RBACManager.is_owner() which is the single source of truth.
    Static roles (user.role) are deprecated and should not be used.
    """
    return RBACManager.is_owner(user)

def require_auth(f):
    """
    Basic authentication decorator - requires valid JWT token

    Usage:
    @require_auth
    def protected_route(current_user=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            g.current_user = user

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user

            return f(*args, **kwargs)

        except Exception as e:
            logger.debug(f"Authentication error in require_auth: {str(e)}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def require_user(f):
    """
    Decorator to get current user and add it to g.current_user
    This eliminates the need to repeat user fetching code in every route.
    Also passes current_user explicitly via kwargs if function accepts it.

    Usage:
    @require_user
    def some_route(current_user=None):

        pass

    Or for backward compatibility:
    @require_user
    def some_route():

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            g.current_user = user

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:

                kwargs["current_user"] = user

            return f(*args, **kwargs)

        except Exception as e:
            logger.debug(f"Authentication error in require_user: {str(e)}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def require_role(role_name_or_list):
    """
    Decorator to require specific role(s) using RBAC system

    Args:
        role_name_or_list: Name of the required role (str) or list of roles (List[str])

    Usage:
    @require_role('admin')
    def admin_route():
        pass

    @require_role(['admin', 'owner'])
    def admin_or_owner_route():
        pass
    """
    from typing import List, Union

    if isinstance(role_name_or_list, str):
        required_roles = [role_name_or_list]
    elif isinstance(role_name_or_list, list):
        required_roles = role_name_or_list
    else:
        raise ValueError("role_name_or_list must be a string or list of strings")

    def decorator(f):
        import inspect

        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()

                if not user_id:
                    return jsonify({"error": "Invalid token"}), 401

                user = User.query.get(user_id)
                if not user:
                    return jsonify({"error": "User not found"}), 404

                if not RBACManager.has_any_role(user, required_roles):
                    logger.warning(
                        f"User {user.username} attempted to access {f.__name__} without required role(s): {required_roles}"
                    )
                    return jsonify({"error": f"One of the following roles required: {', '.join(required_roles)}"}), 403

                g.current_user = user

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user

                return f(*args, **kwargs)

            except Exception as e:
                logger.debug(f"Role check error in require_role: {str(e)}")
                return jsonify({"error": "Authentication required"}), 401

        return decorated_function

    return decorator

def require_permission(permission_name: str):
    """
    Decorator to require specific permission using RBAC system

    Args:
        permission_name: Name of the required permission

    Usage:
    @require_permission('users.create')
    def create_user():
        pass
    """

    def decorator(f):
        import inspect

        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()

                if not user_id:
                    return jsonify({"error": "Invalid token"}), 401

                user = User.query.get(user_id)
                if not user:
                    return jsonify({"error": "User not found"}), 404

                if not RBACManager.has_permission(user.id, user.project_id, permission_name):
                    logger.warning(
                        f"User {user.username} attempted to access {f.__name__} without required permission: {permission_name}"
                    )
                    return jsonify({"error": f"Permission {permission_name} required"}), 403

                g.current_user = user

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user

                return f(*args, **kwargs)

            except Exception as e:
                logger.debug(f"Permission check error in require_permission: {str(e)}")
                return jsonify({"error": "Authentication required"}), 401

        return decorated_function

    return decorator

def require_any_permission(permissions):
    """
    Decorator to check if user has any of the specified permissions

    Args:
        permissions: List of permission names

    Usage:
    @require_any_permission(['users.create', 'users.edit'])
    def manage_user():
        pass
    """
    # Use RBACManager as single source of truth (which delegates to rbac_service)

    def decorator(f):
        import inspect

        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()

                if not user_id:
                    return jsonify({"error": "Invalid token"}), 401

                user = User.query.get(user_id)
                if not user:
                    return jsonify({"error": "User not found"}), 404

                # Use RBACManager as single source of truth (which delegates to rbac_service)
                has_any_permission = False
                for permission in permissions:
                    if RBACManager.has_permission(user.id, user.project_id, permission):
                        has_any_permission = True
                        break

                if not has_any_permission:
                    logger.warning(
                        f"User {user.username} attempted to access {f.__name__} without required permissions: {permissions}"
                    )
                    return jsonify({"error": "Insufficient permissions"}), 403

                g.current_user = user

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user

                return f(*args, **kwargs)

            except Exception as e:
                logger.debug(f"Permission check error in require_any_permission: {str(e)}")
                return jsonify({"error": "Authentication required"}), 401

        return decorated_function

    return decorator

def require_project_assignment(f):
    """
    Decorator to ensure user is assigned to a project (except owners)

    Usage:
    @require_project_assignment
    def project_scoped_route(current_user=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            if RBACManager.is_owner(user):

                g.current_user = user

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user

                return f(*args, **kwargs)

            if not user.project_id:
                logger.warning(
                    f"User {user.username} attempted to access {f.__name__} without project assignment"
                )
                return jsonify({"error": "User must be assigned to a project"}), 403

            g.current_user = user

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user

            return f(*args, **kwargs)

        except Exception as e:
            logger.debug(f"Project assignment check error: {str(e)}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def require_admin(f):
    """
    Decorator to require admin role

    Usage:
    @require_admin
    def admin_route(current_user=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            if not RBACManager.is_admin(user):
                logger.warning(
                    f"User {user.username} attempted to access admin endpoint: {f.__name__}"
                )
                return jsonify({"error": "Admin access required"}), 403

            g.current_user = user

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user

            return f(*args, **kwargs)

        except Exception as e:
            logger.debug(f"Admin check error in require_admin: {str(e)}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def require_owner(f):
    """
    Decorator to require owner role

    Usage:
    @require_owner
    def owner_route(current_user=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            if not _is_owner_safe(user):
                logger.warning(
                    f"User {user.username} attempted to access owner endpoint: {f.__name__}"
                )
                return jsonify({"error": "Owner access required"}), 403

            g.current_user = user

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user

            return f(*args, **kwargs)

        except Exception as e:
            logger.debug(f"Owner check error in require_owner: {str(e)}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def require_project_active(f):
    """
    Decorator that requires an active project for the route

    Usage:
    @require_project_active
    def project_route(current_user=None, current_project=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            if _is_owner_safe(user):

                g.current_user = user

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user

                return f(*args, **kwargs)

            if not user.project_id:
                return jsonify({"error": "User has no project"}), 403

            project = Project.query.get(user.project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404

            if not project.is_active:

                if project.status == "inactive":
                    error_message = "Project has been paused. Please contact the project owner to reactivate it."
                elif (
                    project.subscription_expires_at
                    and datetime.utcnow() > project.subscription_expires_at
                ):
                    error_message = "Project subscription has expired. Please contact the project owner to renew the subscription."
                else:
                    error_message = "Project is currently inactive"

                return (
                    jsonify(
                        {
                            "error": "Project Inactive",
                            "message": error_message,
                            "project_name": project.name,
                            "project_status": project.status,
                            "subscription_status": project.subscription_status_display,
                            "contact_owner": "Please contact the project owner for assistance.",
                        }
                    ),
                    403,
                )

            g.current_user = user
            g.current_project = project

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user
            if "current_project" in sig.parameters and "current_project" not in kwargs:
                kwargs["current_project"] = project

            return f(*args, **kwargs)

        except Exception as e:
            logger.debug(f"Project status check error in require_project_active: {str(e)}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def require_project_with_grace_period(f):
    """
    Decorator that requires an active project or allows access during grace period

    Usage:
    @require_project_with_grace_period
    def project_route(current_user=None, current_project=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            logger.debug(
                f"🔒 require_project_with_grace_period - Starting, method: {request.method}, cookies: {list(request.cookies.keys()) if request.cookies else 'none'}, origin: {request.headers.get('Origin')}"
            )

            try:
                user_id = get_jwt_identity()
            except RuntimeError as e:

                logger.error(
                    f"🔒 require_project_with_grace_period - RuntimeError from get_jwt_identity(): {str(e)}. This suggests JWT context wasn't set by @jwt_required(). Cookies: {list(request.cookies.keys()) if request.cookies else 'none'}"
                )
                return (
                    jsonify(
                        {
                            "error": "JWT context not available",
                            "msg": "Please log in again. Authentication token may not be properly set.",
                        }
                    ),
                    401,
                )
            except Exception as jwt_error:

                logger.error(
                    f"🔒 require_project_with_grace_period - Exception from get_jwt_identity(): {type(jwt_error).__name__}: {str(jwt_error)}"
                )
                raise

            logger.debug(f"🔒 require_project_with_grace_period - user_id: {user_id}")

            if not user_id:
                logger.warning(
                    f"🔒 require_project_with_grace_period - No user_id, cookies: {list(request.cookies.keys()) if request.cookies else 'none'}"
                )
                return jsonify({"error": "Invalid token", "msg": "No user ID found in token"}), 401

            user = User.query.get(user_id)
            if not user:
                logger.warning(
                    f"🔒 require_project_with_grace_period - User not found for user_id: {user_id}"
                )
                return jsonify({"error": "User not found"}), 404
        except Exception as e:
            logger.error(
                f"🔒 require_project_with_grace_period - Exception: {str(e)}, type: {type(e).__name__}, method: {request.method}, cookies: {list(request.cookies.keys()) if request.cookies else 'none'}"
            )
            import traceback

            logger.error(
                f"🔒 require_project_with_grace_period - Traceback: {traceback.format_exc()}"
            )

            error_str = str(e).lower()
            if (
                "jwt" in error_str
                or "token" in error_str
                or "cookie" in error_str
                or "unauthorized" in error_str
            ):
                return (
                    jsonify(
                        {
                            "error": "Invalid or missing authentication token",
                            "msg": "Please log in again. Cookies may not be set properly.",
                        }
                    ),
                    401,
                )
            return jsonify({"error": "Authentication required", "msg": str(e)}), 401

        if _is_owner_safe(user):

            g.current_user = user

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user

            return f(*args, **kwargs)

        if not user.project_id:
            return jsonify({"error": "User has no project"}), 403

        project = Project.query.get(user.project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        if project.subscription_expires_at:
            now = datetime.utcnow()
            grace_period_end = project.subscription_expires_at + timedelta(days=14)

            if now > project.subscription_expires_at and now <= grace_period_end:
                days_left_in_grace = (grace_period_end - now).days

                return (
                    jsonify(
                        {
                            "error": "Project Expired - Payment Required",
                            "message": f"Your project subscription has expired. You have {days_left_in_grace} days to renew before all data is deleted.",
                            "project_name": project.name,
                            "project_status": "expired",
                            "subscription_status": "expired",
                            "grace_period_days_left": days_left_in_grace,
                            "requires_payment": True,
                            "payment_required": True,
                        }
                    ),
                    402,
                )

            elif now > grace_period_end:
                return (
                    jsonify(
                        {
                            "error": "Project Deleted",
                            "message": "Your project has been permanently deleted due to non-payment after the grace period.",
                            "project_name": project.name,
                            "project_status": "deleted",
                            "subscription_status": "deleted",
                        }
                    ),
                    410,
                )

        if not project.is_active:
            if project.status == "inactive":
                error_message = (
                    "Project has been paused. Please contact the project owner to reactivate it."
                )
            else:
                error_message = "Project is currently inactive"

            return (
                jsonify(
                    {
                        "error": "Project Inactive",
                        "message": error_message,
                        "project_name": project.name,
                        "project_status": project.status,
                        "subscription_status": project.subscription_status_display,
                        "contact_owner": "Please contact the project owner for assistance.",
                    }
                ),
                403,
            )

        g.current_user = user
        g.current_project = project

        sig = inspect.signature(f)
        if "current_user" in sig.parameters and "current_user" not in kwargs:
            kwargs["current_user"] = user
        if "current_project" in sig.parameters and "current_project" not in kwargs:
            kwargs["current_project"] = project

        return f(*args, **kwargs)

    return decorated_function

def enforce_project_scope(f):
    """
    Decorator that enforces per-project scope and passes project_id explicitly.

    Rules:
    - Non-owner users must have user.project_id; that becomes the scope.
    - Owner users can work without project_id (system-wide access) or specify project_id for specific project operations.
    - Passes project_id explicitly via kwargs if function accepts it, otherwise sets g.project_id for backward compatibility.

    Usage:
    @enforce_project_scope
    def project_scoped_route(project_id=None):

        pass

    Or for backward compatibility:
    @enforce_project_scope
    def project_scoped_route():

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({"error": "Invalid token"}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        project_id = None
        project = None

        user_roles = RBACManager.get_user_role_names(user)
        if not user_roles or user_roles[0] != "owner":
            if not user.project_id:
                return jsonify({"error": "User has no project"}), 403
            project_id = user.project_id
            project = Project.query.get(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
        else:

            try:

                if "project_id" in request.args:
                    project_id = int(request.args.get("project_id"))
                else:

                    if request.is_json:
                        body = request.get_json(silent=True) or {}
                        if (
                            isinstance(body, dict)
                            and "project_id" in body
                            and body["project_id"] is not None
                        ):
                            project_id = int(body["project_id"])
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid project_id"}), 400

            if project_id:
                project = Project.query.get(project_id)
                if not project:
                    return jsonify({"error": "Project not found"}), 404

        g.project_id = project_id
        g.current_user = user
        g.current_project = project

        sig = inspect.signature(f)

        if "project_id" in sig.parameters and "project_id" not in kwargs:
            kwargs["project_id"] = project_id

        if "current_user" in sig.parameters and "current_user" not in kwargs:
            kwargs["current_user"] = user

        if "current_project" in sig.parameters and "current_project" not in kwargs:
            kwargs["current_project"] = project

        return f(*args, **kwargs)

    return decorated_function

def require_project_isolation(f):
    """
    SECURITY DECORATOR: Ensures all database queries are properly isolated by project_id.

    This decorator:
    1. Validates that user has a project_id
    2. Sets g.project_id for use in queries
    3. Logs any attempts to access data without proper project isolation
    4. Blocks access if user has no project_id

    Usage:
    @require_project_isolation
    def some_route(current_user=None, current_project=None, project_id=None):

        pass
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            logger.debug(
                f"🔒 require_project_isolation - Starting, method: {request.method}, cookies: {list(request.cookies.keys()) if request.cookies else 'none'}, origin: {request.headers.get('Origin')}"
            )

            try:
                user_id = get_jwt_identity()
            except RuntimeError as e:

                logger.error(
                    f"🔒 require_project_isolation - RuntimeError from get_jwt_identity(): {str(e)}. This suggests JWT context wasn't set by @jwt_required(). Cookies: {list(request.cookies.keys()) if request.cookies else 'none'}"
                )
                return (
                    jsonify(
                        {
                            "error": "JWT context not available",
                            "msg": "Please log in again. Authentication token may not be properly set.",
                        }
                    ),
                    401,
                )
            except Exception as jwt_error:

                logger.error(
                    f"🔒 require_project_isolation - Exception from get_jwt_identity(): {type(jwt_error).__name__}: {str(jwt_error)}"
                )
                raise

            logger.debug(f"🔒 require_project_isolation - Got user_id: {user_id}")

            if not user_id:
                logger.warning(
                    f"🔒 require_project_isolation - No user_id, cookies: {list(request.cookies.keys()) if request.cookies else 'none'}"
                )
                return jsonify({"error": "Invalid token", "msg": "No user ID found in token"}), 401

            user = User.query.get(user_id)
            if not user:
                logger.warning(
                    f"🔒 require_project_isolation - User not found for user_id: {user_id}"
                )
                return jsonify({"error": "User not found"}), 404

            if not user.project_id and not _is_owner_safe(user):
                logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} (ID: {user.id}) has no project_id"
                )
                return jsonify({"error": "User must be assigned to a project"}), 403

            if _is_owner_safe(user) and not user.project_id:
                # For owners without project_id, try to get project_id from request
                owner_project_id = None
                
                # Check query parameters
                if "project_id" in request.args:
                    try:
                        owner_project_id = int(request.args.get("project_id"))
                    except (ValueError, TypeError):
                        pass
                
                # Check JSON body
                if owner_project_id is None and request.is_json:
                    body = request.get_json(silent=True) or {}
                    if isinstance(body, dict) and "project_id" in body and body["project_id"] is not None:
                        try:
                            owner_project_id = int(body["project_id"])
                        except (ValueError, TypeError):
                            pass
                
                # Set project_id from request if available, otherwise None
                g.project_id = owner_project_id
                g.current_user = user
                g.current_project = Project.query.get(owner_project_id) if owner_project_id else None

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user
                if "current_project" in sig.parameters and "current_project" not in kwargs:
                    kwargs["current_project"] = g.current_project
                if "project_id" in sig.parameters and "project_id" not in kwargs:
                    kwargs["project_id"] = owner_project_id

                return f(*args, **kwargs)

            project = Project.query.get(user.project_id)
            if not project:
                logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} has invalid project_id: {user.project_id}"
                )
                return jsonify({"error": "Invalid project assignment"}), 403

            if not project.is_active:
                logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} accessing inactive project: {project.id}"
                )
                return jsonify({"error": "Project is inactive"}), 403

            g.project_id = user.project_id
            g.current_user = user
            g.current_project = project

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user
            if "current_project" in sig.parameters and "current_project" not in kwargs:
                kwargs["current_project"] = project
            if "project_id" in sig.parameters and "project_id" not in kwargs:
                kwargs["project_id"] = user.project_id

            return f(*args, **kwargs)
        except Exception as e:
            logger.error(
                f"🔒 require_project_isolation - Exception: {str(e)}, cookies: {list(request.cookies.keys()) if request.cookies else 'none'}"
            )
            import traceback

            logger.error(f"🔒 require_project_isolation - Traceback: {traceback.format_exc()}")
            return jsonify({"error": "Authentication required"}), 401

    return decorated_function

def validate_project_access(resource_id=None, resource_model=None):
    """
    SECURITY DECORATOR: Validates that a resource belongs to the user's project.

    Args:
        resource_id: The ID of the resource to validate (from URL parameter)
        resource_model: The SQLAlchemy model class to check

    Usage:
    @validate_project_access(resource_id='product_id', resource_model=Product)
    def get_product(product_id):

        pass
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, "project_id"):
                return jsonify({"error": "Project scope not set"}), 500

            if resource_id and resource_model:

                actual_resource_id = kwargs.get(resource_id)
                if actual_resource_id:

                    resource = resource_model.query.filter_by(
                        id=actual_resource_id, project_id=g.project_id
                    ).first()

                    if not resource:
                        logger.warning(
                            f"SECURITY_VIOLATION: Attempted access to {resource_model.__name__} {actual_resource_id} outside project {g.project_id}"
                        )
                        return jsonify({"error": "Resource not found or access denied"}), 404

            return f(*args, **kwargs)

        return decorated_function

    return decorator

def require_active_project(f):
    """Legacy alias for require_project_active"""
    return require_project_active(f)

def check_project_status(f):
    """
    Middleware to check if user's project is active (legacy compatibility)
    """
    import inspect

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:

            verify_jwt_in_request()
            user_id = get_jwt_identity()

            if not user_id:
                return jsonify({"error": "Invalid token"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 404

            if _is_owner_safe(user):

                g.current_user = user

                sig = inspect.signature(f)
                if "current_user" in sig.parameters and "current_user" not in kwargs:
                    kwargs["current_user"] = user

                return f(*args, **kwargs)

            if not user.project_id:
                return jsonify({"error": "User has no project"}), 403

            project = Project.query.get(user.project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404

            if not project.is_active:

                if project.status == "inactive":
                    error_message = "Project has been paused. Please contact the project owner to reactivate it."
                elif (
                    project.subscription_expires_at
                    and datetime.utcnow() > project.subscription_expires_at
                ):
                    error_message = "Project subscription has expired. Please contact the project owner to renew the subscription."
                else:
                    error_message = "Project is currently inactive"

                return (
                    jsonify(
                        {
                            "error": "Project Inactive",
                            "message": error_message,
                            "project_name": project.name,
                            "project_status": project.status,
                            "subscription_status": project.subscription_status_display,
                            "contact_owner": "Please contact the project owner for assistance.",
                        }
                    ),
                    403,
                )

            g.current_user = user
            g.current_project = project

            sig = inspect.signature(f)
            if "current_user" in sig.parameters and "current_user" not in kwargs:
                kwargs["current_user"] = user
            if "current_project" in sig.parameters and "current_project" not in kwargs:
                kwargs["current_project"] = project

            return f(*args, **kwargs)

        except Exception as e:

            return f(*args, **kwargs)

    return decorated_function

def get_current_user():
    """Helper function to get current user from request context"""
    return getattr(g, "current_user", None)

def get_current_project():
    """Helper function to get current project from request context"""
    return getattr(g, "current_project", None)

def get_project_id():
    """Helper function to get project ID from request context"""
    return getattr(g, "project_id", None)

def check_permission_in_route(permission):
    """
    Helper function to check permission within a route

    Usage:
    def some_route():
        if not check_permission_in_route('users.create'):
            return jsonify({'error': 'Insufficient permissions'}), 403

    """
    current_user = get_current_user()
    if not current_user:
        return False

    return RBACManager.has_permission(current_user.id, current_user.project_id, permission)

def get_user_permissions_in_route():
    """
    Helper function to get all user permissions within a route

    Usage:
    def some_route():
        permissions = get_user_permissions_in_route()
        if 'users.create' in permissions:

    """
    current_user = get_current_user()
    if not current_user:
        return set()

    return set(RBACManager.get_user_permissions(current_user.id, current_user.project_id))
