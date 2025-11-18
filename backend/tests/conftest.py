"""
Pytest configuration and fixtures for testing
"""

import os
import secrets
import tempfile
from datetime import datetime
from typing import Generator

import pytest
from faker import Faker
from flask import Flask
from flask_jwt_extended import create_access_token

from backend.core.app import create_app
from backend.core.extensions import db
from backend.models.core import Project, User
from backend.models.keys import Key
from backend.utils.role_constants import UserRoles

fake = Faker()

@pytest.fixture(scope="session")
def app() -> Generator[Flask, None, None]:
    """Create application for testing"""

    os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)
    os.environ["PANEL_MASTER_KEY"] = secrets.token_hex(32)
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)
    os.environ["OFFLINE_TICKET_SECRET"] = secrets.token_hex(32)

    db_fd, db_path = tempfile.mkstemp()
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    os.environ["REDIS_HOST"] = "localhost"
    os.environ["REDIS_PORT"] = "6379"
    os.environ["REDIS_DB"] = "15"
    os.environ["REDIS_PASSWORD"] = ""

    import backend.core.app as app_module
    original_check = app_module.check_redis_connection

    def mock_redis_check():
        """Mock Redis check to always return True for tests"""
        return True

    app_module.check_redis_connection = mock_redis_check

    try:

        app = create_app()
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        app.config["JWT_COOKIE_CSRF_PROTECT"] = False

        app.config["JWT_TOKEN_LOCATION"] = ["cookies", "headers"]

        with app.app_context():

            from backend.models import core, keys, games, notifications, webhooks, rbac, security, remote_control, chat, loaders

            db.create_all()
            yield app

            db.session.remove()
            db.drop_all()
    finally:

        app_module.check_redis_connection = original_check

        os.close(db_fd)
        os.unlink(db_path)

@pytest.fixture
def client(app: Flask):
    """Create test client"""
    return app.test_client()

@pytest.fixture(autouse=True)
def mock_external_services(mocker, mock_redis):
    """Automatically mock external services for all tests"""

    mock_security = mocker.patch("backend.services.auth_service.security_service")
    mock_security.is_ip_blocked = mocker.Mock(return_value=False)
    mock_security.check_session_limit = mocker.Mock(return_value=False)
    mock_security.record_login_attempt = mocker.Mock()

    mock_activity = mocker.patch("backend.services.auth_service.activity_service")
    mock_activity.log_activity = mocker.Mock()

    mocker.patch("backend.services.auth_service.get_real_ip", return_value="127.0.0.1")
    mocker.patch("backend.services.auth_service.get_location_from_ip", return_value=(None, None))

    mock_webhook = mocker.Mock()
    mock_webhook.trigger_webhook = mocker.Mock()
    mocker.patch(
        "backend.services.webhook_service.get_webhook_service",
        return_value=mock_webhook
    )

    mocker.patch("redis.Redis", return_value=mock_redis)

@pytest.fixture
def db_session(app: Flask):
    """Create database session for testing"""
    yield db.session
    db.session.rollback()

@pytest.fixture
def test_project(db_session) -> Project:
    """Create a test project"""

    import time
    project = Project(
        name=f"{fake.company()}_{int(time.time() * 1000)}",
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project

@pytest.fixture
def test_user(db_session, test_project: Project) -> User:
    """Create a test user"""
    from werkzeug.security import generate_password_hash

    user = User(
        username=fake.user_name(),
        email=fake.email(),
        password=generate_password_hash("test_password_123"),
        role=UserRoles.CLIENT.value,
        project_id=test_project.id,
        created_at=datetime.utcnow(),
        total_keys=0,
        active_keys=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_admin_user(db_session, test_project: Project) -> User:
    """Create a test admin user"""
    from werkzeug.security import generate_password_hash

    user = User(
        username=fake.user_name(),
        email=fake.email(),
        password=generate_password_hash("admin_password_123"),
        role=UserRoles.ADMIN.value,
        project_id=test_project.id,
        created_at=datetime.utcnow(),
        total_keys=0,
        active_keys=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def auth_headers(test_user: User, app: Flask):
    """Create authentication headers with JWT token"""
    with app.app_context():
        access_token = create_access_token(identity=str(test_user.id))
        return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def admin_auth_headers(test_admin_user: User, app: Flask):
    """Create authentication headers for admin user"""
    with app.app_context():
        access_token = create_access_token(identity=str(test_admin_user.id))
        return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def test_key(db_session, test_project: Project) -> Key:
    """Create a test key"""
    key = Key(
        key=fake.uuid4().replace("-", "").upper()[:32],
        project_id=test_project.id,
        status=1,
        created_at=datetime.utcnow(),
        max_devices=1,
    )
    db_session.add(key)
    db_session.commit()
    db_session.refresh(key)
    return key

@pytest.fixture
def mock_redis(mocker):
    """Mock Redis client"""
    from unittest.mock import MagicMock

    mock_redis_client = MagicMock()
    mock_redis_client.ping.return_value = True
    mock_redis_client.get.return_value = None
    mock_redis_client.set.return_value = True
    mock_redis_client.setex.return_value = True
    mock_redis_client.delete.return_value = True
    mock_redis_client.exists.return_value = False

    mock_pipeline = MagicMock()
    mock_pipeline.__enter__ = MagicMock(return_value=mock_redis_client)
    mock_pipeline.__exit__ = MagicMock(return_value=None)
    mock_pipeline.setex = MagicMock(return_value=None)
    mock_pipeline.execute = MagicMock(return_value=None)
    mock_redis_client.pipeline = MagicMock(return_value=mock_pipeline)

    return mock_redis_client
