"""
Product Management Routes (formerly Product Management)
CRUD operations for products: create, read, update, delete
Universal terminology for B2B/SaaS applications
"""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from sqlalchemy import and_

from ...middleware.auth import enforce_project_scope, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Product, User
from ...models.agents import AgentProductAssignment
from ...schemas.product import ProductCreateSchema, ProductStatusUpdateSchema, ProductUpdateSchema
from ...services.activity import activity_service
from ...services.products import product_service
from ...services.rbac import rbac_service
from ...utils.rbac_utils import RBACManager

management_bp = Blueprint("products_management", __name__)

def find_product_by_id_or_unique_id(product_identifier, project_id):
    """
    Helper function to find a product by either id (int) or unique_id (string)
    
    Args:
        product_identifier: Either an integer id or string unique_id
        project_id: Project ID to filter by
    
    Returns:
        Product object or None if not found
    """
    # Try as integer id (primary key) first
    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
        except (ValueError, TypeError):
            pass
    
    # Try as unique_id (string)
    product = Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()
    return product

@management_bp.route("/count", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def get_products_count():
    """Get count of products (optimized endpoint that doesn't load full product data)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Allow users with clients.view permission to access products even if they don't have a project_id
    has_clients_view = rbac_service.check_permission(user.id, "clients.view")
    
    if not user.project_id and not has_clients_view:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from flask import g

    scoped_project_id = getattr(g, "project_id", user.project_id)
    if not scoped_project_id:
        if has_clients_view:
            return jsonify({"success": True, "count": 0})
        return jsonify({"error": "No project associated"}), 400

    try:
        product_type = request.args.get("type", "all")
        
        result = product_service.get_products_count(
            project_id=scoped_project_id, product_type=product_type, user_id=user_id
        )

        if result.get("success"):
            return jsonify(result)
        else:
            current_app.logger.error(f"Product service error: {result.get('error', 'Unknown error')}")
            return jsonify(result), 500

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error fetching product count: {str(e)}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch product count: {str(e)}"}), 500

@management_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def get_products():
    """Get list of products"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Allow users with clients.view permission to access products even if they don't have a project_id
    # This is needed when editing users
    has_clients_view = rbac_service.check_permission(user.id, "clients.view")
    
    if not user.project_id and not has_clients_view:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from flask import g

    scoped_project_id = getattr(g, "project_id", user.project_id)
    if not scoped_project_id:
        # If user has clients.view permission but no project_id, try to get project_id from request
        # This allows viewing products when editing users from different projects
        if has_clients_view:
            # For users with clients.view, we'll return an empty list if no project_id
            # The frontend should handle this gracefully
            return jsonify({"success": True, "products": [], "total_count": 0})
        return jsonify({"error": "No project associated"}), 400

    try:
        current_app.logger.info(f"=== GET_PRODUCTS CALLED (CACHED) ===")

        product_type = request.args.get("type", "all")
        current_app.logger.info(f"Filtering products by type: {product_type}")

        has_view_permission = rbac_service.check_permission(user.id, "products.view")

        result = product_service.get_products_cached(
            project_id=scoped_project_id, product_type=product_type, user_id=user_id
        )

        if result.get("success"):
            original_products = result.get("products", [])

            from ...models.core import UserProductPermission
            try:
                user_product_permissions = {
                    perm.product_id: perm.has_access
                    for perm in UserProductPermission.query.filter_by(user_id=user_id).all()
                }
            except Exception as perm_error:
                db.session.rollback()
                current_app.logger.warning(f"Transaction aborted, rolling back and retrying UserProductPermission query: {str(perm_error)}")
                user_product_permissions = {
                    perm.product_id: perm.has_access
                    for perm in UserProductPermission.query.filter_by(user_id=user_id).all()
                }

            from ...models.rbac import UserRole, Role
            try:
                user_roles = db.session.query(Role.name).join(
                    UserRole, Role.id == UserRole.role_id
                ).filter(UserRole.user_id == user_id).all()
                user_role_names = [role[0] for role in user_roles]
            except Exception as role_error:
                # If transaction is aborted, rollback and retry
                db.session.rollback()
                current_app.logger.warning(f"Transaction aborted, rolling back and retrying user roles query: {str(role_error)}")
                user_roles = db.session.query(Role.name).join(
                    UserRole, Role.id == UserRole.role_id
                ).filter(UserRole.user_id == user_id).all()
                user_role_names = [role[0] for role in user_roles]
            is_seller = 'seller' in user_role_names or any('seller' in str(role).lower() for role in user_role_names)

            current_app.logger.info(
                f"User {user_id} has {len(user_product_permissions)} UserProductPermission records. "
                f"Has global products.view: {has_view_permission}. "
                f"Is seller: {is_seller}. "
                f"Total products before filter: {len(original_products)}"
            )

            filtered_products = []
            for product in original_products:
                product_id = product.get("id")
                should_include = False

                if product_id in user_product_permissions:
                    should_include = user_product_permissions[product_id]
                else:

                    if is_seller:

                        should_include = False
                    elif not has_view_permission:

                        should_include = rbac_service.check_permission(user.id, "products.view", product_id=product_id)
                    else:

                        should_include = True

                if should_include:
                    filtered_products.append(product)

            current_app.logger.info(
                f"User {user_id}: Filtered {len(original_products)} products to {len(filtered_products)} products"
            )

            result["products"] = filtered_products
            result["total_count"] = len(filtered_products)

            return jsonify(result)
        else:
            current_app.logger.error(f"Product service error: {result.get('error', 'Unknown error')}")
            return jsonify(result), 500

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error fetching products: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch products: {str(e)}"}), 500

@management_bp.route("/available-for-assignment", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def get_available_products_for_assignment():
    """Get multi-app products that are not assigned to any agent, with pagination support"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from flask import g

    scoped_project_id = getattr(g, "project_id", user.project_id)
    if not scoped_project_id:
        return jsonify({"error": "No project associated"}), 400

    try:

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        per_page = max(1, min(100, per_page))
        page = max(1, page)

        assigned_product_ids = (
            db.session.query(AgentProductAssignment.product_id)
            .join(Product, AgentProductAssignment.product_id == Product.id)
            .filter(
                and_(
                    AgentProductAssignment.project_id == scoped_project_id,
                    Product.project_id == scoped_project_id,
                )
            )
            .distinct()
            .all()
        )
        assigned_product_ids_set = {product_id[0] for product_id in assigned_product_ids}

        base_query = Product.query.filter(
            and_(
                Product.project_id == scoped_project_id,
                Product.is_multi_app == True,
                ~Product.id.in_(assigned_product_ids_set) if assigned_product_ids_set else True,
            )
        )

        total_count = base_query.count()

        products = base_query.order_by(Product.name).offset((page - 1) * per_page).limit(per_page).all()

        products_data = []
        for product in products:
            products_data.append(
                {
                    "id": product.unique_id,
                    "name": product.name,
                    "description": product.description or "",
                    "status": product.status,
                    "logo": product.logo or "",
                    "version": product.version or "1.0.0",
                    "is_multi_app": product.is_multi_app,
                }
            )

        return jsonify(
            {
                "success": True,
                "products": products_data,
                "total_count": total_count,
                "page": page,
                "per_page": per_page,
                "total_pages": (total_count + per_page - 1) // per_page if per_page > 0 else 0,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error fetching available products for assignment: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch available products: {str(e)}"}), 500

@management_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(ProductCreateSchema)
def create_product(validated_data=None):
    """Create a new product"""
    current_app.logger.info("=== CREATE_PRODUCT ENDPOINT CALLED ===")

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.create")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to create products."}),
            403,
        )

    try:

        if not validated_data:
            return jsonify({"error": "Invalid request data"}), 400

        new_product, error_msg = product_service.create_product(user, validated_data)

        if not new_product:
            status_code = 409 if error_msg == "Product already exists" else 500
            return jsonify({"error": error_msg or "Failed to create product"}), status_code

        activity_service.log_activity(user, "product_created", details=f"Created product: {new_product.id}")

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Product created successfully",
                    "product": {
                        "id": new_product.unique_id,
                        "name": new_product.name,
                        "description": new_product.description,
                        "status": new_product.status,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        current_app.logger.error(f"Error creating product: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to create product"}), 500

@management_bp.route("/<product_identifier>/status", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(ProductStatusUpdateSchema)
def update_product_status(product_identifier, validated_data=None):
    """Update product status"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to edit products."}),
            403,
        )

    try:

        if not validated_data:
            return jsonify({"error": "Invalid request data"}), 400
        new_status = validated_data["status"]

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        old_status = product.status
        product.status = new_status
        db.session.commit()

        product_service.invalidate_product_cache(user.project_id, product.id)

        activity_service.log_activity(
            user,
            "product_status_updated",
            details=f"Updated product {product.name} (ID: {product.id}) status from {old_status} to {new_status}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Product status updated successfully",
                "product_id": product.id,
                "old_status": old_status,
                "new_status": new_status,
            }
        )

    except ValueError as e:

        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product status: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update product status: {str(e)}"}), 500

@management_bp.route("/<product_identifier>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(ProductUpdateSchema, allow_empty=True)
def update_product(product_identifier, validated_data=None):
    """Update a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to edit products."}),
            403,
        )

    try:

        if not validated_data:
            validated_data = {}

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        if "name" in validated_data and validated_data["name"] is not None:
            product.name = validated_data["name"]
        if "description" in validated_data and validated_data["description"] is not None:
            product.description = validated_data["description"]
        if "version" in validated_data and validated_data["version"] is not None:
            product.version = validated_data["version"]
        if "is_multi_app" in validated_data and validated_data["is_multi_app"] is not None:
            product.is_multi_app = validated_data["is_multi_app"]
        if "login_type" in validated_data and validated_data["login_type"] is not None:
            product.login_type = validated_data["login_type"]
        if "invite_code_required" in validated_data and validated_data["invite_code_required"] is not None:
            product.invite_code_required = validated_data["invite_code_required"]

        db.session.commit()

        product_service.invalidate_product_cache(user.project_id, product.id)

        activity_service.log_activity(
            user,
            "product_updated",
            details=f"Updated product {product.name} (ID: {product.id})",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Product updated successfully",
                "product": {
                    "id": product.unique_id,
                    "name": product.name,
                    "description": product.description,
                    "version": product.version,
                    "is_multi_app": product.is_multi_app,
                    "login_type": product.login_type,
                    "invite_code_required": product.invite_code_required,
                },
            }
        )

    except ValueError as e:

        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update product: {str(e)}"}), 500

@management_bp.route("/<product_identifier>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def delete_product(product_identifier):
    """Delete a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.delete")

    if not has_permission:
        has_permission = RBACManager.has_permission(user.id, user.project_id, "products.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to delete products."}),
            403,
        )

    try:

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        product_name = product.name
        product_id = product.id

        db.session.delete(product)
        db.session.commit()

        product_service.invalidate_product_cache(user.project_id, product_id)

        activity_service.log_activity(
            user,
            "product_deleted",
            details=f"Deleted product {product_name} (ID: {product_id})",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Product deleted successfully",
                "product_id": product_id,
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting product: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to delete product: {str(e)}"}), 500
