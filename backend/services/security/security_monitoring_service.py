"""
Security Monitoring Service
Handles security monitoring, threat assessment, and analytics

Single Responsibility: Security monitoring, threat assessment, and event logging
Extracted from SecurityService to follow SRP (Single Responsibility Principle)
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from ...core.extensions import db
from ...models.security import BlockedFingerprint, LoginAttempt, SecurityEvent
from ...utils.ip_utils import get_location_from_ip
from ...utils.service_exceptions import ServiceError
from .security_types import SecurityContext, ThreatAssessment

class SecurityMonitoringService:
    """
    Service for handling security monitoring operations.
    
    Single Responsibility: Monitor security events, assess threats, and provide analytics.
    """

    def __init__(self, logger=None, security_audit_service=None, security_rules_service=None):
        self._security_rules_service = security_rules_service
        self._security_audit_service = security_audit_service
        self.logger = logger or logging.getLogger(__name__)

    def assess_threat(self, context: SecurityContext) -> ThreatAssessment:
        """
        Assess threat level based on multiple security factors
        
        Args:
            context: Security context with fingerprint, IP, user_agent, etc.
            
        Returns:
            ThreatAssessment with score, level, factors, and recommendations
        """
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

    def get_security_analytics(self, project_id: int, days: int = 30) -> Dict[str, Any]:
        """
        Get comprehensive security analytics
        
        Args:
            project_id: Project ID
            days: Number of days to analyze
            
        Returns:
            Dictionary with security analytics
        """
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

    def log_security_event(
        self,
        event_type: str,
        context: SecurityContext,
        description: str,
        severity: str = "medium",
        threat_score: int = 0,
        related_rule_id: Optional[int] = None,
        related_fingerprint_id: Optional[int] = None,
    ):
        """
        Log a security event
        
        Args:
            event_type: Type of security event
            context: Security context
            description: Event description
            severity: Event severity (low, medium, high, critical)
            threat_score: Threat score (0-100)
            related_rule_id: Related security rule ID
            related_fingerprint_id: Related blocked fingerprint ID
        """
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
                # Check and block IP if needed (Failed Login Protection rule)
                # Import here to avoid circular dependency
                
                security_audit_service = get_service('security_audit_service')
                security_audit_service._check_and_block_ip_if_needed(ip_address, project_id)
                
                security_audit_service = get_service('security_audit_service')
                # Also check brute force protection rule
                try:
                    context = SecurityContext(
                        fingerprint="",  # Not available during login
                        ip_address=ip_address,
                        user_agent=user_agent or "",
                        user_key=None,
                        project_id=project_id,
                        timestamp=datetime.utcnow(),
                    )
                    # Check brute force rule - this will update trigger if condition is met
                    from ...models.security import SecurityRule
                    import json
                    
                    brute_force_rule = SecurityRule.query.filter_by(
                        name="Brute Force Protection",
                        project_id=project_id,
                        is_active=True
                    ).first()
                    if brute_force_rule:
                        security_rules_service = self._security_rules_service or get_service('security_rules_service')
                        conditions = json.loads(brute_force_rule.conditions)
                        security_rules_service = self._security_rules_service or get_service('security_rules_service')
                        if security_rules_service._evaluate_brute_force_conditions(conditions, context):
                            security_rules_service = get_service('security_rules_service')
                            # Rule already updates trigger in _evaluate_brute_force_conditions
                            self.logger.info(f"Brute force protection triggered for IP {ip_address}")
                except Exception as e:
                    self.logger.debug(f"Error checking brute force rule during login: {e}")
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error recording login attempt: {e}")

    def _is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check if user agent is suspicious"""
        if not user_agent:
            return False

        suspicious_patterns = [
            "bot",
            "crawler",
            "spider",
            "scraper",
            "curl",
            "wget",
            "python-requests",
            "go-http-client",
        ]

        ua_lower = user_agent.lower()
        return any(pattern in ua_lower for pattern in suspicious_patterns)

    def _is_known_bad_ip(self, ip_address: str) -> bool:
        """Check if IP is known to be malicious"""
        # This could be enhanced with threat intelligence feeds
        # For now, check against blocked IPs
        try:
            from ...models.security import BlockedIP

            blocked = BlockedIP.query.filter_by(ip_address=ip_address, is_active=True).first()
            return blocked is not None
        except Exception:
            return False

    def _is_rapid_request(self, fingerprint: str) -> bool:
        """Check if fingerprint is making rapid requests"""
        try:
            from ...models.security import SecurityEvent

            time_window = datetime.utcnow() - timedelta(minutes=1)
            recent_events = SecurityEvent.query.filter(
                SecurityEvent.fingerprint == fingerprint,
                SecurityEvent.created_at >= time_window,
            ).count()

            return recent_events > 10
        except Exception:
            return False

    def _is_geographic_anomaly(self, context: SecurityContext) -> bool:
        """Check for geographic anomalies"""
        # This is a simplified check - could be enhanced with user history
        # For now, just check if country is set
        return context.country is not None

    def _is_fingerprint_reuse(self, fingerprint: str) -> bool:
        """Check if fingerprint is being reused across multiple users"""
        try:
            from ...models.security import SecurityEvent

            time_window = datetime.utcnow() - timedelta(hours=24)
            unique_keys = (
                db.session.query(SecurityEvent.user_key)
                .filter(
                    SecurityEvent.fingerprint == fingerprint,
                    SecurityEvent.created_at >= time_window,
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

        if score >= 80:
            recommendations.append("Immediate blocking recommended")
            recommendations.append("Investigate source IP and fingerprint")
        elif score >= 60:
            recommendations.append("Enhanced monitoring recommended")
            recommendations.append("Consider temporary blocking")
        elif score >= 40:
            recommendations.append("Monitor closely")
        else:
            recommendations.append("Increase monitoring for this fingerprint")

        return recommendations

