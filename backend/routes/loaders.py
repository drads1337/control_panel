import json
import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import User
from ..models.games import Game
from ..models.loaders import Loader, LoaderGameAssignment
from ..config.config import Config

loaders_bp = Blueprint("loaders", __name__)

ALLOWED_EXTENSIONS = Config.ALLOWED_LOADER_EXTENSIONS

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@loaders_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loaders():
    """Get all loaders with their assigned games"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        loaders = Loader.query.filter_by(project_id=user.project_id).all()
        result = []

        for loader in loaders:
            uploads_dir = os.path.join(current_app.root_path, "uploads", "games")

            file_path = None
            if loader.file and loader.file != "0" and loader.file != "":
                file_path = os.path.join(uploads_dir, loader.file)
                if not os.path.exists(file_path):
                    file_path = None

            logo_path = None
            if loader.logo and loader.logo != "0" and loader.logo != "":
                logo_path = os.path.join(uploads_dir, loader.logo)
                if not os.path.exists(logo_path):
                    logo_path = None

            banner_path = None
            if loader.banner and loader.banner != "0" and loader.banner != "":
                banner_path = os.path.join(uploads_dir, loader.banner)
                if not os.path.exists(banner_path):
                    banner_path = None

            background_path = None
            if loader.background and loader.background != "0" and loader.background != "":
                background_path = os.path.join(uploads_dir, loader.background)
                if not os.path.exists(background_path):
                    background_path = None

            loader_data = {
                "id": loader.id,
                "name": loader.name,
                "description": loader.description,
                "status": loader.status,
                "logo": loader.logo if logo_path else None,
                "banner": loader.banner if banner_path else None,
                "background": loader.background if background_path else None,
                "file": loader.file if file_path else None,
                "changelog": loader.changelog,
                "notifications": loader.notifications,
                "version": loader.version,
                "downloads": loader.downloads,
                "active_users": loader.active_users,
                "last_update": loader.updated_at.isoformat() if loader.updated_at else None,
                "created_at": loader.created_at.isoformat() if loader.created_at else None,
                "updated_at": loader.updated_at.isoformat() if loader.updated_at else None,
            }

            assignments = LoaderGameAssignment.query.filter_by(loader_id=loader.id).all()
            loader_data["assigned_games"] = [assignment.game_id for assignment in assignments]

            result.append(loader_data)

        return jsonify({"loaders": result, "success": True})
    except Exception as e:
        current_app.logger.error(f"Error getting loaders: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to get loaders: {str(e)}", "success": False}), 500

@loaders_bp.route("/available-games", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_available_games_for_loaders():
    """Get only multi-app games that can be assigned to loaders"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.games import game_service

        game_service.invalidate_game_cache(user.project_id)

        result = game_service.get_games_cached(
            project_id=user.project_id,
            game_type="all",
            user_id=user_id,
        )

        if result.get("success"):

            games_data = []
            all_games = result.get("games", [])
            current_app.logger.info(f"Total games found: {len(all_games)}")

            for game in all_games:
                current_app.logger.info(
                    f"Game: {game.get('name')}, is_multi_app: {game.get('is_multi_app')}"
                )

                game_data = {
                    "id": game["id"],
                    "name": game["name"],
                    "description": game.get("description", ""),
                    "status": game.get("status", "active"),
                    "logo": game.get("logo", ""),
                    "version": game.get("version", "1.0.0"),
                    "is_multi_app": game.get("is_multi_app", False),
                }
                games_data.append(game_data)

            current_app.logger.info(f"Multi-app games found: {len(games_data)}")

            debug_info = {
                "total_games": len(all_games),
                "multi_app_games": len(games_data),
                "games_data": games_data,
                "all_games_debug": [
                    {"id": g["id"], "name": g["name"], "is_multi_app": g.get("is_multi_app", False)}
                    for g in all_games
                ],
            }
            current_app.logger.info(f"Debug info: {debug_info}")

            return jsonify({"games": games_data, "success": True, "debug": debug_info})
        else:
            current_app.logger.error(f"Game service error: {result.get('error', 'Unknown error')}")
            return (
                jsonify(
                    {
                        "error": f'Failed to fetch games: {result.get("error", "Unknown error")}',
                        "success": False,
                    }
                ),
                500,
            )

    except Exception as e:
        current_app.logger.error(f"Error getting available games for loaders: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to get available games: {str(e)}", "success": False}), 500

@loaders_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_loader():
    """Create a new loader"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        data = request.get_json()

        if not data or not data.get("name") or not data.get("description"):
            return jsonify({"error": "Name and description are required", "success": False}), 400

        existing_loader = Loader.query.filter_by(
            name=data["name"], project_id=user.project_id
        ).first()
        if existing_loader:
            return jsonify({"error": "Loader with this name already exists", "success": False}), 400

        new_loader = Loader(
            name=data["name"],
            description=data["description"],
            status=data.get("status", "active"),
            logo=data.get("logo"),
            banner=data.get("banner"),
            background=data.get("background"),
            file=data.get("file", f"{data['name'].lower().replace(' ', '_')}_loader.exe"),
            changelog=data.get("changelog", "Initial version"),
            notifications=data.get("notifications", "New loader added!"),
            version=data.get("version", "1.0.0"),
            downloads=data.get("downloads", 0),
            active_users=data.get("active_users", 0),
            created_by=user.id,
            project_id=user.project_id,
        )

        db.session.add(new_loader)
        db.session.commit()

        try:
            from .files import clear_storage_cache

            clear_storage_cache(user.project_id)
        except ImportError:
            pass

        loader_data = {
            "id": new_loader.id,
            "name": new_loader.name,
            "description": new_loader.description,
            "status": new_loader.status,
            "logo": new_loader.logo,
            "banner": new_loader.banner,
            "background": new_loader.background,
            "file": new_loader.file,
            "changelog": new_loader.changelog,
            "notifications": new_loader.notifications,
            "version": new_loader.version,
            "downloads": new_loader.downloads,
            "active_users": new_loader.active_users,
            "last_update": new_loader.updated_at.isoformat() if new_loader.updated_at else None,
            "created_at": new_loader.created_at.isoformat() if new_loader.created_at else None,
            "updated_at": new_loader.updated_at.isoformat() if new_loader.updated_at else None,
            "assigned_games": [],
        }

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"loaders:project_id={user.project_id}:*")
        except ImportError:
            pass

        return jsonify(
            {"loader": loader_data, "success": True, "message": "Loader created successfully"}
        )
    except Exception as e:
        current_app.logger.error(f"Error creating loader: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to create loader", "success": False}), 500

@loaders_bp.route("/<int:loader_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_loader(loader_id):
    """Update an existing loader"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        data = request.get_json()

        if data.get("name"):
            existing_loader = Loader.query.filter_by(
                name=data["name"], project_id=user.project_id
            ).first()
            if existing_loader and existing_loader.id != loader_id:
                return (
                    jsonify({"error": "Loader with this name already exists", "success": False}),
                    400,
                )

            loader.name = data["name"]

        if data.get("description"):
            loader.description = data["description"]

        if data.get("status"):
            loader.status = data["status"]

        if data.get("logo") is not None:
            loader.logo = data["logo"]

        if data.get("banner") is not None:
            loader.banner = data["banner"]

        if data.get("background") is not None:
            loader.background = data["background"]

        if data.get("file"):
            loader.file = data["file"]

        if data.get("changelog"):
            loader.changelog = data["changelog"]

        if data.get("notifications"):
            loader.notifications = data["notifications"]

        if data.get("version"):
            loader.version = data["version"]

        loader.updated_at = datetime.utcnow()

        db.session.commit()

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"loaders:project_id={user.project_id}:*")
        except ImportError:
            pass

        return jsonify({"success": True, "message": "Loader updated successfully"})
    except Exception as e:
        current_app.logger.error(f"Error updating loader: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to update loader", "success": False}), 500

@loaders_bp.route("/<int:loader_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_loader(loader_id):
    """Delete a loader"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        LoaderGameAssignment.query.filter_by(
            loader_id=loader_id, project_id=user.project_id
        ).delete()

        db.session.delete(loader)
        db.session.commit()

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"loaders:project_id={user.project_id}:*")
        except ImportError:
            pass

        return jsonify({"success": True, "message": "Loader deleted successfully"})
    except Exception as e:
        current_app.logger.error(f"Error deleting loader: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to delete loader", "success": False}), 500

@loaders_bp.route("/<int:loader_id>/assign-games", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def assign_games_to_loader(loader_id):
    """Assign games to a loader"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        data = request.get_json()
        game_ids = data.get("game_ids", [])

        if not isinstance(game_ids, list):
            return jsonify({"error": "game_ids must be a list", "success": False}), 400

        current_assignments = LoaderGameAssignment.query.filter_by(
            loader_id=loader_id, project_id=user.project_id
        ).all()
        current_game_ids = {assignment.game_id for assignment in current_assignments}

        for game_id in game_ids:
            if game_id in current_game_ids:

                continue

            existing_assignment = LoaderGameAssignment.query.filter_by(
                game_id=game_id, project_id=user.project_id
            ).first()

            if existing_assignment and existing_assignment.loader_id != loader_id:

                other_loader = Loader.query.get(existing_assignment.loader_id)
                loader_name = (
                    other_loader.name if other_loader else f"Loader {existing_assignment.loader_id}"
                )
                game = Game.query.get(game_id)
                game_name = game.name if game else f"Game {game_id}"
                return (
                    jsonify(
                        {
                            "error": f'Game "{game_name}" is already assigned to loader "{loader_name}". A game can only be assigned to one loader at a time.',
                            "success": False,
                        }
                    ),
                    400,
                )

        LoaderGameAssignment.query.filter_by(
            loader_id=loader_id, project_id=user.project_id
        ).delete()

        for game_id in game_ids:
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if game:
                assignment = LoaderGameAssignment(
                    loader_id=loader_id,
                    game_id=game_id,
                    assigned_by=user.id,
                    project_id=user.project_id,
                )
                db.session.add(assignment)

        db.session.commit()

        return jsonify({"success": True, "message": "Games assigned to loader successfully"})
    except Exception as e:
        current_app.logger.error(f"Error assigning games to loader: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to assign games to loader", "success": False}), 500

@loaders_bp.route("/<int:loader_id>/files", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def upload_loader_files(loader_id):
    """Upload files for a loader"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        uploaded_files = {}

        for file_type in ["logo", "banner", "background", "file"]:
            if file_type in request.files:
                file = request.files[file_type]
                if file and file.filename:
                    if not allowed_file(file.filename):
                        return (
                            jsonify(
                                {
                                    "error": f"File type not allowed for {file_type}",
                                    "success": False,
                                }
                            ),
                            400,
                        )

                    file.seek(0, 2)
                    file_size = file.tell()
                    file.seek(0)

                    filename = secure_filename(file.filename)
                    unique_filename = f"{file_type}_{loader_id}_{uuid.uuid4().hex}_{filename}"

                    upload_path = os.path.join(current_app.root_path, "uploads", "loaders")
                    os.makedirs(upload_path, exist_ok=True)

                    file_path = os.path.join(upload_path, unique_filename)
                    file.save(file_path)

                    # SECURITY: Validate file signature (magic bytes) to prevent file type spoofing
                    # This prevents attackers from uploading executable files with image extensions
                    from ..services.files.file_service import file_service
                    
                    # Determine expected extensions based on file type
                    expected_extensions = None
                    if file_type in ["logo", "banner", "background"]:
                        # For images, expect image extensions
                        ext = filename.rsplit(".", 1)[1].lower() if "." in filename else None
                        if ext and ext in ["png", "jpg", "jpeg", "gif", "webp"]:
                            expected_extensions = [ext]
                    
                    is_valid, validation_error = file_service.validate_file_signature(file_path, expected_extensions)
                    if not is_valid:
                        # Remove the invalid file
                        try:
                            os.remove(file_path)
                        except Exception:
                            pass
                        return (
                            jsonify(
                                {
                                    "error": validation_error or f"File validation failed for {file_type}",
                                    "success": False,
                                }
                            ),
                            400,
                        )

                    if file_type == "logo":
                        loader.logo = unique_filename
                    elif file_type == "banner":
                        loader.banner = unique_filename
                    elif file_type == "background":
                        loader.background = unique_filename
                    elif file_type == "file":
                        loader.file = unique_filename

                    uploaded_files[file_type] = unique_filename

        if uploaded_files:
            loader.updated_at = datetime.utcnow()
            db.session.commit()

            try:
                from .files import clear_storage_cache

                clear_storage_cache(user.project_id)
            except ImportError:
                pass

        return jsonify(
            {
                "success": True,
                "message": "Files uploaded successfully",
                "uploaded_files": uploaded_files,
            }
        )
    except Exception as e:
        current_app.logger.error(f"Error uploading loader files: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to upload files", "success": False}), 500

@loaders_bp.route("/<int:loader_id>/status", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_loader_status(loader_id):
    """Update loader status"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found", "success": False}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project", "success": False}), 403

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        data = request.get_json()
        new_status = data.get("status")

        if new_status not in ["active", "inactive", "maintenance", "testing"]:
            return jsonify({"error": "Invalid status", "success": False}), 400

        loader.status = new_status
        loader.updated_at = datetime.utcnow()

        db.session.commit()

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"loaders:project_id={user.project_id}:*")
        except ImportError:
            pass

        try:
            from ..services.activity import activity_service

            activity_service.log_activity(
                user,
                "loader_status_updated",
                details=f"Updated status to {new_status} for loader: {loader.name}",
            )
        except ImportError:
            pass

        return jsonify({"success": True, "message": f"Loader status updated to {new_status}"})
    except Exception as e:
        current_app.logger.error(f"Error updating loader status: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to update loader status", "success": False}), 500

@loaders_bp.route("/cache/refresh", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def refresh_loader_cache():
    """Force refresh loader cache for debugging"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found", "success": False}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project", "success": False}), 403

        from ..services.cache import cache_service

        success = cache_service.force_refresh_loader_cache(user.project_id)

        if success:
            return jsonify({"success": True, "message": "Loader cache refreshed successfully"})
        else:
            return jsonify({"error": "Failed to refresh cache", "success": False}), 500

    except Exception as e:
        current_app.logger.error(f"Error refreshing loader cache: {str(e)}")
        return jsonify({"error": "Failed to refresh cache", "success": False}), 500

@loaders_bp.route("/<int:loader_id>/download", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def download_loader(loader_id):
    """Record loader download and return download info"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or not user.project_id:
            return jsonify({"error": "User not found or not assigned to project", "success": False}), 403
        
        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        loader.downloads = (loader.downloads or 0) + 1
        loader.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "download_url": f"/api/uploads/loaders/{loader.file}" if loader.file else None,
                "filename": loader.file,
                "downloads": loader.downloads,
            }
        )
    except Exception as e:
        current_app.logger.error(f"Error recording loader download: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to record download", "success": False}), 500

@loaders_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loader_stats():
    """Get loader statistics"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        project_id = user.project_id

        total_loaders = Loader.query.filter_by(project_id=project_id).count()
        active_loaders = Loader.query.filter_by(project_id=project_id, status="active").count()
        inactive_loaders = Loader.query.filter_by(project_id=project_id, status="inactive").count()
        maintenance_loaders = Loader.query.filter_by(
            project_id=project_id, status="maintenance"
        ).count()
        testing_loaders = Loader.query.filter_by(project_id=project_id, status="testing").count()

        total_downloads = (
            db.session.query(db.func.sum(Loader.downloads))
            .filter_by(project_id=project_id)
            .scalar()
            or 0
        )
        total_active_users = (
            db.session.query(db.func.sum(Loader.active_users))
            .filter_by(project_id=project_id)
            .scalar()
            or 0
        )

        stats = {
            "total_loaders": total_loaders,
            "active_loaders": active_loaders,
            "inactive_loaders": inactive_loaders,
            "maintenance_loaders": maintenance_loaders,
            "testing_loaders": testing_loaders,
            "total_downloads": total_downloads,
            "total_active_users": total_active_users,
        }

        return jsonify({"stats": stats, "success": True})
    except Exception as e:
        current_app.logger.error(f"Error getting loader stats: {str(e)}")
        return jsonify({"error": "Failed to get loader stats", "success": False}), 500

@loaders_bp.route("/<int:loader_id>/config", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_loader_config(loader_id):
    """Update loader configuration (login type, multi-login, invite code requirements, key prefix)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "Access denied", "success": False}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated", "success": False}), 400

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found", "success": False}), 404

        data = request.get_json()

        if "login_type" in data:
            allowed_login_types = ["license_generation", "invite_code"]
            if data["login_type"] not in allowed_login_types:
                return (
                    jsonify(
                        {
                            "error": f'Invalid login type. Allowed: {", ".join(allowed_login_types)}',
                            "success": False,
                        }
                    ),
                    400,
                )
            loader.login_type = data["login_type"]

        if "invite_code_required" in data:
            loader.invite_code_required = bool(data["invite_code_required"])

        if "custom_key_prefix" in data:
            loader.custom_key_prefix = data["custom_key_prefix"]

        if "key_prefix_format" in data:
            loader.key_prefix_format = data["key_prefix_format"]

        loader.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Loader configuration updated successfully",
                "config": {
                    "login_type": loader.login_type,
                    "invite_code_required": loader.invite_code_required,
                    "custom_key_prefix": loader.custom_key_prefix,
                    "key_prefix_format": loader.key_prefix_format,
                },
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error updating loader configuration: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to update loader configuration", "success": False}), 500
