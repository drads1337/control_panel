"""
Cache Management Routes
Provides endpoints for cache administration and monitoring
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..middleware.auth import require_project_isolation
from ..models.core import User
from ..services.cache import cache_service
from ..utils.rbac_utils import RBACManager

cache_bp = Blueprint("cache", __name__, url_prefix="/api/cache")


@cache_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_cache_stats():
    """Get cache statistics"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Only admins and owners can view cache stats
    from ..services.rbac import rbac_service

    if not rbac_service.check_permission(user.id, "system.view_logs"):
        return jsonify({"error": "Access denied"}), 403

    try:
        stats = cache_service.get_cache_stats()
        return jsonify({"success": True, "stats": stats})
    except Exception as e:
        return jsonify({"error": f"Failed to get cache stats: {str(e)}"}), 500


@cache_bp.route("/clear", methods=["POST"])
@jwt_required()
@require_project_isolation
def clear_cache():
    """Clear all cache entries"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Only admins and owners can clear cache
    if not RBACManager.has_any_role(user, ["admin", "owner"]):
        return jsonify({"error": "Access denied"}), 403

    try:
        deleted_count = cache_service.clear_all_cache()
        return jsonify(
            {
                "success": True,
                "message": f"Cache cleared successfully",
                "deleted_keys": deleted_count,
            }
        )
    except Exception as e:
        return jsonify({"error": f"Failed to clear cache: {str(e)}"}), 500


@cache_bp.route("/cleanup", methods=["POST"])
@jwt_required()
@require_project_isolation
def cleanup_cache():
    """Clean up expired cache entries"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Only admins and owners can cleanup cache
    if not RBACManager.has_any_role(user, ["admin", "owner"]):
        return jsonify({"error": "Access denied"}), 403

    try:
        cleaned_count = cache_service.cleanup_expired_cache()
        return jsonify(
            {"success": True, "message": f"Cache cleanup completed", "cleaned_keys": cleaned_count}
        )
    except Exception as e:
        return jsonify({"error": f"Failed to cleanup cache: {str(e)}"}), 500


@cache_bp.route("/invalidate/<cache_type>", methods=["POST"])
@jwt_required()
@require_project_isolation
def invalidate_cache_type(cache_type):
    """Invalidate cache entries by type"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Only admins and owners can invalidate cache
    if not RBACManager.has_any_role(user, ["admin", "owner"]):
        return jsonify({"error": "Access denied"}), 403

    try:
        # Get project_id from request or use user's project
        project_id = request.json.get("project_id") if request.json else None
        if not project_id:
            project_id = user.project_id

        if cache_type == "games" and project_id:
            from ..services.games import game_service

            deleted_count = game_service.invalidate_game_cache(project_id)
        else:
            # Generic cache invalidation
            pattern = f"{cache_type}:*"
            if project_id:
                pattern = f"{cache_type}:project_id={project_id}:*"
            deleted_count = cache_service.invalidate_pattern(pattern)

        return jsonify(
            {
                "success": True,
                "message": f"Cache invalidated for type: {cache_type}",
                "deleted_keys": deleted_count,
            }
        )
    except Exception as e:
        return jsonify({"error": f"Failed to invalidate cache: {str(e)}"}), 500
