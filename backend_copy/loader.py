"""
Loader Keys Routes
Handles operations related to loader keys
"""

import json
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Game, Key, Loader, User
from ...schemas.key import (
    BulkAddHoursSchema,
    BulkLoaderKeyActionSchema,
    BulkLoaderKeyCreateSchema,
    CustomLoaderKeyCreateSchema,
    LoaderKeyCreateSchema,
)
from ...services.activity import activity_service
from ...services.keys import key_service
from ...utils.rbac_utils import RBACManager

loader_bp = Blueprint("keys_loader", __name__)

@loader_bp.route("/loader", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(LoaderKeyCreateSchema)
def create_loader_key(current_user=None, project_id=None, validated_data=None):
    """Create a loader key"""

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
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    games = Game.query.filter(Game.id.in_(game_ids), Game.project_id == current_user.project_id).all()
    if len(games) != len(game_ids):
        return jsonify({"error": "Some games not found or access denied"}), 404

    unified_key_string = key_service.generate_key_string(
        32, loader=loader, duration_hours=duration_hours, project_id=current_user.project_id
    )

    created_keys = []

    try:
        from ...models import Key

        for game in games:
            key = Key(
                key=unified_key_string,
                user_id=None,
                game_id=game.id,
                status=1,
                max_devices=max_devices,
                duration_hours=duration_hours,
                expires_at=None,
                project_id=current_user.project_id,
                created_at=datetime.utcnow(),
            )

            key_metadata = {
                "type": "loader",
                "created_by": current_user.id,
                "created_by_role": (
                    RBACManager.get_user_role_names(current_user)[0]
                    if RBACManager.get_user_role_names(current_user)
                    else "client"
                ),
                "loader_id": loader_id,
                "game_ids": game_ids,
            }
            key.key_metadata = json.dumps(key_metadata)

            db.session.add(key)
            created_keys.append(
                {
                    "id": key.id,
                    "key": key.key,
                    "game_id": key.game_id,
                    "game_name": game.name,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                    "max_devices": key.max_devices,
                    "duration_hours": key.duration_hours,
                    "created_at": key.created_at.isoformat(),
                }
            )

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "create_loader_key",
            details=f"Created loader key: {unified_key_string[:8]}... for {len(games)} games via loader: {loader.name}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": f"Successfully created loader key for {len(games)} games",
                    "key": unified_key_string,
                    "games": [{"id": game.id, "name": game.name} for game in games],
                    "expires_at": None,
                    "max_devices": max_devices,
                    "duration_hours": duration_hours,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create loader key: {str(e)}"}), 500

@loader_bp.route("/loader/custom", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(CustomLoaderKeyCreateSchema)
def create_custom_loader_key(current_user=None, project_id=None, validated_data=None):
    """Create a custom loader key"""

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
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    from ...models import Key

    existing_key = Key.query.filter_by(key=custom_key, project_id=current_user.project_id).first()
    if existing_key:
        return jsonify({"error": "Key already exists"}), 400

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    games = Game.query.filter(Game.id.in_(game_ids), Game.project_id == current_user.project_id).all()
    if len(games) != len(game_ids):
        return jsonify({"error": "Some games not found or access denied"}), 404

    created_keys = []

    try:
        for game in games:
            key = Key(
                key=custom_key,
                user_id=None,
                game_id=game.id,
                status=1,
                max_devices=max_devices,
                duration_hours=duration_hours,
                expires_at=None,
                project_id=current_user.project_id,
                created_at=datetime.utcnow(),
            )

            key_metadata = {
                "type": "custom_loader",
                "created_by": current_user.id,
                "created_by_role": (
                    RBACManager.get_user_role_names(current_user)[0]
                    if RBACManager.get_user_role_names(current_user)
                    else "client"
                ),
                "loader_id": loader_id,
                "game_ids": game_ids,
                "is_custom": True,
            }
            key.key_metadata = json.dumps(key_metadata)

            db.session.add(key)
            created_keys.append(
                {
                    "id": key.id,
                    "key": key.key,
                    "game_id": key.game_id,
                    "game_name": game.name,
                    "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                    "max_devices": key.max_devices,
                    "duration_hours": key.duration_hours,
                    "created_at": key.created_at.isoformat(),
                }
            )

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "create_custom_loader_key",
            details=f"Created custom loader key: {custom_key[:8]}... for {len(games)} games via loader: {loader.name}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": f"Successfully created custom loader key for {len(games)} games",
                    "key": custom_key,
                    "games": [{"id": game.id, "name": game.name} for game in games],
                    "expires_at": None,
                    "max_devices": max_devices,
                    "duration_hours": duration_hours,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create custom loader key: {str(e)}"}), 500

@loader_bp.route("/bulk/loader", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyCreateSchema)
def bulk_create_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk create loader keys - uses async tasks for large operations"""

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
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    games = Game.query.filter(Game.id.in_(game_ids), Game.project_id == current_user.project_id).all()
    if len(games) != len(game_ids):
        return jsonify({"error": "Some games not found or access denied"}), 404

    ASYNC_THRESHOLD = 10

    if count <= ASYNC_THRESHOLD:

        created_keys = []

        try:
            from ...models import Key

            for i in range(count):
                key_string = key_service.generate_key_string(
                    length=32, loader=loader, duration_hours=duration_hours, project_id=current_user.project_id
                )

                for game in games:
                    key = Key(
                        key=key_string,
                        user_id=None,
                        game_id=game.id,
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
                        "loader_id": loader_id,
                        "game_ids": game_ids,
                        "batch_id": f'loader_batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}_{i}',
                    }
                    key.key_metadata = json.dumps(key_metadata)

                    db.session.add(key)
                    created_keys.append(key_string)

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_create_loader_keys",
                details=f"Created {count} loader keys for {len(games)} games via loader: {loader.name}",
                ip=request.remote_addr,
            )

            return (
                jsonify(
                    {
                        "message": f"Successfully created {count} loader keys for {len(games)} games",
                        "keys": list(set(created_keys)),
                        "summary": {
                            "count": count,
                            "games_count": len(games),
                            "loader_name": loader.name,
                            "duration_hours": duration_hours,
                            "max_devices": max_devices,
                        },
                    }
                ),
                201,
            )

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to create loader keys: {str(e)}"}), 500
    else:

        try:
            from ...services.tasks import task_service
            from ...tasks.key_tasks import bulk_create_loader_keys_task

            task_id = task_service.create_task(
                task_type="bulk_create_loader_keys",
                task_data={
                    "count": count,
                    "loader_id": loader_id,
                    "loader_name": loader.name,
                    "game_ids": game_ids,
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
                    loader_id,
                    game_ids,
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
            logger.info(f"🔑 Queued bulk create loader keys task: {task_id} for {count} keys")

            return (
                jsonify(
                    {
                        "message": f"Bulk creation of {count} loader keys started",
                        "task_id": task_id,
                        "status": "pending",
                        "summary": {
                            "count": count,
                            "games_count": len(games),
                            "loader_name": loader.name,
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

@loader_bp.route("/bulk/loader/pause", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_pause_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk pause loader keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.game_id.in_(game_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified games"}), 200

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
            "bulk_pause_loader_keys",
            details=f"Paused {len(keys)} keys for {len(game_ids)} games via loader: {loader.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Successfully paused {len(keys)} keys for {len(game_ids)} games"}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to pause keys: {str(e)}"}), 500

@loader_bp.route("/bulk/loader/resume", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_resume_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk resume loader keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.game_id.in_(game_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified games"}), 200

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
            "bulk_resume_loader_keys",
            details=f"Resumed {len(keys)} keys for {len(game_ids)} games via loader: {loader.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Successfully resumed {len(keys)} keys for {len(game_ids)} games"}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to resume keys: {str(e)}"}), 500

@loader_bp.route("/bulk/loader/reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_reset_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk reset loader keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.game_id.in_(game_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified games"}), 200

    try:
        for key in keys:
            key.devices = ""
            if hasattr(key, "device_count"):
                key.device_count = 0

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "bulk_reset_loader_keys",
            details=f"Reset {len(keys)} keys for {len(game_ids)} games via loader: {loader.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Successfully reset {len(keys)} keys for {len(game_ids)} games"}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to reset keys: {str(e)}"}), 500

@loader_bp.route("/bulk/loader/addHours", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkAddHoursSchema)
def bulk_add_hours_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk add hours to loader keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])
    hours = data.get("hours", 0)

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    from ...models import Key

    keys = Key.query.filter(Key.game_id.in_(game_ids), Key.project_id == current_user.project_id).all()

    if not keys:
        return jsonify({"message": "No keys found for the specified games"}), 200

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
            details=f"Added {hours} hours to {len(keys)} keys for {len(game_ids)} games via loader: {loader.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully added {hours} hours to {len(keys)} keys for {len(game_ids)} games"
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to add hours: {str(e)}"}), 500

@loader_bp.route("/bulk/loader/deleteUnused", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_delete_unused_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk delete unused loader keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    deleted_count, error = key_service.bulk_delete_unused_loader_keys(current_user, loader_id)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No unused keys found for the specified games"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_delete_unused_loader_keys",
        details=f"Deleted {deleted_count} unused keys for {len(game_ids)} games via loader: {loader.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {"message": f"Successfully deleted {deleted_count} unused keys for {len(game_ids)} games"}
    )

@loader_bp.route("/bulk/loader/deleteExpired", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(BulkLoaderKeyActionSchema)
def bulk_delete_expired_loader_keys(current_user=None, project_id=None, validated_data=None):
    """Bulk delete expired loader keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    loader_id = data.get("loader_id")
    game_ids = data.get("game_ids", [])

    loader = Loader.query.filter_by(id=loader_id, project_id=current_user.project_id).first()
    if not loader:
        return jsonify({"error": "Loader not found or access denied"}), 404

    deleted_count, error = key_service.bulk_delete_expired_loader_keys(current_user, loader_id)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No expired keys found for the specified games"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_delete_expired_loader_keys",
        details=f"Deleted {deleted_count} expired keys for {len(game_ids)} games via loader: {loader.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {"message": f"Successfully deleted {deleted_count} expired keys for {len(game_ids)} games"}
    )
