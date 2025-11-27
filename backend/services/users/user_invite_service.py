"""
User Invite Service
Handles user invitations
"""

import secrets
import string
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...models.keys import ReferralCode
from ...utils.service_helpers import get_service
from ...utils.role_constants import RolePermissions
from ...utils.structured_logging import get_logger


class UserInviteService:
    """Service for handling user invitations"""

    def __init__(self):
        self.logger = get_logger("user_invite_service")

    def invite_user(
        self, current_user: User, email: str, role: str, message: str = ""
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Create an invitation for a new user

        Args:
            current_user: User creating the invitation
            email: Email address
            role: Role for the new user
            message: Optional invitation message

        Returns:
            Tuple of (invite_data dict or None, error_message)
        """
        try:
            if not email:
                return None, "Email is required"

            allowed_roles = RolePermissions.ASSIGNABLE_ROLES.copy()
            rbac_service = get_service('rbac_service')
            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                allowed_roles = [r for r in allowed_roles if r not in RolePermissions.ADMIN_ROLES]

            if role not in allowed_roles:
                return None, f'Invalid role. Allowed: {", ".join(allowed_roles)}'

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

            return {
                "invite_code": invite_code,
                "expires_at": ref.expires_at.isoformat(),
            }, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error inviting user: {str(e)}")
            return None, f"Failed to invite user: {str(e)}"

    def validate_invite_code(self, invite_code: str) -> Tuple[Optional[ReferralCode], Optional[str]]:
        """
        Validate an invite code

        Args:
            invite_code: Invite code to validate

        Returns:
            Tuple of (ReferralCode object or None, error_message)
        """
        try:
            ref = ReferralCode.query.filter_by(code=invite_code).first()
            if not ref:
                return None, "Invalid invite code"

            if ref.expires_at and ref.expires_at < datetime.utcnow():
                return None, "Invite code has expired"

            return ref, None

        except Exception as e:
            self.logger.error(f"Error validating invite code: {str(e)}")
            return None, f"Failed to validate invite code: {str(e)}"


# Singleton instance
user_invite_service = UserInviteService()

