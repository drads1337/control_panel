"""
ABAC Service
Manages Attribute-Based Access Control rules
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from ...core.extensions import db
from ...models.core import User
from ...models.rbac import AttributeRule, ResourceAttribute, UserAttribute

class ABACService:
    """Service for managing ABAC (Attribute-Based Access Control) rules"""

    def __init__(self):
        """Initialize ABACService"""
        self.logger = logging.getLogger(__name__)

    def check_abac_rules(
        self,
        user_id: int,
        permission: str,
        resource_type: str = None,
        resource_id: int = None,
        context: Dict = None,
    ) -> Optional[bool]:
        """Check ABAC rules for permission"""
        try:

            user = User.query.get(user_id)
            if not user or not user.project_id:
                return None

            if "." in permission:
                resource, action = permission.split(".", 1)
            else:
                resource = permission
                action = "view"

            rules = (
                AttributeRule.query.filter_by(project_id=user.project_id, is_active=True)
                .filter(
                    db.or_(
                        AttributeRule.target_resource == resource,
                        AttributeRule.target_resource.is_(None),
                    )
                )
                .filter(
                    db.or_(
                        AttributeRule.target_action == action, AttributeRule.target_action.is_(None)
                    )
                )
                .order_by(AttributeRule.priority)
                .all()
            )

            user_attributes = self.get_user_attributes(user_id)

            resource_attributes = {}
            if resource_type and resource_id:
                resource_attributes = self.get_resource_attributes(
                    user.project_id, resource_type, resource_id
                )

            for rule in rules:
                if self._evaluate_rule(rule, user_attributes, resource_attributes, context):
                    if rule.rule_type == "allow":
                        return True
                    elif rule.rule_type == "deny":
                        return False

            return None

        except Exception as e:
            logging.error(
                f"ABAC_RULES_CHECK_ERROR user_id={user_id} permission={permission} error={e}"
            )
            return None

    def get_user_attributes(self, user_id: int) -> Dict[str, Any]:
        """Get all attributes for a user"""
        try:
            attributes = UserAttribute.query.filter_by(user_id=user_id).all()
            result = {}

            for attr in attributes:
                value = attr.attribute_value

                if attr.attribute_type == "number":
                    try:
                        value = float(value)
                    except ValueError:
                        value = 0
                elif attr.attribute_type == "boolean":
                    value = value.lower() in ("true", "1", "yes", "on")
                elif attr.attribute_type == "date":
                    try:
                        from datetime import datetime

                        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except ValueError:
                        value = None

                result[attr.attribute_name] = value

            return result

        except Exception as e:
            logging.error(f"ABAC_USER_ATTRIBUTES_ERROR user_id={user_id} error={e}")
            return {}

    def get_resource_attributes(
        self, project_id: int, resource_type: str, resource_id: int
    ) -> Dict[str, Any]:
        """Get all attributes for a resource"""
        try:
            attributes = ResourceAttribute.query.filter_by(
                project_id=project_id, resource_type=resource_type, resource_id=resource_id
            ).all()

            result = {}
            for attr in attributes:
                value = attr.attribute_value

                if attr.attribute_type == "number":
                    try:
                        value = float(value)
                    except ValueError:
                        value = 0
                elif attr.attribute_type == "boolean":
                    value = value.lower() in ("true", "1", "yes", "on")
                elif attr.attribute_type == "date":
                    try:
                        from datetime import datetime

                        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except ValueError:
                        value = None

                result[attr.attribute_name] = value

            return result

        except Exception as e:
            logging.error(
                f"ABAC_RESOURCE_ATTRIBUTES_ERROR project_id={project_id} resource_type={resource_type} resource_id={resource_id} error={e}"
            )
            return {}

    def _evaluate_rule(
        self,
        rule: AttributeRule,
        user_attributes: Dict,
        resource_attributes: Dict,
        context: Dict = None,
    ) -> bool:
        """Evaluate an ABAC rule against current attributes and context"""
        try:
            conditions = rule.get_conditions()
            if not conditions:
                return True

            all_attributes = {}
            all_attributes.update(user_attributes)
            all_attributes.update(resource_attributes)
            if context:
                all_attributes.update(context)

            return self._evaluate_conditions(conditions, all_attributes)

        except Exception as e:
            logging.error(f"ABAC_RULE_EVALUATION_ERROR rule_id={rule.id} error={e}")
            return False

    def _evaluate_conditions(self, conditions: Dict, attributes: Dict) -> bool:
        """Evaluate conditions dictionary against attributes"""
        try:

            for key, expected_value in conditions.items():
                if key not in attributes:
                    return False

                actual_value = attributes[key]

                if isinstance(expected_value, dict):

                    operator = expected_value.get("operator", "equals")
                    value = expected_value.get("value")

                    if operator == "equals":
                        if actual_value != value:
                            return False
                    elif operator == "not_equals":
                        if actual_value == value:
                            return False
                    elif operator == "greater_than":
                        if not (isinstance(actual_value, (int, float)) and actual_value > value):
                            return False
                    elif operator == "less_than":
                        if not (isinstance(actual_value, (int, float)) and actual_value < value):
                            return False
                    elif operator == "contains":
                        if not (isinstance(actual_value, str) and value in actual_value):
                            return False
                    elif operator == "in":
                        if actual_value not in value:
                            return False
                else:

                    if actual_value != expected_value:
                        return False

            return True

        except Exception as e:
            logging.error(f"ABAC_CONDITIONS_EVALUATION_ERROR error={e}")
            return False

    def create_attribute_rule(
        self,
        project_id: int,
        name: str,
        description: str,
        rule_type: str,
        conditions: Dict,
        target_resource: str = None,
        target_action: str = None,
        priority: int = 100,
    ) -> Dict:
        """Create a new ABAC attribute rule"""
        try:

            if rule_type not in ["allow", "deny", "condition"]:
                raise ValueError("Rule type must be 'allow', 'deny', or 'condition'")

            rule = AttributeRule(
                project_id=project_id,
                name=name,
                description=description,
                rule_type=rule_type,
                target_resource=target_resource,
                target_action=target_action,
                priority=priority,
                is_active=True,
                created_at=datetime.utcnow(),
            )

            rule.set_conditions(conditions)

            db.session.add(rule)
            db.session.commit()

            logging.info(
                f"ABAC_RULE_CREATED rule_id={rule.id} project_id={project_id} name={name} type={rule_type}"
            )

            return {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "rule_type": rule.rule_type,
                "conditions": rule.get_conditions(),
                "target_resource": rule.target_resource,
                "target_action": rule.target_action,
                "priority": rule.priority,
                "is_active": rule.is_active,
                "created_at": rule.created_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"ABAC_RULE_CREATION_ERROR project_id={project_id} name={name} error={e}")
            raise ValueError(f"Failed to create attribute rule: {str(e)}")

    def set_user_attribute(
        self,
        user_id: int,
        attribute_name: str,
        attribute_value: str,
        attribute_type: str = "string",
    ) -> Dict:
        """Set a user attribute for ABAC"""
        try:

            existing = UserAttribute.query.filter_by(
                user_id=user_id, attribute_name=attribute_name
            ).first()

            if existing:
                existing.attribute_value = attribute_value
                existing.attribute_type = attribute_type
                existing.updated_at = datetime.utcnow()
            else:
                attribute = UserAttribute(
                    user_id=user_id,
                    attribute_name=attribute_name,
                    attribute_value=attribute_value,
                    attribute_type=attribute_type,
                    created_at=datetime.utcnow(),
                )
                db.session.add(attribute)

            db.session.commit()

            logging.info(f"ABAC_USER_ATTRIBUTE_SET user_id={user_id} name={attribute_name}")

            return {
                "user_id": user_id,
                "attribute_name": attribute_name,
                "attribute_value": attribute_value,
                "attribute_type": attribute_type,
            }

        except Exception as e:
            db.session.rollback()
            logging.error(
                f"ABAC_USER_ATTRIBUTE_SET_ERROR user_id={user_id} name={attribute_name} error={e}"
            )
            raise ValueError(f"Failed to set user attribute: {str(e)}")

    def set_resource_attribute(
        self,
        project_id: int,
        resource_type: str,
        resource_id: int,
        attribute_name: str,
        attribute_value: str,
        attribute_type: str = "string",
    ) -> Dict:
        """Set a resource attribute for ABAC"""
        try:

            existing = ResourceAttribute.query.filter_by(
                project_id=project_id,
                resource_type=resource_type,
                resource_id=resource_id,
                attribute_name=attribute_name,
            ).first()

            if existing:
                existing.attribute_value = attribute_value
                existing.attribute_type = attribute_type
                existing.updated_at = datetime.utcnow()
            else:
                attribute = ResourceAttribute(
                    project_id=project_id,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    attribute_name=attribute_name,
                    attribute_value=attribute_value,
                    attribute_type=attribute_type,
                    created_at=datetime.utcnow(),
                )
                db.session.add(attribute)

            db.session.commit()

            logging.info(
                f"ABAC_RESOURCE_ATTRIBUTE_SET project_id={project_id} resource_type={resource_type} resource_id={resource_id} name={attribute_name}"
            )

            return {
                "project_id": project_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "attribute_name": attribute_name,
                "attribute_value": attribute_value,
                "attribute_type": attribute_type,
            }

        except Exception as e:
            db.session.rollback()
            logging.error(
                f"ABAC_RESOURCE_ATTRIBUTE_SET_ERROR project_id={project_id} resource_type={resource_type} resource_id={resource_id} name={attribute_name} error={e}"
            )
            raise ValueError(f"Failed to set resource attribute: {str(e)}")

# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   abac_service = get_service('abac_service')
