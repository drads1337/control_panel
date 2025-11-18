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
from ...models import Game, Key, User
from ...schemas.key import KeyCreateSchema, KeyExtendSchema, KeyMoveSchema, KeyUpdateSchema
from ...services.activity import activity_service
from ...services.keys import key_service
from ...services.rbac import rbac_service
from ...utils.data_masking import mask_license_key
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from .common import can_manage_key

management_bp = Blueprint("keys_management", __name__)

@management_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_keys(current_user=None, project_id=None):
    """Get list of keys with filtering and pagination"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "Access denied"}), 403

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    my_keys = request.args.get("my_keys", "false").lower() == "true"
    filters = {
        "page": request.args.get("page", 1, type=int),
        "per_page": request.args.get("per_page", 20, type=int),
        "status": request.args.get("status"),
        "game_id": request.args.get("game_id", type=int),
        "search": request.args.get("search"),
        "my_keys": my_keys,
    }

    if filters["game_id"]:
        game = Game.query.filter_by(id=filters["game_id"], project_id=current_user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found or access denied"}), 404

    keys, total_count = key_service.get_keys(current_user, filters)

    page = filters["page"]
    per_page = filters["per_page"]
    pages = (total_count + per_page - 1) // per_page

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
def create_key(current_user=None, project_id=None, validated_data=None):
    """Create a new key"""
    logger = logging.getLogger(__name__)
    logger.info(f"🔑 Create key request - Origin: {request.headers.get('Origin')}")

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(current_user)
    is_owner = user_roles and user_roles[0] == UserRoles.OWNER.value

    if not is_owner and not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()

    key_data = {
        "game_id": data.get("game_id"),
        "duration_hours": data.get("duration_hours", 24),
        "max_devices": data.get("max_devices", 1),
        "length": data.get("length", 32),
    }

    game = None
    if data.get("game_id"):
        game = Game.query.filter_by(id=data["game_id"], project_id=current_user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found or access denied"}), 404

        is_access_code = game.login_type == "classic_login"
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

    if not game:
        return jsonify({"error": "Game ID is required"}), 400

    key, error = key_service.create_key(current_user, key_data)
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

    game = Game.query.get(key.game_id)
    if not game:
        logger.error(f"🔑 Game not found for key {key.id}, game_id: {key.game_id}")
        return jsonify({"error": "Game not found"}), 404

    is_access_code = game.login_type == "classic_login"
    item_type = "access code" if is_access_code else "license key"
    generation_type = "access_code" if is_access_code else "license_key"

    response_data = {
        "message": f"{item_type.title()} created successfully",
        "key": {
            "id": key.id,
            "key": key.key,
            "game_id": key.game_id,
            "game_name": game.name,
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
            details=f"Created production {item_type}: {key.key[:8]}... for game: {game.name}",
            ip=request.remote_addr,
        )
    except Exception as e:
        logger.error(f"🔑 Failed to log activity (non-critical): {str(e)}")

    return jsonify(response_data), 201

@management_bp.route("/<int:key_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyUpdateSchema)
def update_key(key_id, current_user=None, project_id=None):
    """Update a key"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    key = Key.query.filter_by(id=key_id, project_id=current_user.project_id).first()
    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.edit"):
        return jsonify({"error": "You do not have permission to edit this key"}), 403

    key, error = key_service.update_key(current_user, key_id, data)
    if error:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        current_user,
        "update_key",
        details=f'Updated key: {key.key[:8]}... (max_devices: {key.max_devices}, duration: {data.get("duration", "unchanged")}h)',
        ip=request.remote_addr,
    )

    return jsonify({"message": "Key updated successfully"})

@management_bp.route("/<int:key_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_key(key_id, current_user=None, project_id=None):
    """Delete a key"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    logger = logging.getLogger(__name__)
    logger.info(
        f"Delete key request: key_id={key_id}, user_id={current_user.id}, user_project_id={current_user.project_id}"
    )

    key = Key.query.filter_by(id=key_id, project_id=current_user.project_id).first()
    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(current_user, key, "keys.delete"):
        return jsonify({"error": "You do not have permission to delete this key"}), 403

    success, error = key_service.delete_key(current_user, key_id)
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

@management_bp.route("/<int:key_id>/reset", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def reset_key(key_id):
    """Reset a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(user, key, "keys.reset_pc_binding"):
        return jsonify({"error": "You do not have permission to reset this key"}), 403

    try:
        key.devices = ""
        key.fingerprint = None
        key.activated_at = None

        from ...models import DeviceInfo

        DeviceInfo.query.filter_by(key_id=key.id).delete()

        db.session.commit()

        activity_service.log_activity(
            user, "reset_key", details=f"Reset key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key reset successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to reset key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/pause", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def pause_key(key_id):
    """Pause a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(user, key, "keys.pause_resume"):
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
            user, "pause_key", details=f"Paused key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key paused successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to pause key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/resume", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def resume_key(key_id):
    """Resume a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(user, key, "keys.pause_resume"):
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
            user, "resume_key", details=f"Resumed key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key resumed successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to resume key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/extend", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyExtendSchema)
def extend_key(key_id):
    """Extend a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = request.get_json()
    hours = data.get("hours", 0)

    if hours <= 0:
        return jsonify({"error": "Hours must be positive"}), 400

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(user, key, "keys.extend"):
        return jsonify({"error": "You do not have permission to extend this key"}), 403

    try:
        if key.expires_at:
            key.expires_at += timedelta(hours=hours)
        else:
            key.expires_at = datetime.utcnow() + timedelta(hours=hours)

        db.session.commit()

        activity_service.log_activity(
            user,
            "extend_key",
            details=f"Extended key: {key.key[:8]}... by {hours} hours",
            ip=request.remote_addr,
        )

        return jsonify({"message": f"Key extended by {hours} hours"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to extend key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/duplicate", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def duplicate_key(key_id):
    """Duplicate a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        from ...services.keys import key_service

        game = Game.query.get(key.game_id) if key.game_id else None

        if not game:
            return jsonify({"error": "Game not found"}), 404

        new_key_string = key_service.generate_key_string(
            length=32, game=game, duration_hours=key.duration_hours, project_id=user.project_id
        )

        duplicate_key = Key(
            key=new_key_string,
            user_id=key.user_id,
            game_id=key.game_id,
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
            user,
            "duplicate_key",
            details=f"Duplicated key: {key.key[:8]}...",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": "Key duplicated successfully",
                    "key": {
                        "id": duplicate_key.id,
                        "key": duplicate_key.key,
                        "game_id": duplicate_key.game_id,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to duplicate key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/move", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyMoveSchema)
def move_key(key_id):
    """Move a key to another user"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = request.get_json()
    new_user_id = data.get("user_id")

    if not new_user_id:
        return jsonify({"error": "user_id is required"}), 400

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    new_user = User.query.filter_by(id=new_user_id, project_id=user.project_id).first()
    if not new_user:
        return jsonify({"error": "Target user not found"}), 404

    try:
        old_user_id = key.user_id
        key.user_id = new_user_id
        db.session.commit()

        activity_service.log_activity(
            user,
            "move_key",
            details=f"Moved key: {key.key[:8]}... from user {old_user_id} to {new_user_id}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Key moved successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to move key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/block", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def block_key(key_id):
    """Block a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(user, key, "keys.block_unblock"):
        return jsonify({"error": "You do not have permission to block this key"}), 403

    try:
        old_status = key.status
        key.status = 2

        from ...utils.key_counters import update_user_key_counters_on_status_change
        update_user_key_counters_on_status_change(key.user_id, old_status, 2)

        if key.project_id:
            from ...utils.project_counters import update_project_key_counters_on_status_change
            update_project_key_counters_on_status_change(key.project_id, old_status, 2)

        db.session.commit()

        activity_service.log_activity(
            user, "block_key", details=f"Blocked key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key blocked successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to block key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/unblock", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def unblock_key(key_id):
    """Unblock a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    if not can_manage_key(user, key, "keys.block_unblock"):
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
            user, "unblock_key", details=f"Unblocked key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key unblocked successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to unblock key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/archive", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def archive_key(key_id):
    """Archive a key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

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
            user, "archive_key", details=f"Archived key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key archived successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to archive key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/restore", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def restore_key(key_id):
    """Restore an archived key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

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
            user, "restore_key", details=f"Restored key: {key.key[:8]}...", ip=request.remote_addr
        )

        return jsonify({"message": "Key restored successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to restore key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/export", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def export_key(key_id):
    """Export a single key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        game = (
            Game.query.filter_by(id=key.game_id, project_id=user.project_id).first()
            if key.game_id
            else None
        )

        export_data = {
            "key_id": key.id,
            "key": key.key,
            "game_id": key.game_id,
            "game_name": game.name if game else None,
            "status": key.status,
            "is_active": key.status == 1
            and (not key.expires_at or key.expires_at > datetime.utcnow()),
            "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
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
            user, "export_key", details=f"Exported key: {key.key[:8]}...", ip=request.remote_addr
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

@management_bp.route("/<int:key_id>/download", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def download_key(key_id):
    """Download a key as JSON file

    SECURITY: Requires keys.view permission to download full key.
    Users without permission will receive a masked key.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        from flask import make_response

        can_download_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

        if not can_download_full_key:

            is_own_key = key.user_id == user.id
            if is_own_key:

                can_download_full_key = rbac_service.check_permission(user.id, "keys.view")
            else:

                can_download_full_key = rbac_service.check_permission(user.id, "keys.view")

        key_value = key.key if can_download_full_key else mask_license_key(key.key)

        game = (
            Game.query.filter_by(id=key.game_id, project_id=user.project_id).first()
            if key.game_id
            else None
        )

        export_data = {
            "key_id": key.id,
            "key": key_value,
            "key_masked": not can_download_full_key,
            "game_id": key.game_id,
            "game_name": game.name if game else None,
            "status": key.status,
            "is_active": key.status == 1
            and (not key.expires_at or key.expires_at > datetime.utcnow()),
            "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
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
        response.headers["Content-Type"] = "application/json"
        response.headers["Content-Disposition"] = f"attachment; filename=key_{key_id}.json"

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download key: {str(e)}"}), 500

@management_bp.route("/<int:key_id>/details", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_key_details(key_id):
    """Get detailed information about a key

    SECURITY: By default, keys are masked. Full keys are only returned if:
    - User has keys.view permission, OR
    - User is owner/admin, OR
    - It's the user's own key and they have keys.view permission

    This endpoint uses a more lenient rate limit (60/min) to allow users
    to view multiple keys in quick succession without hitting rate limits.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        game = (
            Game.query.filter_by(id=key.game_id, project_id=user.project_id).first()
            if key.game_id
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

        can_view_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

        if not can_view_full_key:

            is_own_key = key.user_id == user.id
            if is_own_key:

                can_view_full_key = rbac_service.check_permission(user.id, "keys.view")
            else:

                can_view_full_key = rbac_service.check_permission(user.id, "keys.view")

        key_value = key.key if can_view_full_key else mask_license_key(key.key)

        key_data = {
            "id": key.id,
            "key": key_value,
            "key_masked": not can_view_full_key,
            "game_id": key.game_id,
            "game_name": game.name if game else None,
            "status": key.status,
            "is_active": key.status == 1
            and (not key.expires_at or key.expires_at > datetime.utcnow()),
            "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
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

@management_bp.route("/<int:key_id>/reveal", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def reveal_key(key_id):
    """Reveal full license key

    SECURITY: This endpoint explicitly requires keys.view permission to reveal full keys.
    This is a security measure to prevent mass data leakage. Users must explicitly
    request to reveal a key, and the request is logged for audit purposes.

    Returns:
        Full key value if user has permission, otherwise returns masked key.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:

        can_reveal_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

        if not can_reveal_key:

            is_own_key = key.user_id == user.id
            if is_own_key:

                can_reveal_key = rbac_service.check_permission(user.id, "keys.view")
            else:

                can_reveal_key = rbac_service.check_permission(user.id, "keys.view")

        if not can_reveal_key:

            logging.warning(
                f"🚫 Unauthorized key reveal attempt: user_id={user.id}, key_id={key_id}, "
                f"key_owner={key.user_id}, has_keys_view={rbac_service.check_permission(user.id, 'keys.view')}"
            )
            return jsonify({
                "error": "Insufficient permissions to reveal key",
                "key": mask_license_key(key.key),
                "key_masked": True
            }), 403

        logging.info(
            f"🔓 Key revealed: user_id={user.id}, key_id={key_id}, "
            f"key_owner={key.user_id}, is_own_key={key.user_id == user.id}"
        )

        return jsonify({
            "key": key.key,
            "key_masked": False,
            "id": key.id
        })

    except Exception as e:
        logging.error(f"Failed to reveal key {key_id}: {str(e)}")
        return jsonify({"error": f"Failed to reveal key: {str(e)}"}), 500
