"""
Auth Token Service
Handles JWT token creation and management

Single Responsibility: JWT token operations only
Extracted from AuthService to follow SRP (Single Responsibility Principle)
"""

import logging
import uuid
from typing import Any, Dict

from flask import current_app, make_response
from flask_jwt_extended import create_access_token, set_access_cookies

from ...models.core import User
from ...utils.rbac_utils import RBACManager

class AuthTokenService:
    """
    Service for handling JWT token operations.
    
    Single Responsibility: Create and manage JWT tokens for authenticated users.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def create_access_token_for_user(self, user: User) -> str:
        """
        Create JWT access token for a user.
        
        Args:
            user: Authenticated user
            
        Returns:
            JWT access token string
        """
        try:
            access_token = create_access_token(identity=str(user.id))
            return access_token
        except Exception as e:
            self.logger.error(f"Error creating access token for user {user.id}: {str(e)}")
            raise

    def create_login_response(self, user: User, include_token: bool = False) -> Dict[str, Any]:
        """
        Create standardized login response with user data.
        
        Args:
            user: Authenticated user
            include_token: Whether to include access_token in response (default: False for security)
            
        Returns:
            Dictionary with login response data
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



            if include_token:
                response_data["access_token"] = self.create_access_token_for_user(user)

            return response_data

        except Exception as e:
            self.logger.error(f"Error creating login response: {str(e)}")
            raise

    def set_token_cookies(self, response, access_token: str) -> None:
        """
        Set JWT token in HTTP-only cookies for secure cookie-based authentication.
        
        Args:
            response: Flask response object
            access_token: JWT access token
        """
        try:
            set_access_cookies(response, access_token)
        except Exception as e:
            self.logger.error(f"Error setting token cookies: {str(e)}")
            raise

    def create_response_with_token_cookie(self, user: User, response_data: Dict[str, Any]) -> Any:
        """
        Create Flask response with JWT token set in HTTP-only cookie.
        
        Args:
            user: Authenticated user
            response_data: Response data dictionary
            
        Returns:
            Flask response object with token cookie set
        """
        try:
            access_token = self.create_access_token_for_user(user)
            response = make_response(response_data)
            self.set_token_cookies(response, access_token)
            return response
        except Exception as e:
            self.logger.error(f"Error creating response with token cookie: {str(e)}")
            raise

