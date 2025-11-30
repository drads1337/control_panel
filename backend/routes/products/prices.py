"""
Product Prices Routes
Handles price management for products
"""

import json

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Product, ProductKeyPrice, User
from ...schemas.price import CustomPriceCreateSchema, ProductPricesUpdateSchema
from ...utils.service_helpers import get_service
from ...utils.rbac_utils import RBACManager

prices_bp = Blueprint("products_prices", __name__)

def find_product_by_id_or_unique_id(product_identifier, project_id):
    """
    Helper function to find a product by either id (int) or unique_id (string)
    
    Args:
        product_identifier: Either an integer id or string unique_id
        project_id: Project ID to filter by
    
    Returns:
        Product object or None if not found
    """

    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
        except (ValueError, TypeError):
            pass
    

    product = Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()
    return product

@prices_bp.route("/<product_identifier>/prices", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_product_prices(product_identifier):
    """Get prices for a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        prices = ProductKeyPrice.query.filter_by(product_id=product.id, project_id=user.project_id).all()

        price_dict = {}
        for price in prices:
            if not price.period.startswith("custom_"):

                price_dict[price.period] = float(price.price) if price.price else 0.0

        return jsonify(
            {
                "success": True,
                "product_id": product.id,
                "prices": price_dict,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error fetching product prices: {str(e)}")
        return jsonify({"error": f"Failed to fetch prices: {str(e)}"}), 500

@validate_request(ProductPricesUpdateSchema)
@prices_bp.route("/<product_identifier>/prices", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_product_prices(product_identifier, validated_data=None):
    """Update prices for a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        activity_service = get_service('activity_service')
        product_service = get_service('product_service')
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(
        user.id, user.project_id, "products.manage_prices"
    )

    if not has_permission:
        return (
            jsonify(
                {
                    "error": "Permission denied. You do not have permission to manage product prices."
                }
            ),
            403,
        )

    try:

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        prices_data = validated_data.prices

        for period, price_value in prices_data.items():

            if period.startswith("custom_"):
                continue


            try:

                period_hours = int(period)
                if period_hours <= 0:
                    current_app.logger.warning(f"Invalid period (must be positive): {period}")
                    continue
            except (ValueError, TypeError):
                current_app.logger.warning(f"Invalid period format (expected hours as string): {period}")
                continue

            try:
                price_float = float(price_value) if price_value else 0.0
                if price_float < 0:
                    current_app.logger.warning(f"Negative price value for period {period}: {price_value}")
                    continue
            except (ValueError, TypeError):
                current_app.logger.warning(f"Invalid price value for period {period}: {price_value}")
                continue

            existing_price = ProductKeyPrice.query.filter_by(
                product_id=product.id, period=period, project_id=user.project_id
            ).first()

            if existing_price:
                existing_price.price = price_float
            else:
                new_price = ProductKeyPrice(
                    product_id=product.id,
                    period=period,
                    price=price_float,
                    project_id=user.project_id,
                )
                db.session.add(new_price)

        db.session.commit()

        product_service.invalidate_product_cache(user.project_id, product.id)

        activity_service.log_activity(
            user,
            "product_prices_updated",
            details=f"Updated prices for product: {product.id}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Prices updated successfully",
                "product_id": product.id,
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product prices: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update prices: {str(e)}"}), 500

@prices_bp.route("/<product_identifier>/custom-periods", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_custom_periods(product_identifier):
    """Get custom periods for a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        custom_prices = ProductKeyPrice.query.filter_by(
            product_id=product.id, project_id=user.project_id
        ).filter(ProductKeyPrice.period.like("custom_%")).all()

        custom_periods = []
        for price in custom_prices:
            custom_periods.append(
                {
                    "id": price.id,
                    "period": price.period,
                    "price": float(price.price) if price.price else 0.0,
                    "meta_data": json.loads(price.meta_data) if price.meta_data else None,
                }
            )

        return jsonify(
            {
                "success": True,
                "product_id": product.id,
                "custom_periods": custom_periods,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error fetching custom periods: {str(e)}")
        return jsonify({"error": f"Failed to fetch custom periods: {str(e)}"}), 500

@validate_request(CustomPriceCreateSchema)
@prices_bp.route("/<product_identifier>/custom-periods", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def add_custom_period(product_identifier, validated_data=None):
    """Add custom period for a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        activity_service = get_service('activity_service')
        product_service = get_service('product_service')
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(
        user.id, user.project_id, "products.manage_prices"
    )

    if not has_permission:
        return (
            jsonify(
                {
                    "error": "Permission denied. You do not have permission to manage product prices."
                }
            ),
            403,
        )

    try:

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        period_name = validated_data.period_name
        price_value = validated_data.price
        meta_data = validated_data.meta_data

        existing_price = ProductKeyPrice.query.filter_by(
            product_id=product.id, period=period_name, project_id=user.project_id
        ).first()

        if existing_price:
            return jsonify({"error": "Custom period already exists"}), 400

        price_float = float(price_value)

        new_price = ProductKeyPrice(
            product_id=product.id,
            period=period_name,
            price=price_float,
            meta_data=json.dumps(meta_data) if meta_data else None,
            project_id=user.project_id,
        )

        db.session.add(new_price)
        db.session.commit()

        product_service.invalidate_product_cache(user.project_id, product.id)

        activity_service.log_activity(
            user,
            "product_custom_period_added",
            details=f"Added custom period {period_name} for product: {product.id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Custom period added successfully",
                    "custom_period": {
                        "id": new_price.id,
                        "period": new_price.period,
                        "price": float(new_price.price) / 100 if new_price.price else 0.0,
                        "meta_data": json.loads(new_price.meta_data) if new_price.meta_data else None,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding custom period: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to add custom period: {str(e)}"}), 500

@prices_bp.route("/<product_identifier>/custom-periods/<custom_period_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def remove_custom_period(product_identifier, custom_period_id):
    """Remove custom period for a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        activity_service = get_service('activity_service')
        product_service = get_service('product_service')
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(
        user.id, user.project_id, "products.manage_prices"
    )

    if not has_permission:
        return (
            jsonify(
                {
                    "error": "Permission denied. You do not have permission to manage product prices."
                }
            ),
            403,
        )

    try:

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        custom_price = ProductKeyPrice.query.filter_by(
            id=custom_period_id, product_id=product.id, project_id=user.project_id
        ).first()

        if not custom_price:
            return jsonify({"error": "Custom period not found"}), 404

        if not custom_price.period.startswith("custom_"):
            return jsonify({"error": "Not a custom period"}), 400

        period_name = custom_price.period

        db.session.delete(custom_price)
        db.session.commit()

        product_service.invalidate_product_cache(user.project_id, product.id)

        activity_service.log_activity(
            user,
            "product_custom_period_removed",
            details=f"Removed custom period {period_name} for product: {product.id}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Custom period removed successfully",
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error removing custom period: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to remove custom period: {str(e)}"}), 500
