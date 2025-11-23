"""
User API Tokens Routes
Handles API token management for users
"""

import hashlib
import json
import logging
import secrets
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ...core.extensions import db
from ...middleware.auth import (
    enforce_project_scope,
    require_project_with_grace_period,
    require_role,
    require_user,
)
from ...models import APIKey, User
from ...services.activity import activity_service
from ...utils.role_constants import RolePermissions

tokens_bp = Blueprint("users_tokens", __name__)
logger = logging.getLogger(__name__)

@tokens_bp.route("/<int:user_id>/tokens", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def get_user_tokens(user_id, current_user):
    """Get all API tokens for a specific user"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    api_keys = APIKey.query.filter_by(created_by=user_id).order_by(APIKey.created_at.desc()).all()

    tokens_data = []
    for api_key in api_keys:
        permissions = []
        if api_key.permissions:
            try:
                permissions = json.loads(api_key.permissions)
            except json.JSONDecodeError:
                permissions = []

        tokens_data.append(
            {
                "id": api_key.id,
                "name": api_key.name,
                "is_active": api_key.is_active,
                "created_at": api_key.created_at.isoformat() if api_key.created_at else None,
                "last_used": api_key.last_used.isoformat() if api_key.last_used else None,
                "permissions": permissions,
            }
        )

    return jsonify({"tokens": tokens_data})

@tokens_bp.route("/<int:user_id>/tokens", methods=["POST"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def create_user_token(user_id, current_user):
    """Create a new API token for a user"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    name = data.get("name")
    permissions = data.get("permissions", [])

    if not name:
        return jsonify({"error": "Token name is required"}), 400

    try:

        api_key_value = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(api_key_value.encode()).hexdigest()

        if APIKey.query.filter_by(key_hash=key_hash).first():
            return jsonify({"error": "Failed to generate unique token"}), 500

        api_key = APIKey(
            name=name,
            key_hash=key_hash,
            is_active=True,
            created_by=user_id,
            created_at=datetime.utcnow(),
            permissions=json.dumps(permissions) if permissions else None,
        )

        db.session.add(api_key)
        db.session.commit()

        activity_service.log_activity(
            current_user,
            "create_api_token",
            details=f"Created API token '{name}' for user {target_user.username}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": "API token created successfully",
                "token": {
                    "id": api_key.id,
                    "name": api_key.name,
                    "api_key": api_key_value,
                    "is_active": api_key.is_active,
                    "created_at": api_key.created_at.isoformat(),
                    "permissions": permissions,
                },
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating API token: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to create API token"}), 500

@tokens_bp.route("/<int:user_id>/tokens/<int:token_id>", methods=["PUT"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def update_user_token(user_id, token_id, current_user):
    """Update an API token"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    api_key = APIKey.query.filter_by(id=token_id, created_by=user_id).first()
    if not api_key:
        return jsonify({"error": "API token not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:

        if "name" in data:
            api_key.name = data["name"]

        if "is_active" in data:
            api_key.is_active = data["is_active"]

        if "permissions" in data:
            api_key.permissions = json.dumps(data["permissions"]) if data["permissions"] else None

        db.session.commit()

        activity_service.log_activity(
            current_user,
            "update_api_token",
            details=f"Updated API token '{api_key.name}' for user {target_user.username}",
            ip=request.remote_addr,
        )

        permissions = []
        if api_key.permissions:
            try:
                permissions = json.loads(api_key.permissions)
            except json.JSONDecodeError:
                permissions = []

        return jsonify(
            {
                "message": "API token updated successfully",
                "token": {
                    "id": api_key.id,
                    "name": api_key.name,
                    "is_active": api_key.is_active,
                    "created_at": api_key.created_at.isoformat(),
                    "last_used": api_key.last_used.isoformat() if api_key.last_used else None,
                    "permissions": permissions,
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating API token: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to update API token"}), 500

@tokens_bp.route("/<int:user_id>/tokens/<int:token_id>", methods=["DELETE"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def delete_user_token(user_id, token_id, current_user):
    """Delete an API token"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    api_key = APIKey.query.filter_by(id=token_id, created_by=user_id).first()
    if not api_key:
        return jsonify({"error": "API token not found"}), 404

    try:
        token_name = api_key.name
        db.session.delete(api_key)
        db.session.commit()

        activity_service.log_activity(
            current_user,
            "delete_api_token",
            details=f"Deleted API token '{token_name}' for user {target_user.username}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "API token deleted successfully"})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting API token: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to delete API token"}), 500
