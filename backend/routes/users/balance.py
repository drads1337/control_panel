"""
User Balance Routes
Handles balance management: topup, deduct
"""

import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ...models import User
from ...middleware.auth import require_project_isolation, require_role, require_user, require_any_permission
from ...middleware.validation import validate_request
from ...schemas.balance import BalanceTopupSchema, BalanceDeductSchema, BalanceTransactionsQuerySchema
from ...utils.role_constants import RolePermissions
from ...utils.service_helpers import get_service
from ...utils.idempotency import require_idempotency

logger = logging.getLogger(__name__)
balance_bp = Blueprint("users_balance", __name__)

@require_idempotency(ttl=3600, required=True)  # 1 hour TTL, required for financial operations
@balance_bp.route("/topup", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.BALANCE_MANAGEMENT_ROLES)
@require_project_isolation
@validate_request(BalanceTopupSchema)
def topup_user_balance(current_user, validated_data=None):
    """Top up user balance"""

    balance_service = get_service('balance_service')
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    data = BalanceTopupSchema(**validated_data)
    user_id = data.user_id
    amount = data.amount

    logger.info(f"Topup balance request: current_user_id={current_user.id}, target_user_id={user_id}, amount={amount}, project_id={current_user.project_id}")



    target_user = None
    

    try:
        numeric_id = int(user_id)
        target_user = User.query.filter_by(id=numeric_id, project_id=current_user.project_id).first()
        if not target_user:

            target_user = User.query.get(numeric_id)
    except (ValueError, TypeError):

        pass
    

    if not target_user:
        target_user = User.query.filter_by(unique_id=str(user_id), project_id=current_user.project_id).first()
        if not target_user:

            target_user = User.query.filter_by(unique_id=str(user_id)).first()
    
    if not target_user:
        logger.warning(f"User not found: user_id={user_id}, project_id={current_user.project_id}")
        return jsonify({"error": "User not found"}), 404
    

    if current_user.project_id and target_user.project_id != current_user.project_id:
        logger.warning(f"User not in same project: target_user.project_id={target_user.project_id}, current_user.project_id={current_user.project_id}")
        return jsonify({"error": "User not found in your project"}), 404
    

    user_id = target_user.id

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

@require_idempotency(ttl=3600, required=True)  # 1 hour TTL, required for financial operations
@balance_bp.route("/deduct", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.BALANCE_MANAGEMENT_ROLES)
@require_project_isolation
@validate_request(BalanceDeductSchema)
def deduct_user_balance(current_user, validated_data=None):
    """Deduct from user balance"""

    balance_service = get_service('balance_service')
    
    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    data = BalanceDeductSchema(**validated_data)
    user_id = data.user_id
    amount = data.amount
    reason = data.reason



    target_user = None
    

    try:
        numeric_id = int(user_id)
        target_user = User.query.filter_by(id=numeric_id, project_id=current_user.project_id).first()
        if not target_user:

            target_user = User.query.get(numeric_id)
    except (ValueError, TypeError):

        pass
    

    if not target_user:
        target_user = User.query.filter_by(unique_id=str(user_id), project_id=current_user.project_id).first()
        if not target_user:

            target_user = User.query.filter_by(unique_id=str(user_id)).first()
    
    if not target_user:
        logger.warning(f"User not found: user_id={user_id}, project_id={current_user.project_id}")
        return jsonify({"error": "User not found"}), 404
    

    if current_user.project_id and target_user.project_id != current_user.project_id:
        logger.warning(f"User not in same project: target_user.project_id={target_user.project_id}, current_user.project_id={current_user.project_id}")
        return jsonify({"error": "User not found in your project"}), 404
    

    user_id = target_user.id

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

@balance_bp.route("/transactions", methods=["GET"])
@jwt_required()
@require_user
@require_any_permission(['billing.view_balance', 'billing.top_up_balance', 'employees.edit', 'clients.edit'])
@require_project_isolation
@validate_request(BalanceTransactionsQuerySchema, data_type="query")
def get_user_transactions(current_user, validated_params=None):
    """Get transaction history for a user with pagination"""

    balance_service = get_service('balance_service')
    
    if not validated_params:

        user_id = request.args.get("user_id")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400
    else:
        data = BalanceTransactionsQuerySchema(**validated_params)
        user_id = data.user_id
        page = data.page
        per_page = data.per_page

    logger.info(f"Get transactions request: current_user_id={current_user.id}, target_user_id={user_id}, project_id={current_user.project_id}")



    target_user = None
    

    try:
        numeric_id = int(user_id)
        target_user = User.query.filter_by(id=numeric_id, project_id=current_user.project_id).first()
        if not target_user:

            target_user = User.query.get(numeric_id)
    except (ValueError, TypeError):

        pass
    

    if not target_user:
        target_user = User.query.filter_by(unique_id=str(user_id), project_id=current_user.project_id).first()
        if not target_user:

            target_user = User.query.filter_by(unique_id=str(user_id)).first()
    
    if not target_user:
        logger.warning(f"User not found: user_id={user_id}, project_id={current_user.project_id}")
        return jsonify({"error": "User not found"}), 404
    

    if current_user.project_id and target_user.project_id != current_user.project_id:
        logger.warning(f"User not in same project: target_user.project_id={target_user.project_id}, current_user.project_id={current_user.project_id}")
        return jsonify({"error": "User not found in your project"}), 404
    

    numeric_user_id = target_user.id

    has_access, error_msg = balance_service.check_balance_access(current_user, target_user)
    if not has_access:
        return jsonify({"error": error_msg or "Access denied"}), 403

    success, error_msg, result_data = balance_service.get_user_transactions(
        user_id=numeric_user_id,
        page=page,
        per_page=per_page
    )

    if not success:
        return jsonify({"error": error_msg}), 400

    return jsonify(result_data)
