"""
Invite Service
Handles invitation codes, referral codes, and user invitation management
"""

import logging
import re
import secrets
import string
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from flask import current_app
from sqlalchemy import func

from ...core.extensions import db
from ...models.core import Project, ProjectInviteCode, User
from ...models.keys import ReferralCode
from ...models.products import ProductInviteCode
from ...models.rbac import Role, UserRole
from ...utils.rbac_utils import RBACManager

class InviteService:
    """Service for handling invitation and referral code operations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.default_invite_duration_days = 30
        self.default_referral_duration_days = 90

    def generate_invite_code(
        self,
        project_id: int,
        created_by: int,
        duration_days: Optional[int] = None,
        max_uses: Optional[int] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a new project invite code

        Args:
            project_id: Project ID
            created_by: User ID who created the invite
            duration_days: Duration in days (optional)
            max_uses: Maximum number of uses (optional)

        Returns:
            Tuple of (invite_code or None, error_message or None)
        """
        try:

            project = Project.query.get(project_id)
            if not project:
                return None, "Project not found"

            code = self._generate_unique_code()

            duration = duration_days or self.default_invite_duration_days
            expires_at = datetime.utcnow() + timedelta(days=duration)

            invite = ProjectInviteCode(
                code=code,
                project_id=project_id,
                created_by=created_by,
                expires_at=expires_at,
                max_uses=max_uses,
                is_used=False,
                is_expired=False,
            )

            db.session.add(invite)
            db.session.commit()

            return code, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error generating invite code: {str(e)}")
            return None, "Failed to generate invite code"

    def generate_referral_code(
        self, user_id: int, duration_days: Optional[int] = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a new referral code

        Args:
            user_id: User ID
            duration_days: Duration in days (optional)

        Returns:
            Tuple of (referral_code or None, error_message or None)
        """
        try:

            user = User.query.get(user_id)
            if not user:
                return None, "User not found"


            existing_code = ReferralCode.query.filter_by(user_id=user_id, used=False).first()
            if existing_code:

                if not existing_code.expires_at or existing_code.expires_at > datetime.utcnow():
                    return existing_code.code, None


            code = self._generate_unique_code(length=7, prefix="REF")

            duration = duration_days or self.default_referral_duration_days
            expires_at = datetime.utcnow() + timedelta(days=duration)

            referral = ReferralCode(
                code=code, user_id=user_id, expires_at=expires_at, used=False
            )

            db.session.add(referral)
            db.session.commit()

            return code, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error generating referral code: {str(e)}")
            return None, "Failed to generate referral code"

    def _generate_unique_code(self, length: int = 10, prefix: str = "") -> str:
        """
        Generate a unique code
        
        Args:
            length: Length of random part (default: 10, max: 10)
            prefix: Optional prefix (e.g., "REF")
        
        Returns:
            Code with format: prefix + random_part (total max 10 characters)
        """

        if prefix:

            max_random_length = 10 - len(prefix)
            length = min(length, max_random_length)
        else:

            length = min(length, 10)
        
        while True:
            characters = string.ascii_uppercase + string.digits
            code = prefix + "".join(secrets.choice(characters) for _ in range(length))

            if not self._is_code_unique(code):
                continue

            return code

    def _is_code_unique(self, code: str) -> bool:
        """Check if code is unique across all invite and referral codes"""
        invite_exists = ProjectInviteCode.query.filter_by(code=code).first() is not None
        referral_exists = ReferralCode.query.filter_by(code=code).first() is not None
        product_invite_exists = ProductInviteCode.query.filter_by(code=code).first() is not None
        return not (invite_exists or referral_exists or product_invite_exists)

    def validate_invite_code(self, code: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Validate an invite code (checks ProjectInviteCode, ReferralCode, and ProductInviteCode)

        Args:
            code: Invite code to validate

        Returns:
            Tuple of (code_info or None, error_message or None)
        """
        try:

            if not code or not code.strip():
                return None, "Invite code is required"



            code_normalized = re.sub(r'[-_\s]+', '', code.strip().upper())

            if len(code_normalized) < 6:
                return None, "Invite code is too short"

            if len(code_normalized) > 64:
                return None, "Invite code is too long"


            if not re.match(r"^[A-Z0-9]+$", code_normalized):
                return None, "Invite code can only contain letters and numbers"

            code = code_normalized
            code_length = len(code)

            self.logger.debug(f"Validating invite code: '{code}' (length: {code_length})")


            invite = ProjectInviteCode.query.filter_by(code=code).first()
            if not invite:

                invite = ProjectInviteCode.query.filter(func.upper(ProjectInviteCode.code) == code).first()
                if invite:
                    self.logger.debug(f"Found ProjectInviteCode with case-insensitive search: '{invite.code}'")
            
            if invite:
                if invite.is_expired or (invite.expires_at and invite.expires_at < datetime.utcnow()):
                    return None, "Invite code has expired"

                if invite.is_used:
                    return None, "Invite code has already been used"

                return {
                    "code": invite.code,
                    "project_id": invite.project_id,
                    "expires_at": invite.expires_at.isoformat() if invite.expires_at else None,
                    "max_uses": 1,
                    "used_count": 1 if invite.is_used else 0,
                    "created_by": invite.created_by,
                    "code_type": "project_invite",
                }, None


            if code_length <= 32:
                referral = ReferralCode.query.filter_by(code=code).first()
                if not referral:

                    referral = ReferralCode.query.filter(func.upper(ReferralCode.code) == code).first()
                    if referral:
                        self.logger.debug(f"Found ReferralCode with case-insensitive search: '{referral.code}'")
                
                if referral:
                    if referral.expires_at and referral.expires_at < datetime.utcnow():
                        return None, "Invite code has expired"

                    if referral.used:
                        return None, "Invite code has already been used"

                    return {
                        "code": referral.code,
                        "project_id": referral.project_id,
                        "expires_at": referral.expires_at.isoformat() if referral.expires_at else None,
                        "max_uses": 1,
                        "used_count": 1 if referral.used else 0,
                        "created_by": referral.created_by,
                        "code_type": "referral",
                        "token_balance": referral.token_balance,
                        "work_duration_days": referral.work_duration_days,
                        "product_ids": referral.product_ids_list,
                        "rbac_role_ids": referral.rbac_role_ids if referral.rbac_role_ids else [],
                    }, None


            if code_length <= 32:
                product_invite = ProductInviteCode.query.filter_by(code=code).first()
                if not product_invite:

                    product_invite = ProductInviteCode.query.filter(func.upper(ProductInviteCode.code) == code).first()
                    if product_invite:
                        self.logger.debug(f"Found ProductInviteCode with case-insensitive search: '{product_invite.code}'")
                
                if product_invite:
                    if not product_invite.is_active or (product_invite.expires_at and product_invite.expires_at < datetime.utcnow()):
                        return None, "Invite code has expired"

                    if product_invite.current_uses >= product_invite.max_uses:
                        return None, "Invite code has reached maximum uses"

                    return {
                        "code": product_invite.code,
                        "project_id": product_invite.project_id,
                        "product_id": product_invite.product_id,
                        "expires_at": product_invite.expires_at.isoformat() if product_invite.expires_at else None,
                        "max_uses": product_invite.max_uses,
                        "used_count": product_invite.current_uses,
                        "created_by": product_invite.created_by,
                        "code_type": "product_invite",
                        "assigned_role": product_invite.assigned_role,
                    }, None


            searched_tables = ["ProjectInviteCode"]
            if code_length <= 32:
                searched_tables.extend(["ReferralCode", "ProductInviteCode"])
            self.logger.warning(
                f"Invite code not found: '{code}' (length: {code_length}, "
                f"searched in: {', '.join(searched_tables)})"
            )
            return None, "Invalid invite code"

        except Exception as e:
            self.logger.error(f"Error validating invite code: {str(e)}", exc_info=True)
            return None, "Failed to validate invite code"

    def validate_referral_code(self, code: str) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Validate a referral code

        Args:
            code: Referral code to validate

        Returns:
            Tuple of (code_info or None, error_message or None)
        """
        try:
            referral = ReferralCode.query.filter_by(code=code).first()
            if not referral:
                return None, "Invalid referral code"

            if not referral.is_active or referral.expires_at < datetime.utcnow():
                return None, "Referral code has expired"

            return {
                "code": referral.code,
                "user_id": referral.user_id,
                "expires_at": referral.expires_at.isoformat(),
                "referral_count": referral.referral_count,
            }, None

        except Exception as e:
            self.logger.error(f"Error validating referral code: {str(e)}")
            return None, "Failed to validate referral code"

    def use_invite_code(self, code: str, user_id: int) -> Tuple[bool, Optional[str]]:
        """
        Mark an invite code as used

        Args:
            code: Invite code
            user_id: User ID who used the code

        Returns:
            Tuple of (success, error_message)
        """
        try:
            invite = ProjectInviteCode.query.filter_by(code=code).first()
            if not invite:
                return False, "Invalid invite code"

            invite.is_used = True
            invite.used_at = datetime.utcnow()

            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error using invite code: {str(e)}")
            return False, "Failed to use invite code"

    def use_referral_code(self, code: str, new_user_id: int) -> Tuple[bool, Optional[str]]:
        """
        Record referral code usage

        Args:
            code: Referral code
            new_user_id: User ID of the new user

        Returns:
            Tuple of (success, error_message)
        """
        try:
            referral = ReferralCode.query.filter_by(code=code).first()
            if not referral:
                return False, "Invalid referral code"

            referral.referral_count += 1
            referral.last_referral_at = datetime.utcnow()

            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error using referral code: {str(e)}")
            return False, "Failed to use referral code"

    def get_user_invite_codes(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all invite codes created by a user

        Args:
            user_id: User ID

        Returns:
            List of invite code dictionaries
        """
        try:
            invites = ProjectInviteCode.query.filter_by(created_by=user_id).all()
            return [
                {
                    "id": invite.id,
                    "code": invite.code,
                    "project_id": invite.project_id,
                    "expires_at": invite.expires_at.isoformat(),
                    "max_uses": invite.max_uses,
                    "used_count": invite.used_count,
                    "is_used": invite.is_used,
                    "is_expired": invite.is_expired,
                    "created_at": invite.created_at.isoformat(),
                }
                for invite in invites
            ]
        except Exception as e:
            self.logger.error(f"Error getting user invite codes: {str(e)}")
            return []

    def get_user_referral_codes(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all referral codes for a user

        Args:
            user_id: User ID

        Returns:
            List of referral code dictionaries
        """
        try:
            referrals = ReferralCode.query.filter_by(user_id=user_id).all()
            return [
                {
                    "id": referral.id,
                    "code": referral.code,
                    "expires_at": referral.expires_at.isoformat(),
                    "referral_count": referral.referral_count,
                    "is_active": referral.is_active,
                    "created_at": referral.created_at.isoformat(),
                    "last_referral_at": (
                        referral.last_referral_at.isoformat() if referral.last_referral_at else None
                    ),
                }
                for referral in referrals
            ]
        except Exception as e:
            self.logger.error(f"Error getting user referral codes: {str(e)}")
            return []

    def update_invite_duration(self, code: str, duration_days: int) -> Tuple[bool, Optional[str]]:
        """
        Update invite code duration

        Args:
            code: Invite code
            duration_days: New duration in days

        Returns:
            Tuple of (success, error_message)
        """
        try:
            invite = ProjectInviteCode.query.filter_by(code=code).first()
            if not invite:
                return False, "Invite code not found"

            if invite.is_used:
                return False, "Cannot update used invite code"

            new_expiry = datetime.utcnow() + timedelta(days=duration_days)
            invite.expires_at = new_expiry

            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating invite duration: {str(e)}")
            return False, "Failed to update invite duration"

    def cleanup_expired_codes(self) -> Tuple[int, int]:
        """
        Clean up expired invite and referral codes

        Returns:
            Tuple of (cleaned_invites, cleaned_referrals)
        """
        try:

            expired_invites = ProjectInviteCode.query.filter(
                ProjectInviteCode.expires_at < datetime.utcnow(), ProjectInviteCode.is_used == False
            ).all()

            for invite in expired_invites:
                invite.is_expired = True

            expired_referrals = ReferralCode.query.filter(
                ReferralCode.expires_at < datetime.utcnow(), ReferralCode.used == False
            ).all()

            for referral in expired_referrals:
                referral.used = True

            db.session.commit()

            return len(expired_invites), len(expired_referrals)

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error cleaning up expired codes: {str(e)}")
            return 0, 0

    def delete_unused_codes(self, user_id: int) -> Tuple[int, int]:
        """
        Delete unused invite and referral codes for a user

        Args:
            user_id: User ID

        Returns:
            Tuple of (deleted_invites, deleted_referrals)
        """
        try:

            unused_invites = ProjectInviteCode.query.filter(
                ProjectInviteCode.created_by == user_id,
                ProjectInviteCode.is_used == False,
                ProjectInviteCode.is_expired == True,
            ).all()

            deleted_invites = 0
            for invite in unused_invites:
                db.session.delete(invite)
                deleted_invites += 1

            expired_referrals = ReferralCode.query.filter(
                ReferralCode.user_id == user_id, ReferralCode.used == True
            ).all()

            deleted_referrals = 0
            for referral in expired_referrals:
                db.session.delete(referral)
                deleted_referrals += 1

            db.session.commit()

            return deleted_invites, deleted_referrals

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting unused codes: {str(e)}")
            return 0, 0

