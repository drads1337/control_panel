"""
Authentication Service
Handles all authentication-related business logic including login, registration, and session management
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from flask import current_app, make_response
from flask_jwt_extended import create_access_token, set_access_cookies
from werkzeug.security import check_password_hash
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError, InvalidRequestError

from ...config.config import Config
from ...core.extensions import db
from ...models.core import Project, ProjectInviteCode, User
from ...models.keys import ReferralCode
from ...utils.ip_utils import get_location_from_ip, get_real_ip
from ...utils.rbac_utils import RBACManager
from ...utils.service_helpers import get_service
from ...utils.service_exceptions import AuthenticationError, SecurityError, NotFoundError, ServiceError
from ...services.activity import activity_service
from ...services.validation import request_validation_pipeline

class AuthService:
    """Service for handling authentication operations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def validate_simple_login(
        self, username: str, password: str
    ) -> User:
        """
        Validate simple username/password login

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            User object

        Raises:
            AuthenticationError: If credentials are invalid
            ServiceError: If database operation fails
        """
        try:
            # Clean and normalize identifier
            identifier = username.strip()
            # Remove any non-printable characters that might cause issues
            identifier = ''.join(char for char in identifier if char.isprintable())
            
            # Handle potential session rollback issues
            try:
                if "@" in identifier:
                    email = identifier.lower()
                    user = User.query.filter_by(email=email).first()
                    self.logger.debug(
                        f"Login attempt with email: {email}, user found: {user is not None}"
                    )
                    if not user:
                        # Try case-insensitive search as fallback
                        user = User.query.filter(func.lower(User.email) == email).first()
                        if user:
                            self.logger.debug(f"User found with case-insensitive email search")
                else:
                    username_lower = identifier.lower()
                    # First try exact match
                    user = User.query.filter_by(username=identifier).first()
                    self.logger.debug(
                        f"Login attempt with username: {identifier}, exact match found: {user is not None}"
                    )
                    # If not found, try case-insensitive search
                    if not user:
                        user = User.query.filter(func.lower(User.username) == username_lower).first()
                        if user:
                            self.logger.debug(
                                f"User found with case-insensitive username search: {user.username}"
                            )
            except (SQLAlchemyError, InvalidRequestError) as db_error:
                # If session was rolled back, rollback explicitly and retry
                self.logger.warning(f"Database session error, rolling back: {db_error}")
                db.session.rollback()
                
                # Retry the query after rollback
                if "@" in identifier:
                    email = identifier.lower()
                    user = User.query.filter_by(email=email).first()
                    if not user:
                        user = User.query.filter(func.lower(User.email) == email).first()
                else:
                    username_lower = identifier.lower()
                    user = User.query.filter_by(username=identifier).first()
                    if not user:
                        user = User.query.filter(func.lower(User.username) == username_lower).first()

            if not user:
                # Additional debugging: check if any users exist with similar username
                debug_info = []
                total_users = 0
                
                try:
                    # Count total users once for all debug checks
                    total_users = User.query.count()
                    debug_info.append(f"Total users in database: {total_users}")
                    
                    if "@" not in identifier:
                        # Try to find similar usernames for debugging
                        # NOTE: ILIKE is used here only for debug purposes when user is not found.
                        # This is not in the critical path and doesn't affect production performance.
                        # For production search, use fulltext_search with GIN indexes (see SCALABILITY_IMPROVEMENTS.md)
                        similar_users = User.query.filter(
                            User.username.ilike(f"%{identifier}%")
                        ).limit(5).all()
                        if similar_users:
                            similar_usernames = [u.username for u in similar_users]
                            debug_info.append(f"Found {len(similar_users)} similar usernames: {similar_usernames}")
                        
                        # Check if exact lowercase match exists
                        exact_lower = User.query.filter(
                            func.lower(User.username) == identifier.lower()
                        ).first()
                        if exact_lower:
                            debug_info.append(f"WARNING: Found user with lowercase match: {exact_lower.username} (original: {identifier})")
                except Exception as e:
                    debug_info.append(f"Error during debug check: {str(e)}")
                
                warning_msg = (
                    f"Login failed: User not found for identifier: {identifier} "
                    f"(searched username exactly and case-insensitively, email if '@' present)"
                )
                if debug_info:
                    warning_msg += f"\nDebug info: {'; '.join(debug_info)}"
                
                # Provide helpful message if database is empty
                if total_users == 0:
                    warning_msg += (
                        f"\nDATABASE IS EMPTY: No users found in database. "
                        f"Please create a user first using /auth/register endpoint or create_owner.py script."
                    )
                
                self.logger.warning(warning_msg)
                raise AuthenticationError("Invalid credentials")

            if not user.password:
                self.logger.warning(
                    f"Login failed: User {user.id} ({user.username}) has no password hash"
                )
                raise AuthenticationError("Invalid credentials")

            password_valid = check_password_hash(user.password, password)
            self.logger.debug(
                f"Password validation for user {user.id} ({user.username}): {password_valid}"
            )

            if not password_valid:
                self.logger.warning(
                    f"Login failed: Invalid password for user {user.id} ({user.username})"
                )
                raise AuthenticationError("Invalid credentials")

            self.logger.info(f"Login successful for user {user.id} ({user.username})")
            return user

        except AuthenticationError:
            # Ensure session is rolled back on authentication error
            try:
                db.session.rollback()
            except Exception:
                pass
            raise
        except Exception as e:
            self.logger.error(f"Error in validate_simple_login: {str(e)}", exc_info=True)
            # Ensure session is rolled back on any error
            try:
                db.session.rollback()
            except Exception:
                pass
            raise ServiceError("Authentication failed", status_code=500) from e

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
    ) -> None:
        """
        Check project-specific security constraints
        
        Uses unified ValidationPipeline for IP and User-Agent validation (DRY principle)

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent

        Raises:
            SecurityError: If security constraints are violated
            NotFoundError: If project not found
            ServiceError: If security check fails
        """
        if not user.project_id:
            return  # No project, no security checks needed

        try:
            # Handle potential session rollback issues
            try:
                project = Project.query.get(user.project_id)
            except (SQLAlchemyError, InvalidRequestError) as db_error:
                # If session was rolled back, rollback explicitly and retry
                self.logger.warning(f"Database session error in check_project_security, rolling back: {db_error}")
                db.session.rollback()
                project = Project.query.get(user.project_id)
            
            if not project:
                self.logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} has invalid project_id: {user.project_id}"
                )
                raise SecurityError("Project not found", error_code="PROJECT_NOT_FOUND")

            if not project.is_active:
                self.logger.warning(
                    f"SECURITY_VIOLATION: User {user.username} accessing inactive project: {project.id}"
                )
                raise SecurityError("Project is inactive", error_code="PROJECT_INACTIVE")

            # Use unified validation pipeline for IP and User-Agent
            validation_result = request_validation_pipeline.validate_request(
                ip=ip,
                user_agent=user_agent,
                project_id=user.project_id,
            )
            if not validation_result.is_valid:
                raise SecurityError(
                    "Access denied due to security constraints",
                    error_code=validation_result.reason or "VALIDATION_FAILED"
                )

            security_service = get_service('security_service')
            if security_service.check_session_limit(user.id, user.project_id):
                raise SecurityError("Session limit exceeded", error_code="SESSION_LIMIT_EXCEEDED")

        except (SecurityError, NotFoundError):
            raise
        except Exception as e:
            self.logger.error(f"Error checking project security: {str(e)}", exc_info=True)
            raise ServiceError("Security check failed", status_code=500) from e

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
            security_service = get_service('security_service')
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
    ) -> Dict[str, Any]:
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
            Dictionary with login response data including access_token

        Raises:
            AuthenticationError: If credentials are invalid
            SecurityError: If security constraints are violated
            ServiceError: If login process fails
        """
        try:
            self.logger.debug(f"Login attempt: username={username}, ip={ip}")
            
            # validate_simple_login now raises AuthenticationError on failure
            user = self.validate_simple_login(username, password)
            
            # check_project_security now raises SecurityError on failure
            self.check_project_security(user, ip, user_agent)

            self.update_user_login_info(user, ip, user_agent)

            response_data = self.create_login_response(user)
            session_id = response_data.get("session_id", "")

            access_token = create_access_token(identity=str(user.id))
            response_data["access_token"] = access_token

            self.log_login_activity(user, ip, user_agent, session_id)

            self.record_login_attempt(user, ip, user_agent, True)

            self._trigger_login_webhook(user, ip, user_agent, "simple", session_id)

            return response_data

        except (AuthenticationError, SecurityError):
            raise
        except Exception as e:
            self.logger.error(f"Error in process_simple_login: {str(e)}", exc_info=True)
            raise ServiceError("Authentication failed", status_code=500) from e

auth_service = AuthService()
