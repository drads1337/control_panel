"""
Unit tests for ConnectService
"""

import pytest

from backend.services.connect_service import ConnectService

@pytest.mark.unit
@pytest.mark.connect
class TestConnectService:
    """Test suite for ConnectService"""

    @pytest.fixture
    def connect_service(self):
        """Create ConnectService instance"""
        return ConnectService()

    def test_handle_challenge_request_success(
        self, connect_service, test_key, test_project, mocker, mock_redis
    ):
        """Test successful challenge request"""

        mocker.patch(
            "redis.Redis",
            return_value=mock_redis
        )

        from backend.services.challenge_service import challenge_service
        mocker.patch.object(
            challenge_service,
            "create_enhanced_challenge",
            return_value={"challenge": "test_challenge", "nonce": "test_nonce"}
        )

        response, status_code = connect_service.handle_challenge_request(
            user_key=test_key.key,
            fingerprint="test_fingerprint",
            client_project_id=test_project.id,
            ip="127.0.0.1",
        )

        assert status_code == 200
        assert "challenge" in response
        assert "canary" in response
        assert "project_id" in response

    def test_handle_challenge_request_invalid_key_format(
        self, connect_service, mocker
    ):
        """Test challenge request with invalid key format"""
        response, status_code = connect_service.handle_challenge_request(
            user_key="invalid_key_format",
            fingerprint="test_fingerprint",
            client_project_id=None,
            ip="127.0.0.1",
        )

        assert status_code == 400
        assert "error" in response

    def test_handle_challenge_request_key_not_found(
        self, connect_service, mocker
    ):
        """Test challenge request with non-existent key"""
        response, status_code = connect_service.handle_challenge_request(
            user_key="NONEXISTENTKEY1234567890123456",
            fingerprint="test_fingerprint",
            client_project_id=None,
            ip="127.0.0.1",
        )

        assert status_code in [400, 403]
        assert "error" in response

    def test_generate_offline_ticket_disabled(
        self, connect_service, test_key, test_project, db_session, mocker
    ):
        """Test offline ticket generation when disabled"""
        from backend.models.core import ProjectSettings

        settings = ProjectSettings.query.filter_by(project_id=test_project.id).first()
        if not settings:

            settings = ProjectSettings(
                project_id=test_project.id,
                offline_auth_enabled=False,
            )
            db_session.add(settings)
        else:

            settings.offline_auth_enabled = False
        db_session.commit()

        ticket = connect_service.generate_offline_ticket(
            user_key=test_key.key,
            fingerprint="test_fingerprint",
            project_id=test_project.id,
            key_obj=test_key,
        )

        assert ticket is None

    def test_generate_offline_ticket_enabled(
        self, connect_service, test_key, test_project, db_session, mocker
    ):
        """Test offline ticket generation when enabled"""
        from backend.models.core import ProjectSettings

        settings = ProjectSettings.query.filter_by(project_id=test_project.id).first()
        if not settings:

            settings = ProjectSettings(
                project_id=test_project.id,
                offline_auth_enabled=True,
                offline_ticket_expiration_hours=24,
            )
            db_session.add(settings)
        else:

            settings.offline_auth_enabled = True
            settings.offline_ticket_expiration_hours = 24
        db_session.commit()

        ticket = connect_service.generate_offline_ticket(
            user_key=test_key.key,
            fingerprint="test_fingerprint",
            project_id=test_project.id,
            key_obj=test_key,
        )

        assert ticket is not None
        assert isinstance(ticket, str)

        assert len(ticket.split(".")) == 3

    def test_handle_classic_connect_token_success(
        self, connect_service, test_user, test_project, db_session, mocker
    ):
        """Test classic connect with valid token"""
        from backend.models.keys import ConnectToken
        from datetime import datetime
        import hashlib

        token_value = hashlib.sha256(b"test_token").hexdigest()
        connect_token = ConnectToken(
            token=token_value,
            user_id=test_user.id,
            created_at=datetime.utcnow(),
        )
        db_session.add(connect_token)
        db_session.commit()

        mocker.patch.object(connect_service.analytics_tracker, "log_user_activity")

        response_data, status_code = connect_service.handle_classic_connect_request(
            token=token_value,
            username=None,
            password=None,
            ip="127.0.0.1",
        )

        assert status_code == 200

        assert "project_id" in response_data
        assert "login_type" in response_data

    def test_handle_classic_connect_invalid_token(
        self, connect_service, mocker
    ):
        """Test classic connect with invalid token"""
        response_data, status_code = connect_service.handle_classic_connect_request(
            token="invalid_token",
            username=None,
            password=None,
            ip="127.0.0.1",
        )

        assert status_code == 401
        assert "error" in response_data

    def test_handle_classic_connect_username_password_success(
        self, connect_service, test_user, mocker
    ):
        """Test classic connect with username/password"""

        mocker.patch.object(connect_service.analytics_tracker, "log_user_activity")

        response_data, status_code = connect_service.handle_classic_connect_request(
            token=None,
            username=test_user.username,
            password="test_password_123",
            ip="127.0.0.1",
        )

        assert status_code == 200
        assert "user_id" in response_data
        assert response_data["username"] == test_user.username
        assert "login_success" in response_data

    def test_handle_classic_connect_no_auth_data(
        self, connect_service, mocker
    ):
        """Test classic connect without authentication data"""
        response_data, status_code = connect_service.handle_classic_connect_request(
            token=None,
            username=None,
            password=None,
            ip="127.0.0.1",
        )

        assert status_code == 400
        assert "error" in response_data
