"""
Automatic Query Isolation for Project-based Data Separation

This module implements automatic project_id filtering at the SQLAlchemy Query level
using the do_orm_execute event. This provides stronger security guarantees than
decorator-based approaches, as it ensures ALL queries are automatically filtered
by project_id when a project context is set.

Key Features:
- Automatic filtering via SQLAlchemy do_orm_execute event (SQLAlchemy 1.4+)
- Works with all query types (SELECT, UPDATE, DELETE)
- Supports opt-out mechanism for system queries
- Thread-safe using Flask's g object
- Excludes models without project_id field
- Excludes system models (Project, User, SystemSettings, etc.)

Usage:
    from ..utils.query_isolation import init_query_isolation, disable_project_isolation
from ...utils.service_helpers import get_service
    
    # In app initialization:
    init_query_isolation(app)

    # To temporarily disable filtering (for admin/system queries):
    # SECURITY: Must provide reason and require owner permission by default
    with disable_project_isolation(reason="System admin query for all projects"):
        all_projects = Project.query.all()
"""

import logging
from contextlib import contextmanager
from typing import Optional, Set

from flask import g, has_request_context
from sqlalchemy import event, select
from sqlalchemy.orm import Query, Session
from sqlalchemy.orm.session import ORMExecuteState

logger = logging.getLogger(__name__)



SYSTEM_MODELS: Set[str] = {
    "Project",
    "User",
    "SystemSettings",
    "APIKey",
    "SystemBackup",
    "ProjectInviteCode",
}



PROJECT_SCOPED_MODELS: Set[str] = {
    "Key",
    "Product",
    "Server",
    "Webhook",
    "UserActivity",
    "UserActionLog",
    "ProjectEncryptionKeys",
    "ProjectSecuritySettings",
    "ProjectSystemSettings",
    "ProjectEncryptionSettings",
    "ProjectBackupSettings",
    "ProjectChatSettings",
    "ProjectOfflineAuthSettings",
    "ProjectAppearanceSettings",
    "ProjectInviteSettings",
    "ProjectSettings",
    "UserProductPermission",
    "DeveloperProductPermission",
    "ProjectUserRole",
    "ProjectAdmin",
    "RemoteCategory",
    "RemoteFeature",
    "RemoteFeatureLog",
    "Billing",
    "ProjectAPIKey",
    "KeyAnalytics",
    "Agent",
    "Changelog",
    "Notification",
    "ChatMessage",
    "TwoFactorAuth",
    "TwoFactorSession",
    "TwoFactorBackupCode",
    "LoginAttempt",
    "Session",
    "SecurityLog",
}


def _get_model_from_statement(statement, execute_state=None):
    """
    Extract model class from SQLAlchemy statement (Select, Update, Delete).
    
    Args:
        statement: SQLAlchemy statement object
        execute_state: Optional ORMExecuteState for additional context
        
    Returns:
        Model class or None if cannot be determined
    """
    try:

        if execute_state and hasattr(execute_state, "select_statement"):
            select_stmt = execute_state.select_statement
            if select_stmt is not None:

                if hasattr(select_stmt, "froms") and select_stmt.froms:
                    from_clause = select_stmt.froms[0]

                    if hasattr(from_clause, "entity_namespace"):
                        return from_clause.entity_namespace
                    elif hasattr(from_clause, "class_"):
                        return from_clause.class_
                    elif hasattr(from_clause, "__entity_namespace__"):
                        return from_clause.__entity_namespace__
        

        if isinstance(statement, select):

            if hasattr(statement, "froms") and statement.froms:
                from_clause = statement.froms[0]

                if hasattr(from_clause, "entity_namespace"):
                    return from_clause.entity_namespace
                elif hasattr(from_clause, "class_"):
                    return from_clause.class_
                elif hasattr(from_clause, "__entity_namespace__"):
                    return from_clause.__entity_namespace__

                elif hasattr(from_clause, "mapper"):
                    mapper = from_clause.mapper
                    if mapper and hasattr(mapper, "class_"):
                        return mapper.class_
        

        if hasattr(statement, "table"):
            table = statement.table
            if hasattr(table, "entity_namespace"):
                return table.entity_namespace
            elif hasattr(table, "class_"):
                return table.class_
            elif hasattr(table, "mapper"):
                mapper = table.mapper
                if mapper and hasattr(mapper, "class_"):
                    return mapper.class_
        

        if hasattr(statement, "column_descriptions"):
            for desc in statement.column_descriptions:
                entity = desc.get("entity")
                if entity:
                    return entity.class_ if hasattr(entity, "class_") else entity
    except Exception as e:
        logger.debug(f"Error extracting model from statement: {e}")
    
    return None


def _has_project_id_in_statement(statement) -> bool:
    """
    Check if statement already has a project_id filter.
    
    Args:
        statement: SQLAlchemy statement object
        
    Returns:
        True if project_id filter appears to be present
    """
    try:

        statement_str = str(statement)
        if "project_id" in statement_str.lower():
            return True
        

        if hasattr(statement, "whereclause") and statement.whereclause is not None:
            where_str = str(statement.whereclause)
            if "project_id" in where_str.lower():
                return True
    except Exception:
        pass
    
    return False


def _apply_project_isolation_to_statement(statement, project_id: int, execute_state=None):
    """
    Apply project_id filter to a SQLAlchemy statement.
    
    This function modifies the statement by adding a WHERE clause
    that filters by project_id.
    
    Args:
        statement: SQLAlchemy statement (Select, Update, Delete)
        project_id: The project_id to filter by
        execute_state: Optional ORMExecuteState for additional context
        
    Returns:
        Modified statement with project_id filter
    """
    try:

        model_class = _get_model_from_statement(statement, execute_state)
        if not model_class:
            return statement
        

        model_name = model_class.__name__
        if model_name in SYSTEM_MODELS:
            logger.debug(
                f"Skipping project isolation for system model: {model_name}"
            )
            return statement
        

        if not hasattr(model_class, "project_id"):

            if model_name in PROJECT_SCOPED_MODELS:
                logger.warning(
                    f"Model {model_name} is expected to have project_id but doesn't. "
                    f"This may indicate a schema mismatch."
                )
            return statement
        

        if _has_project_id_in_statement(statement):
            logger.debug(
                f"Statement for {model_class.__name__} already has project_id filter, skipping"
            )
            return statement
        

        project_id_column = getattr(model_class, "project_id")
        

        filter_condition = project_id_column == project_id
        


        if isinstance(statement, select):


            statement = statement.where(filter_condition)
        elif hasattr(statement, "where"):

            statement = statement.where(filter_condition)
        else:

            logger.warning(
                f"Cannot apply project isolation filter to statement type: {type(statement)}"
            )
            return statement
        
        logger.debug(
            f"Applied automatic project isolation filter (project_id={project_id}) "
            f"to statement for {model_class.__name__}"
        )
    except Exception as e:

        logger.error(
            f"Error applying project isolation filter: {e}",
            exc_info=True
        )
    
    return statement


@event.listens_for(Session, "do_orm_execute")
def _do_orm_execute(execute_state: ORMExecuteState):
    """
    SQLAlchemy event listener that applies project isolation before query execution.
    
    This is called automatically by SQLAlchemy before any ORM query is executed.
    We modify the statement to add project_id filtering if appropriate.
    
    This is the modern approach (SQLAlchemy 1.4+) and works with all query types.
    
    Args:
        execute_state: ORMExecuteState object containing the statement to execute
    """

    if not execute_state.is_select and not execute_state.is_update and not execute_state.is_delete:
        return
    

    if not has_request_context():
        return
    
    if getattr(g, "disable_project_isolation", False):
        return
    
    project_id = getattr(g, "project_id", None)
    if project_id is None:
        return
    
    try:

        statement = execute_state.statement
        

        modified_statement = _apply_project_isolation_to_statement(statement, project_id, execute_state)
        

        if modified_statement is not statement:
            execute_state.statement = modified_statement
    except Exception as e:

        logger.error(f"Error in query isolation do_orm_execute: {e}", exc_info=True)


def init_query_isolation(app) -> None:
    """
    Initialize automatic query isolation for the Flask product.
    
    This sets up SQLAlchemy event listeners that automatically filter
    all queries by project_id when a project context is available.
    
    Args:
        app: Flask product instance
    """


    logger.info(
        "Automatic query isolation initialized",
        component="query_isolation",
        system_models=len(SYSTEM_MODELS),
        project_scoped_models=len(PROJECT_SCOPED_MODELS),
    )


@contextmanager
def disable_project_isolation(reason: Optional[str] = None, require_owner: bool = True):
    """
    Context manager to temporarily disable project isolation.
    
    SECURITY WARNING: This function disables automatic project isolation filtering,
    # Get service through app context (DI pattern) - requires app context
    from flask import current_app
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. Cannot get 'rbac_service'. "
            "Make sure init_services() was called during app initialization."
        )
    rbac_service = current_app.service_container.get('rbac_service')
    which can lead to data leakage between projects if used incorrectly.
    
    SECURITY REQUIREMENTS:
    - Should only be used by system administrators/owners
    - Must be used with explicit reason for audit trail
    - Should only be used for system models (Project, User, SystemSettings, etc.)
    - Never use for project-scoped models (Key, Product, Server, etc.)
    
    Args:
        reason: REQUIRED reason for disabling isolation (for audit trail)
        require_owner: If True, requires owner role to use (default: True)
    
    Raises:
        PermissionError: If require_owner=True and user is not owner
        ValueError: If reason is not provided
    
    Example:
        with disable_project_isolation(reason="System admin query for all projects"):
            all_projects = Project.query.all()
    """
    import traceback
    from flask import request
    

    if not reason:
        raise ValueError(
            "disable_project_isolation() requires 'reason' parameter for security audit. "
            "This helps track when and why project isolation is disabled."
        )
    
    if not has_request_context():


        logger.warning(
            f"[SECURITY_AUDIT] disable_project_isolation() called outside request context. "
            f"Reason: {reason}"
        )
        yield
        return
    

    if require_owner:
        try:
            from flask_jwt_extended import get_jwt_identity
            from ..models.core import User
            
            user_id = get_jwt_identity()
            if user_id:
                user = User.query.get(user_id)
                if user:
                    is_owner = rbac_service.check_permission(user.id, "system.manage_all_projects")
                    if not is_owner:
                        logger.error(
                            f"[SECURITY_VIOLATION] Non-owner user {user.username} (ID: {user.id}) "
                            f"attempted to disable project isolation. Reason: {reason}. "
                            f"IP: {request.remote_addr if request else 'N/A'}"
                        )
                        raise PermissionError(
                            "Only system owners can disable project isolation. "
                            "This is a security-critical operation."
                        )
        except (ImportError, AttributeError, Exception) as e:

            logger.warning(
                f"[SECURITY_AUDIT] Could not verify owner permission for disable_project_isolation: {e}"
            )
    

    user_info = "unknown"
    project_id = getattr(g, "project_id", None)
    try:
        from flask_jwt_extended import get_jwt_identity
        user_id = get_jwt_identity()
        if user_id:
            from ..models.core import User
            user = User.query.get(user_id)
            if user:
                user_info = f"{user.username} (ID: {user.id})"
    except Exception:
        pass
    

    logger.warning(
        f"[SECURITY_AUDIT] Project isolation DISABLED by {user_info}. "
        f"Reason: {reason}. "
        f"Current project_id: {project_id}. "
        f"IP: {request.remote_addr if request else 'N/A'}. "
        f"Stack trace: {traceback.format_stack()[-3:-1]}"
    )
    
    old_value = getattr(g, "disable_project_isolation", False)
    old_reason = getattr(g, "disable_project_isolation_reason", None)
    g.disable_project_isolation = True
    g.disable_project_isolation_reason = reason
    g.disable_project_isolation_user = user_info
    
    try:
        yield
    finally:

        logger.warning(
            f"[SECURITY_AUDIT] Project isolation RE-ENABLED by {user_info}. "
            f"Reason was: {reason}"
        )
        g.disable_project_isolation = old_value
        g.disable_project_isolation_reason = old_reason
        if hasattr(g, "disable_project_isolation_user"):
            delattr(g, "disable_project_isolation_user")


def get_current_project_id() -> Optional[int]:
    """
    Get the current project_id from Flask's g object.
    
    This is a convenience function that can be used to check
    if project isolation is active.
    
    Returns:
        Current project_id or None if not set
    """
    if not has_request_context():
        return None
    return getattr(g, "project_id", None)

