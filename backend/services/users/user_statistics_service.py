"""
User Statistics Service
Handles user statistics and analytics
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, func, select

from ...core.extensions import db
from ...models.core import (
    DeveloperProductPermission,
    User,
    UserActivity,
    UserProductPermission,
)
from ...models.keys import Key, TokenTransaction
from ...models.rbac import Role, UserRole
from ...services.rbac import rbac_service
from ...utils.rbac_utils import RBACManager
from ...utils.structured_logging import get_logger


class UserStatisticsService:
    """Service for handling user statistics"""

    def __init__(self):
        self.logger = get_logger("user_statistics_service")

    def get_users_stats(
        self, current_user: User, project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get user statistics

        Args:
            current_user: User requesting stats
            project_id: Optional project ID for scoping

        Returns:
            Dictionary with user statistics
        """
        try:
            from ...utils.role_constants import RolePermissions

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

            premium_users = query.filter(
                User.id.in_(
                    select(UserRole.user_id).join(Role).where(Role.name.in_(RolePermissions.ADMIN_ROLES))
                )
            ).count()

            return {
                "total_users": total_users,
                "active_users": active_users,
                "new_users_today": new_users_today,
                "premium_users": premium_users,
            }

        except Exception as e:
            self.logger.error(f"Error getting users stats: {str(e)}")
            return {
                "total_users": 0,
                "active_users": 0,
                "new_users_today": 0,
                "premium_users": 0,
            }

    def get_user_stats(
        self, current_user: User, user_id: int, project_id: Optional[int] = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get statistics for a specific user

        Args:
            current_user: User requesting stats
            user_id: Target user ID
            project_id: Optional project ID for scoping

        Returns:
            Tuple of (stats dict or None, error_message)
        """
        try:
            target_user = User.query.get(user_id)
            if not target_user:
                return None, "User not found"

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")

            if not can_view_all:
                if current_user.project_id != target_user.project_id:
                    return None, "Access denied"
            else:
                if project_id and target_user.project_id != project_id:
                    return None, "Access denied"

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

            return {
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
            }, None

        except Exception as e:
            self.logger.error(f"Error getting user stats: {str(e)}")
            return None, f"Failed to get user stats: {str(e)}"

    def get_user_activities(
        self, current_user: User, user_id: int, page: int = 1, per_page: int = 20
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get activities for a specific user

        Args:
            current_user: User requesting activities
            user_id: Target user ID
            page: Page number
            per_page: Items per page

        Returns:
            Tuple of (activities dict or None, error_message)
        """
        try:
            target_user = User.query.get(user_id)
            if not target_user:
                return None, "User not found"

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                if current_user.project_id != target_user.project_id:
                    return None, "Access denied"

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

            return {
                "activities": activities,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }, None

        except Exception as e:
            self.logger.error(f"Error getting user activities: {str(e)}")
            return None, f"Failed to get user activities: {str(e)}"

    def get_user_transactions(
        self, current_user: User, user_id: int, page: int = 1, per_page: int = 50
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get transaction history for a specific user

        Args:
            current_user: User requesting transactions
            user_id: Target user ID
            page: Page number
            per_page: Items per page

        Returns:
            Tuple of (transactions dict or None, error_message)
        """
        try:
            target_user = User.query.get(user_id)
            if not target_user:
                return None, "User not found"

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                if current_user.project_id != target_user.project_id:
                    return None, "Access denied"

            if per_page > 1000:
                per_page = 1000

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

            return {
                "transactions": transaction_list,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }, None

        except Exception as e:
            self.logger.error(f"Error getting user transactions: {str(e)}")
            return {
                "transactions": [],
                "total": 0,
                "pages": 0,
                "current_page": page,
                "per_page": per_page,
            }, None


# Singleton instance
user_statistics_service = UserStatisticsService()

