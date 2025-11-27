"""
Security Service
Facade service for security operations - delegates to specialized services

Single Responsibility: Provide unified interface for security operations
This service maintains backward compatibility while delegating to:
- SecurityRulesService: Security rules management
- SecurityMonitoringService: Monitoring and analytics
- SecurityAuditService: Blocking and audit operations
"""

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from ...utils.service_helpers import get_service
from .security_types import SecurityContext, ThreatAssessment

if TYPE_CHECKING:
    from ...models.security import BlockedFingerprint

class SecurityService:
    """
    Facade service for managing security operations.
    
    Single Responsibility: Provide unified interface and maintain backward compatibility.
    Delegates to specialized services following SRP principle.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def assess_threat(self, context: SecurityContext) -> ThreatAssessment:
        """
        Assess threat level based on multiple security factors.
        
        Delegates to SecurityMonitoringService (SRP principle).
        """
        security_monitoring_service = get_service('security_monitoring_service')
        return security_monitoring_service.assess_threat(context)
    def create_enhanced_block(
        self,
        context: SecurityContext,
        reason: str,
        block_type: str = "automatic",
        severity: str = "medium",
        threat_score: int = 0,
        expires_at: Optional[datetime] = None,
        blocked_by_user_id: Optional[int] = None,
    ) -> "BlockedFingerprint":
        """
        Create an enhanced fingerprint block with comprehensive data.
        
        Delegates to SecurityAuditService (SRP principle).
        """
        security_audit_service = get_service('security_audit_service')
        return security_audit_service.create_enhanced_block(
            context, reason, block_type, severity, threat_score, expires_at, blocked_by_user_id
        )

    def check_automated_rules(self, context: SecurityContext) -> List[Dict[str, Any]]:
        """
        Check and execute automated security rules.
        
        Delegates to SecurityRulesService (SRP principle).
        """
        security_rules_service = get_service('security_rules_service')
        return security_rules_service.check_automated_rules(context)
    def get_security_analytics(self, project_id: int, days: int = 30) -> Dict[str, Any]:
        """
        Get comprehensive security analytics.
        
        Delegates to SecurityMonitoringService (SRP principle).
        """
        security_monitoring_service = get_service('security_monitoring_service')
        return security_monitoring_service.get_security_analytics(project_id, days)
    def is_ip_blocked(self, ip_address: str, project_id: int) -> bool:
        """
        Check if an IP address is blocked due to failed login attempts or manual blocking.
        
        Delegates to SecurityAuditService (SRP principle).

        Args:
            ip_address: IP address to check
            project_id: Project ID

        Returns:
            True if IP is blocked, False otherwise
        """
        security_audit_service = get_service('security_audit_service')
        return security_audit_service.is_ip_blocked(ip_address, project_id)
    def check_session_limit(self, user_id: int, project_id: int) -> bool:
        """
        Check if user has exceeded session limit.
        
        Delegates to SecurityAuditService (SRP principle).

        Args:
            user_id: User ID
            project_id: Project ID

        Returns:
            True if session limit exceeded, False otherwise
        """
        security_audit_service = get_service('security_audit_service')
        return security_audit_service.check_session_limit(user_id, project_id)
    def record_login_attempt(
        self,
        ip_address: str,
        username: str,
        success: bool,
        project_id: int,
        user_agent: Optional[str] = None,
    ) -> None:
        """
        Record login attempt for security monitoring.
        
        Delegates to SecurityMonitoringService (SRP principle).

        Args:
            ip_address: Client IP address
            username: Username attempting login
            success: Whether login was successful
            project_id: Project ID
            user_agent: Client user agent string
        """
        security_monitoring_service = get_service('security_monitoring_service')
        return security_monitoring_service.record_login_attempt(
            ip_address, username, success, project_id, user_agent
        )