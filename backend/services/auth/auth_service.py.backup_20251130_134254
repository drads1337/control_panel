"""
Authentication Service
Handles all authentication-related business logic including login, registration, and session management
"""

import logging
from typing import Any, Dict

from ...models.core import User
from ...utils.service_exceptions import AuthenticationError, SecurityError, NotFoundError, ServiceError

# Type hints for dependencies (imported here to avoid circular imports)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.auth.login_service import LoginService
    from ...services.auth.auth_token_service import AuthTokenService

class AuthService:
    """Service for handling authentication operations"""

    def __init__(
        self,
        login_service: 'LoginService' = None,
        auth_token_service: 'AuthTokenService' = None,
        logger=None
    ):
        """
        Initialize AuthService with explicit dependencies.
        
        Args:
            login_service: Service for login operations
            auth_token_service: Service for token operations
            logger: Optional logger instance
        """
        self.logger = logger or logging.getLogger(__name__)
        
        # Store dependencies explicitly
        self._login_service = login_service
        self._auth_token_service = auth_token_service
    
    def _get_login_service(self):
        """Get login service (lazy loading for backward compatibility)"""
        if self._login_service is None:
            from ...utils.service_helpers import get_service
            self._login_service = get_service('login_service')
        return self._login_service
    
    def _get_auth_token_service(self):
        """Get auth token service (lazy loading for backward compatibility)"""
        if self._auth_token_service is None:
            from ...utils.service_helpers import get_service
            self._auth_token_service = get_service('auth_token_service')
        return self._auth_token_service

    def validate_simple_login(
        self, username: str, password: str
    ) -> User:
        """
        Validate simple username/password login.
        
        Delegates to LoginService for credential validation (SRP principle).

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            User object

        Raises:
            AuthenticationError: If credentials are invalid
            ServiceError: If database operation fails
        """
        login_service = self._get_login_service()
        return login_service.validate_credentials(username, password)

    def create_login_response(self, user: User, include_token: bool = False) -> Dict[str, Any]:
        """
        Create standardized login response with secure cookie-based authentication
        
        Delegates to AuthTokenService for token operations (SRP principle).

        Args:
            user: Authenticated user
            include_token: Whether to include access_token in response (default: False for security)

        Returns:
            Dictionary with login response data
        """
        auth_token_service = self._get_auth_token_service()
        return auth_token_service.create_login_response(user, include_token=include_token)

    def update_user_login_info(self, user: User, ip: str, user_agent: str) -> None:
        """
        Update user's last login information.
        
        Delegates to LoginService (SRP principle).

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
        """
        login_service = self._get_login_service()
        login_service.update_user_login_info(user, ip, user_agent)

    def log_login_activity(
        self,
        user: User,
        ip: str,
        user_agent: str,
        session_id: str,
        details: str = "Successful login",
    ) -> None:
        """
        Log user login activity.
        
        Delegates to LoginService (SRP principle).

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
            session_id: Session identifier
            details: Activity details
        """
        login_service = self._get_login_service()
        login_service.log_login_activity(user, ip, user_agent, session_id, details)

    def check_project_security(
        self, user: User, ip: str, user_agent: str
    ) -> None:
        """
        Check project-specific security constraints.
        
        Delegates to LoginService (SRP principle).

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent

        Raises:
            SecurityError: If security constraints are violated
            NotFoundError: If project not found
            ServiceError: If security check fails
        """
        login_service = self._get_login_service()
        login_service.check_security_constraints(user, ip, user_agent)

    def record_login_attempt(self, user: User, ip: str, user_agent: str, success: bool) -> None:
        """
        Record login attempt for security monitoring.
        
        Delegates to LoginService (SRP principle).

        Args:
            user: User object
            ip: Client IP address
            user_agent: Client user agent
            success: Whether login was successful
        """
        login_service = self._get_login_service()
        login_service.record_login_attempt(user, ip, user_agent, success)

    def process_simple_login(
        self, username: str, password: str, ip: str, user_agent: str
    ) -> Dict[str, Any]:
        """
        Process complete simple login flow with all business logic.
        
        Delegates to LoginService for complete login orchestration (SRP principle).

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
        login_service = self._get_login_service()
        return login_service.process_login(username, password, ip, user_agent)

