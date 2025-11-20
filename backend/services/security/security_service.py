"""
Enhanced Security Service for Advanced Fingerprint Management
Provides comprehensive security features including automated blocking, threat analysis, and behavioral monitoring
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from ...core.extensions import db
from ...models.core import Project, ProjectSettings, User
from ...models.keys import Key
from ...models.security import (
    BlockedFingerprint,
    BlockedIP,
    LoginAttempt,
    SecurityAnalytics,
    SecurityEvent,
    SecurityRule,
)
from ...utils.ip_utils import get_location_from_ip

@dataclass
class ThreatAssessment:
    """Data class for threat assessment results"""

    score: int
    level: str
    factors: List[str]
    recommendations: List[str]

@dataclass
class SecurityContext:
    """Data class for security context information"""

    fingerprint: str
    ip_address: str
    user_agent: str
    user_key: Optional[str] = None
    project_id: Optional[int] = None
    country: Optional[str] = None
    city: Optional[str] = None
    timestamp: Optional[datetime] = None

class SecurityService:
    """Enhanced security service for advanced fingerprint management"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def assess_threat(self, context: SecurityContext) -> ThreatAssessment:
        """Assess threat level based on multiple security factors"""
        factors = []
        score = 0

        if self._is_suspicious_user_agent(context.user_agent):
            factors.append("Suspicious user agent")
            score += 20

        if self._is_known_bad_ip(context.ip_address):
            factors.append("Known malicious IP")
            score += 30

        if self._is_rapid_request(context.fingerprint):
            factors.append("Rapid request pattern")
            score += 15

        if self._is_geographic_anomaly(context):
            factors.append("Geographic anomaly")
            score += 25

        if self._is_fingerprint_reuse(context.fingerprint):
            factors.append("Fingerprint reuse detected")
            score += 10

        if score >= 80:
            level = "critical"
        elif score >= 60:
            level = "high"
        elif score >= 40:
            level = "medium"
        else:
            level = "low"

        recommendations = self._generate_recommendations(score, factors)

        return ThreatAssessment(
            score=min(score, 100), level=level, factors=factors, recommendations=recommendations
        )

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
        """Create an enhanced fingerprint block with comprehensive data"""

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

                self._log_security_event(
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

    def check_automated_rules(self, context: SecurityContext) -> List[Dict[str, Any]]:
        """Check and execute automated security rules"""
        triggered_rules = []

        rules = (
            SecurityRule.query.filter(
                SecurityRule.project_id == context.project_id,
                (SecurityRule.is_active == True) | (SecurityRule.name == "Rapid Request Detection"),
            )
            .order_by(SecurityRule.priority.desc())
            .all()
        )

        for rule in rules:
            try:
                if self._evaluate_rule(rule, context):
                    action_result = self._execute_rule_action(rule, context)
                    triggered_rules.append(
                        {"rule_id": rule.id, "rule_name": rule.name, "action_result": action_result}
                    )

                    rule.trigger_count += 1
                    rule.last_triggered = datetime.utcnow()
                    db.session.commit()

            except Exception as e:

                db.session.rollback()
                self.logger.error(f"Error executing rule {rule.id}: {e}")

        return triggered_rules

    def get_security_analytics(self, project_id: int, days: int = 30) -> Dict[str, Any]:
        """Get comprehensive security analytics"""
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)

        blocked_fingerprints = BlockedFingerprint.query.filter(
            BlockedFingerprint.project_id == project_id, BlockedFingerprint.blocked_at >= start_date
        ).all()

        security_events = SecurityEvent.query.filter(
            SecurityEvent.project_id == project_id, SecurityEvent.created_at >= start_date
        ).all()

        stats = {
            "total_blocked": len(blocked_fingerprints),
            "block_types": {},
            "severity_distribution": {},
            "threat_score_avg": 0,
            "top_countries": {},
            "top_user_agents": {},
            "timeline": {},
            "recent_events": [],
        }

        if blocked_fingerprints:

            for fp in blocked_fingerprints:
                stats["block_types"][fp.block_type] = stats["block_types"].get(fp.block_type, 0) + 1
                stats["severity_distribution"][fp.severity] = (
                    stats["severity_distribution"].get(fp.severity, 0) + 1
                )

                if fp.country:
                    stats["top_countries"][fp.country] = (
                        stats["top_countries"].get(fp.country, 0) + 1
                    )

                if fp.user_agent:

                    ua = fp.user_agent[:50] + "..." if len(fp.user_agent) > 50 else fp.user_agent
                    stats["top_user_agents"][ua] = stats["top_user_agents"].get(ua, 0) + 1

            total_score = sum(fp.threat_score for fp in blocked_fingerprints)
            stats["threat_score_avg"] = round(total_score / len(blocked_fingerprints), 2)

        for i in range(days):
            date = start_date + timedelta(days=i)
            day_blocks = [fp for fp in blocked_fingerprints if fp.blocked_at.date() == date]
            stats["timeline"][date.isoformat()] = len(day_blocks)

        recent_events = security_events[-10:]
        stats["recent_events"] = [
            {
                "id": event.id,
                "type": event.event_type,
                "severity": event.severity,
                "description": event.description,
                "timestamp": event.created_at.isoformat(),
                "threat_score": event.threat_score,
            }
            for event in recent_events
        ]

        return stats

    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check if user agent is suspicious"""
        if not user_agent:
            return True

        suspicious_patterns = [
            "wget",
            "python",
            "requests",
            "postman",
            "insomnia",
            "bot",
            "crawler",
            "spider",
            "scraper",
            "automated",
            "headless",
            "phantom",
            "selenium",
            "webdriver",
            "httpie",
            "urllib",
        ]
        return any(pattern in user_agent.lower() for pattern in suspicious_patterns)

    def _is_known_bad_ip(self, ip_address: str) -> bool:
        """Check if IP is known to be malicious"""
        try:

            bad_ip_ranges = [
                "10.0.0.0/8",
                "192.168.0.0/16",
                "172.16.0.0/12",
            ]

            if ip_address.startswith("0.0.0.") or ip_address == "127.0.0.1":
                return True

            return False

        except Exception:
            return False

    def _is_rapid_request(self, fingerprint: str) -> bool:
        """Check for rapid request patterns"""
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

            rate_key = f"request_rate:{fingerprint}"
            current_count = redis_client.get(rate_key)

            if current_count is None:
                current_count = 0
            else:
                try:
                    current_count = int(current_count)
                except (ValueError, TypeError):
                    current_count = 0

            new_count = redis_client.incr(rate_key)
            if new_count == 1:
                redis_client.expire(rate_key, 60)

            return new_count > 20

        except Exception:
            return False

    def _is_geographic_anomaly(self, context: SecurityContext) -> bool:
        """Check for geographic anomalies"""
        try:

            if not context.country and context.ip_address:
                from ...utils.ip_utils import get_location_from_ip

                country, city = get_location_from_ip(context.ip_address)
                context.country = country

            if not context.country:
                return False

            return False

        except Exception:
            return False

    def _is_fingerprint_reuse(self, fingerprint: str) -> bool:
        """Check for fingerprint reuse across different contexts"""
        try:
            from datetime import datetime, timedelta

            from ...models.security import SecurityEvent

            start_time = datetime.utcnow() - timedelta(hours=24)
            unique_keys = (
                db.session.query(SecurityEvent.user_key)
                .filter(
                    SecurityEvent.fingerprint == fingerprint,
                    SecurityEvent.created_at >= start_time,
                    SecurityEvent.user_key.isnot(None),
                )
                .distinct()
                .count()
            )

            return unique_keys > 3

        except Exception:
            return False

    def _generate_recommendations(self, score: int, factors: List[str]) -> List[str]:
        """Generate security recommendations based on threat assessment"""
        recommendations = []

        if score >= 60:
            recommendations.append("Consider immediate blocking")
        if "Suspicious user agent" in factors:
            recommendations.append("Investigate user agent patterns")
        if "Geographic anomaly" in factors:
            recommendations.append("Review geographic access patterns")
        if score >= 40:
            recommendations.append("Increase monitoring for this fingerprint")

        return recommendations

    def _evaluate_rule(self, rule: SecurityRule, context: SecurityContext) -> bool:
        """Evaluate if a security rule should be triggered"""
        try:
            conditions = json.loads(rule.conditions)

            if rule.last_triggered:
                cooldown_end = rule.last_triggered + timedelta(minutes=rule.cooldown_minutes)
                if datetime.utcnow() < cooldown_end:
                    return False

            if rule.rule_type == "fingerprint_block":
                return self._evaluate_fingerprint_conditions(conditions, context)
            elif rule.rule_type == "rate_limit":
                return self._evaluate_rate_limit_conditions(conditions, context)
            elif rule.rule_type == "geo_block":
                return self._evaluate_geo_conditions(conditions, context)
            elif rule.rule_type == "behavioral":
                return self._evaluate_behavioral_conditions(conditions, context)

            return False

        except Exception as e:
            self.logger.error(f"Error evaluating rule {rule.id}: {e}")
            return False

    def _execute_rule_action(self, rule: SecurityRule, context: SecurityContext) -> Dict[str, Any]:
        """Execute the action defined in a security rule"""
        try:
            action_params = json.loads(rule.action_params or "{}")

            if rule.action_type == "block":

                block = self.create_enhanced_block(
                    context=context,
                    reason=f"Automated block by rule: {rule.name}",
                    block_type="automatic",
                    severity=action_params.get("severity", "medium"),
                    threat_score=action_params.get("threat_score", 50),
                    expires_at=datetime.utcnow()
                    + timedelta(hours=action_params.get("block_duration_hours", 24)),
                )
                return {"action": "blocked", "block_id": block.id}

            elif rule.action_type == "warn":

                self._log_security_event(
                    event_type="security_warning",
                    context=context,
                    description=f"Security warning from rule: {rule.name}",
                    severity="medium",
                    related_rule_id=rule.id,
                )
                return {"action": "warned"}

            elif rule.action_type == "log":

                self._log_security_event(
                    event_type="rule_triggered",
                    context=context,
                    description=f"Rule triggered: {rule.name}",
                    severity="low",
                    related_rule_id=rule.id,
                )
                return {"action": "logged"}

            return {"action": "none"}

        except Exception as e:
            self.logger.error(f"Error executing rule action {rule.id}: {e}")
            return {"action": "error", "error": str(e)}

    def _evaluate_fingerprint_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate fingerprint-specific conditions"""
        try:

            if "user_agent_patterns" in conditions:
                patterns = conditions["user_agent_patterns"]
                match_type = conditions.get("match_type", "contains_any")

                if match_type == "contains_any":
                    for pattern in patterns:
                        if pattern.lower() in context.user_agent.lower():
                            return True
                elif match_type == "contains_all":
                    for pattern in patterns:
                        if pattern.lower() not in context.user_agent.lower():
                            return False
                    return True

            if "min_threat_score" in conditions:
                min_score = conditions["min_threat_score"]
                threat_assessment = self.assess_threat(context)
                if threat_assessment.score >= min_score:
                    return True

            return False

        except Exception as e:
            self.logger.error(f"Error evaluating fingerprint conditions: {e}")
            return False

    def _evaluate_rate_limit_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate rate limiting conditions"""
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

            max_requests = conditions.get("max_requests_per_minute", 10)
            time_window = conditions.get("time_window_minutes", 5)

            rate_key = f"rate_limit:{context.fingerprint}:{context.project_id}"

            current_count = redis_client.get(rate_key)
            if current_count is None:
                current_count = 0
            else:
                try:
                    current_count = int(current_count)
                except (ValueError, TypeError):
                    current_count = 0

            new_count = redis_client.incr(rate_key)
            if new_count == 1:

                redis_client.expire(rate_key, time_window * 60)

            return new_count > max_requests

        except Exception as e:
            self.logger.error(f"Error evaluating rate limit conditions: {e}")
            return False

    def _evaluate_geo_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate geographic conditions"""
        try:

            if not context.country:
                from ...utils.ip_utils import get_location_from_ip

                country, city = get_location_from_ip(context.ip_address)
                context.country = country
                if not context.city:
                    context.city = city

            if "blocked_countries" in conditions:
                blocked_countries = conditions["blocked_countries"]
                if context.country and context.country.upper() in [
                    c.upper() for c in blocked_countries
                ]:
                    return True

            if "allowed_countries" in conditions:
                allowed_countries = conditions["allowed_countries"]
                if context.country and context.country.upper() not in [
                    c.upper() for c in allowed_countries
                ]:
                    return True

            return False

        except Exception as e:
            self.logger.error(f"Error evaluating geo conditions: {e}")
            return False

    def _evaluate_behavioral_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate behavioral conditions"""
        try:

            if "fingerprint_reuse_threshold" in conditions:
                threshold = conditions["fingerprint_reuse_threshold"]
                time_window_hours = conditions.get("time_window_hours", 24)

                from datetime import datetime, timedelta

                from ...models.security import SecurityEvent

                start_time = datetime.utcnow() - timedelta(hours=time_window_hours)
                unique_keys = (
                    db.session.query(SecurityEvent.user_key)
                    .filter(
                        SecurityEvent.fingerprint == context.fingerprint,
                        SecurityEvent.project_id == context.project_id,
                        SecurityEvent.created_at >= start_time,
                        SecurityEvent.user_key.isnot(None),
                    )
                    .distinct()
                    .count()
                )

                if unique_keys >= threshold:
                    return True

            if "rapid_connections" in conditions.get("check_patterns", []):
                from datetime import datetime, timedelta

                from ...models.security import SecurityEvent

                start_time = datetime.utcnow() - timedelta(hours=1)
                connection_count = SecurityEvent.query.filter(
                    SecurityEvent.fingerprint == context.fingerprint,
                    SecurityEvent.project_id == context.project_id,
                    SecurityEvent.created_at >= start_time,
                    SecurityEvent.event_type == "connection_attempt",
                ).count()

                if connection_count >= 10:
                    return True

            return False

        except Exception as e:
            self.logger.error(f"Error evaluating behavioral conditions: {e}")
            return False

    def _log_security_event(
        self,
        event_type: str,
        context: SecurityContext,
        description: str,
        severity: str = "medium",
        threat_score: int = 0,
        related_rule_id: Optional[int] = None,
        related_fingerprint_id: Optional[int] = None,
    ):
        """Log a security event"""
        try:
            event = SecurityEvent(
                event_type=event_type,
                severity=severity,
                fingerprint=context.fingerprint,
                ip_address=context.ip_address,
                user_agent=context.user_agent,
                user_key=context.user_key,
                country=context.country,
                city=context.city,
                description=description,
                threat_score=threat_score,
                related_rule_id=related_rule_id,
                related_fingerprint_id=related_fingerprint_id,
                project_id=context.project_id,
            )

            db.session.add(event)
            db.session.commit()
        except Exception as e:

            db.session.rollback()
            self.logger.error(f"Error logging security event: {e}")

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

            return False
        except Exception as e:
            self.logger.error(f"Error checking session limit: {e}")
            return False

    def record_login_attempt(
        self,
        ip_address: str,
        username: str,
        success: bool,
        project_id: int,
        user_agent: Optional[str] = None,
    ) -> None:
        """
        Record login attempt for security monitoring

        Args:
            ip_address: Client IP address
            username: Username attempting login
            success: Whether login was successful
            project_id: Project ID
            user_agent: Client user agent string
        """
        try:
            country, city = get_location_from_ip(ip_address)

            attempt = LoginAttempt(
                ip_address=ip_address,
                username=username,
                success=success,
                user_agent=user_agent,
                country=country,
                city=city,
                project_id=project_id,
            )

            db.session.add(attempt)
            db.session.commit()

            if not success:
                self._check_and_block_ip_if_needed(ip_address, project_id)
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error recording login attempt: {e}")

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
                    db.session.commit()
                    self.logger.warning(
                        f"Automatically blocked IP {ip_address} for project {project_id} after {failed_attempts} failed attempts"
                    )
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error checking login attempts for IP blocking: {e}")

    def _get_or_create_project_settings(self, project_id: int) -> ProjectSettings:
        """
        Get or create project settings

        Args:
            project_id: Project ID

        Returns:
            ProjectSettings instance
        """
        import secrets

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

security_service = SecurityService()
