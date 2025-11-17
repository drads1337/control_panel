from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..middleware.validation import validate_request
from ..models.core import User
from ..schemas.notification import (
    GameUpdateNotificationSchema,
    LoaderNotificationCreateSchema,
    NotificationBulkActionSchema,
    NotificationBulkCreateSchema,
    NotificationCleanupSchema,
    NotificationCreateSchema,
    NotificationSendSchema,
)
from ..models.games import Game
from ..models.loaders import Loader, LoaderNotification
from ..models.notifications import Notification
from ..models.rbac import Role, UserRole
from ..services.activity import activity_service
from ..services.notifications import notification_service
from ..utils.rbac_utils import RBACManager

notifications_bp = Blueprint("notifications", __name__)




@notifications_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_notifications():
    """Get user notifications"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    unread_only = request.args.get("unread_only", "false").lower() == "true"
    notification_type = request.args.get("type")

    query = Notification.query.filter_by(is_deleted=False)

    from ..services.rbac import rbac_service

    # Check if user can view all notifications (admin-level)
    can_view_all = rbac_service.check_permission(
        user.id, "employees.view"
    ) or rbac_service.check_permission(user.id, "clients.view")
    if can_view_all:
        query = query.filter(
            (Notification.user_id == user_id)
            | (Notification.user_id.is_(None))
            | (Notification.project_id == user.project_id)
        )
    else:
        # Regular users see only their own notifications or project-wide notifications (user_id is None)
        query = query.filter(Notification.project_id == user.project_id).filter(
            (Notification.user_id == user_id) | (Notification.user_id.is_(None))
        )

    if unread_only:
        query = query.filter_by(is_read=False)

    if notification_type:
        query = query.filter_by(type=notification_type)

    pagination = query.order_by(Notification.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    notifications = []
    for notification in pagination.items:
        notifications.append(
            {
                "id": notification.id,
                "message": notification.message,
                "type": notification.type,
                "is_read": notification.is_read,
                "created_at": (
                    notification.created_at.isoformat() if notification.created_at else None
                ),
                "user_id": notification.user_id,
                "project_id": notification.project_id,
                "repeat_count": notification.repeat_count,
                "show_count": notification.show_count,
                "is_deleted": notification.is_deleted,
                "deleted_at": (
                    notification.deleted_at.isoformat() if notification.deleted_at else None
                ),
            }
        )

    return jsonify(
        {
            "notifications": notifications,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
            "per_page": per_page,
        }
    )


@notifications_bp.route("/<int:notification_id>/read", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def mark_as_read(notification_id):
    """Mark a notification as read"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Use notification service to mark as read
    success, error = notification_service.mark_notification_read(user, notification_id)

    if not success:
        return jsonify({"error": error or "Failed to mark notification as read"}), 400

    activity_service.log_activity(
        user,
        "mark_notification_read",
        details=f"Marked notification {notification_id} as read",
        ip=request.remote_addr,
    )

    return jsonify({"message": "Notification marked as read"})


@notifications_bp.route("/<int:notification_id>/show", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def increment_show_count(notification_id, current_user=None, project_id=None):
    """Increment the show count of a notification"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    notification = Notification.query.filter_by(
        id=notification_id, project_id=current_user.project_id
    ).first()

    if not current_user or not notification:
        return jsonify({"error": "Notification not found"}), 404

    from ..services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if notification.user_id != current_user.id and notification.project_id != current_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    try:
        notification.show_count += 1

        if notification.show_count >= notification.repeat_count:
            notification.is_read = True

        db.session.commit()

        return jsonify(
            {
                "message": "Show count incremented",
                "show_count": notification.show_count,
                "repeat_count": notification.repeat_count,
                "is_read": notification.is_read,
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to increment show count: {str(e)}"}), 500


@notifications_bp.route("/mark-all-read", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def mark_all_as_read():
    """Mark all notifications as read"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        # Owner can mark all notifications as read, others only their own
        if RBACManager.is_owner(user):
            Notification.query.filter_by(is_read=False).update({"is_read": True})
        else:
            Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})

        db.session.commit()

        activity_service.log_activity(
            user,
            "mark_all_notifications_read",
            details="Marked all notifications as read",
            ip=request.remote_addr,
        )

        return jsonify({"message": "All notifications marked as read"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to mark notifications as read: {str(e)}"}), 500


@notifications_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(NotificationCreateSchema)
def create_notification(current_user=None, project_id=None, validated_data=None):
    """Create a new notification"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        current_user.id, "employees.send_notification"
    ) or rbac_service.check_permission(current_user.id, "clients.send_notification")
    if not can_send:
        return jsonify({"error": "Access denied"}), 403

    # Use validated data
    data = validated_data or request.get_json()

    message = data.get("message")
    notification_type = data.get("type", "info")
    target_user_id = data.get("target_user_id") or data.get("user_id")
    repeat_count = data.get("repeat_count", 1)

    # Use notification service to create notification
    notification, error = notification_service.create_notification(
        user=current_user,
        message=message,
        notification_type=notification_type,
        target_user_id=target_user_id,
        repeat_count=repeat_count,
    )

    if not notification:
        return jsonify({"error": error or "Failed to create notification"}), 400

    activity_service.log_activity(
        current_user,
        "create_notification",
        details=f"Created notification: {message[:50]}...",
        ip=request.remote_addr,
    )

    return (
        jsonify(
            {
                "message": "Notification created successfully",
                "notification": {
                    "id": notification.id,
                    "message": notification.message,
                    "type": notification.type,
                    "user_id": notification.user_id,
                    "created_at": notification.created_at.isoformat(),
                },
            }
        ),
        201,
    )


@notifications_bp.route("/send", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(NotificationSendSchema)
def send_notification(current_user=None, project_id=None, validated_data=None):
    """Send notifications to specific users"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        current_user.id, "employees.send_notification"
    ) or rbac_service.check_permission(current_user.id, "clients.send_notification")
    if not can_send:
        return jsonify({"error": "Access denied"}), 403

    # Use validated data
    data = validated_data or request.get_json()

    title = data.get("title", "")
    message = data.get("message")
    notification_type = data.get("type", "info")
    target_users = data.get("target_users", [])
    repeat_count = data.get("repeat_count", 1)

    # Use notification service to send notifications
    notifications_created, notification_ids, error = notification_service.send_notifications(
        user=current_user,
        message=message,
        target_user_ids=target_users,
        notification_type=notification_type,
        title=title,
        repeat_count=repeat_count,
    )

    if error:
        status_code = 400 if "No workers found" in error else 404
        return jsonify({"error": error}), status_code

    activity_service.log_activity(
        current_user,
        "send_notifications",
        details=f"Sent {notifications_created} notifications to workers: {message[:50]}...",
        ip=request.remote_addr,
    )

    return (
        jsonify(
            {
                "message": f"Successfully sent {notifications_created} notifications",
                "notifications_created": notifications_created,
                "notification_ids": notification_ids,
            }
        ),
        201,
    )


@notifications_bp.route("/<int:notification_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_notification(notification_id, current_user=None, project_id=None):
    """Delete a notification (soft delete)"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Use notification service to delete notification
    success, error = notification_service.delete_notification(current_user, notification_id)

    if not success:
        if error == "Notification already deleted":
            return jsonify({"message": "Notification already deleted"}), 200
        return jsonify({"error": error or "Failed to delete notification"}), 400

    activity_service.log_activity(
        current_user,
        "delete_notification",
        details=f"Soft deleted notification {notification_id}",
        ip=request.remote_addr,
    )

    return jsonify({"message": "Notification deleted successfully"})


@notifications_bp.route("/bulk", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(NotificationBulkActionSchema)
def bulk_action(current_user=None, project_id=None, validated_data=None):
    """Bulk operations on notifications"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Use validated data
    data = validated_data or request.get_json()
    action = data.get("action")
    notification_ids = data.get("notification_ids", [])

    query = Notification.query.filter(Notification.id.in_(notification_ids))

    from ..services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        query = query.filter_by(user_id=current_user.id)

    notifications = query.all()

    if action == "mark_read":
        try:
            for notification in notifications:
                notification.is_read = True

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_mark_notifications_read",
                details=f"Marked {len(notifications)} notifications as read",
                ip=request.remote_addr,
            )

            return jsonify({"message": f"Marked {len(notifications)} notifications as read"})

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to mark notifications as read: {str(e)}"}), 500

    elif action == "mark_unread":
        try:
            for notification in notifications:
                notification.is_read = False

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_mark_notifications_unread",
                details=f"Marked {len(notifications)} notifications as unread",
                ip=request.remote_addr,
            )

            return jsonify({"message": f"Marked {len(notifications)} notifications as unread"})

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to mark notifications as unread: {str(e)}"}), 500

    elif action == "delete":
        try:
            for notification in notifications:
                notification.is_deleted = True
                notification.deleted_at = datetime.utcnow()

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_delete_notifications",
                details=f"Soft deleted {len(notifications)} notifications",
                ip=request.remote_addr,
            )

            return jsonify({"message": f"Deleted {len(notifications)} notifications"})

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to delete notifications: {str(e)}"}), 500

    else:
        return jsonify({"error": "Invalid action"}), 400


@notifications_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_notification_stats(current_user=None, project_id=None):
    """Get notification statistics"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    query = Notification.query

    from ..services.rbac import rbac_service
    from ..utils.rbac_utils import RBACManager

    can_view_all = (
        RBACManager.is_owner(current_user)
        or rbac_service.check_permission(current_user.id, "employees.view")
        or rbac_service.check_permission(current_user.id, "clients.view")
    )
    if can_view_all:
        query = query.filter((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
    else:
        query = query.filter_by(user_id=current_user.id)

    total_notifications = query.count()
    unread_notifications = query.filter_by(is_read=False).count()
    read_notifications = query.filter_by(is_read=True).count()

    type_stats = (
        db.session.query(Notification.type, func.count(Notification.id))
        .filter(query.whereclause)
        .group_by(Notification.type)
        .all()
    )

    daily_stats = []
    for i in range(7):
        date = datetime.utcnow().date() - timedelta(days=i)
        count = query.filter(func.date(Notification.created_at) == date).count()

        daily_stats.append({"date": date.strftime("%Y-%m-%d"), "count": count})

    daily_stats.reverse()

    return jsonify(
        {
            "overview": {
                "total": total_notifications,
                "unread": unread_notifications,
                "read": read_notifications,
                "read_rate": round(
                    (
                        (read_notifications / total_notifications * 100)
                        if total_notifications > 0
                        else 0
                    ),
                    2,
                ),
            },
            "type_stats": [{"type": type_name, "count": count} for type_name, count in type_stats],
            "daily_stats": daily_stats,
        }
    )


@notifications_bp.route("/unread-count", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_unread_count(current_user=None, project_id=None):
    """Get the count of unread notifications"""
    # Use explicit current_user from decorator
    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id
    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    query = Notification.query.filter_by(is_read=False)

    from ..services.rbac import rbac_service

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if can_view_all:
        query = query.filter((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
    else:
        query = query.filter_by(user_id=current_user.id)

    unread_count = query.count()

    return jsonify({"unread_count": unread_count})


@notifications_bp.route("/system", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_system_notification():
    """Create a system notification (for internal use)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Ensure user has project_id
    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not user or not can_send:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()

    message = data.get("message")
    notification_type = data.get("type", "info")
    target_user_id = data.get("user_id")
    project_id = data.get("project_id")

    if not message:
        return jsonify({"error": "Message is required"}), 400

    notification = Notification(
        message=message,
        type=notification_type,
        user_id=target_user_id,
        project_id=project_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )

    db.session.add(notification)
    db.session.commit()

    return jsonify({"message": "System notification created", "notification_id": notification.id})


@notifications_bp.route("/bulk-create", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_bulk_notifications():
    """Create bulk notifications for all users in a project"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Ensure user has project_id
    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not user or not can_send:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()

    message = data.get("message")
    notification_type = data.get("type", "info")
    target_roles = data.get("target_roles", [])

    if not message:
        return jsonify({"error": "Message is required"}), 400

    try:
        query = User.query.filter_by(project_id=user.project_id)

        if target_roles:
            # Get users with specific roles using RBAC
            role_user_ids = (
                db.session.query(User.id)
                .join(UserRole)
                .join(Role)
                .filter(Role.name.in_(target_roles), Role.project_id == user.project_id)
                .all()
            )
            role_user_ids = [uid[0] for uid in role_user_ids]
            query = query.filter(User.id.in_(role_user_ids))

        target_users = query.all()

        # Filter out admin and owner users - they should not receive notifications
        from ..utils.rbac_utils import RBACManager

        workers_only = [
            target_user
            for target_user in target_users
            if not (RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user))
        ]

        notifications_created = 0

        for target_user in workers_only:
            if ":" not in message:
                title = "System Notification"
                formatted_message = f"{title}: {message}"
            else:
                formatted_message = message

            notification = Notification(
                message=formatted_message,
                type=notification_type,
                user_id=target_user.id,
                project_id=user.project_id,
                is_read=False,
                created_at=datetime.utcnow(),
            )
            db.session.add(notification)
            notifications_created += 1

        db.session.commit()

        activity_service.log_activity(
            user,
            "create_bulk_notifications",
            details=f"Created {notifications_created} bulk notifications",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully created {notifications_created} notifications",
                "notifications_created": notifications_created,
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create bulk notifications: {str(e)}"}), 500


@notifications_bp.route("/game-update", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_game_update_notification():
    """Create a game update notification"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Ensure user has project_id
    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not user or not can_send:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()

    game_id = data.get("game_id")
    version = data.get("version")
    update_message = data.get("message")
    notification_type = data.get("type", "info")
    repeat_count = data.get("repeat_count", 1)
    is_scheduled = data.get("is_scheduled", False)
    scheduled_at = data.get("scheduled_at")

    if not all([game_id, version, update_message]):
        return jsonify({"error": "Game ID, version and message are required"}), 400

    if not isinstance(repeat_count, int) or repeat_count < 1 or repeat_count > 10:
        return jsonify({"error": "Repeat count must be between 1 and 10"}), 400

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        project_users = User.query.filter_by(project_id=user.project_id).all()

        # Filter out admin and owner users - they should not receive notifications
        from ..utils.rbac_utils import RBACManager

        workers_only = [
            target_user
            for target_user in project_users
            if not (RBACManager.is_admin(target_user) or RBACManager.is_owner(target_user))
        ]

        notifications_created = 0

        for target_user in workers_only:
            title = f"{game.name} Update"
            message = f"Version {version}: {update_message}"

            created_time = datetime.utcnow()
            scheduled_time = None
            sent_time = None

            if is_scheduled and scheduled_at:
                scheduled_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
                if scheduled_time > created_time:
                    sent_time = None
                else:
                    sent_time = created_time
            else:
                sent_time = created_time

            notification = Notification(
                message=f"{title}: {message}",
                type=notification_type,
                user_id=target_user.id,
                project_id=user.project_id,
                is_read=False,
                repeat_count=repeat_count,
                show_count=0,
                is_deleted=False,
                created_at=created_time,
                is_scheduled=is_scheduled,
                scheduled_at=scheduled_time,
                sent_at=sent_time,
            )
            db.session.add(notification)
            notifications_created += 1

        db.session.commit()

        activity_service.log_activity(
            user,
            "create_game_update_notification",
            details=f"Created game update notification for {game.name} v{version}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully created {notifications_created} game update notifications",
                "notifications_created": notifications_created,
                "game_name": game.name,
                "version": version,
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating game update notifications: {str(e)}")
        return jsonify({"error": f"Failed to create game update notifications: {str(e)}"}), 500


@notifications_bp.route("/cleanup", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def cleanup_old_notifications():
    """Cleanup old notifications"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Ensure user has project_id
    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not user or not can_send:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    days_old = data.get("days_old", 30)

    # Use notification service to cleanup old notifications
    deleted_count, error = notification_service.cleanup_old_notifications(user, days_old)

    if error:
        return jsonify({"error": error}), 500

    activity_service.log_activity(
        user,
        "cleanup_notifications",
        details=f"Cleaned up {deleted_count} notifications older than {days_old} days",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": f"Cleaned up {deleted_count} old notifications",
            "deleted_count": deleted_count,
        }
    )


@notifications_bp.route("/loader-update", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_loader_update_notification():
    """Create a loader update notification"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not can_send:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        data = request.get_json()

        loader_id = data.get("loader_id")
        message = data.get("message")
        notification_type = data.get("type", "info")

        if not loader_id or not message:
            return jsonify({"error": "Loader ID and message are required"}), 400

        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found"}), 404

        loader_notification = LoaderNotification(
            loader_id=loader_id,
            message=message,
            type=notification_type,
            created_by=user.id,
            project_id=user.project_id,
        )

        db.session.add(loader_notification)

        project_users = User.query.filter_by(project_id=user.project_id).all()

        # Filter out admin and owner users - they should not receive notifications
        from ..utils.rbac_utils import RBACManager

        workers_only = [
            project_user
            for project_user in project_users
            if not (RBACManager.is_admin(project_user) or RBACManager.is_owner(project_user))
        ]

        notifications_created = 0

        for project_user in workers_only:
            notification = Notification(
                user_id=project_user.id,
                message=f"[{loader.name}] {message}",
                type=notification_type,
                project_id=user.project_id,
            )
            db.session.add(notification)
            notifications_created += 1

        db.session.commit()

        activity_service.log_activity(
            user,
            "loader_notification_created",
            details=f"Created loader update notification for {loader.name}: {message}",
        )

        return jsonify(
            {
                "success": True,
                "message": "Loader update notification created successfully",
                "notifications_created": notifications_created,
                "loader_name": loader.name,
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create loader update notification: {str(e)}"}), 500


@notifications_bp.route("/loaders/<int:loader_id>/notifications", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loader_notifications(loader_id):
    """Get notifications for a specific loader"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found"}), 404

        notifications = (
            LoaderNotification.query.filter_by(loader_id=loader_id, project_id=user.project_id)
            .order_by(LoaderNotification.created_at.desc())
            .all()
        )

        notifications_data = []
        for notification in notifications:
            notifications_data.append(
                {
                    "id": notification.id,
                    "message": notification.message,
                    "type": notification.type,
                    "is_scheduled": notification.is_scheduled,
                    "scheduled_at": (
                        notification.scheduled_at.isoformat() if notification.scheduled_at else None
                    ),
                    "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
                    "created_at": (
                        notification.created_at.isoformat() if notification.created_at else None
                    ),
                    "created_by": notification.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "loader_id": loader_id,
                "loader_name": loader.name,
                "notifications": notifications_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch loader notifications: {str(e)}"}), 500


@notifications_bp.route("/games/<int:game_id>/notifications", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_game_notifications(game_id):
    """Get notifications for a specific game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not can_send:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        notifications = (
            db.session.query(Notification)
            .filter_by(project_id=user.project_id, is_deleted=False)
            .filter(Notification.message.contains(game.name))
            .order_by(Notification.created_at.desc())
            .all()
        )

        unique_notifications = []
        seen_messages = set()

        for notification in notifications:
            try:
                message_key = (
                    f"{notification.message}_{notification.created_at.strftime('%Y-%m-%d %H:%M')}"
                )

                if message_key not in seen_messages:
                    seen_messages.add(message_key)
                    unique_notifications.append(notification)
            except Exception as e:
                unique_notifications.append(notification)

        notifications = unique_notifications

        notifications_data = []
        for notification in notifications:
            try:
                message_time_key = notification.created_at.strftime("%Y-%m-%d %H:%M")

                try:
                    total_show_count = (
                        db.session.query(func.sum(Notification.show_count))
                        .filter_by(project_id=notification.project_id, is_deleted=False)
                        .filter(
                            Notification.message == notification.message,
                            func.strftime("%Y-%m-%d %H:%M", Notification.created_at)
                            == message_time_key,
                        )
                        .scalar()
                        or 0
                    )
                except Exception as e:
                    total_show_count = notification.show_count

                try:
                    user_count = (
                        db.session.query(func.count(Notification.id))
                        .filter_by(project_id=notification.project_id, is_deleted=False)
                        .filter(
                            Notification.message == notification.message,
                            func.strftime("%Y-%m-%d %H:%M", Notification.created_at)
                            == message_time_key,
                        )
                        .scalar()
                        or 0
                    )
                except Exception as e:
                    user_count = 1

                notifications_data.append(
                    {
                        "id": notification.id,
                        "message": notification.message,
                        "type": notification.type,
                        "is_read": notification.is_read,
                        "created_at": (
                            notification.created_at.isoformat() if notification.created_at else None
                        ),
                        "user_id": notification.user_id,
                        "repeat_count": notification.repeat_count,
                        "show_count": total_show_count,
                        "user_count": user_count,
                    }
                )
            except Exception as e:
                notifications_data.append(
                    {
                        "id": notification.id,
                        "message": notification.message,
                        "type": notification.type,
                        "is_read": notification.is_read,
                        "created_at": (
                            notification.created_at.isoformat() if notification.created_at else None
                        ),
                        "user_id": notification.user_id,
                        "repeat_count": notification.repeat_count,
                        "show_count": notification.show_count,
                        "user_count": 1,
                    }
                )

        return jsonify(
            {
                "success": True,
                "game_id": game_id,
                "game_name": game.name,
                "notifications": notifications_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch game notifications: {str(e)}"}), 500


@notifications_bp.route("/loaders/<int:loader_id>/notifications", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_loader_notification(loader_id):
    """Create a notification for a specific loader"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    # Ensure user has project_id

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    # Creating notifications requires send_notification permission
    can_send = rbac_service.check_permission(
        user.id, "employees.send_notification"
    ) or rbac_service.check_permission(user.id, "clients.send_notification")
    if not can_send:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        loader = Loader.query.filter_by(id=loader_id, project_id=user.project_id).first()
        if not loader:
            return jsonify({"error": "Loader not found"}), 404

        data = request.get_json()

        message = data.get("message")
        notification_type = data.get("type", "info")
        is_scheduled = data.get("is_scheduled", False)
        scheduled_at = data.get("scheduled_at")

        if not message:
            return jsonify({"error": "Message is required"}), 400

        loader_notification = LoaderNotification(
            loader_id=loader_id,
            message=message,
            type=notification_type,
            is_scheduled=is_scheduled,
            scheduled_at=(
                datetime.fromisoformat(scheduled_at) if scheduled_at and is_scheduled else None
            ),
            created_by=user.id,
            project_id=user.project_id,
        )

        db.session.add(loader_notification)

        if not is_scheduled:
            project_users = User.query.filter_by(project_id=user.project_id).all()

            # Filter out admin and owner users - they should not receive notifications
            from ..utils.rbac_utils import RBACManager

            workers_only = [
                project_user
                for project_user in project_users
                if not (RBACManager.is_admin(project_user) or RBACManager.is_owner(project_user))
            ]

            notifications_created = 0

            for project_user in workers_only:
                notification = Notification(
                    user_id=project_user.id,
                    message=f"[{loader.name}] {message}",
                    type=notification_type,
                    project_id=user.project_id,
                )
                db.session.add(notification)
                notifications_created += 1

            loader_notification.sent_at = datetime.utcnow()

            db.session.commit()

            return jsonify(
                {
                    "success": True,
                    "message": "Loader notification sent successfully",
                    "notifications_created": notifications_created,
                    "loader_name": loader.name,
                }
            )
        else:
            db.session.commit()

            return jsonify(
                {
                    "success": True,
                    "message": "Loader notification scheduled successfully",
                    "scheduled_at": scheduled_at,
                    "loader_name": loader.name,
                }
            )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create loader notification: {str(e)}"}), 500
