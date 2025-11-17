"""
WebSocket routes for real-time notifications
"""

import json
import logging
from datetime import datetime

from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_socketio import emit, join_room, leave_room

from models.core import User

from ..config import Config
from ..middleware.auth import require_project_isolation
from ..services.tasks import task_service
from ..utils.redis_client import get_redis_client

websocket_bp = Blueprint("websocket", __name__)

# Use centralized Redis client for pub/sub
# The client is initialized lazily on first access
redis_client = None


def get_websocket_redis_client():
    """
    Get Redis client instance for WebSocket operations.
    
    Uses the centralized Redis client from utils/redis_client.py
    to ensure consistent configuration and connection pooling.
    
    Returns:
        Redis client instance (singleton)
    """
    global redis_client
    if redis_client is None:
        redis_client = get_redis_client()
        logging.info("✅ Redis client initialized for WebSocket (using centralized client)")
    return redis_client


@websocket_bp.route("/connect", methods=["GET"])
@jwt_required()
@require_project_isolation
def connect_websocket():
    """Handle WebSocket connection"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return {"error": "User not found"}, 401

        # Join user-specific room
        user_room = f"user_{current_user_id}"
        join_room(user_room)

        # Join project-specific room if user has project
        if current_user.project_id:
            project_room = f"project_{current_user.project_id}"
            join_room(project_room)

        # Join global room for system-wide notifications
        join_room("global")

        logging.info(f"User {current_user_id} connected to WebSocket")

        return {
            "status": "connected",
            "user_id": current_user_id,
            "rooms": [user_room, "global"]
            + ([f"project_{current_user.project_id}"] if current_user.project_id else []),
        }

    except Exception as e:
        logging.error(f"WebSocket connection error: {e}")
        return {"error": "Connection failed"}, 500


@websocket_bp.route("/disconnect", methods=["GET"])
@jwt_required()
@require_project_isolation
def disconnect_websocket():
    """Handle WebSocket disconnection"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if current_user:
            # Leave user-specific room
            user_room = f"user_{current_user_id}"
            leave_room(user_room)

            # Leave project-specific room if user has project
            if current_user.project_id:
                project_room = f"project_{current_user.project_id}"
                leave_room(project_room)

            # Leave global room
            leave_room("global")

            logging.info(f"User {current_user_id} disconnected from WebSocket")

        return {"status": "disconnected"}

    except Exception as e:
        logging.error(f"WebSocket disconnection error: {e}")
        return {"error": "Disconnection failed"}, 500


@websocket_bp.route("/task-status/<task_id>", methods=["GET"])
@jwt_required()
def get_task_status(task_id):
    """Get task status via HTTP (fallback for WebSocket)"""
    try:
        current_user_id = get_jwt_identity()
        task_info = task_service.get_task_status(task_id)

        if not task_info:
            return {"error": "Task not found"}, 404

        # Check if user has access to this task
        if task_info.get("user_id") and task_info["user_id"] != current_user_id:
            return {"error": "Access denied"}, 403

        return task_info

    except Exception as e:
        logging.error(f"Failed to get task status {task_id}: {e}")
        return {"error": "Failed to get task status"}, 500


@websocket_bp.route("/user-tasks", methods=["GET"])
@jwt_required()
def get_user_tasks():
    """Get user's recent tasks"""
    try:
        current_user_id = get_jwt_identity()
        tasks = task_service.get_user_tasks(current_user_id)

        return {"tasks": tasks}

    except Exception as e:
        logging.error(f"Failed to get user tasks: {e}")
        return {"error": "Failed to get user tasks"}, 500


def publish_notification(
    notification_type: str, data: dict, user_id: int = None, project_id: int = None
):
    """
    Publish notification to WebSocket clients
    """
    try:
        notification = {
            "type": notification_type,
            "data": data,
            "timestamp": json.dumps(datetime.utcnow().isoformat()),
        }

        # Publish to specific user if user_id provided
        if user_id:
            user_room = f"user_{user_id}"
            emit("notification", notification, room=user_room)

        # Publish to project if project_id provided
        if project_id:
            project_room = f"project_{project_id}"
            emit("notification", notification, room=project_room)

        # Publish to global if no specific targets
        if not user_id and not project_id:
            emit("notification", notification, room="global")

        logging.info(f"Published notification: {notification_type}")

    except Exception as e:
        logging.error(f"Failed to publish notification: {e}")


def publish_task_update(task_id: str, task_info: dict):
    """
    Publish task update to WebSocket clients
    """
    try:
        update_data = {
            "task_id": task_id,
            "status": task_info["status"],
            "progress": task_info.get("progress", 0),
            "result": task_info.get("result"),
            "error": task_info.get("error"),
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Publish to user-specific room
        if task_info.get("user_id"):
            user_room = f"user_{task_info['user_id']}"
            emit("task_update", update_data, room=user_room)

        # Publish to project-specific room
        if task_info.get("project_id"):
            project_room = f"project_{task_info['project_id']}"
            emit("task_update", update_data, room=project_room)

        logging.info(f"Published task update: {task_id}")

    except Exception as e:
        logging.error(f"Failed to publish task update: {e}")
