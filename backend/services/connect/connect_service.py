"""
Connect Service
Handles all business logic for connect endpoints including authentication, validation, and token generation
Refactored to use specialized services following Single Responsibility Principle
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import jwt

from ...config.config import Config
from ...core.extensions import db
from ...models.core import Project, ProjectSettings, User
from ...models.keys import Key
from ...services.auth import challenge_service
from ...services.keys import KeyValidator
from .analytics_tracker import AnalyticsTracker
from .device_manager import DeviceManager
from .response_builder import ResponseBuilder
from .security_checker import SecurityChecker
from .connect_orchestrator import ConnectOrchestrator
from .key_lookup_service import KeyLookupService
from .request_validation_service import RequestValidationService

logger = logging.getLogger(__name__)


class ConnectService:
    """Service for handling connect endpoint business logic"""

    def __init__(self):
        # Main orchestrator for connect flow
        self.orchestrator = ConnectOrchestrator()
        
        # Supporting services for challenge and classic connect
        self.key_validator = KeyValidator()
        self.security_checker = SecurityChecker()
        self.device_manager = DeviceManager()
        self.analytics_tracker = AnalyticsTracker()
        self.response_builder = ResponseBuilder()
        self.key_lookup = KeyLookupService()
        self.request_validator = RequestValidationService()

    def generate_offline_ticket(
        self,
        user_key: str,
        fingerprint: str,
        project_id: int,
        key_obj: Key,
    ) -> Optional[str]:
        """
        Generate offline authentication ticket (JWT) for graceful offline authentication
        
        Args:
            user_key: User key
            fingerprint: Device fingerprint
            project_id: Project ID
            key_obj: Key object
            
        Returns:
            JWT token string or None if offline auth is disabled
        """
        try:
            # Check if offline authentication is enabled for this project
            project_settings = ProjectSettings.query.filter_by(project_id=project_id).first()
            if not project_settings or not project_settings.offline_auth_enabled:
                logger.debug(f"OFFLINE_AUTH_DISABLED project_id={project_id}")
                return None

            # Get expiration hours from project settings (default: 12 hours)
            expiration_hours = project_settings.offline_ticket_expiration_hours or 12
            
            # Validate expiration hours (min: 1 hour, max: 168 hours = 7 days)
            expiration_hours = max(1, min(168, expiration_hours))

            # Get game ID from key (if available)
            game_id = key_obj.game_id if key_obj.game_id else None
            
            # Get max_devices from key (not from project settings)
            # This ensures offline tickets respect the key's device limit
            max_devices = key_obj.max_devices if key_obj.max_devices else 1
            
            # Build JWT payload
            now = datetime.utcnow()
            payload = {
                "iss": "panel-offline-auth",  # Issuer
                "sub": user_key,  # Subject (the key itself)
                "fid": fingerprint,  # Fingerprint - device binding
                "iat": int(now.timestamp()),  # Issued at
                "exp": int((now + timedelta(hours=expiration_hours)).timestamp()),  # Expiration (from settings)
                "prj": project_id,  # Project ID
                "gms": [game_id] if game_id else [],  # List of accessible game IDs
                "max_dev": max_devices,  # Maximum devices from key (not from project settings)
            }

            # Encode JWT with offline ticket secret
            offline_ticket = jwt.encode(
                payload,
                Config.OFFLINE_TICKET_SECRET,
                algorithm="HS256"
            )

            logger.info(
                f"OFFLINE_TICKET_GENERATED user_key={user_key} project_id={project_id} "
                f"expires_in={expiration_hours}h"
            )
            return offline_ticket

        except Exception as e:
            logger.error(f"Error generating offline ticket: {e}")
            # Don't fail the entire authentication if offline ticket generation fails
            return None

    def handle_challenge_request(
        self, user_key: str, fingerprint: str, client_project_id: Optional[int], ip: str
    ) -> Tuple[Dict[str, Any], int]:
        """
        Handle challenge generation request

        Args:
            user_key: User key
            fingerprint: Device fingerprint
            client_project_id: Client project ID (optional)
            ip: Client IP address

        Returns:
            Tuple of (response_dict, status_code)
        """
        try:
            # Validate user_key format
            is_valid, error_msg = self.request_validator.validate_user_key_format(user_key)
            if not is_valid:
                logger.error(f"CHALLENGE_INVALID_USER_KEY ip={ip} user_key={user_key}")
                return {"error": error_msg}, 400

            # Validate key and project
            key_obj, project_id, error_msg = self.key_lookup.find_key_in_project(
                user_key, client_project_id
            )
            if not key_obj:
                logger.warning(
                    f"CHALLENGE_KEY_NOT_FOUND ip={ip} user_key={user_key} error={error_msg}"
                )
                status = 403 if "not found" in error_msg else 400
                return {"error": error_msg}, status

            # Check fingerprint blocking
            if self.security_checker.check_fingerprint_blocked(fingerprint, project_id):
                logger.warning(
                    f"CHALLENGE_FINGERPRINT_BLOCKED fingerprint={fingerprint} user_key={user_key} project_id={project_id}"
                )
                return {
                    "error": "Access denied",
                    "message": "Your device fingerprint has been blocked",
                }, 403

            # Generate enhanced challenge
            enhanced_challenge = challenge_service.create_enhanced_challenge(user_key, fingerprint)
            logger.debug(
                f"ENHANCED_CHALLENGE_GENERATED successfully, keys={list(enhanced_challenge.keys())}"
            )

            # Store challenge in Redis
            canary = self._store_challenge_in_redis(user_key, fingerprint, enhanced_challenge, project_id, ip)

            logger.info(f"ENHANCED_CHALLENGE_CREATED user_key={user_key}")

            return {
                "challenge": enhanced_challenge,
                "canary": canary,
                "project_id": project_id,
                "challenge_type": "enhanced",
            }, 200

        except Exception as e:
            import traceback

            error_traceback = traceback.format_exc()
            logger.error(f"CHALLENGE_ERROR ip={ip} user_key={user_key} error={e}")
            logger.error(f"CHALLENGE_ERROR_TRACEBACK: {error_traceback}")

            # Don't expose traceback to client - only log it
            error_response = {
                "error": "Internal server error",
                "message": "An error occurred while processing the challenge request",
            }

            return error_response, 500

    def handle_connect_request(
        self, enc_data: str, ip: str, user_agent: str, project_id: Optional[str] = None
    ) -> Tuple[str, int]:
        """
        Handle main connect request
        Delegates to orchestrator for complete flow coordination

        Args:
            enc_data: Encrypted request data
            ip: Client IP address
            user_agent: Client user agent
            project_id: Optional project ID if client uses project-specific encryption

        Returns:
            Tuple of (encrypted_response_string, status_code)
        """
        return self.orchestrator.process_connect_request(enc_data, ip, user_agent, project_id)

    def handle_classic_connect_request(
        self, token: Optional[str], username: Optional[str], password: Optional[str], ip: str, user_agent: str = ""
    ) -> Tuple[Dict[str, Any], int]:
        """
        Handle classic connect request
        
        SECURITY: For username/password authentication, this method now uses process_simple_login()
        which provides full security protections:
        - ✅ Brute-force protection via record_login_attempt()
        - ✅ IP blocking checks via check_project_security()
        - ✅ Session limit checks
        - ✅ Project active status checks
        - ✅ Suspicious activity logging via log_suspicious()
        - ✅ Webhook triggering for login events
        - ✅ User login info updates (last_login, last_ip, location)
        
        For token authentication, security is handled via token validation and expiration checks.
        
        Args:
            token: Classic token (optional) - uses token authentication without username/password
            username: Username (optional) - requires password, uses secure process_simple_login()
            password: Password (optional) - requires username, uses secure process_simple_login()
            ip: Client IP address
            user_agent: Client user agent string (required for username/password auth)

        Returns:
            Tuple of (response_dict, status_code)
        """
        try:
            user = None
            project = None

            if token:
                # Handle classic token authentication using secure database lookup
                from ...models.keys import ConnectToken, Key
                
                if not token or len(token) != 64:  # SHA256 produces 64 char hex string
                    logger.warning(f"INVALID_TOKEN_FORMAT ip={ip} token={token[:20] if token else 'None'}...")
                    return {"error": "Invalid token"}, 401
                
                # Direct indexed lookup - O(1) operation, no enumeration
                connect_token = ConnectToken.query.filter_by(token=token).first()
                
                if not connect_token:
                    logger.warning(f"TOKEN_NOT_FOUND ip={ip} token={token[:20]}...")
                    return {"error": "Invalid token"}, 401
                
                # Check expiration if set
                if connect_token.expires_at and connect_token.expires_at < datetime.utcnow():
                    logger.warning(f"TOKEN_EXPIRED ip={ip} token={token[:20]}...")
                    return {"error": "Token expired"}, 401
                
                # Update last_used timestamp
                connect_token.last_used = datetime.utcnow()
                db.session.commit()
                
                # Get user to verify it still exists and is active
                user = User.query.get(connect_token.user_id)
                if not user:
                    logger.warning(f"USER_NOT_FOUND ip={ip} user_id={connect_token.user_id}")
                    return {"error": "User not found"}, 404

                project = Project.query.filter_by(id=user.project_id).first()
                if not project:
                    logger.warning(
                        f"PROJECT_NOT_FOUND ip={ip} user_id={user.id} project_id={user.project_id}"
                    )
                    return {"error": "Project not found"}, 404

            elif username and password:
                # Handle username/password authentication using secure login flow
                # SECURITY: Use process_simple_login() to get all security protections
                from ...services.auth import auth_service

                # Use secure login flow with all protections (brute-force, IP blocking, etc.)
                response_data, error_code, error_message = auth_service.process_simple_login(
                    username, password, ip, user_agent
                )

                if not response_data:
                    # Security checks are already handled in process_simple_login()
                    # including log_suspicious() and record_login_attempt()
                    status_code = 401 if error_code == "INVALID_CREDENTIALS" else 403
                    return {
                        "error": error_code or "INVALID_CREDENTIALS",
                        "msg": error_message or "Invalid username or password",
                    }, status_code

                # Extract user from response
                user_id = response_data.get("user_id")
                if user_id:
                    user = User.query.get(user_id)
                    if not user:
                        logger.error(f"USER_NOT_FOUND_AFTER_LOGIN ip={ip} user_id={user_id}")
                        return {"error": "User not found"}, 404
                else:
                    # Fallback: find user by username if user_id not in response
                    user = User.query.filter_by(username=username).first()
                    if not user:
                        logger.error(f"USER_NOT_FOUND_AFTER_LOGIN ip={ip} username={username}")
                        return {"error": "User not found"}, 404

                # Project is already validated in process_simple_login() via check_project_security()
                # But we still need it for the response
                if user.project_id:
                    project = Project.query.filter_by(id=user.project_id).first()
                    if not project:
                        logger.warning(
                            f"PROJECT_NOT_FOUND ip={ip} user_id={user.id} project_id={user.project_id}"
                        )
                        return {"error": "Project not found"}, 404
            else:
                logger.warning(f"NO_AUTH_DATA ip={ip}")
                return {"error": "Missing authentication data"}, 400

            # Get notifications
            notifications = []
            try:
                from ...models.notifications import Notification

                notifications = (
                    Notification.query.filter_by(
                        user_id=user.id, project_id=user.project_id, is_read=False
                    )
                    .limit(10)
                    .all()
                )
                notifications = [
                    {
                        "id": n.id,
                        "title": n.title,
                        "message": n.message,
                        "created_at": n.created_at.isoformat(),
                    }
                    for n in notifications
                ]
            except Exception as e:
                logger.warning(f"Failed to get notifications: {e}")

            # Create response for username/password authentication
            if username and password:
                # access_token is already created by process_simple_login() and included in response_data
                # But we need to format it for classic_connect response format
                from ...utils.rbac_utils import RBACManager
                from ...utils.role_constants import UserRoles
                user_roles = RBACManager.get_user_role_names(user)
                primary_role = user_roles[0] if user_roles else UserRoles.CLIENT.value

                # Build classic_connect response format
                # process_simple_login() already did all security checks, logging, and webhooks
                classic_response = {
                    "user_id": user.id,
                    "username": user.username,
                    "role": primary_role,  # Use RBAC role, not static user.role
                    "roles": user_roles,  # Include all RBAC roles
                    "email": user.email,
                    "project_id": user.project_id,
                    "login_type": "classic_web",
                    "notifications": notifications,
                    "login_success": True,
                    # Include access_token if present (it will be set as cookie by route handler)
                    "access_token": response_data.get("access_token"),
                }

                # Log analytics (security logging already done in process_simple_login())
                self.analytics_tracker.log_user_activity(
                    user, "classic_connect", f"username={username}", ip
                )
                return classic_response, 200
            else:
                # Build classic connect response for token authentication
                response_data = self.response_builder.build_classic_connect_response(
                    token=token,
                    project_id=user.project_id,
                    notifications=notifications,
                    login_type="classic",
                )

                self.analytics_tracker.log_user_activity(
                    user, "classic_connect", f"token={token[:20]}...", ip
                )
                return response_data, 200

        except Exception as e:
            logger.error(f"CLASSIC_CONNECT_ERROR ip={ip} error={e}")
            import traceback

            logger.error(f"CLASSIC_CONNECT_ERROR_TRACEBACK: {traceback.format_exc()}")
            return {"error": "Internal server error"}, 500

    def _store_challenge_in_redis(
        self, user_key: str, fingerprint: str, enhanced_challenge: Dict[str, Any], project_id: int, ip: str
    ) -> str:
        """
        Store challenge in Redis

        Args:
            user_key: User key
            fingerprint: Device fingerprint
            enhanced_challenge: Challenge data
            project_id: Project ID (for fallback decryption)
            ip: Client IP address (for fallback decryption)

        Returns:
            Canary value
        """
        from ...utils.redis_client import get_redis_client

        # Use centralized Redis client for consistency and connection management
        redis_client = get_redis_client()

        redis_client.ping()
        logger.debug(f"REDIS_CONNECTION_SUCCESS")

        challenge_id = f"enhanced_challenge:{user_key}:{fingerprint}"
        canary = os.urandom(8).hex()

        pipe = redis_client.pipeline()
        pipe.setex(challenge_id, Config.CHALLENGE_TTL, json.dumps(enhanced_challenge))
        pipe.setex(f"canary:{user_key}:{fingerprint}", Config.CHALLENGE_TTL, canary)
        # Store project_id by IP for fallback decryption (TTL: 5 minutes)
        # This allows us to try project-specific decryption if global key fails
        pipe.setex(f"challenge_project_id:{ip}", 300, str(project_id))
        pipe.execute()

        logger.info(f"ENHANCED_CHALLENGE_SAVED user_key={user_key} fingerprint={fingerprint} project_id={project_id}")
        return canary


# Global service instance
connect_service = ConnectService()
