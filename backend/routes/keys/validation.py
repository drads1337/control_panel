"""
Key Validation Routes
Handles key validation and testing operations
"""

import logging
import json as json_lib
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Product, Key, Project, User
from ...schemas.key import KeyValidateSchema
from ...services.keys import key_validator
from ...services.connect.response_builder import ResponseBuilder

validation_bp = Blueprint("keys_validation", __name__)
logger = logging.getLogger(__name__)
response_builder = ResponseBuilder()

@validation_bp.route("/validate", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyValidateSchema)
def validate_key(current_user, project_id=None, validated_data=None):
    """Validate a key and return all necessary data for application functionality"""

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    key_value = validated_data.key
    device_id = validated_data.device_id
    product_id = validated_data.product_id

    key = Key.query.filter_by(key=key_value, project_id=current_user.project_id).first()
    if not key:
        return jsonify({"error": "Invalid key"}), 404

    is_valid, error_msg = key_validator.validate_key_status(key)
    if not is_valid:
        return jsonify({"error": error_msg}), 403

    is_valid, error_msg, project = key_validator.validate_project_status(key.project_id)
    if not is_valid:
        if project:
            return (
                jsonify(
                    {
                        "error": "Project Inactive",
                        "message": error_msg,
                        "project_name": project.name,
                        "project_status": project.status,
                        "subscription_status": getattr(
                            project, "subscription_status_display", None
                        ),
                        "contact_owner": "Please contact the project owner for assistance.",
                    }
                ),
                403,
            )
        return jsonify({"error": error_msg}), 403

    # Get product object - use product_id from request or key.product_id
    product_obj = None
    if product_id:
        if key.product_id and key.product_id != product_id:
            return jsonify({"error": "Key is not valid for this product"}), 403

        product = Product.query.filter_by(id=product_id, project_id=current_user.project_id).first()
        if product:
            is_valid, error_msg, product_obj = key_validator.validate_product_access(
                key, product.name, key.project_id
            )
            if not is_valid:
                if product_obj and product_obj.status in ["inactive", "maintenance"]:
                    return (
                        jsonify(
                            {
                                "error": (
                                    "Product Inactive"
                                    if product_obj.status == "inactive"
                                    else "Product Maintenance"
                                ),
                                "message": error_msg,
                                "product_name": product_obj.name,
                                "product_status": product_obj.status,
                            }
                        ),
                        403,
                    )
                return jsonify({"error": error_msg}), 403
    elif key.product_id:
        # Use product from key if no product_id specified
        product_obj = Product.query.filter_by(id=key.product_id, project_id=current_user.project_id).first()
        if product_obj:
            is_valid, error_msg, validated_product = key_validator.validate_product_access(
                key, product_obj.name, key.project_id
            )
            if not is_valid:
                if validated_product and validated_product.status in ["inactive", "maintenance"]:
                    return (
                        jsonify(
                            {
                                "error": (
                                    "Product Inactive"
                                    if validated_product.status == "inactive"
                                    else "Product Maintenance"
                                ),
                                "message": error_msg,
                                "product_name": validated_product.name,
                                "product_status": validated_product.status,
                            }
                        ),
                        403,
                    )
                return jsonify({"error": error_msg}), 403

    devices = key.devices.split(",") if key.devices else []
    if device_id:
        is_valid, error_msg = key_validator.validate_device_limit(key, device_id)
        if not is_valid:
            return jsonify({"error": error_msg}), 403
        devices = key.devices.split(",") if key.devices else []

    # Calculate expiration info
    from datetime import datetime
    expires_at = None
    seconds_left = None
    seconds_left_human = None
    
    if key.expires_at:
        expires_at = key.expires_at.isoformat()
        now = datetime.utcnow()
        if key.expires_at > now:
            delta = key.expires_at - now
            seconds_left = int(delta.total_seconds())
            
            days = seconds_left // 86400
            hours = (seconds_left % 86400) // 3600
            minutes = (seconds_left % 3600) // 60
            
            if days > 0:
                seconds_left_human = f"{days}d {hours}h"
            elif hours > 0:
                seconds_left_human = f"{hours}h {minutes}m"
            else:
                seconds_left_human = f"{minutes}m"

    # Load encrypted config/keys from product remote_config
    # These are required for application functionality
    app_config = None
    app_config_meta = None
    if product_obj:
        try:
            from ...models.products import RemoteConfig
            remote_config = RemoteConfig.query.filter_by(product_id=product_obj.id).first()
            if remote_config and remote_config.loader_config:
                bundle = response_builder.build_app_config_payload(
                    remote_config.loader_config, key.project_id
                )
                app_config = bundle["ciphertext"]
                app_config_meta = bundle["meta"]
                logger.debug(
                    f"Loaded app_config for product {product_obj.id}, length={len(remote_config.loader_config) if remote_config.loader_config else 0}"
                )
        except Exception as e:
            logger.warning(f"Failed to load app_config for product {product_obj.id if product_obj else 'unknown'}: {e}")

    # Build response with all necessary data for application to work
    response = {
        "key_id": key.id,
        "expires_at": expires_at,
        "seconds_left": seconds_left,
        "seconds_left_human": seconds_left_human,
        "max_devices": key.max_devices,
        "current_devices": len(devices),
        "project_id": key.project_id,
    }

    # Add product information if available
    if product_obj:
        background_value = ""
        if product_obj.backgrounds:
            try:
                backgrounds_list = json_lib.loads(product_obj.backgrounds)
                if isinstance(backgrounds_list, list) and len(backgrounds_list) > 0:
                    background_value = backgrounds_list[0] if isinstance(backgrounds_list[0], str) else str(backgrounds_list[0])
                else:
                    background_value = product_obj.backgrounds
            except:
                background_value = product_obj.backgrounds
        
        response["product"] = {
            "id": product_obj.id,
            "unique_id": product_obj.unique_id or "",
            "name": product_obj.name or "",
            "description": product_obj.description or "",
            "version": product_obj.version or "1.0.0",
            "logo": product_obj.logo or "",
            "banner": product_obj.banner or "",
            "background": background_value,
            "file": product_obj.loader_file or "",
        }

    # Add encrypted config/keys that are required for application functionality
    # Without these, the application cannot function properly
    if app_config:
        response["app_config"] = app_config
    if app_config_meta:
        response["app_config_meta"] = app_config_meta

    return jsonify(response)
