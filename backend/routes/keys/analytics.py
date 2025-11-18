"""
Analytics Routes for Keys
Handles analytics, usage statistics, and reporting for keys
"""

import csv
import json
from datetime import datetime, timedelta
from io import StringIO

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import case, func

from ...core.extensions import db
from ...middleware.auth import require_project_isolation
from ...models import Game, Key, User
from ...utils.rbac_utils import RBACManager

analytics_bp = Blueprint("keys_analytics", __name__)

@analytics_bp.route("/usage", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_keys_usage():
    """Get key usage statistics"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    query = Key.query.filter_by(project_id=user.project_id)

    if not RBACManager.is_owner(user) and not RBACManager.is_admin(user):
        from ...services.rbac import rbac_service

        has_keys_view = rbac_service.check_permission(user.id, "keys.view")
        if not has_keys_view:
            query = query.filter_by(user_id=user.id)

    total_keys = query.count()
    active_keys = query.filter(Key.status == 1).count()
    expired_keys = query.filter(Key.expires_at <= datetime.utcnow()).count()
    inactive_keys = query.filter(Key.status == 0).count()

    now = datetime.utcnow()
    one_year_ago = now - timedelta(days=365)

    monthly_stats = (
        db.session.query(
            func.date_trunc("month", Key.created_at).label("month"),
            func.count(Key.id).label("count"),
        )
        .filter(Key.created_at >= one_year_ago, Key.project_id == user.project_id)
        .group_by(func.date_trunc("month", Key.created_at))
        .order_by(func.date_trunc("month", Key.created_at))
        .all()
    )

    monthly_stats = [
        {"month": stat.month.strftime("%Y-%m"), "count": stat.count} for stat in monthly_stats
    ]

    monthly_stats.reverse()

    game_stats = (
        db.session.query(Game.name, func.count(Key.id).label("count"))
        .join(Key, Game.id == Key.game_id)
        .filter(Game.project_id == user.project_id)
        .group_by(Game.id, Game.name)
        .all()
    )

    return jsonify(
        {
            "total_keys": total_keys,
            "active_keys": active_keys,
            "expired_keys": expired_keys,
            "inactive_keys": inactive_keys,
            "monthly_stats": monthly_stats,
            "keys_by_game": [{"game": game, "count": count} for game, count in game_stats],
        }
    )

@analytics_bp.route("/analytics", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_keys_analytics():
    """Get detailed analytics for keys"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    query = Key.query.filter_by(project_id=user.project_id)

    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    daily_stats = (
        db.session.query(func.date(Key.created_at).label("date"), func.count(Key.id).label("count"))
        .filter(Key.created_at >= thirty_days_ago, Key.project_id == user.project_id)
        .group_by(func.date(Key.created_at))
        .order_by(func.date(Key.created_at))
        .all()
    )

    game_analytics = (
        db.session.query(
            Game.name,
            func.count(Key.id).label("total_keys"),
            func.avg(Key.max_devices).label("avg_devices"),
            func.avg(Key.duration_hours).label("avg_duration"),
        )
        .join(Key, Game.id == Key.game_id)
        .filter(Game.project_id == user.project_id)
        .group_by(Game.id, Game.name)
        .all()
    )

    activation_stats = (
        db.session.query(
            func.count(Key.id).label("total"),
            func.count(case((Key.activated_at.isnot(None), 1), else_=None)).label(
                "activated_count"
            ),
        )
        .filter(Key.project_id == user.project_id)
        .first()
    )

    key_type_stats = {}
    keys_with_metadata = query.filter(Key.key_metadata.isnot(None)).all()

    for key in keys_with_metadata:
        try:
            metadata = json.loads(key.key_metadata)
            key_type = metadata.get("type", "production")
            key_type_stats[key_type] = key_type_stats.get(key_type, 0) + 1
        except:
            key_type_stats["production"] = key_type_stats.get("production", 0) + 1

    return jsonify(
        {
            "daily_creation": [
                {"date": stat.date.isoformat(), "count": stat.count} for stat in daily_stats
            ],
            "game_analytics": [
                {
                    "game_name": stat.name,
                    "total_keys": stat.total_keys,
                    "avg_devices": round(stat.avg_devices or 0, 2),
                    "avg_duration_hours": round(stat.avg_duration or 0, 2),
                }
                for stat in game_analytics
            ],
            "activation_rate": {
                "total": activation_stats.total,
                "activated": activation_stats.activated_count,
                "rate": round(
                    (
                        (activation_stats.activated_count / activation_stats.total * 100)
                        if activation_stats.total > 0
                        else 0
                    ),
                    2,
                ),
            },
            "key_type_stats": key_type_stats,
        }
    )

@analytics_bp.route("/<int:key_id>/analytics", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_key_analytics(key_id):
    """Get analytics for a specific key"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from datetime import date, timedelta

    from ...models import Key, KeyAnalytics

    key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()

    if not key:
        return jsonify({"error": "Key not found or access denied"}), 404

    try:
        thirty_days_ago = date.today() - timedelta(days=30)
        analytics = (
            KeyAnalytics.query.filter(
                KeyAnalytics.key_id == key_id, KeyAnalytics.date >= thirty_days_ago
            )
            .order_by(KeyAnalytics.date.desc())
            .all()
        )

        all_time_analytics = KeyAnalytics.query.filter(KeyAnalytics.key_id == key_id).all()

        analytics_data = []
        total_connections_all_time = 0
        total_unique_devices = 0
        all_games = set()

        for analytic in all_time_analytics:
            games_list = json.loads(analytic.games_played or "[]")
            all_games.update(games_list)
            total_connections_all_time += analytic.total_connections
            total_unique_devices = max(total_unique_devices, analytic.unique_devices)

        for analytic in analytics:
            games_list = json.loads(analytic.games_played or "[]")

            analytics_data.append(
                {
                    "date": analytic.date.isoformat(),
                    "total_connections": analytic.total_connections,
                    "unique_devices": analytic.unique_devices,
                    "total_connection_time": analytic.total_connection_time,
                    "peak_concurrent": analytic.peak_concurrent,
                    "games_played": games_list,
                    "created_at": analytic.created_at.isoformat() if analytic.created_at else None,
                    "updated_at": analytic.updated_at.isoformat() if analytic.updated_at else None,
                }
            )

        summary = {
            "total_connections_all_time": total_connections_all_time,
            "max_unique_devices_all_time": total_unique_devices,
            "games_played": list(all_games),
            "analytics_days_count": len(analytics_data),
            "first_analytics_date": analytics_data[-1]["date"] if analytics_data else None,
            "last_analytics_date": analytics_data[0]["date"] if analytics_data else None,
        }

        return jsonify({"key_id": key_id, "summary": summary, "daily_analytics": analytics_data})

    except Exception as e:
        return jsonify({"error": f"Failed to get key analytics: {str(e)}"}), 500

@analytics_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_keys_stats():
    """Get key statistics"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    from ...services.keys import key_service

    stats = key_service.get_key_stats(user)

    return jsonify(
        {
            "message": "Keys statistics retrieved successfully",
            "stats": {
                "total": stats["total_keys"],
                "active": stats["active_keys"],
                "expired": stats["expired_keys"],
                "inactive": stats["inactive_keys"],
                "keys_by_game": stats["keys_by_game"],
            },
        }
    )

@analytics_bp.route("/export", methods=["GET"])
@jwt_required()
@require_project_isolation
def export_keys():
    """Export keys to CSV"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    status = request.args.get("status")
    game_id = request.args.get("game_id", type=int)

    import csv
    from datetime import datetime
    from io import StringIO

    from flask import Response

    from ...models import Key
    from ...utils.rbac_utils import RBACManager

    query = Key.query.filter_by(project_id=user.project_id)

    if not RBACManager.is_owner(user) and not RBACManager.is_admin(user):
        from ...services.rbac import rbac_service

        has_keys_view = rbac_service.check_permission(user.id, "keys.view")
        if not has_keys_view:
            query = query.filter_by(user_id=user.id)

    if status:
        if status == "active":
            query = query.filter(Key.status == 1, Key.expires_at > datetime.utcnow())
        elif status == "expired":
            query = query.filter(Key.expires_at <= datetime.utcnow())
        elif status == "inactive":
            query = query.filter(Key.status == 0)
        else:
            query = query.filter_by(status=int(status))

    if game_id:
        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found or access denied"}), 404
        query = query.filter_by(game_id=game_id)

    def generate_csv():
        """Generator function to stream CSV data"""
        buffer = StringIO()
        writer = csv.writer(buffer)

        header = [
            "ID",
            "Key",
            "Game ID",
            "Game Name",
            "Status",
            "Created At",
            "Expires At",
            "Activated At",
            "Max Devices",
            "Devices",
            "Duration Hours",
            "Project ID",
            "Fingerprint",
        ]
        writer.writerow(header)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        batch_size = 1000
        offset = 0

        while True:
            keys_batch = query.order_by(Key.id).offset(offset).limit(batch_size).all()

            if not keys_batch:
                break

            game_ids = [key.game_id for key in keys_batch if key.game_id]
            games_dict = {}
            if game_ids:
                games = Game.query.filter(
                    Game.id.in_(game_ids), Game.project_id == user.project_id
                ).all()
                games_dict = {game.id: game.name for game in games}

            for key in keys_batch:
                key_game_name = games_dict.get(key.game_id, "") if key.game_id else ""

                writer.writerow(
                    [
                        key.id,
                        key.key,
                        key.game_id or "",
                        key_game_name,
                        key.status,
                        key.created_at.isoformat() if key.created_at else "",
                        key.expires_at.isoformat() if key.expires_at else "",
                        key.activated_at.isoformat() if key.activated_at else "",
                        key.max_devices,
                        key.devices or "",
                        key.duration_hours,
                        key.project_id or "",
                        key.fingerprint or "",
                    ]
                )

            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

            offset += batch_size

            if len(keys_batch) < batch_size:
                break

    return Response(
        generate_csv(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=keys_export.csv"},
    )
