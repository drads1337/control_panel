"""
Bulk Operations Routes for Keys
Handles bulk operations like bulk delete, bulk reset, bulk pause/resume, etc.
"""

import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...schemas.key import (
    KeyBulkActionSchema,
    KeyBulkCreateSchema,
    KeyBulkFilterActionSchema,
    KeyBulkFilterExtendSchema,
    KeyBulkProductActionSchema,
    KeyBulkProductExtendSchema,
    KeyBulkExtendSchema,
)
from ...utils.service_helpers import get_service

bulk_operations_bp = Blueprint("keys_bulk", __name__)

@validate_request(KeyBulkCreateSchema)
@bulk_operations_bp.route("/bulk", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_create_keys(current_user, project_id=None, validated_data=None):
    """Bulk create keys - uses async tasks for large operations"""
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"🔑 Bulk create keys request - Origin: {request.headers.get('Origin')}")

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    product_id = validated_data.get("product_id")
    count = validated_data.get("count")
    duration_hours = validated_data.get("duration_hours")
    max_devices = validated_data.get("max_devices")

    # Get product service
    product_service = get_service('product_service')

    # Exceptions are handled by global handler
    product = product_service.get_product(current_user, product_id)

    is_access_code = product.login_type == "classic_login"
    item_type = "access codes" if is_access_code else "license keys"

    # Temporarily use synchronous method for all counts to debug
    # Set to very high number to force async, or 0 to disable async
    ASYNC_THRESHOLD = 10000  # Effectively disable async for now

    if count <= ASYNC_THRESHOLD:

        # Use product.id (actual database ID) instead of product_id (which might be unique_id)
        key_bulk_operations_service = get_service('key_bulk_operations_service')
        created_count, error_message, created_keys = key_bulk_operations_service.bulk_create_keys(
            user=current_user,
            count=count,
            product_id=product.id,  # Use actual product.id
            duration_hours=duration_hours,
            max_devices=max_devices,
        )

        if error_message and created_count == 0:
            return jsonify({"error": error_message}), 400

        try:
            from ...routes.files import clear_storage_cache

            clear_storage_cache(current_user.project_id)
        except ImportError:
            pass

        activity_service = get_service('activity_service')
        activity_service.log_activity(
            current_user,
            "bulk_create_keys",
            details=f"Created {created_count} production {item_type} for product: {product.name}",
            ip=request.remote_addr,
        )

        response_data = {
            "message": f"Successfully created {created_count} {item_type}",
            "summary": {
                "count": created_count,
                "product_name": product.name,
                "duration_hours": duration_hours,
                "max_devices": max_devices,
            },
        }

        if error_message:
            response_data["warning"] = error_message

        return (
            jsonify(response_data),
            201,
        )
    else:

        try:
            from ...tasks.key_tasks import bulk_create_keys_task

            # Use product.id (actual database ID) instead of product_id (which might be unique_id)
            actual_product_id = product.id
            
            # Get task service
            task_service = get_service('task_service')
            
            task_id = task_service.create_task(
                task_type="bulk_create_keys",
                task_data={
                    "count": count,
                    "product_id": actual_product_id,
                    "product_name": product.name,
                    "duration_hours": duration_hours,
                    "max_devices": max_devices,
                },
                user_id=current_user.id,
                project_id=current_user.project_id,
            )

            bulk_create_keys_task.apply_async(
                args=[
                    current_user.id,
                    count,
                    actual_product_id,  # Use actual product.id
                    duration_hours,
                    max_devices,
                ],
                kwargs={
                    "task_id": task_id,
                    "project_id": current_user.project_id,
                    "remote_addr": request.remote_addr,
                },
            )

            logger.info(f"🔑 Queued bulk create keys task: {task_id} for {count} keys")

            return (
                jsonify(
                    {
                        "message": f"Bulk creation of {count} {item_type} started",
                        "task_id": task_id,
                        "status": "pending",
                        "summary": {
                            "count": count,
                            "product_name": product.name,
                            "duration_hours": duration_hours,
                            "max_devices": max_devices,
                        },
                    }
                ),
                202,
            )
        except ImportError:

            logger.warning("Celery not available, falling back to synchronous execution")

            return jsonify({"error": "Async task processing not available"}), 503
        except Exception as e:
            logger.error(f"Failed to queue async task: {str(e)}")
            return jsonify({"error": f"Failed to start bulk creation: {str(e)}"}), 500

@validate_request(KeyBulkActionSchema)
@bulk_operations_bp.route("/bulk/delete", methods=["POST"])
@bulk_operations_bp.route("", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_delete_keys(current_user, project_id=None, validated_data=None):
    """Bulk delete keys"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    key_ids = validated_data.get("key_ids")

    deleted_count, error = key_bulk_operations_service.bulk_delete_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    try:
        from ...routes.files import clear_storage_cache

        clear_storage_cache(current_user.project_id)
    except ImportError:
        pass

    activity_service = get_service('activity_service')
    activity_service.log_activity(
        current_user, "bulk_delete_keys", details=f"Deleted {deleted_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully deleted {deleted_count} keys"})

@validate_request(KeyBulkActionSchema)
@bulk_operations_bp.route("/bulk_reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_reset_keys(current_user, project_id=None, validated_data=None):
    """Bulk reset keys"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    key_ids = validated_data.get("key_ids")

    affected_count, error = key_bulk_operations_service.bulk_reset_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if affected_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    activity_service.log_activity(
        current_user, "bulk_reset_keys", details=f"Reset {affected_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully reset {affected_count} keys"})

@validate_request(KeyBulkActionSchema)
@bulk_operations_bp.route("/bulk/pause", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_pause_keys(current_user, project_id=None, validated_data=None):
    """Bulk pause keys"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    key_ids = validated_data.get("key_ids")

    affected_count, error = key_bulk_operations_service.bulk_pause_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if affected_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    activity_service.log_activity(
        current_user, "bulk_pause_keys", details=f"Paused {affected_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully paused {affected_count} keys"})

@bulk_operations_bp.route("/bulk/resume", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_resume_keys(current_user, project_id=None):
    """Bulk resume keys"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    key_ids = data.get("key_ids", [])

    if not key_ids:
        return jsonify({"error": "key_ids is required"}), 400

    affected_count, error = key_bulk_operations_service.bulk_resume_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if affected_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    activity_service.log_activity(
        current_user, "bulk_resume_keys", details=f"Resumed {affected_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully resumed {affected_count} keys"})

@validate_request(KeyBulkExtendSchema)
@bulk_operations_bp.route("/bulk/add_hours", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_add_hours(current_user, project_id=None, validated_data=None):
    """Bulk add hours to keys"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    key_ids = validated_data.get("key_ids")
    hours = validated_data.get("hours")

    affected_count, error = key_bulk_operations_service.bulk_extend_keys(current_user, key_ids, hours)

    if error:
        return jsonify({"error": error}), 500

    if affected_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_add_hours",
        details=f"Added {hours} hours to {affected_count} keys",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully added {hours} hours to {affected_count} keys"})

@validate_request(KeyBulkProductActionSchema)
@bulk_operations_bp.route("/bulk/pause/by_product", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_pause_keys_by_product(current_user, project_id=None, validated_data=None):
    """Bulk pause keys by product"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    product_id = validated_data.get("product_id")

    affected_count, error, product_name = key_bulk_operations_service.bulk_pause_keys_by_product(current_user, product_id)

    if error:
        return jsonify({"error": error}), 500 if error != "Product not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this product"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_pause_keys_by_product",
        details=f"Paused {affected_count} keys for product: {product_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully paused {affected_count} keys for product: {product_name}"})

@validate_request(KeyBulkProductActionSchema)
@bulk_operations_bp.route("/bulk/resume/by_product", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_resume_keys_by_product(current_user, project_id=None, validated_data=None):
    """Bulk resume keys by product"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    product_id = validated_data.get("product_id")

    affected_count, error, product_name = key_bulk_operations_service.bulk_resume_keys_by_product(current_user, product_id)

    if error:
        return jsonify({"error": error}), 500 if error != "Product not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this product"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_resume_keys_by_product",
        details=f"Resumed {affected_count} keys for product: {product_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully resumed {affected_count} keys for product: {product_name}"})

@validate_request(KeyBulkProductActionSchema)
@bulk_operations_bp.route("/bulk/reset/by_product", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_reset_keys_by_product(current_user, project_id=None, validated_data=None):
    """Bulk reset keys by product"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    product_id = validated_data.get("product_id")

    affected_count, error, product_name = key_bulk_operations_service.bulk_reset_keys_by_product(current_user, product_id)

    if error:
        return jsonify({"error": error}), 500 if error != "Product not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this product"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_reset_keys_by_product",
        details=f"Reset {affected_count} keys for product: {product_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully reset {affected_count} keys for product: {product_name}"})

@bulk_operations_bp.route("/bulk/addHours/by_product", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_add_hours_by_product(current_user, project_id=None):
    """Bulk add hours to keys by product"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    product_id = data.get("product_id")
    hours = data.get("hours", 0)

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400

    if hours <= 0:
        return jsonify({"error": "hours must be positive"}), 400

    affected_count, error, product_name = key_bulk_operations_service.bulk_add_hours_by_product(
        current_user, product_id, hours
    )

    if error:
        return jsonify({"error": error}), 500 if error != "Product not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this product"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_add_hours_by_product",
        details=f"Added {hours} hours to {affected_count} keys for product: {product_name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": f"Successfully added {hours} hours to {affected_count} keys for product: {product_name}"
        }
    )

@validate_request(KeyBulkFilterActionSchema)
@bulk_operations_bp.route("/bulk/deleteByFilters", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_delete_keys_by_filters(current_user, project_id=None, validated_data=None):
    """Bulk delete keys by filters"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    filters = validated_data

    deleted_count, error = key_bulk_operations_service.bulk_delete_keys_by_filters(current_user, filters)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No keys found matching the criteria"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_delete_keys_by_filters",
        details=f"Deleted {deleted_count} keys by filters",
        ip=request.remote_addr,
    )

    return jsonify(
        {"message": f"Successfully deleted {deleted_count} keys", "deleted_count": deleted_count}
    )

@bulk_operations_bp.route("/bulk/resetByFilters", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_reset_keys_by_filters(current_user, project_id=None):
    """Bulk reset keys by filters"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()

    reset_count, error = key_bulk_operations_service.bulk_reset_keys_by_filters(current_user, data)

    if error:
        return jsonify({"error": error}), 500

    if reset_count == 0:
        return jsonify({"message": "No keys found matching the criteria"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_reset_keys_by_filters",
        details=f"Reset {reset_count} keys by filters",
        ip=request.remote_addr,
    )

    return jsonify(
        {"message": f"Successfully reset {reset_count} keys", "reset_count": reset_count}
    )

@validate_request(KeyBulkFilterExtendSchema)
@bulk_operations_bp.route("/bulk/extendByFilters", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_extend_keys_by_filters(current_user, project_id=None, validated_data=None):
    """Bulk extend keys by filters"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    filters = validated_data.get("filters") or validated_data
    hours = validated_data.get("hours")

    extended_count, error = key_bulk_operations_service.bulk_extend_keys_by_filters(current_user, filters, hours)

    if error:
        return jsonify({"error": error}), 500

    if extended_count == 0:
        return jsonify({"message": "No keys found matching the criteria"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_extend_keys_by_filters",
        details=f"Extended {extended_count} keys by filters",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": f"Successfully extended {extended_count} keys",
            "extended_count": extended_count,
        }
    )
