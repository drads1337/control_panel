from ...utils.service_helpers import get_service
"""
Key Validation Service
Handles key validation logic
"""

from typing import Any, Dict, Optional

from ...models.core import User
from ...models.products import Product
from ...models.keys import Key
from ...models.agents import Agent
from ...utils.service_exceptions import ValidationError, NotFoundError, PermissionDeniedError, ServiceError
from ...utils.structured_logging import get_logger

class KeyValidationService:
    """Service for validating key data and operations"""

    def __init__(self, product_service):
        self._product_service = product_service
        self.logger = get_logger("key_validation_service")

    def validate_key_data(
        self, user: User, key_data: Dict[str, Any]
    ) -> None:
        """
        Validate key creation data

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Raises:
            ValidationError: If validation fails
            NotFoundError: If product or agent not found
            PermissionDeniedError: If access denied
        """

        if not key_data.get("product_id") and not key_data.get("agent_id"):
            raise ValidationError("Either product_id or agent_id is required", field="product_id")

        product = None
        agent = None

        if key_data.get("product_id"):

            if not self._product_service:
                raise ServiceError(
                    "Product dependency not injected",
                    status_code=500
                )

            try:
                product = self._product_service.get_product(user, key_data["product_id"])
            except NotFoundError:
                raise NotFoundError("Product", resource_id=str(key_data["product_id"]))
            except PermissionDeniedError:
                raise PermissionDeniedError("Access denied to product")

        if key_data.get("agent_id"):
            agent = Agent.query.filter_by(
                id=key_data["agent_id"], project_id=user.project_id
            ).first()
            if not agent:
                raise NotFoundError("Agent", resource_id=str(key_data["agent_id"]))

        duration_hours = key_data.get("duration_hours", 24)
        if duration_hours <= 0 or duration_hours > 8760:
            raise ValidationError("Invalid duration_hours. Must be between 1 and 8760", field="duration_hours")

        max_devices = key_data.get("max_devices", 1)
        if max_devices <= 0 or max_devices > 1000:
            raise ValidationError("Invalid max_devices. Must be between 1 and 1000", field="max_devices")

    def validate_bulk_operation(self, count: int, max_count: int = 1000) -> None:
        """
        Validate bulk operation count

        Args:
            count: Number of items in bulk operation
            max_count: Maximum allowed count

        Raises:
            ValidationError: If validation fails
        """
        if count > max_count:
            raise ValidationError(f"Too many items in one request. Maximum: {max_count}", field="count")
        if count <= 0:
            raise ValidationError("Count must be greater than 0", field="count")

