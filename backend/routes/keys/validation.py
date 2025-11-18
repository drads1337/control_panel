"""
Key Validation Routes
Handles key validation and testing operations
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...middleware.validation import validate_request
from ...models import Game, Key, Project, User
from ...schemas.key import KeyValidateSchema
from ...services.keys import key_validator

validation_bp = Blueprint("keys_validation", __name__)

@validation_bp.route("/validate", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
@validate_request(KeyValidateSchema)
def validate_key(current_user=None, project_id=None, validated_data=None):
    """Validate a key"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    if not current_user:
        return jsonify({"error": "User not found"}), 404

    if not current_user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    data = validated_data or request.get_json()
    key_value = data.get("key")
    device_id = data.get("device_id")
    game_id = data.get("game_id")

    key = Key.query.filter_by(key=key_value, project_id=current_user.project_id).first()
    if not key:
        return jsonify({"error": "Invalid key"}), 404

    is_valid, error_msg = key_validator.validate_key_status(key)
    if not is_valid:
        return jsonify({"error": error_msg}), 403

    is_valid, error_msg, project = key_validator.validate_project_status(key.project_id)
    if not is_valid:

        if project:
            return (
                jsonify(
                    {
                        "error": "Project Inactive",
                        "message": error_msg,
                        "project_name": project.name,
                        "project_status": project.status,
                        "subscription_status": getattr(
                            project, "subscription_status_display", None
                        ),
                        "contact_owner": "Please contact the project owner for assistance.",
                    }
                ),
                403,
            )
        return jsonify({"error": error_msg}), 403

    if game_id:
        if key.game_id and key.game_id != game_id:
            return jsonify({"error": "Key is not valid for this game"}), 403

        game = Game.query.filter_by(id=game_id, project_id=current_user.project_id).first()
        if game:

            is_valid, error_msg, game_obj = key_validator.validate_game_access(
                key, game.name, key.project_id
            )
            if not is_valid:
                if game_obj and game_obj.status in ["inactive", "maintenance"]:
                    return (
                        jsonify(
                            {
                                "error": (
                                    "Game Inactive"
                                    if game_obj.status == "inactive"
                                    else "Game Maintenance"
                                ),
                                "message": error_msg,
                                "game_name": game_obj.name,
                                "game_status": game_obj.status,
                            }
                        ),
                        403,
                    )
                return jsonify({"error": error_msg}), 403

    devices = key.devices.split(",") if key.devices else []
    if device_id:
        is_valid, error_msg = key_validator.validate_device_limit(key, device_id)
        if not is_valid:
            return jsonify({"error": error_msg}), 403
        devices = key.devices.split(",") if key.devices else []

    return jsonify(
        {
            "valid": True,
            "key_id": key.id,
            "expires_at": key.expires_at.isoformat() if key.expires_at else None,
            "max_devices": key.max_devices,
            "current_devices": len(devices),
            "project_id": key.project_id,
        }
    )
