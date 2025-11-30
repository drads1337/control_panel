"""
Admin Service
Handles administrative operations including project management, system maintenance, and cleanup tasks
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from flask import current_app

from ...core.extensions import db
from ...models.core import Project, ProjectInviteCode, User
from ...models.products import Product
from ...models.keys import Key, ReferralCode
from ...models.rbac import Role, UserRole
from ...utils.rbac_utils import RBACManager
from ...utils.service_exceptions import PermissionDeniedError, ServiceError

# Type hints for dependencies (imported here to avoid circular imports)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.activity.activity_service import ActivityService
    from ...services.projects.project_relationships_service import ProjectRelationshipsService

class AdminService:
    """Service for handling administrative operations"""

    def __init__(
        self,
        activity_service: 'ActivityService' = None,
        project_relationships_service: 'ProjectRelationshipsService' = None,
        logger=None
    ):
        """
        Initialize AdminService with explicit dependencies.
        
        Args:
            activity_service: Service for logging activities
            project_relationships_service: Service for project relationships
            logger: Optional logger instance
        """
        self.logger = logger or logging.getLogger(__name__)
        self.grace_period_days = 14
        
        # Store dependencies explicitly
        self._activity_service = activity_service
        self._project_relationships_service = project_relationships_service
    
    def deactivate_expired_projects(self, admin_user: User) -> Tuple[int, int, Optional[str]]:
        """
        Deactivate expired projects and clean up expired invite codes

        Args:
            admin_user: Admin user performing the operation

        Returns:
            Tuple of (deactivated_projects, cleaned_codes, error_message)
        """
        try:

            if not RBACManager.is_owner(admin_user):
                return 0, 0, "Access denied - owner role required"

            expired_projects = Project.query.filter(
                Project.subscription_expires_at < datetime.utcnow(), Project.status == "active"
            ).all()

            deactivated_count = 0
            for project in expired_projects:

                project.status = "expired"
                project.subscription_status = "expired"

                keys = Key.query.filter_by(project_id=project.id).all()
                for key in keys:
                    key.status = 0

                deactivated_count += 1

                try:
                    if not self._activity_service:
                        raise ServiceError(
                            "ActivityService dependency not injected",
                            status_code=500
                        )
                    activity_service = self._activity_service
                    activity_service.log_activity(
                        admin_user,
                        "project_deactivated",
                        details=f"Project {project.name} deactivated due to expired subscription",
                        project_id=project.id,
                    )
                except Exception as e:
                    self.logger.warning(f"Failed to log project deactivation activity: {e}")

            expired_codes = ProjectInviteCode.query.filter(
                ProjectInviteCode.auto_delete_at < datetime.utcnow(),
                ProjectInviteCode.is_used == False,
            ).all()

            for code in expired_codes:
                code.is_expired = True

            db.session.commit()

            return deactivated_count, len(expired_codes), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deactivating expired projects: {str(e)}")
            return 0, 0, f"Failed to deactivate expired projects: {str(e)}"

    def cleanup_expired_projects(self, admin_user: User) -> Tuple[int, List[str], Optional[str]]:
        """
        Permanently delete projects that have been expired for more than grace period

        Args:
            admin_user: Admin user performing the operation

        Returns:
            Tuple of (deleted_count, deleted_project_names, error_message)
        """
        try:

            if not RBACManager.is_owner(admin_user):
                return 0, [], "Access denied - owner role required"

            grace_period_cutoff = datetime.utcnow() - timedelta(days=self.grace_period_days)

            expired_projects = Project.query.filter(
                Project.subscription_expires_at < grace_period_cutoff, Project.status == "expired"
            ).all()

            deleted_count = 0
            deleted_project_names = []

            for project in expired_projects:
                project_name = project.name

                try:

                    self._delete_project_data(project.id)

                    db.session.delete(project)

                    deleted_count += 1
                    deleted_project_names.append(project_name)

                    try:
                        if not self._activity_service:
                            raise ServiceError(
                                "ActivityService dependency not injected",
                                status_code=500
                            )
                        activity_service = self._activity_service
                        activity_service.log_activity(
                            admin_user,
                            "project_deleted",
                            details=f"Project {project_name} permanently deleted after grace period",
                            project_id=project.id,
                        )
                    except Exception as e:
                        self.logger.warning(f"Failed to log project deletion activity: {e}")

                except Exception as e:
                    self.logger.error(f"Failed to delete project {project_name}: {str(e)}")
                    continue

            db.session.commit()

            return deleted_count, deleted_project_names, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error cleaning up expired projects: {str(e)}")
            return 0, [], f"Failed to cleanup expired projects: {str(e)}"

    def _delete_project_data(self, project_id: int) -> None:
        """Delete all data associated with a project"""
        try:

            affected_user_ids = db.session.query(Key.user_id).filter_by(project_id=project_id).distinct().all()
            affected_user_ids = [uid[0] for uid in affected_user_ids if uid[0] is not None]

            Key.query.filter_by(project_id=project_id).delete()

            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=project_id)

            Product.query.filter_by(project_id=project_id).delete()

            owner_user_ids = (
                db.session.query(UserRole.user_id)
                .join(Role)
                .filter(Role.name == "owner", Role.project_id == project_id)
                .all()
            )
            owner_user_ids = [user_id[0] for user_id in owner_user_ids]

            users_to_delete = (
                User.query.filter(User.project_id == project_id, ~User.id.in_(owner_user_ids))
                .with_entities(User.id)
                .all()
            )
            user_ids_to_delete = [user_id[0] for user_id in users_to_delete]

            if user_ids_to_delete:
                UserRole.query.filter(UserRole.user_id.in_(user_ids_to_delete)).delete()

            User.query.filter(User.project_id == project_id, ~User.id.in_(owner_user_ids)).delete()

            UserRole.query.join(Role).filter(Role.project_id == project_id).delete()
            Role.query.filter_by(project_id=project_id).delete()

            ProjectInviteCode.query.filter_by(project_id=project_id).delete()

        except Exception as e:
            self.logger.error(f"Error deleting project data for project {project_id}: {str(e)}")
            raise

    def get_system_stats(self, admin_user: User) -> Dict[str, Any]:
        """
        Get system statistics for admin dashboard

        Args:
            admin_user: Admin user requesting stats

        Returns:
            Dictionary with system statistics
        """
        try:

            if not RBACManager.is_owner(admin_user):
                raise PermissionDeniedError(
                    "Access denied - owner role required",
                    action="get_system_statistics"
                )

            stats = {
                "projects": {
                    "total": Project.query.count(),
                    "active": Project.query.filter_by(status="active").count(),
                    "expired": Project.query.filter_by(status="expired").count(),
                    "suspended": Project.query.filter_by(status="suspended").count(),
                },
                "users": {
                    "total": User.query.count(),
                    "with_project": User.query.filter(User.project_id.isnot(None)).count(),
                    "without_project": User.query.filter(User.project_id.is_(None)).count(),
                },
                "keys": {
                    "total": Key.query.count(),
                    "active": Key.query.filter_by(status=1).count(),
                    "inactive": Key.query.filter_by(status=0).count(),
                },
                "products": {"total": Product.query.count()},
                "invite_codes": {
                    "total": ProjectInviteCode.query.count(),
                    "active": ProjectInviteCode.query.filter(
                        ProjectInviteCode.is_used == False,
                        ProjectInviteCode.is_expired == False,
                        ProjectInviteCode.expires_at > datetime.utcnow(),
                    ).count(),
                    "expired": ProjectInviteCode.query.filter(
                        ProjectInviteCode.is_expired == True
                    ).count(),
                },
                "referral_codes": {
                    "total": ReferralCode.query.count(),
                    "active": ReferralCode.query.filter(
                        ReferralCode.used == False,
                        db.or_(
                            ReferralCode.expires_at.is_(None),
                            ReferralCode.expires_at > datetime.utcnow()
                        )
                    ).count(),
                    "inactive": ReferralCode.query.filter(
                        db.or_(
                            ReferralCode.used == True,
                            db.and_(
                                ReferralCode.expires_at.isnot(None),
                                ReferralCode.expires_at <= datetime.utcnow()
                            )
                        )
                    ).count(),
                },
            }

            return stats

        except PermissionDeniedError:
            # Re-raise permission errors as-is
            raise
        except Exception as e:
            self.logger.error(f"Error getting system stats: {str(e)}", exc_info=True)
            raise ServiceError(
                "Failed to retrieve system statistics",
                status_code=500,
                context={"admin_user_id": admin_user.id if admin_user else None}
            ) from e

    def get_expired_projects_info(self, admin_user: User) -> List[Dict[str, Any]]:
        """
        Get information about expired projects

        Args:
            admin_user: Admin user requesting info

        Returns:
            List of expired project information
        """
        try:

            if not RBACManager.is_owner(admin_user):
                return []

            expired_projects = Project.query.filter(
                Project.subscription_expires_at < datetime.utcnow(),
                Project.status.in_(["active", "expired"]),
            ).all()

            # Use explicit dependency injection
            if not self._project_relationships_service:
                raise ServiceError(
                    "ProjectRelationshipsService dependency not injected",
                    status_code=500
                )
            project_relationships_service = self._project_relationships_service

            projects_info = []
            for project in expired_projects:

                user_count = project_relationships_service.get_user_count(project.id)

                active_keys = Key.query.filter_by(project_id=project.id, status=1).count()

                days_expired = (datetime.utcnow() - project.subscription_expires_at).days

                projects_info.append(
                    {
                        "id": project.unique_id,
                        "name": project.name,
                        "status": project.status,
                        "subscription_status": project.subscription_status,
                        "expires_at": project.subscription_expires_at.isoformat(),
                        "days_expired": days_expired,
                        "user_count": user_count,
                        "active_keys": active_keys,
                        "created_at": project.created_at.isoformat(),
                    }
                )

            return projects_info

        except Exception as e:
            self.logger.error(f"Error getting expired projects info: {str(e)}")
            return []

    def suspend_project(
        self, project_id: int, admin_user: User, reason: str = ""
    ) -> Tuple[bool, Optional[str]]:
        """
        Suspend a project

        Args:
            project_id: Project ID to suspend
            admin_user: Admin user performing the action
            reason: Reason for suspension

        Returns:
            Tuple of (success, error_message)
        """
        try:

            if not RBACManager.is_owner(admin_user):
                return False, "Access denied - owner role required"

            project = Project.query.get(project_id)
            if not project:
                return False, "Project not found"

            project.status = "suspended"
            project.suspended_at = datetime.utcnow()
            project.suspension_reason = reason

            Key.query.filter_by(project_id=project_id).update({"status": 0})

            db.session.commit()

            try:
                if not self._activity_service:
                    raise ServiceError(
                        "ActivityService dependency not injected",
                        status_code=500
                    )
                activity_service = self._activity_service
                activity_service.log_activity(
                    admin_user,
                    "project_suspended",
                    details=f"Project {project.name} suspended. Reason: {reason}",
                    project_id=project_id,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project suspension activity: {e}")

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error suspending project: {str(e)}")
            return False, f"Failed to suspend project: {str(e)}"

    def reactivate_project(
        self, project_id: int, admin_user: User, new_expiry_date: Optional[datetime] = None, new_expiry_date_str: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Reactivate a suspended or expired project

        Args:
            project_id: Project ID to reactivate
            admin_user: Admin user performing the action
            new_expiry_date: New subscription expiry date (optional, datetime object)
            new_expiry_date_str: New subscription expiry date as ISO string (optional)

        Returns:
            Tuple of (success, error_message)
        """
        try:

            if not RBACManager.is_owner(admin_user):
                return False, "Access denied - owner role required"

            project = Project.query.get(project_id)
            if not project:
                return False, "Project not found"

            if new_expiry_date_str and not new_expiry_date:
                try:
                    new_expiry_date = datetime.fromisoformat(new_expiry_date_str.replace("Z", "+00:00"))
                except ValueError:
                    return False, "Invalid date format"

            project.status = "active"
            project.subscription_status = "active"
            project.suspended_at = None
            project.suspension_reason = None

            if new_expiry_date:
                project.subscription_expires_at = new_expiry_date

            Key.query.filter_by(project_id=project_id).update({"status": 1})

            db.session.commit()

            try:
                if not self._activity_service:
                    raise ServiceError(
                        "ActivityService dependency not injected",
                        status_code=500
                    )
                activity_service = self._activity_service
                activity_service.log_activity(
                    admin_user,
                    "project_reactivated",
                    details=f"Project {project.name} reactivated",
                    project_id=project_id,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project reactivation activity: {e}")

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error reactivating project: {str(e)}")
            return False, f"Failed to reactivate project: {str(e)}"

