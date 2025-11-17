"""
User Service
Facade service that delegates to specialized user services for backward compatibility
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ...models.core import User
from .user_profile_service import user_profile_service
from .user_management_service import user_management_service


class UserService:
    """Service for handling user management operations - delegates to specialized services"""

    def __init__(self, logger=None, upload_folder=None):
        self.logger = logger or logging.getLogger(__name__)
        self.upload_folder = upload_folder or "uploads"
        # Delegate to specialized services
        self.profile_service = user_profile_service
        self.management_service = user_management_service

    def create_user(
        self,
        username: str,
        email: Optional[str],
        password: str,
        project_id: Optional[int] = None,
        role: str = "user",
    ) -> Tuple[Optional[User], Optional[str]]:
        """Delegates to UserManagementService"""
        return self.management_service.create_user(
            username=username,
            email=email,
            password=password,
            project_id=project_id,
            role=role,
        )

    def update_user_profile(self, user: User, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Delegates to UserProfileService"""
        return self.profile_service.update_user_profile(user, data)

    def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> Tuple[bool, Optional[str]]:
        """Delegates to UserProfileService"""
        return self.profile_service.change_password(user, current_password, new_password)

    def upload_avatar(self, user: User, file) -> Tuple[bool, Optional[str], Optional[str]]:
        """Delegates to UserProfileService"""
        return self.profile_service.upload_avatar(user, file)

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Delegates to UserManagementService"""
        return self.management_service.get_user_by_id(user_id)

    def get_user_profile(self, user: User) -> Dict[str, Any]:
        """Delegates to UserProfileService"""
        return self.profile_service.get_user_profile(user)

    def get_user_dashboard_data(self, user: User) -> Dict[str, Any]:
        """Delegates to UserProfileService"""
        return self.profile_service.get_user_dashboard_data(user)

    def update_user_expiry(self, user_id: int, expiry_date: datetime) -> Tuple[bool, Optional[str]]:
        """Delegates to UserManagementService"""
        return self.management_service.update_user_expiry(user_id, expiry_date)

    def get_users_with_key_counts(
        self,
        current_user: User,
        page: int = 1,
        per_page: int = 20,
        role_filter: Optional[str] = None,
        roles_filter: Optional[List[str]] = None,
        search: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Delegates to UserManagementService"""
        return self.management_service.get_users_with_key_counts(
            current_user=current_user,
            page=page,
            per_page=per_page,
            role_filter=role_filter,
            roles_filter=roles_filter,
            search=search,
            project_id=project_id,
        )

    def create_user_with_roles_and_games(
        self, current_user: User, data: Dict[str, Any]
    ) -> Tuple[Optional[User], Optional[str]]:
        """Delegates to UserManagementService"""
        return self.management_service.create_user_with_roles_and_games(current_user, data)

    def delete_user_safely(
        self, current_user: User, target_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """Delegates to UserManagementService"""
        return self.management_service.delete_user_safely(current_user, target_user_id)


# Create service instance
user_service = UserService()
