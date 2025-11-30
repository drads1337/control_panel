"""
Security Audit Service
Handles security blocking, access checks, and audit operations

Single Responsibility: Security blocking, IP checks, session limits, and audit operations
Extracted from SecurityService to follow SRP (Single Responsibility Principle)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from ...core.extensions import db
from ...models.security import BlockedFingerprint, BlockedIP, LoginAttempt
from ...utils.ip_utils import get_location_from_ip
from ...utils.service_helpers import get_service
from .security_types import SecurityContext

class SecurityAuditService:
    """
    Service for handling security audit operations.
    
    Single Responsibility: Blocking, access checks, and audit operations.
    """

    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger(__name__)

    def create_enhanced_block(
        self,
        context: SecurityContext,
        reason: str,
        block_type: str = "automatic",
        severity: str = "medium",
        threat_score: int = 0,
        expires_at: Optional[datetime] = None,
        blocked_by_user_id: Optional[int] = None,
    ) -> BlockedFingerprint:
        """
        Create an enhanced fingerprint block with comprehensive data
        
        Args:
            context: Security context
            reason: Reason for blocking
            block_type: Type of block (automatic, manual)
            severity: Severity level (low, medium, high, critical)
            threat_score: Threat score (0-100)
            expires_at: Expiration datetime
            blocked_by_user_id: User ID who created the block (for manual blocks)
            
        Returns:
            BlockedFingerprint object
        """
        if not context.country:
            country, city = get_location_from_ip(context.ip_address)
            context.country = country
            if not context.city:
                context.city = city

        max_retries = 3
        for attempt in range(max_retries):
            try:
                existing = BlockedFingerprint.query.filter_by(
                    fingerprint=context.fingerprint, project_id=context.project_id, is_active=True
                ).first()

                if existing:
                    existing.attempt_count += 1
                    existing.last_seen = datetime.utcnow()
                    existing.threat_score = max(existing.threat_score, threat_score)
                    existing.extra_data = json.dumps(
                        {
                            **json.loads(existing.extra_data or "{}"),
                            "last_context": {
                                "ip": context.ip_address,
                                "user_agent": context.user_agent,
                                "timestamp": (
                                    context.timestamp.isoformat() if context.timestamp else None
                                ),
                            },
                        }
                    )
                    db.session.commit()
                    return existing

                blocked_fingerprint = BlockedFingerprint(
                    fingerprint=context.fingerprint,
                    project_id=context.project_id,
                    ip_address=context.ip_address,
                    user_agent=context.user_agent,
                    user_key=context.user_key,
                    country=context.country,
                    city=context.city,
                    reason=reason,
                    block_type=block_type,
                    severity=severity,
                    threat_score=threat_score,
                    blocked_at=context.timestamp or datetime.utcnow(),
                    expires_at=expires_at,
                    blocked_by_user_id=blocked_by_user_id,
                    attempt_count=1,
                    last_seen=context.timestamp or datetime.utcnow(),
                    extra_data=json.dumps(
                        {
                            "context": {
                                "ip": context.ip_address,
                                "user_agent": context.user_agent,
                                "timestamp": (
                                    context.timestamp.isoformat() if context.timestamp else None
                                ),
                            }
                        }
                    ),
                )

                db.session.add(blocked_fingerprint)
                db.session.commit()

                # Log security event
                security_monitoring_service = get_service('security_monitoring_service')
                security_monitoring_service.log_security_event(
                    event_type="fingerprint_blocked",
                    context=context,
                    description=f"Fingerprint blocked: {reason}",
                    severity=severity,
                    threat_score=threat_score,
                    related_fingerprint_id=blocked_fingerprint.id,
                )

                return blocked_fingerprint

            except Exception as e:
                db.session.rollback()

                if "duplicate key value violates unique constraint" in str(e) and (
                    "blocked_fingerprint_fingerprint_key" in str(e)
                    or "blocked_fingerprint_fingerprint_project_key" in str(e)
                ):
                    existing = BlockedFingerprint.query.filter_by(
                        fingerprint=context.fingerprint,
                        project_id=context.project_id,
                        is_active=True,
                    ).first()

                    if existing:
                        existing.attempt_count += 1
                        existing.last_seen = datetime.utcnow()
                        existing.threat_score = max(existing.threat_score, threat_score)
                        existing.extra_data = json.dumps(
                            {
                                **json.loads(existing.extra_data or "{}"),
                                "last_context": {
                                    "ip": context.ip_address,
                                    "user_agent": context.user_agent,
                                    "timestamp": (
                                        context.timestamp.isoformat() if context.timestamp else None
                                    ),
                                },
                            }
                        )
                        db.session.commit()
                        return existing

                if attempt == max_retries - 1:
                    self.logger.error(
                        f"Failed to create enhanced block after {max_retries} attempts: {e}"
                    )
                    raise

                import time
                time.sleep(0.1 * (attempt + 1))

        raise Exception("Failed to create enhanced block after all retries")

    def is_ip_blocked(self, ip_address: str, project_id: int) -> bool:
        """
        Check if an IP address is blocked due to failed login attempts or manual blocking
        
        Args:
            ip_address: IP address to check
            project_id: Project ID
            
        Returns:
            True if IP is blocked, False otherwise
        """
        try:
            blocked_ip = BlockedIP.query.filter_by(
                ip_address=ip_address, project_id=project_id, is_active=True
            ).first()

            if blocked_ip:
                if blocked_ip.expires_at and blocked_ip.expires_at < datetime.utcnow():
                    blocked_ip.is_active = False
                    db.session.commit()
                    return False
                return True

            return False
        except Exception as e:
            self.logger.error(f"Error checking IP block status: {e}")
            return False

    def check_session_limit(self, user_id: int, project_id: int) -> bool:
        """
        Check if user has exceeded session limit
        
        Args:
            user_id: User ID
            project_id: Project ID
            
        Returns:
            True if session limit exceeded, False otherwise
        """
        try:
            # Session limit checking logic would go here
            # For now, return False (no limit)
            return False
        except Exception as e:
            self.logger.error(f"Error checking session limit: {e}")
            return False

    def _check_and_block_ip_if_needed(self, ip_address: str, project_id: int) -> None:
        """
        Check if IP should be automatically blocked based on failed login attempts
        
        Args:
            ip_address: IP address to check
            project_id: Project ID
        """
        try:
            settings = self._get_or_create_project_settings(project_id)
            max_attempts = settings.max_login_attempts
            block_duration = settings.ip_block_duration_minutes

            if not max_attempts or max_attempts <= 0:
                return

            cutoff_time = datetime.utcnow() - timedelta(minutes=block_duration)

            failed_attempts = LoginAttempt.query.filter(
                LoginAttempt.ip_address == ip_address,
                LoginAttempt.project_id == project_id,
                LoginAttempt.success == False,
                LoginAttempt.created_at > cutoff_time,
            ).count()

            if failed_attempts >= max_attempts:
                existing_block = BlockedIP.query.filter_by(
                    ip_address=ip_address, project_id=project_id, is_active=True
                ).first()

                if not existing_block:
                    expires_at = datetime.utcnow() + timedelta(minutes=block_duration)
                    blocked_ip = BlockedIP(
                        ip_address=ip_address,
                        project_id=project_id,
                        reason=f"Automatic block after {failed_attempts} failed login attempts",
                        block_type="automatic",
                        category="security",
                        severity="medium",
                        is_active=True,
                        expires_at=expires_at,
                    )
                    db.session.add(blocked_ip)
                    
                    # Update trigger count for "Failed Login Protection" rule
                    security_rules_service = get_service('security_rules_service')
                    security_rules_service._update_rule_trigger("Failed Login Protection", project_id)
                    
                    db.session.commit()
                    self.logger.warning(
                        f"Automatically blocked IP {ip_address} for project {project_id} after {failed_attempts} failed attempts"
                    )
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error checking login attempts for IP blocking: {e}")

    def _get_or_create_project_settings(self, project_id: int):
        """
        Get or create project settings (returns aggregated settings for backward compatibility)
        
        Args:
            project_id: Project ID
            
        Returns:
            Aggregated settings object
        """
        from ...utils.project_settings_migration import ProjectSettingsHelper
        from ...services.settings.settings_repository import SettingsRepository
        
        repo = SettingsRepository()
        return repo.get_all_project_settings(project_id)

