"""
Connect Service
Handles all business logic for connect endpoints including authentication, validation, and token generation
Refactored to use specialized services following Single Responsibility Principle
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

import jwt

from ...config.config import Config
from ...core.extensions import db
from ...models.core import Project, User
from ...models.keys import Key
from ...services.auth.challenge_service import challenge_service
from ...services.keys import KeyValidator
from .analytics_tracker import AnalyticsTracker
from .challenge_validation_service import ChallengeValidationService
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

        self.orchestrator = ConnectOrchestrator()

        self.key_validator = KeyValidator()
        self.security_checker = SecurityChecker()
        self.device_manager = DeviceManager()
        self.analytics_tracker = AnalyticsTracker()
        self.response_builder = ResponseBuilder()
        self.key_lookup = KeyLookupService()
        self.request_validator = RequestValidationService()
        self.challenge_validator = ChallengeValidationService()

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

            from ...utils.project_settings_migration import ProjectSettingsHelper
            
            helper = ProjectSettingsHelper(project_id)
            offline_auth_settings = helper.get_offline_auth_settings()
            
            if not offline_auth_settings.offline_auth_enabled:
                logger.debug(f"OFFLINE_AUTH_DISABLED project_id={project_id}")
                return None

            expiration_hours = offline_auth_settings.offline_ticket_expiration_hours or 12

            expiration_hours = max(1, min(168, expiration_hours))

            product_id = key_obj.product_id if key_obj.product_id else None

            max_devices = key_obj.max_devices if key_obj.max_devices else 1

            now = datetime.utcnow()
            payload = {
                "iss": "panel-offline-auth",
                "sub": user_key,
                "fid": fingerprint,
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(hours=expiration_hours)).timestamp()),
                "prj": project_id,
                "gms": [product_id] if product_id else [],
                "max_dev": max_devices,
            }

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

            is_valid, error_msg = self.request_validator.validate_user_key_format(user_key)
            if not is_valid:
                logger.error(f"CHALLENGE_INVALID_USER_KEY ip={ip} user_key={user_key}")
                return {"error": error_msg}, 400

            key_obj, project_id, error_msg = self.key_lookup.find_key_in_project(
                user_key, client_project_id
            )
            if not key_obj:
                logger.warning(
                    f"CHALLENGE_KEY_NOT_FOUND ip={ip} user_key={user_key} error={error_msg}"
                )
                status = 403 if "not found" in error_msg else 400
                return {"error": error_msg}, status

            if self.security_checker.check_fingerprint_blocked(fingerprint, project_id):
                logger.warning(
                    f"CHALLENGE_FINGERPRINT_BLOCKED fingerprint={fingerprint} user_key={user_key} project_id={project_id}"
                )
                return {
                    "error": "Access denied",
                    "message": "Your device fingerprint has been blocked",
                }, 403

            enhanced_challenge = challenge_service.create_enhanced_challenge(user_key, fingerprint)
            logger.debug(
                f"ENHANCED_CHALLENGE_GENERATED successfully, keys={list(enhanced_challenge.keys())}"
            )

            # Use ChallengeValidationService to store challenge (single responsibility)
            canary = self.challenge_validator.store_challenge(user_key, fingerprint, enhanced_challenge, project_id, ip)

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

                from ...models.keys import ConnectToken, Key

                if not token or len(token) != 64:
                    logger.warning(f"INVALID_TOKEN_FORMAT ip={ip} token={token[:20] if token else 'None'}...")
                    return {"error": "Invalid token"}, 401

                connect_token = ConnectToken.query.filter_by(token=token).first()

                if not connect_token:
                    logger.warning(f"TOKEN_NOT_FOUND ip={ip} token={token[:20]}...")
                    return {"error": "Invalid token"}, 401

                if connect_token.expires_at and connect_token.expires_at < datetime.utcnow():
                    logger.warning(f"TOKEN_EXPIRED ip={ip} token={token[:20]}...")
                    return {"error": "Token expired"}, 401

                connect_token.last_used = datetime.utcnow()
                db.session.commit()

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

                from ...utils.service_helpers import get_service

                auth_service = get_service('auth_service')
                response_data, error_code, error_message = auth_service.process_simple_login(
                    username, password, ip, user_agent
                )

                if not response_data:

                    status_code = 401 if error_code == "INVALID_CREDENTIALS" else 403
                    return {
                        "error": error_code or "INVALID_CREDENTIALS",
                        "msg": error_message or "Invalid username or password",
                    }, status_code

                user_id = response_data.get("user_id")
                if user_id:
                    user = User.query.get(user_id)
                    if not user:
                        logger.error(f"USER_NOT_FOUND_AFTER_LOGIN ip={ip} user_id={user_id}")
                        return {"error": "User not found"}, 404
                else:

                    user = User.query.filter_by(username=username).first()
                    if not user:
                        logger.error(f"USER_NOT_FOUND_AFTER_LOGIN ip={ip} username={username}")
                        return {"error": "User not found"}, 404

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

            if username and password:

                from ...utils.rbac_utils import RBACManager
                from ...utils.role_constants import UserRoles
                user_roles = RBACManager.get_user_role_names(user)
                primary_role = user_roles[0] if user_roles else UserRoles.CLIENT.value

                classic_response = {
                    "user_id": user.id,
                    "username": user.username,
                    "role": primary_role,
                    "roles": user_roles,
                    "email": user.email,
                    "project_id": user.project_id,
                    "login_type": "classic_web",
                    "notifications": notifications,
                    "login_success": True,

                    "access_token": response_data.get("access_token"),
                }

                self.analytics_tracker.log_user_activity(
                    user, "classic_connect", f"username={username}", ip
                )
                return classic_response, 200
            else:

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

connect_service = ConnectService()
