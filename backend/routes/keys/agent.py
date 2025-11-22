"""
Agent Keys Routes
Handles operations related to agent keys
"""

import json
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Product, Key, Agent, User
from ...schemas.key import (
    BulkAddHoursSchema,
    BulkLoaderKeyActionSchema,
    BulkLoaderKeyCreateSchema,
    CustomLoaderKeyCreateSchema,
    LoaderKeyCreateSchema,
)
from ...services.activity import activity_service
from ...services.keys.key_service_facade import key_service
from ...utils.rbac_utils import RBACManager

loader_bp = Blueprint("keys_loader", __name__)

@loader_bp.route("/agent", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(LoaderKeyCreateSchema)
def create_loader_key(current_user=None, project_id=None, validated_data=None):
    """Create a agent key"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()

    duration_hours = data.get("duration_hours", 24)
    max_devices = data.get("max_devices", 1)
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    products = Product.query.filter(Product.id.in_(product_ids), Product.project_id == current_user.project_id).all()
    if len(products) != len(product_ids):
        return jsonify({"error": "Some products not found or access denied"}), 404

    unified_key_string = key_service.generate_key_string(
        32, agent=agent, duration_hours=duration_hours, project_id=current_user.project_id
    )

    created_keys = []

    try:
        from ...models import Key

        for product in products:
            key = Key(
                key=unified_key_string,
                user_id=None,
                product_id=product.id,
                agent_id=agent_id,
                status=1,
                max_devices=max_devices,
                duration_hours=duration_hours,
                expires_at=None,
                project_id=current_user.project_id,
                created_at=datetime.utcnow(),
            )

            key_metadata = {
                "type": "agent",
                "created_by": current_user.id,
                "created_by_role": (
                    RBACManager.get_user_role_names(current_user)[0]
                    if RBACManager.get_user_role_names(current_user)
                    else "client"
                ),
                "agent_id": agent_id,
                "product_ids": product_ids,
            }
            key.key_metadata = json.dumps(key_metadata)

            db.session.add(key)
            created_keys.append(
                {
                    "id": key.unique_id,
                    "key": key.key,
                    "product_id": key.product_id,
                    "product_name": product.name,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                    "max_devices": key.max_devices,
                    "duration_hours": key.duration_hours,
                    "created_at": key.created_at.isoformat(),
                }
            )

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "create_agent_key",
            details=f"Created agent key: {unified_key_string[:8]}... for {len(products)} products via agent: {agent.name}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": f"Successfully created agent key for {len(products)} products",
                    "key": unified_key_string,
                    "products": [{"id": product.unique_id, "name": product.name} for product in products],
                    "expires_at": None,
                    "max_devices": max_devices,
                    "duration_hours": duration_hours,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create agent key: {str(e)}"}), 500

@loader_bp.route("/agent/custom", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(CustomLoaderKeyCreateSchema)
def create_custom_loader_key(current_user=None, project_id=None, validated_data=None):
    """Create a custom agent key"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()

    custom_key = data.get("custom_key", "").strip()
    duration_hours = data.get("duration_hours", 24)
    max_devices = data.get("max_devices", 1)
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    from ...models import Key

    existing_key = Key.query.filter_by(key=custom_key, project_id=current_user.project_id).first()
    if existing_key:
        return jsonify({"error": "Key already exists"}), 400

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    products = Product.query.filter(Product.id.in_(product_ids), Product.project_id == current_user.project_id).all()
    if len(products) != len(product_ids):
        return jsonify({"error": "Some products not found or access denied"}), 404

    created_keys = []

    try:
        for product in products:
            key = Key(
                key=custom_key,
                user_id=None,
                product_id=product.id,
                agent_id=agent_id,
                status=1,
                max_devices=max_devices,
                duration_hours=duration_hours,
                expires_at=None,
                project_id=current_user.project_id,
                created_at=datetime.utcnow(),
            )

            key_metadata = {
                "type": "custom_agent",
                "created_by": current_user.id,
                "created_by_role": (
                    RBACManager.get_user_role_names(current_user)[0]
                    if RBACManager.get_user_role_names(current_user)
                    else "client"
                ),
                "agent_id": agent_id,
                "product_ids": product_ids,
                "is_custom": True,
            }
            key.key_metadata = json.dumps(key_metadata)

            db.session.add(key)
            created_keys.append(
                {
                    "id": key.unique_id,
                    "key": key.key,
                    "product_id": key.product_id,
                    "product_name": product.name,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                    "max_devices": key.max_devices,
                    "duration_hours": key.duration_hours,
                    "created_at": key.created_at.isoformat(),
                }
            )

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "create_custom_agent_key",
            details=f"Created custom agent key: {custom_key[:8]}... for {len(products)} products via agent: {agent.name}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": f"Successfully created custom agent key for {len(products)} products",
                    "key": custom_key,
                    "products": [{"id": product.unique_id, "name": product.name} for product in products],
                    "expires_at": None,
                    "max_devices": max_devices,
                    "duration_hours": duration_hours,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create custom agent key: {str(e)}"}), 500

@loader_bp.route("/bulk/agent", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyCreateSchema)
def bulk_create_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk create agent keys - uses async tasks for large operations"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()

    count = data.get("count", 1)
    duration_hours = data.get("duration_hours", 24)
    max_devices = data.get("max_devices", 1)
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    products = Product.query.filter(Product.id.in_(product_ids), Product.project_id == current_user.project_id).all()
    if len(products) != len(product_ids):
        return jsonify({"error": "Some products not found or access denied"}), 404

    ASYNC_THRESHOLD = 10

    if count <= ASYNC_THRESHOLD:

        created_keys = []

        try:
            from ...models import Key

            for i in range(count):
                key_string = key_service.generate_key_string(
                    length=32, agent=agent, duration_hours=duration_hours, project_id=current_user.project_id
                )

                for product in products:
                    key = Key(
                        key=key_string,
                        user_id=None,
                        product_id=product.id,
                        agent_id=agent_id,
                        status=1,
                        max_devices=max_devices,
                        duration_hours=duration_hours,
                        expires_at=None,
                        project_id=current_user.project_id,
                        created_at=datetime.utcnow(),
                    )

                    key_metadata = {
                        "type": "loader_bulk",
                        "created_by": current_user.id,
                        "created_by_role": (
                            RBACManager.get_user_role_names(current_user)[0]
                            if RBACManager.get_user_role_names(current_user)
                            else "client"
                        ),
                        "agent_id": agent_id,
                        "product_ids": product_ids,
                        "batch_id": f'loader_batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}_{i}',
                    }
                    key.key_metadata = json.dumps(key_metadata)

                    db.session.add(key)
                    created_keys.append(key_string)

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_create_agent_keys",
                details=f"Created {count} agent keys for {len(products)} products via agent: {agent.name}",
                ip=request.remote_addr,
            )

            return (
                jsonify(
                    {
                        "message": f"Successfully created {count} agent keys for {len(products)} products",
                        "keys": list(set(created_keys)),
                        "summary": {
                            "count": count,
                            "products_count": len(products),
                            "agent_name": agent.name,
                            "duration_hours": duration_hours,
                            "max_devices": max_devices,
                        },
                    }
                ),
                201,
            )

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to create agent keys: {str(e)}"}), 500
    else:

        try:
            from ...services.tasks import task_service
            from ...tasks.key_tasks import bulk_create_loader_keys_task

            task_id = task_service.create_task(
                task_type="bulk_create_loader_keys",
                task_data={
                    "count": count,
                    "agent_id": agent_id,
                    "agent_name": agent.name,
                    "product_ids": product_ids,
                    "duration_hours": duration_hours,
                    "max_devices": max_devices,
                },
                user_id=current_user.id,
                project_id=current_user.project_id,
            )

            bulk_create_loader_keys_task.apply_async(
                args=[
                    current_user.id,
                    count,
                    agent_id,
                    product_ids,
                    duration_hours,
                    max_devices,
                ],
                kwargs={
                    "task_id": task_id,
                    "project_id": current_user.project_id,
                    "remote_addr": request.remote_addr,
                },
            )

            import logging

            logger = logging.getLogger(__name__)
            logger.info(f"🔑 Queued bulk create agent keys task: {task_id} for {count} keys")

            return (
                jsonify(
                    {
                        "message": f"Bulk creation of {count} agent keys started",
                        "task_id": task_id,
                        "status": "pending",
                        "summary": {
                            "count": count,
                            "products_count": len(products),
                            "agent_name": agent.name,
                            "duration_hours": duration_hours,
                            "max_devices": max_devices,
                        },
                    }
                ),
                202,
            )
        except ImportError:

            import logging

            logger = logging.getLogger(__name__)
            logger.warning("Celery not available, falling back to synchronous execution")
            return jsonify({"error": "Async task processing not available"}), 503
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Failed to queue async task: {str(e)}")
            return jsonify({"error": f"Failed to start bulk creation: {str(e)}"}), 500

@loader_bp.route("/bulk/agent/pause", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_pause_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk pause agent keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.product_id.in_(product_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified products"}), 200

    try:

        affected_user_ids = set()
        for key in keys:
            if key.user_id:
                affected_user_ids.add(key.user_id)
            key.status = 0

        db.session.commit()

        from ...utils.key_counters import update_user_key_counters
        for user_id in affected_user_ids:
            update_user_key_counters(user_id, project_id=current_user.project_id)
        db.session.commit()

        activity_service.log_activity(
            current_user,
            "bulk_pause_agent_keys",
            details=f"Paused {len(keys)} keys for {len(product_ids)} products via agent: {agent.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Successfully paused {len(keys)} keys for {len(product_ids)} products"}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to pause keys: {str(e)}"}), 500

@loader_bp.route("/bulk/agent/resume", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_resume_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk resume agent keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.product_id.in_(product_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified products"}), 200

    try:

        affected_user_ids = set()
        for key in keys:
            if key.user_id:
                affected_user_ids.add(key.user_id)
            key.status = 1

        db.session.commit()

        from ...utils.key_counters import update_user_key_counters
        for user_id in affected_user_ids:
            update_user_key_counters(user_id, project_id=current_user.project_id)
        db.session.commit()

        activity_service.log_activity(
            current_user,
            "bulk_resume_agent_keys",
            details=f"Resumed {len(keys)} keys for {len(product_ids)} products via agent: {agent.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Successfully resumed {len(keys)} keys for {len(product_ids)} products"}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to resume keys: {str(e)}"}), 500

@loader_bp.route("/bulk/agent/reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_reset_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk reset agent keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.product_id.in_(product_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified products"}), 200

    try:
        for key in keys:
            key.devices = ""
            if hasattr(key, "device_count"):
                key.device_count = 0

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "bulk_reset_loader_keys",
            details=f"Reset {len(keys)} keys for {len(product_ids)} products via agent: {agent.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Successfully reset {len(keys)} keys for {len(product_ids)} products"}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to reset keys: {str(e)}"}), 500

@loader_bp.route("/bulk/agent/addHours", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkAddHoursSchema)
def bulk_add_hours_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk add hours to agent keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])
    hours = data.get("hours", 0)

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.product_id.in_(product_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified products"}), 200

    try:
        for key in keys:
            if key.expires_at:
                key.expires_at += timedelta(hours=hours)
            else:
                key.expires_at = datetime.utcnow() + timedelta(hours=hours)

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "bulk_add_hours_loader_keys",
            details=f"Added {hours} hours to {len(keys)} keys for {len(product_ids)} products via agent: {agent.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully added {hours} hours to {len(keys)} keys for {len(product_ids)} products"
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to add hours: {str(e)}"}), 500

@loader_bp.route("/bulk/agent/deleteUnused", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_delete_unused_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk delete unused agent keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    deleted_count, error = key_service.bulk_delete_unused_loader_keys(current_user, agent_id)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No unused keys found for the specified products"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_delete_unused_loader_keys",
        details=f"Deleted {deleted_count} unused keys for {len(product_ids)} products via agent: {agent.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {"message": f"Successfully deleted {deleted_count} unused keys for {len(product_ids)} products"}
    )

@loader_bp.route("/bulk/agent/deleteExpired", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_delete_expired_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk delete expired agent keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    agent_id = data.get("agent_id")
    product_ids = data.get("product_ids", [])

    agent = Agent.query.filter_by(id=agent_id, project_id=current_user.project_id).first()
    if not agent:
        return jsonify({"error": "Agent not found or access denied"}), 404

    deleted_count, error = key_service.bulk_delete_expired_loader_keys(current_user, agent_id)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No expired keys found for the specified products"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_delete_expired_loader_keys",
        details=f"Deleted {deleted_count} expired keys for {len(product_ids)} products via agent: {agent.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {"message": f"Successfully deleted {deleted_count} expired keys for {len(product_ids)} products"}
    )
