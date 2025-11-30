"""
Key Validator Service
Handles key validation, expiration checks, and device limits
This service is shared between web panel (JWT auth) and client connect endpoints (challenge-response)
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from flask import request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ...core.extensions import db
from ...models.core import Project, User
from ...models.products import Product
from ...models.keys import Key
from ...utils.rbac_utils import RBACManager
from ...utils.service_exceptions import ServiceError


logger = logging.getLogger(__name__)

class KeyValidator:
    """Handles key validation and related checks"""
    def __init__(self, webhook_service=None):
        """Initialize KeyValidator with dependencies"""
        self._webhook_service = webhook_service

    def validate_key_status(self, key_obj: Key) -> Tuple[bool, str]:
        """
        Validate key is active and not expired

        Args:
            key_obj: Key object to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not key_obj or key_obj.status != 1:
            return False, "Key is not active (frozen or blocked)"

        now = datetime.utcnow()
        if key_obj.expires_at and key_obj.expires_at < now:
            return False, "Key expired"

        return True, ""

    def activate_key_if_needed(self, key_obj: Key) -> None:
        """
        Activate key if it hasn't been activated yet

        Args:
            key_obj: Key object to potentially activate
        """
        if key_obj.activated_at is None:
            now = datetime.utcnow()
            key_obj.activated_at = now
            key_obj.expires_at = key_obj.activated_at + timedelta(
                hours=key_obj.duration_hours or 24
            )
            db.session.add(key_obj)
            db.session.commit()
            logger.info(f"KEY_ACTIVATED key_id={key_obj.id} expires_at={key_obj.expires_at}")

            try:
                if not self._webhook_service:

                    logger.warning(f"WebhookService not injected, skipping webhook trigger for key activation: {key_obj.id}")
                else:
                    product = None
                    if key_obj.product_id:
                        product = Product.query.get(key_obj.product_id)

                    webhook_data = {
                        "key_id": key_obj.id,
                        "key_value": key_obj.key,
                        "user_id": key_obj.user_id,
                        "product_id": key_obj.product_id,
                        "product_name": product.name if product else None,
                        "duration_hours": key_obj.duration_hours,
                        "max_devices": key_obj.max_devices,
                        "activated_at": key_obj.activated_at.isoformat(),
                        "expires_at": key_obj.expires_at.isoformat() if key_obj.expires_at else None,
                    }

                    self._webhook_service.trigger_webhook("key.activated", webhook_data, key_obj.project_id)
                    logger.info(f"Triggered webhook for key activation: {key_obj.id}")

            except Exception as e:
                logger.error(f"Failed to trigger webhook for key activation: {str(e)}")

    def validate_product_access(
        self, key_obj: Key, product: str, project_id: int
    ) -> Tuple[bool, str, Optional[Product]]:
        """
        Validate user has access to the specified product

        Args:
            key_obj: Key object
            product: Product name
            project_id: Project ID

        Returns:
            Tuple of (is_valid, error_message, product_object)
        """
        product_obj = None

        if key_obj.product_id:
            product_obj = Product.query.filter_by(id=key_obj.product_id, project_id=project_id).first()

            if not product_obj or product_obj.project_id != project_id:
                return False, "Key not found", None

            if product_obj.name and product_obj.name.lower() != product.lower():
                return False, "Key not found", None

            if product_obj.status == "inactive":
                return (
                    False,
                    "Product Inactive - This product is currently inactive and access is not allowed.",
                    product_obj,
                )
            elif product_obj.status == "maintenance":
                return (
                    False,
                    "Product Maintenance - This product is currently under maintenance. Access is temporarily unavailable.",
                    product_obj,
                )
            elif product_obj.status == "testing":
                logger.info(f"PRODUCT_TESTING_ACCESS user_key={key_obj.key} product={product}")

        return True, "", product_obj

    def validate_project_status(self, project_id: int) -> Tuple[bool, str, Optional[Project]]:
        """
        Validate project is active

        Args:
            project_id: Project ID to validate

        Returns:
            Tuple of (is_valid, error_message, project_object)
        """
        project = Project.query.get(project_id)

        if not project:
            return False, "Project not found", None

        if not project.is_active:
            error_message = "Project is currently inactive"
            if project.status == "inactive":
                error_message = (
                    "Project has been paused. Please contact the project owner to reactivate it."
                )
            elif project.status == "expired":
                error_message = "Project subscription has expired. Please contact the project owner to renew the subscription."

            return False, error_message, project

        return True, "", project

    def validate_device_limit(self, key_obj: Key, serial: str) -> Tuple[bool, str]:
        """
        Validate device limit for the key

        Args:
            key_obj: Key object
            serial: Device serial number

        Returns:
            Tuple of (is_valid, error_message)
        """
        devices = key_obj.devices.split(",") if key_obj.devices else []

        logger.info(
            f"DEVICE_CHECK user_key={key_obj.key} serial={serial} current_devices={len(devices)} max_devices={key_obj.max_devices}"
        )

        if serial not in devices:
            if len(devices) < key_obj.max_devices:

                return True, ""
            else:
                return False, "Max devices reached"

        return True, ""

    def validate_single_device_fingerprint(
        self, key_obj: Key, fingerprint: str
    ) -> Tuple[bool, str]:
        """
        Validate single device fingerprint constraint

        Args:
            key_obj: Key object
            fingerprint: Device fingerprint

        Returns:
            Tuple of (is_valid, error_message)
        """
        if key_obj.max_devices == 1:
            if not key_obj.fingerprint:

                key_obj.fingerprint = fingerprint
                db.session.commit()
                logger.info(f"FINGERPRINT_SET key_id={key_obj.id} fingerprint={fingerprint}")
            elif key_obj.fingerprint != fingerprint:

                return False, "Device mismatch"

        return True, ""

    def validate_user_authorization(self, key_obj: Key, project_id: int) -> Tuple[bool, str]:
        """
        Validate user authorization for the request

        Args:
            key_obj: Key object
            project_id: Project ID

        Returns:
            Tuple of (is_valid, error_message)
        """

        if "Authorization" in request.headers:
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                user = User.query.get(user_id)

                if not user.project_id:
                    return False, "User must be assigned to a project"

                if user and not RBACManager.is_owner(user) and user.project_id != project_id:
                    return False, "Access denied (project mismatch)"

            except Exception:

                pass

        return True, ""

    def get_key_expiration_info(self, key_obj: Key) -> Tuple[Optional[str], Optional[int], str]:
        """
        Get key expiration information

        Args:
            key_obj: Key object

        Returns:
            Tuple of (expires_at_iso, seconds_left, human_readable_time)
        """
        if not key_obj or not key_obj.expires_at:
            return None, None, "0 min"

        now = datetime.utcnow()
        expires_at = key_obj.expires_at.isoformat()
        seconds_left = int((key_obj.expires_at - now).total_seconds())

        if seconds_left > 0:
            hours = seconds_left // 3600
            minutes = (seconds_left % 3600) // 60
            if hours > 0:
                seconds_left_human = f"{hours} h {minutes} min"
            else:
                seconds_left_human = f"{minutes} min"
        else:
            seconds_left_human = "0 min"

        return expires_at, seconds_left, seconds_left_human

key_validator = KeyValidator()
