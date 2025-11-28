"""
Webhook Routes
Manages webhook configurations and notifications
"""

import json
import logging
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_cors import cross_origin
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..middleware.validation import validate_request
from ..models.core import Project, User
from ..models.webhooks import Webhook, WebhookLog
from ..schemas.webhook import WebhookCreateSchema, WebhookUpdateSchema
from ..services.webhooks import get_webhook_service
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import RolePermissions
from ..utils.service_helpers import get_service

webhooks_bp = Blueprint("webhooks", __name__)

@webhooks_bp.route("/user-info", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_user_info():
    """
    Simple endpoint to get user info without any middleware
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        user_roles = RBACManager.get_user_role_names(user)

        rbac_service = get_service('rbac_service')
        has_webhook_access = rbac_service.check_permission(user.id, "webhooks.view")

        return jsonify(
            {
                "status": "success",
                "user_info": {
                    "id": user.id,
                    "username": user.username,
                    "roles": user_roles,
                    "is_admin": RBACManager.is_admin(user),
                    "project_id": user.project_id,
                    "has_webhook_access": has_webhook_access,
                    "project_exists": bool(user.project_id and Project.query.get(user.project_id)),
                },
            }
        )

    except Exception as e:
        logging.error(f"USER_INFO_ERROR: {e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_webhooks():
    """
    Get webhooks for a project
    """
    try:
        user_id = get_jwt_identity()
        logging.info(f"WEBHOOKS_GET: user_id={user_id}")
        user = User.query.get(user_id)
        logging.info(
            f"WEBHOOKS_GET: user found={user is not None}, username={user.username if user else 'None'}"
        )

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check tier limits
        if user.project_id:
            project = Project.query.get(user.project_id)
            if project:
                tier_limits_service = get_service('tier_limits_service')
                enabled, error_msg = tier_limits_service.check_webhooks_enabled(project)
                if not enabled:
                    return jsonify({"error": error_msg}), 403

        webhook_service = get_webhook_service()

        webhook_service = get_service('webhook_service')
        has_access, error = webhook_service.validate_webhook_access(user_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        project_id = user.project_id
        if not project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        logging.info(f"WEBHOOKS_GET: using project_id={project_id}")

        webhooks = webhook_service.get_webhooks(project_id)

        logging.info(f"WEBHOOKS_GET: returning {len(webhooks)} webhooks for project {project_id}")

        return jsonify({"status": "success", "data": webhooks})

    except Exception as e:
        logging.error(f"WEBHOOKS_GET_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(WebhookCreateSchema)
def create_webhook(validated_data=None):
    """
    Create a new webhook
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check tier limits
        if user.project_id:
            project = Project.query.get(user.project_id)
            if project:
                tier_limits_service = get_service('tier_limits_service')
                enabled, error_msg = tier_limits_service.check_webhooks_enabled(project)
                if not enabled:
                    return jsonify({"error": error_msg}), 403

        webhook_service = get_webhook_service()

        has_access, error = webhook_service.validate_webhook_access(user_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        # Parse validated data into schema object
        data = WebhookCreateSchema(**validated_data)
        
        # Validate webhook-specific requirements
        is_valid, validation_error = webhook_service.validate_webhook_creation_data(
            webhook_type=data.webhook_type,
            url=str(data.url) if data.url else None,
            telegram_bot_token=data.telegram_bot_token,
            telegram_chat_id=data.telegram_chat_id,
            discord_webhook_url=str(data.discord_webhook_url) if data.discord_webhook_url else None,
            discord_bot_token=data.discord_bot_token,
            discord_channel_id=data.discord_channel_id,
            name=data.name,
            events=data.events,
        )

        if not is_valid:
            return jsonify({"error": validation_error}), 400

        project_id = user.project_id
        if not project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        logging.info(
            f"WEBHOOKS_CREATE: using project_id={project_id}, webhook_type={data.webhook_type}, name={data.name}"
        )

        webhook_data = webhook_service.create_webhook(
            project_id=project_id,
            name=data.name,
            webhook_type=data.webhook_type,
            url=str(data.url) if data.url else None,
            events=data.events,
            secret=data.secret,
            is_active=data.is_active,
            headers=data.headers or {},

            telegram_bot_token=data.telegram_bot_token,
            telegram_chat_id=data.telegram_chat_id,

            discord_webhook_url=str(data.discord_webhook_url) if data.discord_webhook_url else None,
            discord_bot_token=data.discord_bot_token,
            discord_channel_id=data.discord_channel_id,
        )

        return jsonify({"status": "success", "data": webhook_data})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"WEBHOOKS_CREATE_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/<int:webhook_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(WebhookUpdateSchema, strict=False)
def update_webhook(webhook_id, validated_data=None):
    """
    Update an existing webhook
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        webhook_service = get_webhook_service()

        has_access, error, webhook = webhook_service.validate_webhook_ownership(user_id, webhook_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this webhook"
            ] else 404
            return jsonify({"error": error}), status_code

        # Parse validated data into schema object (strict=False allows partial updates)
        data = WebhookUpdateSchema(**validated_data)
        
        # Convert Pydantic model to dict, excluding None values
        update_data = data.model_dump(exclude_none=True)
        
        # Convert HttpUrl objects to strings
        if "url" in update_data and update_data["url"]:
            update_data["url"] = str(update_data["url"])
        if "discord_webhook_url" in update_data and update_data["discord_webhook_url"]:
            update_data["discord_webhook_url"] = str(update_data["discord_webhook_url"])

        webhook_data = webhook_service.update_webhook(webhook_id, **update_data)

        return jsonify({"status": "success", "data": webhook_data})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"WEBHOOKS_UPDATE_ERROR user_id={user_id} webhook_id={webhook_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/<int:webhook_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_webhook(webhook_id):
    """
    Delete a webhook
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        webhook_service = get_webhook_service()

        has_access, error, webhook = webhook_service.validate_webhook_ownership(user_id, webhook_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this webhook"
            ] else 404
            return jsonify({"error": error}), status_code

        success = webhook_service.delete_webhook(webhook_id)

        if success:
            return jsonify({"status": "success", "message": "Webhook deleted successfully"})
        else:
            return jsonify({"error": "Failed to delete webhook"}), 500

    except Exception as e:
        logging.error(f"WEBHOOKS_DELETE_ERROR user_id={user_id} webhook_id={webhook_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/<int:webhook_id>/logs", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_webhook_logs(webhook_id):
    """
    Get webhook execution logs
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        webhook_service = get_webhook_service()

        has_access, error, webhook = webhook_service.validate_webhook_ownership(user_id, webhook_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this webhook"
            ] else 404
            return jsonify({"error": error}), status_code

        limit = request.args.get("limit", 100, type=int)
        limit = min(max(limit, 1), 1000)

        logs = webhook_service.get_webhook_logs(webhook_id, limit)

        return jsonify({"status": "success", "data": logs})

    except Exception as e:
        logging.error(f"WEBHOOKS_LOGS_ERROR user_id={user_id} webhook_id={webhook_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/events", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_webhook_events():
    """
    Get list of available webhook events
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        webhook_service = get_webhook_service()

        has_access, error = webhook_service.validate_webhook_access(user_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        events = webhook_service._get_valid_events()

        event_categories = {
            "keys": [e for e in events if e.startswith("key.")],
            "connect": [e for e in events if e.startswith("connect.")],
            "users": [e for e in events if e.startswith("user.")],
            "products": [e for e in events if e.startswith("product.")],
            "security": [e for e in events if e.startswith("security.")],
            "agents": [e for e in events if e.startswith("agent.")],
            "servers": [e for e in events if e.startswith("server.")],
            "remote": [e for e in events if e.startswith("remote.")],
            "notifications": [e for e in events if e.startswith("notification.")],
            "rbac": [e for e in events if e.startswith("rbac.")],
            "billing": [e for e in events if e.startswith("billing.")],
            "payments": [e for e in events if e.startswith("payment.")],
        }

        return jsonify(
            {"status": "success", "data": {"events": events, "categories": event_categories}}
        )

    except Exception as e:
        logging.error(f"WEBHOOKS_EVENTS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/statistics", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_webhook_statistics():
    """
    Get webhook statistics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        project_id = request.args.get("project_id", type=int)

        webhook_service = get_webhook_service()

        has_access, error = webhook_service.validate_webhook_access(user_id, project_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        from ..utils.rbac_utils import RBACManager
        user_roles = RBACManager.get_user_role_names(user)
        is_owner = user_roles and user_roles[0] == "owner" if user_roles else False

        if not is_owner:
            project_id = user.project_id

        stats = webhook_service.get_webhook_statistics(project_id)

        return jsonify({"status": "success", "data": stats})

    except Exception as e:
        logging.error(f"WEBHOOKS_STATISTICS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_webhook_stats():
    """
    Get webhook statistics (alias for /statistics)
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        webhook_service = get_webhook_service()

        has_access, error = webhook_service.validate_webhook_access(user_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        project_id = user.project_id
        if not project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        logging.info(f"WEBHOOKS_STATS: using project_id={project_id}")

        stats = webhook_service.get_webhook_statistics(project_id)

        return jsonify({"status": "success", "data": stats})

    except Exception as e:
        logging.error(f"WEBHOOKS_STATS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/trigger", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def trigger_webhook():
    """
    Manually trigger a webhook (for testing)
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "Request data required"}), 400

        event = data.get("event")
        webhook_data = data.get("data", {})
        project_id = data.get("project_id")

        if not event:
            return jsonify({"error": "Event is required"}), 400

        webhook_service = get_webhook_service()

        has_access, error = webhook_service.validate_webhook_access(user_id, project_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        from ..utils.rbac_utils import RBACManager
        user_roles = RBACManager.get_user_role_names(user)
        is_owner = user_roles and user_roles[0] == "owner" if user_roles else False

        if not is_owner:
            project_id = user.project_id

        success = webhook_service.trigger_webhook(event, webhook_data, project_id)

        if success:
            return jsonify({"status": "success", "message": "Webhook triggered successfully"})
        else:
            return jsonify({"error": "Failed to trigger webhook"}), 500

    except Exception as e:
        logging.error(f"WEBHOOKS_TRIGGER_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500
