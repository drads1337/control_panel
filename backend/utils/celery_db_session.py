"""
Database session management for Celery tasks.

This module provides a context manager for database sessions in Celery tasks,
ensuring that sessions are properly closed even in case of exceptions or worker crashes.

SECURITY: This module uses a separate database engine for Celery tasks to avoid
conflicts with Flask's request-scoped sessions and to prevent connection leaks.

Usage:
    from backend.utils.celery_db_session import celery_db_session
    
    @celery_app.task
    def my_task():
        with celery_db_session() as session:
            user = session.query(User).get(user_id)
            session.commit()
        # Session is automatically closed here
"""

import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event, pool
from sqlalchemy.orm import sessionmaker, Session

from ..config.config import Config

logger = logging.getLogger(__name__)

# Global engine and session factory for Celery tasks
_celery_db_engine = None
_CelerySession = None


def get_celery_db_engine():
    """
    Get or create database engine for Celery tasks.
    
    This engine is separate from Flask's request-scoped engine to avoid
    conflicts and connection leaks.
    
    Returns:
        SQLAlchemy Engine instance
    """
    global _celery_db_engine
    if _celery_db_engine is None:
        _celery_db_engine = create_engine(
            Config.SQLALCHEMY_DATABASE_URI,
            pool_pre_ping=True,  # Verify connections before using
            pool_recycle=3600,   # Recycle connections every hour
            pool_size=10,        # Maximum number of connections in pool
            max_overflow=20,     # Maximum overflow connections
            echo=False,          # Set to True for SQL query logging
        )
        
        # Add event listeners for connection monitoring
        _setup_connection_monitoring(_celery_db_engine)
        
        logger.info("Celery database engine initialized")
    
    return _celery_db_engine


def get_celery_session_factory():
    """
    Get or create session factory for Celery tasks.
    
    Returns:
        sessionmaker instance
    """
    global _CelerySession
    if _CelerySession is None:
        engine = get_celery_db_engine()
        _CelerySession = sessionmaker(bind=engine)
        logger.info("Celery session factory initialized")
    
    return _CelerySession


def _setup_connection_monitoring(engine):
    """
    Setup event listeners for monitoring database connections.
    
    This helps detect connection leaks and monitor pool usage.
    """
    @event.listens_for(engine.pool, "connect")
    def receive_connect(dbapi_conn, connection_record):
        """Log new database connections"""
        logger.debug(f"[DB_POOL] New connection created: {id(dbapi_conn)}")
    
    @event.listens_for(engine.pool, "checkout")
    def receive_checkout(dbapi_conn, connection_record, connection_proxy):
        """Log connection checkout"""
        logger.debug(f"[DB_POOL] Connection checked out: {id(dbapi_conn)}")
    
    @event.listens_for(engine.pool, "checkin")
    def receive_checkin(dbapi_conn, connection_record):
        """Log connection checkin"""
        logger.debug(f"[DB_POOL] Connection checked in: {id(dbapi_conn)}")
    
    @event.listens_for(engine.pool, "invalidate")
    def receive_invalidate(dbapi_conn, connection_record, exception):
        """Log invalidated connections"""
        logger.warning(
            f"[DB_POOL] Connection invalidated: {id(dbapi_conn)}, "
            f"exception: {exception}"
        )
    
    @event.listens_for(engine.pool, "soft_invalidate")
    def receive_soft_invalidate(dbapi_conn, connection_record, exception):
        """Log soft-invalidated connections"""
        logger.warning(
            f"[DB_POOL] Connection soft-invalidated: {id(dbapi_conn)}, "
            f"exception: {exception}"
        )


@contextmanager
def celery_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions in Celery tasks.
    
    This context manager ensures that:
    1. Sessions are properly closed even if exceptions occur
    2. Transactions are committed on success or rolled back on error
    3. Connection leaks are prevented
    
    Usage:
        with celery_db_session() as session:
            user = session.query(User).get(user_id)
            user.name = "New Name"
            session.commit()
        # Session is automatically closed here
    
    Yields:
        SQLAlchemy Session instance
        
    Raises:
        Any exception that occurs during the transaction will be raised
        after rolling back the transaction.
    """
    Session = get_celery_session_factory()
    session = Session()
    
    try:
        yield session
        session.commit()
        logger.debug("[CELERY_DB] Transaction committed successfully")
    except Exception as e:
        session.rollback()
        logger.error(f"[CELERY_DB] Transaction rolled back due to error: {e}")
        raise
    finally:
        session.close()
        logger.debug("[CELERY_DB] Session closed")


def get_pool_stats() -> dict:
    """
    Get statistics about the database connection pool.
    
    This is useful for monitoring connection usage and detecting leaks.
    
    Returns:
        Dictionary with pool statistics:
        - size: Current pool size
        - checked_in: Number of checked-in connections
        - checked_out: Number of checked-out connections
        - overflow: Number of overflow connections
        - invalid: Number of invalid connections
    """
    if _celery_db_engine is None:
        return {"error": "Engine not initialized"}
    
    pool_instance = _celery_db_engine.pool
    return {
        "size": pool_instance.size(),
        "checked_in": pool_instance.checkedin(),
        "checked_out": pool_instance.checkedout(),
        "overflow": pool_instance.overflow(),
        "invalid": pool_instance.invalid(),
    }

