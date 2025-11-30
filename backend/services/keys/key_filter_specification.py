"""
Key Filter Specification
Implements Specification pattern for key filtering logic
"""

from datetime import datetime
from typing import Any, Dict

from sqlalchemy import or_
from sqlalchemy.orm import Query

from ...models.keys import Key
from ...utils.fulltext_search import fulltext_search_filter

class KeyFilterSpecification:
    """
    Specification class for filtering keys.
    Implements the Specification pattern to encapsulate filtering logic.
    """

    def __init__(self, filters: Dict[str, Any], logger=None):
        """
        Initialize filter specification with filter parameters

        Args:
            filters: Dictionary of filter parameters
            logger: Optional logger instance
        """
        self.filters = filters
        self.logger = logger

    def apply(self, query: Query) -> Query:
        """
        Apply all filters to the query

        Args:
            query: SQLAlchemy query object

        Returns:
            Filtered query
        """
        if self.logger:
            self.logger.info(f"🔧 Applying filters: {self.filters}")

        query = self._apply_product_filters(query)
        query = self._apply_status_filters(query)
        query = self._apply_activation_filters(query)
        query = self._apply_date_filters(query)
        query = self._apply_device_filters(query)
        query = self._apply_search_filters(query)

        return query

    def _apply_product_filters(self, query: Query) -> Query:
        """Apply product-related filters"""
        if self.filters.get("product_id"):
            if self.logger:
                self.logger.info(f"🎮 Filtering by product_id: {self.filters['product_id']}")
            query = query.filter_by(product_id=self.filters["product_id"])
        elif self.filters.get("agent_id") and self.filters.get("product_ids"):
            if self.logger:
                self.logger.info(
                    f"📦 Filtering by agent_id: {self.filters['agent_id']}, "
                    f"product_ids: {self.filters['product_ids']}"
                )
            query = query.filter(Key.product_id.in_(self.filters["product_ids"]))

        return query

    def _apply_status_filters(self, query: Query) -> Query:
        """Apply status-related filters"""
        if self.filters.get("status") and self.filters["status"] != "all":
            status = self.filters["status"]
            if self.logger:
                self.logger.info(f"📊 Filtering by status: {status}")

            if status == "active":
                if self.logger:
                    self.logger.info(
                        "✅ Applying active status filter: "
                        "status=1 AND (expires_at IS NULL OR expires_at > now)"
                    )
                query = query.filter(
                    Key.status == 1,
                    or_(Key.expires_at.is_(None), Key.expires_at > datetime.utcnow()),
                )
            elif status == "expired":
                if self.logger:
                    self.logger.info(
                        "⏰ Applying expired status filter: "
                        "status=1 AND expires_at <= now (only active keys can be expired)"
                    )


                query = query.filter(
                    Key.status == 1,
                    Key.expires_at <= datetime.utcnow()
                )
            elif status == "inactive":
                if self.logger:
                    self.logger.info("❌ Applying inactive status filter: status=0")
                query = query.filter(Key.status == 0)
            else:
                if self.logger:
                    self.logger.info(f"🔢 Applying numeric status filter: status={int(status)}")
                query = query.filter_by(status=int(status))
        else:
            if self.logger:
                self.logger.info("📊 No status filter applied (status='all' or not provided)")

        return query

    def _apply_activation_filters(self, query: Query) -> Query:
        """Apply activation status filters"""
        if self.filters.get("activation_status") and self.filters["activation_status"] != "all":
            if self.filters["activation_status"] == "activated":
                query = query.filter(Key.activated_at.isnot(None))
            elif self.filters["activation_status"] == "not_activated":
                query = query.filter(Key.activated_at.is_(None))

        return query

    def _apply_date_filters(self, query: Query) -> Query:
        """Apply date range filters"""
        if self.filters.get("date_from"):
            date_from = datetime.fromisoformat(self.filters["date_from"].replace("Z", "+00:00"))
            query = query.filter(Key.created_at >= date_from)

        if self.filters.get("date_to"):
            date_to = datetime.fromisoformat(self.filters["date_to"].replace("Z", "+00:00"))
            query = query.filter(Key.created_at <= date_to)

        return query

    def _apply_device_filters(self, query: Query) -> Query:
        """Apply device-related filters"""
        if self.filters.get("device_usage") and self.filters["device_usage"] != "all":
            if self.filters["device_usage"] == "used":
                query = query.filter(Key.devices != "")
            elif self.filters["device_usage"] == "unused":
                query = query.filter(or_(Key.devices == "", Key.devices.is_(None)))

        if self.filters.get("max_devices") and self.filters["max_devices"] != "all":
            if self.filters["max_devices"] == "single":
                query = query.filter(Key.max_devices == 1)
            elif self.filters["max_devices"] == "multiple":
                query = query.filter(Key.max_devices > 1)

        return query

    def _apply_search_filters(self, query: Query) -> Query:
        """Apply full-text search filters"""
        if self.filters.get("search"):
            query = fulltext_search_filter(query, self.filters["search"], "search_vector")

        return query

