import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, func
from sqlalchemy.orm import selectinload

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..middleware.production_guard import development_only
from ..middleware.validation import validate_request
from ..models.core import User, UserActivity
from ..models.rbac import Role, UserRole
from ..schemas.session import SessionBulkLogoutSchema, SessionBulkTerminateSchema
from ..services.activity import activity_service
from ..utils.service_helpers import get_service
from ..utils.rbac_utils import RBACManager

sessions_bp = Blueprint("sessions", __name__)

def get_utc_now():
    """Get current UTC time - compatible with both old and new Python versions"""
    try:
        return datetime.now(timezone.utc)
    except:
        return datetime.utcnow()

def get_users_with_roles(role_names, project_id=None):
    """Get users with specific roles using RBAC system"""
    query = db.session.query(User).join(UserRole).join(Role).filter(Role.name.in_(role_names))
    if project_id:
        query = query.filter(Role.project_id == project_id)
    return query

def get_user_ids_with_roles(role_names, project_id=None):
    """Get user IDs with specific roles using RBAC system"""
    query = db.session.query(User.id).join(UserRole).join(Role).filter(Role.name.in_(role_names))
    if project_id:
        query = query.filter(Role.project_id == project_id)
    elif project_id is None:

        query = query.filter(Role.project_id.is_(None))
    return [uid[0] for uid in query.all()]

@sessions_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_sessions():
    """Get active user sessions"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        user_filter = request.args.get("user_id", type=int)

        active_threshold = get_utc_now() - timedelta(hours=24)

        query = db.session.query(
            User.id, User.username, User.last_login, User.last_ip, User.last_country, User.last_city
        )

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(user)
            or rbac_service.check_permission(user.id, "employees.view")
            or rbac_service.check_permission(user.id, "clients.view")
        )
        if can_view_all:
            if RBACManager.is_owner(user):
                if user_filter:
                    query = query.filter(User.id == user_filter)
            else:
                if user.project_id:

                    role_user_ids = (
                        get_users_with_roles(["seller", "developer"], user.project_id)
                        .with_entities(User.id)
                        .all()
                    )
                    role_user_ids = [uid[0] for uid in role_user_ids]
                    query = query.filter(User.id.in_(role_user_ids))
                else:

                    role_user_ids = (
                        get_users_with_roles(["seller", "developer"])
                        .filter(User.project_id.is_(None))
                        .with_entities(User.id)
                        .all()
                    )
                    role_user_ids = [uid[0] for uid in role_user_ids]
                    query = query.filter(User.id.in_(role_user_ids))
        else:
            query = query.filter(User.project_id == user.project_id)

        query = query.filter(User.last_login >= active_threshold)

        try:
            debug_count = query.count()
        except Exception as e:
            debug_count = 0

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        user_ids = [session.id for session in pagination.items]
        last_activities_dict = {}

        if user_ids:

            from sqlalchemy import desc

            activity_subquery = (
                db.session.query(
                    UserActivity.user_id,
                    UserActivity.id,
                    UserActivity.action,
                    UserActivity.created_at,
                    UserActivity.user_agent,
                    func.row_number()
                    .over(
                        partition_by=UserActivity.user_id,
                        order_by=(desc(UserActivity.created_at), desc(UserActivity.id))
                    )
                    .label("rn")
                )
                .filter(UserActivity.user_id.in_(user_ids))
                .subquery()
            )

            last_activities = db.session.query(activity_subquery).filter(activity_subquery.c.rn == 1).all()

            for activity in last_activities:
                last_activities_dict[activity.user_id] = {
                    "id": activity.id,
                    "action": activity.action,
                    "created_at": activity.created_at,
                    "user_agent": activity.user_agent,
                }

        sessions = []

        for session in pagination.items:
            try:
                last_activity_data = last_activities_dict.get(session.id)
                last_activity = None
                if last_activity_data:

                    class ActivityObj:
                        def __init__(self, data):
                            self.id = data["id"]
                            self.action = data["action"]
                            self.created_at = data["created_at"]
                            self.user_agent = data["user_agent"]

                    last_activity = ActivityObj(last_activity_data)

                if session.last_login:
                    if session.last_login.tzinfo is None:
                        from datetime import timezone

                        session_last_login = session.last_login.replace(tzinfo=timezone.utc)
                    else:
                        session_last_login = session.last_login
                    is_active = session_last_login >= active_threshold
                else:
                    is_active = False

                session_data = {
                    "user_id": session.id,
                    "username": session.username,
                    "last_login": session.last_login.isoformat() if session.last_login else None,
                    "last_ip": session.last_ip,
                    "last_country": session.last_country,
                    "last_city": session.last_city,
                    "last_activity": (
                        last_activity.created_at.isoformat()
                        if last_activity
                        else (session.last_login.isoformat() if session.last_login else None)
                    ),
                    "last_action": (
                        {
                            "action": last_activity.action if last_activity else None,
                            "user_agent": last_activity.user_agent if last_activity else None,
                        }
                        if last_activity
                        else None
                    ),
                    "session_duration": calculate_session_duration(
                        session.last_login,
                        last_activity.created_at if last_activity else session.last_login,
                    ),
                    "is_active": is_active,
                }

                sessions.append(session_data)

            except Exception as e:
                logging.debug(f"Error processing session {session.id}: {e}")
                continue

        return jsonify(
            {
                "sessions": sessions,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )
    except Exception as e:
        logging.debug(f"Error in get_sessions: {e}")
        return jsonify({"error": "Internal server error"}), 500

def calculate_session_duration_new(last_login, last_activity):
    """Calculate session duration - new version"""
    try:
        from datetime import datetime, timezone

        if not last_login:
            return "Unknown"

        if not last_activity:
            last_activity = datetime.now(timezone.utc)

        if last_login.tzinfo is None:
            last_login = last_login.replace(tzinfo=timezone.utc)
        if last_activity.tzinfo is None:
            last_activity = last_activity.replace(tzinfo=timezone.utc)

        duration = last_activity - last_login

        if duration.total_seconds() < 0:
            return "Unknown"

        total_seconds = duration.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)

        if hours > 0:
            return f"{hours}h {minutes}min"
        elif minutes > 0:
            return f"{minutes}min"
        else:
            return "Less than 1 min"

    except Exception as e:
        logging.debug(f"Error calculating session duration: {e}")
        return "Unknown"

def calculate_session_duration(last_login, last_activity):
    """Calculate session duration"""
    return calculate_session_duration_new(last_login, last_activity)


@sessions_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_session_stats():
    """Get session statistics"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        now = get_utc_now()
        active_threshold = now - timedelta(minutes=30)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)

        query = db.session.query(
            User.id,
            User.username,
            User.last_login,
            func.max(UserActivity.created_at).label("last_activity"),
        ).join(UserActivity, User.id == UserActivity.user_id)

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(user)
            or rbac_service.check_permission(user.id, "employees.view")
            or rbac_service.check_permission(user.id, "clients.view")
        )
        if can_view_all:
            if not RBACManager.is_owner(user):
                if user.project_id:
                    query = query.filter(
                        (User.project_id == user.project_id)
                        & (
                            User.id.in_(
                                get_user_ids_with_roles(["seller", "developer"], user.project_id)
                            )
                        )
                    )
                else:
                    query = query.filter(
                        (User.project_id.is_(None))
                        & (User.id.in_(get_user_ids_with_roles(["seller", "developer"], None)))
                    )
        else:
            query = query.filter(User.project_id == user.project_id)

        query = query.group_by(User.id, User.username, User.last_login)

        active_sessions = query.having(
            func.max(UserActivity.created_at) >= active_threshold
        ).count()

        today_sessions = query.having(func.max(UserActivity.created_at) >= today_start).count()

        week_sessions = query.having(func.max(UserActivity.created_at) >= week_start).count()

        month_sessions = query.having(func.max(UserActivity.created_at) >= month_start).count()

        hour_stats = db.session.query(
            func.extract("hour", UserActivity.created_at).label("hour"), func.count(UserActivity.id)
        ).join(User, UserActivity.user_id == User.id)

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(user)
            or rbac_service.check_permission(user.id, "employees.view")
            or rbac_service.check_permission(user.id, "clients.view")
        )
        if can_view_all:
            if not RBACManager.is_owner(user):
                if user.project_id:
                    hour_stats = hour_stats.filter(
                        (User.project_id == user.project_id)
                        & (
                            User.id.in_(
                                get_user_ids_with_roles(["seller", "developer"], user.project_id)
                            )
                        )
                    )
            else:
                hour_stats = hour_stats.filter(
                    (User.project_id.is_(None))
                    & (
                        User.id.in_(
                            get_user_ids_with_roles(["seller", "developer"], user.project_id)
                        )
                    )
                )
        else:
            hour_stats = hour_stats.filter(User.project_id == user.project_id)

        hour_stats = (
            hour_stats.filter(UserActivity.created_at >= today_start)
            .group_by(func.extract("hour", UserActivity.created_at))
            .all()
        )

        day_stats = db.session.query(
            func.extract("dow", UserActivity.created_at).label("day_of_week"),
            func.count(UserActivity.id),
        ).join(User, UserActivity.user_id == User.id)

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(user)
            or rbac_service.check_permission(user.id, "employees.view")
            or rbac_service.check_permission(user.id, "clients.view")
        )
        if can_view_all:
            if not RBACManager.is_owner(user):
                if user.project_id:
                    day_stats = day_stats.filter(
                        (User.project_id == user.project_id)
                        & (
                            User.id.in_(
                                get_user_ids_with_roles(["seller", "developer"], user.project_id)
                            )
                        )
                    )
            else:
                day_stats = day_stats.filter(
                    (User.project_id.is_(None))
                    & (
                        User.id.in_(
                            get_user_ids_with_roles(["seller", "developer"], user.project_id)
                        )
                    )
                )
        else:
            day_stats = day_stats.filter(User.project_id == user.project_id)

        day_stats = (
            day_stats.filter(UserActivity.created_at >= week_start)
            .group_by(func.extract("dow", UserActivity.created_at))
            .all()
        )

        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        day_stats_formatted = []
        for day_num, count in day_stats:
            try:
                day_stats_formatted.append({"day": day_names[int(day_num)], "count": count})
            except (ValueError, IndexError):
                continue

        return jsonify(
            {
                "overview": {
                    "active_sessions": active_sessions,
                    "today_sessions": today_sessions,
                    "week_sessions": week_sessions,
                    "month_sessions": month_sessions,
                },
                "hour_stats": [
                    {"hour": int(hour), "count": count}
                    for hour, count in hour_stats
                    if hour is not None
                ],
                "day_stats": day_stats_formatted,
            }
        )
    except Exception as e:
        logging.debug(f"Error in get_session_stats: {e}")
        return jsonify({"error": "Internal server error"}), 500

@sessions_bp.route("/<int:user_id>/terminate", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def terminate_session(user_id):
    """Terminate a user's session"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id).first()
        target_user = User.query.get(user_id)

        if not current_user or not target_user:
            return jsonify({"error": "User not found"}), 404

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_manage_sessions = (
            RBACManager.is_owner(current_user)
            or rbac_service.check_permission(current_user.id, "employees.edit")
            or rbac_service.check_permission(current_user.id, "clients.edit")
        )
        if can_manage_sessions:
            if RBACManager.is_owner(current_user):
                if current_user.id == target_user.id:
                    return jsonify({"error": "Cannot terminate your own session"}), 400
            else:
                if current_user.project_id != target_user.project_id:
                    return jsonify({"error": "Access denied"}), 403

                target_user_roles = RBACManager.get_user_role_names(target_user)
                if not any(role in ["seller", "developer"] for role in target_user_roles):
                    return jsonify({"error": "Access denied"}), 403
                if current_user.id == target_user.id:
                    return jsonify({"error": "Cannot terminate your own session"}), 400
        else:
            return jsonify({"error": "Access denied"}), 403

        try:
            activity_service.log_activity(
                current_user,
                "terminate_session",
                details=f"Terminated session for user: {target_user.username}",
                ip=request.remote_addr,
            )

            return jsonify(
                {
                    "message": f"Session terminated for user {target_user.username}",
                    "user_id": user_id,
                }
            )

        except Exception as e:
            logging.debug(f"Error terminating session: {e}")
            return jsonify({"error": f"Failed to terminate session: {str(e)}"}), 500
    except Exception as e:
        logging.debug(f"Error in terminate_session: {e}")
        return jsonify({"error": "Internal server error"}), 500

@validate_request(SessionBulkTerminateSchema)
@sessions_bp.route("/bulk/terminate", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_terminate_sessions(validated_data=None):
    """Bulk terminate sessions"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_manage_sessions = (
            RBACManager.is_owner(current_user)
            or rbac_service.check_permission(current_user.id, "employees.edit")
            or rbac_service.check_permission(current_user.id, "clients.edit")
        )
        if not current_user or not can_manage_sessions:
            return jsonify({"error": "Access denied"}), 403

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        user_ids = validated_data.user_ids

        try:
            terminated_count = 0

            for user_id in user_ids:
                target_user = User.query.get(user_id)
                if target_user and target_user.id != current_user.id:
                    can_terminate = False

                    from ..services.rbac import rbac_service
                    from ..utils.rbac_utils import RBACManager

                    if RBACManager.is_owner(current_user):
                        can_terminate = True
                    else:
                        can_manage = rbac_service.check_permission(
                            current_user.id, "employees.edit"
                        ) or rbac_service.check_permission(current_user.id, "clients.edit")
                        if can_manage and current_user.project_id == target_user.project_id:
                            target_user_roles = RBACManager.get_user_role_names(target_user)
                            if any(role in ["seller", "developer"] for role in target_user_roles):
                                can_terminate = True

                    if can_terminate:
                        terminated_count += 1

            activity_service.log_activity(
                current_user,
                "bulk_terminate_sessions",
                details=f"Terminated {terminated_count} sessions",
                ip=request.remote_addr,
            )

            return jsonify(
                {
                    "message": f"Terminated {terminated_count} sessions",
                    "terminated_count": terminated_count,
                }
            )

        except Exception as e:
            logging.debug(f"Error in bulk terminate: {e}")
            return jsonify({"error": f"Failed to terminate sessions: {str(e)}"}), 500
    except Exception as e:
        logging.debug(f"Error in bulk_terminate_sessions: {e}")
        return jsonify({"error": "Internal server error"}), 500

@sessions_bp.route("/<int:user_id>/details", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_session_details(user_id):
    """Get detailed information about a user's session"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id).first()
        target_user = User.query.get(user_id)

        if not current_user or not target_user:
            return jsonify({"error": "User not found"}), 404

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(current_user)
            or rbac_service.check_permission(current_user.id, "employees.view")
            or rbac_service.check_permission(current_user.id, "clients.view")
        )
        if can_view_all:
            if not RBACManager.is_owner(current_user):
                if current_user.project_id != target_user.project_id:
                    return jsonify({"error": "Access denied"}), 403
                target_user_roles = RBACManager.get_user_role_names(target_user)
                if not any(role in ["seller", "developer"] for role in target_user_roles):
                    return jsonify({"error": "Access denied"}), 403
        else:
            return jsonify({"error": "Access denied"}), 403

        activities = (
            UserActivity.query.filter_by(user_id=user_id)
            .order_by(UserActivity.created_at.desc())
            .limit(50)
            .all()
        )

        session_activities = []
        for activity in activities:
            try:
                session_activities.append(
                    {
                        "id": activity.id,
                        "action": activity.action,
                        "ip_address": activity.ip_address,
                        "country": activity.country,
                        "city": activity.city,
                        "created_at": (
                            activity.created_at.isoformat() if activity.created_at else None
                        ),
                        "details": activity.details,
                        "user_agent": activity.user_agent,
                    }
                )
            except Exception as e:
                logging.debug(f"Error processing activity {activity.id}: {e}")
                continue

        try:
            if activities:
                session_start = activities[-1].created_at
                session_end = activities[0].created_at
                session_duration = session_end - session_start

                hours = session_duration.total_seconds() // 3600
                minutes = (session_duration.total_seconds() % 3600) // 60

                if hours > 0:
                    duration_str = f"{int(hours)}h {int(minutes)}min"
                else:
                    duration_str = f"{int(minutes)}min"
            else:
                session_start = None
                session_end = None
                duration_str = "0min"
        except Exception as e:
            logging.debug(f"Error calculating session duration: {e}")
            session_start = None
            session_end = None
            duration_str = "Unknown"

        return jsonify(
            {
                "user": {
                    "id": target_user.id,
                    "username": target_user.username,
                    "last_login": (
                        target_user.last_login.isoformat() if target_user.last_login else None
                    ),
                    "last_ip": target_user.last_ip,
                    "last_country": target_user.last_country,
                    "last_city": target_user.last_city,
                },
                "session": {
                    "start": session_start.isoformat() if session_start else None,
                    "end": session_end.isoformat() if session_end else None,
                    "duration": duration_str,
                    "activity_count": len(activities),
                },
                "activities": session_activities,
            }
        )
    except Exception as e:
        logging.debug(f"Error in get_session_details: {e}")
        return jsonify({"error": "Internal server error"}), 500

@sessions_bp.route("/realtime", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_realtime_sessions():
    """Get active sessions in real time"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        active_threshold = get_utc_now() - timedelta(minutes=5)

        query = db.session.query(
            User.id,
            User.username,
            User.last_ip,
            User.last_country,
            User.last_city,
            func.max(UserActivity.created_at).label("last_activity"),
        ).join(UserActivity, User.id == UserActivity.user_id)

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(user)
            or rbac_service.check_permission(user.id, "employees.view")
            or rbac_service.check_permission(user.id, "clients.view")
        )
        if can_view_all:
            if not RBACManager.is_owner(user):
                if user.project_id:
                    query = query.filter(
                        (User.project_id == user.project_id)
                        & (
                            User.id.in_(
                                get_user_ids_with_roles(["seller", "developer"], user.project_id)
                            )
                        )
                    )
                else:
                    query = query.filter(
                        (User.project_id.is_(None))
                        & (User.id.in_(get_user_ids_with_roles(["seller", "developer"], None)))
                    )
        else:
            query = query.filter(User.project_id == user.project_id)

        active_sessions = (
            query.group_by(User.id, User.username, User.last_ip, User.last_country, User.last_city)
            .having(func.max(UserActivity.created_at) >= active_threshold)
            .order_by(func.max(UserActivity.created_at).desc())
            .limit(20)
            .all()
        )

        sessions = []
        for session in active_sessions:
            try:
                sessions.append(
                    {
                        "user_id": session.id,
                        "username": session.username,
                        "last_ip": session.last_ip,
                        "last_country": session.last_country,
                        "last_city": session.last_city,
                        "last_activity": (
                            session.last_activity.isoformat() if session.last_activity else None
                        ),
                        "is_active": True,
                    }
                )
            except Exception as e:
                logging.debug(f"Error processing realtime session {session.id}: {e}")
                continue

        return jsonify(
            {"sessions": sessions, "count": len(sessions), "timestamp": get_utc_now().isoformat()}
        )
    except Exception as e:
        logging.debug(f"Error in get_realtime_sessions: {e}")
        return jsonify({"error": "Internal server error"}), 500

@sessions_bp.route("/terminate/<int:user_id>", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def terminate_user_session(user_id):
    """Terminate a specific user's session"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({"error": "User not found"}), 404

        if not current_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(current_user)
            or rbac_service.check_permission(current_user.id, "employees.view")
            or rbac_service.check_permission(current_user.id, "clients.view")
        )
        if not can_view_all:
            return jsonify({"error": "Insufficient permissions"}), 403

        target_user = User.query.get(user_id)
        if not target_user or target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        session_service = get_service('session_service')
        terminated_count = session_service.terminate_user_sessions(
            user_id=user_id, reason="admin_termination", exclude_session=None
        )

        target_user.last_login = None
        db.session.commit()

        activity_service.log_activity(
            user=current_user,
            action="session_terminated",
            details=f"Terminated {terminated_count} sessions for user {target_user.username} (ID: {user_id})",
        )

        return jsonify(
            {
                "message": f"Terminated {terminated_count} sessions successfully",
                "terminated_count": terminated_count,
            }
        )

    except Exception as e:
        logging.error(f"Error terminating session: {e}")
        return jsonify({"error": "Internal server error"}), 500

@validate_request(SessionBulkLogoutSchema)
@sessions_bp.route("/terminate-multiple", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def terminate_multiple_sessions(validated_data=None):
    """Terminate multiple user sessions"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({"error": "User not found"}), 404

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400


        if not current_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(current_user)
            or rbac_service.check_permission(current_user.id, "employees.view")
            or rbac_service.check_permission(current_user.id, "clients.view")
        )
        if not can_view_all:
            return jsonify({"error": "Insufficient permissions"}), 403

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        user_ids = validated_data.user_ids

        terminated_count = 0
        results = []

        for user_id in user_ids:
            try:

                target_user = User.query.get(user_id)
                if not target_user or target_user.project_id != current_user.project_id:
                    results.append(
                        {
                            "user_id": user_id,
                            "success": False,
                            "error": "User not found or access denied",
                        }
                    )
                    continue

                session_service = get_service('session_service')
                count = session_service.terminate_user_sessions(
                    user_id=user_id, reason="bulk_termination", exclude_session=None
                )

                target_user.last_login = None

                terminated_count += count
                results.append(
                    {
                        "user_id": user_id,
                        "username": target_user.username,
                        "success": True,
                        "terminated_count": count,
                    }
                )

            except Exception as e:
                results.append({"user_id": user_id, "success": False, "error": str(e)})

        db.session.commit()

        activity_service.log_activity(
            user=current_user,
            action="sessions_terminated_bulk",
            details=f"Terminated {terminated_count} sessions for {len(user_ids)} users",
        )

        return jsonify(
            {
                "message": f"Bulk termination completed",
                "total_terminated": terminated_count,
                "results": results,
            }
        )

    except Exception as e:
        logging.error(f"Error in bulk session termination: {e}")
        return jsonify({"error": "Internal server error"}), 500

@sessions_bp.route("/suspicious-activity/<int:user_id>", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_suspicious_activity(user_id):
    """Get suspicious activity for a user"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({"error": "User not found"}), 404

        if not current_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        can_view_all = (
            RBACManager.is_owner(current_user)
            or rbac_service.check_permission(current_user.id, "employees.view")
            or rbac_service.check_permission(current_user.id, "clients.view")
        )
        if not can_view_all:
            return jsonify({"error": "Insufficient permissions"}), 403

        target_user = User.query.get(user_id)
        if not target_user or target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        session_service = get_service('session_service')
        suspicious_activities = session_service.detect_suspicious_activity(
            user_id=user_id,
            ip_address=request.remote_addr or "unknown",
            user_agent=request.headers.get("User-Agent", "unknown"),
        )

        return jsonify(
            {
                "user_id": user_id,
                "username": target_user.username,
                "suspicious_activities": suspicious_activities,
                "count": len(suspicious_activities),
            }
        )

    except Exception as e:
        logging.error(f"Error getting suspicious activity: {e}")
        return jsonify({"error": "Internal server error"}), 500

@sessions_bp.route("/enhanced-stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_enhanced_session_stats():
    """Get enhanced session statistics using session service"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({"error": "User not found"}), 404

        if not current_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        session_service = get_service('session_service')
        stats = session_service.get_session_statistics(project_id=current_user.project_id)

        return jsonify({"success": True, "statistics": stats})

    except Exception as e:
        logging.error(f"Error getting enhanced session stats: {e}")
        return jsonify({"error": "Internal server error"}), 500
