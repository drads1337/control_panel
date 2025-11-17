"""
Isolation Utilities
Utility functions for ensuring proper project_id isolation across the application
"""

import logging
from typing import Any, Dict, List, Optional

from flask import g, request
from sqlalchemy.orm import Query

from ..models.core import Project, User
from ..utils.rbac_utils import RBACManager


def get_current_project_id() -> Optional[int]:
    """
    Get the current project_id from Flask's g object.
    Returns None if not set.
    
    DEPRECATED: This function creates implicit dependencies and makes code harder to test.
    Prefer explicit project_id parameter passing.
    
    This function is kept for backward compatibility only.
    """
    return getattr(g, "project_id", None)


def get_current_user() -> Optional[User]:
    """
    Get the current user from Flask's g object.
    Returns None if not set.
    
    DEPRECATED: This function creates implicit dependencies and makes code harder to test.
    Prefer explicit current_user parameter passing (typically via kwargs from middleware decorators).
    
    This function is kept for backward compatibility only.
    """
    return getattr(g, "current_user", None)


def get_current_project() -> Optional[Project]:
    """
    Get the current project from Flask's g object.
    Returns None if not set.
    
    DEPRECATED: This function creates implicit dependencies and makes code harder to test.
    Prefer explicit current_project parameter passing (typically via kwargs from middleware decorators).
    
    This function is kept for backward compatibility only.
    """
    return getattr(g, "current_project", None)


def validate_project_id(project_id: int) -> bool:
    """
    Validate that a project_id exists and is active.

    Args:
        project_id: The project ID to validate

    Returns:
        bool: True if valid and active, False otherwise
    """
    if not project_id:
        return False

    project = Project.query.get(project_id)
    if not project:
        logging.warning(f"SECURITY_VIOLATION: Invalid project_id: {project_id}")
        return False

    if not project.is_active:
        logging.warning(f"SECURITY_VIOLATION: Inactive project_id: {project_id}")
        return False

    return True


def ensure_project_isolation(
    query: Query, model_class: Any, project_id: Optional[int] = None
) -> Query:
    """
    Ensure a database query is properly isolated by project_id.

    Args:
        query: The SQLAlchemy query to modify
        model_class: The model class being queried
        project_id: REQUIRED project_id to use. 
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        Query: The modified query with project_id filter

    Raises:
        ValueError: If no project_id is available
    """
    if project_id is None:
        # DEPRECATED: Fallback to g.project_id for backward compatibility
        # This creates implicit dependencies and should be avoided
        logging.warning(
            "ensure_project_isolation called without explicit project_id. "
            "This creates implicit dependencies. Pass project_id explicitly."
        )
        project_id = get_current_project_id()

    if not project_id:
        logging.error("SECURITY_VIOLATION: No project_id available for query isolation")
        raise ValueError("No project_id available for query isolation")

    # Check if the model has project_id field
    if hasattr(model_class, "project_id"):
        return query.filter(model_class.project_id == project_id)
    else:
        logging.warning(f"Model {model_class.__name__} does not have project_id field")
        return query


def log_isolation_violation(user_id: int, action: str, details: str = ""):
    """
    Log a potential isolation violation for security monitoring.

    Args:
        user_id: ID of the user who triggered the violation
        action: The action that was attempted
        details: Additional details about the violation
    """
    logging.warning(
        f"SECURITY_VIOLATION: User {user_id} attempted {action} without proper project isolation. "
        f"Details: {details}. IP: {request.remote_addr if request else 'unknown'}"
    )


def check_cross_project_access(user: User, target_project_id: int) -> bool:
    """
    Check if a user can access data from a different project.

    Args:
        user: The user attempting access
        target_project_id: The project ID being accessed

    Returns:
        bool: True if access is allowed, False otherwise
    """
    # Owner can access any project
    if RBACManager.user_has_role(user, "owner"):
        return True

    # Other users can only access their own project
    if user.project_id == target_project_id:
        return True

    # Log the violation
    log_isolation_violation(
        user.id,
        f"cross_project_access",
        f"Attempted to access project {target_project_id} from project {user.project_id}",
    )

    return False


def get_project_scope_for_user(user: User) -> Optional[int]:
    """
    Get the project scope for a user based on their role and permissions.

    Args:
        user: The user to get scope for

    Returns:
        int: The project_id the user can access, or None if no access
    """
    if not user:
        return None

    # All users must have a project_id
    if not user.project_id:
        logging.warning(f"SECURITY_VIOLATION: User {user.username} has no project_id")
        return None

    # Validate the project exists and is active
    if not validate_project_id(user.project_id):
        return None

    return user.project_id


def create_isolated_query(model_class: Any, project_id: Optional[int] = None) -> Query:
    """
    Create a new query that is automatically isolated by project_id.

    Args:
        model_class: The SQLAlchemy model class to query
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        Query: A new query filtered by project_id

    Raises:
        ValueError: If no project_id is available and model requires it
    """
    if project_id is None:
        # DEPRECATED: Fallback to g.project_id for backward compatibility
        # This creates implicit dependencies and should be avoided
        logging.warning(
            "create_isolated_query called without explicit project_id. "
            "This creates implicit dependencies. Pass project_id explicitly."
        )
        project_id = get_current_project_id()

    if not project_id:
        if hasattr(model_class, "project_id"):
            raise ValueError("No project_id available for query isolation")
        else:
            # Model doesn't require project isolation
            return model_class.query

    # Check if the model has project_id field
    if hasattr(model_class, "project_id"):
        return model_class.query.filter(model_class.project_id == project_id)
    else:
        logging.warning(f"Model {model_class.__name__} does not have project_id field")
        return model_class.query


def validate_resource_access(
    resource_id: int, model_class: Any, project_id: Optional[int] = None
) -> bool:
    """
    Validate that a resource belongs to the specified project.

    Args:
        resource_id: ID of the resource to validate
        model_class: The SQLAlchemy model class
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        bool: True if resource belongs to project, False otherwise
    """
    if project_id is None:
        # DEPRECATED: Fallback to g.project_id for backward compatibility
        logging.warning(
            "validate_resource_access called without explicit project_id. "
            "This creates implicit dependencies. Pass project_id explicitly."
        )
        project_id = get_current_project_id()

    if not project_id:
        logging.warning(f"SECURITY_VIOLATION: No project_id available for resource validation")
        return False

    # Check if the model has project_id field
    if not hasattr(model_class, "project_id"):
        logging.warning(f"Model {model_class.__name__} does not have project_id field")
        return True  # Can't validate, assume OK

    resource = model_class.query.filter_by(id=resource_id, project_id=project_id).first()

    if not resource:
        logging.warning(
            f"SECURITY_VIOLATION: Resource {model_class.__name__} {resource_id} "
            f"not found in project {project_id}"
        )
        return False

    return True


def get_project_statistics(project_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Get statistics for a project (for monitoring and validation).

    Args:
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        Dict: Statistics about the project
    """
    if project_id is None:
        # DEPRECATED: Fallback to g.project_id for backward compatibility
        logging.warning(
            "get_project_statistics called without explicit project_id. "
            "This creates implicit dependencies. Pass project_id explicitly."
        )
        project_id = get_current_project_id()

    if not project_id:
        return {}

    project = Project.query.get(project_id)
    if not project:
        return {}

    from ..models.core import User, UserActivity
    from ..models.games import Game
    from ..models.keys import Key
    from ..utils.rbac_utils import RBACManager

    stats = {
        "project_id": project_id,
        "project_name": project.name,
        "is_active": project.is_active,
        "user_count": User.query.filter_by(project_id=project_id).count(),
        "key_count": Key.query.filter_by(project_id=project_id).count(),
        "game_count": Game.query.filter_by(project_id=project_id).count(),
        "activity_count": UserActivity.query.filter_by(project_id=project_id).count(),
    }

    return stats


def validate_security_resource_access(
    resource_id: int, model_class: Any, project_id: Optional[int] = None
) -> bool:
    """
    Validate that a security resource belongs to the specified project.
    Specialized function for security-related models.

    Args:
        resource_id: ID of the security resource to validate
        model_class: The SQLAlchemy security model class (BlockedFingerprint, BlockedIP, etc.)
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        bool: True if resource belongs to project, False otherwise
    """
    if project_id is None:
        # DEPRECATED: Fallback to g.project_id for backward compatibility
        logging.warning(
            "validate_security_resource_access called without explicit project_id. "
            "This creates implicit dependencies. Pass project_id explicitly."
        )
        project_id = get_current_project_id()

    if not project_id:
        logging.warning(
            f"SECURITY_VIOLATION: No project_id available for security resource validation"
        )
        return False

    # Security models must have project_id field
    if not hasattr(model_class, "project_id"):
        logging.error(
            f"SECURITY_VIOLATION: Security model {model_class.__name__} does not have project_id field"
        )
        return False

    resource = model_class.query.filter_by(id=resource_id, project_id=project_id).first()

    if not resource:
        logging.warning(
            f"SECURITY_VIOLATION: Security resource {model_class.__name__} {resource_id} "
            f"not found in project {project_id}"
        )
        return False

    return True


def validate_security_rule_access(rule_id: int, project_id: Optional[int] = None) -> bool:
    """
    Validate that a security rule belongs to the specified project.

    Args:
        rule_id: ID of the security rule to validate
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        bool: True if rule belongs to project, False otherwise
    """
    from ..models.security import SecurityRule

    return validate_security_resource_access(rule_id, SecurityRule, project_id)


def validate_blocked_fingerprint_access(fp_id: int, project_id: Optional[int] = None) -> bool:
    """
    Validate that a blocked fingerprint belongs to the specified project.

    Args:
        fp_id: ID of the blocked fingerprint to validate
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        bool: True if fingerprint belongs to project, False otherwise
    """
    from ..models.security import BlockedFingerprint

    return validate_security_resource_access(fp_id, BlockedFingerprint, project_id)


def validate_blocked_ip_access(ip_id: int, project_id: Optional[int] = None) -> bool:
    """
    Validate that a blocked IP belongs to the specified project.

    Args:
        ip_id: ID of the blocked IP to validate
        project_id: REQUIRED project_id to use.
                   DEPRECATED: If None, falls back to get_current_project_id() (creates implicit dependencies).
                   Always pass project_id explicitly for better testability and clarity.

    Returns:
        bool: True if IP belongs to project, False otherwise
    """
    from ..models.security import BlockedIP

    return validate_security_resource_access(ip_id, BlockedIP, project_id)


def audit_project_isolation() -> List[Dict[str, Any]]:
    """
    Audit the current state of project isolation in the system.

    Returns:
        List: List of potential isolation issues found
    """
    issues = []

    # Check for users without project_id
    users_without_project = User.query.filter(User.project_id.is_(None)).all()
    for user in users_without_project:
        issues.append(
            {
                "type": "user_without_project",
                "user_id": user.id,
                "username": user.username,
                "severity": "high",
                "description": f"User {user.username} has no project_id",
            }
        )

    # Check for inactive projects with users
    inactive_projects = Project.query.filter_by(is_active=False).all()
    for project in inactive_projects:
        user_count = User.query.filter_by(project_id=project.id).count()
        if user_count > 0:
            issues.append(
                {
                    "type": "inactive_project_with_users",
                    "project_id": project.id,
                    "project_name": project.name,
                    "user_count": user_count,
                    "severity": "medium",
                    "description": f"Inactive project {project.name} has {user_count} users",
                }
            )

    return issues
