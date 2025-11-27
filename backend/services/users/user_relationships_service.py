"""
User Relationships Service
Provides access to User relationships without using direct backrefs

This service is part of the God Objects refactoring effort.
Instead of accessing user.activities, user.product_permissions, etc. directly,
use this service to get related entities.

Benefits:
- Reduces coupling to User model
- Makes dependencies explicit
- Easier to test and mock
- Can add caching/optimization later
"""

import logging
from typing import List, Optional

from ...core.extensions import db
from ...models.core import (
    APIKey,
    DeveloperProductPermission,
    SystemBackup,
    User,
    UserActivity,
    UserActionLog,
    UserProductPermission,
)
from ...models.keys import Key
from ...models.project_user import ProjectAdmin, ProjectUserRole
from ...models.rbac import UserRole
from ...utils.structured_logging import get_logger


class UserRelationshipsService:
    """
    Service for accessing User relationships
    
    Single Responsibility: Provide access to entities related to a User
    without exposing direct backrefs from the User model.
    """

    def __init__(self, logger=None):
        self.logger = logger or get_logger("user_relationships_service")

    def get_activities(self, user_id: int, limit: Optional[int] = None) -> List[UserActivity]:
        """
        Get user activities
        
        Args:
            user_id: User ID
            limit: Optional limit on number of activities
            
        Returns:
            List of UserActivity objects
        """
        try:
            query = UserActivity.query.filter_by(user_id=user_id).order_by(
                UserActivity.created_at.desc()
            )
            if limit:
                query = query.limit(limit)
            return query.all()
        except Exception as e:
            self.logger.error(f"Error getting activities for user {user_id}: {e}")
            return []

    def get_action_logs(self, user_id: int, limit: Optional[int] = None) -> List[UserActionLog]:
        """
        Get user action logs
        
        Args:
            user_id: User ID
            limit: Optional limit on number of logs
            
        Returns:
            List of UserActionLog objects
        """
        try:
            query = UserActionLog.query.filter_by(user_id=user_id).order_by(
                UserActionLog.created_at.desc()
            )
            if limit:
                query = query.limit(limit)
            return query.all()
        except Exception as e:
            self.logger.error(f"Error getting action logs for user {user_id}: {e}")
            return []

    def get_product_permissions(self, user_id: int) -> List[UserProductPermission]:
        """
        Get user product permissions
        
        Args:
            user_id: User ID
            
        Returns:
            List of UserProductPermission objects
        """
        try:
            return UserProductPermission.query.filter_by(user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting product permissions for user {user_id}: {e}")
            return []

    def get_developer_product_permissions(
        self, user_id: int
    ) -> List[DeveloperProductPermission]:
        """
        Get user developer product permissions
        
        Args:
            user_id: User ID
            
        Returns:
            List of DeveloperProductPermission objects
        """
        try:
            return DeveloperProductPermission.query.filter_by(user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting developer product permissions for user {user_id}: {e}")
            return []

    def get_keys(self, user_id: int) -> List[Key]:
        """
        Get user keys
        
        Args:
            user_id: User ID
            
        Returns:
            List of Key objects
        """
        try:
            return Key.query.filter_by(user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting keys for user {user_id}: {e}")
            return []

    def get_key_count(self, user_id: int) -> int:
        """
        Get count of keys for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Number of keys
        """
        try:
            return Key.query.filter_by(user_id=user_id).count()
        except Exception as e:
            self.logger.error(f"Error getting key count for user {user_id}: {e}")
            return 0

    def get_roles(self, user_id: int) -> List[UserRole]:
        """
        Get user roles
        
        Args:
            user_id: User ID
            
        Returns:
            List of UserRole objects
        """
        try:
            return UserRole.query.filter_by(user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting roles for user {user_id}: {e}")
            return []

    def get_project_roles(self, user_id: int) -> List[ProjectUserRole]:
        """
        Get user project roles
        
        Args:
            user_id: User ID
            
        Returns:
            List of ProjectUserRole objects
        """
        try:
            return ProjectUserRole.query.filter_by(user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting project roles for user {user_id}: {e}")
            return []

    def get_administered_projects(self, user_id: int) -> List[ProjectAdmin]:
        """
        Get projects where user is admin
        
        Args:
            user_id: User ID
            
        Returns:
            List of ProjectAdmin objects
        """
        try:
            return ProjectAdmin.query.filter_by(admin_user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting administered projects for user {user_id}: {e}")
            return []

    def get_created_api_keys(self, user_id: int) -> List[APIKey]:
        """
        Get API keys created by user
        
        Args:
            user_id: User ID
            
        Returns:
            List of APIKey objects
        """
        try:
            return APIKey.query.filter_by(created_by=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting created API keys for user {user_id}: {e}")
            return []

    def get_created_backups(self, user_id: int) -> List[SystemBackup]:
        """
        Get backups created by user
        
        Args:
            user_id: User ID
            
        Returns:
            List of SystemBackup objects
        """
        try:
            return SystemBackup.query.filter_by(created_by=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting created backups for user {user_id}: {e}")
            return []


# Singleton instance
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   user_relationships_service = get_service('user_relationships_service')

