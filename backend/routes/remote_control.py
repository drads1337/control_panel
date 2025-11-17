"""
Remote Control Routes
Handles remote control categories and features management
"""

import logging
from datetime import datetime

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import jwt_required

from ..core.extensions import db
from ..middleware.auth import (
    enforce_project_scope,
    require_any_permission,
    require_project_with_grace_period,
    require_role,
    require_user,
)
from ..models.core import Project, User
from ..models.remote_control import RemoteCategory, RemoteFeature, RemoteFeatureLog
from ..services.activity import activity_service
from ..utils.role_constants import RolePermissions

remote_control_bp = Blueprint("remote_control", __name__)

# ==================== CATEGORIES ====================


@remote_control_bp.route("/categories", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.view"])
def get_categories(project_id=None):
    """Get all remote control categories for the current project"""
    try:
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            # For owners, project_id must be specified
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        categories = RemoteCategory.query.filter_by(project_id=project_id).all()

        result = {"success": True, "categories": [category.to_dict() for category in categories]}

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error getting categories: {e}", exc_info=True)
        return jsonify({"error": f"Failed to get categories: {str(e)}"}), 500


@remote_control_bp.route("/categories", methods=["POST"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def create_category(project_id=None, current_user=None):
    """Create a new remote control category"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        if not data.get("name") or not data.get("name").strip():
            return jsonify({"error": "Category name is required"}), 400

        # Check if category with same name already exists in project
        existing_category = RemoteCategory.query.filter_by(
            name=data["name"].strip(), project_id=project_id
        ).first()

        if existing_category:
            return jsonify({"error": "Category with this name already exists"}), 400

        # Check maximum sections limit (8)
        current_categories_count = RemoteCategory.query.filter_by(project_id=project_id).count()
        if current_categories_count >= 8:
            return (
                jsonify(
                    {
                        "error": "Maximum of 8 sections allowed. Please delete a section before creating a new one."
                    }
                ),
                400,
            )

        # Create new category
        category = RemoteCategory(
            name=data["name"].strip(),
            description=data.get("description", "").strip(),
            color=data.get("color", "#3b82f6"),
            project_id=project_id,
        )

        db.session.add(category)
        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_category_created",
            details=f"Created category: {category.name}",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return (
            jsonify(
                {
                    "success": True,
                    "category": category.to_dict(),
                    "message": f'Category "{category.name}" created successfully',
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating category: {e}", exc_info=True)
        return jsonify({"error": "Failed to create category"}), 500


@remote_control_bp.route("/categories/<int:category_id>", methods=["PUT"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def update_category(category_id, project_id=None, current_user=None):
    """Update a remote control category"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        category = RemoteCategory.query.filter_by(id=category_id, project_id=project_id).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        if not data.get("name") or not data.get("name").strip():
            return jsonify({"error": "Category name is required"}), 400

        # Check if another category with same name already exists in project
        existing_category = RemoteCategory.query.filter(
            RemoteCategory.name == data["name"].strip(),
            RemoteCategory.project_id == project_id,
            RemoteCategory.id != category_id,
        ).first()

        if existing_category:
            return jsonify({"error": "Category with this name already exists"}), 400

        # Update category
        old_name = category.name
        category.name = data["name"].strip()
        category.description = data.get("description", "").strip()
        category.color = data.get("color", category.color)
        category.updated_at = datetime.utcnow()

        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_category_updated",
            details=f"Updated category: {old_name} -> {category.name}",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return jsonify(
            {
                "success": True,
                "category": category.to_dict(),
                "message": f'Category "{category.name}" updated successfully',
            }
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating category: {e}", exc_info=True)
        return jsonify({"error": "Failed to update category"}), 500


@remote_control_bp.route("/categories/<int:category_id>", methods=["DELETE"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def delete_category(category_id, project_id=None, current_user=None):
    """Delete a remote control category"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        category = RemoteCategory.query.filter_by(id=category_id, project_id=project_id).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

        # Check if category has features
        features_count = RemoteFeature.query.filter_by(category_id=category_id).count()
        if features_count > 0:
            return (
                jsonify(
                    {
                        "error": f"Cannot delete category with {features_count} features. Please delete or move features first."
                    }
                ),
                400,
            )

        category_name = category.name
        db.session.delete(category)
        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_category_deleted",
            details=f"Deleted category: {category_name}",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return jsonify(
            {"success": True, "message": f'Category "{category_name}" deleted successfully'}
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting category: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete category"}), 500


@remote_control_bp.route("/features", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.view"])
def get_features(project_id=None):
    """Get all remote control features for the current project"""
    try:
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            # For owners, project_id must be specified
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        # Get query parameters
        category_id = request.args.get("category_id", type=int)

        # Build query
        query = RemoteFeature.query.filter_by(project_id=project_id)
        if category_id:
            query = query.filter_by(category_id=category_id)

        features = query.all()

        result = {"success": True, "features": [feature.to_dict() for feature in features]}

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error getting features: {e}", exc_info=True)
        return jsonify({"error": f"Failed to get features: {str(e)}"}), 500


@remote_control_bp.route("/features", methods=["POST"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def create_feature(project_id=None, current_user=None):
    """Create a new remote control feature"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        if not data.get("name") or not data.get("name").strip():
            return jsonify({"error": "Feature name is required"}), 400

        if not data.get("category_id"):
            return jsonify({"error": "Category is required"}), 400

        # Verify category exists and belongs to project
        category = RemoteCategory.query.filter_by(
            id=data["category_id"], project_id=project_id
        ).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

        # Check if feature with same name already exists in project
        existing_feature = RemoteFeature.query.filter_by(
            name=data["name"].strip(), project_id=project_id
        ).first()

        if existing_feature:
            return jsonify({"error": "Feature with this name already exists"}), 400

        # Create new feature
        feature = RemoteFeature(
            name=data["name"].strip(),
            description=data.get("description", "").strip(),
            enabled=data.get("enabled", False),
            category_id=data["category_id"],
            project_id=project_id,
            status=data.get("status", "offline"),
        )

        # Set configuration if provided
        if data.get("configuration"):
            feature.set_configuration(data["configuration"])

        db.session.add(feature)
        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_feature_created",
            details=f"Created feature: {feature.name} in category {category.name}",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return (
            jsonify(
                {
                    "success": True,
                    "feature": feature.to_dict(),
                    "message": f'Feature "{feature.name}" created successfully',
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating feature: {e}", exc_info=True)
        return jsonify({"error": "Failed to create feature"}), 500


@remote_control_bp.route("/features/<int:feature_id>", methods=["PUT"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def update_feature(feature_id, project_id=None, current_user=None):
    """Update a remote control feature"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        feature = RemoteFeature.query.filter_by(id=feature_id, project_id=project_id).first()

        if not feature:
            return jsonify({"error": "Feature not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        if not data.get("name") or not data.get("name").strip():
            return jsonify({"error": "Feature name is required"}), 400

        if not data.get("category_id"):
            return jsonify({"error": "Category is required"}), 400

        # Verify category exists and belongs to project
        category = RemoteCategory.query.filter_by(
            id=data["category_id"], project_id=project_id
        ).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

        # Check if another feature with same name already exists in project
        existing_feature = RemoteFeature.query.filter(
            RemoteFeature.name == data["name"].strip(),
            RemoteFeature.project_id == project_id,
            RemoteFeature.id != feature_id,
        ).first()

        if existing_feature:
            return jsonify({"error": "Feature with this name already exists"}), 400

        # Update feature
        old_name = feature.name
        old_enabled = feature.enabled
        feature.name = data["name"].strip()
        feature.description = data.get("description", "").strip()
        feature.enabled = data.get("enabled", feature.enabled)
        feature.category_id = data["category_id"]
        feature.status = data.get("status", feature.status)
        feature.updated_at = datetime.utcnow()

        # Update configuration if provided
        if "configuration" in data:
            feature.set_configuration(data["configuration"])

        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_feature_updated",
            details=f"Updated feature: {old_name} (enabled: {old_enabled} -> {feature.enabled})",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return jsonify(
            {
                "success": True,
                "feature": feature.to_dict(),
                "message": f'Feature "{feature.name}" updated successfully',
            }
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating feature: {e}", exc_info=True)
        return jsonify({"error": "Failed to update feature"}), 500


@remote_control_bp.route("/features/<int:feature_id>", methods=["DELETE"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def delete_feature(feature_id, project_id=None, current_user=None):
    """Delete a remote control feature"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        feature = RemoteFeature.query.filter_by(id=feature_id, project_id=project_id).first()

        if not feature:
            return jsonify({"error": "Feature not found"}), 404

        feature_name = feature.name
        db.session.delete(feature)
        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_feature_deleted",
            details=f"Deleted feature: {feature_name}",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return jsonify(
            {"success": True, "message": f'Feature "{feature_name}" deleted successfully'}
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting feature: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete feature"}), 500


@remote_control_bp.route("/features/<int:feature_id>/toggle", methods=["POST"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.create", "remote_control.edit"])
def toggle_feature(feature_id, project_id=None, current_user=None):
    """Toggle a remote control feature on/off"""
    try:
        # Fallback to g for backward compatibility if not passed explicitly
        if current_user is None:
            current_user = g.current_user
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        feature = RemoteFeature.query.filter_by(id=feature_id, project_id=project_id).first()

        if not feature:
            return jsonify({"error": "Feature not found"}), 404

        # Toggle feature
        old_enabled = feature.enabled
        feature.enabled = not feature.enabled
        feature.updated_at = datetime.utcnow()

        db.session.commit()

        # Log activity
        activity_service.log_activity(
            current_user,
            "remote_feature_toggled",
            details=f"Toggled feature: {feature.name} ({old_enabled} -> {feature.enabled})",
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )

        return jsonify(
            {
                "success": True,
                "feature": feature.to_dict(),
                "message": f'Feature "{feature.name}" {"enabled" if feature.enabled else "disabled"} for all clients',
            }
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error toggling feature: {e}", exc_info=True)
        return jsonify({"error": "Failed to toggle feature"}), 500


# ==================== STATISTICS ====================


@remote_control_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.view", "remote_control.view_stats"])
def get_stats(project_id=None):
    """Get remote control statistics for the current project"""
    try:
        # project_id is passed explicitly by enforce_project_scope decorator
        if project_id is None:
            # For owners, project_id must be specified
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        # Get categories with feature counts
        categories = RemoteCategory.query.filter_by(project_id=project_id).all()
        stats = []

        for category in categories:
            features = RemoteFeature.query.filter_by(
                category_id=category.id, project_id=project_id
            ).all()

            enabled_count = sum(1 for f in features if f.enabled)
            total_count = len(features)

            stats.append(
                {"category": category.to_dict(), "enabled": enabled_count, "total": total_count}
            )

        return jsonify({"success": True, "stats": stats})

    except Exception as e:
        logging.error(f"Error getting stats: {e}", exc_info=True)
        return jsonify({"error": f"Failed to get statistics: {str(e)}"}), 500
