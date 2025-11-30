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

            period_str = str(int(duration_hours))
            exact_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, period=period_str, project_id=project_id
            ).first()

            if exact_price:
                return float(exact_price.price)


            custom_prices = ProductKeyPrice.query.filter_by(
                product_id=product_id, project_id=project_id
            ).filter(ProductKeyPrice.period.like("custom_%")).all()


            for custom_price in custom_prices:


                pass



            one_hour_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, period="1", project_id=project_id
            ).first()

            if one_hour_price:

                price_per_hour = float(one_hour_price.price)
                return price_per_hour * duration_hours


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

            one_hour_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, period="1", project_id=project_id
            ).first()

            if one_hour_price:
                return float(one_hour_price.price)


            any_price = ProductKeyPrice.query.filter_by(
                product_id=product_id, project_id=project_id
            ).first()

            if any_price:

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

