"""
Client Management Routes
Handles client-specific operations and bulk client management
"""

import logging
from datetime import datetime

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func, select
from sqlalchemy.orm import joinedload

from ..core.extensions import db
from ..middleware.auth import (
    enforce_project_scope,
    require_permission,
    require_project_isolation,
    require_project_with_grace_period,
    require_role,
    require_user,
)
from ..models.core import DeveloperProductPermission, User, UserActivity, UserProductPermission
from ..models.keys import Key
from ..models.rbac import Role, UserRole

from ..services.activity import activity_service
from ..utils.fulltext_search import fulltext_search_filter
from ..utils.role_constants import RolePermissions

clients_bp = Blueprint("clients", __name__)

@clients_bp.route("", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_permission("clients.view")
def get_clients(current_user=None, project_id=None):
    """Get clients with optimized queries (fixes N+1 problem)"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search")
    status_filter = request.args.get("status")

    query = User.query.filter(
        User.id.in_(select(UserRole.user_id).join(Role).where(Role.name == "client"))
    )

    if current_user.project_id:
        query = query.filter(User.project_id == current_user.project_id)
    else:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if search:

        query = fulltext_search_filter(query, search, "search_vector")

    if status_filter == "active":
        query = query.filter((User.expires_at.is_(None)) | (User.expires_at > datetime.utcnow()))
    elif status_filter == "expired":
        query = query.filter(User.expires_at <= datetime.utcnow())

    query = query.order_by(User.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    clients = []
    for user in pagination.items:
        keys_count = user.total_keys or 0
        active_keys = user.active_keys or 0

        status = "active"
        if user.expires_at and user.expires_at <= datetime.utcnow():
            status = "expired"

        clients.append(
            {
                "id": user.unique_id,
                "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
                "username": user.username,
                "email": user.email,
                "phone": None,
                "status": status,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_activity": user.last_login.isoformat() if user.last_login else None,
                "total_orders": keys_count,
                "total_spent": user.token_balance or 0,
                "project": current_user.project.name if current_user.project else "Unknown",
                "keys_count": keys_count,
                "active_keys": active_keys,
                "last_ip": user.last_ip,
                "last_country": user.last_country,
                "last_city": user.last_city,
            }
        )

    return jsonify(
        {
            "clients": clients,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
            "per_page": per_page,
        }
    )

@clients_bp.route("/bulk-delete", methods=["POST"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_permission("clients.delete")
def bulk_delete_clients(current_user=None, project_id=None):
    """Bulk delete clients with filters"""

    if current_user is None:
        from flask import g
        current_user = g.current_user
    data = request.get_json()

    client_ids = data.get("client_ids", [])
    product_id = data.get("product_id")
    filters = data.get("filters", {})

    if not client_ids and not product_id and not filters:
        return jsonify({"error": "No selection criteria provided"}), 400

    try:

        query = User.query.filter(
            User.id.in_(select(UserRole.user_id).join(Role).where(Role.name == "client"))
        )

        if current_user.project_id:
            query = query.filter(User.project_id == current_user.project_id)
        else:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if client_ids:
            query = query.filter(User.id.in_(client_ids))

        if product_id:

            clients_with_product_keys = (
                db.session.query(User.id)
                .join(Key)
                .filter(
                    Key.product_id == product_id,
                    User.id.in_(select(UserRole.user_id).join(Role).where(Role.name == "client")),
                )
                .subquery()
            )
            query = query.filter(User.id.in_(clients_with_product_keys))

        if filters.get("status") == "active":
            query = query.filter(
                (User.expires_at.is_(None)) | (User.expires_at > datetime.utcnow())
            )
        elif filters.get("status") == "expired":
            query = query.filter(User.expires_at <= datetime.utcnow())

        if filters.get("search"):

            query = fulltext_search_filter(query, filters['search'], "search_vector")

        clients_to_delete = query.all()

        if not clients_to_delete:
            return jsonify({"message": "No clients found matching the criteria"}), 404

        deleted_count = 0
        deleted_clients = []

        for client in clients_to_delete:

            client.total_keys = 0
            client.active_keys = 0
            Key.query.filter_by(user_id=client.id).delete()
            UserProductPermission.query.filter_by(user_id=client.id).delete()
            DeveloperProductPermission.query.filter_by(user_id=client.id).delete()
            UserActivity.query.filter_by(user_id=client.id).delete()

            deleted_clients.append(
                {
                    "id": client.id,
                    "username": client.username,
                    "name": f"{client.first_name or ''} {client.last_name or ''}".strip()
                    or client.username,
                }
            )

            db.session.delete(client)
            deleted_count += 1

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "bulk_delete_clients",
            details=f"Deleted {deleted_count} clients",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully deleted {deleted_count} clients",
                "deleted_count": deleted_count,
                "deleted_clients": deleted_clients,
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete clients: {str(e)}"}), 500

@clients_bp.route("/<int:product_id>/classic-users", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.PRODUCT_MANAGEMENT_ROLES)
@require_project_isolation
def get_classic_users_for_product(product_id, current_user=None):
    """Get users who have permissions for a specific product"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    from ..models.products import Product

    product = Product.query.filter_by(id=product_id, project_id=current_user.project_id).first()
    if not product:
        return jsonify({"error": "Product not found"}), 404

    from ..services.rbac import rbac_service
    from ..utils.rbac_utils import RBACManager

    can_view_all = rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all and product.project_id != current_user.project_id:
        return jsonify({"error": "Access denied"}), 403

    user_permissions = (
        UserProductPermission.query.filter_by(product_id=product_id, project_id=product.project_id)
        .options(joinedload(UserProductPermission.user))
        .all()
    )

    users = []
    for permission in user_permissions:
        user = permission.user

        if not user or not user.project_id or user.project_id != current_user.project_id:
            continue

        users.append(
            {
                "id": user.unique_id,
                "username": user.username,
                "has_access": permission.has_access,
                "can_generate_keys": permission.can_generate_keys,
            }
        )

    return jsonify({"users": users, "product_id": product_id, "product_name": product.name})

@clients_bp.route("/<int:user_id>/products", methods=["GET"])
@clients_bp.route("/<int:user_id>/products", methods=["GET"])
@jwt_required()
@require_user
@require_permission("clients.view")
@require_project_isolation
def get_user_products(user_id, current_user=None):
    """Get products/products accessible by a specific user (supports both /products and /products endpoints)"""

    if current_user is None:
        from flask import g
        current_user = g.current_user
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ..services.rbac import rbac_service
    from ..utils.rbac_utils import RBACManager

    if not rbac_service.check_permission(current_user.id, "clients.view"):
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    try:
        from ..models.products import Product

        project_products = Product.query.filter_by(project_id=target_user.project_id).all()

        if not project_products:
            return jsonify([])

        user_permissions = UserProductPermission.query.filter_by(user_id=user_id).all()
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

        return jsonify(product_list)

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error in get_user_products: {e}")
        return jsonify([])

@clients_bp.route("/<int:user_id>/products/<int:product_id>/toggle", methods=["POST"])
@clients_bp.route("/<int:user_id>/products/<int:product_id>/toggle", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.PRODUCT_MANAGEMENT_ROLES)
@require_project_isolation
def toggle_user_product_access(user_id, product_id, current_user=None):
    """Toggle user access to a specific product/product (supports both /products and /products endpoints)"""

    if current_user is None:
        from flask import g
        current_user = g.current_user
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ..models.products import Product

    product = Product.query.filter_by(id=product_id, project_id=target_user.project_id).first()
    if not product:
        return jsonify({"error": "Product not found"}), 404

    from ..services.rbac import rbac_service
    from ..utils.rbac_utils import RBACManager

    if not rbac_service.check_permission(current_user.id, "clients.view"):
        if (
            current_user.project_id != target_user.project_id
            or current_user.project_id != product.project_id
        ):
            return jsonify({"error": "Access denied"}), 403

    try:
        user_product = UserProductPermission.query.filter_by(user_id=user_id, product_id=product_id).first()

        if user_product:
            user_product.has_access = not user_product.has_access
            new_status = user_product.has_access
        else:
            user_product = UserProductPermission(
                user_id=user_id, product_id=product_id, has_access=True, project_id=target_user.project_id
            )
            db.session.add(user_product)
            new_status = True

        db.session.commit()

        try:
            from ..services.cache import cache_service
            from ..services.products import product_service

            product_service.invalidate_product_cache(target_user.project_id, product_id)

            cache_service.invalidate_product_instantly(target_user.project_id, product_id)

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
                        logging.info(f"Invalidated {deleted} cache entries matching pattern: {pattern}")
                except Exception as pattern_error:
                    logging.warning(f"Failed to invalidate pattern {pattern}: {pattern_error}")

            logging.info(
                f"Invalidated product cache for project {target_user.project_id}, product {product_id} and ALL users after access change for user {user_id}"
            )
        except Exception as cache_error:
            logging.warning(f"Failed to invalidate product cache: {cache_error}")

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
                "user_id": user_id,
                "product_id": product_id,
                "product_name": product.name,
                "has_access": new_status,
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to toggle product access: {str(e)}"}), 500
