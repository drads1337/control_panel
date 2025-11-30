from ...utils.service_helpers import get_service
"""
User Products Routes
Handles user product permissions management
"""

import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ...core.extensions import db
from ...middleware.auth import (
    enforce_project_scope,
    require_project_isolation,
    require_project_with_grace_period,
    require_role,
    require_user,
)
from ...models import User
from ...models.core import UserProductPermission
from ...models.products import Product
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import RolePermissions

products_bp = Blueprint("users_products", __name__)
logger = logging.getLogger(__name__)

def find_user_by_id_or_unique_id(user_identifier, project_id=None):
    """
    Helper function to find a user by either id (int) or unique_id (string)
    
    Args:
        user_identifier: Either an integer id or string unique_id
        project_id: Optional project_id for additional filtering
    
    Returns:
        User object or None if not found
    """

    if isinstance(user_identifier, int) or (isinstance(user_identifier, str) and user_identifier.isdigit()):
        user = User.query.get(int(user_identifier))
        if user:
            if project_id is None or user.project_id == project_id:
                return user
    

    user = User.query.filter_by(unique_id=str(user_identifier)).first()
    if user:
        if project_id is None or user.project_id == project_id:
            return user
    
    return None

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

@products_bp.route("/<user_identifier>/products", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@require_project_isolation
def get_user_products(user_identifier, current_user):
    """
    Get products accessible by a specific user.
    
    Replaces legacy endpoint: GET /api/clients/<user_id>/products
    """
    logger.info(
        f"USER_PRODUCTS_GET: Request for user_id={user_identifier} by current_user_id={current_user.id} "
        f"(username={current_user.username}, project_id={current_user.project_id})"
    )


    target_user = find_user_by_id_or_unique_id(user_identifier, current_user.project_id)
    
    if not target_user:
        logger.error(
            f"USER_PRODUCTS_GET: User not found - user_id={user_identifier}. "
            f"Requested by current_user_id={current_user.id}"
        )
        return jsonify({"error": "User not found"}), 404

    logger.info(
        f"USER_PRODUCTS_GET: Target user found - user_id={user_identifier}, username={target_user.username}, "
        f"project_id={target_user.project_id}, current_user_project_id={current_user.project_id}"
    )


    if not target_user.project_id:
        logger.warning(
            f"USER_PRODUCTS_GET: User {user_identifier} (username={target_user.username}) has no project_id. "
            f"Returning empty products list."
        )
        return jsonify([])


    if target_user.project_id != current_user.project_id:
        logger.error(
            f"USER_PRODUCTS_GET: Project isolation violation - user_id={user_identifier} "
            f"(username={target_user.username}, project_id={target_user.project_id}) "
            f"belongs to different project than current_user_id={current_user.id} "
            f"(username={current_user.username}, project_id={current_user.project_id}). "
            f"Returning 404 to prevent information leakage."
        )
        return jsonify({"error": "User not found"}), 404

    try:
        project_products = Product.query.filter_by(project_id=target_user.project_id).all()

        if not project_products:
            return jsonify([])


        actual_user_id = target_user.id
        user_permissions = UserProductPermission.query.filter_by(user_id=actual_user_id).all()
        permission_map = {up.product_id: up.has_access for up in user_permissions}

        product_list = []
        for product in project_products:
            has_access = permission_map.get(product.id, False)

            product_list.append(
                {
                    "id": product.unique_id,
                    "product_id": product.unique_id,
                    "product_name": product.name,
                    "has_access": has_access,
                }
            )

        logger.info(
            f"USER_PRODUCTS_GET: Successfully retrieved {len(product_list)} products "
            f"for user_id={user_identifier} (username={target_user.username}, project_id={target_user.project_id})"
        )
        return jsonify(product_list)

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in get_user_products: {e}", exc_info=True)
        return jsonify({"error": "Failed to get user products"}), 500

@products_bp.route("/<user_identifier>/products/<product_identifier>/toggle", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.PRODUCT_MANAGEMENT_ROLES)
@require_project_isolation
def toggle_user_product_access(user_identifier, product_identifier, current_user):
    """
    Toggle user access to a specific product.
    
    Replaces legacy endpoint: POST /api/clients/<user_id>/products/<product_id>/toggle
    # Get services once at the start (DI pattern)
    activity_service = get_service('activity_service')
    cache_service = get_service('cache_service')
    rbac_service = get_service('rbac_service')
    """
    target_user = find_user_by_id_or_unique_id(user_identifier, current_user.project_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404


    product = find_product_by_id_or_unique_id(product_identifier, target_user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404


    if not rbac_service.check_permission(current_user.id, "clients.view"):
        if (
            current_user.project_id != target_user.project_id
            or current_user.project_id != product.project_id
        ):
            return jsonify({"error": "Access denied"}), 403

    try:

        actual_user_id = target_user.id
        actual_product_id = product.id
        user_product = UserProductPermission.query.filter_by(
            user_id=actual_user_id, product_id=actual_product_id
        ).first()

        if user_product:
            user_product.has_access = not user_product.has_access
            new_status = user_product.has_access
        else:
            user_product = UserProductPermission(
                user_id=actual_user_id,
                product_id=actual_product_id,
                has_access=True,
                project_id=target_user.project_id
            )
            db.session.add(user_product)
            new_status = True

        db.session.commit()

        try:

            product_service.invalidate_product_cache(target_user.project_id, actual_product_id)

            cache_service.invalidate_product_instantly(target_user.project_id, actual_product_id)

            all_user_product_cache_patterns = [
                f"products:project_id={target_user.project_id}:user_id=*:*",
                f"products:project_id={target_user.project_id}:type=all:user_id=*",
                f"products:project_id={target_user.project_id}:type=multi_app:user_id=*",
                f"products:project_id={target_user.project_id}:type=product_library:user_id=*",
            ]
            for pattern in all_user_product_cache_patterns:
                try:
                    deleted = cache_service.invalidate_pattern(pattern)
                    if deleted > 0:
                        logger.info(f"Invalidated {deleted} cache entries matching pattern: {pattern}")
                except Exception as pattern_error:
                    logger.warning(f"Failed to invalidate pattern {pattern}: {pattern_error}")

            logger.info(
                f"Invalidated product cache for project {target_user.project_id}, product {actual_product_id} "
                f"and ALL users after access change for user {actual_user_id}"
            )
        except Exception as cache_error:
            logger.warning(f"Failed to invalidate product cache: {cache_error}")

        action = "granted" if new_status else "revoked"
        activity_service.log_activity(
            current_user,
            "toggle_product_access",
            details=f'{action} access to product "{product.name}" for user {target_user.username} (ID: {target_user.id})',
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Product access {action} successfully",
                "user_id": actual_user_id,
                "product_id": actual_product_id,
                "product_name": product.name,
                "has_access": new_status,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in toggle_user_product_access: {e}", exc_info=True)
        return jsonify({"error": f"Failed to toggle product access: {str(e)}"}), 500

