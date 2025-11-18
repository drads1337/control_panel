"""
Security Checker
Handles security validations, fingerprint checks, and suspicious activity detection
"""

import logging
import time
import types
from datetime import datetime, timedelta
from typing import Optional, Tuple

from flask import request

from ...core.extensions import db
from ...models import BlockedFingerprint, User
from ...services.security import SecurityContext, security_service

class SecurityChecker:
    """Handles security validations and checks"""

    def __init__(self):
        self.bad_ua_keywords = ["wget", "python", "requests", "postman", "insomnia"]
        self.bad_headers = []
        self.suspicious_threshold = 3
        self.suspicious_window = 3600

    def check_suspicious_request(
        self, user_agent: str, headers: dict
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if request appears suspicious based on user agent and headers

        Args:
            user_agent: User agent string
            headers: Request headers

        Returns:
            Tuple of (is_suspicious, reason)
        """
        ua = user_agent.lower()

        for bad in self.bad_ua_keywords:
            if bad in ua:
                return True, f"BAD_UA_{bad}"

        for h in self.bad_headers:
            if h in (k.lower() for k in headers.keys()):
                return True, f"BAD_HEADER_{h}"

        return False, None

    def check_fingerprint_blocked(self, fingerprint: str, project_id: int) -> bool:
        """
        Check if fingerprint is blocked (with caching)

        Args:
            fingerprint: Device fingerprint
            project_id: Project ID

        Returns:
            True if fingerprint is blocked
        """
        try:
            import redis

            from ...config.config import Config

            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
            )

            cache_key = f"blocked_fp:{project_id}:{fingerprint}"
            cached_result = redis_client.get(cache_key)

            if cached_result is not None:
                return cached_result == "1"

            blocked = BlockedFingerprint.query.filter_by(
                fingerprint=fingerprint, project_id=project_id, is_active=True
            ).first()

            if not blocked:
                redis_client.setex(cache_key, 300, "0")
                return False

            now = datetime.utcnow()
            if blocked.expires_at and blocked.expires_at < now:
                blocked.is_active = False
                blocked.unblocked_at = now
                db.session.commit()
                redis_client.setex(cache_key, 300, "0")
                return False

            redis_client.setex(cache_key, 60, "1")
            return True

        except Exception as e:
            logging.error(f"FINGERPRINT_CHECK_ERROR: {e}")
            return self._check_fingerprint_blocked_direct(fingerprint, project_id)

    def _check_fingerprint_blocked_direct(self, fingerprint: str, project_id: int) -> bool:
        """Direct database check for blocked fingerprint (fallback)"""
        now = datetime.utcnow()

        blocked = BlockedFingerprint.query.filter_by(
            fingerprint=fingerprint, project_id=project_id, is_active=True
        ).first()

        if not blocked:
            return False

        if blocked.expires_at and blocked.expires_at < now:
            blocked.is_active = False
            blocked.unblocked_at = now
            db.session.commit()
            return False

        blocked.last_seen = now
        db.session.commit()

        return True

    def enhanced_fingerprint_security_check(
        self,
        fingerprint: str,
        ip: str,
        user_agent: str,
        user_key: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Enhanced security check using security service

        Args:
            fingerprint: Device fingerprint
            ip: IP address
            user_agent: User agent string
            user_key: User key (optional)
            project_id: Project ID (optional)

        Returns:
            Tuple of (is_blocked, block_reason)
        """
        try:
            context = SecurityContext(
                fingerprint=fingerprint,
                ip_address=ip,
                user_agent=user_agent,
                user_key=user_key,
                project_id=project_id,
                timestamp=datetime.utcnow(),
            )

            threat_assessment = security_service.assess_threat(context)
            triggered_rules = security_service.check_automated_rules(context)

            if threat_assessment.level in ["high", "critical"] or triggered_rules:
                security_service.create_enhanced_block(
                    context=context,
                    reason=f"Automated security block - Threat level: {threat_assessment.level}",
                    block_type="automatic",
                    severity=threat_assessment.level,
                    threat_score=threat_assessment.score,
                    expires_at=datetime.utcnow() + timedelta(hours=24),
                )
                return True, f"Blocked due to {threat_assessment.level} threat level"

            return False, None

        except Exception as e:
            db.session.rollback()
            logging.error(f"Error in enhanced_fingerprint_security_check: {e}")
            return False, None

    def behavioral_analysis(self, user_key: str, ip: str, fingerprint: str) -> str:
        """
        Perform behavioral analysis on user activity

        Args:
            user_key: User key
            ip: IP address
            fingerprint: Device fingerprint

        Returns:
            Geographic location
        """
        geo = self._get_geolocation(ip)
        now = int(time.time())

        try:
            import redis

            from ...config.config import Config

            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
            )

            last_geo = redis_client.get(f"geo:{user_key}")
            redis_client.set(f"geo:{user_key}", geo, ex=86400)

            last_time = redis_client.get(f"last_time:{user_key}")
            if hasattr(last_time, "__await__") or isinstance(last_time, types.CoroutineType):
                delta = 9999
            elif last_time:
                try:
                    last_time_int = int(last_time)
                    delta = now - last_time_int
                except Exception:
                    delta = 9999
            else:
                delta = 9999

            redis_client.set(f"last_time:{user_key}", now, ex=86400)

            last_fp = redis_client.get(f"last_fp:{user_key}")
            redis_client.set(f"last_fp:{user_key}", fingerprint, ex=86400)

        except Exception as e:
            logging.error(f"Error in behavioral analysis: {e}")

        return geo

    def _get_geolocation(self, ip: str) -> str:
        """Get geographic location for IP address"""
        try:
            import requests

            resp = requests.get(f"https://ipapi.co/{ip}/json/", timeout=2)
            if resp.status_code == 200:
                return resp.json().get("country_name", "Unknown")
        except Exception:
            pass
        return "Unknown"

    def check_and_block_key(self, user_key: str, reason: str, project_id: int) -> None:
        """
        Check suspicious activity and block key if threshold exceeded

        Args:
            user_key: User key
            reason: Reason for suspicious activity
            project_id: Project ID
        """
        try:
            import redis

            from ...config.config import Config

            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
            )

            key = f"suspicious:{user_key}"
            count = redis_client.incr(key)

            if hasattr(count, "__await__") or isinstance(count, types.CoroutineType):
                count = 0
            else:
                try:
                    count = int(count)
                except Exception:
                    count = 0

            if count == 1:
                redis_client.expire(key, self.suspicious_window)

            if count >= self.suspicious_threshold:
                from ...models import Key

                key_obj = Key.query.filter_by(key=user_key, project_id=project_id).first()
                if key_obj and key_obj.status == 1:
                    key_obj.status = 0
                    db.session.commit()
                    logging.warning(f"Key {user_key} blocked due to suspicious activity: {reason}")
                    self._notify_admin(
                        f"Key {user_key} blocked due to suspicious activity: {reason}"
                    )

        except Exception as e:
            logging.error(f"Error in check_and_block_key: {e}")

    def _notify_admin(self, message: str) -> None:
        """Send notification to admin via Telegram"""
        import os

        import requests

        telegram_token = os.environ.get("TELEGRAM_TOKEN")
        telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID")

        if telegram_token and telegram_chat_id:
            try:
                url = f"https://api.telegram.org/bot{telegram_token}/sendMessage"
                data = {"chat_id": telegram_chat_id, "text": message}
                requests.post(url, data=data, timeout=2)
            except Exception as e:
                logging.warning(f"Telegram notify failed: {e}")

    def log_suspicious_activity(self, ip: str, reason: str, data: Optional[str] = None) -> None:
        """
        Log suspicious activity

        Args:
            ip: IP address
            reason: Reason for suspicion
            data: Additional data
        """
        logging.debug(f"[ANTICRACK] Suspicious: {ip} | {reason} | {data}")

    def get_fingerprint(self, data: dict) -> str:
        """
        Generate device fingerprint from device data

        Args:
            data: Device data dictionary

        Returns:
            Generated fingerprint
        """
        import hashlib

        base = f"{data.get('android_id','')}-{data.get('device_model','')}-{data.get('device_brand','')}"
        return hashlib.sha256(base.encode()).hexdigest()
