"""
Key Statistics Service
Handles key statistics and analytics
"""

from datetime import datetime
from typing import Any, Dict

from sqlalchemy import func, or_

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product
from ...models.keys import Key
from ...utils.structured_logging import get_logger


class KeyStatisticsService:
    """Service for handling key statistics"""

    def __init__(self):
        self.logger = get_logger("key_statistics_service")

    def get_key_stats(self, user: User) -> Dict[str, Any]:
        """
        Get key statistics for user's project

        Args:
            user: User requesting stats

        Returns:
            Dictionary with key statistics
        """
        try:
            query = Key.query.filter_by(project_id=user.project_id)

            total_keys = query.count()
            active_keys = query.filter(
                Key.status == 1, or_(Key.expires_at.is_(None), Key.expires_at > datetime.utcnow())
            ).count()
            expired_keys = query.filter(Key.expires_at <= datetime.utcnow()).count()
            inactive_keys = query.filter(Key.status == 0).count()

            keys_by_product = (
                db.session.query(Product.name, func.count(Key.id).label("count"))
                .join(Key, Product.id == Key.product_id)
                .filter(Key.project_id == user.project_id)
                .group_by(Product.id, Product.name)
                .all()
            )

            return {
                "total_keys": total_keys,
                "active_keys": active_keys,
                "expired_keys": expired_keys,
                "inactive_keys": inactive_keys,
                "keys_by_product": [
                    {"product_name": name, "count": count} for name, count in keys_by_product
                ],
            }

        except Exception as e:
            self.logger.error(f"Failed to get key stats: {str(e)}")
            return {
                "total_keys": 0,
                "active_keys": 0,
                "expired_keys": 0,
                "inactive_keys": 0,
                "keys_by_product": [],
            }


# Singleton instance
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   key_statistics_service = get_service('key_statistics_service')

