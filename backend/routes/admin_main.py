"""
Admin Routes
Handles administrative operations and system maintenance tasks
"""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..models.core import User
from ..services.admin import admin_service
from ..services.rbac import rbac_service
from ..services.users import user_service

# Create admin blueprint
admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

logger = logging.getLogger(__name__)


@admin_bp.route("/projects/deactivate-expired", methods=["POST"])
@jwt_required()
def deactivate_expired_projects():
    """
    Deactivate expired projects and clean up expired invite codes
    This should be called by a scheduled task, not directly by users
    """
    try:
        user_id = get_jwt_identity()
        user = user_service.get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check admin permissions
        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        deactivated_count, cleaned_codes, error = admin_service.deactivate_expired_projects(user)

        if error:
            return jsonify({"error": error}), 500

        return jsonify(
            {
                "message": f"Successfully deactivated {deactivated_count} expired projects and cleaned up {cleaned_codes} expired invite codes",
                "deactivated_projects": deactivated_count,
                "cleaned_codes": cleaned_codes,
            }
        )

    except Exception as e:
        logger.error(f"Error in deactivate_expired_projects: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@admin_bp.route("/projects/cleanup-expired", methods=["POST"])
@jwt_required()
def cleanup_expired_projects():
    """
    Permanently delete projects that have been expired for more than grace period
    This should be called by a scheduled task, not directly by users
    """
    try:
        user_id = get_jwt_identity()
        user = user_service.get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check admin permissions
        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        deleted_count, deleted_projects, error = admin_service.cleanup_expired_projects(user)

        if error:
            return jsonify({"error": error}), 500

        return jsonify(
            {
                "message": f"Successfully deleted {deleted_count} expired projects",
                "deleted_projects": deleted_count,
                "deleted_project_names": deleted_projects,
            }
        )

    except Exception as e:
        logger.error(f"Error in cleanup_expired_projects: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@admin_bp.route("/system/stats", methods=["GET"])
@jwt_required()
def get_system_stats():
    """Get system statistics for admin dashboard"""
    try:
        user_id = get_jwt_identity()
        user = user_service.get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check admin permissions
        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        stats = admin_service.get_system_stats(user)

        if "error" in stats:
            return jsonify(stats), 500

        return jsonify(stats)

    except Exception as e:
        logger.error(f"Error in get_system_stats: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@admin_bp.route("/projects/expired", methods=["GET"])
@jwt_required()
def get_expired_projects():
    """Get information about expired projects"""
    try:
        user_id = get_jwt_identity()
        user = user_service.get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check admin permissions
        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        projects_info = admin_service.get_expired_projects_info(user)

        return jsonify({"expired_projects": projects_info, "count": len(projects_info)})

    except Exception as e:
        logger.error(f"Error in get_expired_projects: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@admin_bp.route("/projects/<int:project_id>/suspend", methods=["POST"])
@jwt_required()
def suspend_project(project_id):
    """Suspend a project"""
    try:
        user_id = get_jwt_identity()
        user = user_service.get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check admin permissions
        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        data = request.get_json() or {}
        reason = data.get("reason", "")

        success, error = admin_service.suspend_project(project_id, user, reason)

        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Project suspended successfully"})

    except Exception as e:
        logger.error(f"Error in suspend_project: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@admin_bp.route("/projects/<int:project_id>/reactivate", methods=["POST"])
@jwt_required()
def reactivate_project(project_id):
    """Reactivate a suspended or expired project"""
    try:
        user_id = get_jwt_identity()
        user = user_service.get_user_by_id(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check admin permissions
        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        data = request.get_json() or {}
        new_expiry_date_str = data.get("new_expiry_date")

        # Use service to reactivate project (date parsing is handled in service)
        success, error = admin_service.reactivate_project(project_id, user, new_expiry_date_str=new_expiry_date_str)

        if not success:
            return jsonify({"error": error}), 400

        return jsonify({"message": "Project reactivated successfully"})

    except Exception as e:
        logger.error(f"Error in reactivate_project: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
