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
from ..activity import activity_service


class BalanceService:
    """Service for handling balance management operations"""

    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger(__name__)

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
            # Validate amount
            if amount <= 0:
                return False, "Amount must be positive", None

            # Get target user
            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found", None

            # Store old balance
            old_balance = target_user.token_balance

            # Update balance
            target_user.token_balance += amount

            # Create transaction record
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

            # Log activity
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
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Deduct from user balance with transaction logging

        Args:
            current_user: User performing the deduction
            target_user_id: ID of user to deduct from
            amount: Amount to deduct (must be positive)
            reason: Optional reason for deduction
            ip_address: Optional IP address for activity logging

        Returns:
            Tuple of (success, error_message, result_data)
        """
        try:
            # Validate amount
            if amount <= 0:
                return False, "Amount must be positive", None

            # Get target user
            target_user = User.query.get(target_user_id)
            if not target_user:
                return False, "User not found", None

            # Check if user has sufficient balance
            if target_user.token_balance < amount:
                return False, "Insufficient balance", None

            # Store old balance
            old_balance = target_user.token_balance

            # Update balance
            target_user.token_balance -= amount

            # Create transaction record
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
            db.session.commit()

            # Log activity
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
            # Validate user exists
            user = User.query.get(user_id)
            if not user:
                return False, "User not found", None

            # Get pagination parameters
            per_page = min(per_page, 1000)  # Limit max per_page

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
            from .rbac_service import rbac_service

            # Check permissions
            can_manage_balance = (
                rbac_service.check_permission(current_user.id, "billing.view_balance")
                or rbac_service.check_permission(current_user.id, "billing.top_up_balance")
                or rbac_service.check_permission(current_user.id, "employees.edit")
                or rbac_service.check_permission(current_user.id, "clients.edit")
            )

            if not can_manage_balance:
                # Check if users are in the same project
                if current_user.project_id != target_user.project_id:
                    return False, "Access denied"

            return True, None

        except Exception as e:
            self.logger.error(f"Error checking balance access: {str(e)}")
            return False, "Failed to check access permissions"


# Create service instance
balance_service = BalanceService()
