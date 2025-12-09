"""
Remote Control Routes
Handles remote control categories and features management
"""

import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..core.extensions import db
from ..utils.service_helpers import get_service
from ..middleware.auth import (
    enforce_project_scope,
    require_any_permission,
    require_project_with_grace_period,
    require_role,
    require_user,
)
from ..middleware.validation import validate_request
from ..models.core import Project, User
from ..models.products import Product
from ..models.remote_control import RemoteCategory, RemoteFeature, RemoteFeatureLog
from ..schemas.remote_control import (
    RemoteCategoryCreateSchema,
    RemoteCategoryUpdateSchema,
    RemoteFeatureCreateSchema,
    RemoteFeatureUpdateSchema,
)
from ..utils.role_constants import RolePermissions

remote_control_bp = Blueprint("remote_control", __name__)

@remote_control_bp.route("/categories", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.view"])
def get_categories(project_id=None):
    """Get all remote control categories for the current project and product/product"""
    try:



        tier_limits_service = get_service('tier_limits_service')
        if project_id:
            project = Project.query.get(project_id)
            if project:
                enabled, error_msg = tier_limits_service.check_remote_control_enabled(project)
                if not enabled:
                    return jsonify({"error": error_msg}), 403

        if project_id is None:

            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )


        product_id_param = request.args.get("product_id")
        if not product_id_param:
            return (
                jsonify({"error": "Product ID is required. Please specify product_id (or product_id) parameter."}),
                400,
            )


        product = None

        if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
            try:
                product_id_int = int(product_id_param)
                product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            except (ValueError, TypeError):
                pass
        

        if not product:
            product = Product.query.filter_by(unique_id=str(product_id_param), project_id=project_id).first()
        
        if not product:
            return jsonify({"error": "Product not found or does not belong to this project"}), 404
        
        product_id = product.id

        categories = RemoteCategory.query.filter_by(project_id=project_id, product_id=product_id).all()

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
@validate_request(RemoteCategoryCreateSchema)
def create_category(current_user, project_id=None, validated_data=None):
    """Create a new remote control category"""
    activity_service = get_service('activity_service')
    tier_limits_service = get_service('tier_limits_service')
    
    if validated_data is None:
        logging.error(f"create_category: validated_data is None")
        logging.error(f"Request method: {request.method}, path: {request.path}")
        logging.error(f"Request data: {request.get_data(as_text=True)[:500]}")
        logging.error(f"Content-Type: {request.headers.get('Content-Type')}")
        return jsonify({"error": "No data provided"}), 400
    
    if not isinstance(validated_data, dict):
        logging.error(f"create_category: validated_data is not a dict: {type(validated_data)}")
        return jsonify({"error": "Invalid data format"}), 400
    
    if not validated_data:
        logging.error(f"create_category: validated_data is empty dict")
        logging.error(f"Request data: {request.get_data(as_text=True)[:500]}")
        logging.error(f"Content-Type: {request.headers.get('Content-Type')}")
        return jsonify({"error": "No data provided"}), 400


    if project_id:
        project = Project.query.get(project_id)
        if project:
            enabled, error_msg = tier_limits_service.check_remote_control_enabled(project)
            if not enabled:
                return jsonify({"error": error_msg}), 403

    name = validated_data.get('name')
    product_id = validated_data.get('product_id')
    description = validated_data.get('description', '')
    color = validated_data.get('color', '#3b82f6')
    
    if not name:
        return jsonify({"error": "Category name is required"}), 400
    if not product_id:
        return jsonify({"error": "Product ID is required"}), 400
    
    try:
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )
            
        product = None

        if isinstance(product_id, int) or (isinstance(product_id, str) and product_id.isdigit()):
            try:
                product_id_int = int(product_id)
                product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            except (ValueError, TypeError):
                pass
        
        if not product:
            product = Product.query.filter_by(unique_id=str(product_id), project_id=project_id).first()
        
        if not product:
            return jsonify({"error": "Product not found or does not belong to this project"}), 404
        
        product_id = product.id

        existing_category = RemoteCategory.query.filter_by(
            name=name, project_id=project_id, product_id=product_id
        ).first()

        if existing_category:
            return jsonify({"error": "Category with this name already exists for this product"}), 400

        current_categories_count = RemoteCategory.query.filter_by(
            project_id=project_id, product_id=product_id
        ).count()
        if current_categories_count >= 8:
            return (
                jsonify(
                    {
                        "error": "Maximum of 8 sections allowed per product. Please delete a section before creating a new one."
                    }
                ),
                400,
            )

        category = RemoteCategory(
            name=name,
            description=description,
            color=color,
            project_id=project_id,
            product_id=product_id,
        )

        db.session.add(category)
        db.session.commit()

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
@validate_request(RemoteCategoryUpdateSchema)
def update_category(category_id, current_user, project_id=None, validated_data=None):
    """Update a remote control category"""
    activity_service = get_service('activity_service')
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400
    try:
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        category = RemoteCategory.query.filter_by(id=category_id, project_id=project_id).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400


        product_id_value = validated_data.get('product_id')
        if product_id_value is not None and product_id_value != category.product_id:
            product = Product.query.filter_by(id=product_id_value, project_id=project_id).first()
            if not product:
                return jsonify({"error": "Product not found or does not belong to this project"}), 404

        product_id = product_id_value if product_id_value is not None else category.product_id
        
        old_name = category.name
        name_value = validated_data.get('name')
        if name_value is not None:
            existing_category = RemoteCategory.query.filter(
                RemoteCategory.name == name_value,
                RemoteCategory.project_id == project_id,
                RemoteCategory.product_id == product_id,
                RemoteCategory.id != category_id,
            ).first()

            if existing_category:
                return jsonify({"error": "Category with this name already exists for this product"}), 400
            category.name = name_value

        description_value = validated_data.get('description')
        if description_value is not None:
            category.description = description_value
        color_value = validated_data.get('color')
        if color_value is not None:
            category.color = color_value
        if product_id_value is not None and product_id_value != category.product_id:
            category.product_id = product_id_value
        category.updated_at = datetime.utcnow()

        db.session.commit()

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
def delete_category(category_id, current_user, project_id=None):
    """Delete a remote control category"""
    activity_service = get_service('activity_service')
    
    try:
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        category = RemoteCategory.query.filter_by(id=category_id, project_id=project_id).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

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
    """Get all remote control features for the current project and product"""
    try:

        if project_id is None:

            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )


        product_id_param = request.args.get("product_id")
        category_id = request.args.get("category_id", type=int)

        query = RemoteFeature.query.filter_by(project_id=project_id)
        if product_id_param:

            product = None

            if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
                try:
                    product_id_int = int(product_id_param)
                    product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
                except (ValueError, TypeError):
                    pass
            

            if not product:
                product = Product.query.filter_by(unique_id=str(product_id_param), project_id=project_id).first()
            
            if not product:
                return jsonify({"error": "Product not found or does not belong to this project"}), 404
            
            product_id = product.id
            query = query.filter_by(product_id=product_id)
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
@validate_request(RemoteFeatureCreateSchema)
def create_feature(current_user, project_id=None, validated_data=None):
    """Create a new remote control feature"""
    activity_service = get_service('activity_service')
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    name = validated_data.get('name')
    category_id = validated_data.get('category_id')
    description = validated_data.get('description', '')
    enabled = validated_data.get('enabled', False)
    status = validated_data.get('status', 'offline')
    configuration = validated_data.get('configuration')
    try:
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )


        category = RemoteCategory.query.filter_by(
            id=category_id, project_id=project_id
        ).first()

        if not category:
            return jsonify({"error": "Category not found"}), 404

        existing_feature = RemoteFeature.query.filter_by(
            name=name, project_id=project_id, product_id=category.product_id
        ).first()

        if existing_feature:
            return jsonify({"error": "Feature with this name already exists for this product"}), 400

        feature = RemoteFeature(
            name=name,
            description=description,
            enabled=enabled,
            category_id=category_id,
            project_id=project_id,
            product_id=category.product_id,
            status=status,
        )

        if configuration:
            feature.set_configuration(configuration)

        db.session.add(feature)
        db.session.commit()

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
@validate_request(RemoteFeatureUpdateSchema)
def update_feature(feature_id, current_user, project_id=None, validated_data=None):
    """Update a remote control feature"""
    activity_service = get_service('activity_service')
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400
    try:
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        feature = RemoteFeature.query.filter_by(id=feature_id, project_id=project_id).first()

        if not feature:
            return jsonify({"error": "Feature not found"}), 404

        old_name = feature.name
        old_enabled = feature.enabled
        
        category_id_value = validated_data.get('category_id')
        if category_id_value is not None:
            category = RemoteCategory.query.filter_by(
                id=category_id_value, project_id=project_id
            ).first()

            if not category:
                return jsonify({"error": "Category not found"}), 404

            new_product_id = category.product_id
        else:

            category = RemoteCategory.query.filter_by(
                id=feature.category_id, project_id=project_id
            ).first()
            if not category:
                return jsonify({"error": "Existing category not found"}), 404
            new_product_id = category.product_id

        name_value = validated_data.get('name')
        if name_value is not None:
            existing_feature = RemoteFeature.query.filter(
                RemoteFeature.name == name_value,
                RemoteFeature.project_id == project_id,
                RemoteFeature.product_id == new_product_id,
                RemoteFeature.id != feature_id,
            ).first()

            if existing_feature:
                return jsonify({"error": "Feature with this name already exists for this product"}), 400
            feature.name = name_value

        description_value = validated_data.get('description')
        if description_value is not None:
            feature.description = description_value
        enabled_value = validated_data.get('enabled')
        if enabled_value is not None:
            feature.enabled = enabled_value
        if category_id_value is not None:
            feature.category_id = category_id_value
            feature.product_id = new_product_id
        status_value = validated_data.get('status')
        if status_value is not None:
            feature.status = status_value
        feature.updated_at = datetime.utcnow()

        configuration_value = validated_data.get('configuration')
        if configuration_value is not None:
            feature.set_configuration(configuration_value)

        db.session.commit()

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
def delete_feature(feature_id, current_user, project_id=None):
    """Delete a remote control feature"""
    activity_service = get_service('activity_service')
    
    try:
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
def toggle_feature(feature_id, current_user, project_id=None):
    """Toggle a remote control feature on/off"""
    activity_service = get_service('activity_service')
    
    try:
        if project_id is None:
            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )

        feature = RemoteFeature.query.filter_by(id=feature_id, project_id=project_id).first()

        if not feature:
            return jsonify({"error": "Feature not found"}), 404

        old_enabled = feature.enabled
        feature.enabled = not feature.enabled
        feature.updated_at = datetime.utcnow()

        db.session.commit()

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

@remote_control_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_any_permission(["remote_control.view", "remote_control.view_stats"])
def get_stats(project_id=None):
    """Get remote control statistics for the current project and product"""
    try:

        if project_id is None:

            return (
                jsonify({"error": "Project ID is required. Please specify project_id parameter."}),
                400,
            )


        product_id_param = request.args.get("product_id")
        if not product_id_param:
            return (
                jsonify({"error": "Product ID is required. Please specify product_id (or product_id) parameter."}),
                400,
            )


        product = None

        if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
            try:
                product_id_int = int(product_id_param)
                product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            except (ValueError, TypeError):
                pass
        

        if not product:
            product = Product.query.filter_by(unique_id=str(product_id_param), project_id=project_id).first()
        
        if not product:
            return jsonify({"error": "Product not found or does not belong to this project"}), 404
        
        product_id = product.id

        categories = RemoteCategory.query.filter_by(project_id=project_id, product_id=product_id).all()
        stats = []

        for category in categories:
            features = RemoteFeature.query.filter_by(
                category_id=category.id, project_id=project_id, product_id=product_id
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
