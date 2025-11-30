"""
Balance Service
Handles user balance operations, top-ups, deductions, and transaction history
Encapsulates all business logic related to balance management
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...models.keys import TokenTransaction
from ...utils.rbac_utils import RBACManager
from ...utils.service_helpers import get_service


from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.rbac.rbac_service import RBACService
    from ...services.activity.activity_service import ActivityService

class BalanceService:
    """Service for handling balance management operations"""

    def __init__(
        self,
        rbac_service: 'RBACService' = None,
        activity_service: 'ActivityService' = None,
        logger=None
    ):
        """
        Initialize BalanceService with explicit dependencies.
        
        Args:
            rbac_service: Service for RBAC checks
            activity_service: Service for logging activities
            logger: Optional logger instance
        """
        self.logger = logger or logging.getLogger(__name__)
        

        self._rbac_service = rbac_service
        self._activity_service = activity_service
    
    def topup_balance(
        self,
        current_user: User,
        target_user_id: int,
        amount: float,
        description: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Top up user balance with transaction logging
        If current_user has billing permission, deduct amount from their balance

        Args:
            current_user: User performing the top-up
            target_user_id: ID of user to top up
            amount: Amount to add (must be positive)
            description: Optional custom description for transaction
            ip_address: Optional IP address for activity logging

        Returns:
            Tuple of (success, error_message, result_data)
        """
        try:

            if amount <= 0:
                return False, "Amount must be positive", None

            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found", None



            if not self._rbac_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "RBACService dependency not injected",
                    status_code=500
                )
            rbac_service = self._rbac_service
            
            is_owner = RBACManager.is_owner(current_user)
            is_admin = RBACManager.is_admin(current_user)
            has_billing_permission = rbac_service.check_permission(
                current_user.id, "billing.top_up_balance"
            ) or rbac_service.check_permission(
                current_user.id, "billing.deduct_balance"
            )
            

            if not is_owner and not is_admin and has_billing_permission:
                if current_user.token_balance < amount:
                    return False, f"Insufficient balance. Required: {amount} tokens, Available: {current_user.token_balance} tokens", None
                

                current_user.token_balance -= amount
                

                current_user_transaction = TokenTransaction(
                    user_id=current_user.id,
                    amount=amount,
                    type="debit",
                    description=f"Balance top-up for user {target_user.username} (ID: {target_user.id})",
                    project_id=current_user.project_id,
                    created_at=datetime.utcnow(),
                )
                db.session.add(current_user_transaction)

            old_balance = target_user.token_balance

            target_user.token_balance += amount

            transaction_description = description or f"Balance top-up by {current_user.username}"
            transaction = TokenTransaction(
                user_id=target_user.id,
                amount=amount,
                type="credit",
                description=transaction_description,
                project_id=target_user.project_id,
                created_at=datetime.utcnow(),
            )
            db.session.add(transaction)
            db.session.commit()

            if not self._activity_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "ActivityService dependency not injected",
                    status_code=500
                )
            activity_service = self._activity_service
            activity_service.log_activity(
                current_user,
                "topup_balance",
                details=f"Topped up {amount} tokens for user {target_user.username} (ID: {target_user.id}). Old balance: {old_balance}, New balance: {target_user.token_balance}",
                ip=ip_address,
            )

            result_data = {
                "user_id": target_user_id,
                "old_balance": old_balance,
                "new_balance": target_user.token_balance,
                "amount_added": amount,
            }

            return True, None, result_data

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error topping up balance: {str(e)}")
            return False, f"Failed to top up balance: {str(e)}", None

    def deduct_balance(
        self,
        current_user: User,
        target_user_id: int,
        amount: float,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        commit: bool = True,
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Deduct from user balance with transaction logging

        Args:
            current_user: User performing the deduction
            target_user_id: ID of user to deduct from
            amount: Amount to deduct (must be positive)
            reason: Optional reason for deduction
            ip_address: Optional IP address for activity logging
            commit: Whether to commit the transaction (default: True). 
                   Set to False when calling within an existing transaction.

        Returns:
            Tuple of (success, error_message, result_data)
        """
        try:

            if amount <= 0:
                return False, "Amount must be positive", None

            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found", None

            if target_user.token_balance < amount:
                return False, "Insufficient balance", None

            old_balance = target_user.token_balance

            target_user.token_balance -= amount

            transaction_description = f'{reason or "Balance deduction"} by {current_user.username}'
            transaction = TokenTransaction(
                user_id=target_user.id,
                amount=amount,
                type="debit",
                description=transaction_description,
                project_id=target_user.project_id,
                created_at=datetime.utcnow(),
            )
            db.session.add(transaction)
            
            if commit:
                db.session.commit()

            if commit:
                if not self._activity_service:
                    from ...utils.service_exceptions import ServiceError
                    raise ServiceError(
                        "ActivityService dependency not injected",
                        status_code=500
                    )
                activity_service = self._activity_service
                activity_service.log_activity(
                    current_user,
                    "deduct_balance",
                    details=f'Deducted {amount} tokens from user {target_user.username} (ID: {target_user.id}). Old balance: {old_balance}, New balance: {target_user.token_balance}. Reason: {reason or "Balance deduction"}',
                    ip=ip_address,
                )

            result_data = {
                "user_id": target_user_id,
                "old_balance": old_balance,
                "new_balance": target_user.token_balance,
                "amount_deducted": amount,
                "reason": reason or "Balance deduction",
            }

            return True, None, result_data

        except Exception as e:
            if commit:
                db.session.rollback()
            self.logger.error(f"Error deducting balance: {str(e)}")
            return False, f"Failed to deduct balance: {str(e)}", None

    def get_user_transactions(
        self, user_id: int, page: int = 1, per_page: int = 50
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Get transaction history for a user with pagination

        Args:
            user_id: User ID
            page: Page number
            per_page: Items per page

        Returns:
            Tuple of (success, error_message, result_data)
        """
        try:

            user = User.query.get(user_id)
            if not user:
                return False, "User not found", None

            per_page = min(per_page, 1000)

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

            result_data = {
                "transactions": transaction_list,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }

            return True, None, result_data

        except Exception as e:
            self.logger.error(f"Error getting user transactions: {str(e)}")
            return False, f"Failed to get transactions: {str(e)}", None

    def get_user_balance_info(
        self, user: User, include_recent_transactions: bool = True, recent_limit: int = 5
    ) -> Dict[str, Any]:
        """
        Get user balance information with optional recent transactions

        Args:
            user: User object
            include_recent_transactions: Whether to include recent transactions
            recent_limit: Number of recent transactions to include

        Returns:
            Dictionary with balance information
        """
        try:
            result = {
                "balance": user.token_balance,
                "user_id": user.id,
                "username": user.username,
                "project_id": user.project_id,
            }

            if include_recent_transactions:
                recent_transactions = (
                    TokenTransaction.query.filter_by(user_id=user.id)
                    .order_by(TokenTransaction.created_at.desc())
                    .limit(recent_limit)
                    .all()
                )

                transactions = []
                for transaction in recent_transactions:
                    transactions.append(
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
                                transaction.created_at.isoformat()
                                if transaction.created_at
                                else None
                            ),
                        }
                    )

                result["recent_transactions"] = transactions

            return result

        except Exception as e:
            self.logger.error(f"Error getting user balance info: {str(e)}")
            return {
                "balance": user.token_balance if user else 0,
                "error": "Failed to load balance information",
            }

    def check_balance_access(
        self, current_user: User, target_user: User
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if current user has permission to manage target user's balance

        Args:
            current_user: User performing the action
            target_user: Target user whose balance is being managed

        Returns:
            Tuple of (has_access, error_message)
        """
        try:

            if not self._rbac_service:
                from ...utils.service_exceptions import ServiceError
                raise ServiceError(
                    "RBACService dependency not injected",
                    status_code=500
                )
            rbac_service = self._rbac_service

            can_manage_balance = (
                rbac_service.check_permission(current_user.id, "billing.view_balance")
                or rbac_service.check_permission(current_user.id, "billing.top_up_balance")
                or rbac_service.check_permission(current_user.id, "employees.edit")
                or rbac_service.check_permission(current_user.id, "clients.edit")
            )

            if not can_manage_balance:

                if current_user.project_id != target_user.project_id:
                    return False, "Access denied"

            return True, None

        except Exception as e:
            self.logger.error(f"Error checking balance access: {str(e)}")
            return False, "Failed to check access permissions"

