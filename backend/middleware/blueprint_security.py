"""
Blueprint-Level Security Middleware
Implements automatic project isolation enforcement at the blueprint level.

This middleware eliminates the need to manually add @require_project_isolation
decorator to every route, reducing the risk of IDOR vulnerabilities from forgotten decorators.

Architecture:
- Uses Flask's before_request hook at blueprint level
- Automatically enforces project isolation for all routes in protected blueprints
- Can be selectively disabled per route using @exempt_from_project_isolation
- Maintains backward compatibility with existing decorators

Usage:
    from backend.middleware.blueprint_security import apply_project_isolation_middleware
    
    # In blueprint definition
    keys_bp = Blueprint('keys', __name__)
    apply_project_isolation_middleware(keys_bp)
    
    # To exempt a specific route
    @keys_bp.route('/public')
    @exempt_from_project_isolation
    def public_endpoint():
        pass
"""

import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Set

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..core.extensions import db
from ..models.core import Project, User
from ..utils.rbac_utils import RBACManager

logger = logging.getLogger(__name__)


def _is_project_in_grace_period(project: Project) -> bool:
    """
    Check if project is in grace period (14 days after subscription expiration).
    
    Args:
        project: Project instance
        
    Returns:
        True if project is active or in grace period, False otherwise
    """
    if project.is_active:
        return True
    
    if not project.subscription_expires_at:
        return False
    
    now = datetime.utcnow()
    grace_period_end = project.subscription_expires_at + timedelta(days=14)
    
    # Project is in grace period if expired but not past grace period end
    return now > project.subscription_expires_at and now <= grace_period_end

# Registry of routes exempt from automatic project isolation
_exempt_routes: Set[str] = set()


def exempt_from_project_isolation(f):
    """
    Decorator to exempt a route from automatic project isolation enforcement.
    
    Use this for public endpoints, authentication endpoints, or routes that handle
    project isolation manually.
    
    Usage:
        @blueprint.route('/public')
        @exempt_from_project_isolation
        def public_endpoint():
            pass
    """
    _exempt_routes.add(f"{f.__module__}.{f.__name__}")
    return f


def apply_project_isolation_middleware(blueprint: Blueprint, require_grace_period: bool = False):
    """
    Apply automatic project isolation middleware to a blueprint.
    
    This middleware automatically enforces project isolation for all routes in the blueprint,
    eliminating the need to manually add @require_project_isolation to each route.
    
    Args:
        blueprint: Flask Blueprint to protect
        require_grace_period: If True, also requires project to be in grace period
        
    Usage:
        keys_bp = Blueprint('keys', __name__)
        apply_project_isolation_middleware(keys_bp, require_grace_period=True)
    """
    
    @blueprint.before_request
    def enforce_project_isolation():
        """
        Automatically enforce project isolation for all routes in this blueprint.
        
        This function runs before every request to routes in the blueprint.
        It performs the same checks as @require_project_isolation decorator.
        """
        # Skip if route is explicitly exempted
        if request.endpoint and f"{request.endpoint}" in _exempt_routes:
            logger.debug(f"Skipping project isolation for exempted route: {request.endpoint}")
            return None
        
        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return None
        
        # Skip if route is already protected by explicit decorator
        # (check if g.project_id is already set by a decorator)
        if hasattr(g, 'project_id') and g.project_id is not None:
            logger.debug(f"Project isolation already enforced by decorator for: {request.endpoint}")
            return None
        
        try:
            # Verify JWT token
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
            except RuntimeError as e:
                logger.error(
                    f"JWT context not available for {request.endpoint}: {str(e)}"
                )
                return (
                    jsonify({
                        "error": "JWT context not available",
                        "msg": "Please log in again. Authentication token may not be properly set.",
                    }),
                    401,
                )
            except Exception as jwt_error:
                logger.error(
                    f"JWT error for {request.endpoint}: {type(jwt_error).__name__}: {str(jwt_error)}"
                )
                # For auth endpoints, allow through (they handle auth themselves)
                if '/auth' in request.path or '/connect' in request.path:
                    return None
                raise
            
            if not user_id:
                logger.warning(f"No user_id in token for {request.endpoint}")
                # Allow auth endpoints through
                if '/auth' in request.path or '/connect' in request.path:
                    return None
                return jsonify({"error": "Invalid token", "msg": "No user ID found in token"}), 401
            
            # Get user
            user = User.query.get(user_id)
            if not user:
                logger.warning(f"User not found for user_id: {user_id} in {request.endpoint}")
                return jsonify({"error": "User not found"}), 404
            
            # Check if user is owner (owners can access without project_id)
            is_owner = RBACManager.is_owner(user)
            
            if not user.project_id and not is_owner:
                logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} (ID: {user.id}) has no project_id "
                    f"attempting to access {request.endpoint}"
                )
                return jsonify({"error": "User must be assigned to a project"}), 403
            
            # Handle owners without project_id (they can specify project_id in request)
            if is_owner and not user.project_id:
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
                
                # Set project_id from request if available
                g.project_id = owner_project_id
                g.current_user = user
                g.current_project = Project.query.get(owner_project_id) if owner_project_id else None
                
                # If grace period is required and project is specified, check it
                if require_grace_period and owner_project_id:
                    project = Project.query.get(owner_project_id)
                    if project and not _is_project_in_grace_period(project):
                        logger.warning(
                            f"SECURITY_VIOLATION: Owner attempting to access inactive project "
                            f"{owner_project_id} without grace period in {request.endpoint}"
                        )
                        return jsonify({"error": "Project is inactive and grace period expired"}), 403
                
                return None  # Allow request to proceed
            
            # For non-owners, require project_id
            project = Project.query.get(user.project_id)
            if not project:
                logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} has invalid project_id: {user.project_id} "
                    f"in {request.endpoint}"
                )
                return jsonify({"error": "Invalid project assignment"}), 403
            
            # Check if project is active (or in grace period if required)
            if require_grace_period:
                if not _is_project_in_grace_period(project):
                    logger.warning(
                        f"SECURITY_VIOLATION: User {user.username} accessing inactive project "
                        f"{project.id} without grace period in {request.endpoint}"
                    )
                    return jsonify({"error": "Project is inactive and grace period expired"}), 403
            else:
                if not project.is_active:
                    logger.warning(
                        f"SECURITY_VIOLATION: User {user.username} accessing inactive project "
                        f"{project.id} in {request.endpoint}"
                    )
                    return jsonify({"error": "Project is inactive"}), 403
            
            # Set project context
            g.project_id = user.project_id
            g.current_user = user
            g.current_project = project
            
            logger.debug(
                f"Project isolation enforced for {request.endpoint}: "
                f"user_id={user.id}, project_id={g.project_id}"
            )
            
        except Exception as e:
            logger.error(
                f"Error in project isolation middleware for {request.endpoint}: {str(e)}",
                exc_info=True
            )
            # For auth endpoints, allow through on error (they handle errors themselves)
            if '/auth' in request.path or '/connect' in request.path:
                return None
            return jsonify({"error": "Authentication required"}), 401
        
        return None  # Allow request to proceed

