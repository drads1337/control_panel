import base64
import json
import os
import secrets
import traceback
from datetime import datetime

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import Project, ProjectEncryptionKeys, ProjectSettings, User
from ..models.security import BlockedFingerprint, LoginAttempt
from ..services.security import security_service
from ..utils.rbac_utils import RBACManager
from ..utils.secure_crypto import MasterKeyManager, decrypt_with_master_key, encrypt_with_master_key
from ..utils.structured_logging import get_logger

settings_bp = Blueprint("settings", __name__)
logger = get_logger(__name__)

def encrypt_data_with_project_key(data: dict, project_id: int) -> str:
    try:
        settings = get_or_create_project_settings(project_id)
        if not settings.project_master_key:
            raise ValueError("Project master key not found")

        raw = json.dumps(data)

        return MasterKeyManager.encrypt_with_master_key(raw, settings.project_master_key)
    except Exception as e:
        raise ValueError(f"Project encryption error: {str(e)}")

def decrypt_data_with_project_key(enc: str, project_id: int, use_gcm: bool = True) -> dict:
    try:
        if not enc:
            raise ValueError("Empty encrypted data")

        try:
            decoded = base64.b64decode(enc).decode("utf-8")
            data = json.loads(decoded)
            return data
        except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
            pass

        if len(enc) < 20:
            raise ValueError("Data too short for decryption")

        settings = get_or_create_project_settings(project_id)
        if not settings.project_master_key:
            raise ValueError("Project master key not found")

        try:

            try:
                decrypted_raw = MasterKeyManager.decrypt_with_master_key_legacy(
                    enc, settings.project_master_key
                )
            except Exception as gcm_error:

                logger.debug(
                    "Legacy GCM failed, trying standard method",
                    error=str(gcm_error)[:50],
                    project_id=project_id,
                )
                decrypted_raw = MasterKeyManager.decrypt_with_master_key(
                    enc, settings.project_master_key
                )
        except Exception as decrypt_error:
            if "not valid UTF-8" in str(decrypt_error) or "Invalid padding bytes" in str(
                decrypt_error
            ):
                raise ValueError(
                    f"Project master key mismatch detected. The encrypted data was created with a different project master key."
                )
            else:
                raise decrypt_error

        if not decrypted_raw:
            raise ValueError("Decryption returned empty data")

        try:
            return json.loads(decrypted_raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON after decryption: {str(e)}")

    except Exception as e:
        raise ValueError(f"Project decryption error: {str(e)}")

def get_user_project_id(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        default_project = Project(
            name=f"Default Project for {user.username}",
            description="Auto-created default project",
            admin_id=user.id,
            status="active",
        )
        db.session.add(default_project)
        db.session.flush()

        user.project_id = default_project.id
        db.session.commit()

        return default_project.id, None

    return user.project_id, None

def get_or_create_project_settings(project_id):
    settings = ProjectSettings.query.filter_by(project_id=project_id).first()
    if not settings:
        settings = ProjectSettings(project_id=project_id)
        settings.project_master_key = secrets.token_hex(32)
        db.session.add(settings)
        db.session.commit()
    elif not settings.project_master_key:
        settings.project_master_key = secrets.token_hex(32)
        db.session.commit()
    return settings

def get_project_security_settings(project_id):
    settings = get_or_create_project_settings(project_id)
    return {
        "min_password_length": settings.min_password_length,
        "max_login_attempts": settings.max_login_attempts,
        "max_sessions_per_user": settings.max_sessions_per_user,
        "log_retention_days": settings.log_retention_days,
        "security_log_level": settings.security_log_level,
    }

def check_login_attempts(ip_address, project_id):
    from datetime import datetime, timedelta, timezone

    settings = get_or_create_project_settings(project_id)
    max_attempts = settings.max_login_attempts
    block_duration = settings.ip_block_duration_minutes

    cutoff_time = datetime.utcnow() - timedelta(minutes=block_duration)

    failed_attempts = LoginAttempt.query.filter(
        LoginAttempt.ip_address == ip_address,
        LoginAttempt.project_id == project_id,
        LoginAttempt.success == False,
        LoginAttempt.created_at > cutoff_time,
    ).count()

    return failed_attempts >= max_attempts

def is_ip_blocked(ip_address, project_id):
    """
    Check if an IP address is blocked due to failed login attempts

    Args:
        ip_address: IP address to check
        project_id: Project ID

    Returns:
        True if IP is blocked, False otherwise
    """

    return security_service.is_ip_blocked(ip_address, project_id)

def record_login_attempt(ip_address, username, success, project_id, user_agent=None):
    """
    Record login attempt for security monitoring

    Args:
        ip_address: Client IP address
        username: Username attempting login
        success: Whether login was successful
        project_id: Project ID
        user_agent: Client user agent string
    """

    security_service.record_login_attempt(ip_address, username, success, project_id, user_agent)

def check_session_limit(user_id, project_id):
    """
    Check session limit - temporarily disabled due to flawed logic
    The current implementation counts login activities rather than active sessions,
    which causes legitimate logins to be blocked.

    TODO: Implement proper session tracking with JWT token validation

    Args:
        user_id: User ID
        project_id: Project ID

    Returns:
        True if session limit exceeded, False otherwise
    """

    return security_service.check_session_limit(user_id, project_id)

def get_or_create_project_keys(project_id):
    keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id).first()
    if not keys:
        aes_key = secrets.token_hex(32)

        private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        public_key = private_key.public_key()

        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

        keys = ProjectEncryptionKeys(
            project_id=project_id,
            aes_key=aes_key,
            public_key_cert=public_pem,
            private_key_encrypted=private_pem,
            key_metadata=json.dumps({"algorithm": "RSA", "key_size": 2048, "aes_key_size": 256}),
        )
        db.session.add(keys)
        db.session.commit()

    return keys

@settings_bp.route("/api/settings", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_settings():
    try:
        from flask import g
        user_id = get_jwt_identity()
        # Get project_id from context (set by middleware)
        project_id = getattr(g, "project_id", None)
        logger.info("Getting settings", user_id=user_id, project_id=project_id)

        from ..services.settings import settings_service

        result = settings_service.get_settings_cached(user_id=user_id)

        if result is None:
            logger.error("Settings service returned None", user_id=user_id, project_id=project_id)
            return jsonify({"error": "Settings service returned no data"}), 500

        if not isinstance(result, dict):
            logger.error(
                "Settings service returned unexpected type",
                user_id=user_id,
                project_id=project_id,
                result_type=str(type(result)),
            )
            return (
                jsonify({"error": f"Settings service returned unexpected type: {type(result)}"}),
                500,
            )

        logger.debug(
            "Settings service result",
            user_id=user_id,
            project_id=project_id,
            result_type=str(type(result)),
            has_error="error" in result,
        )

        if "error" in result:
            error_msg = result.get("error", "Unknown error")
            logger.error(
                "Settings service returned error",
                user_id=user_id,
                project_id=project_id,
                error=error_msg,
            )
            try:
                error_response = {
                    "error": error_msg,
                    "details": str(error_msg),
                    "source": "settings_service",
                }
                if "not found" in error_msg.lower():
                    return jsonify(error_response), 404
                elif "must be assigned" in error_msg.lower():
                    return jsonify(error_response), 403
                else:
                    return jsonify(error_response), 500
            except Exception as json_error:
                logger.error(
                    "Error serializing error response",
                    user_id=user_id,
                    project_id=project_id,
                    error=str(json_error),
                )
                return (
                    jsonify(
                        {
                            "error": f"Failed to serialize error response: {str(json_error)}",
                            "original_error": error_msg,
                        }
                    ),
                    500,
                )

        try:
            import json as json_module

            json_module.dumps(result)
        except (TypeError, ValueError) as ser_error:
            logger.error(
                "Result cannot be JSON serialized",
                user_id=user_id,
                project_id=project_id,
                error=str(ser_error),
                result_type=str(type(result)),
            )
            return (
                jsonify({"error": f"Response contains non-serializable data: {str(ser_error)}"}),
                500,
            )

        logger.info("Settings retrieved successfully", user_id=user_id, project_id=project_id)
        try:
            return jsonify(result)
        except Exception as json_error:
            logger.error(
                "Error serializing response to JSON",
                user_id=user_id,
                project_id=project_id,
                error=str(json_error),
            )
            return jsonify({"error": "Failed to serialize response"}), 500

    except Exception as e:
        import traceback

        error_traceback = traceback.format_exc()
        error_msg = f"Failed to retrieve settings: {str(e)}"
        try:
            user_id = get_jwt_identity()
            project_id = getattr(request, "project_id", None)
            logger.error(
                "Error getting settings",
                error=str(e),
                traceback=error_traceback,
                user_id=user_id,
                project_id=project_id,
            )
        except:

            logger.error("Error getting settings (fallback)", error=error_msg, traceback=error_traceback)
        try:
            return jsonify({"error": error_msg}), 500
        except:

            from flask import Response

            return Response(f'{{"error": "{error_msg}"}}', mimetype="application/json"), 500

@settings_bp.route("/api/settings", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_settings():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        user_role = (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" if user else "User not found"
        )
        logger.debug("User role", user_id=user_id, project_id=project_id, role=user_role)
        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage"):
            logger.debug(
                "Access denied for user",
                user_id=user_id,
                project_id=project_id,
                role=user_role,
            )
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        logger.debug("Received settings data", user_id=user_id, project_id=project_id, data_keys=list(data.keys()))

        settings = get_or_create_project_settings(project_id)
        logger.debug(
            "Current settings before update",
            user_id=user_id,
            project_id=project_id,
            min_password_length=settings.min_password_length,
            max_login_attempts=settings.max_login_attempts,
        )

        if "security" in data:
            security = data["security"]
            if "min_password_length" in security and security["min_password_length"] is not None:
                try:
                    value = int(security["min_password_length"])
                    if not (isinstance(value, int) and 6 <= value <= 32):
                        raise ValueError("Invalid value")
                    settings.min_password_length = value
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid min_password_length value",
                        user_id=user_id,
                        project_id=project_id,
                        value=security.get("min_password_length"),
                    )

            if "max_login_attempts" in security and security["max_login_attempts"] is not None:
                try:
                    value = int(security["max_login_attempts"])
                    if not (isinstance(value, int) and 3 <= value <= 10):
                        raise ValueError("Invalid value")
                    settings.max_login_attempts = value
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid max_login_attempts value",
                        user_id=user_id,
                        project_id=project_id,
                        value=security.get("max_login_attempts"),
                    )

            if (
                "max_sessions_per_user" in security
                and security["max_sessions_per_user"] is not None
            ):
                try:
                    value = int(security["max_sessions_per_user"])
                    if not (isinstance(value, int) and 1 <= value <= 10):
                        raise ValueError("Invalid value")
                    settings.max_sessions_per_user = value
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid max_sessions_per_user value",
                        user_id=user_id,
                        project_id=project_id,
                        value=security.get("max_sessions_per_user"),
                    )

            if "log_retention_days" in security and security["log_retention_days"] is not None:
                try:
                    value = int(security["log_retention_days"])
                    if not (isinstance(value, int) and 7 <= value <= 365):
                        raise ValueError("Invalid value")
                    old_value = settings.log_retention_days
                    settings.log_retention_days = value
                    logger.debug(
                        "Updated log_retention_days",
                        user_id=user_id,
                        project_id=project_id,
                        old_value=old_value,
                        new_value=value,
                    )
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid log_retention_days value",
                        user_id=user_id,
                        project_id=project_id,
                        value=security.get("log_retention_days"),
                    )

            if "security_log_level" in security:
                if security["security_log_level"] in [
                    "debug",
                    "info",
                    "warning",
                    "error",
                    "critical",
                ]:
                    settings.security_log_level = security["security_log_level"]

        if "registration" in data:
            registration = data["registration"]
            if "invite_code_required" in registration:
                settings.invite_code_required = bool(registration["invite_code_required"])

        if "system" in data:
            system = data["system"]
            if "max_connections" in system and system["max_connections"] is not None:
                try:
                    value = int(system["max_connections"])
                    if not (isinstance(value, int) and 1 <= value <= 1000):
                        raise ValueError("Invalid value")
                    settings.max_connections = value
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid max_connections value",
                        user_id=user_id,
                        project_id=project_id,
                        value=system.get("max_connections"),
                    )

            if (
                "session_timeout_minutes" in system
                and system["session_timeout_minutes"] is not None
            ):
                try:
                    value = int(system["session_timeout_minutes"])
                    if not (isinstance(value, int) and 5 <= value <= 1440):
                        raise ValueError("Invalid value")
                    settings.session_timeout_minutes = value
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid session_timeout_minutes value",
                        user_id=user_id,
                        project_id=project_id,
                        value=system.get("session_timeout_minutes"),
                    )

            if "log_file_size_mb" in system and system["log_file_size_mb"] is not None:
                try:
                    value = int(system["log_file_size_mb"])
                    if not (isinstance(value, int) and 10 <= value <= 1000):
                        raise ValueError("Invalid value")
                    settings.log_file_size_mb = value
                except (ValueError, TypeError):
                    logger.debug(
                        "Invalid log_file_size_mb value",
                        user_id=user_id,
                        project_id=project_id,
                        value=system.get("log_file_size_mb"),
                    )

            if "system_log_level" in system:
                if system["system_log_level"] in ["debug", "info", "warning", "error"]:
                    settings.system_log_level = system["system_log_level"]
            if "auto_save_enabled" in system:
                settings.auto_save_enabled = bool(system["auto_save_enabled"])
            if "analytics_enabled" in system:
                settings.analytics_enabled = bool(system["analytics_enabled"])
            if "system_notifications_enabled" in system:
                settings.system_notifications_enabled = bool(system["system_notifications_enabled"])

        if "security_features" in data:
            features = data["security_features"]
            if "two_factor_auth_required" in features:
                settings.two_factor_auth_required = bool(features["two_factor_auth_required"])
            if "vpn_blocking_enabled" in features:
                settings.vpn_blocking_enabled = bool(features["vpn_blocking_enabled"])
            if "security_logging_enabled" in features:
                settings.security_logging_enabled = bool(features["security_logging_enabled"])
            if "suspicious_activity_check_enabled" in features:
                settings.suspicious_activity_check_enabled = bool(
                    features["suspicious_activity_check_enabled"]
                )
            if "session_limiting_enabled" in features:
                settings.session_limiting_enabled = bool(features["session_limiting_enabled"])
            if "auto_log_cleanup_enabled" in features:
                settings.auto_log_cleanup_enabled = bool(features["auto_log_cleanup_enabled"])

        if "offline_auth" in data:
            offline_auth = data["offline_auth"]
            if "offline_auth_enabled" in offline_auth:
                settings.offline_auth_enabled = bool(offline_auth["offline_auth_enabled"])
            if "offline_ticket_expiration_hours" in offline_auth:
                expiration_hours = int(offline_auth["offline_ticket_expiration_hours"])

                expiration_hours = max(1, min(168, expiration_hours))
                settings.offline_ticket_expiration_hours = expiration_hours

        if "appearance" in data:
            settings.appearance_settings = json.dumps(data["appearance"])

        logger.debug(
            "Settings after update",
            user_id=user_id,
            project_id=project_id,
            min_password_length=settings.min_password_length,
            max_login_attempts=settings.max_login_attempts,
        )

        db.session.commit()

        try:
            from ..services.settings import settings_service

            settings_service.invalidate_settings_cache(user_id)
        except ImportError:
            pass

        logger.debug("Settings committed to database successfully", user_id=user_id, project_id=project_id)

        return jsonify({"message": "Settings updated successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/regenerate-master-key", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def regenerate_master_key():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        settings = get_or_create_project_settings(project_id)
        old_key = settings.project_master_key
        settings.project_master_key = secrets.token_hex(32)

        db.session.commit()

        from ..services.cache import cache_service

        cache_service.invalidate_user_cache(user_id)

        return jsonify(
            {
                "message": "Master key regenerated successfully",
                "old_key": old_key,
                "new_key": settings.project_master_key,
                "warning": "All existing encrypted data will need to be re-encrypted with the new key",
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/keys", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def regenerate_keys():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        action = request.get_json().get("action", "all")

        keys = get_or_create_project_keys(project_id)

        if action in ["aes", "all"]:
            keys.aes_key = secrets.token_hex(32)

        if action in ["rsa", "all"]:
            private_key = rsa.generate_private_key(
                public_exponent=65537, key_size=2048, backend=default_backend()
            )
            public_key = private_key.public_key()

            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode("utf-8")

            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode("utf-8")

            keys.public_key_cert = public_pem
            keys.private_key_encrypted = private_pem

        db.session.commit()

        from ..services.cache import cache_service

        cache_service.invalidate_user_cache(user_id)

        return jsonify(
            {
                "message": "Keys regenerated successfully",
                "keys": {
                    "aes_key": keys.aes_key,
                    "public_key": keys.public_key_cert,

                },
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/keys", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_keys():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        keys = get_or_create_project_keys(project_id)

        if "aes_key" in data:
            aes_key = data["aes_key"].strip()
            if len(aes_key) != 64:
                return jsonify({"error": "AES key must be 64 characters long (32 bytes)"}), 400
            try:
                int(aes_key, 16)
            except ValueError:
                return jsonify({"error": "AES key must be valid hexadecimal"}), 400
            keys.aes_key = aes_key

        if "public_key" in data:
            public_key = data["public_key"].strip()
            if not public_key.startswith("-----BEGIN PUBLIC KEY-----"):
                return jsonify({"error": "Invalid public key format"}), 400
            keys.public_key_cert = public_key

        if "private_key" in data:
            private_key = data["private_key"].strip()
            if not private_key.startswith("-----BEGIN PRIVATE KEY-----"):
                return jsonify({"error": "Invalid private key format"}), 400
            keys.private_key_encrypted = private_key

        db.session.commit()

        return jsonify({"message": "Keys updated successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/fingerprint-lists", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_fingerprint_lists():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        blocked_fingerprints = (
            BlockedFingerprint.query.filter_by(project_id=project_id, is_active=True)
            .order_by(BlockedFingerprint.blocked_at.desc())
            .all()
        )

        blocked_list = []
        for fp in blocked_fingerprints:
            blocked_list.append(
                {
                    "id": fp.id,
                    "fingerprint": fp.fingerprint,
                    "reason": fp.reason,
                    "block_type": getattr(fp, "block_type", "manual"),
                    "severity": getattr(fp, "severity", "medium"),
                    "threat_score": getattr(fp, "threat_score", 0),
                    "source_ip": getattr(fp, "source_ip", None),
                    "user_agent": getattr(fp, "user_agent", None),
                    "country": getattr(fp, "country", None),
                    "city": getattr(fp, "city", None),
                    "attempt_count": getattr(fp, "attempt_count", 1),
                    "first_seen": getattr(fp, "first_seen", fp.blocked_at).isoformat(),
                    "last_seen": getattr(fp, "last_seen", fp.blocked_at).isoformat(),
                    "blocked_at": fp.blocked_at.isoformat() if fp.blocked_at else None,
                    "expires_at": fp.expires_at.isoformat() if fp.expires_at else None,
                    "auto_unblock_enabled": getattr(fp, "auto_unblock_enabled", False),
                    "blocked_by": (
                        fp.blocked_by_user.username
                        if hasattr(fp, "blocked_by_user") and fp.blocked_by_user
                        else None
                    ),
                }
            )

        return jsonify({"blocked_fingerprints": blocked_list})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/fingerprint-lists/blocked", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def add_to_fingerprint_blacklist():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()
        fingerprint = data.get("fingerprint")
        reason = data.get("reason", "Manual block")
        expires_at = data.get("expires_at")

        if not fingerprint:
            return jsonify({"error": "Fingerprint is required"}), 400

        existing = BlockedFingerprint.query.filter_by(
            fingerprint=fingerprint, project_id=project_id, is_active=True
        ).first()

        if existing:
            return jsonify({"error": "Fingerprint is already blocked"}), 400

        blocked_fingerprint = BlockedFingerprint(
            fingerprint=fingerprint,
            project_id=project_id,
            reason=reason,
            blocked_by=user_id,
            is_active=True,
        )

        if expires_at:
            from datetime import datetime

            blocked_fingerprint.expires_at = datetime.fromisoformat(
                expires_at.replace("Z", "+00:00")
            )

        db.session.add(blocked_fingerprint)
        db.session.commit()

        return jsonify(
            {"message": "Fingerprint blocked successfully", "id": blocked_fingerprint.id}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/fingerprint-lists/blocked/<int:fp_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def remove_from_fingerprint_blacklist(fp_id):
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        blocked_fingerprint = BlockedFingerprint.query.filter_by(
            id=fp_id, project_id=project_id
        ).first()

        if not blocked_fingerprint:
            return jsonify({"error": "Fingerprint not found"}), 404

        blocked_fingerprint.is_active = False
        db.session.commit()

        return jsonify({"message": "Fingerprint removed from blacklist"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/blocked-ips", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_blocked_ips():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import BlockedIP

        blocked_ips = (
            BlockedIP.query.filter_by(project_id=project_id)
            .order_by(BlockedIP.blocked_at.desc())
            .all()
        )

        ips_list = []
        for ip in blocked_ips:
            ips_list.append(
                {
                    "id": ip.id,
                    "ip_address": ip.ip_address,
                    "reason": ip.reason,
                    "blocked_at": ip.blocked_at.isoformat(),
                    "expires_at": ip.expires_at.isoformat() if ip.expires_at else None,
                    "is_active": ip.is_active,
                    "block_type": ip.block_type,
                    "category": ip.category,
                    "severity": ip.severity,
                    "threat_score": ip.threat_score,
                    "country": ip.country,
                    "city": ip.city,
                    "attempt_count": ip.attempt_count,
                    "blocked_by": ip.blocked_by_user.username if ip.blocked_by_user else None,
                    "unblocked_at": ip.unblocked_at.isoformat() if ip.unblocked_at else None,
                    "unblocked_by": ip.unblocked_by_user.username if ip.unblocked_by_user else None,
                }
            )

        return jsonify({"blocked_ips": ips_list})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/blocked-ips", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def block_ip():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()
        ip_address = data.get("ip_address")
        reason = data.get("reason", "Manual block")
        expires_at = data.get("expires_at")
        block_type = data.get("block_type", "manual")
        category = data.get("category", "general")
        severity = data.get("severity", "medium")
        threat_score = data.get("threat_score", 0)

        if not ip_address:
            return jsonify({"error": "IP address is required"}), 400

        from ..models.security import BlockedIP

        existing = BlockedIP.query.filter_by(
            ip_address=ip_address, project_id=project_id, is_active=True
        ).first()

        if existing:
            return jsonify({"error": "IP address is already blocked"}), 400

        blocked_ip = BlockedIP(
            ip_address=ip_address,
            project_id=project_id,
            reason=reason,
            blocked_by_user_id=user_id,
            is_active=True,
            block_type=block_type,
            category=category,
            severity=severity,
            threat_score=threat_score,
        )

        if expires_at:
            from datetime import datetime

            blocked_ip.expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))

        db.session.add(blocked_ip)
        db.session.commit()

        return jsonify({"message": "IP address blocked successfully", "id": blocked_ip.id})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/blocked-ips/<int:ip_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def unblock_ip(ip_id):
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import BlockedIP

        blocked_ip = BlockedIP.query.filter_by(id=ip_id, project_id=project_id).first()

        if not blocked_ip:
            return jsonify({"error": "Blocked IP not found"}), 404

        blocked_ip.is_active = False
        blocked_ip.unblocked_at = datetime.utcnow()
        blocked_ip.unblocked_by_user_id = user_id
        db.session.commit()

        return jsonify({"message": "IP address unblocked successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/blocked-hwids", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_blocked_hwids():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import BlockedHWID

        blocked_hwids = (
            BlockedHWID.query.filter_by(project_id=project_id)
            .order_by(BlockedHWID.blocked_at.desc())
            .all()
        )

        hwids_list = []
        for hwid in blocked_hwids:
            hwids_list.append(
                {
                    "id": hwid.id,
                    "hwid": hwid.hwid,
                    "reason": hwid.reason,
                    "blocked_at": hwid.blocked_at.isoformat(),
                    "expires_at": hwid.expires_at.isoformat() if hwid.expires_at else None,
                    "is_active": hwid.is_active,
                    "block_type": hwid.block_type,
                    "severity": hwid.severity,
                    "threat_score": hwid.threat_score,
                    "cpu_info": hwid.cpu_info,
                    "gpu_info": hwid.gpu_info,
                    "motherboard_info": hwid.motherboard_info,
                    "ram_info": hwid.ram_info,
                    "attempt_count": hwid.attempt_count,
                    "blocked_by": hwid.blocked_by_user.username if hwid.blocked_by_user else None,
                    "unblocked_at": hwid.unblocked_at.isoformat() if hwid.unblocked_at else None,
                    "unblocked_by": (
                        hwid.unblocked_by_user.username if hwid.unblocked_by_user else None
                    ),
                }
            )

        return jsonify({"blocked_hwids": hwids_list})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/blocked-hwids", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def block_hwid():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()
        hwid = data.get("hwid")
        reason = data.get("reason", "Manual block")
        expires_at = data.get("expires_at")
        block_type = data.get("block_type", "manual")
        severity = data.get("severity", "medium")
        threat_score = data.get("threat_score", 0)

        if not hwid:
            return jsonify({"error": "HWID is required"}), 400

        from ..models.security import BlockedHWID

        existing = BlockedHWID.query.filter_by(
            hwid=hwid, project_id=project_id, is_active=True
        ).first()

        if existing:
            return jsonify({"error": "HWID is already blocked"}), 400

        blocked_hwid = BlockedHWID(
            hwid=hwid,
            project_id=project_id,
            reason=reason,
            blocked_by_user_id=user_id,
            is_active=True,
            block_type=block_type,
            severity=severity,
            threat_score=threat_score,
        )

        if expires_at:
            from datetime import datetime

            blocked_hwid.expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))

        db.session.add(blocked_hwid)
        db.session.commit()

        return jsonify({"message": "HWID blocked successfully", "id": blocked_hwid.id})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/blocked-hwids/<int:hwid_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def unblock_hwid(hwid_id):
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import BlockedHWID

        blocked_hwid = BlockedHWID.query.filter_by(id=hwid_id, project_id=project_id).first()

        if not blocked_hwid:
            return jsonify({"error": "Blocked HWID not found"}), 404

        blocked_hwid.is_active = False
        blocked_hwid.unblocked_at = datetime.utcnow()
        blocked_hwid.unblocked_by_user_id = user_id
        db.session.commit()

        return jsonify({"message": "HWID unblocked successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/analytics", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_security_analytics():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        days = request.args.get("days", 30, type=int)

        from services.security_service import security_service

        analytics = security_service.get_security_analytics(project_id, days)

        return jsonify(analytics)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/rules", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_security_rules():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import SecurityRule

        rules = (
            SecurityRule.query.filter_by(project_id=project_id)
            .order_by(SecurityRule.priority.desc())
            .all()
        )

        rules_list = []
        for rule in rules:
            rules_list.append(
                {
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "rule_type": rule.rule_type,
                    "conditions": rule.conditions,
                    "action_type": rule.action_type,
                    "action_params": rule.action_params,
                    "is_active": rule.is_active,
                    "priority": rule.priority,
                    "cooldown_minutes": rule.cooldown_minutes,
                    "trigger_count": rule.trigger_count,
                    "last_triggered": (
                        rule.last_triggered.isoformat() if rule.last_triggered else None
                    ),
                    "created_at": rule.created_at.isoformat(),
                    "created_by": rule.created_by_user.username if rule.created_by_user else None,
                }
            )

        return jsonify({"security_rules": rules_list})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/rules", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_security_rule():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()

        from ..models.security import SecurityRule

        rule = SecurityRule(
            name=data.get("name"),
            description=data.get("description"),
            rule_type=data.get("rule_type"),
            conditions=data.get("conditions"),
            action_type=data.get("action_type"),
            action_params=data.get("action_params"),
            is_active=data.get("is_active", True),
            priority=data.get("priority", 100),
            cooldown_minutes=data.get("cooldown_minutes", 60),
            created_by_user_id=user_id,
            project_id=project_id,
        )

        db.session.add(rule)
        db.session.commit()

        return jsonify({"message": "Security rule created successfully", "rule_id": rule.id})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/events", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_security_events():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import SecurityEvent

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        events = (
            SecurityEvent.query.filter_by(project_id=project_id)
            .order_by(SecurityEvent.created_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        events_list = []
        for event in events.items:
            events_list.append(
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "severity": event.severity,
                    "fingerprint": event.fingerprint,
                    "ip_address": event.ip_address,
                    "user_agent": event.user_agent,
                    "user_key": event.user_key,
                    "country": event.country,
                    "city": event.city,
                    "description": event.description,
                    "threat_score": event.threat_score,
                    "created_at": event.created_at.isoformat(),
                }
            )

        return jsonify(
            {
                "events": events_list,
                "total": events.total,
                "pages": events.pages,
                "current_page": page,
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/rules/<int:rule_id>/toggle", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def toggle_security_rule(rule_id):
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import SecurityRule

        rule = SecurityRule.query.filter_by(id=rule_id, project_id=project_id).first()
        if not rule:
            return jsonify({"error": "Security rule not found"}), 404

        if rule.name == "Rapid Request Detection":
            return jsonify({"error": "Rapid Request Detection rule cannot be disabled"}), 400

        rule.is_active = not rule.is_active
        db.session.commit()

        return jsonify(
            {
                "message": f'Rule "{rule.name}" {"enabled" if rule.is_active else "disabled"}',
                "rule": {"id": rule.id, "name": rule.name, "is_active": rule.is_active},
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/rules/<int:rule_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_security_rule(rule_id):
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import SecurityRule

        rule = SecurityRule.query.filter_by(id=rule_id, project_id=project_id).first()
        if not rule:
            return jsonify({"error": "Security rule not found"}), 404

        data = request.get_json()

        if "name" in data:
            rule.name = data["name"]
        if "description" in data:
            rule.description = data["description"]
        if "priority" in data:
            rule.priority = data["priority"]
        if "cooldown_minutes" in data:
            rule.cooldown_minutes = data["cooldown_minutes"]
        if "conditions" in data:
            rule.conditions = json.dumps(data["conditions"])
        if "action_params" in data:
            rule.action_params = json.dumps(data["action_params"])

        if "is_active" in data:
            if rule.name == "Rapid Request Detection" and not data["is_active"]:
                return jsonify({"error": "Rapid Request Detection rule cannot be disabled"}), 400
            rule.is_active = data["is_active"]

        rule.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(
            {
                "message": "Security rule updated successfully",
                "rule": {
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "rule_type": rule.rule_type,
                    "conditions": rule.conditions,
                    "action_type": rule.action_type,
                    "action_params": rule.action_params,
                    "is_active": rule.is_active,
                    "priority": rule.priority,
                    "cooldown_minutes": rule.cooldown_minutes,
                    "updated_at": rule.updated_at.isoformat(),
                },
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/rules/<int:rule_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_security_rule(rule_id):
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import SecurityRule

        rule = SecurityRule.query.filter_by(id=rule_id, project_id=project_id).first()
        if not rule:
            return jsonify({"error": "Security rule not found"}), 404

        if rule.name == "Rapid Request Detection":
            return jsonify({"error": "Rapid Request Detection rule cannot be deleted"}), 400

        rule_name = rule.name
        db.session.delete(rule)
        db.session.commit()

        return jsonify({"message": f'Security rule "{rule_name}" deleted successfully'})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_bp.route("/api/settings/security/rules/reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def reset_security_rules():
    try:
        user_id = get_jwt_identity()
        project_id, error = get_user_project_id(user_id)

        if error:
            return jsonify({"error": error}), 404 if "not found" in error else 403

        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "system.manage_maintenance"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.security import SecurityRule

        rules_to_delete = SecurityRule.query.filter(
            SecurityRule.project_id == project_id, SecurityRule.name != "Rapid Request Detection"
        ).all()

        for rule in rules_to_delete:
            db.session.delete(rule)

        db.session.commit()

        return jsonify(
            {
                "message": "Security rules reset to default (except Rapid Request Detection)",
                "deleted_count": len(rules_to_delete),
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
