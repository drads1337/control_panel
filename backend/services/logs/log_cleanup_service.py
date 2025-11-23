"""
Automatic Log Cleanup Service
Handles automatic cleanup of old logs based on retention settings
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict

from ...core.extensions import db
from ...models.core import ProjectSettings, UserActivity
from ...models.notifications import Notification
from ...utils.structured_logging import get_logger

logger = get_logger("log_cleanup_service")

class LogCleanupService:
    """Service for automatic log cleanup"""

    def __init__(self):
        self.logger = get_logger("log_cleanup_service")
        self.RETENTION_DAYS = 60

    def cleanup_old_logs(self, project_id: int = None) -> Dict[str, Any]:
        """
        Clean up old logs based on retention settings

        Args:
            project_id: Optional project ID to limit cleanup to specific project

        Returns:
            Dictionary with cleanup results
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.RETENTION_DAYS)

            activity_query = UserActivity.query.filter(UserActivity.created_at < cutoff_date)

            if project_id:
                activity_query = activity_query.filter(UserActivity.project_id == project_id)

            deleted_activities = activity_query.delete()

            notification_query = Notification.query.filter(
                Notification.created_at < cutoff_date, Notification.is_read == True
            )

            if project_id:
                notification_query = notification_query.filter(
                    Notification.project_id == project_id
                )

            deleted_notifications = notification_query.delete()

            db.session.commit()

            total_deleted = deleted_activities + deleted_notifications

            self.logger.info(
                f"Automatic log cleanup completed",
                project_id=project_id,
                deleted_activities=deleted_activities,
                deleted_notifications=deleted_notifications,
                total_deleted=total_deleted,
                retention_days=self.RETENTION_DAYS,
            )

            return {
                "success": True,
                "deleted_activities": deleted_activities,
                "deleted_notifications": deleted_notifications,
                "total_deleted": total_deleted,
                "retention_days": self.RETENTION_DAYS,
                "cutoff_date": cutoff_date.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            self.logger.error(
                f"Failed to cleanup old logs: {e}", project_id=project_id, error=str(e)
            )
            return {
                "success": False,
                "error": str(e),
                "deleted_activities": 0,
                "deleted_notifications": 0,
                "total_deleted": 0,
            }

    def cleanup_all_projects(self) -> Dict[str, Any]:
        """
        Clean up logs for all projects

        Returns:
            Dictionary with cleanup results for all projects
        """
        try:

            from ...models.core import Project

            projects = Project.query.all()

            total_results = {
                "success": True,
                "projects_processed": 0,
                "total_deleted_activities": 0,
                "total_deleted_notifications": 0,
                "project_results": [],
            }

            for project in projects:
                result = self.cleanup_old_logs(project.id)
                total_results["project_results"].append(
                    {"project_id": project.id, "project_name": project.name, "result": result}
                )

                if result["success"]:
                    total_results["total_deleted_activities"] += result["deleted_activities"]
                    total_results["total_deleted_notifications"] += result["deleted_notifications"]
                    total_results["projects_processed"] += 1

            total_results["total_deleted"] = (
                total_results["total_deleted_activities"]
                + total_results["total_deleted_notifications"]
            )

            self.logger.info(
                f"Automatic log cleanup completed for all projects",
                projects_processed=total_results["projects_processed"],
                total_deleted=total_results["total_deleted"],
            )

            return total_results

        except Exception as e:
            self.logger.error(f"Failed to cleanup logs for all projects: {e}", error=str(e))
            return {"success": False, "error": str(e), "projects_processed": 0, "total_deleted": 0}

    def get_cleanup_stats(self, project_id: int = None) -> Dict[str, Any]:
        """
        Get statistics about logs that would be cleaned up

        Args:
            project_id: Optional project ID to limit stats to specific project

        Returns:
            Dictionary with cleanup statistics
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.RETENTION_DAYS)

            activity_query = UserActivity.query.filter(UserActivity.created_at < cutoff_date)

            if project_id:
                activity_query = activity_query.filter(UserActivity.project_id == project_id)

            old_activities_count = activity_query.count()

            notification_query = Notification.query.filter(
                Notification.created_at < cutoff_date, Notification.is_read == True
            )

            if project_id:
                notification_query = notification_query.filter(
                    Notification.project_id == project_id
                )

            old_notifications_count = notification_query.count()

            return {
                "retention_days": self.RETENTION_DAYS,
                "cutoff_date": cutoff_date.isoformat(),
                "old_activities_count": old_activities_count,
                "old_notifications_count": old_notifications_count,
                "total_old_logs": old_activities_count + old_notifications_count,
            }

        except Exception as e:
            self.logger.error(
                f"Failed to get cleanup stats: {e}", project_id=project_id, error=str(e)
            )
            return {
                "error": str(e),
                "old_activities_count": 0,
                "old_notifications_count": 0,
                "total_old_logs": 0,
            }

log_cleanup_service = LogCleanupService()
