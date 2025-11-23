"""
User Balance Routes
Handles balance management: topup, deduct
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ...models import User
from ...services.balance import balance_service
from ...middleware.auth import require_project_isolation, require_role, require_user
from ...utils.role_constants import RolePermissions

balance_bp = Blueprint("users_balance", __name__)

@balance_bp.route("/topup", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.BALANCE_MANAGEMENT_ROLES)
@require_project_isolation
def topup_user_balance(current_user):
    """Top up user balance"""

    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    user_id = data.get("user_id")
    amount = data.get("amount")

    if not user_id or amount is None:
        return jsonify({"error": "User ID and amount are required"}), 400

    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format"}), 400

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    has_access, error_msg = balance_service.check_balance_access(current_user, target_user)
    if not has_access:
        return jsonify({"error": error_msg or "Access denied"}), 403

    success, error_msg, result_data = balance_service.topup_balance(
        current_user=current_user,
        target_user_id=user_id,
        amount=amount,
        ip_address=getattr(request, "remote_addr", None),
    )

    if not success:
        return jsonify({"error": error_msg}), 400

    return jsonify({"message": f"Successfully topped up {amount} tokens", **result_data})

@balance_bp.route("/deduct", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.BALANCE_MANAGEMENT_ROLES)
@require_project_isolation
def deduct_user_balance(current_user):
    """Deduct from user balance"""

    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    user_id = data.get("user_id")
    amount = data.get("amount")
    reason = data.get("reason", "Balance deduction")

    if not user_id or amount is None:
        return jsonify({"error": "User ID and amount are required"}), 400

    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format"}), 400

    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    has_access, error_msg = balance_service.check_balance_access(current_user, target_user)
    if not has_access:
        return jsonify({"error": error_msg or "Access denied"}), 403

    success, error_msg, result_data = balance_service.deduct_balance(
        current_user=current_user,
        target_user_id=user_id,
        amount=amount,
        reason=reason,
        ip_address=getattr(request, "remote_addr", None),
    )

    if not success:
        return jsonify({"error": error_msg}), 400

    return jsonify({"message": f"Successfully deducted {amount} tokens", **result_data})
