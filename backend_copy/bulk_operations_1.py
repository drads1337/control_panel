"""
Game Bulk Operations Routes
Handles bulk operations for games
"""

import logging
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import enforce_project_scope, require_project_with_grace_period
from ...models import Game, User
from ...services.activity import activity_service
from ...services.games import game_service
from ...utils.rbac_utils import RBACManager

bulk_operations_bp = Blueprint("games_bulk", __name__)
logger = logging.getLogger(__name__)

@bulk_operations_bp.route("/bulk-status", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def bulk_update_game_status():
    """Bulk update game status"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        has_permission = RBACManager.has_permission(
            user.id, user.project_id, "games.edit"
        )

        if not has_permission:
            return (
                jsonify(
                    {
                        "error": "Permission denied. You do not have permission to edit games."
                    }
                ),
                403,
            )

        data = request.get_json()
        game_ids = data.get("game_ids", [])
        new_status = data.get("status")

        if not game_ids:
            return jsonify({"error": "game_ids is required"}), 400

        if not new_status:
            return jsonify({"error": "status is required"}), 400

        if new_status not in ["active", "inactive", "maintenance"]:
            return jsonify({"error": "Invalid status. Must be 'active', 'inactive', or 'maintenance'"}), 400

        games = Game.query.filter(
            Game.id.in_(game_ids),
            Game.project_id == user.project_id
        ).all()

        if not games:
            return jsonify({"message": "No games found or access denied"}), 200

        updated_count = 0
        game_names = []

        for game in games:
            old_status = game.status
            game.status = new_status
            game.is_active = new_status == "active"
            game_names.append(game.name)
            updated_count += 1

        db.session.commit()

        for game in games:
            game_service.invalidate_game_cache(user.project_id, game.id)

        activity_service.log_activity(
            user,
            "bulk_update_game_status",
            details=f"Updated status to '{new_status}' for {updated_count} games: {', '.join(game_names[:5])}{'...' if len(game_names) > 5 else ''}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": f"Successfully updated status for {updated_count} games",
                "updated_count": updated_count,
                "new_status": new_status,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk_update_game_status: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update game status: {str(e)}"}), 500

@bulk_operations_bp.route("/bulk-delete", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def bulk_delete_games():
    """Bulk delete games"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        has_permission = RBACManager.has_permission(
            user.id, user.project_id, "games.delete"
        )

        if not has_permission:
            has_permission = RBACManager.has_permission(
                user.id, user.project_id, "games.edit"
            )

        if not has_permission:
            return (
                jsonify(
                    {
                        "error": "Permission denied. You do not have permission to delete games."
                    }
                ),
                403,
            )

        data = request.get_json()
        game_ids = data.get("game_ids", [])

        if not game_ids:
            return jsonify({"error": "game_ids is required"}), 400

        games = Game.query.filter(
            Game.id.in_(game_ids),
            Game.project_id == user.project_id
        ).all()

        if not games:
            return jsonify({"message": "No games found or access denied"}), 200

        deleted_count = 0
        game_names = []
        game_ids_deleted = []

        for game in games:
            game_name = game.name
            game_id = game.id
            game_names.append(game_name)
            game_ids_deleted.append(game_id)

            db.session.delete(game)
            deleted_count += 1

        db.session.commit()

        for game_id in game_ids_deleted:
            game_service.invalidate_game_cache(user.project_id, game_id)

        activity_service.log_activity(
            user,
            "bulk_delete_games",
            details=f"Deleted {deleted_count} games: {', '.join(game_names[:5])}{'...' if len(game_names) > 5 else ''}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": f"Successfully deleted {deleted_count} games",
                "deleted_count": deleted_count,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk_delete_games: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to delete games: {str(e)}"}), 500
