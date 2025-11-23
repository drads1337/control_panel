"""
Connect Orchestrator
Coordinates the connect authentication flow using specialized services
Single Responsibility: Orchestration of the connect flow
"""

import logging
from typing import Any, Dict, Optional, Tuple

from ...config.config import Config
from ...core.extensions import db
from ...models.core import User
from ...services.keys import key_validator
from ...services.validation import request_validation_pipeline
from .analytics_tracker import AnalyticsTracker
from .challenge_validation_service import ChallengeValidationService
from .decryption_service import DecryptionService
from .device_manager import DeviceManager
from .key_lookup_service import KeyLookupService
from .request_validation_service import RequestValidationService
from .response_builder import ResponseBuilder
from .security_checker import SecurityChecker
from .token_generation_service import TokenGenerationService

logger = logging.getLogger(__name__)

class ConnectOrchestrator:
    """
    Orchestrates the connect authentication flow
    Coordinates specialized services to handle the complete authentication process
    """

    def __init__(self):
        """Initialize orchestrator with all required services"""

        self.decryption_service = DecryptionService()
        self.request_validator = RequestValidationService()
        self.key_lookup = KeyLookupService()
        self.challenge_validator = ChallengeValidationService()
        # SECURITY: Token generator uses Config.TOKEN_STATIC_WORD from environment
        self.token_generator = TokenGenerationService()

        self.security_checker = SecurityChecker()
        self.device_manager = DeviceManager()
        self.analytics_tracker = AnalyticsTracker()
        self.response_builder = ResponseBuilder()

    def process_connect_request(
        self,
        enc_data: str,
        ip: str,
        user_agent: str,
        project_id: Optional[str] = None,
    ) -> Tuple[str, int]:
        """
        Process main connect request - orchestrates the complete authentication flow

        Args:
            enc_data: Encrypted request data
            ip: Client IP address
            user_agent: Client user agent
            project_id: Optional project ID if client uses project-specific encryption

        Returns:
            Tuple of (encrypted_response_string, status_code)
        """
        user_key = None
        successful_project_id = None
        used_global_key = False

        try:
            # Use unified validation pipeline for IP and User-Agent (DRY principle)
            # Note: project_id may not be available yet, so we validate User-Agent first
            validation_result = request_validation_pipeline.validate_request(
                ip=ip,
                user_agent=user_agent,
                project_id=None,  # Will be validated later when project_id is known
            )
            if not validation_result.is_valid:
                logger.warning(
                    f"SUSPICIOUS_REQUEST ip={ip} user_agent={user_agent} reason={validation_result.reason}"
                )
                self.security_checker.log_suspicious_activity(ip, validation_result.reason, user_agent)
                return self._build_error_response("Access denied", used_global_key, successful_project_id), 403

            data, used_global_key, successful_project_id = self.decryption_service.decrypt_request_data(
                enc_data, project_id=project_id, ip=ip
            )
            if not data:
                logger.error(f"EMPTY_DATA ip={ip}")
                self.security_checker.log_suspicious_activity(ip, "EMPTY_DATA")
                return self._build_error_response("Invalid request data", used_global_key, successful_project_id), 400

            is_valid, error_msg = self.request_validator.validate_request_data(data)
            if not is_valid:
                logger.error(f"VALIDATION_ERROR ip={ip} error={error_msg}")
                return self._build_error_response(error_msg, used_global_key, successful_project_id), 400

            fields = self.request_validator.extract_request_fields(data)
            user_key = fields.get("user_key")

            is_valid, error_msg = self.request_validator.validate_user_key_format(user_key)
            if not is_valid:
                logger.error(f"INVALID_USER_KEY ip={ip} user_key={user_key}")
                self.security_checker.log_suspicious_activity(ip, "INVALID_USER_KEY", str(user_key))
                return self._build_error_response(error_msg, used_global_key, successful_project_id), 400

            logger.info(
                f"CONNECT_DATA ip={ip} user_key={user_key} product={fields.get('product')} serial={fields.get('serial')}"
            )

            key_obj, project_id, error_msg = self.key_lookup.find_key_in_project(
                user_key, fields.get("project_id")
            )
            if not key_obj:
                logger.warning(
                    f"CONNECT_KEY_VALIDATION_FAILED ip={ip} user_key={user_key} error={error_msg}"
                )
                return self._build_error_response(error_msg, used_global_key, successful_project_id), 403

            # Now that we have project_id, validate IP address (DRY principle)
            ip_validation_result = request_validation_pipeline.validate_ip_only(
                ip=ip, project_id=project_id
            )
            if not ip_validation_result[0]:
                logger.warning(
                    f"IP_BLOCKED ip={ip} user_key={user_key} project_id={project_id} reason={ip_validation_result[1]}"
                )
                self.security_checker.log_suspicious_activity(ip, ip_validation_result[1], user_agent)
                return self._build_error_response("Access denied", used_global_key, project_id), 403

            is_valid, error_msg, project = key_validator.validate_project_status(project_id)
            if not is_valid:
                logger.warning(
                    f"PROJECT_INACTIVE ip={ip} user_key={user_key} project_id={project_id}"
                )
                error_response = self.response_builder.build_project_inactive_response(project)
                encrypted_response = self.response_builder.encrypt_response(
                    error_response,
                    used_global_key=used_global_key,
                    project_id=project_id,
                    use_legacy=True,
                )
                return encrypted_response, 403

            if self.security_checker.check_fingerprint_blocked(fields.get("fingerprint"), project_id):
                logger.warning(
                    f"FINGERPRINT_BLOCKED ip={ip} user_key={user_key} project_id={project_id}"
                )
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=FINGERPRINT_BLOCKED", ip)
                error_response = self.response_builder.build_error_response(
                    "Access denied", project_id
                )
                error_response["message"] = "Your device fingerprint has been blocked"
                encrypted_response = self.response_builder.encrypt_response(
                    error_response,
                    used_global_key=used_global_key,
                    project_id=project_id,
                    use_legacy=True,
                )
                return encrypted_response, 403

            is_blocked, block_reason = self.security_checker.enhanced_fingerprint_security_check(
                fields.get("fingerprint"), ip, user_agent, user_key, project_id
            )
            if is_blocked:
                logger.warning(
                    f"ENHANCED_SECURITY_BLOCK ip={ip} user_key={user_key} reason={block_reason}"
                )
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=ENHANCED_SECURITY_BLOCK", ip)
                error_response = self.response_builder.build_error_response(
                    "Access denied", project_id
                )
                error_response["message"] = f"Security block: {block_reason}"
                encrypted_response = self.response_builder.encrypt_response(
                    error_response,
                    used_global_key=used_global_key,
                    project_id=project_id,
                    use_legacy=True,
                )
                return encrypted_response, 403

            is_valid, error_msg, product_obj = key_validator.validate_product_access(
                key_obj, fields.get("product"), project_id
            )
            if not is_valid:
                logger.warning(f"PRODUCT_ACCESS_DENIED ip={ip} user_key={user_key} product={fields.get('product')}")
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=PRODUCT_ACCESS_DENIED", ip)

                if product_obj and product_obj.status in ["inactive", "maintenance"]:
                    error_response = self.response_builder.build_product_inactive_response(product_obj)
                else:
                    error_response = self.response_builder.build_error_response("Key not found")
                encrypted_response = self.response_builder.encrypt_response(
                    error_response,
                    used_global_key=used_global_key,
                    project_id=project_id,
                    use_legacy=True,
                )
                return encrypted_response, 403

            is_valid, error_msg = key_validator.validate_user_authorization(key_obj, project_id)
            if not is_valid:
                logger.warning(
                    f"USER_AUTHORIZATION_FAILED ip={ip} user_key={user_key} error={error_msg}"
                )
                return self._build_error_response(error_msg, used_global_key, project_id), 403

            is_valid, error_msg = key_validator.validate_single_device_fingerprint(
                key_obj, fields.get("fingerprint")
            )
            if not is_valid:
                logger.warning(f"DEVICE_MISMATCH ip={ip} user_key={user_key}")
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=DEVICE_MISMATCH", ip)
                return self._build_error_response("Device mismatch", used_global_key, project_id), 403

            is_valid, error_msg = self.challenge_validator.validate_challenge_response(
                user_key,
                fields.get("fingerprint"),
                fields.get("challenge_response"),
                fields.get("canary"),
            )
            if not is_valid:
                logger.warning(f"CHALLENGE_FAILED ip={ip} user_key={user_key} error={error_msg}")
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=CHALLENGE_FAIL", ip)
                return self._build_error_response(error_msg, used_global_key, project_id), 403

            self.challenge_validator.cleanup_challenge(user_key, fields.get("fingerprint"))

            geo = self.security_checker.behavioral_analysis(user_key, ip, fields.get("fingerprint"))

            is_valid, error_msg = key_validator.validate_key_status(key_obj)
            if not is_valid:
                logger.warning(f"KEY_INVALID ip={ip} user_key={user_key} error={error_msg}")
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=KEY_INVALID", ip)
                return self._build_error_response(error_msg, used_global_key, project_id), 403

            key_validator.activate_key_if_needed(key_obj)

            is_valid, error_msg = key_validator.validate_device_limit(key_obj, fields.get("serial"))
            if not is_valid:
                logger.warning(
                    f"DEVICE_LIMIT_EXCEEDED ip={ip} user_key={user_key} error={error_msg}"
                )
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=MAX_DEVICES", ip)
                return self._build_error_response(error_msg, used_global_key, project_id), 403

            success, msg = self.device_manager.register_device(
                key_obj,
                fields.get("serial"),
                fields.get("device_id"),
                fields.get("device_model"),
                fields.get("device_brand"),
                ip,
            )
            if not success:
                logger.warning(
                    f"DEVICE_REGISTRATION_FAILED ip={ip} user_key={user_key} error={msg}"
                )
                self._log_user_activity(key_obj, project_id, "api_connect_error", f"user_key={user_key}, reason=DEVICE_REGISTRATION_FAILED", ip)
                return self._build_error_response(msg, used_global_key, project_id), 403

            logger.info(
                f"LOGIN_SUCCESS ip={ip} user_key={user_key} product={fields.get('product')} serial={fields.get('serial')}"
            )

            self.analytics_tracker.update_key_analytics(
                key_obj.id, fields.get("product"), ip, fields.get("serial")
            )

            heartbeat_session = self.analytics_tracker.create_heartbeat_session(
                user_key,
                fields.get("fingerprint"),
                fields.get("product"),
                fields.get("serial"),
                ip,
            )

            expires_at, seconds_left, seconds_left_human = (
                key_validator.get_key_expiration_info(key_obj)
            )

            token = self.token_generator.generate_connect_token(
                product=fields.get("product"),
                user_key=user_key,
                serial=fields.get("serial"),
                user_id=key_obj.user_id,
                key_id=key_obj.id,
                expires_at=key_obj.expires_at,
                is_classic=False,
            )

            notifications = self.analytics_tracker.get_notifications(project_id, key_obj.user_id)

            offline_ticket = self._generate_offline_ticket(
                user_key=user_key,
                fingerprint=fields.get("fingerprint"),
                project_id=project_id,
                key_obj=key_obj,
            )

            response = self.response_builder.build_success_response(
                token,
                project_id,
                expires_at,
                seconds_left,
                seconds_left_human,
                notifications,
                heartbeat_session,
                offline_ticket=offline_ticket,
            )

            logger.info(
                f"ENCRYPTING_RESPONSE used_global_key={used_global_key} project_id={project_id}"
            )
            encrypted_response = self.response_builder.encrypt_response(
                response, used_global_key=used_global_key, project_id=project_id, use_legacy=True
            )

            self._log_user_activity(
                key_obj, project_id, "api_connect",
                f"user_key={user_key}, product={fields.get('product')}, serial={fields.get('serial')}", ip
            )

            return encrypted_response, 200

        except (ValueError, KeyError, AttributeError, TypeError) as e:
            # Logical errors - these indicate bugs or invalid data, log with full traceback
            logger.error(
                f"CONNECT_LOGICAL_ERROR ip={ip} user_key={user_key if user_key else 'unknown'} "
                f"error_type={type(e).__name__} error={e}",
                exc_info=True
            )
            self.security_checker.log_suspicious_activity(ip, "LOGICAL_ERROR", str(e))
            error_response = self.response_builder.build_error_response("Invalid request data")
            encrypted_response = self._encrypt_error_response_safe(error_response, ip)
            return encrypted_response, 400

        except Exception as e:
            # System errors or unexpected exceptions - mask details in production
            logger.error(
                f"CONNECT_SYSTEM_ERROR ip={ip} user_key={user_key if user_key else 'unknown'} "
                f"error_type={type(e).__name__} error={e}",
                exc_info=True
            )
            self.security_checker.log_suspicious_activity(ip, "FATAL", str(e))
            error_response = self.response_builder.build_error_response("Internal server error")
            encrypted_response = self._encrypt_error_response_safe(error_response, ip)
            return encrypted_response, 500

    def _encrypt_error_response_safe(self, error_response: dict, ip: str) -> str:
        """
        Safely encrypt error response with fallback mechanisms
        
        Args:
            error_response: Error response dictionary
            ip: Client IP for logging
            
        Returns:
            Encrypted response string
        """
        # Always return encrypted response, even on error
        try:
            encrypted_response = self.response_builder.encrypt_response(
                error_response, used_global_key=True, use_legacy=True
            )
            return encrypted_response
        except Exception as encrypt_error:
            logger.error(
                f"ENCRYPTION_FAILED_IN_ERROR_HANDLER ip={ip} error={encrypt_error}",
                exc_info=True
            )
            # Last resort: use MasterKeyManager directly
            try:
                import json
                from ...utils.secure_crypto import MasterKeyManager
                from ...config.config import Config

                error_json = json.dumps(error_response)
                encrypted_response = MasterKeyManager.encrypt_with_master_key_legacy(
                    error_json, Config.MASTER_KEY
                )
                logger.info("Used MasterKeyManager directly as fallback for error encryption")
                return encrypted_response
            except Exception as final_error:
                logger.critical(
                    f"CRITICAL: Failed to encrypt error response ip={ip} error={final_error}",
                    exc_info=True
                )
                # This should never happen, but if it does, return a minimal encrypted response
                import json
                from ...utils.secure_crypto import MasterKeyManager
                from ...config.config import Config

                minimal_error = {"error": "Internal server error", "r": "0000000000000000"}
                encrypted_response = MasterKeyManager.encrypt_with_master_key_legacy(
                    json.dumps(minimal_error), Config.MASTER_KEY
                )
                return encrypted_response

    def _build_error_response(
        self,
        error_message: str,
        used_global_key: bool,
        project_id: Optional[int],
        additional_message: Optional[str] = None,
    ) -> str:
        """Build and encrypt error response"""
        error_response = self.response_builder.build_error_response(
            error_message, project_id
        )
        if additional_message:
            error_response["message"] = additional_message
        return self.response_builder.encrypt_response(
            error_response,
            used_global_key=used_global_key,
            project_id=project_id,
            use_legacy=True,
        )

    def _log_user_activity(
        self, key_obj, project_id: int, action: str, details: str, ip: str
    ) -> None:
        """Log user activity if user exists"""
        user = (
            User.query.filter_by(id=key_obj.user_id, project_id=project_id).first()
            if key_obj.user_id
            else None
        )
        if user:
            self.analytics_tracker.log_user_activity(user, action, details, ip)

    def _generate_offline_ticket(
        self, user_key: str, fingerprint: str, project_id: int, key_obj
    ) -> Optional[str]:
        """Generate offline authentication ticket if enabled"""
        try:
            from ...utils.project_settings_migration import ProjectSettingsHelper
            import jwt
            from datetime import timedelta

            helper = ProjectSettingsHelper(project_id)
            offline_auth_settings = helper.get_offline_auth_settings()
            if not offline_auth_settings.offline_auth_enabled:
                logger.debug(f"OFFLINE_AUTH_DISABLED project_id={project_id}")
                return None

            expiration_hours = offline_auth_settings.offline_ticket_expiration_hours or 12

            expiration_hours = max(1, min(168, expiration_hours))

            product_id = key_obj.product_id if key_obj.product_id else None

            from datetime import datetime
            now = datetime.utcnow()
            payload = {
                "iss": "panel-offline-auth",
                "sub": user_key,
                "fid": fingerprint,
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(hours=expiration_hours)).timestamp()),
                "prj": project_id,
                "gms": [product_id] if product_id else [],
            }

            from ...config.config import Config
            offline_ticket = jwt.encode(payload, Config.OFFLINE_TICKET_SECRET, algorithm="HS256")

            logger.info(
                f"OFFLINE_TICKET_GENERATED user_key={user_key} project_id={project_id} "
                f"expires_in={expiration_hours}h"
            )
            return offline_ticket

        except Exception as e:
            logger.error(f"Error generating offline ticket: {e}")

            return None
