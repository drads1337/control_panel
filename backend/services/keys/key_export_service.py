"""
Key Export Service
Handles key export operations: export, download, reveal
"""

from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product
from ...models.keys import Key
from ...services.rbac import rbac_service
from ...utils.data_masking import mask_license_key
from ...utils.rbac_utils import RBACManager
from ...utils.structured_logging import get_logger


class KeyExportService:
    """Service for handling key export operations"""

    def __init__(self):
        self.logger = get_logger("key_export_service")

    def export_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Export a single key

        Args:
            user: User exporting the key
            key_id: Key ID

        Returns:
            Tuple of (export data dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            product = (
                Product.query.filter_by(id=key.product_id, project_id=user.project_id).first()
                if key.product_id
                else None
            )

            export_data = {
                "key_id": key.id,
                "key": key.key,
                "product_id": key.product_id,
                "product_name": product.name if product else None,
                "status": key.status,
                "is_active": key.status == 1
                and (not key.expires_at or key.expires_at > datetime.utcnow()),
                "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "activated_at": key.activated_at.isoformat() if key.activated_at else None,
                "max_devices": key.max_devices,
                "device_count": (
                    len([d.strip() for d in key.devices.split(",") if d.strip()]) if key.devices else 0
                ),
                "duration_hours": key.duration_hours,
                "project_id": key.project_id,
                "fingerprint": key.fingerprint,
                "key_metadata": key.key_metadata,
            }

            return export_data, None

        except Exception as e:
            self.logger.error(f"Failed to export key: {str(e)}")
            return None, f"Failed to export key: {str(e)}"

    def download_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get key data for download (with security checks)

        Args:
            user: User downloading the key
            key_id: Key ID

        Returns:
            Tuple of (key data dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            can_download_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            if not can_download_full_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_download_full_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_download_full_key = rbac_service.check_permission(user.id, "keys.view")

            key_value = key.key if can_download_full_key else mask_license_key(key.key)

            product = (
                Product.query.filter_by(id=key.product_id, project_id=user.project_id).first()
                if key.product_id
                else None
            )

            export_data = {
                "key_id": key.id,
                "key": key_value,
                "key_masked": not can_download_full_key,
                "product_id": key.product_id,
                "product_name": product.name if product else None,
                "status": key.status,
                "is_active": key.status == 1
                and (not key.expires_at or key.expires_at > datetime.utcnow()),
                "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "activated_at": key.activated_at.isoformat() if key.activated_at else None,
                "max_devices": key.max_devices,
                "device_count": (
                    len([d.strip() for d in key.devices.split(",") if d.strip()]) if key.devices else 0
                ),
                "duration_hours": key.duration_hours,
                "project_id": key.project_id,
                "fingerprint": key.fingerprint,
                "key_metadata": key.key_metadata,
            }

            return export_data, None

        except Exception as e:
            self.logger.error(f"Failed to download key: {str(e)}")
            return None, f"Failed to download key: {str(e)}"

    def reveal_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Reveal full license key (with security checks)

        Args:
            user: User revealing the key
            key_id: Key ID

        Returns:
            Tuple of (key data dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            can_reveal_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            if not can_reveal_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_reveal_key = (
                        rbac_service.check_permission(user.id, "keys.see_analytics") or
                        rbac_service.check_permission(user.id, "keys.copy")
                    )
                else:
                    can_reveal_key = (
                        rbac_service.check_permission(user.id, "keys.see_analytics") or
                        rbac_service.check_permission(user.id, "keys.copy")
                    )

            if not can_reveal_key:
                self.logger.warning(
                    f"Unauthorized key reveal attempt: user_id={user.id}, key_id={key_id}, "
                    f"key_owner={key.user_id}, has_keys_see_analytics={rbac_service.check_permission(user.id, 'keys.see_analytics')}, "
                    f"has_keys_copy={rbac_service.check_permission(user.id, 'keys.copy')}"
                )
                return {
                    "key": mask_license_key(key.key),
                    "key_masked": True,
                    "error": "Insufficient permissions to reveal key"
                }, "Insufficient permissions to reveal key"

            self.logger.info(
                f"🔓 Key revealed: user_id={user.id}, key_id={key_id}, "
                f"key_owner={key.user_id}, is_own_key={key.user_id == user.id}"
            )

            return {
                "key": key.key,
                "key_masked": False,
                "id": key.id
            }, None

        except Exception as e:
            self.logger.error(f"Failed to reveal key: {str(e)}")
            return None, f"Failed to reveal key: {str(e)}"


# Singleton instance
key_export_service = KeyExportService()

