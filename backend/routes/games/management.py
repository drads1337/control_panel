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

    # Allow users with clients.view permission to access games even if they don't have a project_id
    # This is needed when editing users
    has_clients_view = rbac_service.check_permission(user.id, "clients.view")
    
    if not user.project_id and not has_clients_view:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from flask import g

    scoped_project_id = getattr(g, "project_id", user.project_id)
    if not scoped_project_id:
        # If user has clients.view permission but no project_id, try to get project_id from request
        # This allows viewing games when editing users from different projects
        if has_clients_view:
            # For users with clients.view, we'll return an empty list if no project_id
            # The frontend should handle this gracefully
            return jsonify({"success": True, "games": [], "total_count": 0})
        return jsonify({"error": "No project associated"}), 400

    try:
        current_app.logger.info(f"=== GET_GAMES CALLED (CACHED) ===")

        game_type = request.args.get("type", "all")
        current_app.logger.info(f"Filtering games by type: {game_type}")

        has_view_permission = rbac_service.check_permission(user.id, "games.view")

        result = game_service.get_games_cached(
            project_id=scoped_project_id, game_type=game_type, user_id=user_id
        )

        if result.get("success"):
            original_games = result.get("games", [])

            from ...models import UserGamePermission

            user_game_permissions = {
                perm.game_id: perm.has_access
                for perm in UserGamePermission.query.filter_by(user_id=user_id).all()
            }

            from ...models.rbac import UserRole, Role
            user_roles = db.session.query(Role.name).join(
                UserRole, Role.id == UserRole.role_id
            ).filter(UserRole.user_id == user_id).all()
            user_role_names = [role[0] for role in user_roles]
            is_seller = 'seller' in user_role_names or any('seller' in str(role).lower() for role in user_role_names)

            current_app.logger.info(
                f"User {user_id} has {len(user_game_permissions)} UserGamePermission records. "
                f"Has global games.view: {has_view_permission}. "
                f"Is seller: {is_seller}. "
                f"Total games before filter: {len(original_games)}"
            )

            filtered_games = []
            for game in original_games:
                game_id = game.get("id")
                should_include = False

                if game_id in user_game_permissions:
                    should_include = user_game_permissions[game_id]
                else:

                    if is_seller:

                        should_include = False
                    elif not has_view_permission:

                        should_include = rbac_service.check_permission(user.id, "games.view", game_id=game_id)
                    else:

                        should_include = True

                if should_include:
                    filtered_games.append(game)

            current_app.logger.info(
                f"User {user_id}: Filtered {len(original_games)} games to {len(filtered_games)} games"
            )

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

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)

        per_page = max(1, min(100, per_page))
        page = max(1, page)

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

        base_query = Game.query.filter(
            and_(
                Game.project_id == scoped_project_id,
                Game.is_multi_app == True,
                ~Game.id.in_(assigned_game_ids_set) if assigned_game_ids_set else True,
            )
        )

        total_count = base_query.count()

        games = base_query.order_by(Game.name).offset((page - 1) * per_page).limit(per_page).all()

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

    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.create")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to create games."}),
            403,
        )

    try:

        if not validated_data:
            return jsonify({"error": "Invalid request data"}), 400

        new_game, error_msg = game_service.create_game(user, validated_data)

        if not new_game:
            status_code = 409 if error_msg == "Game already exists" else 500
            return jsonify({"error": error_msg or "Failed to create game"}), status_code

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

    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to edit games."}),
            403,
        )

    try:

        if not validated_data:
            return jsonify({"error": "Invalid request data"}), 400
        new_status = validated_data["status"]

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        old_status = game.status
        game.status = new_status
        db.session.commit()

        game_service.invalidate_game_cache(user.project_id, game_id)

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

    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to edit games."}),
            403,
        )

    try:

        if not validated_data:
            validated_data = {}

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

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

        db.session.commit()

        game_service.invalidate_game_cache(user.project_id, game_id)

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

    has_permission = RBACManager.has_permission(user.id, user.project_id, "games.delete")

    if not has_permission:
        has_permission = RBACManager.has_permission(user.id, user.project_id, "games.edit")

    if not has_permission:
        return (
            jsonify({"error": "Permission denied. You do not have permission to delete games."}),
            403,
        )

    try:

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        game_name = game.name

        db.session.delete(game)
        db.session.commit()

        game_service.invalidate_game_cache(user.project_id, game_id)

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
