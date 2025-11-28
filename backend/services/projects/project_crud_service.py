"""
Project CRUD Service
Handles basic CRUD operations for projects

Single Responsibility: Project creation, update, and deletion
Extracted from ProjectService to follow SRP (Single Responsibility Principle)
"""

import logging
from typing import Any, Dict, Optional

from ...core.extensions import db
from ...models.core import (
    Project,
    User,
    ProjectAppearanceSettings,
    ProjectBackupSettings,
    ProjectChatSettings,
    ProjectEncryptionKeys,
    ProjectEncryptionSettings,
    ProjectInviteSettings,
    ProjectOfflineAuthSettings,
    ProjectSecuritySettings,
    ProjectSystemSettings,
    ProjectSettings,
)
from ...utils.service_exceptions import ValidationError, NotFoundError, ConflictError, ServiceError

# Type hints for dependencies (imported here to avoid circular imports)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.activity.activity_service import ActivityService
    from ...services.security.security_rules_init import SecurityRulesInitService

class ProjectCRUDService:
    """
    Service for handling project CRUD operations.
    
    Single Responsibility: Create, update, and delete projects.
    """

    def __init__(
        self,
        activity_service: 'ActivityService' = None,
        security_rules_init_service: 'SecurityRulesInitService' = None,
        logger=None
    ):
        """
        Initialize ProjectCRUDService with explicit dependencies.
        
        Args:
            activity_service: Service for logging activities
            security_rules_init_service: Service for initializing security rules
            logger: Optional logger instance
        """
        self.logger = logger or logging.getLogger(__name__)
        
        # Store dependencies explicitly
        self._activity_service = activity_service
        self._security_rules_init_service = security_rules_init_service
    
    def _get_activity_service(self):
        """Get activity service (lazy loading for backward compatibility)"""
        if self._activity_service is None:
            from ...utils.service_helpers import get_service
            self._activity_service = get_service('activity_service')
        return self._activity_service
    
    def _get_security_rules_init_service(self):
        """Get security rules init service (lazy loading for backward compatibility)"""
        if self._security_rules_init_service is None:
            from ...utils.service_helpers import get_service
            self._security_rules_init_service = get_service('security_rules_init_service')
        return self._security_rules_init_service
    
    def _get_tier_limits_service(self):
        """Get tier limits service (lazy loading for backward compatibility)"""
        from ...utils.service_helpers import get_service
        return get_service('tier_limits_service')

    def _find_project_by_id_or_unique_id(self, project_identifier):
        """
        Helper function to find a project by either id (int) or unique_id (string)
        
        Args:
            project_identifier: Either an integer id or string unique_id
            
        Returns:
            Project object or None if not found
        """
        # Try as integer id (primary key) first
        if isinstance(project_identifier, int) or (isinstance(project_identifier, str) and project_identifier.isdigit()):
            try:
                project_id_int = int(project_identifier)
                project = Project.query.get(project_id_int)
                if project:
                    return project
            except (ValueError, TypeError):
                pass
        
        # Try as unique_id (string)
        project = Project.query.filter_by(unique_id=str(project_identifier)).first()
        return project

    def create_project(
        self, user_id: int, name: str, description: str = "", ip_address: str = None, user_agent: str = None, subscription_status: str = "free"
    ) -> Project:
        """
        Create a new project with all business logic

        Args:
            user_id: ID of the user creating the project
            name: Project name
            description: Project description
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging
            subscription_status: Subscription tier ("free" or "pro"), defaults to "free"

        Returns:
            Project object

        Raises:
            NotFoundError: If user not found
            ValidationError: If project name is invalid
            ConflictError: If project with this name already exists
            ServiceError: If database operation fails
        """
        try:
            from datetime import datetime, timedelta

            user = User.query.get(user_id)
            if not user:
                raise NotFoundError("User", resource_id=str(user_id))

            name = name.strip()
            if not name:
                raise ValidationError("Project name is required", field="name")

            existing_project = Project.query.filter_by(name=name).first()
            if existing_project:
                raise ConflictError("Project with this name already exists", resource_type="project")

            # Set storage limit based on tier
            if subscription_status == "free":
                storage_limit_bytes = 500 * (1024 ** 2)  # 500 MB for free tier
                subscription_expires_at = None  # Free tier doesn't expire
            else:
                # Pro tier - default 10 GB (or use project's default)
                storage_limit_bytes = 10 * (1024 ** 3)  # 10 GB for pro tier
                subscription_expires_at = datetime.utcnow() + timedelta(days=30)  # 30 days trial for pro
            
            project = Project(
                name=name,
                description=description.strip(),
                admin_id=user.id,
                status="active",
                subscription_status=subscription_status,
                subscription_expires_at=subscription_expires_at,
                storage_limit=storage_limit_bytes,
            )

            db.session.add(project)
            db.session.flush()
            
            # Enforce storage limit for free tier only (double-check)
            if subscription_status == "free":
                try:
                    tier_limits_service = self._get_tier_limits_service()
                    tier_limits_service.enforce_storage_limit(project)
                except Exception as e:
                    self.logger.warning(f"Failed to enforce storage limit for project {project.id}: {e}")
            
            db.session.commit()

            try:
                activity_service = self._get_activity_service()
                activity_service.log_activity(
                    user,
                    "project_created",
                    ip=ip_address,
                    details=f"Created project: {name}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project creation activity: {e}")

            # Initialize default security rules for the project
            try:
                security_rules_init_service = self._get_security_rules_init_service()
                security_rules_init_service.initialize_default_rules(project.id, user_id)
                self.logger.info(f"Initialized default security rules for project {project.id}")
            except Exception as e:
                self.logger.warning(f"Failed to initialize security rules for project {project.id}: {e}")

            # Note: Cache invalidation should be handled by ProjectCacheService
            # This keeps CRUD service focused on database operations only

            return project

        except (NotFoundError, ValidationError, ConflictError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating project: {str(e)}", exc_info=True)
            raise ServiceError("Failed to create project", status_code=500) from e

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
        Update project with all business logic

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

        Raises:
            NotFoundError: If project or user not found
            ValidationError: If update data is invalid
            ServiceError: If database operation fails
        """
        try:
            from ...utils.rbac_utils import RBACManager
            from ...utils.role_constants import UserRoles

            project = self._find_project_by_id_or_unique_id(project_id)
            if not project:
                raise NotFoundError("Project", resource_id=str(project_id))

            user = User.query.get(user_id)
            if not user:
                raise NotFoundError("User", resource_id=str(user_id))

            # Check permissions
            is_owner = RBACManager.is_owner(user)
            can_edit = is_owner or (user.project_id == project.id and RBACManager.has_permission(user.id, project.id, "projects.edit"))

            if not can_edit:
                raise ServiceError("Permission denied", status_code=403)

            # Update fields
            if name is not None:
                name = name.strip()
                if not name:
                    raise ValidationError("Project name cannot be empty", field="name")
                # Check for conflicts (excluding current project)
                existing = Project.query.filter(Project.name == name, Project.id != project.id).first()
                if existing:
                    raise ConflictError("Project with this name already exists", resource_type="project")
                project.name = name

            if description is not None:
                project.description = description.strip()

            if status is not None:
                allowed_statuses = ["active", "inactive", "suspended", "archived"]
                if status not in allowed_statuses:
                    raise ValidationError(f"Status must be one of: {', '.join(allowed_statuses)}", field="status")
                project.status = status

            if subscription_status is not None:
                allowed_subscription_statuses = ["trial", "active", "expired", "cancelled"]
                if subscription_status not in allowed_subscription_statuses:
                    raise ValidationError(
                        f"Subscription status must be one of: {', '.join(allowed_subscription_statuses)}",
                        field="subscription_status"
                    )
                project.subscription_status = subscription_status

            if storage_limit_gb is not None:
                if storage_limit_gb < 0:
                    raise ValidationError("Storage limit cannot be negative", field="storage_limit_gb")
                # Convert GB to bytes for storage_limit field
                project.storage_limit = int(storage_limit_gb * (1024**3))
                project.storage_limit_gb = storage_limit_gb

            db.session.commit()

            try:
                activity_service = self._get_activity_service()
                activity_service.log_activity(
                    user,
                    "project_updated",
                    ip=ip_address,
                    details=f"Updated project: {project.name}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project update activity: {e}")

            return {
                "id": project.unique_id,
                "name": project.name,
                "description": project.description,
                "status": project.status,
                "subscription_status": project.subscription_status,
                "storage_limit_gb": project.storage_limit_gb,
            }

        except (NotFoundError, ValidationError, ConflictError, ServiceError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating project: {str(e)}", exc_info=True)
            raise ServiceError("Failed to update project", status_code=500) from e

    def delete_project(
        self, project_id, user_id: int, ip_address: str = None, user_agent: str = None
    ) -> Dict[str, Any]:
        """
        Delete a project with all business logic

        Args:
            project_id: ID or unique_id of the project to delete (can be int or string)
            user_id: ID of the user deleting the project
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with deletion result

        Raises:
            NotFoundError: If project or user not found
            ServiceError: If database operation fails
        """
        try:
            from ...utils.rbac_utils import RBACManager

            project = self._find_project_by_id_or_unique_id(project_id)
            if not project:
                raise NotFoundError("Project", resource_id=str(project_id))

            user = User.query.get(user_id)
            if not user:
                raise NotFoundError("User", resource_id=str(user_id))

            # Check permissions - only owners can delete projects
            is_owner = RBACManager.is_owner(user)
            if not is_owner:
                raise ServiceError("Only owners can delete projects", status_code=403)

            project_name = project.name
            project_id_int = project.id

            # Delete related data (cascade will handle most, but we log activity first)
            try:
                activity_service = self._get_activity_service()
                activity_service.log_activity(
                    user,
                    "project_deleted",
                    ip=ip_address,
                    details=f"Deleted project: {project_name}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project deletion activity: {e}")

            # Explicitly delete all related settings and encryption keys to avoid SQLAlchemy trying to set project_id to None
            # This prevents IntegrityError when project_id has NOT NULL constraint
            # SQLAlchemy may try to update these records before cascade deletion, which fails with NOT NULL
            settings_models = [
                ProjectAppearanceSettings,
                ProjectBackupSettings,
                ProjectChatSettings,
                ProjectEncryptionSettings,
                ProjectEncryptionKeys,  # Must be deleted explicitly to avoid NOT NULL constraint violation
                ProjectInviteSettings,
                ProjectOfflineAuthSettings,
                ProjectSecuritySettings,
                ProjectSystemSettings,
                ProjectSettings,  # Deprecated but may still exist
            ]
            
            for settings_model in settings_models:
                settings = settings_model.query.filter_by(project_id=project_id_int).first()
                if settings:
                    db.session.delete(settings)

            db.session.delete(project)
            db.session.commit()

            return {
                "success": True,
                "message": f"Project {project_name} deleted successfully",
                "project_id": project_id_int,
            }

        except (NotFoundError, ServiceError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting project: {str(e)}", exc_info=True)
            raise ServiceError("Failed to delete project", status_code=500) from e


# Singleton instance
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   project_crud_service = get_service('project_crud_service')

# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   project_crud_service = get_service('project_crud_service')