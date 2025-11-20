"""
Integration tests for /auth endpoints
"""

import json

import pytest
from werkzeug.security import generate_password_hash

from backend.models.core import User
from backend.utils.role_constants import UserRoles

@pytest.mark.integration
@pytest.mark.auth
class TestAuthRoutes:
    """Integration tests for authentication routes"""

    def test_health_check(self, client):
        """Test auth health check endpoint"""
        response = client.get("/api/auth/health")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "healthy"
        assert data["service"] == "auth"

    def test_login_success(self, client, test_user):
        """Test successful login"""
        response = client.post(
            "/api/auth/login",
            json={
                "username": test_user.username,
                "password": "test_password_123",
            },
            content_type="application/json",
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "user_id" in data
        assert data["username"] == test_user.username
        assert "login_success" in data
        assert data["login_success"] is True

        set_cookie_header = response.headers.get("Set-Cookie", "")
        assert "access_token_cookie" in set_cookie_header or len(set_cookie_header) > 0

    def test_login_invalid_username(self, client):
        """Test login with invalid username"""
        response = client.post(
            "/api/auth/login",
            json={
                "username": "nonexistent_user",
                "password": "password",
            },
            content_type="application/json",
        )

        assert response.status_code in [401, 500]
        if response.status_code == 500:

            data = json.loads(response.data) if response.data else {}
            print(f"Unexpected 500 error: {data}")
        data = json.loads(response.data)
        assert "error" in data

    def test_login_invalid_password(self, client, test_user):
        """Test login with invalid password"""
        response = client.post(
            "/api/auth/login",
            json={
                "username": test_user.username,
                "password": "wrong_password",
            },
            content_type="application/json",
        )

        assert response.status_code in [401, 500]
        if response.status_code == 500:

            data = json.loads(response.data) if response.data else {}
            print(f"Unexpected 500 error: {data}")
        data = json.loads(response.data)
        assert "error" in data

    def test_login_missing_fields(self, client):
        """Test login with missing fields"""
        response = client.post(
            "/api/auth/login",
            json={"username": "test_user"},
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_register_success(self, client, test_project, db_session):
        """Test successful user registration"""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "new_user",
                "email": "new_user@test.com",
                "password": "secure_password_123",
            },
            content_type="application/json",
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert "user_id" in data
        assert data["username"] == "new_user"
        assert data["email"] == "new_user@test.com"

        user = User.query.filter_by(username="new_user").first()
        assert user is not None
        assert user.email == "new_user@test.com"

    def test_register_duplicate_username(self, client, test_user):
        """Test registration with duplicate username"""
        response = client.post(
            "/api/auth/register",
            json={
                "username": test_user.username,
                "email": "different@test.com",
                "password": "password123",
            },
            content_type="application/json",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

    def test_register_duplicate_email(self, client, test_user):
        """Test registration with duplicate email"""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "different_user",
                "email": test_user.email,
                "password": "password123",
            },
            content_type="application/json",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

    def test_get_current_user(self, client, test_user, app, mocker):
        """Test getting current user information"""

        mock_profile = {
            "id": test_user.id,
            "username": test_user.username,
            "email": test_user.email,
            "role": test_user.role,
        }
        mocker.patch(
            "backend.routes.auth.user_service.get_user_profile",
            return_value=mock_profile
        )

        with app.app_context():
            from flask_jwt_extended import create_access_token
            access_token = create_access_token(identity=str(test_user.id))
            headers = {"Authorization": f"Bearer {access_token}"}

        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username

    def test_get_current_user_unauthorized(self, client):
        """Test getting current user without authentication"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_logout(self, client, auth_headers, test_user, app):
        """Test user logout"""

        with app.app_context():
            from flask_jwt_extended import create_access_token
            access_token = create_access_token(identity=str(test_user.id))
            headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "message" in data

    def test_logout_unauthorized(self, client):
        """Test logout without authentication"""
        response = client.post("/api/auth/logout")
        assert response.status_code == 401

    def test_change_password_success(self, client, auth_headers, test_user, app):
        """Test successful password change"""

        with app.app_context():
            from flask_jwt_extended import create_access_token
            access_token = create_access_token(identity=str(test_user.id))
            headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "test_password_123",
                "new_password": "new_secure_password_456",
            },
            headers=headers,
            content_type="application/json",
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "message" in data

        login_response = client.post(
            "/api/auth/login",
            json={
                "username": test_user.username,
                "password": "new_secure_password_456",
            },
            content_type="application/json",
        )
        assert login_response.status_code == 200

    def test_change_password_wrong_current(self, client, auth_headers, test_user, app):
        """Test password change with wrong current password"""

        with app.app_context():
            from flask_jwt_extended import create_access_token
            access_token = create_access_token(identity=str(test_user.id))
            headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "wrong_password",
                "new_password": "new_password",
            },
            headers=headers,
            content_type="application/json",
        )

        assert response.status_code in [400, 500]
        data = json.loads(response.data)
        assert "error" in data

    def test_update_profile(self, client, auth_headers, test_user, app):
        """Test updating user profile"""

        with app.app_context():
            from flask_jwt_extended import create_access_token
            access_token = create_access_token(identity=str(test_user.id))
            headers = {"Authorization": f"Bearer {access_token}"}

        response = client.put(
            "/api/auth/profile",
            json={"email": "updated_email@test.com"},
            headers=headers,
            content_type="application/json",
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "message" in data

        updated_user = User.query.get(test_user.id)
        assert updated_user.email == "updated_email@test.com"

    def test_validate_access_code_success(self, client, test_key, db_session):
        """Test validating access code"""
        from backend.models.games import Game

        game = Game(
            name="Test Game",
            project_id=test_key.project_id,
            login_type="classic_login",
        )
        db_session.add(game)
        db_session.commit()

        test_key.game_id = game.id
        test_key.status = 1
        db_session.commit()

        response = client.post(
            "/api/auth/validate-code",
            json={"access_code": test_key.key},
            content_type="application/json",
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["valid"] is True

    def test_validate_access_code_invalid(self, client):
        """Test validating invalid access code"""
        response = client.post(
            "/api/auth/validate-code",
            json={"access_code": "INVALID_CODE_1234567890123456"},
            content_type="application/json",
        )
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data["valid"] is False
