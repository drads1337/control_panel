"""
Refactored UserOrchestrator with separated transactions.

This is an example of how to refactor UserOrchestrator to avoid long-running
transactions and reduce database lock contention.

Key improvements:
1. Separated transactions for different operations
2. Non-critical operations can be retried or done asynchronously
3. Better error handling and rollback strategies
"""

import logging
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

from ...core.extensions import db
from ...utils.service_helpers import get_service
from ...utils.service_exceptions import (
    ValidationError, NotFoundError, PermissionDeniedError, BusinessLogicError
)
from ...models.core import User
from ...models.keys import TokenTransaction
from ...utils.project_counters import increment_project_user_counters

logger = logging.getLogger(__name__)


class UserOrchestratorRefactored:
    """
    Refactored orchestrator with separated transactions.
    
    This version splits the large transaction into smaller, focused transactions
    to reduce lock contention and improve scalability.
    """

    def __init__(self):
        """Initialize orchestrator with all required services"""
        self.user_crud_service = get_service('user_crud_service')
        self.user_role_service = get_service('user_role_service')
        self.user_permission_service = get_service('user_permission_service')
        self.user_profile_service = get_service('user_profile_service')
        self.rbac_service = get_service('rbac_service')
        self.activity_service = get_service('activity_service')

    def create_user_with_full_setup(
        self,
        current_user: User,
        user_data: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Create a new user with complete setup using separated transactions.
        
        This method uses multiple smaller transactions instead of one large one,
        reducing lock contention and improving error recovery.
        """
        try:
            # Validate and check permissions (no DB operations)
            self._validate_user_creation_data(user_data)
            self._check_creation_permissions(current_user, user_data)

            token_balance = user_data.get("token_balance", 0)
            if token_balance > 0:
                self._check_and_reserve_balance(current_user, token_balance)

            try:
                # Transaction 1: Create user core (fast, minimal locks)
                user = self._create_user_core(user_data)
                db.session.commit()
                logger.info(f"User core created: {user.id} ({user.username})")

                # Transaction 2: Assign roles and products (can be retried)
                try:
                    self._assign_roles_and_products(user, user_data)
                    db.session.commit()
                    logger.info(f"Roles and products assigned for user {user.id}")
                except Exception as e:
                    logger.error(
                        f"Failed to assign roles/products for user {user.id}: {e}. "
                        "User is created but roles/products need to be assigned manually."
                    )
                    # User is already created, so we don't rollback
                    # This can be fixed later via admin interface or retry mechanism

                # Transaction 3: Handle token transactions (can be async)
                if token_balance > 0:
                    try:
                        self._handle_token_transactions(current_user, user, token_balance)
                        db.session.commit()
                        logger.info(f"Token transactions completed for user {user.id}")
                    except Exception as e:
                        logger.error(
                            f"Failed to process token transactions for user {user.id}: {e}. "
                            "User is created but tokens need to be processed manually."
                        )
                        # Could send to background task for retry

                # Transaction 4: Update counters (non-critical, can be async)
                project_id = user_data.get("project_id") or current_user.project_id
                if project_id:
                    try:
                        is_active = user.expires_at is None or user.expires_at > datetime.utcnow()
                        increment_project_user_counters(project_id, is_active=is_active)
                        db.session.commit()
                    except Exception as e:
                        logger.warning(
                            f"Failed to update project counters for user {user.id}: {e}. "
                            "Counters can be recalculated later."
                        )
                        db.session.rollback()  # Rollback only counter update

                # Log activity (non-critical, can fail silently)
                try:
                    self.activity_service.log_activity(
                        current_user,
                        "create_user",
                        details=f"Created user: {user.username} (ID: {user.id})",
                        ip=ip_address,
                    )
                except Exception as e:
                    logger.warning(f"Failed to log user creation activity: {e}")

                logger.info(f"Successfully created user {user.username} (ID: {user.id})")
                return user

            except (ValidationError, NotFoundError, PermissionDeniedError, BusinessLogicError):
                if token_balance > 0:
                    self._release_reserved_balance(current_user, token_balance)
                raise
            except Exception as e:
                if token_balance > 0:
                    self._release_reserved_balance(current_user, token_balance)
                logger.error(f"Error creating user: {str(e)}", exc_info=True)
                raise BusinessLogicError(f"Failed to create user: {str(e)}")

        except (ValidationError, PermissionDeniedError, BusinessLogicError, NotFoundError):
            raise
        except Exception as e:
            logger.error(f"Error in create_user_with_full_setup: {str(e)}", exc_info=True)
            token_balance = user_data.get("token_balance", 0)
            if token_balance > 0:
                try:
                    self._release_reserved_balance(current_user, token_balance)
                except Exception:
                    pass
            raise BusinessLogicError(f"Failed to create user: {str(e)}")

    def _create_user_core(self, data: Dict[str, Any]) -> User:
        """
        Create user core record (username, password, email, etc.).
        
        This is a fast operation with minimal database locks.
        """
        from werkzeug.security import generate_password_hash

        username = data.get("username")
        password = data.get("password")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        email = data.get("email")
        project_id = data.get("project_id")

        if not username or not password:
            raise ValidationError("Username and password are required")

        if User.query.filter_by(username=username).first():
            raise ValidationError("Username already exists", field="username")

        user = User(
            username=username,
            password=generate_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            email=email,
            project_id=project_id,
            token_balance=data.get("token_balance", 0),
            created_at=datetime.utcnow(),
        )

        if data.get("expires_at"):
            try:
                user.expires_at = datetime.fromisoformat(
                    data["expires_at"].replace("Z", "+00:00")
                )
            except:
                pass
        elif data.get("work_duration_days"):
            work_duration_days = data.get("work_duration_days")
            if work_duration_days and work_duration_days > 0:
                user.expires_at = datetime.utcnow() + timedelta(days=work_duration_days)

        db.session.add(user)
        db.session.flush()  # Get user.id without committing

        return user

    def _assign_roles_and_products(
        self, user: User, data: Dict[str, Any]
    ) -> None:
        """
        Assign RBAC roles and product permissions to user.
        
        This is a separate transaction that can be retried if it fails.
        """
        project_id = user.project_id
        product_ids = data.get("product_ids", [])
        rbac_role_ids = data.get("rbac_role_ids", [])

        # Validate roles
        if rbac_role_ids and project_id:
            from ...models.rbac import Role

            for role_id in rbac_role_ids:
                role = Role.query.filter_by(id=role_id).first()
                if not role:
                    raise NotFoundError("Role", str(role_id))
                if role.project_id != project_id:
                    raise BusinessLogicError(
                        f"Role '{role.name}' belongs to a different project"
                    )

        # Assign product permissions
        if project_id and product_ids:
            processed_product_ids = self.user_permission_service.process_product_ids_from_data(
                product_ids
            )
            if processed_product_ids:
                self.user_permission_service.assign_product_permissions(
                    user.id, project_id, processed_product_ids
                )

        # Assign roles
        if rbac_role_ids and project_id:
            self.user_role_service.assign_roles_to_user(user.id, project_id, rbac_role_ids)

    def _handle_token_transactions(
        self, current_user: User, new_user: User, token_balance: int
    ) -> None:
        """
        Handle token transactions between users.
        
        This is a separate transaction that can be retried or done asynchronously.
        """
        if token_balance <= 0:
            return

        # Check balance
        if current_user.token_balance < token_balance:
            raise BusinessLogicError(
                f"Insufficient balance. Required: {token_balance}, "
                f"Available: {current_user.token_balance}"
            )

        # Update balances
        current_user.token_balance -= token_balance
        new_user.token_balance = token_balance

        # Create transactions
        moderator_transaction = TokenTransaction(
            user_id=current_user.id,
            amount=token_balance,
            type="debit",
            description=f"User creation: {new_user.username}",
            project_id=current_user.project_id,
            created_at=datetime.utcnow(),
        )
        db.session.add(moderator_transaction)

        user_transaction = TokenTransaction(
            user_id=new_user.id,
            amount=token_balance,
            type="credit",
            description=f"Initial balance from moderator {current_user.username}",
            project_id=new_user.project_id,
            created_at=datetime.utcnow(),
        )
        db.session.add(user_transaction)

    def _validate_user_creation_data(self, user_data: Dict[str, Any]) -> None:
        """Validate user creation data. Raises ValidationError if invalid."""
        username = user_data.get("username")
        password = user_data.get("password")

        if not username or not password:
            raise ValidationError("Username and password are required")

        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long", field="password")

        if User.query.filter_by(username=username).first():
            raise ValidationError("Username already exists", field="username")

    def _check_creation_permissions(
        self, current_user: User, user_data: Dict[str, Any]
    ) -> None:
        """Check if current user can create users with specified roles."""
        rbac_role_ids = user_data.get("rbac_role_ids", [])

        if not rbac_role_ids:
            raise ValidationError("At least one RBAC role must be selected", field="rbac_role_ids")

        has_employee_permission = self.rbac_service.check_permission(
            current_user.id, "employees.create"
        )
        has_client_permission = self.rbac_service.check_permission(
            current_user.id, "clients.create"
        )

        if not (has_employee_permission or has_client_permission):
            raise PermissionDeniedError(
                "Insufficient permissions to create users", action="create_user"
            )

    def _check_and_reserve_balance(self, current_user: User, amount: int) -> None:
        """Check and reserve balance for user creation."""
        if current_user.token_balance < amount:
            raise BusinessLogicError(
                f"Insufficient balance. Required: {amount}, "
                f"Available: {current_user.token_balance}"
            )

    def _release_reserved_balance(self, current_user: User, amount: int) -> None:
        """Release reserved balance (no-op for now, balance is only deducted on success)"""
        pass

