"""
Helper function for creating users with roles and product permissions using DI services.

This replaces the facade method create_user_with_roles_and_products() with
a direct implementation using DI services for better testability and clarity.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from ..core.extensions import db
from ..models.core import User
from ..models.keys import TokenTransaction
from ..utils.service_exceptions import ValidationError, ConflictError, NotFoundError, BusinessLogicError, ServiceError
from .service_helpers import (
    get_user_crud_service,
    get_user_role_service,
    get_user_permission_service,
    get_rbac_service,
)


def create_user_with_roles_and_products(
    current_user: User, data: Dict[str, Any], project_id: Optional[int] = None
) -> User:
    """
    Create user with RBAC roles and product permissions using DI services.
    
    This function combines multiple services to create a user with all necessary
    permissions and roles in a single transaction.
    
    Args:
        current_user: The user performing the action
        data: Dictionary containing user creation data:
            - username: str (required)
            - password: str (required)
            - email: Optional[str]
            - first_name: Optional[str]
            - last_name: Optional[str]
            - token_balance: int (default: 0)
            - product_ids: List[int] (optional)
            - rbac_role_ids: List[int] (required)
            - project_id: Optional[int]
            - expires_at: Optional[str] (ISO format)
            - work_duration_days: Optional[int]
    
    Returns:
        User instance
    
    Raises:
        ValidationError: If validation fails
        ConflictError: If username or email already exists
        BusinessLogicError: If business rules are violated
        ServiceError: If database operation fails
    """
    try:
        from werkzeug.security import generate_password_hash

        # Get DI services
        user_crud_service = get_user_crud_service()
        user_role_service = get_user_role_service()
        user_permission_service = get_user_permission_service()
        rbac_service = get_rbac_service()

        # Extract data
        username = data.get("username")
        password = data.get("password")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        email = data.get("email")
        token_balance = data.get("token_balance", 0)
        product_ids = data.get("product_ids", [])
        rbac_role_ids = data.get("rbac_role_ids", [])
        
        # Normalize username - strip whitespace
        if username:
            username = username.strip()
        
        # Log creation attempt
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"USER_CREATION_START: Creating user with username='{username}' (len={len(username) if username else 0}), email='{email}', project_id={data.get('project_id')}")

        # Validation
        if not username or not password:
            raise ValidationError("Username and password are required", field="username")

        if not rbac_role_ids:
            raise ValidationError("At least one RBAC role must be selected", field="rbac_role_ids")

        # Check permissions for token balance
        has_moderator_permission = rbac_service.check_permission(
            current_user.id, "employees.create"
        ) or rbac_service.check_permission(current_user.id, "clients.create")
        
        if has_moderator_permission and token_balance > 0:
            if current_user.token_balance < token_balance:
                raise BusinessLogicError(
                    f"Insufficient balance. Required: {token_balance}, Available: {current_user.token_balance}"
                )

        # Determine project_id - use parameter first, then data, then current_user.project_id
        project_id = project_id or data.get("project_id")
        can_manage_all = rbac_service.check_permission(
            current_user.id, "employees.view"
        ) or rbac_service.check_permission(current_user.id, "clients.view")
        
        if not can_manage_all:
            project_id = project_id or current_user.project_id

        # Validate roles
        if rbac_role_ids and project_id:
            from ..models.rbac import Role

            for role_id in rbac_role_ids:
                role = Role.query.filter_by(id=role_id).first()
                if not role:
                    raise NotFoundError("Role", resource_id=str(role_id))
                if role.project_id != project_id:
                    raise BusinessLogicError(
                        f"Role '{role.name}' belongs to a different project (role project_id: {role.project_id}, target project_id: {project_id})"
                    )

        # Create user directly (CRUD service doesn't support all fields yet)
        # Note: UserCRUDService.create_user() should be extended to support all fields in the future
        
        # Check if username already exists (case-sensitive first, then case-insensitive)
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            logger.warning(f"USER_CREATION: Username '{username}' already exists (id={existing_user.id})")
            raise ConflictError("Username already exists", resource_type="user")
        
        # Also check case-insensitively
        from sqlalchemy import func
        existing_user_ci = User.query.filter(func.lower(User.username) == username.lower()).first()
        if existing_user_ci and existing_user_ci.username != username:
            logger.warning(f"USER_CREATION: Username '{username}' conflicts with existing '{existing_user_ci.username}' (case-insensitive)")
            raise ConflictError(f"Username already exists (case-insensitive match: {existing_user_ci.username})", resource_type="user")
        
        if email and User.query.filter_by(email=email.lower()).first():
            raise ConflictError("Email already exists", resource_type="user")

        logger.info(f"USER_CREATION: Creating User object with username='{username}'")
        user = User(
            username=username,
            password=generate_password_hash(password),
            email=email.lower() if email else None,
            first_name=first_name,
            last_name=last_name,
            project_id=project_id,
            token_balance=token_balance,
            created_at=datetime.utcnow(),
        )

        # Handle expiry date
        if data.get("expires_at"):
            try:
                user.expires_at = datetime.fromisoformat(
                    data["expires_at"].replace("Z", "+00:00")
                )
            except Exception:
                pass
        elif data.get("work_duration_days"):
            work_duration_days = data.get("work_duration_days")
            if work_duration_days and work_duration_days > 0:
                user.expires_at = datetime.utcnow() + timedelta(days=work_duration_days)

        db.session.add(user)
        db.session.flush()
        
        # Log after flush
        logger.info(f"USER_CREATION_FLUSH: User flushed with id={user.id}, username='{user.username}', project_id={user.project_id}")

        # Handle token transactions
        if has_moderator_permission and token_balance > 0:
            current_user.token_balance -= token_balance

            moderator_transaction = TokenTransaction(
                user_id=current_user.id,
                amount=token_balance,
                type="debit",
                description=f"User creation: {username} (RBAC roles: {len(rbac_role_ids)})",
                project_id=current_user.project_id,
                created_at=datetime.utcnow(),
            )
            db.session.add(moderator_transaction)

            user_transaction = TokenTransaction(
                user_id=user.id,
                amount=token_balance,
                type="credit",
                description=f"Initial balance from moderator {current_user.username}",
                project_id=user.project_id,
                created_at=datetime.utcnow(),
            )
            db.session.add(user_transaction)

        # Assign product permissions
        if project_id and product_ids:
            processed_product_ids = user_permission_service.process_product_ids_from_data(product_ids)
            if processed_product_ids:
                user_permission_service.assign_product_permissions(
                    user.id, project_id, processed_product_ids
                )

        # Assign roles
        if rbac_role_ids and project_id:
            user_role_service.assign_roles_to_user(user.id, project_id, rbac_role_ids)

        # Update project counters
        if project_id:
            from .project_counters import increment_project_user_counters
            is_active = user.expires_at is None or user.expires_at > datetime.utcnow()
            increment_project_user_counters(project_id, is_active=is_active)

        db.session.commit()
        
        # Refresh user from database to ensure it's available
        db.session.refresh(user)
        
        # Verify user was created successfully with detailed logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"USER_CREATION: Committed user {username} with id={user.id}, project_id={user.project_id}")
        
        # Try multiple ways to find the user
        created_user = User.query.filter_by(username=username).first()
        if not created_user:
            # Try case-insensitive search
            from sqlalchemy import func
            created_user = User.query.filter(func.lower(User.username) == username.lower()).first()
            if created_user:
                logger.warning(f"USER_CREATION: User found with case-insensitive search: {created_user.username} != {username}")
        
        if not created_user:
            # Try by id
            created_user = User.query.filter_by(id=user.id).first()
            if created_user:
                logger.warning(f"USER_CREATION: User found by id but not by username. Stored username: '{created_user.username}', searched: '{username}'")
        
        if not created_user:
            logger.error(f"USER_CREATION: User {username} (id={user.id}) was not found in database after commit")
            logger.error(f"USER_CREATION: Total users in DB: {User.query.count()}")
            # List all usernames for debugging
            all_users = User.query.all()
            logger.error(f"USER_CREATION: All usernames in DB: {[u.username for u in all_users]}")
            raise ServiceError("Failed to create user: user not found after commit", status_code=500)
        
        logger.info(f"USER_CREATION: Successfully verified user {username} (id={created_user.id}) exists in database")
        return user

    except (ValidationError, ConflictError, NotFoundError, BusinessLogicError):
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating user with roles and products: {str(e)}", exc_info=True)
        raise ServiceError(f"Failed to create user: {str(e)}", status_code=500) from e

