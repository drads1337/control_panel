"""
User Clients Routes
Handles client management under /api/users/clients endpoint
"""

import logging
from datetime import datetime

from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func, select

from ...core.extensions import db
from ...middleware.auth import (
    enforce_project_scope,
    require_permission,
    require_project_with_grace_period,
    require_user,
)
from ...models.core import User
from ...models.keys import Key
from ...models.rbac import Role, UserRole
from ...utils.fulltext_search import fulltext_search_filter

clients_user_bp = Blueprint("users_clients", __name__)
logger = logging.getLogger(__name__)

@clients_user_bp.route("/clients", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_permission("clients.view")
def get_clients(current_user=None, project_id=None):
    """Get clients with optimized queries (fixes N+1 problem)"""
    try:

        if current_user is None:
            current_user = g.current_user

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        search = request.args.get("search")
        status_filter = request.args.get("status")

        query = User.query.filter(
            User.id.in_(select(UserRole.user_id).join(Role).where(Role.name == "client"))
        )

        if current_user.project_id:
            query = query.filter(User.project_id == current_user.project_id)
        else:
            return jsonify({"error": "User must be assigned to a project"}), 403

        if search:

            query = fulltext_search_filter(query, search, "search_vector")

        if status_filter == "active":
            query = query.filter((User.expires_at.is_(None)) | (User.expires_at > datetime.utcnow()))
        elif status_filter == "expired":
            query = query.filter(User.expires_at <= datetime.utcnow())

        query = query.order_by(User.created_at.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        clients = []
        for user in pagination.items:
            keys_count = user.total_keys or 0
            active_keys = user.active_keys or 0

            status = "active"
            if user.expires_at and user.expires_at <= datetime.utcnow():
                status = "expired"

            clients.append(
                {
                    "id": user.id,
                    "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
                    "username": user.username,
                    "email": user.email,
                    "phone": None,
                    "status": status,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "last_activity": user.last_login.isoformat() if user.last_login else None,
                    "total_orders": keys_count,
                    "total_spent": user.token_balance or 0,
                    "project": current_user.project.name if current_user.project else "Unknown",
                    "keys_count": keys_count,
                    "active_keys": active_keys,
                    "last_ip": user.last_ip,
                    "last_country": user.last_country,
                    "last_city": user.last_city,
                }
            )

        return jsonify(
            {
                "clients": clients,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )
    except Exception as e:
        logger.error(f"Error getting clients: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to get clients"}), 500
