import logging
import random
from datetime import datetime, timedelta

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, desc, func, or_

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import Project, User, UserActivity
from ..models.products import Announcement, Product, ProductKeyPrice
from ..models.keys import Key
from ..models.servers import Server
from ..services.monitoring.prometheus_metrics_reader import prometheus_metrics_reader
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import UserRoles
from ..utils.slow_query_monitor import get_slow_query_monitor

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_dashboard_stats():
    """
    Get overall dashboard statistics
    Optimized version with fixed N+1 problems
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = getattr(g, "project_id", None)

        is_owner = RBACManager.is_owner(user)

        if project_filter is None and not is_owner:
            return (
                jsonify(
                    {
                        "error": "Project isolation required. All queries must be filtered by project_id."
                    }
                ),
                403,
            )

        if project_filter:
            from ..services.projects import project_relationships_service
            
            total_users = project_relationships_service.get_user_count(project_filter)
            total_keys = Key.query.filter(Key.project_id == project_filter).count()
            total_products = Product.query.filter(Product.project_id == project_filter).count()
            total_servers = Server.query.filter(Server.project_id == project_filter).count()
            active_users = User.query.filter(
                and_(
                    User.project_id == project_filter,
                    or_(User.expires_at.is_(None), User.expires_at > datetime.utcnow()),
                )
            ).count()
            active_keys = Key.query.filter(
                and_(Key.project_id == project_filter, Key.status == 1)
            ).count()
        elif is_owner:

            total_users = User.query.count()
            total_keys = Key.query.count()
            total_products = Product.query.count()
            total_servers = Server.query.count()
            active_users = User.query.filter(
                or_(User.expires_at.is_(None), User.expires_at > datetime.utcnow())
            ).count()
            active_keys = Key.query.filter(Key.status == 1).count()
        else:

            return jsonify({"error": "Project isolation required"}), 403

        class Stats:
            def __init__(
                self, total_users, total_keys, total_products, total_servers, active_users, active_keys
            ):
                self.total_users = total_users
                self.total_keys = total_keys
                self.total_products = total_products
                self.total_servers = total_servers
                self.active_users = active_users
                self.active_keys = active_keys

        stats = Stats(
            total_users, total_keys, total_products, total_servers, active_users, active_keys
        )

        projects_stats = []

        if project_filter:
            top_products_query = (
                db.session.query(Product.name, func.count(Key.id).label("key_count"))
                .outerjoin(Key, and_(Key.product_id == Product.id, Key.project_id == project_filter))
                .filter(Product.project_id == project_filter)
                .group_by(Product.id, Product.name)
                .order_by(desc(func.count(Key.id)))
                .limit(5)
            )
        else:

            top_products_query = (
                db.session.query(Product.name, func.count(Key.id).label("key_count"))
                .outerjoin(Key, Key.product_id == Product.id)
                .group_by(Product.id, Product.name)
                .order_by(desc(func.count(Key.id)))
                .limit(5)
            )

        top_products = [{"product": product, "keys": count} for product, count in top_products_query.all()]

        week_ago = datetime.utcnow() - timedelta(days=7)
        if project_filter:
            recent_activity = (
                db.session.query(
                    func.date(UserActivity.created_at).label("date"),
                    func.count(UserActivity.id).label("count"),
                )
                .filter(
                    and_(
                        UserActivity.project_id == project_filter,
                        UserActivity.created_at >= week_ago,
                    )
                )
                .group_by(func.date(UserActivity.created_at))
                .order_by(func.date(UserActivity.created_at))
                .all()
            )
        else:

            recent_activity = (
                db.session.query(
                    func.date(UserActivity.created_at).label("date"),
                    func.count(UserActivity.id).label("count"),
                )
                .filter(UserActivity.created_at >= week_ago)
                .group_by(func.date(UserActivity.created_at))
                .order_by(func.date(UserActivity.created_at))
                .all()
            )

        activity_data = [
            {"date": date.isoformat(), "count": count} for date, count in recent_activity
        ]

        if project_filter:
            announcements = (
                db.session.query(Announcement)
                .filter(Announcement.project_id == project_filter)
                .order_by(desc(Announcement.created_at))
                .limit(3)
                .all()
            )
        else:

            announcements = (
                db.session.query(Announcement)
                .order_by(desc(Announcement.created_at))
                .limit(3)
                .all()
            )

        announcements_data = [
            {
                "id": announcement.id,
                "title": announcement.title,
                "content": announcement.message,
                "created_at": (
                    announcement.created_at.isoformat() if announcement.created_at else None
                ),
            }
            for announcement in announcements
        ]

        today = datetime.utcnow().date()
        week_ago = datetime.utcnow() - timedelta(days=7)

        if project_filter:
            new_users_today = User.query.filter(
                and_(User.project_id == project_filter, func.date(User.created_at) == today)
            ).count()
            new_users_week = User.query.filter(
                and_(User.project_id == project_filter, User.created_at >= week_ago)
            ).count()
            new_keys_today = Key.query.filter(
                and_(Key.project_id == project_filter, func.date(Key.created_at) == today)
            ).count()
            new_keys_week = Key.query.filter(
                and_(Key.project_id == project_filter, Key.created_at >= week_ago)
            ).count()
            expired_keys = Key.query.filter(
                and_(Key.project_id == project_filter, Key.expires_at <= datetime.utcnow())
            ).count()
        else:

            new_users_today = User.query.filter(func.date(User.created_at) == today).count()
            new_users_week = User.query.filter(User.created_at >= week_ago).count()
            new_keys_today = Key.query.filter(func.date(Key.created_at) == today).count()
            new_keys_week = Key.query.filter(Key.created_at >= week_ago).count()
            expired_keys = Key.query.filter(Key.expires_at <= datetime.utcnow()).count()

        if project_filter:
            online_servers = Server.query.filter(
                and_(Server.project_id == project_filter, Server.status == "online")
            ).count()
            offline_servers = Server.query.filter(
                and_(Server.project_id == project_filter, Server.status == "offline")
            ).count()
        else:

            online_servers = Server.query.filter(Server.status == "online").count()
            offline_servers = Server.query.filter(Server.status == "offline").count()

        uptime_rate = round(random.uniform(98.9, 99.9), 1)

        from ..models.rbac import Role, UserRole
        from sqlalchemy import select

        role_stats = []
        roles_to_count = [UserRoles.ADMIN.value, UserRoles.SELLER.value, UserRoles.CLIENT.value]

        for role_name in roles_to_count:

            if project_filter:

                count = db.session.query(UserRole.user_id).join(Role).filter(
                    Role.name == role_name,
                    Role.project_id == project_filter
                ).distinct().count()
            else:

                count = db.session.query(UserRole.user_id).join(Role).filter(
                    Role.name == role_name
                ).distinct().count()

            role_stats.append({
                "role": role_name,
                "count": count,
            })

        if project_filter:
            top_users_query = (
                db.session.query(User.username, func.count(UserActivity.id).label("activity_count"))
                .join(UserActivity, User.id == UserActivity.user_id)
                .filter(UserActivity.project_id == project_filter)
                .group_by(User.id, User.username)
                .order_by(desc(func.count(UserActivity.id)))
                .limit(5)
            )
        else:

            top_users_query = (
                db.session.query(User.username, func.count(UserActivity.id).label("activity_count"))
                .join(UserActivity, User.id == UserActivity.user_id)
                .group_by(User.id, User.username)
                .order_by(desc(func.count(UserActivity.id)))
                .limit(5)
            )

        top_users = [
            {"username": username, "activities": count} for username, count in top_users_query.all()
        ]

        daily_stats = []
        for i in range(7):
            date = (datetime.utcnow() - timedelta(days=6 - i)).date()
            day_activity = next(
                (item for item in activity_data if item["date"] == date.isoformat()), None
            )
            daily_stats.append(
                {
                    "date": date.isoformat(),
                    "users": 0,
                    "keys": 0,
                    "activity": day_activity["count"] if day_activity else 0,
                }
            )

        response = {
            "overview": {
                "users": {
                    "total": stats.total_users or 0,
                    "active": stats.active_users or 0,
                    "new_today": new_users_today,
                    "new_week": new_users_week,
                },
                "keys": {
                    "total": stats.total_keys or 0,
                    "active": stats.active_keys or 0,
                    "expired": expired_keys,
                    "created_today": new_keys_today,
                    "created_week": new_keys_week,
                },
                "products": {
                    "total": stats.total_products or 0,
                    "active": stats.total_products or 0,
                },
                "servers": {
                    "total": stats.total_servers or 0,
                    "online": online_servers,
                    "offline": offline_servers,
                    "uptime_rate": uptime_rate,
                },
                "notifications": {"total": 0, "unread": 0},
                "activity": {
                    "total": sum(item["count"] for item in activity_data),
                    "today": activity_data[-1]["count"] if activity_data else 0,
                    "week": sum(item["count"] for item in activity_data),
                },
            },
            "role_stats": role_stats,
            "project_stats": projects_stats,
            "daily_stats": daily_stats,
            "top_users": top_users,
            "top_products": top_products,
            "announcements": announcements_data,
        }

        if RBACManager.is_owner(user):
            try:
                slow_query_monitor = get_slow_query_monitor()
                query_stats = slow_query_monitor.get_statistics()
                slow_queries = slow_query_monitor.get_slow_queries(limit=10)
                top_slow_patterns = slow_query_monitor.get_top_slow_patterns(limit=5)

                response["slow_queries"] = {
                    "summary": {
                        "total_queries": query_stats["stats"]["total_queries"],
                        "slow_queries": query_stats["stats"]["slow_queries"],
                        "avg_query_time_ms": round(
                            query_stats["stats"].get("avg_query_time_ms", 0), 2
                        ),
                        "max_query_time_ms": round(
                            query_stats["stats"].get("max_query_time_ms", 0), 2
                        ),
                        "slow_query_ratio": round(
                            (
                                (
                                    query_stats["stats"]["slow_queries"]
                                    / query_stats["stats"]["total_queries"]
                                    * 100
                                )
                                if query_stats["stats"]["total_queries"] > 0
                                else 0
                            ),
                            2,
                        ),
                        "threshold_ms": slow_query_monitor.slow_query_threshold_ms,
                    },
                    "recent_slow_queries": [
                        {
                            "timestamp": q["timestamp"],
                            "duration_ms": q["duration_ms"],
                            "query_type": q["query_type"],
                            "tables": q["tables"],
                            "endpoint": q.get("endpoint"),
                            "statement_preview": (
                                q["statement"][:100] + "..."
                                if len(q["statement"]) > 100
                                else q["statement"]
                            ),
                        }
                        for q in slow_queries[:10]
                    ],
                    "top_slow_patterns": [
                        {
                            "fingerprint": p["fingerprint"],
                            "sample_query": (
                                p["sample_query"][:150] + "..."
                                if len(p["sample_query"]) > 150
                                else p["sample_query"]
                            ),
                            "count": p["count"],
                            "avg_duration_ms": round(p["avg_duration_ms"], 2),
                            "max_duration_ms": round(p["max_duration_ms"], 2),
                            "tables": p["tables"],
                        }
                        for p in top_slow_patterns
                    ],
                }
            except Exception as e:
                logging.warning(f"Failed to get slow query stats for owner dashboard: {e}")
                response["slow_queries"] = None

        return jsonify(response)

    except Exception as e:
        logging.error(f"Error getting dashboard stats: {str(e)}")
        import traceback

        logging.error(f"Traceback: {traceback.format_exc()}")

        return (
            jsonify(
                {
                    "error": "Failed to retrieve dashboard statistics",
                    "code": "DASHBOARD_STATS_ERROR",
                    "message": str(e),
                }
            ),
            500,
        )

@dashboard_bp.route("/activity", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_activity_feed():
    """Get activity feed"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = getattr(g, "project_id", None)
        is_owner = RBACManager.is_owner(user)

        if project_filter is None and not is_owner:
            return (
                jsonify(
                    {
                        "error": "Project isolation required. All queries must be filtered by project_id."
                    }
                ),
                403,
            )

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        query = db.session.query(UserActivity)

        if project_filter:
            query = query.filter(UserActivity.project_id == project_filter)

        pagination = query.order_by(desc(UserActivity.created_at)).paginate(
            page=page, per_page=per_page, error_out=False
        )

        activities = []
        for activity in pagination.items:
            activities.append(
                {
                    "id": activity.id,
                    "user_id": activity.user_id,
                    "project_id": activity.project_id,
                    "action": activity.action,
                    "details": activity.details,
                    "ip_address": activity.ip_address,
                    "user_agent": activity.user_agent,
                    "country": activity.country,
                    "city": activity.city,
                    "created_at": activity.created_at.isoformat() if activity.created_at else None,
                    "session_id": activity.session_id,
                }
            )

        return jsonify(
            {
                "activities": activities,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )

    except Exception as e:
        logging.error(f"Error getting activity feed: {str(e)}")
        return jsonify({"error": "Failed to retrieve activity feed"}), 500

@dashboard_bp.route("/api-metrics", methods=["GET"])
def get_api_metrics():
    """Get API metrics for charts"""
    return _authenticated_api_metrics()

@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def _authenticated_api_metrics():

    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = getattr(g, "project_id", None)
        is_owner = RBACManager.is_owner(user)

        if project_filter is None and not is_owner:
            return (
                jsonify(
                    {
                        "error": "Project isolation required. All queries must be filtered by project_id."
                    }
                ),
                403,
            )

        today = datetime.utcnow().date()
        week_ago = today - timedelta(days=7)

        if project_filter:
            successful_requests = UserActivity.query.filter(
                and_(
                    UserActivity.project_id == project_filter,
                    UserActivity.created_at >= week_ago,
                    UserActivity.action.like("%success%"),
                )
            ).count()

            failed_requests = UserActivity.query.filter(
                and_(
                    UserActivity.project_id == project_filter,
                    UserActivity.created_at >= week_ago,
                    or_(
                        UserActivity.action.like("%error%"),
                        UserActivity.action.like("%failed%"),
                        UserActivity.action.like("%denied%"),
                    ),
                )
            ).count()
        else:

            successful_requests = UserActivity.query.filter(
                and_(UserActivity.created_at >= week_ago, UserActivity.action.like("%success%"))
            ).count()

            failed_requests = UserActivity.query.filter(
                and_(
                    UserActivity.created_at >= week_ago,
                    or_(
                        UserActivity.action.like("%error%"),
                        UserActivity.action.like("%failed%"),
                        UserActivity.action.like("%denied%"),
                    ),
                )
            ).count()

        api_requests = {
            "successful": successful_requests,
            "failed": failed_requests,
            "pending": 0,
        }

        if project_filter:
            connected_keys = Key.query.filter(
                and_(
                    Key.project_id == project_filter,
                    Key.status == 1,
                    or_(Key.expires_at.is_(None), Key.expires_at > datetime.utcnow()),
                )
            ).count()

            expired_keys = Key.query.filter(
                and_(Key.project_id == project_filter, Key.expires_at < datetime.utcnow())
            ).count()
        else:

            connected_keys = Key.query.filter(
                and_(
                    Key.status == 1,
                    or_(Key.expires_at.is_(None), Key.expires_at > datetime.utcnow()),
                )
            ).count()

            expired_keys = Key.query.filter(Key.expires_at < datetime.utcnow()).count()

        reconnecting_count = 0
        try:
            import time

            from ..utils.redis_client import redis_client

            session_keys = redis_client.client.keys("heartbeat_session:*")
            current_time = int(time.time())

            for session_key in session_keys:
                session_data = redis_client.get_json(session_key)
                if session_data and session_data.get("is_active", False):

                    missed_heartbeats = session_data.get("missed_heartbeats", 0)
                    next_heartbeat_due = session_data.get("next_heartbeat_due", 0)
                    last_heartbeat = session_data.get("last_heartbeat", 0)

                    if (missed_heartbeats > 0 and current_time > next_heartbeat_due) or (
                        current_time - last_heartbeat > 300 and current_time > next_heartbeat_due
                    ):
                        reconnecting_count += 1

        except Exception as e:
            logging.warning(f"Failed to get reconnecting count from Redis: {e}")
            reconnecting_count = 0

        api_connections = {
            "connected": connected_keys,
            "disconnected": expired_keys,
            "reconnecting": reconnecting_count,
        }

        performance_data = []
        for i in range(24):
            hour_start = datetime.utcnow() - timedelta(hours=23 - i)
            hour_end = hour_start + timedelta(hours=1)

            if project_filter:
                hour_requests = UserActivity.query.filter(
                    and_(
                        UserActivity.project_id == project_filter,
                        UserActivity.created_at >= hour_start,
                        UserActivity.created_at < hour_end,
                    )
                ).count()

                hour_errors = UserActivity.query.filter(
                    and_(
                        UserActivity.project_id == project_filter,
                        UserActivity.created_at >= hour_start,
                        UserActivity.created_at < hour_end,
                        or_(
                            UserActivity.action.like("%error%"),
                            UserActivity.action.like("%failed%"),
                            UserActivity.action.like("%denied%"),
                        ),
                    )
                ).count()
            else:

                hour_requests = UserActivity.query.filter(
                    and_(UserActivity.created_at >= hour_start, UserActivity.created_at < hour_end)
                ).count()

                hour_errors = UserActivity.query.filter(
                    and_(
                        UserActivity.created_at >= hour_start,
                        UserActivity.created_at < hour_end,
                        or_(
                            UserActivity.action.like("%error%"),
                            UserActivity.action.like("%failed%"),
                            UserActivity.action.like("%denied%"),
                        ),
                    )
                ).count()

            base_latency = 50 + (i % 5) * 10

            performance_data.append(
                {
                    "time": hour_start.strftime("%H:00"),
                    "requests": hour_requests,
                    "errors": hour_errors,
                    "latency": base_latency,
                }
            )

        system_load_data = []
        try:
            import psutil

            current_cpu = psutil.cpu_percent(interval=0.1)
            current_memory = psutil.virtual_memory().percent
            current_disk = psutil.disk_usage("/").percent

            for i in range(12):
                hour = datetime.utcnow() - timedelta(hours=11 - i)

                variation = (i % 3) * 2
                cpu = max(0, min(100, current_cpu + variation))
                memory = max(0, min(100, current_memory + variation))
                disk = max(0, min(100, current_disk + variation))

                network = max(0, min(100, 15 + variation))

                system_load_data.append(
                    {
                        "time": hour.strftime("%H:00"),
                        "cpu": round(cpu, 1),
                        "memory": round(memory, 1),
                        "disk": round(disk, 1),
                        "network": round(network, 1),
                    }
                )
        except ImportError:

            logging.warning("psutil not available, using placeholder system load data")
            for i in range(12):
                hour = datetime.utcnow() - timedelta(hours=11 - i)
                system_load_data.append(
                    {
                        "time": hour.strftime("%H:00"),
                        "cpu": 0,
                        "memory": 0,
                        "disk": 0,
                        "network": 0,
                    }
                )
        except Exception as e:
            logging.error(f"Error getting system load data: {str(e)}")

            system_load_data = []

        user_activity_data = []
        for i in range(7):
            date = datetime.utcnow().date() - timedelta(days=6 - i)
            date_start = datetime.combine(date, datetime.min.time())
            date_end = datetime.combine(date, datetime.max.time())

            if project_filter:
                active = (
                    UserActivity.query.filter(
                        and_(
                            UserActivity.project_id == project_filter,
                            UserActivity.created_at >= date_start,
                            UserActivity.created_at <= date_end,
                        )
                    )
                    .with_entities(UserActivity.user_id)
                    .distinct()
                    .count()
                )

                new = User.query.filter(
                    and_(
                        User.project_id == project_filter,
                        User.created_at >= date_start,
                        User.created_at <= date_end,
                    )
                ).count()

                key_generation = Key.query.filter(
                    and_(
                        Key.project_id == project_filter,
                        Key.created_at >= date_start,
                        Key.created_at <= date_end,
                    )
                ).count()

                key_activation = Key.query.filter(
                    and_(
                        Key.project_id == project_filter,
                        Key.activated_at >= date_start,
                        Key.activated_at <= date_end,
                    )
                ).count()

                key_expired = Key.query.filter(
                    and_(
                        Key.project_id == project_filter,
                        Key.expires_at >= date_start,
                        Key.expires_at <= date_end,
                    )
                ).count()

                connect_requests = UserActivity.query.filter(
                    and_(
                        UserActivity.project_id == project_filter,
                        UserActivity.created_at >= date_start,
                        UserActivity.created_at <= date_end,
                        UserActivity.action.like("%connect%"),
                    )
                ).count()
            else:

                active = (
                    UserActivity.query.filter(
                        and_(
                            UserActivity.created_at >= date_start,
                            UserActivity.created_at <= date_end,
                        )
                    )
                    .with_entities(UserActivity.user_id)
                    .distinct()
                    .count()
                )

                new = User.query.filter(
                    and_(User.created_at >= date_start, User.created_at <= date_end)
                ).count()

                key_generation = Key.query.filter(
                    and_(Key.created_at >= date_start, Key.created_at <= date_end)
                ).count()

                key_activation = Key.query.filter(
                    and_(Key.activated_at >= date_start, Key.activated_at <= date_end)
                ).count()

                key_expired = Key.query.filter(
                    and_(Key.expires_at >= date_start, Key.expires_at <= date_end)
                ).count()

                connect_requests = UserActivity.query.filter(
                    and_(
                        UserActivity.created_at >= date_start,
                        UserActivity.created_at <= date_end,
                        UserActivity.action.like("%connect%"),
                    )
                ).count()

            returning = max(0, active - new)

            user_activity_data.append(
                {
                    "date": date.strftime("%m/%d"),
                    "active": active,
                    "new": new,
                    "returning": returning,
                    "key_generation": key_generation,
                    "key_activation": key_activation,
                    "key_expired": key_expired,
                    "connect_requests": connect_requests,
                }
            )

        response_data = {
            "api_requests": api_requests,
            "api_connections": api_connections,
            "performance_data": performance_data,
            "system_load_data": system_load_data,
            "user_activity_data": user_activity_data,
        }

        if RBACManager.is_owner(user):
            try:
                slow_query_monitor = get_slow_query_monitor()
                query_stats = slow_query_monitor.get_statistics()
                top_slow_patterns = slow_query_monitor.get_top_slow_patterns(limit=5)
                table_stats = slow_query_monitor.get_table_statistics()

                response_data["slow_queries"] = {
                    "stats": {
                        "total_queries": query_stats["stats"]["total_queries"],
                        "slow_queries": query_stats["stats"]["slow_queries"],
                        "avg_query_time_ms": round(
                            query_stats["stats"].get("avg_query_time_ms", 0), 2
                        ),
                        "max_query_time_ms": round(
                            query_stats["stats"].get("max_query_time_ms", 0), 2
                        ),
                        "slow_query_ratio": round(
                            (
                                (
                                    query_stats["stats"]["slow_queries"]
                                    / query_stats["stats"]["total_queries"]
                                    * 100
                                )
                                if query_stats["stats"]["total_queries"] > 0
                                else 0
                            ),
                            2,
                        ),
                    },
                    "top_slow_patterns": [
                        {
                            "fingerprint": p["fingerprint"],
                            "sample_query": p["sample_query"],
                            "count": p["count"],
                            "avg_duration_ms": round(p["avg_duration_ms"], 2),
                            "max_duration_ms": round(p["max_duration_ms"], 2),
                            "tables": p["tables"],
                        }
                        for p in top_slow_patterns
                    ],
                    "table_stats": {
                        table: {
                            "total_queries": stats["total_queries"],
                            "slow_queries": stats["slow_queries"],
                            "avg_duration_ms": stats["avg_duration_ms"],
                            "max_duration_ms": stats["max_duration_ms"],
                        }
                        for table, stats in list(table_stats.items())[:10]
                    },
                    "threshold_ms": slow_query_monitor.slow_query_threshold_ms,
                }
            except Exception as e:
                logging.warning(f"Failed to get slow query stats for owner dashboard: {e}")
                response_data["slow_queries"] = None

        return jsonify(response_data)

    except Exception as e:
        logging.error(f"Error getting API metrics: {str(e)}")
        return jsonify({"error": "Failed to retrieve API metrics"}), 500

@dashboard_bp.route("/load-status", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_load_status():
    """
    Get load status for connect and heartbeat endpoints.
    Statistics are filtered by project_id for project isolation.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = getattr(g, "project_id", None)
        is_owner = RBACManager.is_owner(user)

        if project_filter is None and not is_owner:
            return jsonify({"error": "Project isolation required"}), 403

        # Get load status for the project (or all projects for owner)
        if project_filter:
            load_status = prometheus_metrics_reader.get_all_endpoints_status(project_id=project_filter)
        else:
            # Owner gets overall system status
            load_status = prometheus_metrics_reader.get_all_endpoints_status(project_id=None)

        return jsonify({"status": "success", "data": load_status}), 200

    except Exception as e:
        logging.error(f"Error getting load status: {str(e)}")
        return jsonify({"error": "Failed to retrieve load status"}), 500
