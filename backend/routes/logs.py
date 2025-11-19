from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload

from ..core.extensions import db
from ..middleware.auth import (
    enforce_project_scope,
    require_project_isolation,
    require_project_with_grace_period,
)
from ..models.core import User, UserActivity
from ..services.activity import activity_service
from ..services.rbac import rbac_service
from ..utils.fulltext_search import fulltext_search_filter
from ..utils.rbac_utils import RBACManager

logs_bp = Blueprint("logs", __name__)

def _get_logs_query_filter(user, user_id, project_id_param=None):
    """
    Get the appropriate query filter based on user permissions.
    SECURITY: Always applies project_id filtering to prevent data leakage.
    Returns: (query_filter_dict, can_view_all_project_logs)
    - query_filter_dict: dict with filters to apply (None means no project filter - for owners only)
    - can_view_all_project_logs: bool indicating if user can view all project logs (True if user has logs.view permission)
    """
    from flask import g

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"

    project_id = getattr(g, "project_id", None)

    if is_owner:

        if project_id_param:
            return {"project_id": project_id_param}, True

        if project_id:
            return {"project_id": project_id}, True

        return None, True

    if project_id is None:
        if not user.project_id:

            return None, False
        project_id = user.project_id

    import logging
    logger = logging.getLogger(__name__)
    
    # Check permission - try multiple methods to ensure we get the correct result
    has_logs_view_check = rbac_service.check_permission(user_id, "logs.view")
    user_permissions = rbac_service.get_user_permissions(user_id)
    has_logs_view_direct = "logs.view" in user_permissions
    
    # Also check if user is admin (admins should see all logs)
    user_roles = RBACManager.get_user_role_names(user)
    is_admin = user_roles and "admin" in user_roles
    
    # User has logs.view if any of these conditions are true
    has_logs_view = has_logs_view_check or has_logs_view_direct or is_admin
    
    logger.info(f"Logs filter check - user_id={user_id}, username={user.username if user else 'N/A'}, project_id={project_id}")
    logger.info(f"  - check_permission result: {has_logs_view_check}")
    logger.info(f"  - direct permission check: {has_logs_view_direct}")
    logger.info(f"  - is_admin: {is_admin}")
    logger.info(f"  - final has_logs_view: {has_logs_view}")
    logger.info(f"  - user_permissions sample: {list(user_permissions)[:20]}")

    if has_logs_view:
        # User with logs.view permission can see all logs in their project
        # CRITICAL: Do NOT include user_id in filters when user has logs.view
        result_filters = {"project_id": project_id}
        logger.info(f"✅ User {user_id} has logs.view - returning all project logs for project_id={project_id}")
        logger.info(f"   Filters: {result_filters} (NO user_id filter)")
        return result_filters, True

    # User without logs.view permission can only see their own logs
    result_filters = {"project_id": project_id, "user_id": user_id}
    logger.warning(f"❌ User {user_id} does NOT have logs.view - returning only own logs")
    logger.info(f"   Filters: {result_filters}")
    return result_filters, False

@logs_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_logs():
    from flask import g

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"

    if not is_owner:
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        has_logs_view = rbac_service.check_permission(user_id, "logs.view")

        if not has_logs_view:
            return jsonify({"error": "Insufficient permissions. logs.view permission required"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    action_filter = request.args.get("action")
    user_filter = request.args.get("user_id", type=int)
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    ip_filter = request.args.get("ip")
    project_id_param = request.args.get("project_id", type=int)

    query = UserActivity.query

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"

    project_id = getattr(g, "project_id", None)

    if not is_owner:
        if project_id is None:
            if not user.project_id:
                return (
                    jsonify(
                        {
                            "error": "Project isolation required. All queries must be filtered by project_id."
                        }
                    ),
                    403,
                )
            project_id = user.project_id

        project_id_param = None

    query_filters, can_view_all_project_logs = _get_logs_query_filter(user, user_id, project_id_param)

    if query_filters is None and not is_owner:
        return jsonify({"error": "Project isolation required"}), 403

    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"=" * 80)
    logger.info(f"LOGS QUERY - user_id={user_id}, username={user.username if user else 'N/A'}")
    logger.info(f"  - query_filters from _get_logs_query_filter: {query_filters}")
    logger.info(f"  - can_view_all_project_logs: {can_view_all_project_logs}")
    logger.info(f"  - user.project_id: {user.project_id if user else 'N/A'}")

    # CRITICAL: If user can view all project logs, ensure user_id is NOT in filters
    if can_view_all_project_logs:
        if 'user_id' in query_filters:
            logger.error(f"🚨 SECURITY ERROR: User {user_id} has logs.view but query_filters contains user_id={query_filters.get('user_id')}!")
            logger.error(f"   Removing user_id from filters to allow viewing all project logs")
            query_filters = {k: v for k, v in query_filters.items() if k != 'user_id'}
            logger.info(f"   Corrected query_filters: {query_filters}")
        else:
            logger.info(f"✅ User has logs.view - query_filters correctly does NOT contain user_id")
    else:
        logger.info(f"⚠️  User does NOT have logs.view - will only see own logs")
    
    # Count logs before filtering for debugging
    total_before = query.count()
    logger.info(f"  - Total logs in database (before any filters): {total_before}")

    if query_filters:
        logger.info(f"  - Applying filters: {query_filters}")
        query = query.filter_by(**query_filters)
        total_after = query.count()
        logger.info(f"  - Total logs after filtering: {total_after}")
        logger.info(f"  - Difference: {total_before - total_after} logs filtered out")
    else:
        logger.warning(f"  - No filters applied (this should only happen for owners)")
    
    logger.info(f"=" * 80)

    if can_view_all_project_logs and user_filter:

        if is_owner and not project_id_param:
            filtered_user = User.query.filter_by(id=user_filter).first()
        else:
            project_id_for_check = project_id_param if is_owner and project_id_param else (project_id or user.project_id)
            filtered_user = User.query.filter_by(id=user_filter, project_id=project_id_for_check).first()
        if filtered_user:
            query = query.filter_by(user_id=user_filter)
        else:
            return jsonify({"error": "User not found or access denied"}), 404

    if action_filter:
        query = query.filter_by(action=action_filter)

    if date_from:
        try:
            date_from_obj = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query = query.filter(UserActivity.created_at >= date_from_obj)
        except:
            pass

    if date_to:
        try:
            date_to_obj = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            query = query.filter(UserActivity.created_at <= date_to_obj)
        except:
            pass

    if ip_filter:

        query = fulltext_search_filter(query, ip_filter, "search_vector")

    # Final check: ensure we're not filtering by user_id if user has logs.view
    if can_view_all_project_logs:
        # Double-check that query doesn't have user_id filter
        # This is a safety check to ensure no user_id filter was accidentally applied
        logger.info(f"  - Final check: user has logs.view, ensuring no user_id filter in query")
    
    try:
        # Log the final query state before pagination
        final_count = query.count()
        logger.info(f"  - Final query count before pagination: {final_count}")
        
        pagination = query.order_by(UserActivity.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        logger.info(f"  - Pagination result: total={pagination.total}, page={page}, per_page={per_page}, items={len(pagination.items)}")

        activity_user_ids = list(set([a.user_id for a in pagination.items if a.user_id]))
        users_dict = {}
        if activity_user_ids:

            if is_owner and not project_id_param and query_filters is None:
                users_list = User.query.filter(User.id.in_(activity_user_ids)).all()
            else:
                project_id_for_users = project_id_param if is_owner and project_id_param else (project_id or user.project_id)
                users_list = User.query.filter(
                    User.id.in_(activity_user_ids), User.project_id == project_id_for_users
                ).all()
            users_dict = {u.id: u for u in users_list}

        logs = []
        for activity in pagination.items:
            activity_user = users_dict.get(activity.user_id) if activity.user_id else None

            logs.append(
                {
                    "id": activity.id,
                    "user_id": activity.user_id,
                    "username": activity_user.username if activity_user else None,
                    "action": activity.action,
                    "ip_address": activity.ip_address,
                    "country": activity.country,
                    "city": activity.city,
                    "created_at": activity.created_at.isoformat() if activity.created_at else None,
                    "details": activity.details,
                    "user_agent": activity.user_agent,
                }
            )

        return jsonify(
            {
                "logs": logs,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "error": "Failed to retrieve logs",
                    "code": "LOGS_RETRIEVAL_ERROR",
                    "message": str(e),
                }
            ),
            500,
        )

@logs_bp.route("/connects", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_connection_logs():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
    user_roles = RBACManager.get_user_role_names(user)
    if not user or (not user_roles or (user_roles[0] != "admin" and user_roles[0] != "owner")):
        return jsonify({"error": "Access denied"}), 403

    try:
        from ..models.core import SystemSettings

        activity_log_setting = SystemSettings.query.filter_by(
            setting_key="activity_log", category="preferences"
        ).first()

        if activity_log_setting and activity_log_setting.setting_value.lower() == "false":
            return jsonify({"error": "Activity logging is disabled"}), 403
    except:
        pass

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    status_filter = request.args.get("status")
    user_filter = request.args.get("user_id", type=int)
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    ip_filter = request.args.get("ip")
    game_filter = request.args.get("game")
    project_id_param = request.args.get("project_id", type=int)

    query = UserActivity.query.filter(
        or_(UserActivity.action.like("api_connect%"), UserActivity.action.like("connect%"))
    )

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"

    if not is_owner:

        if user.project_id:
            query = query.filter_by(project_id=user.project_id)
        project_id_param = None
    elif project_id_param:

        query = query.filter_by(project_id=project_id_param)

    if status_filter:
        if status_filter == "success":
            query = query.filter_by(action="api_connect")
        elif status_filter == "error":
            query = query.filter(UserActivity.action.like("api_connect_error%"))

    if user_filter:
        query = query.filter_by(user_id=user_filter)

    if date_from:
        try:
            date_from_obj = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query = query.filter(UserActivity.created_at >= date_from_obj)
        except:
            pass

    if date_to:
        try:
            date_to_obj = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            query = query.filter(UserActivity.created_at <= date_to_obj)
        except:
            pass

    if ip_filter:

        query = fulltext_search_filter(query, ip_filter, "search_vector")

    if game_filter:

        query = fulltext_search_filter(query, game_filter, "search_vector")

    try:
        pagination = query.order_by(UserActivity.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        activity_user_ids = list(set([a.user_id for a in pagination.items if a.user_id]))
        users_dict = {}
        if activity_user_ids:

            if is_owner and not project_id_param:
                users_list = User.query.filter(User.id.in_(activity_user_ids)).all()
            else:
                project_id_for_users = project_id_param if is_owner and project_id_param else user.project_id
                users_list = User.query.filter(
                    User.id.in_(activity_user_ids), User.project_id == project_id_for_users
                ).all()
            users_dict = {u.id: u for u in users_list}

        logs = []
        for activity in pagination.items:
            activity_user = users_dict.get(activity.user_id) if activity.user_id else None

            details = {}
            if activity.details:
                try:
                    detail_parts = activity.details.split(", ")
                    for part in detail_parts:
                        if "=" in part:
                            key, value = part.split("=", 1)
                            details[key.strip()] = value.strip()
                except:
                    pass

            is_success = activity.action == "api_connect"
            is_error = activity.action.startswith("api_connect_error")

            logs.append(
                {
                    "id": activity.id,
                    "user_id": activity.user_id,
                    "username": activity_user.username if activity_user else "Unknown",
                    "action": activity.action,
                    "status": "success" if is_success else "error" if is_error else "unknown",
                    "ip_address": activity.ip_address,
                    "country": activity.country,
                    "city": activity.city,
                    "created_at": activity.created_at.isoformat() if activity.created_at else None,
                    "details": activity.details,
                    "user_agent": activity.user_agent,
                    "game": details.get("game", "Unknown"),
                    "user_key": details.get("user_key", "N/A"),
                    "serial": details.get("serial", "N/A"),
                    "reason": details.get("reason", "N/A") if is_error else None,
                }
            )

        return jsonify(
            {
                "logs": logs,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "error": "Failed to retrieve connection logs",
                    "code": "CONNECTION_LOGS_RETRIEVAL_ERROR",
                    "message": str(e),
                }
            ),
            500,
        )

@logs_bp.route("/connects/stats", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_connection_log_stats():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
    user_roles = RBACManager.get_user_role_names(user)
    if not user or (not user_roles or (user_roles[0] != "admin" and user_roles[0] != "owner")):
        return jsonify({"error": "Access denied"}), 403

    try:
        try:
            from ..models.core import SystemSettings

            activity_log_setting = SystemSettings.query.filter_by(
                setting_key="activity_log", category="preferences"
            ).first()

            if activity_log_setting and activity_log_setting.setting_value.lower() == "false":
                return jsonify({"error": "Activity logging is disabled"}), 403
        except:
            pass

        base_query = UserActivity.query.filter(
            or_(UserActivity.action.like("api_connect%"), UserActivity.action.like("connect%"))
        )

        if (
            RBACManager.get_user_role_names(user)[0]
            if RBACManager.get_user_role_names(user)
            else "client" != "owner" and user.project_id
        ):
            base_query = base_query.filter_by(project_id=user.project_id)

        total_connections = base_query.count()
        successful_connections = base_query.filter_by(action="api_connect").count()
        failed_connections = base_query.filter(
            UserActivity.action.like("api_connect_error%")
        ).count()

        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        daily_stats = (
            db.session.query(
                func.date(UserActivity.created_at).label("date"), func.count().label("count")
            )
            .filter(
                and_(
                    UserActivity.created_at >= seven_days_ago,
                    or_(
                        UserActivity.action.like("api_connect%"),
                        UserActivity.action.like("connect%"),
                    ),
                )
            )
            .group_by(func.date(UserActivity.created_at))
            .all()
        )

        error_reasons = (
            db.session.query(UserActivity.details, func.count().label("count"))
            .filter(
                and_(
                    UserActivity.action.like("api_connect_error%"), UserActivity.details.isnot(None)
                )
            )
            .group_by(UserActivity.details)
            .order_by(func.count().desc())
            .limit(5)
            .all()
        )

        parsed_reasons = []
        for reason_data, count in error_reasons:
            if reason_data:
                try:
                    reason_parts = reason_data.split(", ")
                    for part in reason_parts:
                        if part.startswith("reason="):
                            reason = part.split("=", 1)[1]
                            parsed_reasons.append({"reason": reason, "count": count})
                            break
                except:
                    parsed_reasons.append({"reason": "Unknown", "count": count})

        return jsonify(
            {
                "overview": {
                    "total": total_connections,
                    "successful": successful_connections,
                    "failed": failed_connections,
                    "success_rate": round(
                        (
                            (successful_connections / total_connections * 100)
                            if total_connections > 0
                            else 0
                        ),
                        2,
                    ),
                },
                "daily_stats": [
                    {"date": stat.date.isoformat(), "count": stat.count} for stat in daily_stats
                ],
                "top_error_reasons": parsed_reasons,
            }
        )

    except Exception as e:
        return (
            jsonify(
                {
                    "error": "Failed to retrieve connection log statistics",
                    "code": "CONNECTION_STATS_ERROR",
                    "message": str(e),
                }
            ),
            500,
        )

@logs_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_log_stats():
    from flask import g

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"

    if not is_owner:
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

    # Use the same filter logic as get_logs() to respect logs.view permission
    project_id_param = request.args.get("project_id", type=int)
    query_filters, can_view_all_project_logs = _get_logs_query_filter(user, user_id, project_id_param)

    if query_filters is None and not is_owner:
        return jsonify({"error": "Project isolation required"}), 403

    # CRITICAL: If user can view all project logs, ensure user_id is NOT in filters
    if can_view_all_project_logs and query_filters and 'user_id' in query_filters:
        query_filters = {k: v for k, v in query_filters.items() if k != 'user_id'}

    # Base query with filters
    query = UserActivity.query
    if query_filters:
        query = query.filter_by(**query_filters)

    total_logs = query.count()
    logs_today = query.filter(UserActivity.created_at >= datetime.utcnow().date()).count()
    logs_week = query.filter(
        UserActivity.created_at >= datetime.utcnow() - timedelta(days=7)
    ).count()
    logs_month = query.filter(
        UserActivity.created_at >= datetime.utcnow() - timedelta(days=30)
    ).count()

    # Action stats with same filters
    action_stats = db.session.query(UserActivity.action, func.count(UserActivity.id))
    if query_filters:
        for key, value in query_filters.items():
            if key == 'project_id':
                action_stats = action_stats.filter(UserActivity.project_id == value)
            elif key == 'user_id':
                action_stats = action_stats.filter(UserActivity.user_id == value)

    action_stats = (
        action_stats.group_by(UserActivity.action)
        .order_by(func.count(UserActivity.id).desc())
        .limit(10)
        .all()
    )

    # IP stats with same filters
    ip_stats = db.session.query(UserActivity.ip_address, func.count(UserActivity.id))
    if query_filters:
        for key, value in query_filters.items():
            if key == 'project_id':
                ip_stats = ip_stats.filter(UserActivity.project_id == value)
            elif key == 'user_id':
                ip_stats = ip_stats.filter(UserActivity.user_id == value)

    ip_stats = (
        ip_stats.group_by(UserActivity.ip_address)
        .order_by(func.count(UserActivity.id).desc())
        .limit(10)
        .all()
    )

    # Daily stats with same filters
    daily_stats = []
    for i in range(30):
        date = datetime.utcnow().date() - timedelta(days=i)

        day_query = UserActivity.query.filter(func.date(UserActivity.created_at) == date)
        if query_filters:
            for key, value in query_filters.items():
                if key == 'project_id':
                    day_query = day_query.filter(UserActivity.project_id == value)
                elif key == 'user_id':
                    day_query = day_query.filter(UserActivity.user_id == value)

        count = day_query.count()
        daily_stats.append({"date": date.strftime("%Y-%m-%d"), "count": count})

    daily_stats.reverse()

    # Country stats with same filters
    country_stats = db.session.query(UserActivity.country, func.count(UserActivity.id))
    if query_filters:
        for key, value in query_filters.items():
            if key == 'project_id':
                country_stats = country_stats.filter(UserActivity.project_id == value)
            elif key == 'user_id':
                country_stats = country_stats.filter(UserActivity.user_id == value)

    country_stats = (
        country_stats.filter(UserActivity.country.isnot(None))
        .group_by(UserActivity.country)
        .order_by(func.count(UserActivity.id).desc())
        .limit(10)
        .all()
    )

    return jsonify(
        {
            "overview": {
                "total": total_logs,
                "today": logs_today,
                "week": logs_week,
                "month": logs_month,
            },
            "action_stats": [{"action": action, "count": count} for action, count in action_stats],
            "ip_stats": [{"ip": ip, "count": count} for ip, count in ip_stats],
            "country_stats": [
                {"country": country, "count": count} for country, count in country_stats
            ],
            "daily_stats": daily_stats,
        }
    )

@logs_bp.route("/export", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def export_logs():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

    action_filter = request.args.get("action")
    user_filter = request.args.get("user_id", type=int)
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    query = UserActivity.query

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":

        query = query.filter_by(project_id=user.project_id, user_id=user_id)
    elif user_filter:

        project_filter = request.args.get("project_id", type=int)
        if project_filter:
            query = query.filter_by(project_id=project_filter)
        query = query.filter_by(user_id=user_filter)

    if action_filter:
        query = query.filter_by(action=action_filter)

    if date_from:
        try:
            date_from_obj = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query = query.filter(UserActivity.created_at >= date_from_obj)
        except:
            pass

    if date_to:
        try:
            date_to_obj = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            query = query.filter(UserActivity.created_at <= date_to_obj)
        except:
            pass

    query = query.order_by(UserActivity.created_at.desc()).limit(10000)

    def generate_csv():
        """Generator function to stream CSV data"""
        import csv
        from io import StringIO

        buffer = StringIO()
        writer = csv.writer(buffer)

        header = [
            "ID",
            "User ID",
            "Username",
            "Action",
            "IP Address",
            "Country",
            "City",
            "Created At",
            "Details",
            "User Agent",
        ]
        writer.writerow(header)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        batch_size = 1000
        offset = 0

        while True:
            logs_batch = query.offset(offset).limit(batch_size).all()

            if not logs_batch:
                break

            user_ids = [log.user_id for log in logs_batch if log.user_id]
            users_dict = {}
            if user_ids:
                users = User.query.filter(
                    User.id.in_(user_ids), User.project_id == user.project_id
                ).all()
                users_dict = {u.id: u.username for u in users}

            for activity in logs_batch:
                activity_username = users_dict.get(activity.user_id, "") if activity.user_id else ""

                writer.writerow(
                    [
                        activity.id,
                        activity.user_id or "",
                        activity_username,
                        activity.action,
                        activity.ip_address or "",
                        activity.country or "",
                        activity.city or "",
                        activity.created_at.isoformat() if activity.created_at else "",
                        activity.details or "",
                        activity.user_agent or "",
                    ]
                )

            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

            offset += batch_size

            if len(logs_batch) < batch_size:
                break

    from flask import Response

    from ..services.activity import activity_service

    return Response(
        generate_csv(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_logs_export.csv"},
    )

@logs_bp.route("/cleanup", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def cleanup_logs():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
    if (
        not user or RBACManager.get_user_role_names(user)[0]
        if RBACManager.get_user_role_names(user)
        else "client" != "owner"
    ):
        return jsonify({"error": "Access denied"}), 403

    days_old = 60

    cutoff_date = datetime.utcnow() - timedelta(days=days_old)

    try:
        deleted_count = UserActivity.query.filter(UserActivity.created_at < cutoff_date).delete()

        db.session.commit()

        activity_service.log_activity(
            user,
            "cleanup_logs",
            details=f"Cleaned up {deleted_count} logs older than {days_old} days",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Cleaned up {deleted_count} old logs", "deleted_count": deleted_count}
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to cleanup logs: {str(e)}"}), 500

@logs_bp.route("/auto-cleanup", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def trigger_auto_cleanup():
    """Trigger automatic log cleanup using the log cleanup service"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
    if (
        not user or RBACManager.get_user_role_names(user)[0]
        if RBACManager.get_user_role_names(user)
        else "client" != "owner"
    ):
        return jsonify({"error": "Access denied"}), 403

    try:
        from ..services.logs import log_cleanup_service

        result = log_cleanup_service.cleanup_old_logs(user.project_id)

        if result["success"]:
            activity_service.log_activity(
                user,
                "auto_cleanup_logs",
                details=f'Automatic cleanup: {result["total_deleted"]} logs deleted',
                ip=request.remote_addr,
            )

            return jsonify({"message": "Automatic log cleanup completed", "result": result})
        else:
            return jsonify({"error": f'Cleanup failed: {result["error"]}'}), 500

    except Exception as e:
        return jsonify({"error": f"Failed to trigger auto cleanup: {str(e)}"}), 500

@logs_bp.route("/search", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def search_logs():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

    search_term = request.args.get("q")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    if not search_term:
        return jsonify({"error": "Search term is required"}), 400

    query = UserActivity.query

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"
    project_id_param = request.args.get("project_id", type=int)

    if not is_owner:

        query = query.filter_by(project_id=user.project_id, user_id=user_id)
        project_id_param = None
    elif project_id_param:

        query = query.filter_by(project_id=project_id_param)

    query = fulltext_search_filter(query, search_term, "search_vector")

    pagination = query.order_by(UserActivity.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    activity_user_ids = list(set([a.user_id for a in pagination.items if a.user_id]))
    users_dict = {}
    if activity_user_ids:

        if is_owner and not project_id_param:
            users_list = User.query.filter(User.id.in_(activity_user_ids)).all()
        else:
            project_id_for_users = project_id_param if is_owner and project_id_param else user.project_id
            users_list = User.query.filter(
                User.id.in_(activity_user_ids), User.project_id == project_id_for_users
            ).all()
        users_dict = {u.id: u for u in users_list}

    logs = []
    for activity in pagination.items:
        activity_user = users_dict.get(activity.user_id) if activity.user_id else None

        logs.append(
            {
                "id": activity.id,
                "user_id": activity.user_id,
                "username": activity_user.username if activity_user else None,
                "action": activity.action,
                "ip_address": activity.ip_address,
                "country": activity.country,
                "city": activity.city,
                "created_at": activity.created_at.isoformat() if activity.created_at else None,
                "details": activity.details,
                "user_agent": activity.user_agent,
            }
        )

    return jsonify(
        {
            "logs": logs,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
            "per_page": per_page,
            "search_term": search_term,
        }
    )

@logs_bp.route("/realtime", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_realtime_logs():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_roles = RBACManager.get_user_role_names(user)
    if not user_roles or user_roles[0] != "owner":
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

    query = UserActivity.query

    user_roles = RBACManager.get_user_role_names(user)
    is_owner = user_roles and user_roles[0] == "owner"
    project_id_param = request.args.get("project_id", type=int)

    if not is_owner:

        query = query.filter_by(project_id=user.project_id, user_id=user_id)
        project_id_param = None
    elif project_id_param:

        query = query.filter_by(project_id=project_id_param)

    logs = query.order_by(UserActivity.created_at.desc()).limit(50).all()

    activity_user_ids = list(set([a.user_id for a in logs if a.user_id]))
    users_dict = {}
    if activity_user_ids:

        if is_owner and not project_id_param:
            users_list = User.query.filter(User.id.in_(activity_user_ids)).all()
        else:
            project_id_for_users = project_id_param if is_owner and project_id_param else user.project_id
            users_list = User.query.filter(
                User.id.in_(activity_user_ids), User.project_id == project_id_for_users
            ).all()
        users_dict = {u.id: u for u in users_list}

    realtime_logs = []
    for activity in logs:
        activity_user = users_dict.get(activity.user_id) if activity.user_id else None

        realtime_logs.append(
            {
                "id": activity.id,
                "user_id": activity.user_id,
                "username": activity_user.username if activity_user else None,
                "action": activity.action,
                "ip_address": activity.ip_address,
                "country": activity.country,
                "city": activity.city,
                "created_at": activity.created_at.isoformat() if activity.created_at else None,
                "details": activity.details,
                "user_agent": activity.user_agent,
            }
        )

    return jsonify(
        {
            "logs": realtime_logs,
            "count": len(realtime_logs),
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
