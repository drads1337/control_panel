"""
Tier Limits Service
Handles tier-based limits and restrictions for different subscription tiers

FREE TIER LIMITS:
- max_products: 3
- max_agents: 1
- max_users: 50
- max_keys_per_product: 50
- max_employees: 3
- max_storage_mb: 500
- webhooks_enabled: False
- logs_enabled: False
- security_enabled: False
- remote_control_enabled: False

PRO TIER LIMITS:
- All limits: Unlimited (None)
- All features: Enabled (True), except security (minimal)
- Storage: Uses project.storage_limit (default 3 GB)

See TIER_FEATURES.md for detailed documentation.
"""

from typing import Optional, Tuple
from sqlalchemy import func

from ...core.extensions import db
from ...models.core import Project, User
from ...models.products import Product
from ...models.agents import Agent
from ...models.keys import Key
from ...models.rbac import UserRole, Role
from ...utils.service_exceptions import ValidationError, BusinessLogicError
from ...utils.structured_logging import get_logger

class TierLimitsService:
    """Service for checking tier-based limits"""


    FREE_TIER_LIMITS = {
        "max_products": 3,
        "max_agents": 1,
        "max_users": 50,
        "max_keys_per_product": 50,
        "max_employees": 3,
        "max_storage_mb": 500,
        "webhooks_enabled": False,
        "logs_enabled": False,
        "security_enabled": False,
        "remote_control_enabled": False,
    }


    PRO_TIER_LIMITS = {
        "max_products": None,
        "max_agents": None,
        "max_users": None,
        "max_keys_per_product": None,
        "max_employees": None,
        "max_storage_mb": None,
        "webhooks_enabled": True,
        "logs_enabled": True,
        "security_enabled": "minimal",  # Minimal security features only
        "remote_control_enabled": True,
    }

    def __init__(self):
        self.logger = get_logger("tier_limits_service")

    def is_free_tier(self, project: Project) -> bool:
        """Check if project is on free tier"""
        return project.subscription_status == "free"

    def is_pro_tier(self, project: Project) -> bool:
        """Check if project is on pro tier"""
        return project.subscription_status == "pro"

    def check_product_limit(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if project can create more products
        
        Returns:
            Tuple of (can_create: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        current_count = Product.query.filter_by(project_id=project.id).count()
        max_products = self.FREE_TIER_LIMITS["max_products"]
        
        if current_count >= max_products:
            return False, f"Free tier limit reached: maximum {max_products} products allowed"
        
        return True, None

    def check_agent_limit(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if project can create more agents
        
        Returns:
            Tuple of (can_create: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        current_count = Agent.query.filter_by(project_id=project.id).count()
        max_agents = self.FREE_TIER_LIMITS["max_agents"]
        
        if current_count >= max_agents:
            return False, f"Free tier limit reached: maximum {max_agents} agent allowed"
        
        return True, None

    def check_user_limit(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if project can create more users
        
        Returns:
            Tuple of (can_create: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        current_count = User.query.filter_by(project_id=project.id).count()
        max_users = self.FREE_TIER_LIMITS["max_users"]
        
        if current_count >= max_users:
            return False, f"Free tier limit reached: maximum {max_users} users allowed"
        
        return True, None

    def check_key_limit_per_product(self, project: Project, product_id: int) -> Tuple[bool, Optional[str]]:
        """
        Check if more keys can be created for a product
        
        Returns:
            Tuple of (can_create: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        current_count = Key.query.filter_by(
            project_id=project.id,
            product_id=product_id
        ).count()
        max_keys = self.FREE_TIER_LIMITS["max_keys_per_product"]
        
        if current_count >= max_keys:
            return False, f"Free tier limit reached: maximum {max_keys} keys per product allowed"
        
        return True, None

    def check_employee_limit(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if project can create more employees
        
        Returns:
            Tuple of (can_create: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        

        employee_role = Role.query.filter_by(
            project_id=project.id,
            name="employee"
        ).first()
        
        if not employee_role:

            return True, None
        
        current_count = db.session.query(func.count(UserRole.user_id)).filter_by(
            role_id=employee_role.id
        ).scalar() or 0
        
        max_employees = self.FREE_TIER_LIMITS["max_employees"]
        
        if current_count >= max_employees:
            return False, f"Free tier limit reached: maximum {max_employees} employees allowed"
        
        return True, None

    def check_webhooks_enabled(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if webhooks are enabled for this tier
        
        Returns:
            Tuple of (enabled: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        if not self.FREE_TIER_LIMITS["webhooks_enabled"]:
            return False, "Webhooks are not available on free tier"
        
        return True, None

    def check_logs_enabled(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if logs are enabled for this tier
        
        Returns:
            Tuple of (enabled: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        if not self.FREE_TIER_LIMITS["logs_enabled"]:
            return False, "Logs are not available on free tier"
        
        return True, None

    def check_security_enabled(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if security features are enabled for this tier
        
        Returns:
            Tuple of (enabled: bool, error_message: Optional[str])
        """
        if self.is_free_tier(project):
            if not self.FREE_TIER_LIMITS["security_enabled"]:
                return False, "Security features are not available on free tier"
            return True, None
        
        # For pro tier, only minimal security is available
        if self.is_pro_tier(project):
            if self.PRO_TIER_LIMITS["security_enabled"] == "minimal":
                return True, None  # Minimal security is allowed
        
        # For other tiers, full security is available
        return True, None
    
    def check_security_minimal_enabled(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if minimal security features are enabled for this tier
        
        Returns:
            Tuple of (enabled: bool, error_message: Optional[str])
        """
        if self.is_free_tier(project):
            return False, "Security features are not available on free tier"
        
        if self.is_pro_tier(project):
            return True, None  # Pro tier has minimal security
        
        # For other tiers, full security is available
        return True, None

    def check_remote_control_enabled(self, project: Project) -> Tuple[bool, Optional[str]]:
        """
        Check if remote control is enabled for this tier
        
        Returns:
            Tuple of (enabled: bool, error_message: Optional[str])
        """
        if not self.is_free_tier(project):
            return True, None
        
        if not self.FREE_TIER_LIMITS["remote_control_enabled"]:
            return False, "Remote control is not available on free tier"
        
        return True, None

    def get_storage_limit_mb(self, project: Project) -> int:
        """
        Get storage limit in MB for the project's tier
        
        Returns:
            Storage limit in MB
        """
        if self.is_free_tier(project):
            return self.FREE_TIER_LIMITS["max_storage_mb"]
        

        if self.is_pro_tier(project):
            if hasattr(project, 'storage_limit_mb'):
                return project.storage_limit_mb

            return 3 * 1024  # 3 GB default for pro tier
        

        return project.storage_limit_mb if hasattr(project, 'storage_limit_mb') else 0

    def enforce_storage_limit(self, project: Project):
        """
        Enforce storage limit for free tier projects
        Sets storage_limit to 500 MB for free tier
        """
        if self.is_free_tier(project):
            max_storage_bytes = self.FREE_TIER_LIMITS["max_storage_mb"] * (1024 ** 2)
            if project.storage_limit != max_storage_bytes:
                project.storage_limit = max_storage_bytes

                if hasattr(project, 'storage_limit_gb'):
                    project.storage_limit_gb = self.FREE_TIER_LIMITS["max_storage_mb"] / 1024.0
                db.session.commit()

