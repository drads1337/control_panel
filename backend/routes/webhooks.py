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
from ..middleware.production_guard import development_only
from ..models.core import Project, User
from ..models.webhooks import Webhook, WebhookLog
from ..services.webhooks import get_webhook_service
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import RolePermissions

webhooks_bp = Blueprint("webhooks", __name__)

@webhooks_bp.route("/debug-simple", methods=["GET"])
@development_only
@jwt_required()
@require_project_isolation
def debug_user_simple():
    """
    Simple debug endpoint without middleware
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        user_roles = RBACManager.get_user_role_names(user)
        is_admin = RBACManager.is_admin(user)

        return jsonify(
            {
                "status": "success",
                "user_info": {
                    "id": user.id,
                    "username": user.username,
                    "roles": user_roles,
                    "is_admin": is_admin,
                    "project_id": user.project_id,
                },
            }
        )

    except Exception as e:
        logging.error(f"WEBHOOKS_DEBUG_SIMPLE_ERROR: {e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/debug", methods=["GET"])
@development_only
@jwt_required()
@require_project_isolation
def debug_user_info():
    """
    Debug endpoint to check user information
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        user_roles = RBACManager.get_user_role_names(user)
        from ..services.rbac import rbac_service

        has_webhook_access = rbac_service.check_permission(user.id, "webhooks.view")

        is_admin = RBACManager.is_admin(user)

        debug_info = {
            "user_id": user.id,
            "username": user.username,
            "roles": user_roles,
            "is_admin": is_admin,
            "project_id": user.project_id,
            "has_webhook_access": has_webhook_access,
            "project_exists": bool(user.project_id and Project.query.get(user.project_id)),
        }

        return jsonify({"status": "success", "debug_info": debug_info})

    except Exception as e:
        logging.error(f"WEBHOOKS_DEBUG_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500

@webhooks_bp.route("/test", methods=["GET"])
@development_only
@jwt_required()
@require_project_isolation
def test_webhooks_access():
    """
    Test endpoint without middleware to check basic access
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        user_roles = RBACManager.get_user_role_names(user)
        from ..services.rbac import rbac_service

        has_webhook_access = rbac_service.check_permission(user.id, "webhooks.view")

        return jsonify(
            {
                "status": "success",
                "message": "Basic webhook access test passed",
                "user_info": {
                    "id": user.id,
                    "username": user.username,
                    "roles": user_roles,
                    "is_admin": RBACManager.is_admin(user),
                    "project_id": user.project_id,
                    "has_webhook_access": has_webhook_access,
                },
            }
        )

    except Exception as e:
        logging.error(f"WEBHOOKS_TEST_ERROR: {e}")
        return jsonify({"error": "Internal server error"}), 500

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
        from ..services.rbac import rbac_service

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

@webhooks_bp.route("/test-create", methods=["POST"])
@development_only
@jwt_required()
def test_create_webhook():
    """
    Test endpoint for creating webhook without any checks
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        logging.info(f"TEST_CREATE_WEBHOOK: user_id={user.id}, data={data}")

        return jsonify(
            {
                "status": "success",
                "message": "Test webhook creation successful",
                "user_id": user.id,
                "project_id": user.project_id,
                "data_received": data,
            }
        )

    except Exception as e:
        logging.error(f"TEST_CREATE_WEBHOOK_ERROR: {e}")
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
def create_webhook():
    """
    Create a new webhook
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "Request data required"}), 400

        webhook_service = get_webhook_service()

        has_access, error = webhook_service.validate_webhook_access(user_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this project"
            ] else 404
            return jsonify({"error": error}), status_code

        name = data.get("name")
        webhook_type = data.get("webhook_type", "custom")
        url = data.get("url")
        events = data.get("events", [])
        secret = data.get("secret")
        is_active = data.get("is_active", True)
        headers = data.get("headers", {})

        telegram_bot_token = data.get("telegram_bot_token")
        telegram_chat_id = data.get("telegram_chat_id")

        discord_webhook_url = data.get("discord_webhook_url")
        discord_bot_token = data.get("discord_bot_token")
        discord_channel_id = data.get("discord_channel_id")

        is_valid, validation_error = webhook_service.validate_webhook_creation_data(
            webhook_type=webhook_type,
            url=url,
            telegram_bot_token=telegram_bot_token,
            telegram_chat_id=telegram_chat_id,
            discord_webhook_url=discord_webhook_url,
            discord_bot_token=discord_bot_token,
            discord_channel_id=discord_channel_id,
            name=name,
            events=events,
        )

        if not is_valid:
            return jsonify({"error": validation_error}), 400

        project_id = user.project_id
        if not project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        logging.info(
            f"WEBHOOKS_CREATE: using project_id={project_id}, webhook_type={webhook_type}, name={name}"
        )

        webhook_data = webhook_service.create_webhook(
            project_id=project_id,
            name=name,
            webhook_type=webhook_type,
            url=url,
            events=events,
            secret=secret,
            is_active=is_active,
            headers=headers,

            telegram_bot_token=telegram_bot_token,
            telegram_chat_id=telegram_chat_id,

            discord_webhook_url=discord_webhook_url,
            discord_bot_token=discord_bot_token,
            discord_channel_id=discord_channel_id,
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
def update_webhook(webhook_id):
    """
    Update an existing webhook
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "Request data required"}), 400

        webhook_service = get_webhook_service()

        has_access, error, webhook = webhook_service.validate_webhook_ownership(user_id, webhook_id)
        if not has_access:
            status_code = 403 if error in [
                "User must be assigned to a project to manage webhooks",
                "Insufficient permissions",
                "Access denied to this webhook"
            ] else 404
            return jsonify({"error": error}), status_code

        webhook_data = webhook_service.update_webhook(webhook_id, **data)

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

@webhooks_bp.route("/<int:webhook_id>/test", methods=["POST"])
@development_only
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def test_webhook(webhook_id):
    """
    Test a webhook with a test payload
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

        test_result = webhook_service.test_webhook(webhook_id)

        return jsonify({"status": "success", "data": test_result})

    except Exception as e:
        logging.error(f"WEBHOOKS_TEST_ERROR user_id={user_id} webhook_id={webhook_id} error={e}")
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
            "users": [e for e in events if e.startswith("user.")],
            "projects": [e for e in events if e.startswith("project.")],
            "games": [e for e in events if e.startswith("game.")],
            "security": [e for e in events if e.startswith("security.")],
            "payments": [e for e in events if e.startswith("payment.")],
            "system": [e for e in events if e.startswith("system.")],
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

@webhooks_bp.route("/test-trigger", methods=["POST"])
@development_only
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def test_trigger_webhook():
    """
    Test endpoint to manually trigger a webhook event with provided data.
    All data must be provided by the client - no hardcoded defaults.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "Request data required"}), 400

        event = data.get("event")
        webhook_data = data.get("data")

        if not event:
            return jsonify({"error": "Event type is required"}), 400

        if not webhook_data:
            return jsonify({"error": "Webhook data is required"}), 400

        if not isinstance(webhook_data, dict):
            return jsonify({"error": "Webhook data must be a dictionary"}), 400

        if "user_id" in webhook_data and webhook_data["user_id"] != user.id:
            logging.warning(
                f"WEBHOOKS_TEST_TRIGGER_USER_MISMATCH user_id={user_id} provided_user_id={webhook_data.get('user_id')}"
            )

            webhook_data["user_id"] = user.id

        if "created_at" not in webhook_data:
            webhook_data["created_at"] = datetime.utcnow().isoformat()

        webhook_service = get_webhook_service()
        success = webhook_service.trigger_webhook(event, webhook_data, user.project_id)

        return jsonify(
            {
                "status": "success",
                "message": f"Webhook triggered for event: {event}",
                "success": success,
                "data": webhook_data,
            }
        )

    except Exception as e:
        logging.error(f"WEBHOOKS_TEST_TRIGGER_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500
