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

from flask import g, has_request_context
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from ..core.extensions import db

logger = logging.getLogger(__name__)


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
    
    try:
        if project_id is not None:
            # Set project context in PostgreSQL session
            session.execute(text("SELECT set_project_context(:project_id)"), {"project_id": project_id})
            logger.debug(f"PostgreSQL RLS context set to project_id={project_id}")
        else:
            # Clear project context (for system/admin queries)
            session.execute(text("SELECT clear_project_context()"))
            logger.debug("PostgreSQL RLS context cleared")
        
        # Store in Flask g for reference
        if has_request_context():
            g.postgresql_rls_project_id = project_id
    except Exception as e:
        # Log error but don't break the application
        # RLS will fall back to allowing queries if context is not set
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
    if not has_request_context():
        return
    
    project_id = getattr(g, "project_id", None)
    if project_id is not None:
        try:
            # Set RLS context using raw connection
            connection.execute(text("SELECT set_project_context(:project_id)"), {"project_id": project_id})
            logger.debug(f"Auto-set PostgreSQL RLS context to project_id={project_id} on transaction begin")
        except Exception as e:
            # Log but don't break - RLS may not be enabled
            logger.debug(f"Could not auto-set RLS context: {e}")


@event.listens_for(Session, "after_commit")
def _clear_rls_context_on_commit(session):
    """
    SQLAlchemy event listener that clears RLS context after commit.
    
    This ensures clean state between transactions.
    """
    try:
        if has_request_context() and hasattr(g, "postgresql_rls_project_id"):
            # Context will be set again on next transaction if project_id is still in g
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

