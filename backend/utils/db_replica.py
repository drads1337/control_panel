"""
Database replica routing utility using native SQLAlchemy binds

This module provides functionality to route database queries to read replicas
using SQLAlchemy's native binds mechanism, which is more reliable than manual
session management and properly handles transactions.

Usage:
    from ..utils.db_replica import get_read_session, get_write_session

    with get_read_session() as session:
        users = session.query(User).filter_by(project_id=1).all()

    with get_write_session() as session:
        user = User(username='test')
        session.add(user)
        session.commit()

Note: This implementation uses SQLAlchemy's native binds mechanism, which is
recommended over manual engine management. The binds are configured in
config.py via SQLALCHEMY_BINDS.
"""

import logging
from contextlib import contextmanager
from typing import Optional

from flask import current_app, has_request_context
from sqlalchemy import event

from ..core.extensions import db

logger = logging.getLogger(__name__)

def init_replica_binds(app):
    """
    Initialize read replica bind configuration using native SQLAlchemy binds.
    This sets up read-only mode for the read replica connection.
    
    Called during product initialization.
    The engine is created by the custom Database class in extensions.py
    which applies engine options from configuration.
    """
    read_replica_url = app.config.get("SQLALCHEMY_DATABASE_READ_URI")
    
    if read_replica_url:
        # Configure bind in SQLALCHEMY_BINDS (already set in config.py)
        if 'read' not in app.config.get("SQLALCHEMY_BINDS", {}):
            logger.warning("Read replica URL configured but not in SQLALCHEMY_BINDS")
            return
        
        try:
            # Get the read engine (created by custom Database.get_engine)
            read_engine = db.get_engine(app, bind='read')
            
            # Set up read-only mode event listener
            @event.listens_for(read_engine, "connect")
            def set_readonly_pragma(dbapi_conn, connection_record):
                """Set read-only mode for read replica connections"""
                try:
                    cursor = dbapi_conn.cursor()
                    cursor.execute("SET default_transaction_read_only = on")
                    cursor.close()
                except Exception as e:
                    logger.warning(f"Could not set read-only mode: {e}")
            
            logger.info("✅ Read replica bind initialized successfully using native SQLAlchemy binds")
        except Exception as e:
            logger.error(f"Failed to initialize read replica bind: {e}")
            logger.warning("Falling back to primary database for all operations")
    else:
        logger.info("Read replica not configured, using primary database for all operations")

def is_read_request() -> bool:
    """
    Determine if the current request is read-only (GET).

    Returns:
        True if this is a GET request, False for POST/PUT/DELETE
    """
    if not has_request_context():
        return False

    from flask import request

    return request.method in ("GET", "HEAD", "OPTIONS")

def has_read_replica() -> bool:
    """
    Check if read replica is configured.

    Returns:
        True if read replica is available, False otherwise
    """
    if not has_request_context():
        return False
    
    app = current_app
    binds = app.config.get("SQLALCHEMY_BINDS", {})
    return 'read' in binds and binds['read'] is not None

@contextmanager
def get_read_session(force_primary: bool = False):
    """
    Get a session for read operations.
    Automatically routes queries to read replica if available.

    Args:
        force_primary: If True, forces use of primary DB even if replica is available

    Yields:
        SQLAlchemy Session for read operations
    """
    if not has_read_replica() or force_primary:
        # Use default session (primary database)
        yield db.session
        return
    
    # Use read replica bind
    try:
        # Create a session bound to the read replica
        # Flask-SQLAlchemy's db.session uses scoped_session, so we need to
        # create a new session with the read bind
        from sqlalchemy.orm import sessionmaker
        
        read_engine = db.get_engine(current_app, bind='read')
        Session = sessionmaker(bind=read_engine)
        session = Session()
        
        try:
            yield session
        except Exception as e:
            session.rollback()
            logger.error(f"Error in read session: {e}")
            raise
        finally:
            session.close()
    except Exception as e:
        logger.error(f"Failed to get read session, falling back to primary: {e}")
        # Fallback to primary database
        yield db.session

@contextmanager
def get_write_session():
    """
    Get a session for write operations (INSERT, UPDATE, DELETE).
    Always uses primary database.

    Yields:
        SQLAlchemy Session for write operations
    """
    # Always use default session (primary database)
    yield db.session

def get_session_for_query(is_read: Optional[bool] = None):
    """
    Get appropriate session for query.

    Args:
        is_read: If None, automatically determined based on HTTP method.
                 If True - read operation, False - write operation.

    Returns:
        Context manager for database session
    """
    if is_read is None:
        is_read = is_read_request()

    if is_read:
        return get_read_session()
    else:
        return get_write_session()

def check_replica_health() -> dict:
    """
    Check read replica health status.

    SECURITY NOTE: All SQL queries in this function use hardcoded constants
    and PostgreSQL system functions. No user input is used in SQL construction.
    All queries are safe from SQL injection.

    Returns:
        Dictionary with replica health information
    """
    result = {
        "read_replica_configured": has_read_replica(),
        "read_replica_available": False,
        "primary_available": False,
        "read_replica_lag": None,
    }

    try:
        with get_write_session() as session:
            from sqlalchemy import text

            session.execute(text("SELECT 1"))
            result["primary_available"] = True
    except Exception as e:
        logger.error(f"Primary database check failed: {e}")
        result["primary_error"] = str(e)

    if has_read_replica():
        try:
            with get_read_session() as session:
                from sqlalchemy import text

                session.execute(text("SELECT 1"))
                result["read_replica_available"] = True

                try:
                    # Check replication lag (PostgreSQL specific)
                    lag_result = session.execute(
                        text(
                            """
                            SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as lag_seconds
                            """
                        )
                    ).fetchone()
                    if lag_result:
                        result["read_replica_lag"] = lag_result[0]
                except Exception:
                    # Replication lag check may fail on non-replica setups
                    pass

        except Exception as e:
            logger.error(f"Read replica check failed: {e}")
            result["read_replica_error"] = str(e)

    return result
