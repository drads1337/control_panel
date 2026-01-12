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
from ...services.keys import KeyValidator
from ...utils.service_exceptions import ValidationError, NotFoundError, ServiceError, SecurityError, AuthenticationError
from .analytics_tracker import AnalyticsTracker
from .challenge_validation_service import ChallengeValidationService
from .device_manager import DeviceManager
from .response_builder import ResponseBuilder
from .security_checker import SecurityChecker
from .connect_orchestrator import ConnectOrchestrator
from .key_lookup_service import KeyLookupService
from .request_validation_service import RequestValidationService


from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.auth.challenge_service import ChallengeService
    from ...services.auth.auth_service import AuthService

logger = logging.getLogger(__name__)

class ConnectService:
    """Service for handling connect endpoint business logic"""

    def __init__(
        self,
        challenge_service: 'ChallengeService',
        auth_service: 'AuthService',
        logger=None
    ):
        """
        Initialize ConnectService with explicit dependencies.
        
        Args:
            challenge_service: Service for challenge operations
            auth_service: Service for authentication operations
            logger: Optional logger instance
        """
        if logger:
            self.logger = logger
        else:
            self.logger = logging.getLogger(__name__)

        self._challenge_service = challenge_service
        self._auth_service = auth_service

        # Resolve optional dependencies via DI container if available
        try:
            from ...utils.service_helpers import get_service
        except Exception:
            get_service = None

        def _get(name, fallback=None):
            if fallback is not None:
                return fallback
            if get_service:
                try:
                    return get_service(name)
                except Exception:
                    logger.warning(f"{name} not available from service container")
            return None

        security_service = _get("security_service")
        analytics_buffer_service = _get("analytics_buffer_service")
        heartbeat_service = _get("heartbeat_service")
        activity_service = _get("activity_service")

        # Pass challenge_service to orchestrator and challenge_validator
        self.orchestrator = ConnectOrchestrator(
            challenge_service=challenge_service,
            security_service=security_service,
            analytics_buffer_service=analytics_buffer_service,
            heartbeat_service=heartbeat_service,
            activity_service=activity_service,
        )

        self.key_validator = KeyValidator()
        self.security_checker = SecurityChecker(security_service=security_service)
        self.device_manager = DeviceManager()
        self.analytics_tracker = AnalyticsTracker(
            activity_service=activity_service,
            analytics_buffer_service=analytics_buffer_service,
            heartbeat_service=heartbeat_service,
        )
        self.response_builder = ResponseBuilder()
        self.key_lookup = KeyLookupService()
        self.request_validator = RequestValidationService()
        self.challenge_validator = ChallengeValidationService(challenge_service=challenge_service)
    
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
        self, user_key: str, fingerprint: str, client_project_id: Optional[int], ip: str, fast: bool = False, library_hash: Optional[str] = None
    ) -> Tuple[Dict[str, Any], int]:
        """
        Handle challenge generation request

        Args:
            user_key: User key
            fingerprint: Device fingerprint
            client_project_id: Client project ID (optional)
            ip: Client IP address
            library_hash: SHA-256 hash of library build (optional)

        Returns:
            Tuple of (response_dict, status_code)
        """
        try:

            self.request_validator.validate_user_key_format(user_key)


            key_obj, project_id = self.key_lookup.find_key_in_project(
                user_key, client_project_id
            )

            # SECURITY: Library hash verification first, fail-fast on mismatch
            if key_obj:
                try:
                    from ...utils.service_helpers import get_service
                    library_hash_service = get_service('library_hash_service')
                    is_valid, error_msg, entity_type = library_hash_service.validate_library_hash(
                        key_obj, library_hash or ""
                    )
                    
                    if not is_valid:
                        entity_name = "Agent" if entity_type == "agent" else "Product"
                        entity_id = key_obj.agent_id if entity_type == "agent" else key_obj.product_id
                        hash_prefix = library_hash[:16] + "..." if library_hash else "missing"
                        logger.warning(
                            f"CHALLENGE_LIBRARY_HASH_MISMATCH ip={ip} user_key={user_key} "
                            f"project_id={project_id} {entity_name.lower()}_id={entity_id} "
                            f"hash={hash_prefix} error_msg={error_msg}"
                        )
                        user_friendly_msg = error_msg if error_msg else f"{entity_name} library build verification failed. Please update to the latest version."
                        raise SecurityError(
                            user_friendly_msg,
                            error_code="LIBRARY_HASH_MISMATCH",
                            context={
                                "entity_type": entity_type,
                                "entity_id": entity_id,
                                "hash": hash_prefix
                            }
                        )
                except SecurityError:
                    raise  # Пробросить SecurityError дальше
                except Exception as e:
                    # Логируем ошибку, но не блокируем подключение
                    logger.error(
                        f"CHALLENGE_LIBRARY_HASH_CHECK_ERROR ip={ip} user_key={user_key} error={e}",
                        exc_info=True
                    )


            if self.security_checker.check_fingerprint_blocked(fingerprint, project_id):
                logger.warning(
                    f"CHALLENGE_FINGERPRINT_BLOCKED fingerprint={fingerprint} user_key={user_key} project_id={project_id}"
                )
                raise SecurityError(
                    "Access denied: Your device fingerprint has been blocked",
                    error_code="FINGERPRINT_BLOCKED",
                    context={"fingerprint": fingerprint, "project_id": project_id}
                )


            if not self._challenge_service:
                raise ServiceError(
                    "ChallengeService dependency not injected",
                    status_code=500,
                    context={"user_key": user_key}
                )
            enhanced_challenge = self._challenge_service.create_enhanced_challenge(user_key, fingerprint, fast=fast)
            logger.debug(
                f"ENHANCED_CHALLENGE_GENERATED successfully, keys={list(enhanced_challenge.keys())}"
            )


            canary = self.challenge_validator.store_challenge(user_key, fingerprint, enhanced_challenge, project_id, ip)

            logger.info(f"ENHANCED_CHALLENGE_CREATED user_key={user_key}")

            return {
                "challenge": enhanced_challenge,
                "canary": canary,
                "project_id": project_id,
                "challenge_type": "enhanced",
            }, 200

        except ValidationError as e:


            logger.warning(f"CHALLENGE_VALIDATION_ERROR ip={ip} user_key={user_key} error={e.message}")
            raise
        except NotFoundError as e:

            logger.warning(f"CHALLENGE_NOT_FOUND ip={ip} user_key={user_key} error={e.message}")
            raise
        except SecurityError as e:
            error_code = getattr(e, 'error_code', 'SECURITY_ERROR')
            error_message = getattr(e, 'message', str(e)) or "Access denied"
            logger.warning(
                f"CHALLENGE_SECURITY_ERROR ip={ip} user_key={user_key} code={error_code} msg={error_message}"
            )
            return {
                "error": error_code,
                "msg": error_message,
            }, 403
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"CHALLENGE_ERROR ip={ip} user_key={user_key} error={e}")
            logger.error(f"CHALLENGE_ERROR_TRACEBACK: {error_traceback}")

            raise ServiceError(
                "Internal server error",
                status_code=500,
                context={"ip": ip, "user_key": user_key}
            ) from e

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
        self,
        token: Optional[str],
        username: Optional[str],
        password: Optional[str],
        ip: str,
        user_agent: str = "",
        fingerprint: Optional[str] = None,
        cert_fingerprint: Optional[str] = None,
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

                if connect_token.fingerprint and not fingerprint:
                    logger.warning(f"TOKEN_FINGERPRINT_REQUIRED ip={ip} token={token[:20]}...")
                    return {"error": "Token requires device fingerprint"}, 401

                if connect_token.fingerprint and fingerprint and connect_token.fingerprint != fingerprint:
                    logger.warning(f"TOKEN_FINGERPRINT_MISMATCH ip={ip} token={token[:20]}...")
                    return {"error": "Token bound to another device"}, 401

                if connect_token.cert_fingerprint and not cert_fingerprint:
                    logger.warning(f"TOKEN_CERT_REQUIRED ip={ip} token={token[:20]}...")
                    return {"error": "Token requires client certificate"}, 401

                if connect_token.cert_fingerprint and cert_fingerprint and connect_token.cert_fingerprint != cert_fingerprint:
                    logger.warning(f"TOKEN_CERT_MISMATCH ip={ip} token={token[:20]}...")
                    return {"error": "Token bound to another certificate"}, 401

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


                if not self._auth_service:
                    raise ServiceError(
                        "AuthService dependency not injected",
                        status_code=500,
                        context={"username": username, "ip": ip}
                    )
                response_data = self._auth_service.process_simple_login(
                    username, password, ip, user_agent
                )

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

        except SecurityError as e:
            error_code = getattr(e, 'error_code', 'SECURITY_ERROR')
            error_message = getattr(e, 'message', str(e)) or "Access denied due to security constraints"
            
            if error_code == "ACCOUNT_EXPIRED":
                logger.warning(f"CLASSIC_CONNECT_EXPIRED_ACCOUNT ip={ip} error={error_message}")
                return {
                    "error": "ACCOUNT_EXPIRED",
                    "msg": "Your account has expired. Please contact the administrator for assistance.",
                }, 403
            elif error_code == "PROJECT_INACTIVE":
                logger.warning(f"CLASSIC_CONNECT_INACTIVE_PROJECT ip={ip} error={error_message}")
                return {
                    "error": "PROJECT_INACTIVE",
                    "msg": "Project is paused. Please contact the administrator for additional information.",
                }, 403
            
            logger.warning(f"CLASSIC_CONNECT_SECURITY_ERROR ip={ip} error_code={error_code} error={error_message}")
            return {
                "error": error_code,
                "msg": error_message,
            }, 403
        except AuthenticationError as e:
            logger.warning(f"CLASSIC_CONNECT_AUTH_ERROR ip={ip} error={e.message}")
            return {
                "error": "INVALID_CREDENTIALS",
                "msg": e.message or "Invalid username or password",
            }, 401
        except Exception as e:
            logger.error(f"CLASSIC_CONNECT_ERROR ip={ip} error={e}")
            import traceback

            logger.error(f"CLASSIC_CONNECT_ERROR_TRACEBACK: {traceback.format_exc()}")
            return {"error": "Internal server error"}, 500