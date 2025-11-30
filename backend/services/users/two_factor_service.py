"""
Two-Factor Authentication Service
Provides TOTP-based 2FA functionality for enhanced security
"""

import base64
import hashlib
import io
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import pyotp
import qrcode
from flask import current_app

from ...core.extensions import db
from ...models.core import User
from ...models.security import TwoFactorAuth, TwoFactorBackupCode, TwoFactorSession
from ...utils.service_helpers import get_service
from ...utils.service_exceptions import ServiceError
from ...utils.service_helpers import get_service

class TwoFactorService:
    """Service for managing two-factor authentication"""

    def __init__(self, activity_service=None, rbac_service=None):
        self._rbac_service = rbac_service
        self._activity_service = activity_service
        self.issuer_name = "Panel Security"
        self.backup_codes_count = 10
        self.session_timeout_minutes = 15
        self.max_failed_attempts = 5
        self.lockout_duration_minutes = 30

    def _get_issuer_name(self):
        """Get issuer name from app config if available"""
        try:
            return current_app.config.get("TOTP_ISSUER_NAME", "Panel Security")
        except RuntimeError:
            return "Panel Security"

    def generate_secret_key(self) -> str:
        """Generate a new TOTP secret key"""
        return pyotp.random_base32()

    def generate_qr_code(self, user: User, secret_key: str) -> str:
        """Generate QR code for TOTP setup"""
        totp_uri = pyotp.totp.TOTP(secret_key).provisioning_uri(
            name=user.username, issuer_name=self._get_issuer_name()
        )

        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_base64}"

    def generate_backup_codes(self, count: int = None) -> List[str]:
        """Generate backup codes for 2FA recovery"""
        if count is None:
            count = self.backup_codes_count

        codes = []
        for _ in range(count):

            code = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(8))
            codes.append(code)

        return codes

    def hash_backup_code(self, code: str) -> str:
        """Hash a backup code for secure storage"""
        return hashlib.sha256(code.encode()).hexdigest()

    def verify_totp_code(self, secret_key: str, code: str, window: int = 1) -> bool:
        """Verify a TOTP code"""
        try:
            totp = pyotp.TOTP(secret_key)
            return totp.verify(code, valid_window=window)
        except Exception:
            return False

    def verify_backup_code(self, user_id: int, code: str) -> bool:
        """Verify a backup code"""
        code_hash = self.hash_backup_code(code)

        backup_code = TwoFactorBackupCode.query.filter_by(
            user_id=user_id, code_hash=code_hash, is_used=False
        ).first()

        if backup_code:
            backup_code.is_used = True
            backup_code.used_at = datetime.utcnow()
            db.session.commit()
            return True

        return False

    def setup_2fa(self, user: User, secret_key: str = None) -> Dict:
        """Setup 2FA for a user"""
        if secret_key is None:
            secret_key = self.generate_secret_key()

        backup_codes = self.generate_backup_codes()

        two_factor = TwoFactorAuth.query.filter_by(user_id=user.id).first()
        if not two_factor:
            two_factor = TwoFactorAuth(user_id=user.id, project_id=user.project_id)
            db.session.add(two_factor)

        two_factor.secret_key = secret_key
        two_factor.is_enabled = False
        two_factor.updated_at = datetime.utcnow()

        backup_codes_data = []
        for code in backup_codes:
            backup_code = TwoFactorBackupCode(
                user_id=user.id, code_hash=self.hash_backup_code(code), project_id=user.project_id
            )
            db.session.add(backup_code)
            backup_codes_data.append(code)

        db.session.commit()

        qr_code = self.generate_qr_code(user, secret_key)

        return {
            "secret_key": secret_key,
            "qr_code": qr_code,
            "backup_codes": backup_codes_data,
            "manual_entry_key": secret_key,
        }

    def verify_and_enable_2fa(self, user: User, code: str) -> bool:
        """Verify TOTP code and enable 2FA"""
        two_factor = TwoFactorAuth.query.filter_by(user_id=user.id).first()
        if not two_factor or not two_factor.secret_key:
            return False

        if self.verify_totp_code(two_factor.secret_key, code):
            two_factor.is_enabled = True
            two_factor.updated_at = datetime.utcnow()
            db.session.commit()

            activity_service = get_service('activity_service')
            activity_service.log_activity(
                user,
                "2fa_enabled",
                details="Two-factor authentication enabled",
                ip=current_app.request.remote_addr if hasattr(current_app, "request") else None,
            )

            return True

        return False

    def disable_2fa(self, user: User, password: str = None) -> bool:
        """Disable 2FA for a user"""
        two_factor = TwoFactorAuth.query.filter_by(user_id=user.id).first()
        if not two_factor:
            return False

        two_factor.is_enabled = False
        two_factor.secret_key = None
        two_factor.updated_at = datetime.utcnow()

        TwoFactorBackupCode.query.filter_by(user_id=user.id).update({"is_used": True})

        TwoFactorSession.query.filter_by(user_id=user.id).delete()

        db.session.commit()

        activity_service = get_service('activity_service')
        activity_service.log_activity(
            user,
            "2fa_disabled",
            details="Two-factor authentication disabled",
            ip=current_app.request.remote_addr if hasattr(current_app, "request") else None,
        )

        return True

    def create_2fa_session(
        self,
        user: User,
        temp_token: str,
        ip_address: str = None,
        user_agent: str = None,
        device_fingerprint: str = None,
    ) -> str:
        """Create a 2FA session for verification"""
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=self.session_timeout_minutes)

        session = TwoFactorSession(
            user_id=user.id,
            session_token=session_token,
            temp_token=temp_token,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint,
            expires_at=expires_at,
            project_id=user.project_id,
        )

        db.session.add(session)
        db.session.commit()

        return session_token

    def verify_2fa_session(self, session_token: str, code: str) -> Tuple[bool, Optional[User]]:
        """Verify 2FA code for a session"""
        session = TwoFactorSession.query.filter_by(
            session_token=session_token, is_verified=False
        ).first()

        if not session or session.expires_at < datetime.utcnow():
            return False, None

        user = User.query.filter_by(id=session.user_id).first()

        if not user:
            return False, None

        if not user.project_id:
            return False, None

        two_factor = TwoFactorAuth.query.filter_by(user_id=user.id).first()
        if not two_factor or not two_factor.is_enabled:
            return False, None

        if two_factor.locked_until and two_factor.locked_until > datetime.utcnow():
            return False, None

        if two_factor.secret_key and self.verify_totp_code(two_factor.secret_key, code):
            session.is_verified = True
            session.verified_at = datetime.utcnow()
            two_factor.last_used = datetime.utcnow()
            two_factor.failed_attempts = 0
            two_factor.locked_until = None
            db.session.commit()
            return True, user

        if self.verify_backup_code(user.id, code):
            session.is_verified = True
            session.verified_at = datetime.utcnow()
            two_factor.last_used = datetime.utcnow()
            two_factor.failed_attempts = 0
            two_factor.locked_until = None
            db.session.commit()
            return True, user

        two_factor.failed_attempts += 1
        if two_factor.failed_attempts >= self.max_failed_attempts:
            two_factor.locked_until = datetime.utcnow() + timedelta(
                minutes=self.lockout_duration_minutes
            )

        db.session.commit()
        return False, None

    def get_2fa_status(self, user: User) -> Dict:
        """Get 2FA status for a user"""
        two_factor = TwoFactorAuth.query.filter_by(user_id=user.id).first()

        if not two_factor:
            return {
                "is_enabled": False,
                "is_setup": False,
                "backup_codes_count": 0,
                "is_locked": False,
                "locked_until": None,
            }

        unused_backup_codes = TwoFactorBackupCode.query.filter_by(
            user_id=user.id, is_used=False
        ).count()

        return {
            "is_enabled": two_factor.is_enabled,
            "is_setup": two_factor.secret_key is not None,
            "backup_codes_count": unused_backup_codes,
            "is_locked": two_factor.locked_until and two_factor.locked_until > datetime.utcnow(),
            "locked_until": (
                two_factor.locked_until.isoformat() if two_factor.locked_until else None
            ),
            "last_used": two_factor.last_used.isoformat() if two_factor.last_used else None,
        }

    def regenerate_backup_codes(self, user: User) -> List[str]:
        """Regenerate backup codes for a user"""
        two_factor = TwoFactorAuth.query.filter_by(user_id=user.id).first()
        if not two_factor or not two_factor.is_enabled:
            return []

        TwoFactorBackupCode.query.filter_by(user_id=user.id).update({"is_used": True})

        backup_codes = self.generate_backup_codes()
        for code in backup_codes:
            backup_code = TwoFactorBackupCode(
                user_id=user.id, code_hash=self.hash_backup_code(code), project_id=user.project_id
            )
            db.session.add(backup_code)

        db.session.commit()

        activity_service = get_service('activity_service')
        activity_service.log_activity(
            user,
            "2fa_backup_codes_regenerated",
            details="Backup codes regenerated",
            ip=current_app.request.remote_addr if hasattr(current_app, "request") else None,
        )

        return backup_codes

    def cleanup_expired_sessions(self):
        """Clean up expired 2FA sessions"""
        expired_sessions = TwoFactorSession.query.filter(
            TwoFactorSession.expires_at < datetime.utcnow()
        ).all()

        for session in expired_sessions:
            db.session.delete(session)

        db.session.commit()
        return len(expired_sessions)

    def is_2fa_required(self, user: User) -> bool:
        """Check if 2FA is required for a user"""
        rbac_service = self._rbac_service or get_service('rbac_service')
        
        if not self._rbac:
            raise ServiceError(
                "Rbac dependency not injected",
                status_code=500
            )
        rbac_service = self._rbac
        rbac_service = get_service('rbac_service')
        if rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return True

        admin_permissions = ["rbac.view", "employees.view", "system.view_health"]
        return any(rbac_service.check_permission(user.id, perm) for perm in admin_permissions)

