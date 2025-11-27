"""
Product Bulk Operations Routes
Handles bulk operations for products
"""

import logging
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import enforce_project_scope, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Product, User
from ...schemas.product import ProductBulkDeleteSchema, ProductBulkStatusUpdateSchema
from ...services.activity import activity_service
from ...services.products import product_service
from ...utils.rbac_utils import RBACManager

bulk_operations_bp = Blueprint("products_bulk", __name__)
logger = logging.getLogger(__name__)

@bulk_operations_bp.route("/bulk-status", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def bulk_update_product_status():
    """Bulk update product status"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        has_permission = RBACManager.has_permission(
            user.id, user.project_id, "products.edit"
        )

        if not has_permission:
            return (
                jsonify(
                    {
                        "error": "Permission denied. You do not have permission to edit products."
                    }
                ),
                403,
            )

        # Note: This endpoint will be migrated to use validate_request in next iteration
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        try:
            schema_data = ProductBulkStatusUpdateSchema(**data)
            product_ids = schema_data.product_ids
            new_status = schema_data.status
        except Exception as e:
            return jsonify({"error": f"Validation error: {str(e)}"}), 400

        products = Product.query.filter(
            Product.id.in_(product_ids),
            Product.project_id == user.project_id
        ).all()

        if not products:
            return jsonify({"message": "No products found or access denied"}), 200

        updated_count = 0
        product_names = []

        for product in products:
            old_status = product.status
            product.status = new_status
            product.is_active = new_status == "active"
            product_names.append(product.name)
            updated_count += 1

        db.session.commit()

        for product in products:
            product_service.invalidate_product_cache(user.project_id, product.id)

        activity_service.log_activity(
            user,
            "bulk_update_product_status",
            details=f"Updated status to '{new_status}' for {updated_count} products: {', '.join(product_names[:5])}{'...' if len(product_names) > 5 else ''}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": f"Successfully updated status for {updated_count} products",
                "updated_count": updated_count,
                "new_status": new_status,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk_update_product_status: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update product status: {str(e)}"}), 500

@bulk_operations_bp.route("/bulk-delete", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def bulk_delete_products():
    """Bulk delete products"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        has_permission = RBACManager.has_permission(
            user.id, user.project_id, "products.delete"
        )

        if not has_permission:
            has_permission = RBACManager.has_permission(
                user.id, user.project_id, "products.edit"
            )

        if not has_permission:
            return (
                jsonify(
                    {
                        "error": "Permission denied. You do not have permission to delete products."
                    }
                ),
                403,
            )

        # Note: This endpoint will be migrated to use validate_request in next iteration
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        try:
            schema_data = ProductBulkDeleteSchema(**data)
            product_ids = schema_data.product_ids
        except Exception as e:
            return jsonify({"error": f"Validation error: {str(e)}"}), 400

        products = Product.query.filter(
            Product.id.in_(product_ids),
            Product.project_id == user.project_id
        ).all()

        if not products:
            return jsonify({"message": "No products found or access denied"}), 200

        deleted_count = 0
        product_names = []
        product_ids_deleted = []

        for product in products:
            product_name = product.name
            product_id = product.id
            product_names.append(product_name)
            product_ids_deleted.append(product_id)

            db.session.delete(product)
            deleted_count += 1

        db.session.commit()

        for product_id in product_ids_deleted:
            product_service.invalidate_product_cache(user.project_id, product_id)

        activity_service.log_activity(
            user,
            "bulk_delete_products",
            details=f"Deleted {deleted_count} products: {', '.join(product_names[:5])}{'...' if len(product_names) > 5 else ''}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": f"Successfully deleted {deleted_count} products",
                "deleted_count": deleted_count,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk_delete_products: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to delete products: {str(e)}"}), 500
