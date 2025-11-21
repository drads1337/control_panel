"""
User Management Routes
CRUD operations for users: create, read, update, delete
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ...core.extensions import db
from ...middleware.auth import (
    enforce_project_scope,
    require_project_isolation,
    require_project_with_grace_period,
    require_role,
    require_user,
)
from ...middleware.validation import validate_request
from ...models import User
from ...schemas.user import UserCreateSchema, UserUpdateSchema
from ...services.activity import activity_service
from ...services.rbac import rbac_service
from ...services.users import user_management_service, user_profile_service
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import RolePermissions

management_bp = Blueprint("users_management", __name__)

@management_bp.route("", methods=["GET"])
@jwt_required()
@require_user
@require_project_with_grace_period
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def get_users(current_user=None, project_id=None):
    """Get users with optimized key counts"""
    import logging
    from flask import g

    logger = logging.getLogger(__name__)

    try:

        if current_user is None:
            current_user = g.current_user
        if project_id is None:
            project_id = getattr(g, "project_id", request.args.get("project_id", type=int))

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        role_filter = request.args.get("role")
        roles_filter = request.args.getlist("roles")
        search = request.args.get("search")

        result = user_management_service.get_users_with_key_counts(
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
    except Exception as e:
        logger.error(f"Error in get_users endpoint: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to get users"}), 500

@management_bp.route("/add", methods=["POST"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.USER_CREATION_ROLES)
@validate_request(UserCreateSchema)
def add_user(current_user=None, validated_data=None):
    """Create a new user with roles and product permissions"""
    import logging

    logger = logging.getLogger(__name__)

    if current_user is None:
        from flask import g
        current_user = g.current_user

    data = validated_data if validated_data is not None else request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        user, error = user_management_service.create_user_with_roles_and_products(current_user, data)

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
                        "id": user.id,
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

@management_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
@validate_request(UserUpdateSchema)
def update_user(user_id, current_user=None, validated_data=None):
    """Update a user with roles and product permissions"""
    import logging
    from flask import g

    logger = logging.getLogger(__name__)

    if current_user is None:
        current_user = g.current_user

    data = validated_data if validated_data else request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:

        target_user = User.query.get(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        can_view_all = rbac_service.check_permission(
            current_user.id, "employees.view"
        ) or rbac_service.check_permission(current_user.id, "clients.view")

        if not can_view_all:
            if current_user.project_id != target_user.project_id:
                return jsonify({"error": "Access denied"}), 403
        else:

            project_id = getattr(g, "project_id", current_user.project_id)
            if project_id and target_user.project_id != project_id:
                return jsonify({"error": "Access denied"}), 403

        success, error = user_profile_service.update_user_profile(target_user, data)
        if not success:
            return jsonify({"error": error}), 400

        db.session.refresh(target_user)

        rbac_roles = []
        role_names = []
        try:
            rbac_roles = rbac_service.get_user_roles(target_user.id)
            role_names = [role["name"] for role in rbac_roles] if rbac_roles else []
        except Exception as e:
            logger.warning(f"Failed to get RBAC roles for user {target_user.id}: {e}", exc_info=True)

            from ...utils.rbac_utils import RBACManager
            role_names = RBACManager.get_user_role_names(target_user)

        keys_count = target_user.total_keys or 0
        active_keys = target_user.active_keys or 0

        user_data = {
            "id": target_user.id,
            "username": target_user.username,
            "roles": role_names,
            "first_name": target_user.first_name,
            "last_name": target_user.last_name,
            "email": target_user.email if hasattr(target_user, "email") else None,
            "avatar": target_user.avatar,
            "created_at": target_user.created_at.isoformat() if target_user.created_at else None,
            "expires_at": target_user.expires_at.isoformat() if target_user.expires_at else None,
            "last_login": target_user.last_login.isoformat() if target_user.last_login else None,
            "last_ip": target_user.last_ip,
            "last_country": target_user.last_country,
            "last_city": target_user.last_city,
            "total_keys_generated": target_user.total_keys_generated or 0,
            "token_balance": target_user.token_balance or 0,
            "project_id": target_user.project_id,
            "keys_count": keys_count,
            "active_keys": active_keys,
            "referral_code": target_user.referral_code,
            "invited_by": target_user.invited_by,
            "rbac_roles": rbac_roles,
        }

        try:
            activity_service.log_activity(
                current_user,
                "update_user",
                details=f"Updated user: {target_user.username} (ID: {target_user.id})",
                ip=request.remote_addr,
            )
        except Exception as e:
            logger.warning(f"Failed to log activity for user update: {e}")

        return jsonify(user_data), 200

    except Exception as e:
        logger.error(f"Error updating user: {str(e)}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to update user: {str(e)}"}), 500

@management_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def delete_user(user_id, current_user=None):
    """Delete a user safely"""

    if current_user is None:
        from flask import g
        current_user = g.current_user

    success, error = user_management_service.delete_user_safely(current_user, user_id)

    if not success:
        return jsonify({"error": error}), 400 if "not found" in error.lower() else 403

    activity_service.log_activity(
        current_user, "delete_user", details=f"Deleted user ID: {user_id}", ip=request.remote_addr
    )

    return jsonify({"message": "User deleted successfully"})

@management_bp.route("/bulk", methods=["POST"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.USER_CREATION_ROLES)
def bulk_action(current_user=None, project_id=None):
    """Perform bulk actions on users"""

    if current_user is None:
        from flask import g
        current_user = g.current_user
    data = request.get_json()

    action = data.get("action")
    user_ids = data.get("user_ids", [])

    if not action or not user_ids:
        return jsonify({"error": "Action and user_ids are required"}), 400

    query = User.query.filter(User.id.in_(user_ids))

    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        query = query.filter_by(project_id=current_user.project_id)
    else:

        if project_id is None:
            from flask import g
            project_id = getattr(g, "project_id", None)
        if project_id:
            query = query.filter_by(project_id=project_id)

    users = query.all()

    if action == "delete":
        try:
            from ...models import Key, UserProductPermission, DeveloperProductPermission, UserActivity, UserRole, ProjectUserRole

            for user in users:

                if RBACManager.is_admin(user) or RBACManager.is_owner(user):
                    continue

                user.total_keys = 0
                user.active_keys = 0
                Key.query.filter_by(user_id=user.id).delete()
                UserProductPermission.query.filter_by(user_id=user.id).delete()
                DeveloperProductPermission.query.filter_by(user_id=user.id).delete()
                UserActivity.query.filter_by(user_id=user.id).delete()

                UserRole.query.filter_by(user_id=user.id).delete()

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

@management_bp.route("/export", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@require_project_isolation
def export_users():
    """Export users to CSV with streaming to avoid memory issues"""
    import csv
    from flask import Response, g
    from io import StringIO

    current_user = g.current_user

    role_filter = request.args.get("role")
    project_id = request.args.get("project_id", type=int)

    query = User.query

    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

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

@management_bp.route("/invite", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.USER_CREATION_ROLES)
def invite_user():
    """Create an invitation for a new user"""
    from flask import g
    from datetime import datetime, timedelta
    import secrets
    import string

    current_user = g.current_user
    data = request.get_json()

    email = data.get("email")
    role = data.get("role", "seller")
    message = data.get("message", "")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    allowed_roles = RolePermissions.ASSIGNABLE_ROLES.copy()
    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:

        allowed_roles = [r for r in allowed_roles if r not in RolePermissions.ADMIN_ROLES]

    if role not in allowed_roles:
        return jsonify({"error": f'Invalid role. Allowed: {", ".join(allowed_roles)}'}), 400

    def generate_invite_code():
        return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

    from ...models.keys import ReferralCode

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

@management_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@require_project_isolation
def get_users_stats():
    """Get user statistics"""
    from flask import g
    from datetime import datetime
    from sqlalchemy import func, select

    current_user = g.current_user

    query = User.query

    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        query = query.filter_by(project_id=current_user.project_id)

    total_users = query.count()

    active_users = query.filter(
        (User.expires_at.is_(None)) | (User.expires_at > datetime.utcnow())
    ).count()

    today = datetime.utcnow().date()
    new_users_today = query.filter(func.date(User.created_at) == today).count()

    from ...models.rbac import Role, UserRole

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

@management_bp.route("/<int:user_id>/stats", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@require_project_isolation
def get_user_stats(user_id):
    """Get statistics for a specific user"""
    from flask import g
    from datetime import datetime, timedelta
    from sqlalchemy import and_, case, func

    current_user = g.current_user
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")

    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403
    else:

        project_id = getattr(g, "project_id", current_user.project_id)
        if project_id and target_user.project_id != project_id:
            return jsonify({"error": "Access denied"}), 403

    project_id = getattr(g, "project_id", current_user.project_id)
    if not project_id:
        project_id = target_user.project_id

    from ...models.keys import Key
    from ...models.core import DeveloperProductPermission, UserProductPermission

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

    from ...models.core import UserActivity

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
                "id": target_user.id,
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

@management_bp.route("/<int:user_id>/activities", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@require_project_isolation
def get_user_activities(user_id):
    """Get activities for a specific user"""
    from flask import g

    current_user = g.current_user
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

    can_view_all = rbac_service.check_permission(
        current_user.id, "employees.view"
    ) or rbac_service.check_permission(current_user.id, "clients.view")
    if not can_view_all:
        if current_user.project_id != target_user.project_id:
            return jsonify({"error": "Access denied"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    from ...models.core import UserActivity

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

@management_bp.route("/<int:user_id>/transactions", methods=["GET"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
@require_project_isolation
def get_user_transactions(user_id):
    """Get transaction history for a specific user with pagination"""
    import logging
    from flask import g

    logger = logging.getLogger(__name__)
    current_user = g.current_user
    target_user = User.query.get(user_id)

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    from ...services.rbac import rbac_service
    from ...utils.rbac_utils import RBACManager

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
        from ...models.keys import TokenTransaction

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
        logger.error(f"Error getting user transactions: {str(e)}")
        return jsonify(
            {"transactions": [], "total": 0, "pages": 0, "current_page": page, "per_page": per_page}
        )
