"""
Validation utilities for input data validation
"""

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from flask import current_app

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Custom validation error"""

    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(message)


class AuthValidator:
    """Validator for authentication-related data"""

    @staticmethod
    def validate_username(username: str) -> Tuple[bool, Optional[str]]:
        """
        Validate username

        Args:
            username: Username to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not username:
            return False, "Username is required"

        if len(username) < 3:
            return False, "Username must be at least 3 characters long"

        if len(username) > 50:
            return False, "Username must be no more than 50 characters long"

        # Check for valid characters (alphanumeric, underscore, hyphen)
        if not re.match(r"^[a-zA-Z0-9_-]+$", username):
            return False, "Username can only contain letters, numbers, underscores, and hyphens"

        return True, None

    @staticmethod
    def validate_email(email: str) -> Tuple[bool, Optional[str]]:
        """
        Validate email address

        Args:
            email: Email to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not email:
            return False, "Email is required"

        email = email.strip().lower()

        if len(email) > 254:
            return False, "Email is too long"

        # Basic email regex
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, email):
            return False, "Invalid email format"

        return True, None

    @staticmethod
    def validate_password(
        password: str, min_length: int = 6, complexity_required: bool = False
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate password with configurable complexity requirements

        Args:
            password: Password to validate
            min_length: Minimum password length
            complexity_required: Whether to enforce complex password rules

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not password:
            return False, "Password is required"

        if len(password) < min_length:
            return False, f"Password must be at least {min_length} characters long"

        if len(password) > 128:
            return False, "Password is too long"

        # Basic validation - at least one letter and one number
        if not re.search(r"[A-Za-z]", password):
            return False, "Password must contain at least one letter"

        if not re.search(r"[0-9]", password):
            return False, "Password must contain at least one number"

        # Complex password validation if required
        if complexity_required:
            if not re.search(r"[A-Z]", password):
                return False, "Password must contain at least one uppercase letter"

            if not re.search(r"[a-z]", password):
                return False, "Password must contain at least one lowercase letter"

            if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
                return False, "Password must contain at least one special character"

        return True, None

    @staticmethod
    def validate_login_data(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate login request data

        Args:
            data: Login data dictionary

        Returns:
            Tuple of (is_valid, error_message, validated_data)
        """
        try:
            validated_data = {}

            # Check for simple login (username/password)
            if "username" in data and "password" in data:
                username = data.get("username", "").strip()
                password = data.get("password", "")

                if not username:
                    return False, "Username is required", None

                if not password:
                    return False, "Password is required", None

                validated_data = {
                    "username": username,
                    "password": password,
                    "login_type": "simple",
                }

                return True, None, validated_data

            return False, "Invalid login data format", None

        except Exception as e:
            logger.error(f"Error validating login data: {str(e)}")
            return False, "Invalid request data", None


class UserValidator:
    """Validator for user-related data"""

    @staticmethod
    def validate_profile_data(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate user profile update data

        Args:
            data: Profile data dictionary

        Returns:
            Tuple of (is_valid, error_message, validated_data)
        """
        try:
            validated_data = {}

            # Validate username if provided
            if "username" in data and data["username"]:
                is_valid, error = AuthValidator.validate_username(data["username"])
                if not is_valid:
                    return False, error, None
                validated_data["username"] = data["username"].strip()

            # Validate email if provided
            if "email" in data and data["email"]:
                is_valid, error = AuthValidator.validate_email(data["email"])
                if not is_valid:
                    return False, error, None
                validated_data["email"] = data["email"].strip().lower()

            # Validate optional fields
            if "first_name" in data:
                first_name = data["first_name"]
                if first_name and len(first_name) > 100:
                    return False, "First name is too long", None
                validated_data["first_name"] = first_name.strip() if first_name else None

            if "last_name" in data:
                last_name = data["last_name"]
                if last_name and len(last_name) > 100:
                    return False, "Last name is too long", None
                validated_data["last_name"] = last_name.strip() if last_name else None

            if "phone" in data:
                phone = data["phone"]
                if phone:
                    # Basic phone validation
                    phone_clean = re.sub(r"[^\d+]", "", phone)
                    if len(phone_clean) < 10 or len(phone_clean) > 15:
                        return False, "Invalid phone number format", None
                validated_data["phone"] = phone.strip() if phone else None

            if "timezone" in data:
                timezone = data["timezone"]
                if timezone and len(timezone) > 50:
                    return False, "Timezone is too long", None
                validated_data["timezone"] = timezone.strip() if timezone else None

            return True, None, validated_data

        except Exception as e:
            logger.error(f"Error validating profile data: {str(e)}")
            return False, "Invalid profile data", None

    @staticmethod
    def validate_password_change_data(
        data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate password change data

        Args:
            data: Password change data dictionary

        Returns:
            Tuple of (is_valid, error_message, validated_data)
        """
        try:
            current_password = data.get("current_password", "")
            new_password = data.get("new_password", "")

            if not current_password:
                return False, "Current password is required", None

            if not new_password:
                return False, "New password is required", None

            # Validate new password
            is_valid, error = AuthValidator.validate_password(new_password)
            if not is_valid:
                return False, error, None

            return True, None, {"current_password": current_password, "new_password": new_password}

        except Exception as e:
            logger.error(f"Error validating password change data: {str(e)}")
            return False, "Invalid password change data", None


class InviteValidator:
    """Validator for invitation-related data"""

    @staticmethod
    def validate_invite_code(code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate invite code format

        Args:
            code: Invite code to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not code:
            return False, "Invite code is required"

        code = code.strip().upper()

        if len(code) < 6:
            return False, "Invite code is too short"

        if len(code) > 20:
            return False, "Invite code is too long"

        # Check for valid characters (alphanumeric)
        if not re.match(r"^[A-Z0-9]+$", code):
            return False, "Invite code can only contain letters and numbers"

        return True, None

    @staticmethod
    def validate_referral_code(code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate referral code format

        Args:
            code: Referral code to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not code:
            return False, "Referral code is required"

        code = code.strip().upper()

        if len(code) < 6:
            return False, "Referral code is too short"

        if len(code) > 20:
            return False, "Referral code is too long"

        # Check for valid characters (alphanumeric)
        if not re.match(r"^[A-Z0-9]+$", code):
            return False, "Referral code can only contain letters and numbers"

        return True, None

    @staticmethod
    def validate_invite_generation_data(
        data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate invite code generation data

        Args:
            data: Invite generation data dictionary

        Returns:
            Tuple of (is_valid, error_message, validated_data)
        """
        try:
            validated_data = {}

            # Validate duration if provided
            if "duration_days" in data and data["duration_days"]:
                try:
                    duration = int(data["duration_days"])
                    if duration < 1 or duration > 365:
                        return False, "Duration must be between 1 and 365 days", None
                    validated_data["duration_days"] = duration
                except (ValueError, TypeError):
                    return False, "Invalid duration format", None

            # Validate max uses if provided
            if "max_uses" in data and data["max_uses"]:
                try:
                    max_uses = int(data["max_uses"])
                    if max_uses < 1 or max_uses > 1000:
                        return False, "Max uses must be between 1 and 1000", None
                    validated_data["max_uses"] = max_uses
                except (ValueError, TypeError):
                    return False, "Invalid max uses format", None

            return True, None, validated_data

        except Exception as e:
            logger.error(f"Error validating invite generation data: {str(e)}")
            return False, "Invalid invite generation data", None


class AdminValidator:
    """Validator for admin operations"""

    @staticmethod
    def validate_project_suspension_data(
        data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate project suspension data

        Args:
            data: Suspension data dictionary

        Returns:
            Tuple of (is_valid, error_message, validated_data)
        """
        try:
            reason = data.get("reason", "").strip()

            if reason and len(reason) > 500:
                return False, "Suspension reason is too long", None

            return True, None, {"reason": reason}

        except Exception as e:
            logger.error(f"Error validating project suspension data: {str(e)}")
            return False, "Invalid suspension data", None

    @staticmethod
    def validate_project_reactivation_data(
        data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Validate project reactivation data

        Args:
            data: Reactivation data dictionary

        Returns:
            Tuple of (is_valid, error_message, validated_data)
        """
        try:
            validated_data = {}

            # Validate new expiry date if provided
            if "new_expiry_date" in data and data["new_expiry_date"]:
                try:
                    expiry_date = datetime.fromisoformat(
                        data["new_expiry_date"].replace("Z", "+00:00")
                    )
                    if expiry_date <= datetime.utcnow():
                        return False, "New expiry date must be in the future", None
                    validated_data["new_expiry_date"] = expiry_date
                except ValueError:
                    return False, "Invalid date format", None

            return True, None, validated_data

        except Exception as e:
            logger.error(f"Error validating project reactivation data: {str(e)}")
            return False, "Invalid reactivation data", None


def validate_request_data(
    validator_class, method_name: str, data: Dict[str, Any]
) -> Tuple[bool, Optional[str], Optional[Dict]]:
    """
    Generic function to validate request data using a validator class

    Args:
        validator_class: Validator class to use
        method_name: Method name to call on the validator
        data: Data to validate

    Returns:
        Tuple of (is_valid, error_message, validated_data)
    """
    try:
        validator = validator_class()
        method = getattr(validator, method_name)
        return method(data)
    except AttributeError:
        logger.error(f"Validator method {method_name} not found in {validator_class.__name__}")
        return False, "Validation error", None
    except Exception as e:
        logger.error(f"Error in validation: {str(e)}")
        return False, "Validation failed", None
