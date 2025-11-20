import logging
import os
import traceback

from flask import Blueprint, current_app, g, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from ..core.extensions import db
from ..models.core import User
from ..models.games import Game, GameExtraFile, GameFileConfig, GameFileDownload
from ..services.activity import activity_service
from ..services.files import file_service

logger = logging.getLogger(__name__)

from ..middleware.auth import enforce_project_scope, require_project_isolation

files_bp = Blueprint("files", __name__)

@files_bp.route("", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_files():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search")
    file_type = request.args.get("type")

    result = file_service.list_files(user, page=page, per_page=per_page, search=search, file_type=file_type)
    return jsonify(result)

@files_bp.route("/upload", methods=["POST"])
@jwt_required()
@enforce_project_scope
def upload_file():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    file_data, error = file_service.upload_file(user, file)
    if error:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        user,
        "upload_file",
        details=f"Uploaded file: {file_data['name']} ({file_data['size_human']})",
        ip=request.remote_addr,
    )

    return jsonify({"message": "File uploaded successfully", "file": file_data}), 201

@files_bp.route("/<filename>", methods=["GET"])
@jwt_required()
@enforce_project_scope
def download_file(filename):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    file_path, error = file_service.get_file_path_for_download(filename)
    if error:
        return jsonify({"error": error}), 404

    try:
        activity_service.log_activity(
            user, "download_file", details=f"Downloaded file: {filename}", ip=request.remote_addr
        )

        return send_file(file_path, as_attachment=True, download_name=filename)

    except Exception as e:
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

@files_bp.route("/<filename>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_file(filename):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 403

    file_path, _ = file_service.get_file_path_for_download(filename)
    file_size = file_service.get_file_size(file_path) if file_path else 0

    success, error = file_service.delete_file(user, filename)
    if not success:
        return jsonify({"error": error}), 404 if error == "File not found" else 500

    activity_service.log_activity(
        user,
        "delete_file",
        details=f"Deleted file: {filename} ({file_service.format_file_size(file_size)})",
        ip=request.remote_addr,
    )

    return jsonify({"message": "File deleted successfully"})

@files_bp.route("/bulk", methods=["POST"])
@jwt_required()
@enforce_project_scope
def bulk_action():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 403

    data = request.get_json()
    action = data.get("action")
    filenames = data.get("filenames", [])

    if not action or not filenames:
        return jsonify({"error": "Action and filenames are required"}), 400

    if action == "delete":
        deleted_count, error = file_service.bulk_delete_files(user, filenames)
        if error:
            return jsonify({"error": error}), 500

        activity_service.log_activity(
            user,
            "bulk_delete_files",
            details=f"Deleted {deleted_count} files",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully deleted {deleted_count} files",
                "deleted_count": deleted_count,
            }
        )

    return jsonify({"error": "Invalid action"}), 400

@files_bp.route("/stats", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_file_stats():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    stats = file_service.get_file_stats(user)
    return jsonify(stats)

@files_bp.route("/storage-info", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_storage_info():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        if error == "User not found":
            return jsonify({"error": error}), 404
        return (
            jsonify(
                {
                    "error": error,
                    "code": "NO_PROJECT",
                    "message": "Please contact an administrator to assign you to a project",
                    "user_id": user.id if user else None,
                    "username": user.username if user else None,
                }
            ),
            400,
        )

    storage_info, error = file_service.get_storage_info(user)
    if error:
        if "not found" in error.lower():
            return (
                jsonify(
                    {
                        "error": error,
                        "code": "PROJECT_NOT_FOUND",
                        "message": "The project you are assigned to no longer exists",
                        "user_id": user.id,
                        "username": user.username,
                        "project_id": user.project_id,
                    }
                ),
                404,
            )
        return (
            jsonify(
                {
                    "error": "Failed to calculate storage information",
                    "code": "STORAGE_CALCULATION_ERROR",
                    "message": error,
                }
            ),
            500,
        )

    return jsonify(storage_info)

@files_bp.route("/preview/<filename>", methods=["GET"])
@jwt_required()
@enforce_project_scope
def preview_file(filename):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    preview_data, error = file_service.preview_file(user, filename)
    if error:
        return jsonify({"error": error}), 404 if error == "File not found" else 500

    return jsonify(preview_data)

@files_bp.route("/games", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_games():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "User not associated with any project"}), 400

    try:

        from ..services.games import game_service

        result = game_service.get_games_cached(
            project_id=user.project_id, game_type="all", user_id=user_id
        )

        if not result.get("success"):
            return (
                jsonify(
                    {"error": f'Failed to fetch games: {result.get("error", "Unknown error")}'}
                ),
                500,
            )

        games_data = []
        for game in result.get("games", []):
            configs_count = GameFileConfig.query.filter_by(
                game_id=game["id"], is_active=True
            ).count()
            extra_files_count = GameExtraFile.query.filter_by(
                game_id=game["id"], is_active=True
            ).count()

            games_data.append(
                {
                    "id": game["id"],
                    "unique_id": game.get("unique_id", ""),
                    "name": game["name"],
                    "description": game.get("description", ""),
                    "status": game.get("status", "active"),
                    "configs_count": configs_count,
                    "extra_files_count": extra_files_count,
                    "is_active": game.get("status", "active") == "active",
                    "created_at": (
                        game.get("created_at", "").isoformat() if game.get("created_at") else ""
                    ),
                    "updated_at": (
                        game.get("updated_at", "").isoformat() if game.get("updated_at") else ""
                    ),
                }
            )

        return jsonify({"games": games_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch games: {str(e)}"}), 500

@files_bp.route("/games/<game_name>/configs", methods=["GET"])
def get_game_configs_by_name(game_name):
    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
        except Exception:

            pass

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        game = Game.query.filter_by(name=game_name, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        configs = GameFileConfig.query.filter_by(game_id=game.id, is_active=True).all()

        configs_data = []
        for config in configs:
            uploader = User.query.filter_by(
                id=config.uploaded_by, project_id=user.project_id
            ).first()
            configs_data.append(
                {
                    "id": config.id,
                    "config_id": config.config_id,
                    "name": config.name,
                    "description": config.description,
                    "file_type": config.file_type,
                    "size": config.file_size,
                    "version": config.version,
                    "uploaded_by": uploader.username if uploader else "Unknown",
                    "download_count": config.download_count,
                    "rating": config.rating,
                    "rating_count": config.rating_count,
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "content_hash": config.content_hash,
                }
            )

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch configs: {str(e)}"}), 500

@files_bp.route("/games/<int:game_id>/configs", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_game_configs(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game or game.project_id != user.project_id:
            return jsonify({"error": "Game not found"}), 404

        configs = GameFileConfig.query.filter_by(game_id=game_id, is_active=True).all()

        configs_data = []
        for config in configs:
            uploader = User.query.filter_by(
                id=config.uploaded_by, project_id=user.project_id
            ).first()
            configs_data.append(
                {
                    "id": config.id,
                    "config_id": config.config_id,
                    "name": config.name,
                    "description": config.description,
                    "file_type": config.file_type,
                    "size": config.file_size,
                    "version": config.version,
                    "uploaded_by": uploader.username if uploader else "Unknown",
                    "download_count": config.download_count,
                    "rating": config.rating,
                    "rating_count": config.rating_count,
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "content_hash": config.content_hash,
                }
            )

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch configs: {str(e)}"}), 500

@files_bp.route("/games/<int:game_id>/extra-files", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_game_extra_files(game_id):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    files_data, error = file_service.get_game_extra_files(user, game_id)
    if error:
        return jsonify({"error": error}), 404 if error == "Game not found" else 500

    return jsonify({"extra_files": files_data})

@files_bp.route("/games/configs/<int:config_id>/download", methods=["GET"])
def download_game_config(config_id):
    logging.debug(f"[DEBUG] Request: GET /api/files/games/configs/{config_id}/download")

    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logging.debug(
            f"[DEBUG] Processing token for GET /api/files/games/configs/{config_id}/download"
        )

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
            logging.debug(f"[DEBUG] JWT validation successful for user {user_id}")
        except Exception as e:
            logging.debug(f"[DEBUG] JWT verification failed: {e}")

            pass

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    else:
        logging.debug(f"[DEBUG] No Authorization header found")

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    try:
        config = (
            GameFileConfig.query.join(Game)
            .filter(GameFileConfig.id == config_id, Game.project_id == user.project_id)
            .first()
        )
        if not config:
            return jsonify({"error": "Config not found"}), 404

        game = Game.query.get(config.game_id)
        if not game:
            return jsonify({"error": "Game not found"}), 404

        response, error = file_service.download_game_config(
            config, user, request.remote_addr, request.headers.get("User-Agent")
        )
        if error:
            return jsonify({"error": error}), 404

        activity_service.log_activity(
            user,
            "download_game_config",
            details=f"Downloaded config {config.name} for game {game.name}",
            ip=request.remote_addr,
        )

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download config: {str(e)}"}), 500

@files_bp.route("/games/configs/<config_id>/download", methods=["GET"])
def download_game_config_by_string_id(config_id):
    logging.debug(f"[DEBUG] Request: GET /api/files/games/configs/{config_id}/download")

    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logging.debug(
            f"[DEBUG] Processing token for GET /api/files/games/configs/{config_id}/download"
        )

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
            logging.debug(f"[DEBUG] JWT validation successful for user {user_id}")
        except Exception as e:
            logging.debug(f"[DEBUG] JWT verification failed: {e}")

            pass

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    else:
        logging.debug(f"[DEBUG] No Authorization header found")

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    try:
        config = GameFileConfig.query.filter_by(config_id=config_id).first()
        if not config:
            return jsonify({"error": "Config not found"}), 404

        game = Game.query.filter_by(id=config.game_id, project_id=user.project_id).first()
        if not game or game.project_id != user.project_id:
            return jsonify({"error": "Access denied"}), 403

        response, error = file_service.download_game_config(
            config, user, request.remote_addr, request.headers.get("User-Agent")
        )
        if error:
            return jsonify({"error": error}), 404

        activity_service.log_activity(
            user,
            "download_game_config_by_id",
            details=f"Downloaded config {config.name} (ID: {config_id}) for game {game.name}",
            ip=request.remote_addr,
        )

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download config: {str(e)}"}), 500

@files_bp.route("/games/extra-files/<int:file_id>/download", methods=["GET"])
def download_game_extra_file(file_id):
    try:
        extra_file = GameExtraFile.query.get(file_id)
        if not extra_file:
            return jsonify({"error": "File not found"}), 404

        response, error = file_service.download_game_extra_file(extra_file)
        if error:
            return jsonify({"error": error}), 404

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download extra file: {str(e)}"}), 500

@files_bp.route("/games/extra-files/<int:file_id>/status", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_file_status(file_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    try:
        data = request.get_json()
        new_status = data.get("status")

        if not new_status or new_status not in ["active", "inactive", "testing", "dangerous"]:
            return jsonify({"error": "Invalid status"}), 400

        extra_file = (
            GameExtraFile.query.join(Game)
            .filter(GameExtraFile.id == file_id, Game.project_id == user.project_id)
            .first()
        )
        if not extra_file:
            return jsonify({"error": "File not found"}), 404

        old_status = extra_file.status
        extra_file.status = new_status
        db.session.commit()

        activity_service.log_activity(
            user,
            "update_file_status",
            details=f"Updated file {extra_file.name} status from {old_status} to {new_status}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": "Status updated successfully", "file_id": file_id, "new_status": new_status}
        )

    except Exception as e:
        return jsonify({"error": f"Failed to update status: {str(e)}"}), 500

@files_bp.route("/games/<int:game_id>/storage-info", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_game_storage_info(game_id):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    storage_info, error = file_service.get_game_storage_info(user, game_id)
    if error:
        return jsonify({"error": error}), 404 if error == "Game not found" else 500

    return jsonify(storage_info)

@files_bp.route("/games/<int:game_id>/configs/my", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_my_game_configs(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game or game.project_id != user.project_id:
            return jsonify({"error": "Game not found"}), 404

        configs = GameFileConfig.query.filter_by(
            game_id=game_id, uploaded_by=user.id, is_active=True
        ).all()

        configs_data = []
        for config in configs:
            configs_data.append(
                {
                    "id": config.id,
                    "name": config.name,
                    "description": config.description,
                    "file_type": config.file_type,
                    "size": config.file_size,
                    "version": config.version,
                    "is_public": config.is_public,
                    "download_count": config.download_count,
                    "rating": config.rating,
                    "rating_count": config.rating_count,
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "content_hash": config.content_hash,
                }
            )

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch user configs: {str(e)}"}), 500

@files_bp.route("/games/<int:game_id>/configs/public", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_public_game_configs(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game or game.project_id != user.project_id:
            return jsonify({"error": "Game not found"}), 404

        configs = (
            GameFileConfig.query.filter_by(game_id=game_id, is_public=True, is_active=True)
            .order_by(GameFileConfig.rating.desc())
            .all()
        )

        configs_data = []
        for config in configs:
            uploader = User.query.filter_by(
                id=config.uploaded_by, project_id=user.project_id
            ).first()
            configs_data.append(
                {
                    "id": config.id,
                    "name": config.name,
                    "description": config.description,
                    "file_type": config.file_type,
                    "size": config.file_size,
                    "version": config.version,
                    "uploaded_by": uploader.username if uploader else "Unknown",
                    "download_count": config.download_count,
                    "rating": config.rating,
                    "rating_count": config.rating_count,
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "content_hash": config.content_hash,
                }
            )

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch public configs: {str(e)}"}), 500

@files_bp.route("/games/configs/<int:config_id>/update", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_game_config(config_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        config = (
            GameFileConfig.query.join(Game)
            .filter(GameFileConfig.id == config_id, Game.project_id == user.project_id)
            .first()
        )
        if not config:
            return jsonify({"error": "Config not found"}), 404

        game = Game.query.get(config.game_id)
        if not game:
            return jsonify({"error": "Game not found"}), 404

        from ..services.rbac import rbac_service

        if config.uploaded_by != user.id and not rbac_service.check_permission(
            user.id, "games.edit"
        ):
            return jsonify({"error": "Access denied"}), 403

        data = request.get_json()

        if "name" in data:
            config.name = data["name"]
        if "description" in data:
            config.description = data["description"]
        if "version" in data:
            config.version = data["version"]
        if "is_public" in data:
            config.is_public = data["is_public"]

        db.session.commit()

        activity_service.log_activity(
            user,
            "update_game_config",
            details=f"Updated config {config.name} for game {game.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": "Config updated successfully",
                "config": {
                    "id": config.id,
                    "name": config.name,
                    "description": config.description,
                    "version": config.version,
                    "is_public": config.is_public,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to update config: {str(e)}"}), 500

@files_bp.route("/games/configs/<int:config_id>/rate", methods=["POST"])
@jwt_required()
@enforce_project_scope
def rate_game_config(config_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        config = (
            GameFileConfig.query.join(Game)
            .filter(GameFileConfig.id == config_id, Game.project_id == user.project_id)
            .first()
        )
        if not config:
            return jsonify({"error": "Config not found"}), 404

        if config.uploaded_by == user.id:
            return jsonify({"error": "Cannot rate your own config"}), 400

        data = request.get_json()
        rating = data.get("rating")

        if not rating or not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5"}), 400

        current_total = config.rating * config.rating_count
        config.rating_count += 1
        config.rating = (current_total + rating) / config.rating_count

        db.session.commit()

        activity_service.log_activity(
            user,
            "rate_game_config",
            details=f"Rated config {config.name} with {rating} stars",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": "Rating submitted successfully",
                "config_id": config_id,
                "new_rating": config.rating,
                "rating_count": config.rating_count,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to submit rating: {str(e)}"}), 500

@files_bp.route("/game-files", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_game_files():
    try:
        logging.debug(
            f"[DEBUG] get_game_files route hit - URL: {request.url}, method: {request.method}"
        )
        logging.debug(f"[DEBUG] get_game_files - Headers: {dict(request.headers)}")
        logging.debug(f"[DEBUG] get_game_files - Args: {dict(request.args)}")

        user_id = get_jwt_identity()
        logging.debug(f"[DEBUG] get_game_files - user_id from JWT: {user_id}")

        if not user_id:
            logging.warning(f"[WARN] get_game_files: No user_id from JWT")
            return jsonify({"error": "Invalid token", "message": "No user ID in token"}), 401

        user = User.query.get(user_id)

        if not user:
            logging.debug(f"[DEBUG] get_game_files: User not found for user_id={user_id}")
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            logging.debug(f"[DEBUG] get_game_files: User {user_id} has no project_id")
            return jsonify({"error": "User must be assigned to a project"}), 403

        game_id = request.args.get("game_id", type=int)
        target_type = request.args.get("target_type", "auto")
        category = request.args.get("category", "all")
        status = request.args.get("status", "all")
        search = request.args.get("search", "")

        logging.debug(
            f"[DEBUG] get_game_files: game_id={game_id}, target_type={target_type}, category={category}, status={status}, search={search}, user_id={user_id}, project_id={user.project_id}"
        )

        if not game_id:
            logging.debug(f"[DEBUG] get_game_files: No game_id provided")
            return jsonify({"error": "Game ID is required"}), 400

        from ..models.games import Game
        from ..models.loaders import Loader

        game = None
        loader = None
        is_loader = False

        if target_type == "loader":

            loader = Loader.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not loader:
                logging.debug(
                    f"[DEBUG] get_game_files: Loader {game_id} not found for project_id={user.project_id}"
                )
                loader_exists = Loader.query.filter_by(id=game_id).first()
                if loader_exists:
                    logging.debug(
                        f"[DEBUG] get_game_files: Loader {game_id} exists but belongs to project_id={loader_exists.project_id}, not {user.project_id}"
                    )
                else:
                    logging.debug(f"[DEBUG] get_game_files: Loader {game_id} does not exist at all")
                return jsonify({"error": "Loader not found"}), 404
            is_loader = True
        elif target_type == "game":

            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                logging.debug(
                    f"[DEBUG] get_game_files: Game {game_id} not found for project_id={user.project_id}"
                )
                game_exists = Game.query.filter_by(id=game_id).first()
                if game_exists:
                    logging.debug(
                        f"[DEBUG] get_game_files: Game {game_id} exists but belongs to project_id={game_exists.project_id}, not {user.project_id}"
                    )
                else:
                    logging.debug(f"[DEBUG] get_game_files: Game {game_id} does not exist at all")
                return jsonify({"error": "Game not found"}), 404
        else:

            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                logging.debug(f"[DEBUG] get_game_files: Game {game_id} not found, trying loader...")
                loader = Loader.query.filter_by(id=game_id, project_id=user.project_id).first()
                if loader:
                    logging.debug(f"[DEBUG] get_game_files: Found Loader {game_id} instead of Game")
                    is_loader = True
                else:
                    logging.debug(
                        f"[DEBUG] get_game_files: Neither Game nor Loader {game_id} found for project_id={user.project_id}"
                    )

                    game_exists = Game.query.filter_by(id=game_id).first()
                    loader_exists = Loader.query.filter_by(id=game_id).first()
                    if game_exists or loader_exists:
                        logging.debug(
                            f"[DEBUG] get_game_files: {game_id} exists but belongs to different project"
                        )
                    else:
                        logging.debug(f"[DEBUG] get_game_files: {game_id} does not exist at all")
                    return jsonify({"error": "Game or Loader not found"}), 404
            else:
                logging.debug(f"[DEBUG] get_game_files: Found Game {game_id}")

        files_list = []

        if is_loader:

            logging.debug(f"[DEBUG] get_game_files: Processing Loader {game_id} files")

            if loader.logo:
                files_list.append(
                    {
                        "id": f"loader_logo_{game_id}",
                        "name": f"{loader.name} - Logo",
                        "type": "image",
                        "size": 0,
                        "path": loader.logo,
                        "modified": (
                            loader.updated_at.isoformat()
                            if loader.updated_at
                            else loader.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "logo",
                        "description": f"Logo for loader {loader.name}",
                        "download_count": 0,
                    }
                )

            if loader.banner:
                files_list.append(
                    {
                        "id": f"loader_banner_{game_id}",
                        "name": f"{loader.name} - Banner",
                        "type": "image",
                        "size": 0,
                        "path": loader.banner,
                        "modified": (
                            loader.updated_at.isoformat()
                            if loader.updated_at
                            else loader.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "banner",
                        "description": f"Banner for loader {loader.name}",
                        "download_count": 0,
                    }
                )

            if loader.background:
                files_list.append(
                    {
                        "id": f"loader_background_{game_id}",
                        "name": f"{loader.name} - Background",
                        "type": "image",
                        "size": 0,
                        "path": loader.background,
                        "modified": (
                            loader.updated_at.isoformat()
                            if loader.updated_at
                            else loader.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "background",
                        "description": f"Background for loader {loader.name}",
                        "download_count": 0,
                    }
                )

            if loader.file:
                files_list.append(
                    {
                        "id": f"loader_file_{game_id}",
                        "name": f"{loader.name} - File",
                        "type": "file",
                        "size": 0,
                        "path": loader.file,
                        "modified": (
                            loader.updated_at.isoformat()
                            if loader.updated_at
                            else loader.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "loader",
                        "description": f"File for loader {loader.name}",
                        "download_count": loader.downloads or 0,
                    }
                )
        else:

            logging.debug(f"[DEBUG] get_game_files: Processing Game {game_id} files")
            config_files = GameFileConfig.query.filter_by(game_id=game_id, is_active=True).all()
            extra_files = GameExtraFile.query.filter_by(game_id=game_id, is_active=True).all()

            logging.debug(
                f"[DEBUG] Found {len(config_files)} config files and {len(extra_files)} extra files for game {game_id}"
            )
            for extra in extra_files:
                logging.debug(
                    f"[DEBUG] Extra file: id={extra.id}, name={extra.name}, is_active={extra.is_active}, status={extra.status}"
                )

            if game.logo:
                files_list.append(
                    {
                        "id": f"game_logo_{game_id}",
                        "name": f"{game.name} - Logo",
                        "type": "image",
                        "size": 0,
                        "path": game.logo,
                        "modified": (
                            game.updated_at.isoformat()
                            if game.updated_at
                            else game.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "logo",
                        "description": f"Logo for game {game.name}",
                        "download_count": 0,
                    }
                )

            if game.banner:
                files_list.append(
                    {
                        "id": f"game_banner_{game_id}",
                        "name": f"{game.name} - Banner",
                        "type": "image",
                        "size": 0,
                        "path": game.banner,
                        "modified": (
                            game.updated_at.isoformat()
                            if game.updated_at
                            else game.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "banner",
                        "description": f"Banner for game {game.name}",
                        "download_count": 0,
                    }
                )

            if game.loader_file:
                files_list.append(
                    {
                        "id": f"game_loader_{game_id}",
                        "name": f"{game.name} - Loader",
                        "type": "file",
                        "size": 0,
                        "path": game.loader_file,
                        "modified": (
                            game.updated_at.isoformat()
                            if game.updated_at
                            else game.created_at.isoformat()
                        ),
                        "status": "active",
                        "gameId": game_id,
                        "category": "loader",
                        "description": f"Loader for game {game.name}",
                        "download_count": 0,
                    }
                )

            for config in config_files:
                if status != "all" and config.is_active != (status == "active"):
                    continue

                if search and search.lower() not in config.name.lower():
                    continue

                files_list.append(
                    {
                        "id": f"config_{config.id}",
                        "config_id": config.config_id,
                        "name": config.name,
                        "type": "file",
                        "size": config.file_size,
                        "path": config.file_path,
                        "modified": config.uploaded_at.isoformat(),
                        "status": "active" if config.is_active else "inactive",
                        "gameId": game_id,
                        "category": "config",
                        "description": config.description,
                        "version": config.version,
                        "download_count": config.download_count,
                        "rating": config.rating,
                    }
                )

            for extra in extra_files:
                if status != "all" and extra.status != status:
                    continue

                if search and search.lower() not in extra.name.lower():
                    continue

                files_list.append(
                    {
                        "id": f"extra_{extra.id}",
                        "name": extra.name,
                        "original_filename": extra.original_filename,
                        "type": "file",
                        "size": extra.file_size,
                        "path": extra.file_path,
                        "modified": extra.uploaded_at.isoformat(),
                        "status": extra.status,
                        "gameId": game_id,
                        "category": "resource",
                        "description": extra.description,
                        "download_count": extra.download_count,
                    }
                )

        if category != "all":
            files_list = [f for f in files_list if f["category"] == category]

        files_list.sort(key=lambda x: x["modified"], reverse=True)

        target_name = loader.name if is_loader else game.name
        logging.debug(
            f"[DEBUG] get_game_files: Returning {len(files_list)} files for {target_type} {game_id} ({target_name})"
        )

        return jsonify(
            {
                "files": files_list,
                "total": len(files_list),
                "target_type": "loader" if is_loader else "game",
                "target_name": target_name,
            }
        )
    except Exception as e:
        logging.error(f"[ERROR] get_game_files: Exception: {str(e)}")
        logging.error(f"[ERROR] get_game_files: Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch game files: {str(e)}"}), 500

@files_bp.route("/game-files/<int:game_id>/download/<file_type>", methods=["GET"])
@jwt_required()
@enforce_project_scope
def download_game_file(game_id, file_type):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    try:
        from ..models.games import Game

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game or game.project_id != user.project_id:
            return jsonify({"error": "Game not found"}), 404

        file_path, filename, error = file_service.get_game_file_path(game, file_type)
        if error:
            return jsonify({"error": error}), 404

        return send_file(file_path, as_attachment=True, download_name=filename)

    except Exception as e:
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

@files_bp.route("/game-files/<int:game_id>/<file_type>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_game_file(game_id, file_type):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 403

    try:
        from ..models.games import Game

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game or game.project_id != user.project_id:
            return jsonify({"error": "Game not found"}), 404

        success, error = file_service.delete_game_file(game, file_type)
        if not success:
            return jsonify({"error": error}), 404

        activity_service.log_activity(
            user,
            "delete_game_file",
            details=f"Deleted game {file_type} file for {game.name}",
            ip=request.remote_addr,
        )

        return jsonify({"message": f"Game {file_type} file deleted successfully"})

    except Exception as e:
        return jsonify({"error": f"Failed to delete game file: {str(e)}"}), 500

@files_bp.route("/folders", methods=["POST"])
@jwt_required()
@enforce_project_scope
def create_folder():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    data = request.get_json()
    folder_name = data.get("name")
    parent_path = data.get("parent_path", "/")
    game_id = data.get("game_id")

    success, error, folder_data = file_service.create_folder(folder_name, parent_path, game_id)
    if not success:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        user,
        "create_folder",
        details=f"Created folder: {folder_name} in {parent_path}",
        ip=request.remote_addr,
    )

    return (
        jsonify(
            {
                "message": "Folder created successfully",
                "folder": folder_data,
            }
        ),
        201,
    )

@files_bp.route("/folders/<path:folder_path>", methods=["DELETE"])
@jwt_required()
def delete_folder(folder_path):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    success, error = file_service.delete_folder(folder_path)
    if not success:
        status_code = 404 if error == "Folder not found" else 400
        return jsonify({"error": error}), status_code

    activity_service.log_activity(
        user, "delete_folder", details=f"Deleted folder: {folder_path}", ip=request.remote_addr
    )

    return jsonify({"message": "Folder deleted successfully"})

@files_bp.route("/game-files/config", methods=["POST"])
def upload_game_config():
    logging.debug(f"[DEBUG] Request: POST /api/files/game-files/config")
    logging.debug(f"[DEBUG] Cookies: {list(request.cookies.keys()) if request.cookies else 'none'}")

    user_id = None
    user = None

    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        if user_id:
            user = User.query.get(user_id)
            logging.debug(f"[DEBUG] JWT from cookies validated successfully for user {user_id}")
    except Exception as e:
        logging.debug(f"[DEBUG] JWT from cookies not available: {e}")

        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            logging.debug(f"[DEBUG] Processing Bearer token from Authorization header")

            try:
                from flask_jwt_extended import decode_token as jwt_decode_token

                decoded = jwt_decode_token(token)
                user_id = decoded["sub"]
                user = User.query.get(user_id)

                if user and not user.project_id:
                    return jsonify({"error": "User must be assigned to a project"}), 403
                logging.debug(
                    f"[DEBUG] JWT validation from Bearer token successful for user {user_id}"
                )
            except Exception as e:
                logging.debug(f"[DEBUG] JWT verification from Bearer token failed: {e}")

                pass

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    game_name = request.form.get("game_name", "")
    name = request.form.get("name", "")
    description = request.form.get("description", "")
    version = request.form.get("version", "1.0.0")
    is_public = request.form.get("is_public", "true").lower() == "true"

    if not game_name:
        return jsonify({"error": "Game name is required"}), 400

    from ..models.games import Game

    game = Game.query.filter_by(name=game_name, project_id=user.project_id).first()
    if not game:
        logging.debug(
            f"[DEBUG] Game with name '{game_name}' not found in project {user.project_id}"
        )
        return jsonify({"error": f'Game with name "{game_name}" not found'}), 404
    else:
        logging.debug(f"[DEBUG] Found game: {game.name} (ID: {game.id})")
        game_id = game.id

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    can_upload, message = file_service.check_storage_limit(user, file_size)
    if not can_upload:
        return jsonify({"error": message}), 400

    try:
        config_data, error = file_service.upload_game_config(
            user, file, game, name, description, version, is_public
        )
        if error:
            return jsonify({"error": error}), 400

        activity_service.log_activity(
            user,
            "upload_game_config",
            details=f"Uploaded game config: {config_data['name']} ({file_service.format_file_size(config_data['size'])}) for game {game_id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": "Game config uploaded successfully",
                    "config": config_data,
                }
            ),
            201,
        )

    except Exception as e:
        return jsonify({"error": f"Failed to upload game config: {str(e)}"}), 500

@files_bp.route("/game-files/extra", methods=["POST"])
@jwt_required()
@require_project_isolation
def upload_game_extra_file():
    logging.debug(f"[DEBUG] upload_game_extra_file called - endpoint: /api/files/game-files/extra")
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    game_id = request.form.get("game_id", type=int)
    name = request.form.get("name", "")
    description = request.form.get("description", "")

    if not game_id:
        return jsonify({"error": "Game ID is required"}), 400

    from ..models.games import Game

    game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
    if not game:
        return jsonify({"error": "Game not found or access denied"}), 404

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        file_data, error = file_service.upload_game_extra_file(user, file, game, name, description)
        if error:
            return jsonify({"error": error}), 400

        activity_service.log_activity(
            user,
            "upload_game_extra_file",
            details=f"Uploaded game extra file: {file_data['name']} ({file_service.format_file_size(file_data['size'])}) for game {game_id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": "Game extra file uploaded successfully",
                    "file": file_data,
                }
            ),
            201,
        )

    except Exception as e:
        return jsonify({"error": f"Failed to upload game extra file: {str(e)}"}), 500

@files_bp.route("/game-files/config/<int:config_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_game_config(config_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    config = (
        GameFileConfig.query.join(Game)
        .filter(GameFileConfig.id == config_id, Game.project_id == user.project_id)
        .first()
    )
    if not config:
        return jsonify({"error": "Config not found"}), 404

    try:
        success, error = file_service.delete_game_config(config, user)
        if not success:
            return jsonify({"error": error}), 500

        activity_service.log_activity(
            user,
            "delete_game_config",
            details=f"Deleted game config: {config.name}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Game config deleted successfully"})

    except Exception as e:
        return jsonify({"error": f"Failed to delete game config: {str(e)}"}), 500

@files_bp.route("/game-files/extra/<int:file_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_game_extra_file(file_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    from ..services.rbac import rbac_service

    if not user or not rbac_service.check_permission(user.id, "games.edit"):
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    extra_file = (
        GameExtraFile.query.join(Game)
        .filter(GameExtraFile.id == file_id, Game.project_id == user.project_id)
        .first()
    )
    if not extra_file:
        return jsonify({"error": "File not found"}), 404

    try:
        success, error = file_service.delete_game_extra_file(extra_file, user)
        if not success:
            return jsonify({"error": error}), 500

        activity_service.log_activity(
            user,
            "delete_game_extra_file",
            details=f"Deleted game extra file: {extra_file.name}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Game extra file deleted successfully"})

    except Exception as e:
        return jsonify({"error": f"Failed to delete game extra file: {str(e)}"}), 500

@files_bp.route("/stats/game/<int:game_id>", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_game_file_stats(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    configs = GameFileConfig.query.filter_by(game_id=game_id).all()
    extra_files = GameExtraFile.query.filter_by(game_id=game_id).all()

    total_configs = len(configs)
    total_extra_files = len(extra_files)
    total_size = sum(c.file_size for c in configs) + sum(e.file_size for e in extra_files)

    config_types = {}
    extra_types = {}

    for config in configs:
        file_type = config.file_type
        config_types[file_type] = config_types.get(file_type, 0) + 1

    for extra in extra_files:
        file_type = extra.file_type
        extra_types[file_type] = extra_types.get(file_type, 0) + 1

    return jsonify(
        {
            "overview": {
                "total_configs": total_configs,
                "total_extra_files": total_extra_files,
                "total_files": total_configs + total_extra_files,
                "total_size": total_size,
                "total_size_human": file_service.format_file_size(total_size),
            },
            "config_types": config_types,
            "extra_types": extra_types,
            "recent_uploads": [
                {
                    "name": config.name,
                    "type": "config",
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "size": config.file_size,
                }
                for config in sorted(configs, key=lambda x: x.uploaded_at, reverse=True)[:5]
            ]
            + [
                {
                    "name": extra.name,
                    "type": "extra",
                    "uploaded_at": extra.uploaded_at.isoformat(),
                    "size": extra.file_size,
                }
                for extra in sorted(extra_files, key=lambda x: x.uploaded_at, reverse=True)[:5]
            ],
        }
    )
