"""
Bulk Operations Routes for Keys
Handles bulk operations like bulk delete, bulk reset, bulk pause/resume, etc.
"""

import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...services.activity import activity_service
from ...services.keys import key_service

bulk_operations_bp = Blueprint("keys_bulk", __name__)

@bulk_operations_bp.route("/bulk", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_create_keys(current_user=None, project_id=None):
    """Bulk create keys - uses async tasks for large operations"""
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"🔑 Bulk create keys request - Origin: {request.headers.get('Origin')}")

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()

    count = data.get("count", 1)
    duration_hours = data.get("duration_hours", 24)
    max_devices = data.get("max_devices", 1)
    game_id = data.get("game_id")

    if not game_id:
        return jsonify({"error": "Game ID is required"}), 400

    if count < 1 or count > 100:
        return jsonify({"error": "Count must be between 1 and 100"}), 400

    if max_devices < 1 or max_devices > 1000:
        return jsonify({"error": "Max devices must be between 1 and 1000"}), 400

    if duration_hours <= 0:
        return jsonify({"error": "Duration must be greater than 0"}), 400

    from ...services.games import game_service
    game, error = game_service.get_game(current_user, game_id)
    if error or not game:
        return jsonify({"error": "Game not found or access denied"}), 404

    is_access_code = game.login_type == "classic_login"
    item_type = "access codes" if is_access_code else "license keys"

    ASYNC_THRESHOLD = 10

    if count <= ASYNC_THRESHOLD:

        created_count, error_message, created_keys = key_service.bulk_create_keys(
            user=current_user,
            count=count,
            game_id=game_id,
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

        activity_service.log_activity(
            current_user,
            "bulk_create_keys",
            details=f"Created {created_count} production {item_type} for game: {game.name}",
            ip=request.remote_addr,
        )

        response_data = {
            "message": f"Successfully created {created_count} {item_type}",
            "summary": {
                "count": created_count,
                "game_name": game.name,
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
            from ...services.tasks import task_service
            from ...tasks.key_tasks import bulk_create_keys_task

            task_id = task_service.create_task(
                task_type="bulk_create_keys",
                task_data={
                    "count": count,
                    "game_id": game_id,
                    "game_name": game.name,
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
                    game_id,
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
                            "game_name": game.name,
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

@bulk_operations_bp.route("/bulk/delete", methods=["POST"])
@bulk_operations_bp.route("", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_delete_keys(current_user=None, project_id=None):
    """Bulk delete keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    key_ids = data.get("key_ids", [])

    if not key_ids:
        return jsonify({"error": "key_ids is required"}), 400

    deleted_count, error = key_service.bulk_delete_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if deleted_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    try:
        from ...routes.files import clear_storage_cache

        clear_storage_cache(current_user.project_id)
    except ImportError:
        pass

    activity_service.log_activity(
        current_user, "bulk_delete_keys", details=f"Deleted {deleted_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully deleted {deleted_count} keys"})

@bulk_operations_bp.route("/bulk_reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_reset_keys(current_user=None, project_id=None):
    """Bulk reset keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    key_ids = data.get("key_ids", [])

    if not key_ids:
        return jsonify({"error": "key_ids is required"}), 400

    affected_count, error = key_service.bulk_reset_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if affected_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    activity_service.log_activity(
        current_user, "bulk_reset_keys", details=f"Reset {affected_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully reset {affected_count} keys"})

@bulk_operations_bp.route("/bulk/pause", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_pause_keys(current_user=None, project_id=None):
    """Bulk pause keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    key_ids = data.get("key_ids", [])

    if not key_ids:
        return jsonify({"error": "key_ids is required"}), 400

    affected_count, error = key_service.bulk_pause_keys(current_user, key_ids)

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
def bulk_resume_keys(current_user=None, project_id=None):
    """Bulk resume keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    key_ids = data.get("key_ids", [])

    if not key_ids:
        return jsonify({"error": "key_ids is required"}), 400

    affected_count, error = key_service.bulk_resume_keys(current_user, key_ids)

    if error:
        return jsonify({"error": error}), 500

    if affected_count == 0:
        return jsonify({"message": "No keys found or access denied"}), 200

    activity_service.log_activity(
        current_user, "bulk_resume_keys", details=f"Resumed {affected_count} keys", ip=request.remote_addr
    )

    return jsonify({"message": f"Successfully resumed {affected_count} keys"})

@bulk_operations_bp.route("/bulk/add_hours", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_add_hours(current_user=None, project_id=None):
    """Bulk add hours to keys"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    key_ids = data.get("key_ids", [])
    hours = data.get("hours", 0)

    if not key_ids:
        return jsonify({"error": "key_ids is required"}), 400

    if hours <= 0:
        return jsonify({"error": "hours must be positive"}), 400

    affected_count, error = key_service.bulk_extend_keys(current_user, key_ids, hours)

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

@bulk_operations_bp.route("/bulk/pause/by_game", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_pause_keys_by_game(current_user=None, project_id=None):
    """Bulk pause keys by game"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    game_id = data.get("game_id")

    if not game_id:
        return jsonify({"error": "game_id is required"}), 400

    affected_count, error, game_name = key_service.bulk_pause_keys_by_game(current_user, game_id)

    if error:
        return jsonify({"error": error}), 500 if error != "Game not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this game"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_pause_keys_by_game",
        details=f"Paused {affected_count} keys for game: {game_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully paused {affected_count} keys for game: {game_name}"})

@bulk_operations_bp.route("/bulk/resume/by_game", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_resume_keys_by_game(current_user=None, project_id=None):
    """Bulk resume keys by game"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    game_id = data.get("game_id")

    if not game_id:
        return jsonify({"error": "game_id is required"}), 400

    affected_count, error, game_name = key_service.bulk_resume_keys_by_game(current_user, game_id)

    if error:
        return jsonify({"error": error}), 500 if error != "Game not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this game"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_resume_keys_by_game",
        details=f"Resumed {affected_count} keys for game: {game_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully resumed {affected_count} keys for game: {game_name}"})

@bulk_operations_bp.route("/bulk/reset/by_game", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_reset_keys_by_game(current_user=None, project_id=None):
    """Bulk reset keys by game"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    game_id = data.get("game_id")

    if not game_id:
        return jsonify({"error": "game_id is required"}), 400

    affected_count, error, game_name = key_service.bulk_reset_keys_by_game(current_user, game_id)

    if error:
        return jsonify({"error": error}), 500 if error != "Game not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this game"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_reset_keys_by_game",
        details=f"Reset {affected_count} keys for game: {game_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": f"Successfully reset {affected_count} keys for game: {game_name}"})

@bulk_operations_bp.route("/bulk/addHours/by_game", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_add_hours_by_game(current_user=None, project_id=None):
    """Bulk add hours to keys by game"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    game_id = data.get("game_id")
    hours = data.get("hours", 0)

    if not game_id:
        return jsonify({"error": "game_id is required"}), 400

    if hours <= 0:
        return jsonify({"error": "hours must be positive"}), 400

    affected_count, error, game_name = key_service.bulk_add_hours_by_game(
        current_user, game_id, hours
    )

    if error:
        return jsonify({"error": error}), 500 if error != "Game not found or access denied" else 404

    if affected_count == 0:
        return jsonify({"message": "No keys found for this game"}), 200

    activity_service.log_activity(
        current_user,
        "bulk_add_hours_by_game",
        details=f"Added {hours} hours to {affected_count} keys for game: {game_name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": f"Successfully added {hours} hours to {affected_count} keys for game: {game_name}"
        }
    )

@bulk_operations_bp.route("/bulk/deleteByFilters", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_delete_keys_by_filters(current_user=None, project_id=None):
    """Bulk delete keys by filters"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()

    deleted_count, error = key_service.bulk_delete_keys_by_filters(current_user, data)

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
def bulk_reset_keys_by_filters(current_user=None, project_id=None):
    """Bulk reset keys by filters"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()

    reset_count, error = key_service.bulk_reset_keys_by_filters(current_user, data)

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

@bulk_operations_bp.route("/bulk/extendByFilters", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_extend_keys_by_filters(current_user=None, project_id=None):
    """Bulk extend keys by filters"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    hours = data.get("hours", 0)

    if hours <= 0:
        return jsonify({"error": "Hours must be positive"}), 400

    extended_count, error = key_service.bulk_extend_keys_by_filters(current_user, data, hours)

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
