"""
Game Prices Routes
Handles price management for games
"""

import json

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...models import Game, GameKeyPrice, User
from ...services.activity import activity_service
from ...services.games import game_service
from ...utils.rbac_utils import RBACManager

prices_bp = Blueprint("games_prices", __name__)

@prices_bp.route("/<int:game_id>/prices", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_game_prices(game_id):
    """Get prices for a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        prices = GameKeyPrice.query.filter_by(game_id=game_id, project_id=user.project_id).all()

        price_dict = {}
        for price in prices:
            if not price.period.startswith("custom_"):

                price_dict[price.period] = float(price.price) if price.price else 0.0

        return jsonify(
            {
                "success": True,
                "game_id": game_id,
                "prices": price_dict,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error fetching game prices: {str(e)}")
        return jsonify({"error": f"Failed to fetch prices: {str(e)}"}), 500

@prices_bp.route("/<int:game_id>/prices", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_game_prices(game_id):
    """Update prices for a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(
        user.id, user.project_id, "applications.manage_prices"
    )

    if not has_permission:
        return (
            jsonify(
                {
                    "error": "Permission denied. You do not have permission to manage game prices."
                }
            ),
            403,
        )

    try:

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        prices_data = data.get("prices", {})
        if not isinstance(prices_data, dict):
            return jsonify({"error": "Prices must be a dictionary"}), 400

        valid_periods = ["hour", "day", "week", "month"]

        for period, price_value in prices_data.items():
            if period not in valid_periods:
                continue

            try:
                price_int = int(float(price_value)) if price_value else 0
            except (ValueError, TypeError):
                current_app.logger.warning(f"Invalid price value for period {period}: {price_value}")
                continue

            existing_price = GameKeyPrice.query.filter_by(
                game_id=game_id, period=period, project_id=user.project_id
            ).first()

            if existing_price:
                existing_price.price = price_int
            else:
                new_price = GameKeyPrice(
                    game_id=game_id,
                    period=period,
                    price=price_int,
                    project_id=user.project_id,
                )
                db.session.add(new_price)

        db.session.commit()

        game_service.invalidate_game_cache(user.project_id, game_id)

        activity_service.log_activity(
            user,
            "game_prices_updated",
            details=f"Updated prices for game: {game_id}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Prices updated successfully",
                "game_id": game_id,
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating game prices: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update prices: {str(e)}"}), 500

@prices_bp.route("/<int:game_id>/custom-periods", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_custom_periods(game_id):
    """Get custom periods for a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        custom_prices = GameKeyPrice.query.filter_by(
            game_id=game_id, project_id=user.project_id
        ).filter(GameKeyPrice.period.like("custom_%")).all()

        custom_periods = []
        for price in custom_prices:
            custom_periods.append(
                {
                    "id": price.id,
                    "period": price.period,
                    "price": float(price.price) if price.price else 0.0,
                    "meta_data": json.loads(price.meta_data) if price.meta_data else None,
                }
            )

        return jsonify(
            {
                "success": True,
                "game_id": game_id,
                "custom_periods": custom_periods,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error fetching custom periods: {str(e)}")
        return jsonify({"error": f"Failed to fetch custom periods: {str(e)}"}), 500

@prices_bp.route("/<int:game_id>/custom-periods", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def add_custom_period(game_id):
    """Add custom period for a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(
        user.id, user.project_id, "applications.manage_prices"
    )

    if not has_permission:
        return (
            jsonify(
                {
                    "error": "Permission denied. You do not have permission to manage game prices."
                }
            ),
            403,
        )

    try:

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        period_name = data.get("period_name")
        price_value = data.get("price")
        meta_data = data.get("meta_data")

        if not period_name:
            return jsonify({"error": "period_name is required"}), 400

        if price_value is None:
            return jsonify({"error": "price is required"}), 400

        if not period_name.startswith("custom_"):
            period_name = f"custom_{period_name}"

        existing_price = GameKeyPrice.query.filter_by(
            game_id=game_id, period=period_name, project_id=user.project_id
        ).first()

        if existing_price:
            return jsonify({"error": "Custom period already exists"}), 400

        try:
            price_int = int(float(price_value))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid price value"}), 400

        new_price = GameKeyPrice(
            game_id=game_id,
            period=period_name,
            price=price_int,
            meta_data=json.dumps(meta_data) if meta_data else None,
            project_id=user.project_id,
        )

        db.session.add(new_price)
        db.session.commit()

        game_service.invalidate_game_cache(user.project_id, game_id)

        activity_service.log_activity(
            user,
            "game_custom_period_added",
            details=f"Added custom period {period_name} for game: {game_id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Custom period added successfully",
                    "custom_period": {
                        "id": new_price.id,
                        "period": new_price.period,
                        "price": float(new_price.price) / 100 if new_price.price else 0.0,
                        "meta_data": json.loads(new_price.meta_data) if new_price.meta_data else None,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding custom period: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to add custom period: {str(e)}"}), 500

@prices_bp.route("/<int:game_id>/custom-periods/<custom_period_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def remove_custom_period(game_id, custom_period_id):
    """Remove custom period for a game"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    has_permission = RBACManager.has_permission(
        user.id, user.project_id, "applications.manage_prices"
    )

    if not has_permission:
        return (
            jsonify(
                {
                    "error": "Permission denied. You do not have permission to manage game prices."
                }
            ),
            403,
        )

    try:

        game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
        if not game:
            return jsonify({"error": "Game not found"}), 404

        custom_price = GameKeyPrice.query.filter_by(
            id=custom_period_id, game_id=game_id, project_id=user.project_id
        ).first()

        if not custom_price:
            return jsonify({"error": "Custom period not found"}), 404

        if not custom_price.period.startswith("custom_"):
            return jsonify({"error": "Not a custom period"}), 400

        period_name = custom_price.period

        db.session.delete(custom_price)
        db.session.commit()

        game_service.invalidate_game_cache(user.project_id, game_id)

        activity_service.log_activity(
            user,
            "game_custom_period_removed",
            details=f"Removed custom period {period_name} for game: {game_id}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "success": True,
                "message": "Custom period removed successfully",
            }
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error removing custom period: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to remove custom period: {str(e)}"}), 500
