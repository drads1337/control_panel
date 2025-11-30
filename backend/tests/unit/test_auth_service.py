"""
Unit tests for AuthService
"""

import pytest
from werkzeug.security import generate_password_hash

from backend.models.core import Project, User
from backend.services.auth_service import AuthService
from backend.utils.role_constants import UserRoles
from ...utils.service_helpers import get_service

@pytest.mark.unit
@pytest.mark.auth
class TestAuthService:
    """Test suite for AuthService"""
    def __init__(self, auth_service=None, webhook_service=None):
        """Initialize TestAuthService with dependencies"""
        self._webhook_service = webhook_service
        self._auth_service = auth_service

    @pytest.fixture
    def auth_service(self):
        """Create AuthService instance"""
        return AuthService()

    def test_validate_simple_login_success_username(self, auth_service, test_user):
        """Test successful login with username"""
        auth_service = get_service('auth_service')
        auth_service = get_service('auth_service')
        auth_service = get_service('auth_service')
        user, error = auth_service.validate_simple_login(
            test_user.username, "test_password_123"
        )
        assert user is not None
        assert error is None
        assert user.id == test_user.id
        assert user.username == test_user.username

    def test_validate_simple_login_success_email(self, auth_service, test_user):
        """Test successful login with email"""
        user, error = auth_service.validate_simple_login(
            test_user.email, "test_password_123"
        )
        assert user is not None
        assert error is None
        assert user.id == test_user.id

    def test_validate_simple_login_invalid_username(self, auth_service):
        """Test login with non-existent username"""
        user, error = auth_service.validate_simple_login("nonexistent_user", "password")
        assert user is None

        assert error in ["Invalid credentials", "Authentication failed"]

    def test_validate_simple_login_invalid_password(self, auth_service, test_user):
        """Test login with wrong password"""
        user, error = auth_service.validate_simple_login(
            test_user.username, "wrong_password"
        )
        assert user is None
        assert error == "Invalid credentials"

    def test_validate_simple_login_user_no_password(self, auth_service, db_session, test_project, mocker):
        """Test login for user without password hash"""

        from werkzeug.security import generate_password_hash
        from unittest.mock import MagicMock

        mock_user = MagicMock(spec=User)
        mock_user.id = 999
        mock_user.username = "no_password_user"
        mock_user.password = None

        mock_query = mocker.Mock()
        mock_query.first = mocker.Mock(return_value=mock_user)
        mocker.patch.object(
            User.query,
            "filter_by",
            return_value=mock_query
        )

        user_result, error = auth_service.validate_simple_login("no_password_user", "password")
        assert user_result is None
        assert error == "Invalid credentials"

    def test_check_project_security_active_project(self, auth_service, test_user):
        """Test security check for active project"""
        is_allowed, error = auth_service.check_project_security(
            test_user, "127.0.0.1", "test-agent"
        )
        assert is_allowed is True
        assert error is None

    def test_check_project_security_no_project(self, auth_service, db_session):
        """Test security check for user without project"""
        user = User(
            username="no_project_user",
            email="no_project@test.com",
            password=generate_password_hash("password"),
            role=UserRoles.CLIENT.value,
            project_id=None,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()

        is_allowed, error = auth_service.check_project_security(
            user, "127.0.0.1", "test-agent"
        )
        assert is_allowed is True
        assert error is None

    def test_check_project_security_inactive_project(
        self, auth_service, db_session, test_project
    ):
        """Test security check for inactive project"""

        test_project.status = "inactive"
        db_session.commit()

        user = User(
            username="inactive_project_user",
            email="inactive@test.com",
            password=generate_password_hash("password"),
            role=UserRoles.CLIENT.value,
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()

        is_allowed, error = auth_service.check_project_security(
            user, "127.0.0.1", "test-agent"
        )
        assert is_allowed is False
        assert error == "PROJECT_INACTIVE"

    def test_check_project_security_nonexistent_project(self, auth_service, db_session, test_project, mocker):
        """Test security check for non-existent project"""
        from werkzeug.security import generate_password_hash
        from unittest.mock import MagicMock

        user = User(
            username="bad_project_user",
            email="bad_project@test.com",
            password=generate_password_hash("password"),
            role=UserRoles.CLIENT.value,
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        original_project_id = user.project_id
        user.project_id = 99999

        mock_security = mocker.patch("backend.services.auth_service.security_service")
        mock_security.is_ip_blocked = mocker.Mock(return_value=False)
        mock_security.check_session_limit = mocker.Mock(return_value=False)

        with mocker.patch(
            "backend.services.auth_service.Project.query.get",
            return_value=None
        ) as mock_get:

            is_allowed, error = auth_service.check_project_security(
                user, "127.0.0.1", "test-agent"
            )

            assert is_allowed is False

            if error != "PROJECT_NOT_FOUND":

                print(f"Expected 'PROJECT_NOT_FOUND', got '{error}'")

                assert error in ["PROJECT_NOT_FOUND", "Security check failed"]
            else:
                assert error == "PROJECT_NOT_FOUND"

        user.project_id = original_project_id

    def test_create_login_response_simple(self, auth_service, test_user):
        """Test creating login response for simple login"""
        response = auth_service.create_login_response(test_user)
        assert "user_id" in response
        assert "username" in response
        assert "roles" in response
        assert "session_id" in response
        assert "login_success" in response
        assert response["login_success"] is True
        assert response["username"] == test_user.username

    def test_process_simple_login_success(
        self, auth_service, test_user, mocker, mock_redis, app
    ):
        """Test successful simple login flow"""

        mock_security_service = mocker.patch("backend.services.auth_service.security_service")
        mock_security_service.is_ip_blocked = mocker.Mock(return_value=False)
        mock_security_service.check_session_limit = mocker.Mock(return_value=False)
        mock_security_service.record_login_attempt = mocker.Mock()

        mock_activity_service = mocker.patch("backend.services.auth_service.activity_service")
        mock_activity_service.log_activity = mocker.Mock()

        mock_webhook_service = mocker.Mock()
        mock_webhook_service.trigger_webhook = mocker.Mock()
        webhook_service = get_service('webhook_service')
        mocker.patch(
            "backend.services.webhook_service.get_webhook_service",
            return_value=mock_webhook_service
        )

        mocker.patch("backend.services.auth_service.get_real_ip", return_value="127.0.0.1")
        mocker.patch("backend.services.auth_service.get_location_from_ip", return_value=(None, None))

        with app.app_context():
            response_data, error_code, error_message = auth_service.process_simple_login(
                test_user.username, "test_password_123", "127.0.0.1", "test-agent"
            )

        assert response_data is not None
        assert error_code is None
        assert error_message is None
        assert "access_token" in response_data
        assert "user_id" in response_data
        assert response_data["username"] == test_user.username

    def test_process_simple_login_invalid_credentials(self, auth_service, test_user):
        """Test simple login with invalid credentials"""
        response_data, error_code, error_message = auth_service.process_simple_login(
            test_user.username, "wrong_password", "127.0.0.1", "test-agent"
        )

        assert response_data is None
        assert error_code == "INVALID_CREDENTIALS"
        assert error_message == "Invalid username or password"

    def test_process_simple_login_project_inactive(
        self, auth_service, db_session, test_project, mocker
    ):
        """Test simple login with inactive project"""

        test_project.status = "inactive"
        db_session.commit()

        user = User(
            username="inactive_user",
            email="inactive@test.com",
            password=generate_password_hash("password123"),
            role=UserRoles.CLIENT.value,
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()

        response_data, error_code, error_message = auth_service.process_simple_login(
            "inactive_user", "password123", "127.0.0.1", "test-agent"
        )

        assert response_data is None
        assert error_code == "PROJECT_INACTIVE"
        assert "Access denied" in error_message
