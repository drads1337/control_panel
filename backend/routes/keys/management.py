"""
Key Management Routes
CRUD operations for keys: create, read, update, delete
"""

import json
import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Product, Key, User
from ...schemas.key import KeyCreateSchema, KeyExtendSchema, KeyMoveSchema, KeyUpdateSchema, CustomKeyCreateSchema
from ...services.activity import activity_service
from ...services.keys.key_crud_service import key_crud_service
from ...services.keys.key_generation_service import key_generation_service
from ...services.rbac import rbac_service
from ...utils.data_masking import mask_license_key
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from .common import can_manage_key

management_bp = Blueprint("keys_management", __name__)

def find_key_by_id_or_unique_id(key_identifier, project_id):
    """
    Helper function to find a key by either id (int) or unique_id (string)
    
    Args:
        key_identifier: Either an integer id or string unique_id
        project_id: Project ID to filter by
        
    Returns:
        Key object or None
    """
    # Try as integer id first
    try:
        key_id = int(key_identifier)
        key = Key.query.filter_by(id=key_id, project_id=project_id).first()
        if key:
            return key
    except (ValueError, TypeError):
        pass
    
    # Try as unique_id (string)
    key = Key.query.filter_by(unique_id=str(key_identifier), project_id=project_id).first()
    return key

@management_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_keys(current_user, project_id=None):
    """Get list of keys with filtering and pagination"""
    import logging
    logger = logging.getLogger(__name__)

    if not current_user:
        return jsonify({"error": "Access denied"}), 403

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    my_keys = request.args.get("my_keys", "false").lower() == "true"
    
    # Get status filter, but ignore if it's "all"
    status_arg = request.args.get("status")
    status_filter = None if (status_arg is None or status_arg.lower() == "all") else status_arg
    
    filters = {
        "page": request.args.get("page", 1, type=int),
        "per_page": request.args.get("per_page", 20, type=int),
        "status": status_filter,
        "product_id": request.args.get("product_id", type=int),
        "search": request.args.get("search"),
        "my_keys": my_keys,
    }

    logger.info(
        f"🔑 GET /api/keys - user_id={current_user.id}, project_id={current_user.project_id}, "
        f"filters={filters}, query_params={dict(request.args)}"
    )

    if filters["product_id"]:
        product = Product.query.filter_by(id=filters["product_id"], project_id=current_user.project_id).first()
        if not product:
            logger.warning(f"❌ Product {filters['product_id']} not found for project {current_user.project_id}")
            return jsonify({"error": "Product not found or access denied"}), 404

    result, error = key_crud_service.get_keys(current_user, filters)
    if error:
        return jsonify({"error": error}), 500
    if not result:
        keys = []
        total_count = 0
    else:
        # Convert KeyListResponse to legacy format
        keys = [key.model_dump() for key in result.keys]
        total_count = result.total
    
    logger.info(
        f"✅ GET /api/keys response - keys_count={len(keys)}, total_count={total_count}, "
        f"page={filters['page']}, per_page={filters['per_page']}"
    )

    page = filters["page"]
    per_page = filters["per_page"]
    
    # Ensure pages is at least 1 even when total is 0 (for proper pagination UI)
    if total_count == 0:
        pages = 0
    else:
        pages = (total_count + per_page - 1) // per_page

    # Ensure keys is always a list
    if keys is None:
        keys = []

    return jsonify(
        {
            "keys": keys,
            "total": total_count,
            "pages": pages,
            "current_page": page,
            "per_page": per_page,
        }
    )

@management_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyCreateSchema)
def create_key(current_user, project_id=None, validated_data=None):
    """Create a new key"""
    logger = logging.getLogger(__name__)
    logger.info(f"🔑 Create key request - Origin: {request.headers.get('Origin')}")

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(current_user)
    is_owner = user_roles and user_roles[0] == UserRoles.OWNER.value

    if not is_owner and not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()

    key_data = {
        "product_id": data.get("product_id"),
        "duration_hours": data.get("duration_hours", 24),
        "max_devices": data.get("max_devices", 1),
        "length": data.get("length", 32),
    }

    product = None
    if data.get("product_id"):
        from ...services.products import product_service
        product, error = product_service.get_product(current_user, data["product_id"])
        if error or not product:
            return jsonify({"error": error or "Product not found or access denied"}), 404

        is_access_code = product.login_type == "classic_login"
        generation_type = "access_code" if is_access_code else "license_key"

        key_metadata = {
            "type": "production",
            "generation_type": generation_type,
            "created_by": current_user.id,
            "created_by_role": (
                RBACManager.get_user_role_names(current_user)[0]
                if RBACManager.get_user_role_names(current_user)
                else "client"
            ),
        }
        key_data["key_metadata"] = json.dumps(key_metadata)

    if not product:
        return jsonify({"error": "Product ID is required"}), 400

    key, error = key_crud_service.create_key(current_user, key_data)
    if error:
        logger.error(f"🔑 Failed to create key: {error}")
        return jsonify({"error": error}), 500

    if not key:
        return jsonify({"error": "Failed to create key"}), 500

    logger.info(f"🔑 Key {key.id} created and committed")

    try:
        from ...routes.files import clear_storage_cache
        clear_storage_cache(current_user.project_id)
    except ImportError:
        pass

    product = Product.query.get(key.product_id)
    if not product:
        logger.error(f"🔑 Product not found for key {key.id}, product_id: {key.product_id}")
        return jsonify({"error": "Product not found"}), 404

    is_access_code = product.login_type == "classic_login"
    item_type = "access code" if is_access_code else "license key"
    generation_type = "access_code" if is_access_code else "license_key"

    response_data = {
        "message": f"{item_type.title()} created successfully",
        "key": {
            "id": key.unique_id,
            "key": key.key,
            "product_id": key.product_id,
            "product_name": product.name,
            "expires_at": key.expires_at.isoformat() if key.expires_at else None,
            "max_devices": key.max_devices,
            "duration_hours": key.duration_hours,
            "created_at": key.created_at.isoformat(),
            "generation_type": generation_type,
            "is_access_code": is_access_code,
        },
    }

    logger.info(f"🔑 Returning success response for key {key.id}, user {current_user.id}")

    try:
        activity_service.log_activity(
            current_user,
            "create_key",
            details=f"Created production {item_type}: {key.key[:8]}... for product: {product.name}",
            ip=request.remote_addr,
        )
    except Exception as e:
        logger.error(f"🔑 Failed to log activity (non-critical): {str(e)}")

    return jsonify(response_data), 201

@management_bp.route("/custom", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(CustomKeyCreateSchema)
def create_custom_key(current_user, project_id=None, validated_data=None):
    """Create a custom key with a specified key string"""
    logger = logging.getLogger(__name__)
    logger.info(f"🔑 Create custom key request - Origin: {request.headers.get('Origin')}")

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(current_user)
    is_owner = user_roles and user_roles[0] == UserRoles.OWNER.value

    if not is_owner and not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()

    custom_key = data.get("custom_key", "").strip()
    product_id = data.get("product_id")
    duration_hours = data.get("duration_hours", 24)
    max_devices = data.get("max_devices", 1)

    # Check if key already exists
    if current_user.project_id:
        existing_key = Key.query.filter_by(key=custom_key, project_id=current_user.project_id).first()
    else:
        # For owners without project_id, check across all projects
        existing_key = Key.query.filter_by(key=custom_key).first()
    
    if existing_key:
        return jsonify({"error": "Key already exists"}), 400

    # Get product
    from ...services.products import product_service
    product, error = product_service.get_product(current_user, product_id)
    if error or not product:
        return jsonify({"error": error or "Product not found or access denied"}), 404

    is_access_code = product.login_type == "classic_login"
    generation_type = "access_code" if is_access_code else "license_key"

    # Calculate expiration
    expires_at = None
    if duration_hours:
        expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

    # Determine project_id for the key
    key_project_id = current_user.project_id
    if not key_project_id and is_owner:
        # For owners, use the product's project_id
        key_project_id = product.project_id

    # Create the key
    key_metadata = {
        "type": "custom",
        "generation_type": generation_type,
        "created_by": current_user.id,
        "created_by_role": (
            RBACManager.get_user_role_names(current_user)[0]
            if RBACManager.get_user_role_names(current_user)
            else "client"
        ),
        "is_custom": True,
    }

    try:
        key = Key(
            key=custom_key,
            user_id=current_user.id,
            product_id=product.id,
            status=1,
            max_devices=max_devices,
            duration_hours=duration_hours,
            expires_at=expires_at,
            project_id=key_project_id,
            key_metadata=json.dumps(key_metadata),
            created_at=datetime.utcnow(),
        )

        db.session.add(key)
        db.session.commit()

        logger.info(f"🔑 Custom key {key.id} created and committed")

        try:
            from ...routes.files import clear_storage_cache
            if key_project_id:
                clear_storage_cache(key_project_id)
        except ImportError:
            pass

        item_type = "access code" if is_access_code else "license key"

        response_data = {
            "message": f"Custom {item_type.title()} created successfully",
            "key": {
                "id": key.unique_id,
                "key": key.key,
                "product_id": key.product_id,
                "product_name": product.name,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "max_devices": key.max_devices,
                "duration_hours": key.duration_hours,
                "created_at": key.created_at.isoformat(),
                "generation_type": generation_type,
                "is_access_code": is_access_code,
            },
        }

        logger.info(f"🔑 Returning success response for custom key {key.id}, user {current_user.id}")

        try:
            activity_service.log_activity(
                current_user,
                "create_custom_key",
                details=f"Created custom {item_type}: {key.key[:8]}... for product: {product.name}",
                ip=request.remote_addr,
            )
        except Exception as e:
            logger.error(f"🔑 Failed to log activity (non-critical): {str(e)}")

        return jsonify(response_data), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"🔑 Failed to create custom key: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to create custom key: {str(e)}"}), 500

@management_bp.route("/<key_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyUpdateSchema)
def update_key(key_id, current_user, project_id=None, validated_data=None):
    """Update a key"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)
    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.edit"):
        return jsonify({"error": "You do not have permission to edit this key"}), 403

    key, error = key_crud_service.update_key(current_user, key.id, data)
    if error:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        current_user,
        "update_key",
        details=f'Updated key: {key.key[:8]}... (max_devices: {key.max_devices}, duration: {data.get("duration", "unchanged")}h)',
        ip=request.remote_addr,
    )

    return jsonify({"message": "Key updated successfully"})

@management_bp.route("/<key_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_key(key_id, current_user, project_id=None):
    """Delete a key"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    logger = logging.getLogger(__name__)
    logger.info(
        f"Delete key request: key_id={key_id}, user_id={current_user.id}, user_project_id={current_user.project_id}"
    )

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)
    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.delete"):
        return jsonify({"error": "You do not have permission to delete this key"}), 403

    success, error = key_crud_service.delete_key(current_user, key.id)
    if not success:
        return jsonify({"error": error}), 500

    try:
        from ...routes.files import clear_storage_cache
        clear_storage_cache(current_user.project_id)
    except ImportError:
        pass

    activity_service.log_activity(
        current_user, "delete_key", details=f"Deleted key: {key.key[:8]}...", ip=request.remote_addr
    )

    return jsonify({"message": "Key deleted successfully"})

@management_bp.route("/<key_id>/reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def reset_key(key_id, current_user, project_id=None):
    """Reset a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.reset_pc_binding"):
        return jsonify({"error": "You do not have permission to reset this key"}), 403

    try:
        key.devices = ""
        key.fingerprint = None
        key.activated_at = None

        from ...models import DeviceInfo

        DeviceInfo.query.filter_by(key_id=key.id).delete()

        db.session.commit()

        activity_service.log_activity(
            current_user, "reset_key", details=f"Reset key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key reset successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to reset key: {str(e)}"}), 500

@management_bp.route("/<key_id>/pause", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def pause_key(key_id, current_user, project_id=None):
    """Pause a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.pause_resume"):
        return jsonify({"error": "You do not have permission to pause this key"}), 403

    try:
        old_status = key.status
        key.status = 3

        from ...utils.key_counters import update_user_key_counters_on_status_change
        update_user_key_counters_on_status_change(key.user_id, old_status, 3)

        if key.project_id:
            from ...utils.project_counters import update_project_key_counters_on_status_change
            update_project_key_counters_on_status_change(key.project_id, old_status, 3)

        db.session.commit()

        activity_service.log_activity(
            current_user, "pause_key", details=f"Paused key: {key.key[:8]}...", ip=request.remote_addr
        )

        # Return updated key data for immediate UI update
        is_expired = False  # Paused keys are not expired
        is_active = False  # Paused keys are not active
        
        return jsonify({
            "message": "Key paused successfully",
            "key": {
                "id": key.unique_id,
                "status": key.status,
                "is_active": is_active,
                "is_expired": is_expired,
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to pause key: {str(e)}"}), 500

@management_bp.route("/<key_id>/resume", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def resume_key(key_id, current_user, project_id=None):
    """Resume a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.pause_resume"):
        return jsonify({"error": "You do not have permission to resume this key"}), 403

    try:
        old_status = key.status
        key.status = 1

        from ...utils.key_counters import update_user_key_counters_on_status_change
        update_user_key_counters_on_status_change(key.user_id, old_status, 1)

        if key.project_id:
            from ...utils.project_counters import update_project_key_counters_on_status_change
            update_project_key_counters_on_status_change(key.project_id, old_status, 1)

        db.session.commit()

        activity_service.log_activity(
            current_user, "resume_key", details=f"Resumed key: {key.key[:8]}...", ip=request.remote_addr
        )

        # Return updated key data for immediate UI update
        is_expired = key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow()
        is_active = key.status == 1 and (not key.expires_at or not is_expired)
        
        return jsonify({
            "message": "Key resumed successfully",
            "key": {
                "id": key.unique_id,
                "status": key.status,
                "is_active": is_active,
                "is_expired": is_expired,
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to resume key: {str(e)}"}), 500

@management_bp.route("/<key_id>/extend", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyExtendSchema)
def extend_key(key_id, current_user, project_id=None, validated_data=None):
    """Extend a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    hours = data.get("hours", 0) if data else 0

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.extend"):
        return jsonify({"error": "You do not have permission to extend this key"}), 403

    try:
        if key.expires_at:
            key.expires_at += timedelta(hours=hours)
        else:
            key.expires_at = datetime.utcnow() + timedelta(hours=hours)

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "extend_key",
            details=f"Extended key: {key.key[:8]}... by {hours} hours",
            ip=request.remote_addr,
        )

        return jsonify({"message": f"Key extended by {hours} hours"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to extend key: {str(e)}"}), 500

@management_bp.route("/<key_id>/duplicate", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def duplicate_key(key_id, current_user, project_id=None):
    """Duplicate a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        product = Product.query.get(key.product_id) if key.product_id else None

        if not product:
            return jsonify({"error": "Product not found"}), 404

        new_key_string = key_generation_service.generate_key_string(
            length=32, product=product, duration_hours=key.duration_hours, project_id=current_user.project_id
        )

        duplicate_key = Key(
            key=new_key_string,
            user_id=key.user_id,
            product_id=key.product_id,
            expires_at=key.expires_at,
            max_devices=key.max_devices,
            duration_hours=key.duration_hours,
            status=key.status,
            project_id=key.project_id,
            key_metadata=key.key_metadata,
        )

        db.session.add(duplicate_key)
        db.session.commit()

        activity_service.log_activity(
            current_user,
            "duplicate_key",
            details=f"Duplicated key: {key.key[:8]}...",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": "Key duplicated successfully",
                    "key": {
                        "id": duplicate_key.unique_id,
                        "key": duplicate_key.key,
                        "product_id": duplicate_key.product_id,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to duplicate key: {str(e)}"}), 500

@management_bp.route("/<key_id>/move", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyMoveSchema)
def move_key(key_id, current_user, project_id=None, validated_data=None):
    """Move a key to another user"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    new_user_id = data.get("user_id")

    if not new_user_id:
        return jsonify({"error": "user_id is required"}), 400

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    new_user = User.query.filter_by(id=new_user_id, project_id=current_user.project_id).first()
    if not new_user:
        return jsonify({"error": "Target user not found"}), 404

    try:
        old_user_id = key.user_id
        key.user_id = new_user_id
        db.session.commit()

        activity_service.log_activity(
            current_user,
            "move_key",
            details=f"Moved key: {key.key[:8]}... from user {old_user_id} to {new_user_id}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Key moved successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to move key: {str(e)}"}), 500

@management_bp.route("/<key_id>/block", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def block_key(key_id, current_user, project_id=None):
    """Block a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.block_unblock"):
        return jsonify({"error": "You do not have permission to block this key"}), 403

    try:
        old_status = key.status
        logger = logging.getLogger(__name__)
        
        # If key is already blocked (status = 2), unblock it instead
        if old_status == 2:
            key.status = 1  # Unblock: set to active
            
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)
            
            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 1)
            
            db.session.commit()
            
            activity_service.log_activity(
                current_user, "unblock_key", details=f"Unblocked key: {key.key[:8]}...", ip=request.remote_addr
            )
            
            # Return updated key data for immediate UI update
            is_expired = key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow()
            is_active = key.status == 1 and (not key.expires_at or not is_expired)
            
            return jsonify({
                "message": "Key unblocked successfully",
                "key": {
                    "id": key.unique_id,
                    "status": key.status,
                    "is_active": is_active,
                    "is_expired": is_expired,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                }
            })
        else:
            # Block the key
            key.status = 2

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 2)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 2)

            db.session.commit()

            activity_service.log_activity(
                current_user, "block_key", details=f"Blocked key: {key.key[:8]}...", ip=request.remote_addr
            )

            # Return updated key data for immediate UI update
            # Blocked keys (status = 2) are never expired, regardless of expires_at
            is_expired = False  # Blocked keys are not expired
            is_active = False  # Blocked keys are not active
            
            return jsonify({
                "message": "Key blocked successfully",
                "key": {
                    "id": key.unique_id,
                    "status": key.status,
                    "is_active": is_active,
                    "is_expired": is_expired,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                }
            })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to block key: {str(e)}"}), 500

@management_bp.route("/<key_id>/unblock", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def unblock_key(key_id, current_user, project_id=None):
    """Unblock a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.block_unblock"):
        return jsonify({"error": "You do not have permission to unblock this key"}), 403

    try:
        old_status = key.status
        key.status = 1

        from ...utils.key_counters import update_user_key_counters_on_status_change
        update_user_key_counters_on_status_change(key.user_id, old_status, 1)

        if key.project_id:
            from ...utils.project_counters import update_project_key_counters_on_status_change
            update_project_key_counters_on_status_change(key.project_id, old_status, 1)

        db.session.commit()

        activity_service.log_activity(
            current_user, "unblock_key", details=f"Unblocked key: {key.key[:8]}...", ip=request.remote_addr
        )

        # Return updated key data for immediate UI update
        is_expired = key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow()
        is_active = key.status == 1 and (not key.expires_at or not is_expired)
        
        return jsonify({
            "message": "Key unblocked successfully",
            "key": {
                "id": key.unique_id,
                "status": key.status,
                "is_active": is_active,
                "is_expired": is_expired,
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to unblock key: {str(e)}"}), 500

@management_bp.route("/<key_id>/archive", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def archive_key(key_id, current_user, project_id=None):
    """Archive a key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        old_status = key.status
        key.status = 4

        from ...utils.key_counters import update_user_key_counters_on_status_change
        update_user_key_counters_on_status_change(key.user_id, old_status, 4)

        if key.project_id:
            from ...utils.project_counters import update_project_key_counters_on_status_change
            update_project_key_counters_on_status_change(key.project_id, old_status, 4)

        db.session.commit()

        activity_service.log_activity(
            current_user, "archive_key", details=f"Archived key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key archived successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to archive key: {str(e)}"}), 500

@management_bp.route("/<key_id>/restore", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def restore_key(key_id, current_user, project_id=None):
    """Restore an archived key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        old_status = key.status
        key.status = 1

        from ...utils.key_counters import update_user_key_counters_on_status_change
        update_user_key_counters_on_status_change(key.user_id, old_status, 1)

        if key.project_id:
            from ...utils.project_counters import update_project_key_counters_on_status_change
            update_project_key_counters_on_status_change(key.project_id, old_status, 1)

        db.session.commit()

        activity_service.log_activity(
            current_user, "restore_key", details=f"Restored key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key restored successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to restore key: {str(e)}"}), 500

@management_bp.route("/<key_id>/export", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def export_key(key_id, current_user, project_id=None):
    """Export a single key"""
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        product = (
            Product.query.filter_by(id=key.product_id, project_id=current_user.project_id).first()
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
            "is_expired": key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow(),
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

        activity_service.log_activity(
            current_user, "export_key", details=f"Exported key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify(
            {
                "message": "Key exported successfully",
                "download_url": f"/api/keys/{key_id}/download",
                "data": export_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to export key: {str(e)}"}), 500

@management_bp.route("/<key_id>/download", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def download_key(key_id, current_user, project_id=None):
    """Download a key as JSON file

    SECURITY: Requires keys.view permission to download full key.
    Users without permission will receive a masked key.
    """
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        from flask import make_response

        can_download_full_key = RBACManager.is_owner(current_user) or RBACManager.is_admin(current_user)

        if not can_download_full_key:

            is_own_key = key.user_id == current_user.id
            if is_own_key:

                can_download_full_key = rbac_service.check_permission(current_user.id, "keys.view")
            else:

                can_download_full_key = rbac_service.check_permission(current_user.id, "keys.view")

        key_value = key.key if can_download_full_key else mask_license_key(key.key)

        product = (
            Product.query.filter_by(id=key.product_id, project_id=current_user.project_id).first()
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
            "is_expired": key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow(),
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

        response = make_response(json.dumps(export_data, indent=2, ensure_ascii=False))
        response.headers["Content-Type"] = "product/json"
        response.headers["Content-Disposition"] = f"attachment; filename=key_{key_id}.json"

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download key: {str(e)}"}), 500

@management_bp.route("/<key_id>/details", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_key_details(key_id, current_user, project_id=None):
    """Get detailed information about a key

    SECURITY: By default, keys are masked. Full keys are only returned if:
    - User has keys.view permission, OR
    - User is owner/admin, OR
    - It's the user's own key and they have keys.view permission

    This endpoint uses a more lenient rate limit (60/min) to allow users
    to view multiple keys in quick succession without hitting rate limits.
    """
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        product = (
            Product.query.filter_by(id=key.product_id, project_id=current_user.project_id).first()
            if key.product_id
            else None
        )

        from ...models import DeviceInfo

        devices = DeviceInfo.query.filter_by(key_id=key.id).all()
        logging.info(f"GET_KEY_DETAILS key_id={key_id} found {len(devices)} devices")
        devices_data = [
            {
                "id": device.id,
                "device_id": device.device_id,
                "device_model": device.device_model,
                "device_brand": device.device_brand,
                "serial": device.serial,
                "ip_address": device.ip_address,
                "user_agent": device.user_agent,
                "connected_at": device.connected_at.isoformat() if device.connected_at else None,
                "last_seen": device.last_seen.isoformat() if device.last_seen else None,
            }
            for device in devices
        ]

        can_view_full_key = RBACManager.is_owner(current_user) or RBACManager.is_admin(current_user)

        if not can_view_full_key:

            is_own_key = key.user_id == current_user.id
            if is_own_key:

                can_view_full_key = rbac_service.check_permission(current_user.id, "keys.view")
            else:

                can_view_full_key = rbac_service.check_permission(current_user.id, "keys.view")

        key_value = key.key if can_view_full_key else mask_license_key(key.key)

        key_data = {
            "id": key.unique_id,
            "key": key_value,
            "key_masked": not can_view_full_key,
            "product_id": key.product_id,
            "product_name": product.name if product else None,
            "status": key.status,
            "is_active": key.status == 1
            and (not key.expires_at or key.expires_at > datetime.utcnow()),
            "is_expired": key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow(),
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

        return jsonify({"key": key_data, "devices": devices_data, "usage_history": []})

    except Exception as e:
        return jsonify({"error": f"Failed to get key details: {str(e)}"}), 500

@management_bp.route("/<key_id>/reveal", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def reveal_key(key_id, current_user, project_id=None):
    """Reveal full license key

    SECURITY: This endpoint requires keys.see_analytics or keys.copy permission to reveal full keys.
    This is a security measure to prevent mass data leakage. Users must explicitly
    request to reveal a key, and the request is logged for audit purposes.

    Returns:
        Full key value if user has permission, otherwise returns masked key.
    """
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = find_key_by_id_or_unique_id(key_id, current_user.project_id)

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:

        can_reveal_key = RBACManager.is_owner(current_user) or RBACManager.is_admin(current_user)

        if not can_reveal_key:

            is_own_key = key.user_id == current_user.id
            if is_own_key:

                can_reveal_key = (
                    rbac_service.check_permission(current_user.id, "keys.see_analytics") or
                    rbac_service.check_permission(current_user.id, "keys.copy")
                )
            else:

                can_reveal_key = (
                    rbac_service.check_permission(current_user.id, "keys.see_analytics") or
                    rbac_service.check_permission(current_user.id, "keys.copy")
                )

        if not can_reveal_key:

            logging.warning(
                f"🚫 Unauthorized key reveal attempt: user_id={current_user.id}, key_id={key_id}, "
                f"key_owner={key.user_id}, has_keys_see_analytics={rbac_service.check_permission(current_user.id, 'keys.see_analytics')}, "
                f"has_keys_copy={rbac_service.check_permission(current_user.id, 'keys.copy')}"
            )
            return jsonify({
                "error": "Insufficient permissions to reveal key",
                "key": mask_license_key(key.key),
                "key_masked": True
            }), 403

        logging.info(
            f"🔓 Key revealed: user_id={current_user.id}, key_id={key_id}, "
            f"key_owner={key.user_id}, is_own_key={key.user_id == current_user.id}"
        )

        return jsonify({
            "key": key.key,
            "key_masked": False,
            "id": key.unique_id
        })

    except Exception as e:
        logging.error(f"Failed to reveal key {key_id}: {str(e)}")
        return jsonify({"error": f"Failed to reveal key: {str(e)}"}), 500
