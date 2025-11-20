import json
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import User
from ..models.games import ChangelogEntry, Game
from ..models.keys import Key
from ..models.loaders import Loader, LoaderChangelog
from ..services.activity import activity_service
from ..utils.fulltext_search import fulltext_search_filter
from ..utils.rbac_utils import RBACManager

changelog_bp = Blueprint("changelog", __name__)

@changelog_bp.route("/games/<game_name>/changelog", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_game_changelog_by_name(game_name):
    """
    SECURITY FIX: This endpoint now requires authentication and validates project_id.
    Removed hardcoded allowed_games list - all games are accessible if user has proper project access.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:

        game = Game.query.filter_by(name=game_name, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": f'Game "{game_name}" not found'}), 404

        entries = (
            ChangelogEntry.query.filter_by(
                game_id=game.id, project_id=user.project_id, is_public=True
            )
            .order_by(ChangelogEntry.release_date.desc())
            .all()
        )

        changelog_data = []
        for entry in entries:
            changelog_data.append(
                {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "game_id": game.id,
                "game_name": game.name,
                "changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog: {str(e)}"}), 500

@changelog_bp.route("/games/<int:game_id>/changelog", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_game_changelog(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        entries = (
            ChangelogEntry.query.filter_by(
                game_id=game_id, project_id=user.project_id, is_public=True
            )
            .order_by(ChangelogEntry.release_date.desc())
            .all()
        )

        changelog_data = []
        for entry in entries:
            changelog_data.append(
                {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "game_id": game_id,
                "game_name": game.name,
                "changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog: {str(e)}"}), 500

@changelog_bp.route("/games/<int:game_id>/changelog", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_changelog_entry(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "applications.manage_changelog"
    ) or rbac_service.check_permission(user.id, "loaders.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        data = request.get_json()

        version = data.get("version")
        title = data.get("title")
        changes = data.get("changes", [])

        if not version or not title:
            return jsonify({"error": "Version and title are required"}), 400

        existing_entry = ChangelogEntry.query.filter_by(
            game_id=game_id, version=version, project_id=user.project_id
        ).first()

        if existing_entry:
            return jsonify({"error": "Version already exists for this game"}), 400

        changelog_entry = ChangelogEntry(
            game_id=game_id,
            version=version,
            title=title,
            description=data.get("description"),
            changes=json.dumps(changes) if changes else "[]",
            release_date=(
                datetime.fromisoformat(data["release_date"])
                if data.get("release_date")
                else datetime.utcnow()
            ),
            is_public=True,
            created_by=user_id,
            project_id=user.project_id,
        )

        db.session.add(changelog_entry)

        game.version = version
        game.updated_at = datetime.utcnow()

        db.session.commit()

        activity_service.log_activity(
            user,
            "create_changelog_entry",
            details=f"Created changelog entry {version} for game: {game.id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Changelog entry created successfully",
                    "entry": {
                        "id": changelog_entry.id,
                        "version": changelog_entry.version,
                        "title": changelog_entry.title,
                        "description": changelog_entry.description,
                        "changes": changelog_entry.changes_list,
                        "release_date": changelog_entry.release_date.isoformat(),
                        "is_public": changelog_entry.is_public,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create changelog entry: {str(e)}"}), 500

@changelog_bp.route("/changelog/<int:entry_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_changelog_entry(entry_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "applications.manage_changelog"
    ) or rbac_service.check_permission(user.id, "loaders.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        entry = ChangelogEntry.query.filter_by(id=entry_id, project_id=user.project_id).first()

        if not entry:
            return jsonify({"error": "Changelog entry not found"}), 404

        data = request.get_json()

        if "title" in data:
            entry.title = data["title"]
        if "description" in data:
            entry.description = data["description"]
        if "changes" in data:
            entry.changes = json.dumps(data["changes"]) if data["changes"] else "[]"
        if "release_date" in data and data["release_date"]:
            entry.release_date = datetime.fromisoformat(data["release_date"])

        db.session.commit()

        activity_service.log_activity(
            user,
            "update_changelog_entry",
            details=f"Updated changelog entry {entry.version} for game: {entry.game_id}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Changelog entry updated successfully",
                "entry": {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat(),
                    "is_public": entry.is_public,
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update changelog entry: {str(e)}"}), 500

@changelog_bp.route("/changelog/<int:entry_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_changelog_entry(entry_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "applications.manage_changelog"
    ) or rbac_service.check_permission(user.id, "loaders.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        entry = ChangelogEntry.query.filter_by(id=entry_id, project_id=user.project_id).first()

        if not entry:
            return jsonify({"error": "Changelog entry not found"}), 404

        game_name = entry.game.name
        version = entry.version

        db.session.delete(entry)
        db.session.commit()

        activity_service.log_activity(
            user,
            "delete_changelog_entry",
            details=f"Deleted changelog entry {version} for game: {entry.game_id}",
            ip=request.remote_addr,
        )

        return jsonify({"success": True, "message": "Changelog entry deleted successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete changelog entry: {str(e)}"}), 500

@changelog_bp.route("/changelog/<int:entry_id>", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_changelog_entry(entry_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        entry = ChangelogEntry.query.filter_by(id=entry_id, project_id=user.project_id).first()

        if not entry:
            return jsonify({"error": "Changelog entry not found"}), 404

        return jsonify(
            {
                "success": True,
                "entry": {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                    "game_id": entry.game_id,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog entry: {str(e)}"}), 500

@changelog_bp.route("/games/<int:game_id>/changelog/latest", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_latest_changelog(game_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        latest_entry = (
            ChangelogEntry.query.filter_by(
                game_id=game_id, project_id=user.project_id, is_public=True
            )
            .order_by(ChangelogEntry.release_date.desc())
            .first()
        )

        if not latest_entry:
            return jsonify(
                {
                    "success": True,
                    "game_id": game_id,
                    "game_name": game.name,
                    "latest_changelog": None,
                }
            )

        return jsonify(
            {
                "success": True,
                "game_id": game_id,
                "game_name": game.name,
                "latest_changelog": {
                    "id": latest_entry.id,
                    "version": latest_entry.version,
                    "title": latest_entry.title,
                    "description": latest_entry.description,
                    "changes": latest_entry.changes_list,
                    "release_date": latest_entry.release_date.isoformat(),
                    "is_public": latest_entry.is_public,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch latest changelog: {str(e)}"}), 500

@changelog_bp.route("/changelog/search", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def search_changelog():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        query = request.args.get("q", "")
        game_id = request.args.get("game_id", type=int)
        version = request.args.get("version", "")

        search_query = ChangelogEntry.query.filter_by(project_id=user.project_id, is_public=True)

        if game_id:
            search_query = search_query.filter_by(game_id=game_id)

        if version:

            search_query = fulltext_search_filter(search_query, version, "search_vector")

        if query:

            search_query = fulltext_search_filter(search_query, query, "search_vector")

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        pagination = search_query.order_by(ChangelogEntry.release_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        results = []
        for entry in pagination.items:
            results.append(
                {
                    "id": entry.id,
                    "game_id": entry.game_id,
                    "game_name": entry.game.name,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat(),
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "results": results,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to search changelog: {str(e)}"}), 500

@changelog_bp.route("/loaders/<int:loader_id>/changelog", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loader_changelog(loader_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found"}), 404

        entries = (
            LoaderChangelog.query.filter_by(
                loader_id=loader_id, project_id=user.project_id, is_public=True
            )
            .order_by(LoaderChangelog.release_date.desc())
            .all()
        )

        changelog_data = []
        for entry in entries:
            changelog_data.append(
                {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "change_type": entry.change_type,
                    "custom_type_name": entry.custom_type_name,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "loader_id": loader_id,
                "loader_name": loader.name,
                "changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog: {str(e)}"}), 500

@changelog_bp.route("/loaders/<int:loader_id>/changelog", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_loader_changelog_entry(loader_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "applications.manage_changelog"
    ) or rbac_service.check_permission(user.id, "loaders.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found"}), 404

        data = request.get_json()

        version = data.get("version")
        title = data.get("title")
        changes = data.get("changes", [])
        change_type = data.get("change_type", "release")
        custom_type_name = data.get("custom_type_name")

        if not version or not title:
            return jsonify({"error": "Version and title are required"}), 400

        existing_entry = LoaderChangelog.query.filter_by(
            loader_id=loader_id, version=version, project_id=user.project_id
        ).first()

        if existing_entry:
            return jsonify({"error": "Version already exists for this loader"}), 400

        new_entry = LoaderChangelog(
            loader_id=loader_id,
            version=version,
            title=title,
            description=data.get("description"),
            changes=json.dumps(changes),
            change_type=change_type,
            custom_type_name=custom_type_name,
            release_date=(
                datetime.fromisoformat(data.get("release_date"))
                if data.get("release_date")
                else datetime.utcnow()
            ),
            is_public=True,
            created_by=user.id,
            project_id=user.project_id,
        )

        db.session.add(new_entry)
        db.session.commit()

        loader.version = version
        loader.changelog = title
        loader.updated_at = datetime.utcnow()
        db.session.commit()

        activity_service.log_activity(
            user,
            "loader_changelog_created",
            details=f"Created changelog entry v{version} for loader: {loader.id}",
        )

        return jsonify(
            {
                "success": True,
                "message": "Changelog entry created successfully",
                "entry": {
                    "id": new_entry.id,
                    "version": new_entry.version,
                    "title": new_entry.title,
                    "change_type": new_entry.change_type,
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create changelog entry: {str(e)}"}), 500

@changelog_bp.route("/loaders/<int:loader_id>/changelog/latest", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_latest_loader_changelog(loader_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found"}), 404

        latest_entry = (
            LoaderChangelog.query.filter_by(
                loader_id=loader_id, project_id=user.project_id, is_public=True
            )
            .order_by(LoaderChangelog.release_date.desc())
            .first()
        )

        if not latest_entry:
            return jsonify(
                {
                    "success": True,
                    "loader_id": loader_id,
                    "loader_name": loader.name,
                    "latest_changelog": None,
                    "message": "No changelog entries found",
                }
            )

        changelog_data = {
            "id": latest_entry.id,
            "version": latest_entry.version,
            "title": latest_entry.title,
            "description": latest_entry.description,
            "changes": latest_entry.changes_list,
            "change_type": latest_entry.change_type,
            "custom_type_name": latest_entry.custom_type_name,
            "release_date": (
                latest_entry.release_date.isoformat() if latest_entry.release_date else None
            ),
            "is_public": latest_entry.is_public,
        }

        return jsonify(
            {
                "success": True,
                "loader_id": loader_id,
                "loader_name": loader.name,
                "latest_changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch latest changelog: {str(e)}"}), 500
