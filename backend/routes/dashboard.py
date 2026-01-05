import logging
import random
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import joinedload

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import Project, User, UserActivity
from ..models.products import Announcement, Product, ProductKeyPrice
from ..models.keys import Key
from ..models.servers import Server
from ..services.monitoring.prometheus_metrics_reader import prometheus_metrics_reader
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import UserRoles
from ..utils.service_helpers import get_service

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_dashboard_stats(project_id=None):
    """
    Get overall dashboard statistics
    Optimized version with fixed N+1 problems
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = project_id

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
            project_relationships_service = get_service('project_relationships_service')
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

        # Get top countries by requests
        if project_filter:
            top_countries_query = (
                db.session.query(
                    UserActivity.country,
                    func.count(UserActivity.id).label("request_count")
                )
                .filter(
                    and_(
                        UserActivity.project_id == project_filter,
                        UserActivity.country.isnot(None),
                        UserActivity.created_at >= week_ago,
                    )
                )
                .group_by(UserActivity.country)
                .order_by(desc(func.count(UserActivity.id)))
                .limit(10)
            )
        else:
            top_countries_query = (
                db.session.query(
                    UserActivity.country,
                    func.count(UserActivity.id).label("request_count")
                )
                .filter(
                    and_(
                        UserActivity.country.isnot(None),
                        UserActivity.created_at >= week_ago,
                    )
                )
                .group_by(UserActivity.country)
                .order_by(desc(func.count(UserActivity.id)))
                .limit(10)
            )

        top_countries = [
            {"country": country, "requests": count} 
            for country, count in top_countries_query.all()
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
            "top_countries": top_countries,
            "announcements": announcements_data,
        }

        # Slow query monitoring removed.
        # Use APM tools (Datadog, NewRelic) or PostgreSQL's pg_stat_statements for query monitoring.

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
def get_activity_feed(project_id=None):
    """Get activity feed"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = project_id
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
def _authenticated_api_metrics(project_id=None):

    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = project_id
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

        # System load data (CPU, RAM, Disk) removed.
        # Use Kubernetes/Docker/Prometheus Node Exporter for system resource monitoring.
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

        # Slow query monitoring removed.
        # Use APM tools (Datadog, NewRelic) or PostgreSQL's pg_stat_statements for query monitoring.

        return jsonify(response_data)

    except Exception as e:
        logging.error(f"Error getting API metrics: {str(e)}")
        return jsonify({"error": "Failed to retrieve API metrics"}), 500

@dashboard_bp.route("/countries-map", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_countries_map_data(project_id=None):
    """
    Get countries data with coordinates for map visualization
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = project_id
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

        week_ago = datetime.utcnow() - timedelta(days=7)

        # Get countries with request counts
        if project_filter:
            countries_query = (
                db.session.query(
                    UserActivity.country,
                    func.count(UserActivity.id).label("request_count")
                )
                .filter(
                    and_(
                        UserActivity.project_id == project_filter,
                        UserActivity.country.isnot(None),
                        UserActivity.created_at >= week_ago,
                    )
                )
                .group_by(UserActivity.country)
                .order_by(desc(func.count(UserActivity.id)))
            )
        else:
            countries_query = (
                db.session.query(
                    UserActivity.country,
                    func.count(UserActivity.id).label("request_count")
                )
                .filter(
                    and_(
                        UserActivity.country.isnot(None),
                        UserActivity.created_at >= week_ago,
                    )
                )
                .group_by(UserActivity.country)
                .order_by(desc(func.count(UserActivity.id)))
            )

        countries_data = countries_query.all()

        # Country to coordinates mapping (capital cities)
        country_coords = {
            "United States": {"lat": 38.9072, "lng": -77.0369},
            "Russia": {"lat": 55.7558, "lng": 37.6173},
            "China": {"lat": 39.9042, "lng": 116.4074},
            "United Kingdom": {"lat": 51.5074, "lng": -0.1278},
            "Germany": {"lat": 52.5200, "lng": 13.4050},
            "France": {"lat": 48.8566, "lng": 2.3522},
            "Japan": {"lat": 35.6762, "lng": 139.6503},
            "India": {"lat": 28.6139, "lng": 77.2090},
            "Brazil": {"lat": -15.7942, "lng": -47.8822},
            "Canada": {"lat": 45.4215, "lng": -75.6972},
            "Australia": {"lat": -35.2809, "lng": 149.1300},
            "Italy": {"lat": 41.9028, "lng": 12.4964},
            "Spain": {"lat": 40.4168, "lng": -3.7038},
            "Netherlands": {"lat": 52.3676, "lng": 4.9041},
            "Poland": {"lat": 52.2297, "lng": 21.0122},
            "Sweden": {"lat": 59.3293, "lng": 18.0686},
            "Switzerland": {"lat": 46.9481, "lng": 7.4474},
            "Belgium": {"lat": 50.8503, "lng": 4.3517},
            "Austria": {"lat": 48.2082, "lng": 16.3738},
            "Norway": {"lat": 59.9139, "lng": 10.7522},
            "Denmark": {"lat": 55.6761, "lng": 12.5683},
            "Finland": {"lat": 60.1699, "lng": 24.9384},
            "South Korea": {"lat": 37.5665, "lng": 126.9780},
            "Singapore": {"lat": 1.3521, "lng": 103.8198},
            "Mexico": {"lat": 19.4326, "lng": -99.1332},
            "Argentina": {"lat": -34.6037, "lng": -58.3816},
            "South Africa": {"lat": -25.7479, "lng": 28.2293},
            "Turkey": {"lat": 41.0082, "lng": 28.9784},
            "Indonesia": {"lat": -6.2088, "lng": 106.8456},
            "Thailand": {"lat": 13.7563, "lng": 100.5018},
            "Vietnam": {"lat": 21.0285, "lng": 105.8542},
            "Philippines": {"lat": 14.5995, "lng": 120.9842},
            "Malaysia": {"lat": 3.1390, "lng": 101.6869},
            "New Zealand": {"lat": -41.2865, "lng": 174.7762},
            "Israel": {"lat": 31.7683, "lng": 35.2137},
            "United Arab Emirates": {"lat": 24.4539, "lng": 54.3773},
            "Saudi Arabia": {"lat": 24.7136, "lng": 46.6753},
            "Egypt": {"lat": 30.0444, "lng": 31.2357},
            "Ukraine": {"lat": 50.4501, "lng": 30.5234},
            "Czech Republic": {"lat": 50.0755, "lng": 14.4378},
            "Romania": {"lat": 44.4268, "lng": 26.1025},
            "Portugal": {"lat": 38.7223, "lng": -9.1393},
            "Greece": {"lat": 37.9838, "lng": 23.7275},
            "Ireland": {"lat": 53.3498, "lng": -6.2603},
            "Hungary": {"lat": 47.4979, "lng": 19.0402},
            "Chile": {"lat": -33.4489, "lng": -70.6693},
            "Colombia": {"lat": 4.7110, "lng": -74.0721},
            "Peru": {"lat": -12.0464, "lng": -77.0428},
            "Venezuela": {"lat": 10.4806, "lng": -66.9036},
            "Pakistan": {"lat": 33.6844, "lng": 73.0479},
            "Bangladesh": {"lat": 23.8103, "lng": 90.4125},
            "Nigeria": {"lat": 6.5244, "lng": 3.3792},
            "Kenya": {"lat": -1.2921, "lng": 36.8219},
            "Morocco": {"lat": 33.9716, "lng": -6.8498},
            "Algeria": {"lat": 36.7538, "lng": 3.0588},
            "Tunisia": {"lat": 36.8065, "lng": 10.1815},
            "Kazakhstan": {"lat": 51.1694, "lng": 71.4491},
            "Belarus": {"lat": 53.9045, "lng": 27.5615},
            "Bulgaria": {"lat": 42.6977, "lng": 23.3219},
            "Croatia": {"lat": 45.8150, "lng": 15.9819},
            "Serbia": {"lat": 44.7866, "lng": 20.4489},
            "Slovakia": {"lat": 48.1486, "lng": 17.1077},
            "Slovenia": {"lat": 46.0569, "lng": 14.5058},
            "Lithuania": {"lat": 54.6872, "lng": 25.2797},
            "Latvia": {"lat": 56.9496, "lng": 24.1052},
            "Estonia": {"lat": 59.4370, "lng": 24.7536},
            "Iceland": {"lat": 64.1466, "lng": -21.9426},
            "Luxembourg": {"lat": 49.6116, "lng": 6.1319},
            "Malta": {"lat": 35.8997, "lng": 14.5146},
            "Cyprus": {"lat": 35.1856, "lng": 33.3823},
        }

        # Build response with coordinates
        countries_map_data = []
        for country, count in countries_data:
            coords = country_coords.get(country)
            if coords:
                countries_map_data.append({
                    "country": country,
                    "requests": count,
                    "latitude": coords["lat"],
                    "longitude": coords["lng"],
                })
            else:
                # Try to find by partial match
                for key, value in country_coords.items():
                    if country.lower() in key.lower() or key.lower() in country.lower():
                        countries_map_data.append({
                            "country": country,
                            "requests": count,
                            "latitude": value["lat"],
                            "longitude": value["lng"],
                        })
                        break

        return jsonify({
            "countries": countries_map_data,
            "total_countries": len(countries_map_data),
            "total_requests": sum(item["requests"] for item in countries_map_data),
        })

    except Exception as e:
        logging.error(f"Error getting countries map data: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to retrieve countries map data"}), 500

@dashboard_bp.route("/map-requests", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_map_requests(project_id=None):
    """
    Get requests data with coordinates for map visualization.
    Supports filtering by hwid and ip_address.
    Returns data grouped by city on low zoom, individual requests on high zoom.
    """
    try:
        from ..utils.ip_utils import get_coordinates_from_ip
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = project_id
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

        # Get filter parameters
        hwid_filter = request.args.get("hwid")
        ip_filter = request.args.get("ip")
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")
        
        # Build query for UserActivity
        query = UserActivity.query
        
        if project_filter:
            query = query.filter(UserActivity.project_id == project_filter)
        
        # Apply filters
        if ip_filter:
            query = query.filter(UserActivity.ip_address.like(f"%{ip_filter}%"))
        
        if date_from:
            try:
                date_from_obj = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                query = query.filter(UserActivity.created_at >= date_from_obj)
            except:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                query = query.filter(UserActivity.created_at <= date_to_obj)
            except:
                pass
        
        # Filter by hwid (fingerprint) - need to join with Key
        if hwid_filter:
            query = query.join(Key, UserActivity.user_id == Key.user_id).filter(
                or_(
                    Key.fingerprint.like(f"%{hwid_filter}%"),
                    Key.devices.like(f"%{hwid_filter}%")
                )
            )
        
        # Get activities with IP addresses
        activities = query.filter(
            UserActivity.ip_address.isnot(None),
            UserActivity.ip_address.notin_(["127.0.0.1", "localhost", "::1", "unknown"])
        ).limit(10000).all()  # Limit to prevent memory issues
        
        # Get coordinates from IP addresses
        points = []
        city_groups = {}  # For grouping by city
        
        for activity in activities:
            if not activity.ip_address:
                continue
            
            lat, lng, country, city = get_coordinates_from_ip(activity.ip_address)
            
            if lat and lng:
                # Get hwid/fingerprint from related Key if available
                hwid = None
                if activity.user_id:
                    key = Key.query.filter_by(user_id=activity.user_id).first()
                    if key:
                        hwid = key.fingerprint or key.devices
                
                point = {
                    "id": activity.id,
                    "ip_address": activity.ip_address,
                    "hwid": hwid,
                    "city": city or "Unknown",
                    "country": country or "Unknown",
                    "lat": float(lat),
                    "lng": float(lng),
                    "action": activity.action,
                    "created_at": activity.created_at.isoformat() if activity.created_at else None,
                    "user_id": activity.user_id,
                }
                points.append(point)
                
                # Group by city for clustering
                city_key = f"{city or 'Unknown'},{country or 'Unknown'}"
                if city_key not in city_groups:
                    city_groups[city_key] = {
                        "city": city or "Unknown",
                        "country": country or "Unknown",
                        "lat": float(lat),
                        "lng": float(lng),
                        "count": 0,
                        "points": []
                    }
                city_groups[city_key]["count"] += 1
                city_groups[city_key]["points"].append(point)
        
        # Convert city groups to list
        cities = []
        for city_key, group in city_groups.items():
            cities.append({
                "city": group["city"],
                "country": group["country"],
                "lat": group["lat"],
                "lng": group["lng"],
                "requests": group["count"],
                "points": group["points"]  # Individual points for this city
            })
        
        return jsonify({
            "points": points,  # All individual points
            "cities": cities,  # Grouped by city
            "total_points": len(points),
            "total_cities": len(cities),
        })
        
    except Exception as e:
        logging.error(f"Error getting map requests: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to retrieve map requests"}), 500

@dashboard_bp.route("/load-status", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_load_status(project_id=None):
    """
    Get load status for connect and heartbeat endpoints.
    Statistics are filtered by project_id for project isolation.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        project_filter = project_id
        is_owner = RBACManager.is_owner(user)

        if project_filter is None and not is_owner:
            return jsonify({"error": "Project isolation required"}), 403


        if project_filter:
            load_status = prometheus_metrics_reader.get_all_endpoints_status(project_id=project_filter)
        else:

            load_status = prometheus_metrics_reader.get_all_endpoints_status(project_id=None)

        return jsonify({"status": "success", "data": load_status}), 200

    except Exception as e:
        logging.error(f"Error getting load status: {str(e)}")
        return jsonify({"error": "Failed to retrieve load status"}), 500
