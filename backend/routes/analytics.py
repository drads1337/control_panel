"""
Analytics Routes
Provides comprehensive analytics and insights for administrators
"""

import logging
import time
from datetime import date, datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_cors import cross_origin
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..middleware.auth import (
    enforce_project_scope,
    require_project_isolation,
    require_project_with_grace_period,
)
from ..models.core import Project, User, UserActivity
from ..models.games import Game
from ..models.keys import DeviceInfo, Key, KeyAnalytics
from ..services.analytics import analytics_service
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import UserRoles

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/dashboard/overview", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_dashboard_overview():
    """
    Get comprehensive dashboard overview with analytics
    """
    try:
        from flask import g

        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check if user has permission to view analytics
        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = getattr(g, "project_id", None)
        period_days = request.args.get("period_days", 30, type=int)

        # Validate period
        period_days = min(max(period_days, 1), 365)

        # Get analytics data
        analytics_data = analytics_service.get_dashboard_overview(
            project_id=project_id, period_days=period_days
        )

        if not analytics_data:
            return jsonify({"error": "Failed to generate analytics"}), 500

        return jsonify({"status": "success", "data": analytics_data})

    except Exception as e:
        logging.error(
            f"ANALYTICS_DASHBOARD_OVERVIEW_ERROR user_id={user_id} error={e}", exc_info=True
        )
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@analytics_bp.route("/owner/dashboard/overview", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_owner_dashboard_overview():
    """
    Get comprehensive system-wide dashboard overview for owner users
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check if user is owner
        user_roles = RBACManager.get_user_role_names(user)
        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            return jsonify({"error": "Access denied. Owner role required"}), 403

        # Get query parameters
        period_days = request.args.get("period_days", 30, type=int)

        # Validate period
        period_days = min(max(period_days, 1), 365)

        # Get system-wide analytics data (no project scope)
        analytics_data = analytics_service.get_system_overview(period_days=period_days)

        if not analytics_data:
            return jsonify({"error": "Failed to generate system analytics"}), 500

        return jsonify({"status": "success", "data": analytics_data})

    except Exception as e:
        logging.error(f"OWNER_ANALYTICS_DASHBOARD_OVERVIEW_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


# CORS is handled globally by Flask-CORS configuration


@analytics_bp.route("/sales/trends", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_sales_trends():
    """
    Get sales trends and analytics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = request.args.get("project_id", type=int)
        period_days = request.args.get("period_days", 30, type=int)
        granularity = request.args.get("granularity", "daily")  # daily, weekly, monthly

        # Validate parameters
        period_days = min(max(period_days, 1), 365)
        if granularity not in ["daily", "weekly", "monthly"]:
            granularity = "daily"

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Get sales analytics
        start_date = datetime.utcnow() - timedelta(days=period_days)
        sales_data = analytics_service._get_sales_analytics(project_id, start_date)

        # Filter by granularity
        if granularity == "daily":
            trends_data = sales_data.get("daily_sales", [])
        elif granularity == "weekly":
            trends_data = sales_data.get("weekly_sales", [])
        else:  # monthly
            trends_data = _aggregate_monthly_sales(sales_data.get("daily_sales", []))

        return jsonify(
            {
                "status": "success",
                "data": {
                    "trends": trends_data,
                    "top_games": sales_data.get("top_games", []),
                    "total_sales": sales_data.get("total_period_sales", 0),
                    "total_revenue": sales_data.get("total_period_revenue", 0),
                    "granularity": granularity,
                    "period_days": period_days,
                },
            }
        )

    except Exception as e:
        logging.error(f"ANALYTICS_SALES_TRENDS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


@analytics_bp.route("/users/insights", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_user_insights():
    """
    Get user insights and analytics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = request.args.get("project_id", type=int)
        period_days = request.args.get("period_days", 30, type=int)

        # Validate parameters
        period_days = min(max(period_days, 1), 365)

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Get user analytics
        start_date = datetime.utcnow() - timedelta(days=period_days)
        user_data = analytics_service._get_user_analytics(project_id, start_date)

        return jsonify({"status": "success", "data": user_data})

    except Exception as e:
        logging.error(f"ANALYTICS_USER_INSIGHTS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


@analytics_bp.route("/geography/activations", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_geography_activations():
    """
    Get activation geography analytics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = request.args.get("project_id", type=int)
        period_days = request.args.get("period_days", 30, type=int)

        # Validate parameters
        period_days = min(max(period_days, 1), 365)

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Get geography analytics
        start_date = datetime.utcnow() - timedelta(days=period_days)
        geography_data = analytics_service._get_geography_analytics(project_id, start_date)

        return jsonify({"status": "success", "data": geography_data})

    except Exception as e:
        logging.error(f"ANALYTICS_GEOGRAPHY_ACTIVATIONS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


@analytics_bp.route("/products/popular", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_popular_products():
    """
    Get popular products analytics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = request.args.get("project_id", type=int)
        period_days = request.args.get("period_days", 30, type=int)
        limit = request.args.get("limit", 10, type=int)

        # Validate parameters
        period_days = min(max(period_days, 1), 365)
        limit = min(max(limit, 1), 50)

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Get popular products analytics
        start_date = datetime.utcnow() - timedelta(days=period_days)
        products_data = analytics_service._get_popular_products(project_id, start_date)

        # Limit results
        if "popular_games" in products_data:
            products_data["popular_games"] = products_data["popular_games"][:limit]
        if "active_users" in products_data:
            products_data["active_users"] = products_data["active_users"][:limit]

        return jsonify({"status": "success", "data": products_data})

    except Exception as e:
        logging.error(f"ANALYTICS_POPULAR_PRODUCTS_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


@analytics_bp.route("/security/overview", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_security_overview():
    """
    Get security overview and analytics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = request.args.get("project_id", type=int)
        period_days = request.args.get("period_days", 30, type=int)

        # Validate parameters
        period_days = min(max(period_days, 1), 365)

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Get security analytics
        start_date = datetime.utcnow() - timedelta(days=period_days)
        security_data = analytics_service._get_security_analytics(project_id, start_date)

        return jsonify({"status": "success", "data": security_data})

    except Exception as e:
        logging.error(f"ANALYTICS_SECURITY_OVERVIEW_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


@analytics_bp.route("/system/health", methods=["GET"])
@jwt_required()
def get_system_health():
    """
    Get system health metrics
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get query parameters
        project_id = request.args.get("project_id", type=int)

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Get system health
        health_data = analytics_service._get_system_health(project_id)

        return jsonify({"status": "success", "data": health_data})

    except Exception as e:
        logging.error(f"ANALYTICS_SYSTEM_HEALTH_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


@analytics_bp.route("/reports/generate", methods=["POST"])
@jwt_required()
@require_project_isolation
def generate_analytics_report():
    """
    Generate comprehensive analytics report
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Ensure user has project_id
        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(user.id, "analytics.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request data required"}), 400

        project_id = data.get("project_id")
        period_days = data.get("period_days", 30)
        report_type = data.get(
            "report_type", "comprehensive"
        )  # comprehensive, sales, users, security

        # Validate parameters
        period_days = min(max(period_days, 1), 365)
        if report_type not in ["comprehensive", "sales", "users", "security"]:
            report_type = "comprehensive"

        # If user is not owner, limit to their project
        user_roles = RBACManager.get_user_role_names(user)
        if (
            (not user_roles or user_roles[0] != "owner")
            and project_id
            and project_id != user.project_id
        ):
            return jsonify({"error": "Access denied to this project"}), 403

        if not user_roles or user_roles[0] != UserRoles.OWNER.value:
            project_id = user.project_id

        # Generate report based on type
        if report_type == "comprehensive":
            report_data = analytics_service.get_dashboard_overview(project_id, period_days)
        elif report_type == "sales":
            start_date = datetime.utcnow() - timedelta(days=period_days)
            report_data = {
                "sales_analytics": analytics_service._get_sales_analytics(project_id, start_date),
                "popular_products": analytics_service._get_popular_products(project_id, start_date),
            }
        elif report_type == "users":
            start_date = datetime.utcnow() - timedelta(days=period_days)
            report_data = {
                "user_analytics": analytics_service._get_user_analytics(project_id, start_date),
                "geography_analytics": analytics_service._get_geography_analytics(
                    project_id, start_date
                ),
            }
        elif report_type == "security":
            start_date = datetime.utcnow() - timedelta(days=period_days)
            report_data = {
                "security_analytics": analytics_service._get_security_analytics(
                    project_id, start_date
                ),
                "system_health": analytics_service._get_system_health(project_id),
            }

        return jsonify(
            {
                "status": "success",
                "data": {
                    "report_type": report_type,
                    "period_days": period_days,
                    "project_id": project_id,
                    "generated_at": datetime.utcnow().isoformat(),
                    "generated_by": user.username,
                    "report_data": report_data,
                },
            }
        )

    except Exception as e:
        logging.error(f"ANALYTICS_REPORT_GENERATION_ERROR user_id={user_id} error={e}")
        return jsonify({"error": "Internal server error"}), 500


def _aggregate_monthly_sales(daily_sales):
    """Aggregate daily sales data into monthly data"""
    monthly_data = {}

    for day in daily_sales:
        date_obj = datetime.fromisoformat(day["date"])
        month_key = f"{date_obj.year}-{date_obj.month:02d}"

        if month_key not in monthly_data:
            monthly_data[month_key] = {"month": month_key, "count": 0, "revenue": 0}

        monthly_data[month_key]["count"] += day["count"]
        monthly_data[month_key]["revenue"] += day["revenue"]

    return list(monthly_data.values())
