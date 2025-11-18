"""
Authentication Service
Handles all authentication-related business logic including login, registration, and session management
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from flask import current_app, make_response
from flask_jwt_extended import create_access_token, set_access_cookies
from werkzeug.security import check_password_hash

from ...config.config import Config
from ...core.extensions import db
from ...models.core import Project, ProjectInviteCode, User
from ...models.keys import ReferralCode
from ...utils.ip_utils import get_location_from_ip, get_real_ip
from ...utils.rbac_utils import RBACManager
from ...services.activity import activity_service
from ...services.security import security_service

class AuthService:
    """Service for handling authentication operations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def validate_simple_login(
        self, username: str, password: str
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Validate simple username/password login

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            Tuple of (User object or None, error message or None)
        """
        try:
            identifier = username.strip()
            if "@" in identifier:
                user = User.query.filter_by(email=identifier.lower()).first()
                self.logger.debug(
                    f"Login attempt with email: {identifier.lower()}, user found: {user is not None}"
                )
            else:
                user = User.query.filter_by(username=identifier).first()
                self.logger.debug(
                    f"Login attempt with username: {identifier}, user found: {user is not None}"
                )

            if not user:
                self.logger.warning(f"Login failed: User not found for identifier: {identifier}")
                return None, "Invalid credentials"

            if not user.password:
                self.logger.warning(
                    f"Login failed: User {user.id} ({user.username}) has no password hash"
                )
                return None, "Invalid credentials"

            password_valid = check_password_hash(user.password, password)
            self.logger.debug(
                f"Password validation for user {user.id} ({user.username}): {password_valid}"
            )

            if not password_valid:
                self.logger.warning(
                    f"Login failed: Invalid password for user {user.id} ({user.username})"
                )
                return None, "Invalid credentials"

            self.logger.info(f"Login successful for user {user.id} ({user.username})")
            return user, None

        except Exception as e:
            self.logger.error(f"Error in validate_simple_login: {str(e)}", exc_info=True)
            return None, "Authentication failed"

    def create_login_response(self, user: User) -> Dict[str, Any]:
        """
        Create standardized login response with secure cookie-based authentication

        Args:
            user: Authenticated user

        Returns:
            Dictionary with login response data (without access_token for security)
        """
        try:

            session_id = str(uuid.uuid4())

            user_roles = RBACManager.get_user_role_names(user)

            response_data = {
                "user_id": str(user.id),
                "username": user.username,
                "roles": user_roles,
                "session_id": session_id,
                "login_success": True,
            }

            return response_data

        except Exception as e:
            self.logger.error(f"Error creating login response: {str(e)}")
            raise

    def update_user_login_info(self, user: User, ip: str, user_agent: str) -> None:
        """
        Update user's last login information

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
        """
        try:
            real_ip = get_real_ip()
            user.last_ip = real_ip
            user.last_login = datetime.utcnow()

            country, city = get_location_from_ip(real_ip)
            if country:
                user.last_country = country
            if city:
                user.last_city = city

            db.session.commit()

        except Exception as e:
            self.logger.warning(f"Failed to update user login info: {e}")
            db.session.rollback()

    def log_login_activity(
        self,
        user: User,
        ip: str,
        user_agent: str,
        session_id: str,
        details: str = "Successful login",
    ) -> None:
        """
        Log user login activity

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
            session_id: Session identifier
            details: Activity details
        """
        try:
            activity_service.log_activity(
                user, "login", ip=ip, user_agent=user_agent, details=details, session_id=session_id
            )
        except Exception as e:
            self.logger.warning(f"Failed to log login activity: {e}")

    def check_project_security(
        self, user: User, ip: str, user_agent: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check project-specific security constraints

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent

        Returns:
            Tuple of (is_allowed, error_message)
        """
        if not user.project_id:
            return True, None

        try:

            project = Project.query.get(user.project_id)
            if not project:
                self.logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} has invalid project_id: {user.project_id}"
                )
                return False, "PROJECT_NOT_FOUND"

            if not project.is_active:
                self.logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} accessing inactive project: {project.id}"
                )
                return False, "PROJECT_INACTIVE"

            if security_service.is_ip_blocked(ip, user.project_id):
                return False, "IP_BLOCKED"

            if security_service.check_session_limit(user.id, user.project_id):
                return False, "SESSION_LIMIT_EXCEEDED"

            return True, None

        except Exception as e:
            self.logger.error(f"Error checking project security: {str(e)}")
            return False, "Security check failed"

    def record_login_attempt(self, user: User, ip: str, user_agent: str, success: bool) -> None:
        """
        Record login attempt for security monitoring

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
            success: Whether login was successful
        """
        if not user.project_id:
            return

        try:
            security_service.record_login_attempt(
                ip, user.username, success, user.project_id, user_agent
            )
        except Exception as e:
            self.logger.warning(f"Failed to record login attempt: {e}")

    def _trigger_login_webhook(
        self, user: User, ip: str, user_agent: str, login_type: str, session_id: str
    ) -> None:
        """
        Trigger webhook for user login event

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
            login_type: Type of login (always "simple" - data transmitted over HTTPS)
            session_id: Session identifier
        """
        try:
            from ...services.webhooks import get_webhook_service

            webhook_service = get_webhook_service()

            from ...utils.rbac_utils import RBACManager
            from ...utils.role_constants import UserRoles
            user_roles = RBACManager.get_user_role_names(user)
            primary_role = user_roles[0] if user_roles else UserRoles.CLIENT.value

            webhook_data = {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "role": primary_role,
                "project_id": user.project_id,
                "login_type": login_type,
                "ip_address": ip,
                "user_agent": user_agent,
                "login_at": datetime.utcnow().isoformat(),
                "session_id": session_id,
            }

            if user.project_id:
                webhook_service.trigger_webhook("user.login", webhook_data, user.project_id)
                self.logger.info(f"Triggered webhook for user login: {user.id}")
        except Exception as e:
            self.logger.warning(f"Failed to trigger webhook for user login: {str(e)}")

    def process_simple_login(
        self, username: str, password: str, ip: str, user_agent: str
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
        """
        Process complete simple login flow with all business logic

        This method encapsulates all login logic:
        - Validation
        - Security checks
        - User data updates
        - Response creation
        - JWT token creation
        - Activity logging
        - Webhook triggering

        Args:
            username: Username or email
            password: Plain text password
            ip: Client IP address
            user_agent: Client user agent

        Returns:
            Tuple of (response_data with access_token, error_code, error_message)
            On success: (response_data, None, None)
            On failure: (None, error_code, error_message)
        """
        try:

            self.logger.debug(f"Login attempt: username={username}, ip={ip}")
            user, error = self.validate_simple_login(username, password)
            if not user:
                self.logger.warning(f"Login failed: username={username}, error={error}, ip={ip}")
                return None, "INVALID_CREDENTIALS", "Invalid username or password"

            is_allowed, security_error = self.check_project_security(user, ip, user_agent)
            if not is_allowed:
                self.logger.warning(
                    f"Security violation: {security_error} for user {user.username}, ip={ip}"
                )
                return None, security_error, "Access denied due to security constraints"

            self.update_user_login_info(user, ip, user_agent)

            response_data = self.create_login_response(user)
            session_id = response_data.get("session_id", "")

            access_token = create_access_token(identity=str(user.id))
            response_data["access_token"] = access_token

            self.log_login_activity(user, ip, user_agent, session_id)

            self.record_login_attempt(user, ip, user_agent, True)

            self._trigger_login_webhook(user, ip, user_agent, "simple", session_id)

            return response_data, None, None

        except Exception as e:
            self.logger.error(f"Error in process_simple_login: {str(e)}", exc_info=True)
            return None, "LOGIN_FAILED", "Authentication failed"

auth_service = AuthService()
