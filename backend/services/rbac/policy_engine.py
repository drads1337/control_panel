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
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from ...core.extensions import db
from ...models.core import User
from ...models.rbac import Permission, RolePermission, UserRole
from ...utils.rbac_utils import RBACManager

logger = logging.getLogger(__name__)


class DecisionType(Enum):
    """Type of authorization decision"""
    ALLOW = "allow"
    DENY = "deny"
    ABSTAIN = "abstain"  # Policy doesn't apply, continue to next policy


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
    First DENY or final ABSTAIN results in denial.
    """
    
    def __init__(self):
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
        
        # Log authorization request for debugging
        logger.info(
            f"POLICY_EVALUATION_START user_id={user_id} permission={permission} "
            f"product_id={product_id} resource_type={resource_type} resource_id={resource_id}"
        )
        
        # Get user (required for all policies)
        user = User.query.get(user_id)
        if not user:
            logger.warning(f"POLICY_EVALUATION_FAILED user_id={user_id} reason=User not found")
            return Decision(
                allowed=False,
                reason="User not found",
                policy_type="system",
                context={"user_id": user_id}
            )
        
        # Evaluate through each policy layer
        evaluated_policies = []
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
                
                evaluated_policies.append({
                    "policy": policy.__name__,
                    "type": decision.policy_type,
                    "allowed": decision.allowed,
                    "reason": decision.reason
                })
                
                # If policy made a decision (not ABSTAIN), return it
                if decision.policy_type != "abstain":
                    logger.info(
                        f"POLICY_EVALUATION_RESULT user_id={user_id} permission={permission} "
                        f"policy={policy.__name__} decision={decision.policy_type} "
                        f"allowed={decision.allowed} reason={decision.reason} "
                        f"evaluated_policies={len(evaluated_policies)}"
                    )
                    return decision
                    
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
                # Continue to next policy on error
        
        # If all policies abstained, deny by default (fail-secure)
        logger.warning(
            f"POLICY_EVALUATION_DENIED user_id={user_id} permission={permission} "
            f"reason=No policy granted permission evaluated_policies={len(evaluated_policies)} "
            f"policies={[p['policy'] for p in evaluated_policies]}"
        )
        return Decision(
            allowed=False,
            reason="No policy granted permission",
            policy_type="default_deny",
            context={
                "user_id": user_id,
                "permission": permission,
                "product_id": product_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "evaluated_policies": evaluated_policies,
            }
        )
    
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
        
        # Get user permissions through RBAC
        from .rbac_service import rbac_service
        user_permissions = rbac_service.get_user_permissions(user.id)
        
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
        
        # Parse permission into resource and action
        if "." in permission:
            resource, action = permission.split(".", 1)
        else:
            resource = permission
            action = "view"
        
        # Get user roles
        user_roles = UserRole.query.filter_by(user_id=user.id).all()
        role_ids = [ur.role_id for ur in user_roles]
        
        if not role_ids:
            return Decision(
                allowed=False,
                reason="User has no roles",
                policy_type="abstain",
                context={}
            )
        
        # Check for resource-level permissions
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
            # Global scope: applies to all resources of this type
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
            
            # Resource-type scope: applies to all instances of this type
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
            
            # Instance scope: applies to specific resource instance
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
        
        # Delegate to ABAC service
        from .abac_service import ABACService
        abac_service = ABACService()
        
        abac_result = abac_service.check_abac_rules(
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
        
        # ABAC service returned None (no rule applies)
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
        
        # Parse permission
        if "." in permission:
            resource, action = permission.split(".", 1)
        else:
            resource = permission
            action = "view"
        
        # Get user roles
        user_roles = UserRole.query.filter_by(user_id=user.id).all()
        role_ids = [ur.role_id for ur in user_roles]
        
        if not role_ids:
            return Decision(
                allowed=False,
                reason="User has no roles",
                policy_type="abstain",
                context={}
            )
        
        # Check for product-specific permission
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
        
        # Check for product permission pattern: "permission.product.{product_id}"
        from .rbac_service import rbac_service
        user_permissions = rbac_service.get_user_permissions(user.id)
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


# Singleton instance
policy_engine = PolicyEngine()

