"""
Project Service
Facade service for project operations - delegates to specialized services

Single Responsibility: Provide unified interface for project operations
This service maintains backward compatibility while delegating to:
- ProjectCRUDService: CRUD operations
- ProjectCacheService: Caching operations
- ProjectInviteService: Invite code management
"""

import logging
from typing import Any, Dict, Optional

from ...models.core import Project
from ...utils.service_helpers import get_service

class ProjectService:
    """
    Facade service for managing project operations.
    
    Single Responsibility: Provide unified interface and maintain backward compatibility.
    Delegates to specialized services following SRP principle.
    """

    def __init__(self, cache_service=None, logger=None):
        self.logger = logger or logging.getLogger(__name__)
        # Store cache_service for backward compatibility, but use specialized services
        self.cache_service = cache_service

    def _find_project_by_id_or_unique_id(self, project_identifier):
        """
        Helper function to find a project by either id (int) or unique_id (string).
        
        Delegates to ProjectCRUDService (SRP principle).
        
        Args:
            project_identifier: Either an integer id or string unique_id
            
        Returns:
            Project object or None if not found
        """
        project_crud_service = get_service('project_crud_service')
        return project_crud_service._find_project_by_id_or_unique_id(project_identifier)

    def get_projects_cached(
        self, user_id: int, page: int = 1, per_page: int = 20, search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get projects with caching support.
        
        Delegates to ProjectCacheService (SRP principle).
        """
        project_cache_service = get_service('project_cache_service')
        return project_cache_service.get_projects_cached(user_id, page, per_page, search)

    def get_project_cached(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """
        Get single project with caching support.
        
        Delegates to ProjectCacheService (SRP principle).
        """
        project_cache_service = get_service('project_cache_service')
        return project_cache_service.get_project_cached(project_id, user_id)

    def get_project_stats_cached(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """
        Get project statistics with caching support.
        
        Delegates to ProjectCacheService (SRP principle).
        """
        project_cache_service = get_service('project_cache_service')
        return project_cache_service.get_project_stats_cached(project_id, user_id)

    def invalidate_project_cache(self, project_id: int) -> bool:
        """
        Invalidate project cache.
        
        Delegates to ProjectCacheService (SRP principle).
        """
        project_cache_service = get_service('project_cache_service')
        return project_cache_service.invalidate_project_cache(project_id)
    def create_project(
        self, user_id: int, name: str, description: str = "", ip_address: str = None, user_agent: str = None
    ) -> Project:
        """
        Create a new project with all business logic.
        
        Delegates to ProjectCRUDService (SRP principle).
        After creation, invalidates cache via ProjectCacheService.

        Args:
            user_id: ID of the user creating the project
            name: Project name
            description: Project description
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Project object

        Raises:
            NotFoundError: If user not found
            ValidationError: If project name is invalid
            ConflictError: If project with this name already exists
            ServiceError: If database operation fails
        """
        project_crud_service = get_service('project_crud_service')
        project = project_crud_service.create_project(user_id, name, description, ip_address, user_agent)
        
        # Invalidate cache after creation
        try:
            project_cache_service = get_service('project_cache_service')
            project_cache_service.invalidate_project_cache(project.id)
        except Exception as e:
            self.logger.warning(f"Failed to invalidate cache after project creation: {e}")
        
        return project

    def update_project(
        self,
        project_id,
        user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        subscription_status: Optional[str] = None,
        storage_limit_gb: Optional[float] = None,
        ip_address: str = None,
        user_agent: str = None,
    ) -> Dict[str, Any]:
        """
        Update project with all business logic.
        
        Delegates to ProjectCRUDService (SRP principle).
        After update, invalidates cache via ProjectCacheService.

        Args:
            project_id: ID or unique_id of the project to update (can be int or string)
            user_id: ID of the user updating the project
            name: New project name (optional)
            description: New project description (optional)
            status: New project status (optional)
            subscription_status: New subscription status (optional)
            storage_limit_gb: New storage limit in GB (optional)
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with updated project data or error
        """
        project_crud_service = get_service('project_crud_service')
        result = project_crud_service.update_project(
            project_id, user_id, name, description, status, subscription_status, storage_limit_gb, ip_address, user_agent
        )
        
        # Invalidate cache after update
        if "error" not in result:
            try:
                project = project_crud_service._find_project_by_id_or_unique_id(project_id)
                if project:
                    project_cache_service = get_service('project_cache_service')
                    project_cache_service.invalidate_project_cache(project.id)
            except Exception as e:
                self.logger.warning(f"Failed to invalidate cache after project update: {e}")
        
        return result

    def delete_project(
        self, project_id, user_id: int, ip_address: str = None, user_agent: str = None
    ) -> Dict[str, Any]:
        """
        Delete project and all related data with all business logic.
        
        Delegates to ProjectCRUDService (SRP principle).
        After deletion, invalidates cache via ProjectCacheService.

        Args:
            project_id: ID or unique_id of the project to delete (can be int or string)
            user_id: ID of the user deleting the project
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with success message or error
        """
        project_crud_service = get_service('project_crud_service')
        result = project_crud_service.delete_project(project_id, user_id, ip_address, user_agent)
        
        # Invalidate cache after deletion
        if "error" not in result:
            try:
                project = project_crud_service._find_project_by_id_or_unique_id(project_id)
                if project:
                    project_cache_service = get_service('project_cache_service')
                    project_cache_service.invalidate_project_cache(project.id)
            except Exception as e:
                self.logger.warning(f"Failed to invalidate cache after project deletion: {e}")
        
        return result

    def create_project_invite_code(
        self,
        user_id: int,
        expires_in_days: int = 7,
        ip_address: str = None,
        user_agent: str = None,
    ) -> Dict[str, Any]:
        """
        Create a new project invite code with all business logic.
        
        Delegates to ProjectInviteService (SRP principle).

        Args:
            user_id: ID of the user creating the invite code
            expires_in_days: Number of days until expiration (default: 7)
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with invite code data or error
        """
        project_invite_service = get_service('project_invite_service')
        return project_invite_service.create_project_invite_code(user_id, None, expires_in_days)

    def delete_project_invite_code(
        self, code_id: int, user_id: int, ip_address: str = None, user_agent: str = None
    ) -> Dict[str, Any]:
        """
        Delete a project invite code with all business logic.
        
        Delegates to ProjectInviteService (SRP principle).

        Args:
            code_id: ID of the invite code to delete
            user_id: ID of the user deleting the code
            ip_address: IP address for activity logging (not used in delegate)
            user_agent: User agent for activity logging (not used in delegate)

        Returns:
            Dictionary with success message or error
        """
        project_invite_service = get_service('project_invite_service')
        return project_invite_service.delete_project_invite_code(code_id, user_id)

    def get_project_invite_codes(self, user_id: int) -> Dict[str, Any]:
        """
        Get all project invite codes for the current user's project.
        
        Delegates to ProjectInviteService (SRP principle).

        Args:
            user_id: ID of the user requesting codes

        Returns:
            Dictionary with list of invite codes or error
        """
        project_invite_service = get_service('project_invite_service')
        return project_invite_service.get_project_invite_codes(user_id)

    def get_latest_project_invite_code(self, user_id: int) -> Dict[str, Any]:
        """
        Get the latest project invite code for the current user's project.
        
        Delegates to ProjectInviteService (SRP principle).

        Args:
            user_id: ID of the user requesting the code

        Returns:
            Dictionary with latest invite code or error
        """
        project_invite_service = get_service('project_invite_service')
        return project_invite_service.get_latest_project_invite_code(user_id)

# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   project_service = get_service('project_service')
