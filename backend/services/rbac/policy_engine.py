"""
Policy Engine for Unified RBAC+ABAC Authorization
Replaces the complex check_permission method with a clean, extensible policy engine.

This engine provides a unified interface for authorization decisions, returning
structured Decision objects instead of simple True/False, making it easier to
audit and debug authorization issues.

Architecture:
- Policy Engine evaluates multiple authorization strategies in order
- Returns Decision objects with reason and context
- Supports RBAC, ABAC, and resource-level permissions
- Extensible for future authorization models

SECURITY: Conflict Resolution
-----------------------------
All policies are evaluated before applying conflict resolution rules.
This ensures that DENY always takes precedence over ALLOW, preventing
privilege escalation when:
- RBAC grants access through a role, but ABAC denies it
- Resource-level permissions allow access, but ABAC denies it
- Product-specific permissions allow access, but ABAC denies it

Conflict Resolution Priority:
1. DENY (highest priority) - Any policy that denies access
2. ALLOW - Any policy that allows access (only if no DENY)
3. ABSTAIN - Policy doesn't apply (default deny if all abstain)

This prevents logical security holes where multiple policies conflict.

Usage:
    from backend.services.rbac.policy_engine import PolicyEngine
    
    engine = PolicyEngine()
    decision = engine.evaluate(
        user_id=user.id,
        permission="keys.create",
        resource_type="key",
        resource_id=key_id,
        context={"ip": "1.2.3.4"}
    )
    
    if decision.allowed:
        # Proceed with action
        pass
    else:
        return jsonify({"error": decision.reason}), 403
"""

import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from flask import g, has_request_context

from ...core.extensions import db
from ...utils.service_exceptions import ServiceError
from ...models.core import User
from ...models.rbac import Permission, RolePermission, UserRole
from ...utils.rbac_utils import RBACManager
from .authorization_audit import DecisionOutcome

logger = logging.getLogger(__name__)

def _get_policy_cache_key(
    user_id: int,
    permission: str,
    product_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
) -> str:
    """Generate cache key for policy evaluation result"""
    parts = [f"user:{user_id}", f"perm:{permission}"]
    if product_id:
        parts.append(f"product:{product_id}")
    if resource_type:
        parts.append(f"resource_type:{resource_type}")
    if resource_id:
        parts.append(f"resource_id:{resource_id}")
    return "|".join(parts)

class DecisionType(Enum):
    """Type of authorization decision"""
    ALLOW = "allow"
    DENY = "deny"
    ABSTAIN = "abstain"

@dataclass
class Decision:
    """
    Authorization decision result.
    
    Attributes:
        allowed: Whether the action is allowed
        reason: Human-readable reason for the decision
        policy_type: Type of policy that made the decision (rbac, abac, resource, etc.)
        context: Additional context about the decision
    """
    allowed: bool
    reason: str
    policy_type: str
    context: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.context is None:
            self.context = {}

class PolicyEngine:
    """
    Unified Policy Engine for RBAC+ABAC authorization.
    
    Evaluates authorization requests through multiple policy layers:
    1. Owner/Admin bypass (fast path)
    2. RBAC permissions (role-based)
    3. Resource-level permissions
    4. ABAC rules (attribute-based)
    5. Product-specific permissions
    
    Each layer can ALLOW, DENY, or ABSTAIN (pass to next layer).
    
    SECURITY: All policies are evaluated before conflict resolution.
    Conflict resolution priority: DENY > ALLOW > ABSTAIN (default deny).
    This ensures that ABAC DENY can override RBAC ALLOW, preventing
    privilege escalation through conflicting policies.
    """
    
    def __init__(self, authorization_audit_service=None, rbac_service=None, abac_service=None):
        """Initialize PolicyEngine with dependencies
        
        Args:
            authorization_audit_service: Service for authorization audit
            rbac_service: Service for RBAC operations
            abac_service: Service for ABAC operations
        """
        self._authorization_audit_service = authorization_audit_service
        self._rbac_service = rbac_service
        self._abac_service = abac_service
        
        """
        Policy evaluation order:
        1. Owner/Admin bypass - fastest path for privileged users
        2. RBAC permissions - role-based checks
        3. Resource-level permissions - instance-specific checks
        4. ABAC rules - attribute-based checks (can DENY even if RBAC allows)
        5. Product-specific permissions - product-scoped checks
        
        SECURITY NOTE: All policies are evaluated before conflict resolution.
        DENY always takes precedence over ALLOW, regardless of evaluation order.
        This prevents privilege escalation when RBAC grants access but ABAC denies it.
        """
        self.policies: List[callable] = [
            self._check_owner_admin_bypass,
            self._check_rbac_permissions,
            self._check_resource_permissions,
            self._check_abac_rules,
            self._check_product_specific_permissions,
        ]
    
    def evaluate(
        self,
        user_id: int,
        permission: str,
        product_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """
        Evaluate authorization request through all policy layers.
        
        PERFORMANCE OPTIMIZATIONS:
        - Request-scoped caching: Results are cached per Flask request to avoid
          redundant policy evaluations for the same authorization check
        - Fast Fail: If owner/admin bypass grants access, we can return early
          (but still evaluate all policies for security audit)
        
        Args:
            user_id: User ID requesting access
            permission: Permission name (e.g., "keys.create")
            product_id: Optional product ID for product-specific permissions
            resource_type: Optional resource type (e.g., "key", "user")
            resource_id: Optional resource ID for instance-level permissions
            context: Optional context dictionary (e.g., {"ip": "1.2.3.4"})
            
        Returns:
            Decision object with allowed status and reason
        """
        if context is None:
            context = {}
        

        cache_key = _get_policy_cache_key(user_id, permission, product_id, resource_type, resource_id)
        if has_request_context():
            if not hasattr(g, '_policy_cache'):
                g._policy_cache = {}
            
            if cache_key in g._policy_cache:
                cached_decision = g._policy_cache[cache_key]
                logger.debug(
                    f"POLICY_EVALUATION_CACHE_HIT user_id={user_id} permission={permission} "
                    f"decision={'ALLOW' if cached_decision.allowed else 'DENY'}"
                )
                return cached_decision
        

        logger.info(
            f"POLICY_EVALUATION_START user_id={user_id} permission={permission} "
            f"product_id={product_id} resource_type={resource_type} resource_id={resource_id}"
        )
        

        user = User.query.get(user_id)
        if not user:
            logger.warning(f"POLICY_EVALUATION_FAILED user_id={user_id} reason=User not found")
            decision = Decision(
                allowed=False,
                reason="User not found",
                policy_type="system",
                context={"user_id": user_id}
            )

            if has_request_context():
                g._policy_cache[cache_key] = decision
            return decision
        

        evaluation_start_time = time.perf_counter()
        






        evaluated_policies = []
        all_decisions = []
        fast_fail_allowed = False
        
        for policy in self.policies:
            try:
                decision = policy(
                    user=user,
                    permission=permission,
                    product_id=product_id,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    context=context,
                )
                
                policy_info = {
                    "policy": policy.__name__,
                    "type": decision.policy_type,
                    "allowed": decision.allowed,
                    "reason": decision.reason
                }
                evaluated_policies.append(policy_info)
                

                if decision.policy_type != "abstain":
                    all_decisions.append(decision)
                    


                    if decision.allowed and decision.policy_type in ("owner_bypass", "admin_bypass"):
                        fast_fail_allowed = True
                        logger.debug(
                            f"POLICY_FAST_FAIL_ALLOW user_id={user_id} permission={permission} "
                            f"policy={policy.__name__}"
                        )
                    
            except Exception as e:
                logger.error(
                    f"POLICY_EVALUATION_ERROR user_id={user_id} permission={permission} "
                    f"policy={policy.__name__} error={str(e)}",
                    exc_info=True
                )
                evaluated_policies.append({
                    "policy": policy.__name__,
                    "type": "error",
                    "allowed": False,
                    "reason": f"Error: {str(e)}"
                })

        


        execution_time_ms = (time.perf_counter() - evaluation_start_time) * 1000
        
        if all_decisions:

            deny_decisions = [d for d in all_decisions if not d.allowed]
            if deny_decisions:

                final_decision = deny_decisions[0]
                outcome = DecisionOutcome.DENY
                

                allow_decisions = [d for d in all_decisions if d.allowed]
                if allow_decisions:
                    logger.warning(
                        f"POLICY_CONFLICT_RESOLVED user_id={user_id} permission={permission} "
                        f"deny_policy={final_decision.policy_type} allow_policies={[d.policy_type for d in allow_decisions]} "
                        f"reason=DENY takes precedence over ALLOW"
                    )
                    final_decision.context["conflict_resolved"] = True
                    final_decision.context["conflicting_allow_policies"] = [d.policy_type for d in allow_decisions]
            else:


                if fast_fail_allowed:

                    bypass_decision = next(
                        (d for d in all_decisions if d.policy_type in ("owner_bypass", "admin_bypass")),
                        all_decisions[0]
                    )
                    final_decision = bypass_decision
                else:
                    final_decision = all_decisions[0]
                outcome = DecisionOutcome.ALLOW
        else:

            final_decision = Decision(
                allowed=False,
                reason="No policy granted permission",
                policy_type="default_deny",
                context={
                    "user_id": user_id,
                    "permission": permission,
                    "product_id": product_id,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                }
            )
            outcome = DecisionOutcome.DENY
        

        if not self._authorization_audit_service:
            raise ServiceError(
                "AuthorizationAuditService dependency not injected",
                status_code=500
            )
        self._authorization_audit_service.audit_authorization_decision(
            user_id=user_id,
            permission=permission,
            outcome=outcome,
            policy_type=final_decision.policy_type,
            reason=final_decision.reason,
            context={
                "product_id": product_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "project_id": user.project_id,
                **context,
                **final_decision.context,
            },
            evaluated_policies=evaluated_policies,
            execution_time_ms=execution_time_ms,
        )
        
        logger.info(
            f"POLICY_EVALUATION_RESULT user_id={user_id} permission={permission} "
            f"policy={final_decision.policy_type} decision={'ALLOW' if final_decision.allowed else 'DENY'} "
            f"allowed={final_decision.allowed} reason={final_decision.reason} "
            f"evaluated_policies={len(evaluated_policies)} total_decisions={len(all_decisions)} "
            f"execution_time={execution_time_ms:.2f}ms fast_fail={fast_fail_allowed}"
        )
        

        if has_request_context():
            g._policy_cache[cache_key] = final_decision
        
        return final_decision
        
    
    def _check_owner_admin_bypass(
        self,
        user: User,
        permission: str,
        product_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """
        Policy: Owner and Admin bypass all permission checks.
        
        This is the fastest path for privileged users.
        """
        if RBACManager.is_owner(user):
            return Decision(
                allowed=True,
                reason="User is owner",
                policy_type="owner_bypass",
                context={"user_id": user.id, "username": user.username}
            )
        
        if RBACManager.is_admin(user):
            return Decision(
                allowed=True,
                reason="User is admin",
                policy_type="admin_bypass",
                context={"user_id": user.id, "username": user.username}
            )
        
        return Decision(
            allowed=False,
            reason="Not owner or admin",
            policy_type="abstain",
            context={}
        )
    
    def _check_rbac_permissions(
        self,
        user: User,
        permission: str,
        product_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """
        Policy: Check RBAC permissions from user's roles.
        
        This checks if the user has the permission through their assigned roles.
        """
        if not user.project_id:
            return Decision(
                allowed=False,
                reason="User has no project_id",
                policy_type="abstain",
                context={}
            )
        

        if not self._rbac_service:
            raise ServiceError(
                "RBACService dependency not injected",
                status_code=500
            )
        user_permissions = self._rbac_service.get_user_permissions(user.id)
        
        if permission in user_permissions:
            return Decision(
                allowed=True,
                reason=f"User has permission '{permission}' through RBAC",
                policy_type="rbac",
                context={
                    "user_id": user.id,
                    "permission": permission,
                    "project_id": user.project_id,
                }
            )
        
        return Decision(
            allowed=False,
            reason="Permission not found in user roles",
            policy_type="abstain",
            context={"permission": permission}
        )
    
    def _check_resource_permissions(
        self,
        user: User,
        permission: str,
        product_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """
        Policy: Check resource-level permissions (global, resource-type, or instance-level).
        
        This checks for permissions scoped to specific resources or resource types.
        """
        if not resource_type or not user.project_id:
            return Decision(
                allowed=False,
                reason="No resource_type or project_id",
                policy_type="abstain",
                context={}
            )
        

        if "." in permission:
            resource, action = permission.split(".", 1)
        else:
            resource = permission
            action = "view"
        

        user_roles = UserRole.query.filter_by(user_id=user.id).all()
        role_ids = [ur.role_id for ur in user_roles]
        
        if not role_ids:
            return Decision(
                allowed=False,
                reason="User has no roles",
                policy_type="abstain",
                context={}
            )
        

        resource_permissions = (
            db.session.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(
                RolePermission.role_id.in_(role_ids),
                Permission.project_id == user.project_id,
                Permission.resource == resource,
                Permission.action == action,
            )
            .all()
        )
        
        for perm in resource_permissions:

            if perm.scope == "global":
                return Decision(
                    allowed=True,
                    reason=f"User has global permission for {resource}.{action}",
                    policy_type="resource_global",
                    context={
                        "user_id": user.id,
                        "permission": permission,
                        "resource_type": resource_type,
                        "scope": "global",
                    }
                )
            

            elif perm.scope == "resource" and perm.resource_type == resource_type:
                return Decision(
                    allowed=True,
                    reason=f"User has resource-type permission for {resource_type}.{action}",
                    policy_type="resource_type",
                    context={
                        "user_id": user.id,
                        "permission": permission,
                        "resource_type": resource_type,
                        "scope": "resource",
                    }
                )
            

            elif (
                perm.scope == "instance"
                and perm.resource_type == resource_type
                and perm.resource_id == resource_id
            ):
                return Decision(
                    allowed=True,
                    reason=f"User has instance permission for {resource_type}#{resource_id}.{action}",
                    policy_type="resource_instance",
                    context={
                        "user_id": user.id,
                        "permission": permission,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "scope": "instance",
                    }
                )
        
        return Decision(
            allowed=False,
            reason="No matching resource-level permission",
            policy_type="abstain",
            context={"resource_type": resource_type, "resource_id": resource_id}
        )
    
    def _check_abac_rules(
        self,
        user: User,
        permission: str,
        product_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """
        Policy: Check ABAC (Attribute-Based Access Control) rules.
        
        This checks dynamic rules based on user attributes, resource attributes, and context.
        """
        if not user.project_id:
            return Decision(
                allowed=False,
                reason="No project_id for ABAC check",
                policy_type="abstain",
                context={}
            )
        

        if not self._abac_service:
            raise ServiceError(
                "ABACService dependency not injected",
                status_code=500
            )
        abac_result = self._abac_service.check_abac_rules(
            user_id=user.id,
            permission=permission,
            resource_type=resource_type,
            resource_id=resource_id,
            context=context,
        )
        
        if abac_result is True:
            return Decision(
                allowed=True,
                reason="ABAC rule granted permission",
                policy_type="abac",
                context={
                    "user_id": user.id,
                    "permission": permission,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                }
            )
        elif abac_result is False:
            return Decision(
                allowed=False,
                reason="ABAC rule denied permission",
                policy_type="abac",
                context={
                    "user_id": user.id,
                    "permission": permission,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                }
            )
        

        return Decision(
            allowed=False,
            reason="No ABAC rule applies",
            policy_type="abstain",
            context={}
        )
    
    def _check_product_specific_permissions(
        self,
        user: User,
        permission: str,
        product_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Decision:
        """
        Policy: Check product-specific permissions.
        
        This checks for permissions scoped to specific products.
        """
        if not product_id or not user.project_id:
            return Decision(
                allowed=False,
                reason="No product_id or project_id",
                policy_type="abstain",
                context={}
            )
        

        if "." in permission:
            resource, action = permission.split(".", 1)
        else:
            resource = permission
            action = "view"
        

        user_roles = UserRole.query.filter_by(user_id=user.id).all()
        role_ids = [ur.role_id for ur in user_roles]
        
        if not role_ids:
            return Decision(
                allowed=False,
                reason="User has no roles",
                policy_type="abstain",
                context={}
            )
        

        product_permission = (
            db.session.query(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(
                RolePermission.role_id.in_(role_ids),
                Permission.resource == resource,
                Permission.action == action,
                Permission.product_id == product_id,
                Permission.project_id == user.project_id,
            )
            .first()
        )
        
        if product_permission:
            return Decision(
                allowed=True,
                reason=f"User has product-specific permission for product_id={product_id}",
                policy_type="product_specific",
                context={
                    "user_id": user.id,
                    "permission": permission,
                    "product_id": product_id,
                }
            )
        

        if not self._rbac_service:
            raise ServiceError(
                "RBACService dependency not injected",
                status_code=500
            )
        user_permissions = self._rbac_service.get_user_permissions(user.id)
        product_permission_pattern = f"{permission}.product.{product_id}"
        
        if product_permission_pattern in user_permissions:
            return Decision(
                allowed=True,
                reason=f"User has product permission pattern for product_id={product_id}",
                policy_type="product_pattern",
                context={
                    "user_id": user.id,
                    "permission": permission,
                    "product_id": product_id,
                }
            )
        
        return Decision(
            allowed=False,
            reason="No product-specific permission found",
            policy_type="abstain",
            context={"product_id": product_id}
        )


policy_engine = PolicyEngine()