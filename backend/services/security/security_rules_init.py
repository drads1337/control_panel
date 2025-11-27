"""
Security Rules Initialization Service
Creates and manages default security rules for projects
"""

import json
import logging
from datetime import datetime
from typing import List, Optional

from ...core.extensions import db
from ...models.security import SecurityRule

logger = logging.getLogger(__name__)


class SecurityRulesInitService:
    """Service for initializing default security rules"""

    DEFAULT_RULES = [
        {
            "name": "Auto-block Suspicious IPs",
            "description": "Automatically block IPs with high threat score",
            "rule_type": "threat_score",
            "conditions": json.dumps({"min_threat_score": 70}),
            "action_type": "block",
            "action_params": json.dumps({"severity": "high", "threat_score": 70, "block_duration_hours": 24}),
            "is_active": True,
            "priority": 90,
            "cooldown_minutes": 60,
        },
        {
            "name": "Rate Limiting Protection",
            "description": "Limit requests per minute per IP",
            "rule_type": "rate_limit",
            "conditions": json.dumps({"max_requests_per_minute": 60, "time_window_minutes": 1}),
            "action_type": "monitor",
            "action_params": json.dumps({"log_severity": "medium"}),
            "is_active": True,
            "priority": 80,
            "cooldown_minutes": 5,
        },
        {
            "name": "Failed Login Protection",
            "description": "Block after 5 failed login attempts",
            "rule_type": "failed_login",
            "conditions": json.dumps({"max_failed_attempts": 5, "time_window_minutes": 15}),
            "action_type": "block",
            "action_params": json.dumps({"severity": "high", "block_duration_hours": 1}),
            "is_active": True,
            "priority": 95,
            "cooldown_minutes": 60,
        },
        {
            "name": "HWID Blacklist",
            "description": "Block known malicious hardware IDs",
            "rule_type": "hwid_block",
            "conditions": json.dumps({"check_blacklist": True}),
            "action_type": "block",
            "action_params": json.dumps({"severity": "critical", "block_duration_hours": 0}),
            "is_active": True,
            "priority": 100,
            "cooldown_minutes": 0,
        },
        {
            "name": "Geo-blocking",
            "description": "Block connections from specific countries",
            "rule_type": "geo_block",
            "conditions": json.dumps({"blocked_countries": [], "allowed_countries": []}),
            "action_type": "block",
            "action_params": json.dumps({"severity": "medium", "block_duration_hours": 0}),
            "is_active": False,
            "priority": 85,
            "cooldown_minutes": 0,
        },
        {
            "name": "VPN Detection",
            "description": "Detect and block VPN connections",
            "rule_type": "vpn_detection",
            "conditions": json.dumps({"check_vpn": True, "block_vpn": False}),
            "action_type": "monitor",
            "action_params": json.dumps({"log_severity": "medium", "block_vpn": False}),
            "is_active": False,
            "priority": 75,
            "cooldown_minutes": 30,
        },
        {
            "name": "Brute Force Protection",
            "description": "Temporary block after multiple failed attempts",
            "rule_type": "brute_force",
            "conditions": json.dumps({"max_attempts": 10, "time_window_minutes": 5, "block_duration_minutes": 30}),
            "action_type": "block",
            "action_params": json.dumps({"severity": "high", "block_duration_hours": 0.5}),
            "is_active": True,
            "priority": 92,
            "cooldown_minutes": 15,
        },
        {
            "name": "Suspicious Activity Monitor",
            "description": "Monitor unusual access patterns",
            "rule_type": "behavioral",
            "conditions": json.dumps({"check_patterns": ["rapid_connections", "fingerprint_reuse"], "fingerprint_reuse_threshold": 3}),
            "action_type": "log",
            "action_params": json.dumps({"log_severity": "low"}),
            "is_active": True,
            "priority": 50,
            "cooldown_minutes": 60,
        },
    ]

    def initialize_default_rules(self, project_id: int, created_by_user_id: Optional[int] = None) -> List[SecurityRule]:
        """
        Initialize default security rules for a project

        Args:
            project_id: Project ID
            created_by_user_id: Optional user ID who created the rules

        Returns:
            List of created SecurityRule objects
        """
        try:
            existing_rules = SecurityRule.query.filter_by(project_id=project_id).all()
            existing_names = {rule.name for rule in existing_rules}

            created_rules = []
            for rule_data in self.DEFAULT_RULES:
                if rule_data["name"] in existing_names:
                    logger.debug(f"Rule '{rule_data['name']}' already exists for project {project_id}, skipping")
                    continue

                rule = SecurityRule(
                    name=rule_data["name"],
                    description=rule_data["description"],
                    rule_type=rule_data["rule_type"],
                    conditions=rule_data["conditions"],
                    action_type=rule_data["action_type"],
                    action_params=rule_data["action_params"],
                    is_active=rule_data["is_active"],
                    priority=rule_data["priority"],
                    cooldown_minutes=rule_data["cooldown_minutes"],
                    project_id=project_id,
                    created_by_user_id=created_by_user_id,
                )

                db.session.add(rule)
                created_rules.append(rule)

            if created_rules:
                db.session.commit()
                logger.info(f"Initialized {len(created_rules)} default security rules for project {project_id}")

            return created_rules

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error initializing default security rules for project {project_id}: {e}")
            raise

    def get_rule_by_name(self, project_id: int, rule_name: str) -> Optional[SecurityRule]:
        """Get a security rule by name"""
        return SecurityRule.query.filter_by(project_id=project_id, name=rule_name).first()

    def ensure_default_rules(self, project_id: int) -> List[SecurityRule]:
        """
        Ensure all default rules exist for a project (create missing ones)

        Args:
            project_id: Project ID

        Returns:
            List of all security rules for the project
        """
        self.initialize_default_rules(project_id)
        return SecurityRule.query.filter_by(project_id=project_id).all()


# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   security_rules_init_service = get_service('security_rules_init_service')