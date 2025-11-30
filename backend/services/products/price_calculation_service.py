"""
Price Calculation Service
Handles price calculation for keys based on product pricing
"""

import logging
from typing import Optional

from ...core.extensions import db
from ...models.products import Product, ProductKeyPrice
from ...utils.structured_logging import get_logger

class PriceCalculationService:
    """Service for calculating key prices based on product pricing"""

    def __init__(self):
        self.logger = get_logger("price_calculation_service")

    def calculate_key_price(
        self, product_id: int, duration_hours: float, project_id: int
    ) -> float:
        """
        Calculate the price for a key based on product pricing

        Args:
            product_id: Product ID
            duration_hours: Duration in hours
            project_id: Project ID

        Returns:
            Price in tokens (0.0 if no price found or free)
        """
        try:
            # First, try to find exact match for duration
            period_str = str(int(duration_hours))
            exact_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, period=period_str, project_id=project_id
            ).first()

            if exact_price:
                return float(exact_price.price)

            # If no exact match, check for custom periods
            custom_prices = ProductKeyPrice.query.filter_by(
                product_id=product_id, project_id=project_id
            ).filter(ProductKeyPrice.period.like("custom_%")).all()

            # Check if there's a matching custom period
            for custom_price in custom_prices:
                # Custom periods might have metadata with hours info
                # For now, we'll use the price per hour calculation
                pass

            # If no exact match, calculate based on price per hour
            # Get price for 1 hour
            one_hour_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, period="1", project_id=project_id
            ).first()

            if one_hour_price:
                # Multiply by duration_hours
                price_per_hour = float(one_hour_price.price)
                return price_per_hour * duration_hours

            # If no pricing found, return 0 (free)
            self.logger.warning(
                f"No pricing found for product_id={product_id}, duration_hours={duration_hours}, project_id={project_id}"
            )
            return 0.0

        except Exception as e:
            self.logger.error(f"Error calculating key price: {str(e)}")
            return 0.0

    def get_key_price_for_reset(
        self, product_id: int, project_id: int
    ) -> float:
        """
        Get the price for resetting a key (typically 1 hour price)

        Args:
            product_id: Product ID
            project_id: Project ID

        Returns:
            Price in tokens (0.0 if no price found)
        """
        try:
            # Use 1 hour price for reset
            one_hour_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, period="1", project_id=project_id
            ).first()

            if one_hour_price:
                return float(one_hour_price.price)

            # If no 1 hour price, try to get any price and use it
            any_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, project_id=project_id
            ).first()

            if any_price:
                # If it's a period price, calculate per hour
                try:
                    period_hours = float(any_price.period)
                    if period_hours > 0:
                        price_per_hour = float(any_price.price) / period_hours
                        return price_per_hour
                except (ValueError, TypeError):
                    pass

            return 0.0

        except Exception as e:
            self.logger.error(f"Error getting reset price: {str(e)}")
            return 0.0

