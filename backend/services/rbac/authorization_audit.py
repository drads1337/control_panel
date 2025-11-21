"""
Authorization Audit and Validation Service
Provides comprehensive auditing and validation for RBAC/ABAC authorization decisions.

SECURITY: This service helps detect logical errors in complex authorization systems
by providing:
- Detailed audit trails of all authorization decisions
- Validation of authorization logic consistency
- Detection of potential privilege escalation paths
- Comprehensive logging for security analysis
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set
from enum import Enum

logger = logging.getLogger(__name__)


class DecisionOutcome(Enum):
    """Authorization decision outcome"""
    ALLOW = "allow"
    DENY = "deny"
    ERROR = "error"


@dataclass
class AuthorizationAuditEntry:
    """
    Single authorization decision audit entry.
    
    Attributes:
        timestamp: When the decision was made
        user_id: User requesting access
        permission: Permission being checked
        outcome: Whether access was allowed or denied
        policy_type: Which policy made the decision (rbac, abac, resource, etc.)
        reason: Human-readable reason for the decision
        context: Additional context (project_id, resource_id, etc.)
        evaluated_policies: List of all policies that were evaluated
        execution_time_ms: How long the evaluation took
        potential_issues: List of potential security issues detected
    """
    timestamp: float
    user_id: int
    permission: str
    outcome: DecisionOutcome
    policy_type: str
    reason: str
    context: Dict[str, Any] = field(default_factory=dict)
    evaluated_policies: List[Dict[str, Any]] = field(default_factory=list)
    execution_time_ms: float = 0.0
    potential_issues: List[str] = field(default_factory=list)


class AuthorizationAuditService:
    """
    Service for auditing and validating authorization decisions.
    
    This service helps detect:
    - Logical errors in authorization logic
    - Potential privilege escalation paths
    - Inconsistent authorization decisions
    - Performance issues in authorization checks
    """
    
    def __init__(self):
        self.audit_enabled = True
        self.max_audit_entries = 10000  # Keep last 10k entries in memory
        self.audit_trail: List[AuthorizationAuditEntry] = []
        self.suspicious_patterns: Set[str] = set()
        
    def audit_authorization_decision(
        self,
        user_id: int,
        permission: str,
        outcome: DecisionOutcome,
        policy_type: str,
        reason: str,
        context: Optional[Dict[str, Any]] = None,
        evaluated_policies: Optional[List[Dict[str, Any]]] = None,
        execution_time_ms: float = 0.0,
    ) -> AuthorizationAuditEntry:
        """
        Record an authorization decision for audit purposes.
        
        Args:
            user_id: User requesting access
            permission: Permission being checked
            outcome: Whether access was allowed or denied
            policy_type: Which policy made the decision
            reason: Human-readable reason
            context: Additional context
            evaluated_policies: All policies that were evaluated
            execution_time_ms: Execution time in milliseconds
            
        Returns:
            Audit entry that was created
        """
        if not self.audit_enabled:
            return None
            
        if context is None:
            context = {}
        if evaluated_policies is None:
            evaluated_policies = []
            
        # Detect potential security issues
        potential_issues = self._detect_potential_issues(
            user_id, permission, outcome, policy_type, context, evaluated_policies
        )
        
        entry = AuthorizationAuditEntry(
            timestamp=time.time(),
            user_id=user_id,
            permission=permission,
            outcome=outcome,
            policy_type=policy_type,
            reason=reason,
            context=context,
            evaluated_policies=evaluated_policies,
            execution_time_ms=execution_time_ms,
            potential_issues=potential_issues,
        )
        
        # Add to audit trail (with size limit)
        self.audit_trail.append(entry)
        if len(self.audit_trail) > self.max_audit_entries:
            self.audit_trail.pop(0)
        
        # Log suspicious patterns
        if potential_issues:
            logger.warning(
                f"[AUTH_AUDIT] Potential security issues detected for user_id={user_id} "
                f"permission={permission}: {', '.join(potential_issues)}"
            )
            
        # Log all authorization decisions for security analysis
        logger.info(
            f"[AUTH_AUDIT] user_id={user_id} permission={permission} outcome={outcome.value} "
            f"policy={policy_type} reason={reason} execution_time={execution_time_ms:.2f}ms "
            f"issues={len(potential_issues)}"
        )
        
        return entry
    
    def _detect_potential_issues(
        self,
        user_id: int,
        permission: str,
        outcome: DecisionOutcome,
        policy_type: str,
        context: Dict[str, Any],
        evaluated_policies: List[Dict[str, Any]],
    ) -> List[str]:
        """
        Detect potential security issues in authorization decisions.
        
        Returns:
            List of potential issue descriptions
        """
        issues = []
        
        # Check for privilege escalation patterns
        if outcome == DecisionOutcome.ALLOW:
            # Check if user was granted access through multiple conflicting policies
            policy_types = [p.get("type") for p in evaluated_policies]
            if len(set(policy_types)) > 3:
                issues.append("Multiple policy types evaluated (potential complexity)")
            
            # Check for admin/owner bypass on sensitive operations
            if policy_type in ("owner_bypass", "admin_bypass"):
                sensitive_permissions = [
                    "system.manage_all_projects",
                    "users.delete",
                    "keys.delete_all",
                    "projects.delete",
                ]
                if permission in sensitive_permissions:
                    issues.append(f"Sensitive permission granted via {policy_type}")
            
            # Check for ABAC rules that might be too permissive
            if policy_type == "abac":
                issues.append("Access granted via ABAC (verify rule logic)")
        
        # Check for inconsistent decisions
        if len(evaluated_policies) > 5:
            issues.append("Many policies evaluated (potential performance issue)")
        
        # Check for missing context
        if outcome == DecisionOutcome.ALLOW and not context.get("project_id"):
            if permission.startswith(("keys.", "users.", "products.")):
                issues.append("Access granted without project_id context")
        
        # Check for resource-level permissions without resource_id
        if "resource" in policy_type.lower() and not context.get("resource_id"):
            issues.append("Resource-level permission without resource_id")
        
        return issues
    
    def validate_authorization_consistency(
        self,
        user_id: int,
        permission: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate consistency of authorization decisions for a user/permission combination.
        
        This helps detect logical errors where the same user/permission combination
        might be granted or denied inconsistently.
        
        Args:
            user_id: User ID
            permission: Permission name
            context: Context for the request
            
        Returns:
            Dictionary with validation results
        """
        if not self.audit_enabled:
            return {"status": "disabled"}
        
        # Find recent decisions for this user/permission
        recent_decisions = [
            entry for entry in self.audit_trail[-1000:]
            if entry.user_id == user_id and entry.permission == permission
        ]
        
        if not recent_decisions:
            return {
                "status": "ok",
                "message": "No recent decisions found",
                "decisions_count": 0,
            }
        
        # Check for inconsistencies
        outcomes = [d.outcome for d in recent_decisions]
        unique_outcomes = set(outcomes)
        
        if len(unique_outcomes) > 1:
            # Inconsistent outcomes detected
            outcome_counts = {}
            for outcome in outcomes:
                outcome_counts[outcome.value] = outcome_counts.get(outcome.value, 0) + 1
            
            logger.warning(
                f"[AUTH_AUDIT] Inconsistent authorization decisions detected: "
                f"user_id={user_id} permission={permission} outcomes={outcome_counts}"
            )
            
            return {
                "status": "inconsistent",
                "message": "Inconsistent authorization decisions detected",
                "decisions_count": len(recent_decisions),
                "outcome_counts": outcome_counts,
                "recent_decisions": [
                    {
                        "timestamp": d.timestamp,
                        "outcome": d.outcome.value,
                        "policy_type": d.policy_type,
                        "reason": d.reason,
                    }
                    for d in recent_decisions[-10:]  # Last 10 decisions
                ],
            }
        
        return {
            "status": "consistent",
            "message": "Authorization decisions are consistent",
            "decisions_count": len(recent_decisions),
            "outcome": outcomes[0].value if outcomes else None,
        }
    
    def get_authorization_statistics(
        self,
        user_id: Optional[int] = None,
        permission: Optional[str] = None,
        time_window_seconds: int = 3600,
    ) -> Dict[str, Any]:
        """
        Get authorization statistics for analysis.
        
        Args:
            user_id: Optional user ID to filter by
            permission: Optional permission to filter by
            time_window_seconds: Time window in seconds (default: 1 hour)
            
        Returns:
            Dictionary with statistics
        """
        if not self.audit_enabled:
            return {"status": "disabled"}
        
        cutoff_time = time.time() - time_window_seconds
        
        filtered_entries = [
            entry for entry in self.audit_trail
            if entry.timestamp >= cutoff_time
            and (user_id is None or entry.user_id == user_id)
            and (permission is None or entry.permission == permission)
        ]
        
        if not filtered_entries:
            return {
                "status": "ok",
                "message": "No entries found in time window",
                "entries_count": 0,
            }
        
        # Calculate statistics
        outcomes = [e.outcome for e in filtered_entries]
        allow_count = sum(1 for o in outcomes if o == DecisionOutcome.ALLOW)
        deny_count = sum(1 for o in outcomes if o == DecisionOutcome.DENY)
        error_count = sum(1 for o in outcomes if o == DecisionOutcome.ERROR)
        
        policy_types = [e.policy_type for e in filtered_entries]
        policy_type_counts = {}
        for pt in policy_types:
            policy_type_counts[pt] = policy_type_counts.get(pt, 0) + 1
        
        avg_execution_time = sum(e.execution_time_ms for e in filtered_entries) / len(filtered_entries)
        max_execution_time = max(e.execution_time_ms for e in filtered_entries)
        
        issues_count = sum(len(e.potential_issues) for e in filtered_entries)
        
        return {
            "status": "ok",
            "entries_count": len(filtered_entries),
            "time_window_seconds": time_window_seconds,
            "outcomes": {
                "allow": allow_count,
                "deny": deny_count,
                "error": error_count,
            },
            "policy_types": policy_type_counts,
            "performance": {
                "avg_execution_time_ms": round(avg_execution_time, 2),
                "max_execution_time_ms": round(max_execution_time, 2),
            },
            "security": {
                "total_issues_detected": issues_count,
                "entries_with_issues": sum(1 for e in filtered_entries if e.potential_issues),
            },
        }
    
    def detect_privilege_escalation_patterns(self) -> List[Dict[str, Any]]:
        """
        Detect potential privilege escalation patterns in authorization decisions.
        
        Returns:
            List of suspicious patterns detected
        """
        if not self.audit_enabled:
            return []
        
        suspicious = []
        
        # Group by user and permission
        user_permission_map = {}
        for entry in self.audit_trail[-5000:]:  # Check last 5000 entries
            key = (entry.user_id, entry.permission)
            if key not in user_permission_map:
                user_permission_map[key] = []
            user_permission_map[key].append(entry)
        
        # Check for users who were denied then allowed (potential escalation)
        for (user_id, permission), entries in user_permission_map.items():
            if len(entries) < 2:
                continue
            
            # Sort by timestamp
            entries_sorted = sorted(entries, key=lambda e: e.timestamp)
            
            # Check for deny -> allow pattern on sensitive permissions
            sensitive_permissions = [
                "system.manage_all_projects",
                "users.delete",
                "keys.delete_all",
                "projects.delete",
            ]
            
            if permission in sensitive_permissions:
                for i in range(len(entries_sorted) - 1):
                    if (entries_sorted[i].outcome == DecisionOutcome.DENY and
                        entries_sorted[i + 1].outcome == DecisionOutcome.ALLOW):
                        suspicious.append({
                            "type": "privilege_escalation",
                            "user_id": user_id,
                            "permission": permission,
                            "denied_at": entries_sorted[i].timestamp,
                            "allowed_at": entries_sorted[i + 1].timestamp,
                            "time_diff_seconds": entries_sorted[i + 1].timestamp - entries_sorted[i].timestamp,
                        })
        
        return suspicious


# Global instance
authorization_audit_service = AuthorizationAuditService()

