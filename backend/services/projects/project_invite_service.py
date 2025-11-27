"""
Project Invite Service
Handles project invite code management

Single Responsibility: Create, delete, and retrieve project invite codes
Extracted from ProjectService to follow SRP (Single Responsibility Principle)
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import desc

from ...core.extensions import db
from ...models.core import Project, ProjectInviteCode, User
from ...utils.rbac_utils import RBACManager
from ...utils.service_exceptions import NotFoundError, ValidationError, ServiceError


class ProjectInviteService:
    """
    Service for handling project invite code operations.
    
    Single Responsibility: Manage project invite codes (create, delete, retrieve).
    """

    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger(__name__)

    def create_project_invite_code(
        self, user_id: int, project_id: Optional[int] = None, expires_in_days: int = 30
    ) -> Dict[str, Any]:
        """
        Create a new project invite code

        Args:
            user_id: ID of the user creating the invite code
            project_id: ID of the project (optional, uses user's project if not provided)
            expires_in_days: Number of days until expiration (default: 30)

        Returns:
            Dictionary with invite code data or error

        Raises:
            NotFoundError: If user or project not found
            ValidationError: If validation fails
            ServiceError: If database operation fails
        """
        try:
            import secrets

            user = User.query.get(user_id)
            if not user:
                raise NotFoundError("User", resource_id=str(user_id))

            is_owner = RBACManager.is_owner(user)

            # Determine project_id
            if not project_id:
                if is_owner:
                    # Owners can create invite codes for any project (project_id=None means global)
                    project_id = None
                else:
                    if not user.project_id:
                        raise ValidationError("User must be assigned to a project", field="project_id")
                    project_id = user.project_id
            else:
                # Validate project exists
                project = Project.query.get(project_id)
                if not project:
                    raise NotFoundError("Project", resource_id=str(project_id))

                # Check permissions
                if not is_owner and user.project_id != project_id:
                    raise ServiceError("Permission denied", status_code=403)

            # Generate unique invite code
            code = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

            invite_code = ProjectInviteCode(
                code=code,
                project_id=project_id,
                created_by=user_id,
                expires_at=expires_at,
                is_used=False,
            )

            db.session.add(invite_code)
            db.session.commit()

            self.logger.info(f"Created invite code for project {project_id} by user {user_id}")

            return {
                "id": invite_code.id,
                "code": invite_code.code,
                "project_id": invite_code.project_id,
                "created_at": invite_code.created_at.isoformat() if invite_code.created_at else None,
                "expires_at": invite_code.expires_at.isoformat() if invite_code.expires_at else None,
                "is_used": invite_code.is_used,
            }

        except (NotFoundError, ValidationError, ServiceError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating invite code: {str(e)}", exc_info=True)
            raise ServiceError("Failed to create invite code", status_code=500) from e

    def delete_project_invite_code(
        self, invite_code_id: int, user_id: int
    ) -> Dict[str, Any]:
        """
        Delete a project invite code

        Args:
            invite_code_id: ID of the invite code to delete
            user_id: ID of the user deleting the code

        Returns:
            Dictionary with deletion result or error

        Raises:
            NotFoundError: If invite code or user not found
            ServiceError: If database operation fails
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise NotFoundError("User", resource_id=str(user_id))

            invite_code = ProjectInviteCode.query.get(invite_code_id)
            if not invite_code:
                raise NotFoundError("InviteCode", resource_id=str(invite_code_id))

            is_owner = RBACManager.is_owner(user)

            # Check permissions
            if not is_owner:
                if not user.project_id or user.project_id != invite_code.project_id:
                    raise ServiceError("Permission denied", status_code=403)

            db.session.delete(invite_code)
            db.session.commit()

            self.logger.info(f"Deleted invite code {invite_code_id} by user {user_id}")

            return {
                "success": True,
                "message": "Invite code deleted successfully",
                "invite_code_id": invite_code_id,
            }

        except (NotFoundError, ServiceError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting invite code: {str(e)}", exc_info=True)
            raise ServiceError("Failed to delete invite code", status_code=500) from e

    def get_project_invite_codes(self, user_id: int) -> Dict[str, Any]:
        """
        Get all project invite codes for the current user's project

        Args:
            user_id: ID of the user requesting the codes

        Returns:
            Dictionary with list of invite codes or error
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            is_owner = RBACManager.is_owner(user)

            if is_owner:
                # Owners can see all invite codes (including global ones with project_id=None)
                invite_codes = ProjectInviteCode.query.order_by(desc(ProjectInviteCode.created_at)).all()
            else:
                if not user.project_id:
                    return {"error": "User must be assigned to a project"}

                invite_codes = (
                    ProjectInviteCode.query.filter_by(project_id=user.project_id)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .all()
                )

            codes_data = []
            for code in invite_codes:
                codes_data.append(
                    {
                        "id": code.id,
                        "code": code.code,
                        "created_at": code.created_at.isoformat() if code.created_at else None,
                        "expires_at": code.expires_at.isoformat() if code.expires_at else None,
                        "used": code.is_used,
                        "is_expired": code.is_expired
                        or (code.expires_at and code.expires_at < datetime.utcnow()),
                    }
                )

            return {"codes": codes_data}

        except Exception as e:
            self.logger.error(f"Error getting project invite codes: {str(e)}", exc_info=True)
            return {"error": "Failed to retrieve project invite codes"}

    def get_latest_project_invite_code(self, user_id: int) -> Dict[str, Any]:
        """
        Get the latest project invite code for the current user's project

        Args:
            user_id: ID of the user requesting the code

        Returns:
            Dictionary with latest invite code or error
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            is_owner = RBACManager.is_owner(user)

            if user.project_id:
                project_id = user.project_id
                latest_code = (
                    ProjectInviteCode.query.filter_by(project_id=project_id)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .first()
                )
            else:
                # For owners without project_id, get global invite codes
                latest_code = (
                    ProjectInviteCode.query.filter_by(project_id=None)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .first()
                )

            if latest_code:
                code_data = {
                    "id": latest_code.id,
                    "code": latest_code.code,
                    "created_at": (
                        latest_code.created_at.isoformat() if latest_code.created_at else None
                    ),
                    "expires_at": (
                        latest_code.expires_at.isoformat() if latest_code.expires_at else None
                    ),
                    "used": latest_code.is_used,
                    "is_expired": latest_code.is_expired
                    or (latest_code.expires_at and latest_code.expires_at < datetime.utcnow()),
                }
                return {"invite_code": code_data}
            else:
                return {"invite_code": None}

        except Exception as e:
            self.logger.error(f"Error getting latest project invite code: {str(e)}", exc_info=True)
            return {"error": "Failed to retrieve latest project invite code"}


# Singleton instance
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   project_invite_service = get_service('project_invite_service')

