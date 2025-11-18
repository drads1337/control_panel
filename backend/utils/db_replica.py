"""
Database replica routing utility

This module provides functionality to route database queries to read replicas
for GET requests, reducing load on the primary database.

Usage:
    from ..utils.db_replica import get_read_session, get_write_session

    with get_read_session() as session:
        users = session.query(User).filter_by(project_id=1).all()

    with get_write_session() as session:
        user = User(username='test')
        session.add(user)
        session.commit()
"""

import logging
from contextlib import contextmanager
from typing import Optional

from flask import current_app, has_request_context
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from ..core.extensions import db

logger = logging.getLogger(__name__)

_read_engine = None
_write_engine = None
_read_session_factory = None
_write_session_factory = None

def init_replica_engines(app):
    """
    Инициализирует engines для read и write операций.
    Вызывается при инициализации приложения.
    """
    global _read_engine, _write_engine, _read_session_factory, _write_session_factory

    _write_engine = db.engine

    read_replica_url = app.config.get("SQLALCHEMY_DATABASE_READ_URI")

    if read_replica_url:
        try:
            read_options = app.config.get("SQLALCHEMY_READ_ENGINE_OPTIONS", {})
            _read_engine = create_engine(read_replica_url, **read_options)

            _read_session_factory = sessionmaker(bind=_read_engine)

            logger.info("✅ Read replica engine initialized successfully")

            @event.listens_for(_read_engine, "connect")
            def set_readonly_pragma(dbapi_conn, connection_record):
                """Устанавливает read-only режим для read replica соединений"""
                try:

                    cursor = dbapi_conn.cursor()
                    cursor.execute("SET default_transaction_read_only = on")
                    cursor.close()
                except Exception as e:
                    logger.warning(f"Could not set read-only mode: {e}")

        except Exception as e:
            logger.error(f"Failed to initialize read replica engine: {e}")
            logger.warning("Falling back to primary database for all operations")
            _read_engine = None
            _read_session_factory = None
    else:
        logger.info("Read replica not configured, using primary database for all operations")
        _read_engine = None
        _read_session_factory = None

def is_read_request() -> bool:
    """
    Определяет, является ли текущий запрос read-only (GET).

    Returns:
        True если это GET запрос, False для POST/PUT/DELETE
    """
    if not has_request_context():
        return False

    from flask import request

    return request.method in ("GET", "HEAD", "OPTIONS")

def has_read_replica() -> bool:
    """
    Проверяет, настроен ли read replica.

    Returns:
        True если read replica доступен, False иначе
    """
    return _read_engine is not None and _read_session_factory is not None

@contextmanager
def get_read_session(force_primary: bool = False):
    """
    Получает сессию для read операций.
    Автоматически направляет запросы на read replica, если доступен.

    Args:
        force_primary: Если True, принудительно использует primary БД даже при наличии replica

    Yields:
        SQLAlchemy Session для read операций
    """
    global _read_engine, _read_session_factory, _write_engine

    if not has_read_replica() or force_primary:

        yield db.session
        return

    session = _read_session_factory()
    try:
        yield session
    except Exception as e:
        session.rollback()
        logger.error(f"Error in read session: {e}")
        raise
    finally:
        session.close()

@contextmanager
def get_write_session():
    """
    Получает сессию для write операций (INSERT, UPDATE, DELETE).
    Всегда использует primary database.

    Yields:
        SQLAlchemy Session для write операций
    """

    yield db.session

def get_session_for_query(is_read: Optional[bool] = None):
    """
    Получает подходящую сессию для запроса.

    Args:
        is_read: Если None, определяется автоматически на основе HTTP метода.
                 Если True - read операция, False - write операция.

    Returns:
        Context manager для сессии БД
    """
    if is_read is None:
        is_read = is_read_request()

    if is_read:
        return get_read_session()
    else:
        return get_write_session()

def use_read_replica(func):
    """
    Декоратор для функций, которые должны использовать read replica.

    Usage:
        @use_read_replica
        def get_users(project_id):
            with get_read_session() as session:
                return session.query(User).filter_by(project_id=project_id).all()
    """

    def wrapper(*args, **kwargs):

        with get_read_session(force_primary=False) as session:

            original_session = db.session
            db.session = session
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                db.session = original_session

    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    return wrapper

class ReadReplicaMiddleware:
    """
    Middleware для автоматического перенаправления GET запросов на read replica.

    Использование:
        app.before_request(ReadReplicaMiddleware.before_request)
        app.after_request(ReadReplicaMiddleware.after_request)
    """

    @staticmethod
    def before_request():
        """Вызывается перед обработкой запроса"""
        if is_read_request() and has_read_replica():

            pass

    @staticmethod
    def after_request(response):
        """Вызывается после обработки запроса"""

        return response

def check_replica_health() -> dict:
    """
    Проверяет состояние read replica.

    SECURITY NOTE: All SQL queries in this function use hardcoded constants
    and PostgreSQL system functions. No user input is used in SQL construction.
    All queries are safe from SQL injection.

    Returns:
        Словарь с информацией о состоянии реплик
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

                    pass

        except Exception as e:
            logger.error(f"Read replica check failed: {e}")
            result["read_replica_error"] = str(e)

    return result
