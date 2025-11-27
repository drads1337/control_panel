"""
Project Relationships Service
Provides access to Project relationships without using direct backrefs

This service is part of the God Objects refactoring effort.
Instead of accessing project.users, project.admin_user, etc. directly,
use this service to get related entities.

Benefits:
- Reduces coupling to Project model
- Makes dependencies explicit
- Easier to test and mock
- Can add caching/optimization later
"""

import logging
from typing import List, Optional

from ...core.extensions import db
from ...models.core import Project, ProjectInviteCode, User, UserActivity, UserActionLog
from ...models.project_user import ProjectAdmin, ProjectUserRole
from ...models.rbac import Role
from ...utils.structured_logging import get_logger


class ProjectRelationshipsService:
    """
    Service for accessing Project relationships
    
    Single Responsibility: Provide access to entities related to a Project
    without exposing direct backrefs from the Project model.
    """

    def __init__(self, logger=None):
        self.logger = logger or get_logger("project_relationships_service")

    def get_admin_user(self, project_id: int) -> Optional[User]:
        """
        Get the admin user for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            User object or None if not found
        """
        try:
            admin_record = ProjectAdmin.query.filter_by(project_id=project_id).first()
            if admin_record and admin_record.admin_user_id:
                return User.query.get(admin_record.admin_user_id)
            return None
        except Exception as e:
            self.logger.error(f"Error getting admin user for project {project_id}: {e}")
            return None

    def get_admin_id(self, project_id: int) -> Optional[int]:
        """
        Get admin user ID for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            Admin user ID or None
        """
        try:
            admin_record = ProjectAdmin.query.filter_by(project_id=project_id).first()
            return admin_record.admin_user_id if admin_record else None
        except Exception as e:
            self.logger.error(f"Error getting admin ID for project {project_id}: {e}")
            return None

    def set_admin(self, project_id: int, user_id: int) -> bool:
        """
        Set project admin
        
        Args:
            project_id: Project ID
            user_id: User ID to set as admin
            
        Returns:
            True if successful, False otherwise
        """
        try:
            admin_record = ProjectAdmin.query.filter_by(project_id=project_id).first()
            if not admin_record:
                admin_record = ProjectAdmin(project_id=project_id)
                db.session.add(admin_record)

            admin_record.admin_user_id = user_id
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error setting admin for project {project_id}: {e}")
            return False

    def get_users(self, project_id: int) -> List[User]:
        """
        Get all users for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            List of User objects
        """
        try:
            return User.query.filter_by(project_id=project_id).all()
        except Exception as e:
            self.logger.error(f"Error getting users for project {project_id}: {e}")
            return []

    def get_user_count(self, project_id: int) -> int:
        """
        Get count of users for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            Number of users
        """
        try:
            return User.query.filter_by(project_id=project_id).count()
        except Exception as e:
            self.logger.error(f"Error getting user count for project {project_id}: {e}")
            return 0

    def get_project_user_roles(self, project_id: int) -> List[ProjectUserRole]:
        """
        Get all project-user role relationships for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            List of ProjectUserRole objects
        """
        try:
            return ProjectUserRole.query.filter_by(project_id=project_id).all()
        except Exception as e:
            self.logger.error(f"Error getting project user roles for project {project_id}: {e}")
            return []

    def get_roles(self, project_id: int) -> List[Role]:
        """
        Get all roles for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            List of Role objects
        """
        try:
            return Role.query.filter_by(project_id=project_id).all()
        except Exception as e:
            self.logger.error(f"Error getting roles for project {project_id}: {e}")
            return []

    def get_invite_codes(self, project_id: int) -> List[ProjectInviteCode]:
        """
        Get all invite codes for a project
        
        Args:
            project_id: Project ID
            
        Returns:
            List of ProjectInviteCode objects
        """
        try:
            return ProjectInviteCode.query.filter_by(project_id=project_id).all()
        except Exception as e:
            self.logger.error(f"Error getting invite codes for project {project_id}: {e}")
            return []

    def get_user_activities(
        self, project_id: int, limit: Optional[int] = None
    ) -> List[UserActivity]:
        """
        Get user activities for a project
        
        Args:
            project_id: Project ID
            limit: Optional limit on number of activities
            
        Returns:
            List of UserActivity objects
        """
        try:
            query = UserActivity.query.filter_by(project_id=project_id).order_by(
                UserActivity.created_at.desc()
            )
            if limit:
                query = query.limit(limit)
            return query.all()
        except Exception as e:
            self.logger.error(f"Error getting user activities for project {project_id}: {e}")
            return []

    def get_action_logs(
        self, project_id: int, limit: Optional[int] = None
    ) -> List[UserActionLog]:
        """
        Get action logs for a project
        
        Args:
            project_id: Project ID
            limit: Optional limit on number of logs
            
        Returns:
            List of UserActionLog objects
        """
        try:
            query = UserActionLog.query.filter_by(project_id=project_id).order_by(
                UserActionLog.created_at.desc()
            )
            if limit:
                query = query.limit(limit)
            return query.all()
        except Exception as e:
            self.logger.error(f"Error getting action logs for project {project_id}: {e}")
            return []


# Singleton instance
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   project_relationships_service = get_service('project_relationships_service')

