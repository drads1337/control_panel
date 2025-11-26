"""
Admin User Management Routes
Handles administrative user operations, bulk actions, and user management
"""

import csv
import logging
import secrets
import string
from datetime import datetime, timedelta
from io import StringIO

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import and_, case, func, select

from ...core.extensions import db
from ...middleware.auth import enforce_project_scope
from ...models import (
    DeveloperProductPermission,
    Key,
    ProjectUserRole,
    ReferralCode,
    TokenTransaction,
    User,
    UserActivity,
    UserProductPermission,
    UserRole,
)
from ...models.rbac import UserPermission
from ...services.activity import activity_service
from ...services.rbac import rbac_service
from ...utils.service_helpers import get_service
from ...middleware.auth import require_role, require_user
from ...utils.rbac_utils import RBACManager
from ...middleware.validation import validate_request
from ...schemas.user import UserCreateSchema
from ...utils.role_constants import RolePermissions
from ...utils.user_creation_helper import create_user_with_roles_and_products

admin_users_bp = Blueprint("admin_users", __name__)

@admin_users_bp.route("", methods=["GET"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def get_users(current_user, project_id=None):
    """Get users with optimized key counts (fixes N+1 problem)"""

    # project_id should be passed via kwargs from middleware
    if project_id is None:
        project_id = request.args.get("project_id", type=int)

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    role_filter = request.args.get("role")
    roles_filter = request.args.getlist("roles")
    search = request.args.get("search")

    user_crud_service = get_service('user_crud_service')
    result = user_crud_service.get_users_with_key_counts(
        current_user=current_user,
        page=page,
        per_page=per_page,
        role_filter=role_filter,
        roles_filter=roles_filter,
        search=search,
        project_id=project_id,
    )

    if isinstance(result, tuple) and len(result) == 2:
        return jsonify(result[0]), result[1]

    return jsonify(result)

@admin_users_bp.route("/add", methods=["POST"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.USER_CREATION_ROLES)
@validate_request(UserCreateSchema)
def add_user(current_user, validated_data=None, project_id=None):
    """Create a new user with roles and product permissions"""
    import logging

    logger = logging.getLogger(__name__)

    data = validated_data if validated_data is not None else request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        # Use DI helper function instead of facade
        user, error = create_user_with_roles_and_products(current_user, data, project_id=project_id)

        if error:
            return jsonify({"error": error}), 400

        try:
            activity_service.log_activity(
                current_user,
                "add_user",
                details=f"Created user: {user.username} (token_balance: {user.token_balance})",
                ip=request.remote_addr,
            )
        except Exception as log_error:
            logger.warning(f"Failed to log activity for user creation: {log_error}")

        return (
            jsonify(
                {
                    "message": "User created successfully",
                    "user": {
                        "id": user.unique_id,
                        "username": user.username,
                        "token_balance": user.token_balance,
                        "created_at": user.created_at.isoformat(),
                    },
                }
            ),
            201,
        )
    except Exception as e:
        logger.error(f"Error in add_user endpoint: {str(e)}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500

@admin_users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def delete_user(user_id, current_user, project_id=None):
    """Delete a user safely"""
    user_crud_service = get_service('user_crud_service')
    success, error = user_crud_service.delete_user_safely(current_user, user_id, project_id=project_id)

    if not success:
        return jsonify({"error": error}), 400 if "not found" in error.lower() else 403

    activity_service.log_activity(
        current_user, "delete_user", details=f"Deleted user ID: {user_id}", ip=request.remote_addr
    )

    return jsonify({"message": "User deleted successfully"})

@admin_users_bp.route("/bulk", methods=["POST"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.USER_CREATION_ROLES)
def bulk_action(current_user, project_id=None):
    """Perform bulk actions on users"""

    data = request.get_json()

    action = data.get("action")
    user_ids = data.get("user_ids", [])

    if not action or not user_ids:
        return jsonify({"error": "Action and user_ids are required"}), 400

    query = User.query.filter(User.id.in_(user_ids))

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        query = query.filter_by(project_id=current_user.project_id)
    else:

        # project_id should be passed via kwargs from middleware
        if project_id:
            query = query.filter_by(project_id=project_id)

    users = query.all()

    if action == "delete":
        try:
            for user in users:

                from ...utils.rbac_utils import RBACManager

                if RBACManager.is_admin(user) or RBACManager.is_owner(user):
                    continue

                user.total_keys = 0
                user.active_keys = 0
                Key.query.filter_by(user_id=user.id).delete()
                UserProductPermission.query.filter_by(user_id=user.id).delete()
                DeveloperProductPermission.query.filter_by(user_id=user.id).delete()
                UserActivity.query.filter_by(user_id=user.id).delete()

                UserRole.query.filter_by(user_id=user.id).delete()
                UserPermission.query.filter_by(user_id=user.id).delete()

                ProjectUserRole.query.filter_by(user_id=user.id).delete()

                db.session.delete(user)

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_delete_users",
                details=f"Deleted {len(users)} users",
                ip=request.remote_addr,
            )

            return jsonify({"message": f"Deleted {len(users)} users"})

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to delete users: {str(e)}"}), 500

    elif action == "change_role":
        new_role = data.get("new_role")
        if not new_role:
            return jsonify({"error": "new_role is required"}), 400

        if new_role not in RolePermissions.ASSIGNABLE_ROLES:
            return (
                jsonify(
                    {
                        "error": f'Invalid role. Allowed: {", ".join(RolePermissions.ASSIGNABLE_ROLES)}'
                    }
                ),
                400,
            )

        try:

            db.session.commit()

            activity_service.log_activity(
                current_user,
                "bulk_change_role",
                details=f"Changed role to {new_role} for {len(users)} users",
                ip=request.remote_addr,
            )

            return jsonify({"message": f"Changed role for {len(users)} users"})

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to change roles: {str(e)}"}), 500

    else:
        return jsonify({"error": "Invalid action"}), 400

@admin_users_bp.route("/export", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@enforce_project_scope
def export_users(current_user, project_id=None):
    """Export users to CSV with streaming to avoid memory issues"""
    from flask import Response

    role_filter = request.args.get("role")
    if project_id is None:
        project_id = request.args.get("project_id", type=int)

    query = User.query

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        query = query.filter_by(project_id=current_user.project_id)
    elif project_id:
        query = query.filter_by(project_id=project_id)

    if role_filter:
        query = query.filter_by(role=role_filter)

    def generate_csv():
        """Generator function to stream CSV data"""

        buffer = StringIO()
        writer = csv.writer(buffer)

        header = [
            "ID",
            "Username",
            "Role",
            "First Name",
            "Last Name",
            "Email",
            "Created At",
            "Expires At",
            "Last Login",
            "Last IP",
            "Last Country",
            "Last City",
            "Total Keys Generated",
            "Token Balance",
            "Project ID",
            "Referral Code",
            "Invited By",
        ]
        writer.writerow(header)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        batch_size = 1000
        offset = 0

        while True:

            users_batch = query.order_by(User.id).offset(offset).limit(batch_size).all()

            if not users_batch:
                break

            for user in users_batch:
                keys_count = user.total_keys or 0
                user_roles = RBACManager.get_user_role_names(user)
                primary_role = user_roles[0] if user_roles else "client"

                writer.writerow(
                    [
                        user.id,
                        user.username,
                        primary_role,
                        user.first_name or "",
                        user.last_name or "",
                        getattr(user, "email", "") or "",
                        user.created_at.isoformat() if user.created_at else "",
                        user.expires_at.isoformat() if user.expires_at else "",
                        user.last_login.isoformat() if user.last_login else "",
                        user.last_ip or "",
                        user.last_country or "",
                        user.last_city or "",
                        user.total_keys_generated,
                        user.token_balance,
                        user.project_id or "",
                        user.referral_code or "",
                        user.invited_by or "",
                    ]
                )

            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

            offset += batch_size

            if len(users_batch) < batch_size:
                break

    return Response(
        generate_csv(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"},
    )

@admin_users_bp.route("/invite", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.USER_CREATION_ROLES)
def invite_user(current_user):
    """Create an invitation for a new user"""
    data = request.get_json()

    email = data.get("email")
    role = data.get("role", "seller")
    message = data.get("message", "")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    allowed_roles = RolePermissions.ASSIGNABLE_ROLES.copy()
    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:

        allowed_roles = [r for r in allowed_roles if r not in RolePermissions.ADMIN_ROLES]

    if role not in allowed_roles:
        return jsonify({"error": f'Invalid role. Allowed: {", ".join(allowed_roles)}'}), 400

    def generate_invite_code():
        return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

    invite_code = generate_invite_code()

    ref = ReferralCode(
        code=invite_code,
        role=role,
        project_id=current_user.project_id,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )

    db.session.add(ref)
    db.session.commit()

    activity_service.log_activity(
        current_user,
        "invite_user",
        details=f"Invited {email} with role {role}",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": "Invitation sent successfully",
            "invite_code": invite_code,
            "expires_at": ref.expires_at.isoformat(),
        }
    )

@admin_users_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@enforce_project_scope
def get_users_stats(current_user, project_id=None):
    """Get user statistics"""
    query = User.query

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        query = query.filter_by(project_id=current_user.project_id)
    elif project_id:
        query = query.filter_by(project_id=project_id)

    total_users = query.count()

    active_users = query.filter(
        (User.expires_at.is_(None)) | (User.expires_at > datetime.utcnow())
    ).count()

    today = datetime.utcnow().date()
    new_users_today = query.filter(func.date(User.created_at) == today).count()

    from ...models import Role, UserRole

    premium_users = query.filter(
        User.id.in_(
            select(UserRole.user_id).join(Role).where(Role.name.in_(RolePermissions.ADMIN_ROLES))
        )
    ).count()

    return jsonify(
        {
            "total_users": total_users,
            "active_users": active_users,
            "new_users_today": new_users_today,
            "premium_users": premium_users,
        }
    )

@admin_users_bp.route("/<int:user_id>/stats", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@enforce_project_scope
def get_user_stats(user_id, current_user, project_id=None):
    """Get statistics for a specific user"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")

    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403
        project_id = current_user.project_id
    else:
        # project_id should be passed via kwargs from middleware
        if project_id is None:
            project_id = current_user.project_id
        if project_id and target_user.project_id != project_id:
            return jsonify({"error": "Access denied"}), 403
    
    if not project_id:
        project_id = target_user.project_id

    key_stats = (
        db.session.query(
            func.count(Key.id).label("total_keys"),
            func.sum(case((Key.status == 1, 1), else_=0)).label("active_keys"),
        )
        .filter(and_(Key.user_id == user_id, Key.project_id == project_id))
        .first()
    )

    total_keys = key_stats.total_keys if key_stats else 0
    active_keys = key_stats.active_keys if key_stats else 0
    expired_keys = Key.query.filter(
        and_(
            Key.user_id == user_id,
            Key.project_id == project_id,
            Key.expires_at <= datetime.utcnow(),
        )
    ).count()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    keys_30d = Key.query.filter(
        and_(
            Key.user_id == user_id, Key.project_id == project_id, Key.created_at >= thirty_days_ago
        )
    ).count()

    activity_count = UserActivity.query.filter(
        and_(UserActivity.user_id == user_id, UserActivity.project_id == project_id)
    ).count()
    recent_activity = UserActivity.query.filter(
        and_(
            UserActivity.user_id == user_id,
            UserActivity.project_id == project_id,
            UserActivity.created_at >= thirty_days_ago,
        )
    ).count()

    product_permissions = UserProductPermission.query.filter_by(user_id=user_id).count()
    developer_permissions = DeveloperProductPermission.query.filter_by(user_id=user_id).count()

    user_roles = RBACManager.get_user_role_names(target_user)
    primary_role = user_roles[0] if user_roles else "client"

    return jsonify(
        {
            "user": {
                "id": target_user.unique_id,
                "username": target_user.username,
                "role": primary_role,
                "created_at": target_user.created_at.isoformat(),
                "last_login": (
                    target_user.last_login.isoformat() if target_user.last_login else None
                ),
            },
            "keys": {
                "total": total_keys,
                "active": active_keys,
                "expired": expired_keys,
                "last_30_days": keys_30d,
            },
            "activity": {"total": activity_count, "last_30_days": recent_activity},
            "permissions": {"products": product_permissions, "developer_products": developer_permissions},
            "balance": {"tokens": target_user.token_balance},
        }
    )

@admin_users_bp.route("/<int:user_id>/activities", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@enforce_project_scope
def get_user_activities(user_id, current_user):
    """Get activities for a specific user"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = UserActivity.query.filter_by(user_id=user_id)

    pagination = query.order_by(UserActivity.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    activities = []
    for activity in pagination.items:
        activities.append(
            {
                "id": activity.id,
                "action": activity.action,
                "ip_address": activity.ip_address,
                "country": activity.country,
                "city": activity.city,
                "created_at": activity.created_at.isoformat(),
                "details": activity.details,
                "user_agent": activity.user_agent,
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

@admin_users_bp.route("/<int:user_id>/transactions", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@enforce_project_scope
def get_user_transactions(user_id, current_user):
    """Get transaction history for a specific user with pagination"""
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)

    if per_page > 1000:
        per_page = 1000

    try:
        query = TokenTransaction.query.filter_by(user_id=user_id).order_by(
            TokenTransaction.created_at.desc()
        )

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        transaction_list = []
        for transaction in pagination.items:
            transaction_list.append(
                {
                    "id": transaction.id,
                    "amount": transaction.amount,
                    "type": transaction.type if hasattr(transaction, "type") else "credit",
                    "description": (
                        transaction.description
                        if hasattr(transaction, "description")
                        else "Balance transaction"
                    ),
                    "created_at": (
                        transaction.created_at.isoformat() if transaction.created_at else None
                    ),
                }
            )

        return jsonify(
            {
                "transactions": transaction_list,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )
    except Exception as e:
        logging.error(f"Error getting user transactions: {str(e)}")
        return jsonify(
            {"transactions": [], "total": 0, "pages": 0, "current_page": page, "per_page": per_page}
        )
