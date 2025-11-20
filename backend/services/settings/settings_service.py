"""
Settings Service
Provides cached access to project settings and configuration
"""

import json
import logging
from typing import Any, Dict, List, Optional

from ...core.extensions import db
from ...models.core import Project, ProjectEncryptionKeys, ProjectSettings, User
from ...utils.rbac_utils import RBACManager

try:
    from ...services.cache import cache_service
except ImportError:
    cache_service = None

class SettingsService:
    """Service for managing project settings with caching"""

    def __init__(self, cache_service=None, logger=None):
        self.cache_service = cache_service
        self.logger = logger or logging.getLogger(__name__)

    @property
    def _cache_service(self):
        """Get cache service instance"""
        return self.cache_service if self.cache_service is not None else cache_service

    def get_settings_cached(self, user_id: int) -> Dict[str, Any]:
        """Get project settings with caching support"""

        def fetch_settings():
            """Fetch settings from database"""
            try:
                self.logger.info(f"Fetching settings from database for user {user_id}")

                try:
                    user = User.query.get(user_id)
                except Exception as db_error:
                    import traceback

                    self.logger.error(
                        f"Database error querying user {user_id}: {db_error}\n{traceback.format_exc()}"
                    )
                    return {"error": f"Database error: {str(db_error)}"}

                if not user:
                    self.logger.error(f"User {user_id} not found")
                    return {"error": "User not found"}

                try:
                    project_id = user.project_id
                except AttributeError:
                    self.logger.error(f"User {user_id} object missing project_id attribute")
                    return {"error": "User object is invalid"}

                # Check if user is owner - owners can work without project_id
                is_owner = RBACManager.is_owner(user)
                
                if not project_id:
                    if is_owner:
                        # For owners without project_id, we need a project_id from request context
                        # This should be set by middleware when owner selects a project
                        from flask import g
                        project_id = getattr(g, 'project_id', None)
                        if not project_id:
                            # If no project_id in request context, try to use first available project as fallback
                            try:
                                # First try active projects
                                first_project = Project.query.filter_by(is_active=True).order_by(Project.id.asc()).first()
                                # If no active projects, try any project (for owners who might need to access inactive ones)
                                if not first_project:
                                    first_project = Project.query.order_by(Project.id.asc()).first()
                                if first_project:
                                    project_id = first_project.id
                                    self.logger.info(f"Owner {user_id} has no selected project, using first available project {project_id} as fallback")
                                else:
                                    self.logger.warning(f"Owner {user_id} has no project_id, no project_id in request context, and no projects available")
                                    return {"error": "No projects available. Please create a project first to view settings."}
                            except Exception as project_lookup_error:
                                self.logger.error(f"Error looking up projects for owner {user_id}: {project_lookup_error}")
                                return {"error": "Project selection required. Please select a project to view settings."}
                        else:
                            self.logger.info(f"Owner {user_id} using project_id {project_id} from request context")
                    else:
                        self.logger.error(f"User {user_id} has no project_id and is not an owner")
                        return {"error": "User must be assigned to a project"}

                self.logger.info(f"User {user_id} has project_id: {project_id}")

                try:
                    settings = self._get_or_create_project_settings(project_id)
                    self.logger.info(f"Retrieved settings for project {project_id}")
                except Exception as settings_error:
                    self.logger.error(f"Error getting settings: {settings_error}")
                    import traceback

                    self.logger.error(traceback.format_exc())
                    return {"error": f"Failed to get project settings: {str(settings_error)}"}

                appearance_settings = {}
                if hasattr(settings, "appearance_settings") and settings.appearance_settings:
                    try:
                        appearance_settings = json.loads(settings.appearance_settings)
                    except (json.JSONDecodeError, TypeError, AttributeError):
                        appearance_settings = {}

                try:
                    encryption_keys = self._get_or_create_project_keys(project_id)
                    if not encryption_keys or not isinstance(encryption_keys, dict):
                        self.logger.warning(
                            f"Failed to get encryption keys for project {project_id}, using defaults"
                        )
                        encryption_keys = {"aes_key": "", "public_key": ""}

                    if not isinstance(encryption_keys, dict):
                        encryption_keys = {"aes_key": "", "public_key": ""}

                    if "aes_key" not in encryption_keys:
                        encryption_keys["aes_key"] = ""
                    if "public_key" not in encryption_keys:
                        encryption_keys["public_key"] = ""

                    self.logger.info(
                        f"Retrieved encryption keys: aes_key present={bool(encryption_keys.get('aes_key'))}, public_key present={bool(encryption_keys.get('public_key'))}"
                    )
                except Exception as key_error:
                    import traceback

                    self.logger.error(
                        f"Error getting encryption keys: {key_error}\n{traceback.format_exc()}"
                    )
                    encryption_keys = {"aes_key": "", "public_key": ""}

                try:
                    result = {
                        "security": {
                            "min_password_length": int(
                                getattr(settings, "min_password_length", 8) or 8
                            ),
                            "max_login_attempts": int(
                                getattr(settings, "max_login_attempts", 5) or 5
                            ),
                            "ip_block_duration_minutes": int(
                                getattr(settings, "ip_block_duration_minutes", 15) or 15
                            ),
                            "max_sessions_per_user": int(
                                getattr(settings, "max_sessions_per_user", 3) or 3
                            ),
                            "log_retention_days": int(
                                getattr(settings, "log_retention_days", 30) or 30
                            ),
                            "security_log_level": str(
                                getattr(settings, "security_log_level", "INFO") or "INFO"
                            ),
                        },
                        "registration": {
                            "invite_code_required": bool(
                                getattr(settings, "invite_code_required", False)
                            )
                        },
                        "system": {
                            "max_connections": int(
                                getattr(settings, "max_connections", 1000) or 1000
                            ),
                            "session_timeout_minutes": int(
                                getattr(settings, "session_timeout_minutes", 480) or 480
                            ),
                            "log_file_size_mb": int(
                                getattr(settings, "log_file_size_mb", 100) or 100
                            ),
                            "system_log_level": str(
                                getattr(settings, "system_log_level", "INFO") or "INFO"
                            ),
                            "auto_save_enabled": bool(getattr(settings, "auto_save_enabled", True)),
                            "analytics_enabled": bool(getattr(settings, "analytics_enabled", True)),
                            "system_notifications_enabled": bool(
                                getattr(settings, "system_notifications_enabled", True)
                            ),
                        },
                        "security_features": {
                            "two_factor_auth_required": bool(
                                getattr(settings, "two_factor_auth_required", False)
                            ),
                            "password_complexity_required": bool(
                                getattr(settings, "password_complexity_required", True)
                            ),
                            "session_fingerprinting": bool(
                                getattr(settings, "session_fingerprinting", True)
                            ),
                            "ip_whitelist_enabled": bool(
                                getattr(settings, "ip_whitelist_enabled", False)
                            ),
                            "ip_whitelist": str(
                                self._format_ip_whitelist(getattr(settings, "ip_whitelist", None))
                            ),
                            "rate_limiting_enabled": bool(
                                getattr(settings, "rate_limiting_enabled", True)
                            ),
                            "rate_limit_requests_per_minute": int(
                                getattr(settings, "rate_limit_requests_per_minute", 60) or 60
                            ),
                            "vpn_blocking_enabled": bool(
                                getattr(settings, "vpn_blocking_enabled", False)
                            ),
                            "security_logging_enabled": bool(
                                getattr(settings, "security_logging_enabled", True)
                            ),
                            "suspicious_activity_check_enabled": bool(
                                getattr(settings, "suspicious_activity_check_enabled", True)
                            ),
                            "session_limiting_enabled": bool(
                                getattr(settings, "session_limiting_enabled", True)
                            ),
                            "auto_log_cleanup_enabled": bool(
                                getattr(settings, "auto_log_cleanup_enabled", True)
                            ),
                        },
                        "appearance": (
                            appearance_settings if isinstance(appearance_settings, dict) else {}
                        ),
                        "encryption": {
                            "encryption_enabled": bool(
                                getattr(settings, "encryption_enabled", False)
                            ),
                            "encryption_algorithm": str(
                                getattr(settings, "encryption_algorithm", "AES-256") or "AES-256"
                            ),
                            "key_rotation_days": int(
                                getattr(settings, "key_rotation_days", 90) or 90
                            ),
                        },
                        "backup": {
                            "auto_backup_enabled": bool(
                                getattr(settings, "auto_backup_enabled", False)
                            ),
                            "backup_frequency_hours": int(
                                getattr(settings, "backup_frequency_hours", 24) or 24
                            ),
                            "backup_retention_days": int(
                                getattr(settings, "backup_retention_days", 30) or 30
                            ),
                        },
                        "offline_auth": {
                            "offline_auth_enabled": bool(
                                getattr(settings, "offline_auth_enabled", False)
                            ),
                            "offline_ticket_expiration_hours": int(
                                getattr(settings, "offline_ticket_expiration_hours", 12) or 12
                            ),

                        },
                        "encryption_keys": {
                            "aes_key": str(encryption_keys.get("aes_key", "") or ""),
                            "public_key": str(encryption_keys.get("public_key", "") or ""),

                        },
                    }

                    try:
                        is_admin = RBACManager.is_admin(user)
                    except Exception as admin_check_error:
                        import traceback
                        self.logger.error(
                            f"Error checking admin status for user {user_id}: {admin_check_error}\n{traceback.format_exc()}"
                        )

                        is_admin = False

                    if not is_admin:

                        admin_only_sections = [
                            "encryption_keys",
                            "encryption",
                            "backup",
                            "system",
                            "security_features",
                            "security",
                            "offline_auth",
                            "registration",
                        ]
                        for section in admin_only_sections:
                            result.pop(section, None)
                        self.logger.info(f"Filtered admin-only sections for non-admin user {user_id}")

                    self.logger.info("Successfully built settings response dictionary")
                    return result
                except Exception as build_error:
                    import traceback

                    error_traceback = traceback.format_exc()
                    self.logger.error(
                        f"Error building settings response: {str(build_error)}\n{error_traceback}"
                    )
                    return {"error": f"Failed to build settings response: {str(build_error)}"}

            except Exception as e:
                import traceback

                error_traceback = traceback.format_exc()
                self.logger.error(f"Error fetching settings: {str(e)}\n{error_traceback}")
                return {"error": f"Failed to fetch settings: {str(e)}"}

        cache_key_params = {"user_id": user_id}

        try:
            self.logger.info(f"Starting get_settings_cached for user {user_id}")
            result = fetch_settings()
            if result is None:
                self.logger.error("fetch_settings returned None")
                return {"error": "Settings service returned no data"}
            if not isinstance(result, dict):
                self.logger.error(f"fetch_settings returned unexpected type: {type(result)}")
                return {"error": f"Settings service returned unexpected type: {type(result)}"}
            if "error" in result:
                self.logger.error(f"fetch_settings returned error: {result['error']}")
            else:
                self.logger.info("Settings retrieved successfully")
            return result
        except Exception as e:
            import traceback

            error_traceback = traceback.format_exc()
            self.logger.error(f"Error in get_settings_cached: {str(e)}\n{error_traceback}")
            return {"error": f"Failed to retrieve settings: {str(e)}"}

    def _get_or_create_project_settings(self, project_id: int) -> ProjectSettings:
        """Get or create project settings"""
        self.logger.info(f"Getting or creating settings for project_id: {project_id}")

        try:
            settings = ProjectSettings.query.filter_by(project_id=project_id).first()
        except Exception as db_error:

                error_str = str(db_error)
                if "does not exist" in error_str or "UndefinedColumn" in error_str:
                    self.logger.warning(f"Database schema mismatch detected: {error_str}")
                    self.logger.info("Attempting to query with minimal columns...")
                    # SECURITY NOTE: Using raw SQL as fallback when ORM fails due to schema mismatch.
                    # This is a code smell and should be fixed by ensuring migrations are up to date.
                    # Parameters are properly bound to prevent SQL injection, but this fallback logic
                    # should be removed once migrations are properly applied.
                    try:

                        from sqlalchemy import text

                    result = db.session.execute(
                        text(
                            """
                            SELECT id, project_id, min_password_length, max_login_attempts, 
                                   ip_block_duration_minutes, max_sessions_per_user, 
                                   log_retention_days, security_log_level, max_connections,
                                   session_timeout_minutes, log_file_size_mb, system_log_level,
                                   auto_save_enabled, analytics_enabled, system_notifications_enabled,
                                   two_factor_auth_required, vpn_blocking_enabled,
                                   security_logging_enabled, suspicious_activity_check_enabled,
                                   session_limiting_enabled, auto_log_cleanup_enabled,
                                   encryption_enabled, encryption_algorithm, key_rotation_days,
                                   auto_backup_enabled, backup_frequency_hours, backup_retention_days,
                                   appearance_settings, project_master_key, invite_code_required,
                                   created_at, updated_at
                            FROM project_settings 
                            WHERE project_id = :project_id
                            LIMIT 1
                        """
                        ),
                        {"project_id": project_id},
                    ).fetchone()

                    if result:

                        settings = ProjectSettings()
                        settings.id = result[0]
                        settings.project_id = result[1]
                        settings.min_password_length = result[2] if result[2] else 8
                        settings.max_login_attempts = result[3] if result[3] else 5
                        settings.ip_block_duration_minutes = result[4] if result[4] else 15
                        settings.max_sessions_per_user = result[5] if result[5] else 5
                        settings.log_retention_days = result[6] if result[6] else 60
                        settings.security_log_level = result[7] if result[7] else "INFO"
                        settings.max_connections = result[8] if result[8] else 1000
                        settings.session_timeout_minutes = result[9] if result[9] else 480
                        settings.log_file_size_mb = result[10] if result[10] else 100
                        settings.system_log_level = result[11] if result[11] else "INFO"
                        settings.auto_save_enabled = (
                            bool(result[12]) if result[12] is not None else True
                        )
                        settings.analytics_enabled = (
                            bool(result[13]) if result[13] is not None else True
                        )
                        settings.system_notifications_enabled = (
                            bool(result[14]) if result[14] is not None else True
                        )
                        settings.two_factor_auth_required = (
                            bool(result[15]) if result[15] is not None else False
                        )
                        settings.vpn_blocking_enabled = (
                            bool(result[16]) if result[16] is not None else False
                        )
                        settings.security_logging_enabled = (
                            bool(result[17]) if result[17] is not None else True
                        )
                        settings.suspicious_activity_check_enabled = (
                            bool(result[18]) if result[18] is not None else True
                        )
                        settings.session_limiting_enabled = (
                            bool(result[19]) if result[19] is not None else True
                        )
                        settings.auto_log_cleanup_enabled = (
                            bool(result[20]) if result[20] is not None else True
                        )
                        settings.encryption_enabled = (
                            bool(result[21]) if result[21] is not None else False
                        )
                        settings.encryption_algorithm = result[22] if result[22] else "AES-256"
                        settings.key_rotation_days = result[23] if result[23] else 90
                        settings.auto_backup_enabled = (
                            bool(result[24]) if result[24] is not None else False
                        )
                        settings.backup_frequency_hours = result[25] if result[25] else 24
                        settings.backup_retention_days = result[26] if result[26] else 30
                        settings.appearance_settings = result[27]
                        settings.project_master_key = result[28]
                        settings.invite_code_required = (
                            bool(result[29]) if result[29] is not None else False
                        )

                        settings.password_complexity_required = True
                        settings.session_fingerprinting = True
                        settings.ip_whitelist_enabled = False
                        settings.ip_whitelist = None
                        settings.rate_limiting_enabled = True
                        settings.rate_limit_requests_per_minute = 60
                        settings.created_at = result[30]
                        settings.updated_at = result[31]
                        self.logger.info("Successfully loaded settings using fallback query")
                    else:
                        settings = None
                except Exception as fallback_error:
                    self.logger.error(f"Fallback query also failed: {fallback_error}")
                    raise db_error
            else:
                raise db_error

        if not settings:
            self.logger.info(f"No settings found for project_id: {project_id}, creating new ones")

            import secrets

            try:

                settings = ProjectSettings(
                    project_id=project_id,
                    min_password_length=8,
                    max_login_attempts=5,
                    ip_block_duration_minutes=15,
                    max_sessions_per_user=5,
                    log_retention_days=60,
                    security_log_level="INFO",
                    invite_code_required=False,
                    max_connections=1000,
                    session_timeout_minutes=480,
                    log_file_size_mb=100,
                    system_log_level="INFO",
                    auto_save_enabled=True,
                    analytics_enabled=True,
                    system_notifications_enabled=True,
                    two_factor_auth_required=False,
                    password_complexity_required=True,
                    session_fingerprinting=True,
                    ip_whitelist_enabled=False,
                    rate_limiting_enabled=True,
                    rate_limit_requests_per_minute=60,
                    vpn_blocking_enabled=False,
                    security_logging_enabled=True,
                    suspicious_activity_check_enabled=True,
                    session_limiting_enabled=True,
                    auto_log_cleanup_enabled=True,
                    encryption_enabled=False,
                    encryption_algorithm="AES-256",
                    key_rotation_days=90,
                    auto_backup_enabled=False,
                    backup_frequency_hours=24,
                    backup_retention_days=30,
                    project_master_key=secrets.token_hex(32),
                )
            except Exception as create_error:

                error_str = str(create_error)
                if "does not exist" in error_str or "UndefinedColumn" in error_str:
                    self.logger.warning(
                        f"Can't create settings with all fields due to missing columns, using raw SQL"
                    )
                    # SECURITY NOTE: Using raw SQL as fallback when ORM fails due to schema mismatch.
                    # This is a code smell and should be fixed by ensuring migrations are up to date.
                    # Parameters are properly bound to prevent SQL injection, but this fallback logic
                    # should be removed once migrations are properly applied.
                    from sqlalchemy import text

                    master_key = secrets.token_hex(32)

                    db.session.execute(
                        text(
                            """
                            INSERT INTO project_settings 
                            (project_id, min_password_length, max_login_attempts, ip_block_duration_minutes,
                             max_sessions_per_user, log_retention_days, security_log_level,
                             max_connections, session_timeout_minutes, log_file_size_mb, system_log_level,
                             auto_save_enabled, analytics_enabled, system_notifications_enabled,
                             two_factor_auth_required, vpn_blocking_enabled,
                             security_logging_enabled, suspicious_activity_check_enabled,
                             session_limiting_enabled, auto_log_cleanup_enabled,
                             encryption_enabled, encryption_algorithm, key_rotation_days,
                             auto_backup_enabled, backup_frequency_hours, backup_retention_days,
                             project_master_key, invite_code_required, created_at, updated_at)
                            VALUES 
                            (:project_id, 8, 5, 15, 5, 60, 'INFO',
                             1000, 480, 100, 'INFO',
                             true, true, true,
                             false, false,
                             true, true,
                             true, true,
                             false, 'AES-256', 90,
                             false, 24, 30,
                             :master_key, false, NOW(), NOW())
                            RETURNING id
                        """
                        ),
                        {"project_id": project_id, "master_key": master_key},
                    )

                    result = db.session.execute(
                        text("SELECT * FROM project_settings WHERE project_id = :project_id"),
                        {"project_id": project_id},
                    ).fetchone()
                    if result:

                        settings = ProjectSettings()
                        settings.id = result[0]
                        settings.project_id = result[1]

                        settings.project_id = project_id
                        settings.project_master_key = master_key

                    else:
                        raise Exception("Failed to create settings using raw SQL")
                else:
                    raise create_error

            db.session.add(settings)
            try:
                db.session.commit()
            except Exception as commit_error:
                db.session.rollback()

                error_str = str(commit_error)
                if "does not exist" in error_str or "UndefinedColumn" in error_str:
                    self.logger.warning(
                        "Commit failed due to missing columns, trying minimal insert..."
                    )
                    # SECURITY NOTE: Using raw SQL as fallback when ORM fails due to schema mismatch.
                    # This is a code smell and should be fixed by ensuring migrations are up to date.
                    # Parameters are properly bound to prevent SQL injection, but this fallback logic
                    # should be removed once migrations are properly applied.
                    from sqlalchemy import text

                    master_key = secrets.token_hex(32)

                    db.session.execute(
                        text(
                            """
                            INSERT INTO project_settings 
                            (project_id, min_password_length, max_login_attempts, project_master_key, created_at, updated_at)
                            VALUES (:project_id, 8, 5, :master_key, NOW(), NOW())
                            ON CONFLICT (project_id) DO NOTHING
                        """
                        ),
                        {"project_id": project_id, "master_key": master_key},
                    )
                    db.session.commit()

                    settings = ProjectSettings.query.filter_by(project_id=project_id).first()
                else:
                    raise commit_error

            self.logger.info(f"Created new settings for project_id: {project_id}")
        else:
            self.logger.info(f"Found existing settings for project_id: {project_id}")

        return settings

    def _get_or_create_project_keys(self, project_id: int) -> Dict[str, str]:
        """Get or create project encryption keys"""
        self.logger.info(f"Getting or creating keys for project_id: {project_id}")
        keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id).first()

        if not keys:
            self.logger.info(f"No keys found for project_id: {project_id}, creating new ones")

            import json
            import secrets
            from datetime import datetime

            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric import rsa

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
                aes_key=secrets.token_hex(32),
                public_key_cert=public_pem,
                private_key_encrypted=private_pem,
                key_metadata=json.dumps(
                    {"algorithm": "RSA", "key_size": 2048, "aes_key_size": 256}
                ),
                created_at=datetime.utcnow(),
            )
            db.session.add(keys)
            db.session.commit()
            self.logger.info(f"Created new keys for project_id: {project_id}")
        else:
            self.logger.info(f"Found existing keys for project_id: {project_id}")

        result = {
            "aes_key": keys.aes_key or "",
            "public_key": keys.public_key_cert or "",

        }
        self.logger.info(
            f"Returning keys: aes_key={bool(result['aes_key'])}, public_key={bool(result['public_key'])}"
        )
        return result

    def update_settings_cached(self, user_id: int, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update project settings and invalidate cache"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            # Check if user is owner - owners can work without project_id
            is_owner = RBACManager.is_owner(user)
            project_id = user.project_id
            
            if not project_id:
                if is_owner:
                    # For owners without project_id, we need a project_id from request context
                    from flask import g
                    project_id = getattr(g, 'project_id', None)
                    if not project_id:
                        # If no project_id in request context, try to use first available project as fallback
                        try:
                            # First try active projects
                            first_project = Project.query.filter_by(is_active=True).order_by(Project.id.asc()).first()
                            # If no active projects, try any project (for owners who might need to access inactive ones)
                            if not first_project:
                                first_project = Project.query.order_by(Project.id.asc()).first()
                            if first_project:
                                project_id = first_project.id
                                self.logger.info(f"Owner {user_id} has no selected project, using first available project {project_id} as fallback for update")
                            else:
                                self.logger.warning(f"Owner {user_id} has no project_id, no project_id in request context, and no projects available for update")
                                return {"error": "No projects available. Please create a project first to update settings."}
                        except Exception as project_lookup_error:
                            self.logger.error(f"Error looking up projects for owner {user_id} during update: {project_lookup_error}")
                            return {"error": "Project selection required. Please select a project to update settings."}
                    else:
                        self.logger.info(f"Owner {user_id} using project_id {project_id} from request context for update")
                else:
                    return {"error": "User not assigned to project"}
            settings = self._get_or_create_project_settings(project_id)

            if "security" in settings_data:
                security = settings_data["security"]
                if "min_password_length" in security:
                    settings.min_password_length = security["min_password_length"]
                if "max_login_attempts" in security:
                    settings.max_login_attempts = security["max_login_attempts"]
                if "ip_block_duration_minutes" in security:
                    settings.ip_block_duration_minutes = security["ip_block_duration_minutes"]
                if "max_sessions_per_user" in security:
                    settings.max_sessions_per_user = security["max_sessions_per_user"]
                if "log_retention_days" in security:
                    settings.log_retention_days = security["log_retention_days"]
                if "security_log_level" in security:
                    settings.security_log_level = security["security_log_level"]

            if "registration" in settings_data:
                registration = settings_data["registration"]
                if "invite_code_required" in registration:
                    settings.invite_code_required = registration["invite_code_required"]

            if "system" in settings_data:
                system = settings_data["system"]
                if "max_connections" in system:
                    settings.max_connections = system["max_connections"]
                if "session_timeout_minutes" in system:
                    settings.session_timeout_minutes = system["session_timeout_minutes"]
                if "log_file_size_mb" in system:
                    settings.log_file_size_mb = system["log_file_size_mb"]
                if "system_log_level" in system:
                    settings.system_log_level = system["system_log_level"]
                if "auto_save_enabled" in system:
                    settings.auto_save_enabled = system["auto_save_enabled"]
                if "analytics_enabled" in system:
                    settings.analytics_enabled = system["analytics_enabled"]
                if "system_notifications_enabled" in system:
                    settings.system_notifications_enabled = system["system_notifications_enabled"]

            if "security_features" in settings_data:
                security_features = settings_data["security_features"]
                if "two_factor_auth_required" in security_features:
                    settings.two_factor_auth_required = security_features[
                        "two_factor_auth_required"
                    ]
                if "password_complexity_required" in security_features:
                    settings.password_complexity_required = security_features[
                        "password_complexity_required"
                    ]
                if "session_fingerprinting" in security_features:
                    settings.session_fingerprinting = security_features["session_fingerprinting"]
                if "ip_whitelist_enabled" in security_features:
                    settings.ip_whitelist_enabled = security_features["ip_whitelist_enabled"]
                if "ip_whitelist" in security_features:

                    ip_whitelist = security_features["ip_whitelist"]
                    if isinstance(ip_whitelist, list):
                        settings.ip_whitelist = json.dumps(ip_whitelist)
                    elif isinstance(ip_whitelist, str):
                        settings.ip_whitelist = ip_whitelist
                    else:
                        settings.ip_whitelist = None
                if "rate_limiting_enabled" in security_features:
                    settings.rate_limiting_enabled = security_features["rate_limiting_enabled"]
                if "rate_limit_requests_per_minute" in security_features:
                    settings.rate_limit_requests_per_minute = security_features[
                        "rate_limit_requests_per_minute"
                    ]
                if "vpn_blocking_enabled" in security_features:
                    settings.vpn_blocking_enabled = security_features["vpn_blocking_enabled"]
                if "security_logging_enabled" in security_features:
                    settings.security_logging_enabled = security_features[
                        "security_logging_enabled"
                    ]
                if "suspicious_activity_check_enabled" in security_features:
                    settings.suspicious_activity_check_enabled = security_features[
                        "suspicious_activity_check_enabled"
                    ]
                if "session_limiting_enabled" in security_features:
                    settings.session_limiting_enabled = security_features[
                        "session_limiting_enabled"
                    ]
                if "auto_log_cleanup_enabled" in security_features:
                    settings.auto_log_cleanup_enabled = security_features[
                        "auto_log_cleanup_enabled"
                    ]

            if "appearance" in settings_data:
                settings.appearance_settings = json.dumps(settings_data["appearance"])

            if "encryption" in settings_data:
                encryption = settings_data["encryption"]
                if "encryption_enabled" in encryption:
                    settings.encryption_enabled = encryption["encryption_enabled"]
                if "encryption_algorithm" in encryption:
                    settings.encryption_algorithm = encryption["encryption_algorithm"]
                if "key_rotation_days" in encryption:
                    settings.key_rotation_days = encryption["key_rotation_days"]

            if "backup" in settings_data:
                backup = settings_data["backup"]
                if "auto_backup_enabled" in backup:
                    settings.auto_backup_enabled = backup["auto_backup_enabled"]
                if "backup_frequency_hours" in backup:
                    settings.backup_frequency_hours = backup["backup_frequency_hours"]
                if "backup_retention_days" in backup:
                    settings.backup_retention_days = backup["backup_retention_days"]

            db.session.commit()

            self.invalidate_settings_cache(user_id)

            return {"success": True, "message": "Settings updated successfully"}

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating settings: {str(e)}")
            return {"error": f"Failed to update settings: {str(e)}"}

    def _format_ip_whitelist(self, ip_whitelist_value) -> str:
        """Format IP whitelist as JSON string for frontend"""
        if not ip_whitelist_value:
            return "[]"

        if isinstance(ip_whitelist_value, str):
            try:

                json.loads(ip_whitelist_value)
                return ip_whitelist_value
            except json.JSONDecodeError:

                return "[]"

        if isinstance(ip_whitelist_value, list):
            return json.dumps(ip_whitelist_value)

        return "[]"

    def invalidate_settings_cache(self, user_id: int) -> bool:
        """Invalidate settings cache for a user"""
        try:
            cache_svc = self._cache_service
            if cache_svc is None:
                self.logger.warning("Cache service not available, skipping cache invalidation")
                return False
            cache_svc.delete("settings", user_id=user_id)
            self.logger.info(f"Settings cache invalidated for user {user_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error invalidating settings cache: {e}")
            return False

settings_service = SettingsService()
