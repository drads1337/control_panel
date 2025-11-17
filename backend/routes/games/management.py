"""
Game Management Routes
CRUD operations for games: create, read, update, delete
"""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from sqlalchemy import and_

from ...middleware.auth import enforce_project_scope, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Game, User
from ...models.loaders import LoaderGameAssignment
from ...schemas.game import GameCreateSchema, GameStatusUpdateSchema, GameUpdateSchema
from ...services.activity import activity_service
from ...services.games import game_service
from ...services.rbac import rbac_service
from ...utils.rbac_utils import RBACManager

management_bp = Blueprint("games_management", __name__)


@management_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def get_games():
    """Get list of games"""
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
        current_app.logger.info(f"=== GET_GAMES CALLED (CACHED) ===")

        game_type = request.args.get("type", "all")
        current_app.logger.info(f"Filtering games by type: {game_type}")

        # Check if user has global permission to view all games
        has_view_permission = rbac_service.check_permission(user.id, "games.view")

        # Use cached game service
        result = game_service.get_games_cached(
            project_id=scoped_project_id, game_type=game_type, user_id=user_id
        )

        if result.get("success"):
            original_games = result.get("games", [])
            
            # Filter games by user permissions if user doesn't have global view permission
            if not has_view_permission and user_id:
                # Check permissions for each game individually
                filtered_games = []
                for game in original_games:
                    game_id = game.get("id")
                    # Check if user has permission for this specific game
                    if rbac_service.check_permission(user.id, "games.view", game_id=game_id):
                        filtered_games.append(game)
                    else:
                        # Fallback: check UserGamePermission table for backward compatibility
                        from ...models import UserGamePermission
                        user_game_perm = UserGamePermission.query.filter_by(
                            user_id=user_id, game_id=game_id, has_access=True
                        ).first()
                        if user_game_perm:
                            filtered_games.append(game)
                
                result["games"] = filtered_games
                result["total_count"] = len(filtered_games)
            else:
                # User has global view permission, but still filter by individual game permissions
                # for users who might have restrictions on specific games
                filtered_games = []
                for game in original_games:
                    game_id = game.get("id")
                    # Even with global permission, check individual game permission
                    if rbac_service.check_permission(user.id, "games.view", game_id=game_id):
                        filtered_games.append(game)
                
                # If user has global permission and can see all games, use original list
                # Otherwise use filtered list
                if len(filtered_games) < len(original_games):
                    result["games"] = filtered_games
                    result["total_count"] = len(filtered_games)

            return jsonify(result)
        else:
            current_app.logger.error(f"Game service error: {result.get('error', 'Unknown error')}")
            return jsonify(result), 500

    except Exception as e:
        current_app.logger.error(f"Error fetching games: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch games: {str(e)}"}), 500


@management_bp.route("/available-for-assignment", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def get_available_games_for_assignment():
    """Get multi-app games that are not assigned to any loader, with pagination support"""
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
        # Get pagination parameters
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)
        
        # Clamp per_page to reasonable limits (1-100)
        per_page = max(1, min(100, per_page))
        page = max(1, page)

        # Get all game IDs that are already assigned to any loader in this project
        assigned_game_ids = (
            db.session.query(LoaderGameAssignment.game_id)
            .join(Game, LoaderGameAssignment.game_id == Game.id)
            .filter(
                and_(
                    LoaderGameAssignment.project_id == scoped_project_id,
                    Game.project_id == scoped_project_id,
                )
            )
            .distinct()
            .all()
        )
        assigned_game_ids_set = {game_id[0] for game_id in assigned_game_ids}

        # Query for multi-app games that are not assigned
        base_query = Game.query.filter(
            and_(
                Game.project_id == scoped_project_id,
                Game.is_multi_app == True,
                ~Game.id.in_(assigned_game_ids_set) if assigned_game_ids_set else True,
            )
        )

        # Get total count before pagination
        total_count = base_query.count()

        # Apply pagination
        games = base_query.order_by(Game.name).offset((page - 1) * per_page).limit(per_page).all()

        # Build response data
        games_data = []
        for game in games:
            games_data.append(
                {
                    "id": game.id,
                    "name": game.name,
                    "description": game.description or "",
                    "status": game.status,
                    "logo": game.logo or "",
                    "version": game.version or "1.0.0",
                    "is_multi_app": game.is_multi_app,
                }
            )

        return jsonify(
            {
                "success": True,
                "games": games_data,
                "total_count": total_count,
                "page": page,
                "per_page": per_page,
                "total_pages": (total_count + per_page - 1) // per_page if per_page > 0 else 0,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error fetching available games for assignment: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch available games: {str(e)}"}), 500


@management_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(GameCreateSchema)
def create_game(validated_data=None):
    """Create a new game"""
    current_app.logger.info("=== CREATE_GAME ENDPOINT CALLED ===")

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Check RBAC permissions
    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.create")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to create games."}),
            403,
        )

    try:
        # Use validated data from decorator
        if not validated_data:
            return jsonify({"error": "Invalid request data"}), 400

        # Use service layer to create game
        new_game, error_msg = game_service.create_game(user, validated_data)

        if not new_game:
            status_code = 409 if error_msg == "Game already exists" else 500
            return jsonify({"error": error_msg or "Failed to create game"}), status_code

        # Log activity
        activity_service.log_activity(user, "game_created", details=f"Created game: {new_game.id}")

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Game created successfully",
                    "game": {
                        "id": new_game.id,
                        "name": new_game.name,
                        "description": new_game.description,
                        "status": new_game.status,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        current_app.logger.error(f"Error creating game: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to create game"}), 500


@management_bp.route("/<int:game_id>/status", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(GameStatusUpdateSchema)
def update_game_status(game_id, validated_data=None):
    """Update game status"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Check RBAC permissions
    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to edit games."}),
            403,
        )

    try:
        # Use validated data from decorator
        if not validated_data:
            return jsonify({"error": "Invalid request data"}), 400
        new_status = validated_data["status"]

        # Check if game exists and belongs to user's project
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        old_status = game.status
        game.status = new_status
        db.session.commit()

        # Invalidate game cache
        game_service.invalidate_game_cache(user.project_id, game_id)

        # Log activity
        activity_service.log_activity(
            user,
            "game_status_updated",
            details=f"Updated game {game.name} (ID: {game_id}) status from {old_status} to {new_status}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Game status updated successfully",
                "game_id": game_id,
                "old_status": old_status,
                "new_status": new_status,
            }
        )

    except ValueError as e:
        # Pydantic validation error
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating game status: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update game status: {str(e)}"}), 500


@management_bp.route("/<int:game_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(GameUpdateSchema, allow_empty=True)
def update_game(game_id, validated_data=None):
    """Update a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Check RBAC permissions
    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to edit games."}),
            403,
        )

    try:
        # Use validated data from decorator
        if not validated_data:
            validated_data = {}

        # Check if game exists and belongs to user's project
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        # Update game fields
        if "name" in validated_data and validated_data["name"] is not None:
            game.name = validated_data["name"]
        if "description" in validated_data and validated_data["description"] is not None:
            game.description = validated_data["description"]
        if "version" in validated_data and validated_data["version"] is not None:
            game.version = validated_data["version"]
        if "is_multi_app" in validated_data and validated_data["is_multi_app"] is not None:
            game.is_multi_app = validated_data["is_multi_app"]
        if "login_type" in validated_data and validated_data["login_type"] is not None:
            game.login_type = validated_data["login_type"]
        if "invite_code_required" in validated_data and validated_data["invite_code_required"] is not None:
            game.invite_code_required = validated_data["invite_code_required"]
        # Note: config field is handled through GameConfiguration model separately

        db.session.commit()

        # Invalidate game cache
        game_service.invalidate_game_cache(user.project_id, game_id)

        # Log activity
        activity_service.log_activity(
            user,
            "game_updated",
            details=f"Updated game {game.name} (ID: {game_id})",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Game updated successfully",
                "game": {
                    "id": game.id,
                    "name": game.name,
                    "description": game.description,
                    "version": game.version,
                    "is_multi_app": game.is_multi_app,
                    "login_type": game.login_type,
                    "invite_code_required": game.invite_code_required,
                },
            }
        )

    except ValueError as e:
        # Pydantic validation error
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating game: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update game: {str(e)}"}), 500


@management_bp.route("/<int:game_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def delete_game(game_id):
    """Delete a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Check RBAC permissions - need delete permission
    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.delete")
    
    # Fallback to edit permission if delete permission doesn't exist
    if not has_permission:
        has_permission = RBACManager.has_permission(user.id, user.project_id, "games.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to delete games."}),
            403,
        )

    try:
        # Check if game exists and belongs to user's project
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        game_name = game.name
        
        # Delete the game (CASCADE will handle most related records)
        db.session.delete(game)
        db.session.commit()

        # Invalidate game cache
        game_service.invalidate_game_cache(user.project_id, game_id)

        # Log activity
        activity_service.log_activity(
            user,
            "game_deleted",
            details=f"Deleted game {game_name} (ID: {game_id})",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Game deleted successfully",
                "game_id": game_id,
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting game: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to delete game: {str(e)}"}), 500


# NOTE: Additional endpoints like update_game should be added here
# These are currently in the original games.py file and need to be migrated
