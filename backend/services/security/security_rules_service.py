"""
Security Rules Service
Handles security rules evaluation and execution

Single Responsibility: Security rules management and evaluation
Extracted from SecurityService to follow SRP (Single Responsibility Principle)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from ...core.extensions import db
from ...models.security import SecurityRule
from ...utils.service_helpers import get_service
from .security_types import SecurityContext


class SecurityRulesService:
    """
    Service for handling security rules operations.
    
    Single Responsibility: Evaluate and execute security rules.
    """

    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger(__name__)

    def check_automated_rules(self, context: SecurityContext) -> List[Dict[str, Any]]:
        """
        Check and execute automated security rules
        
        Args:
            context: Security context with fingerprint, IP, user_agent, etc.
            
        Returns:
            List of triggered rules with action results
        """
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
                    # Get services via DI to avoid circular dependency
                    security_audit_service = get_service('security_audit_service')
                    security_monitoring_service = get_service('security_monitoring_service')
                    
                    action_result = self._execute_rule_action(rule, context, security_audit_service, security_monitoring_service)
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

    def _evaluate_rule(self, rule: SecurityRule, context: SecurityContext) -> bool:
        """
        Evaluate if a security rule should be triggered
        
        Args:
            rule: Security rule to evaluate
            context: Security context
            
        Returns:
            True if rule should be triggered, False otherwise
        """
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
            elif rule.rule_type == "threat_score":
                return self._evaluate_threat_score_conditions(conditions, context)
            elif rule.rule_type == "vpn_detection":
                return self._evaluate_vpn_conditions(conditions, context)
            elif rule.rule_type == "failed_login":
                return self._evaluate_failed_login_conditions(conditions, context)
            elif rule.rule_type == "hwid_block":
                return self._evaluate_hwid_block_conditions(conditions, context)
            elif rule.rule_type == "brute_force":
                return self._evaluate_brute_force_conditions(conditions, context)

            return False

        except Exception as e:
            self.logger.error(f"Error evaluating rule {rule.id}: {e}")
            return False

    def _execute_rule_action(
        self, 
        rule: SecurityRule, 
        context: SecurityContext,
        security_audit_service,
        security_monitoring_service
    ) -> Dict[str, Any]:
        """
        Execute the action defined in a security rule
        
        Args:
            rule: Security rule
            context: Security context
            security_audit_service: Service for audit operations (blocking)
            security_monitoring_service: Service for monitoring operations (logging)
            
        Returns:
            Dictionary with action result
        """
        try:
            action_params = json.loads(rule.action_params or "{}")

            if rule.action_type == "block":
                block = security_audit_service.create_enhanced_block(
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
                security_monitoring_service.log_security_event(
                    event_type="security_warning",
                    context=context,
                    description=f"Security warning from rule: {rule.name}",
                    severity="medium",
                    related_rule_id=rule.id,
                )
                return {"action": "warned"}

            elif rule.action_type == "log":
                log_severity = action_params.get("log_severity", "low")
                security_monitoring_service.log_security_event(
                    event_type="rule_triggered",
                    context=context,
                    description=f"Rule triggered: {rule.name}",
                    severity=log_severity,
                    related_rule_id=rule.id,
                )
                return {"action": "logged"}

            elif rule.action_type == "monitor":
                log_severity = action_params.get("log_severity", "medium")
                security_monitoring_service.log_security_event(
                    event_type="rule_monitored",
                    context=context,
                    description=f"Rule monitoring: {rule.name}",
                    severity=log_severity,
                    related_rule_id=rule.id,
                )
                return {"action": "monitored"}

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
                # Get service via DI to avoid circular dependency
                security_monitoring_service = get_service('security_monitoring_service')
                threat_assessment = security_monitoring_service.assess_threat(context)
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

            if new_count > max_requests:
                # Update trigger count for "Rate Limiting Protection" rule
                self._update_rule_trigger("Rate Limiting Protection", context.project_id)
                return True

            return False

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
                if blocked_countries and context.country and context.country.upper() in [
                    c.upper() for c in blocked_countries
                ]:
                    # Update trigger count for "Geo-blocking" rule
                    self._update_rule_trigger("Geo-blocking", context.project_id)
                    return True

            if "allowed_countries" in conditions:
                allowed_countries = conditions["allowed_countries"]
                if allowed_countries and context.country and context.country.upper() not in [
                    c.upper() for c in allowed_countries
                ]:
                    # Update trigger count for "Geo-blocking" rule
                    self._update_rule_trigger("Geo-blocking", context.project_id)
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
                from ...models.security import SecurityEvent

                start_time = datetime.utcnow() - timedelta(hours=1)
                connection_count = SecurityEvent.query.filter(
                    SecurityEvent.fingerprint == context.fingerprint,
                    SecurityEvent.project_id == context.project_id,
                    SecurityEvent.created_at >= start_time,
                    SecurityEvent.event_type == "connection_attempt",
                ).count()

                if connection_count >= 10:
                    # Update trigger count for "Suspicious Activity Monitor" rule
                    self._update_rule_trigger("Suspicious Activity Monitor", context.project_id)
                    return True

            return False

        except Exception as e:
            self.logger.error(f"Error evaluating behavioral conditions: {e}")
            return False

    def _evaluate_threat_score_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate threat score conditions for auto-blocking suspicious IPs"""
        try:
            min_threat_score = conditions.get("min_threat_score", 70)
            # Get services via DI to avoid circular dependency
            security_monitoring_service = get_service('security_monitoring_service')
            threat_assessment = security_monitoring_service.assess_threat(context)
            
            if threat_assessment.score >= min_threat_score:
                # Auto-block IP if threat score is high
                from ...models.security import BlockedIP
                security_audit_service = get_service('security_audit_service')
                
                existing_block = BlockedIP.query.filter_by(
                    ip_address=context.ip_address,
                    project_id=context.project_id,
                    is_active=True
                ).first()
                
                if not existing_block:
                    expires_at = datetime.utcnow() + timedelta(hours=24)
                    blocked_ip = BlockedIP(
                        ip_address=context.ip_address,
                        project_id=context.project_id,
                        reason=f"Auto-blocked: High threat score ({threat_assessment.score})",
                        block_type="automatic",
                        category="threat_score",
                        severity="high",
                        threat_score=threat_assessment.score,
                        country=context.country,
                        city=context.city,
                        is_active=True,
                        expires_at=expires_at,
                    )
                    db.session.add(blocked_ip)
                    
                    # Update trigger count for "Auto-block Suspicious IPs" rule
                    self._update_rule_trigger("Auto-block Suspicious IPs", context.project_id)
                    
                    db.session.commit()
                    self.logger.warning(
                        f"Auto-blocked IP {context.ip_address} with threat score {threat_assessment.score}"
                    )
                
                return True
            
            return False
        except Exception as e:
            self.logger.error(f"Error evaluating threat score conditions: {e}")
            return False

    def _evaluate_vpn_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate VPN detection conditions"""
        try:
            from ...utils.vpn_detection import vpn_detector
            security_monitoring_service = get_service('security_monitoring_service')
            security_audit_service = get_service('security_audit_service')
            
            check_vpn = conditions.get("check_vpn", True)
            if not check_vpn:
                return False
            
            vpn_result = vpn_detector.detect_vpn(context.ip_address)
            is_vpn = vpn_result.get("is_vpn", False) or vpn_result.get("is_proxy", False)
            
            if is_vpn:
                # Log VPN detection
                security_monitoring_service.log_security_event(
                    event_type="vpn_detected",
                    context=context,
                    description=f"VPN/Proxy detected: {vpn_result.get('provider', 'Unknown')}",
                    severity="medium",
                    threat_score=30,
                )
                
                # Update trigger count for "VPN Detection" rule
                self._update_rule_trigger("VPN Detection", context.project_id)
                
                # Block if configured
                block_vpn = conditions.get("block_vpn", False)
                if block_vpn:
                    from ...models.security import BlockedIP
                    
                    existing_block = BlockedIP.query.filter_by(
                        ip_address=context.ip_address,
                        project_id=context.project_id,
                        is_active=True
                    ).first()
                    
                    if not existing_block:
                        blocked_ip = BlockedIP(
                            ip_address=context.ip_address,
                            project_id=context.project_id,
                            reason=f"VPN/Proxy detected: {vpn_result.get('provider', 'Unknown')}",
                            block_type="automatic",
                            category="vpn",
                            severity="medium",
                            threat_score=30,
                            country=context.country,
                            city=context.city,
                            is_active=True,
                        )
                        db.session.add(blocked_ip)
                        db.session.commit()
                        return True
            
            return False
        except Exception as e:
            self.logger.error(f"Error evaluating VPN conditions: {e}")
            return False

    def _evaluate_failed_login_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate failed login conditions (handled separately in record_login_attempt)"""
        # This is handled in record_login_attempt method
        return False

    def _evaluate_hwid_block_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate HWID blacklist conditions"""
        try:
            from ...models.security import BlockedDeviceFingerprint
            
            if not context.fingerprint:
                return False
            
            # Check if fingerprint is in blacklist
            blocked_hwid = BlockedDeviceFingerprint.query.filter_by(
                hwid=context.fingerprint,
                project_id=context.project_id,
                is_active=True
            ).first()
            
            if blocked_hwid:
                # Check if expired
                if blocked_hwid.expires_at and blocked_hwid.expires_at < datetime.utcnow():
                    blocked_hwid.is_active = False
                    db.session.commit()
                    return False
                
                # Update trigger count for "HWID Blacklist" rule (only once per check to avoid spam)
                # Use a flag to track if we've already updated for this check
                if not hasattr(context, '_hwid_trigger_updated'):
                    self._update_rule_trigger("HWID Blacklist", context.project_id)
                    context._hwid_trigger_updated = True
                return True
            
            return False
        except Exception as e:
            self.logger.error(f"Error evaluating HWID block conditions: {e}")
            return False

    def _evaluate_brute_force_conditions(self, conditions: Dict, context: SecurityContext) -> bool:
        """Evaluate brute force protection conditions"""
        try:
            from ...models.security import BlockedIP, LoginAttempt
            
            max_attempts = conditions.get("max_attempts", 10)
            time_window_minutes = conditions.get("time_window_minutes", 5)
            cutoff_time = datetime.utcnow() - timedelta(minutes=time_window_minutes)
            
            # Count failed attempts in time window
            failed_attempts = LoginAttempt.query.filter(
                LoginAttempt.ip_address == context.ip_address,
                LoginAttempt.project_id == context.project_id,
                LoginAttempt.success == False,
                LoginAttempt.created_at > cutoff_time,
            ).count()
            
            if failed_attempts >= max_attempts:
                # Temporary block
                existing_block = BlockedIP.query.filter_by(
                    ip_address=context.ip_address,
                    project_id=context.project_id,
                    is_active=True
                ).first()
                
                if not existing_block:
                    block_duration_minutes = conditions.get("block_duration_minutes", 30)
                    expires_at = datetime.utcnow() + timedelta(minutes=block_duration_minutes)
                    
                    blocked_ip = BlockedIP(
                        ip_address=context.ip_address,
                        project_id=context.project_id,
                        reason=f"Brute force protection: {failed_attempts} failed attempts in {time_window_minutes} minutes",
                        block_type="automatic",
                        category="brute_force",
                        severity="high",
                        threat_score=60,
                        country=context.country,
                        city=context.city,
                        is_active=True,
                        expires_at=expires_at,
                    )
                    db.session.add(blocked_ip)
                    
                    # Update trigger count for "Brute Force Protection" rule
                    self._update_rule_trigger("Brute Force Protection", context.project_id)
                    
                    db.session.commit()
                    self.logger.warning(
                        f"Brute force protection triggered for IP {context.ip_address}: {failed_attempts} attempts"
                    )
                    return True
            
            return False
        except Exception as e:
            self.logger.error(f"Error evaluating brute force conditions: {e}")
            return False

    def _update_rule_trigger(self, rule_name: str, project_id: int) -> None:
        """
        Update trigger count and last_triggered for a security rule by name
        
        Args:
            rule_name: Name of the security rule
            project_id: Project ID
        """
        try:
            if not project_id:
                self.logger.debug(f"Skipping rule trigger update for {rule_name}: no project_id")
                return
                
            rule = SecurityRule.query.filter_by(
                name=rule_name,
                project_id=project_id
            ).first()
            
            if rule:
                old_count = rule.trigger_count or 0
                rule.trigger_count = old_count + 1
                rule.last_triggered = datetime.utcnow()
                db.session.commit()
                self.logger.info(
                    f"Updated trigger for rule '{rule_name}' in project {project_id}: "
                    f"count {old_count} -> {rule.trigger_count}"
                )
            else:
                self.logger.warning(
                    f"Rule '{rule_name}' not found for project {project_id}. "
                    f"Rules may need to be initialized."
                )
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating rule trigger for {rule_name} in project {project_id}: {e}")


# Singleton instance
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   security_rules_service = get_service('security_rules_service')

