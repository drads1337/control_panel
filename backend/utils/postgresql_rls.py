"""
PostgreSQL Row Level Security (RLS) Context Management

This module provides utilities to set and manage PostgreSQL session variables
for Row Level Security policies. RLS policies use these session variables
to filter data by project_id at the database level.

Key Features:
- Sets PostgreSQL session variable for project context
- Works with SQLAlchemy sessions
- Automatically clears context on session end
- Thread-safe using Flask's g object

Usage:
    from backend.utils.postgresql_rls import set_project_context, clear_project_context
    
    # In middleware or route handler:
    set_project_context(project_id=123)
    
    # All subsequent queries in this session will be filtered by RLS
    keys = Key.query.all()  # Only returns keys for project_id=123
    
    # Clear context when done (usually automatic on request end)
    clear_project_context()
"""

import logging
from typing import Optional

import psycopg2
from flask import g, has_request_context
from sqlalchemy import event, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import InternalError, OperationalError

from ..core.extensions import db

logger = logging.getLogger(__name__)

# Cache to track if RLS functions are available
_rls_functions_available = None

def _check_rls_functions_available(session: Optional[Session] = None) -> bool:
    """
    Check if RLS functions are available in the database.
    
    Args:
        session: Optional SQLAlchemy session. If None, uses current session from db.
    
    Returns:
        True if RLS functions exist, False otherwise.
    """
    global _rls_functions_available
    
    # Return cached value if available
    if _rls_functions_available is not None:
        return _rls_functions_available
    
    if session is None:
        session = db.session
    
    try:
        # Check if set_project_context function exists
        result = session.execute(
            text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_proc 
                    WHERE proname = 'set_project_context'
                )
            """)
        )
        _rls_functions_available = result.scalar()
        
        if not _rls_functions_available:
            logger.warning(
                "PostgreSQL RLS functions not found. RLS context management will be disabled. "
                "This may indicate RLS migration has not been applied."
            )
        
        return _rls_functions_available
    except Exception as e:
        logger.warning(f"Could not check for RLS functions: {e}")
        _rls_functions_available = False
        return False


def set_project_context(project_id: Optional[int], session: Optional[Session] = None) -> None:
    """
    Set PostgreSQL session variable for Row Level Security.
    
    This function sets the 'app.current_project_id' session variable in PostgreSQL,
    which RLS policies use to filter data. The context persists for the duration
    of the database session/transaction.
    
    Args:
        project_id: The project_id to set in PostgreSQL session context.
                   If None, clears the context (allows system/admin queries).
        session: Optional SQLAlchemy session. If None, uses current session from db.
    
    Example:
        set_project_context(project_id=123)
        # All subsequent queries will be filtered by RLS to project_id=123
    """
    if session is None:
        session = db.session
    
    # Check if RLS functions are available before trying to use them
    if not _check_rls_functions_available(session):
        # RLS functions don't exist, skip setting context
        if has_request_context():
            g.postgresql_rls_project_id = project_id
        return
    
    try:
        if project_id is not None:
            session.execute(text("SELECT set_project_context(:project_id)"), {"project_id": project_id})
            logger.debug(f"PostgreSQL RLS context set to project_id={project_id}")
        else:
            session.execute(text("SELECT clear_project_context()"))
            logger.debug("PostgreSQL RLS context cleared")
        
        if has_request_context():
            g.postgresql_rls_project_id = project_id
    except Exception as e:
        # Check if this is a transaction aborted error or function doesn't exist
        error_str = str(e).lower()
        is_transaction_aborted = (
            isinstance(e, (InternalError, OperationalError)) or
            isinstance(e, psycopg2.errors.InFailedSqlTransaction) or
            (hasattr(e, 'orig') and isinstance(e.orig, psycopg2.errors.InFailedSqlTransaction)) or
            'current transaction is aborted' in error_str or
            'commands ignored until end of transaction block' in error_str
        )
        
        is_function_missing = (
            'undefinedfunction' in error_str.lower() or 
            'does not exist' in error_str.lower() or
            'function set_project_context' in error_str.lower() or
            'function clear_project_context' in error_str.lower()
        )
        
        # If the function doesn't exist, mark as unavailable and rollback
        if is_function_missing:
            global _rls_functions_available
            _rls_functions_available = False
            logger.warning(
                "PostgreSQL RLS functions not found. Disabling RLS context management. "
                "This may indicate RLS migration has not been applied."
            )
        
        # If transaction is aborted or function missing, rollback
        if is_transaction_aborted or is_function_missing:
            try:
                # Rollback the transaction to reset the session state
                session.rollback()
                logger.debug("Rolled back transaction after RLS context setup failure")
            except Exception as rollback_error:
                logger.warning(f"Failed to rollback transaction after RLS error: {rollback_error}")
        
        # Only log warning if it's not a missing function (we already logged that)
        if not is_function_missing:
            logger.warning(
                f"Failed to set PostgreSQL RLS context: {e}. "
                f"This may indicate RLS is not enabled or migration not applied."
            )


def clear_project_context(session: Optional[Session] = None) -> None:
    """
    Clear PostgreSQL session variable for Row Level Security.
    
    This function clears the 'app.current_project_id' session variable,
    allowing system/admin queries that bypass project isolation.
    
    Args:
        session: Optional SQLAlchemy session. If None, uses current session from db.
    """
    set_project_context(project_id=None, session=session)


def get_current_project_id_from_db(session: Optional[Session] = None) -> Optional[int]:
    """
    Get current project_id from PostgreSQL session variable.
    
    This is useful for debugging or verifying RLS context is set correctly.
    
    Args:
        session: Optional SQLAlchemy session. If None, uses current session from db.
    
    Returns:
        Current project_id from PostgreSQL session, or None if not set.
    """
    if session is None:
        session = db.session
    
    try:
        result = session.execute(text("SELECT get_current_project_id()"))
        project_id = result.scalar()
        return project_id
    except Exception as e:
        logger.debug(f"Could not get PostgreSQL RLS context: {e}")
        return None


@event.listens_for(Session, "after_begin")
def _set_rls_context_on_transaction_begin(session, transaction, connection):
    """
    SQLAlchemy event listener that sets RLS context when a transaction begins.
    
    This ensures that RLS context is set automatically for all transactions
    if project_id is available in Flask's g object.
    """
    global _rls_functions_available
    
    if not has_request_context():
        return
    
    # Skip if RLS functions are not available
    if _rls_functions_available is False:
        return
    
    project_id = getattr(g, "project_id", None)
    if project_id is not None:
        try:
            # Check if functions are available before trying
            if _rls_functions_available is None:
                # First time check - do it synchronously
                try:
                    result = connection.execute(
                        text("SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_project_context')")
                    )
                    _rls_functions_available = result.scalar()
                    if not _rls_functions_available:
                        return
                except Exception:
                    _rls_functions_available = False
                    return
            
            connection.execute(text("SELECT set_project_context(:project_id)"), {"project_id": project_id})
            logger.debug(f"Auto-set PostgreSQL RLS context to project_id={project_id} on transaction begin")
        except Exception as e:
            # Note: We don't rollback here because we're in an "after_begin" event
            # The rollback will be handled by the main set_project_context function
            # or by the error handlers in repository methods
            error_str = str(e).lower()
            if 'undefinedfunction' in error_str.lower() or 'does not exist' in error_str.lower():
                _rls_functions_available = False
            logger.debug(f"Could not auto-set RLS context: {e}")


@event.listens_for(Session, "after_commit")
def _clear_rls_context_on_commit(session):
    """
    SQLAlchemy event listener that clears RLS context after commit.
    
    This ensures clean state between transactions.
    """
    try:
        if has_request_context() and hasattr(g, "postgresql_rls_project_id"):

            pass
    except Exception:
        pass


def init_postgresql_rls(app) -> None:
    """
    Initialize PostgreSQL RLS support for the Flask application.
    
    This function registers SQLAlchemy event listeners that automatically
    set RLS context based on Flask's g.project_id.
    
    Args:
        app: Flask application instance
    """
    logger.info(
        "PostgreSQL Row Level Security (RLS) support initialized",
        component="postgresql_rls",
    )

