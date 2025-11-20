"""
Activity Service - Manages user activity logging without violating architecture layers
"""

from datetime import datetime
from typing import Any, Dict, Optional

from ...core.extensions import db
from ...models.core import User, UserActivity
from ...services.analytics import analytics_buffer_service
from ...utils.data_masking import mask_username
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.ip_utils import get_location_from_ip
from ...utils.structured_logging import get_logger

class ActivityService:
    """Service for managing user activity logging"""

    def __init__(self):
        self.logger = get_logger("activity_service")

    def log_activity(
        self,
        user: User,
        action: str,
        ip: Optional[str] = None,
        details: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Optional[UserActivity]:
        """
        Log user activity using write-behind buffer pattern.
        
        Instead of writing directly to the database, this method buffers the activity
        in Redis. A background worker periodically flushes buffered activities to
        PostgreSQL in batches, significantly reducing database write pressure under
        high load (thousands of concurrent users).

        Args:
            user: User object performing the action
            action: Action description
            ip: IP address (optional)
            details: Additional details (optional)
            user_agent: User agent string (optional)
            session_id: Session ID (optional)

        Returns:
            UserActivity instance if logged successfully, None otherwise
        """
        if not user:
            self.logger.warning(f"log_activity called with no user for action: {action}")
            return None

        try:
            masked_username = mask_username(user.username) if user.username else "unknown"
            self.logger.debug(
                f"Logging activity: {action} for user {masked_username} (ID: {user.id})"
            )

            country = None
            city = None

            if ip and ip not in ("127.0.0.1", "localhost", "::1"):
                try:
                    country, city = get_location_from_ip(ip)
                    self.logger.debug(f"Got location for IP: {country}, {city}")
                except Exception as e:
                    self.logger.warning(f"Failed to get geolocation: {e}")

            # Use write-behind buffer instead of direct DB write
            success = analytics_buffer_service.buffer_user_activity(
                user_id=user.id,
                action=action,
                ip=ip,
                details=details,
                user_agent=user_agent,
                session_id=session_id,
                country=country,
                city=city,
                project_id=user.project_id,
            )

            if success:
                self.logger.debug(
                    f"Buffered activity: {action} for user {masked_username} "
                    "(will be flushed to DB by background worker)"
                )
                # Return a mock object to maintain compatibility
                # The actual record will be created when flushed
                return UserActivity(
                    user_id=user.id,
                    action=action,
                    ip_address=ip,
                    user_agent=user_agent,
                    country=country,
                    city=city,
                    project_id=user.project_id,
                    details=details,
                    session_id=session_id,
                )
            else:
                # Fallback to direct write if buffer fails
                self.logger.warning(
                    f"Activity buffer failed for user {masked_username}, "
                    "falling back to direct DB write"
                )
                return self._log_activity_direct(
                    user, action, ip, details, user_agent, session_id, country, city
                )

        except Exception as e:
            self.logger.warning(f"Failed to log activity: {e}")
            import traceback

            self.logger.warning(f"log_activity traceback: {traceback.format_exc()}")

            # Fallback to direct write on error
            try:
                return self._log_activity_direct(
                    user, action, ip, details, user_agent, session_id, None, None
                )
            except Exception as fallback_error:
                self.logger.error(f"Activity fallback also failed: {fallback_error}")
                try:
                    db.session.rollback()
                except Exception as rollback_error:
                    self.logger.warning(f"Failed to rollback session: {rollback_error}")

            return None

    def _log_activity_direct(
        self,
        user: User,
        action: str,
        ip: Optional[str],
        details: Optional[str],
        user_agent: Optional[str],
        session_id: Optional[str],
        country: Optional[str],
        city: Optional[str],
    ) -> Optional[UserActivity]:
        """
        Direct database write (fallback method when buffer fails).
        
        This method performs the original direct database write logic.
        It's kept as a fallback for reliability.
        """
        try:
            activity = UserActivity(
                user_id=user.id,
                action=action,
                ip_address=ip,
                user_agent=user_agent,
                country=country,
                city=city,
                project_id=user.project_id,
                details=details,
                session_id=session_id,
            )

            self.logger.debug(f"Created UserActivity record: action={action}, user_id={user.id}")

            db.session.add(activity)
            db.session.commit()

            masked_username = mask_username(user.username) if user.username else "unknown"
            self.logger.debug(
                f"Successfully logged activity (direct): {action} for user {masked_username}"
            )
            return activity

        except Exception as e:
            self.logger.warning(f"Failed to log activity (direct): {e}")
            try:
                db.session.rollback()
            except Exception as rollback_error:
                self.logger.warning(f"Failed to rollback session: {rollback_error}")

            return None

    def log_activity_by_id(
        self,
        user_id: int,
        action: str,
        ip: Optional[str] = None,
        details: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> Optional[UserActivity]:
        """
        Log activity by user ID (useful when you only have the ID)

        Args:
            user_id: ID of the user performing the action
            action: Action description
            ip: IP address (optional)
            details: Additional details (optional)
            user_agent: User agent string (optional)
            session_id: Session ID (optional)
            project_id: Project ID (optional)

        Returns:
            UserActivity instance if logged successfully, None otherwise
        """
        try:
            user = User.query.get(user_id)
            if not user:
                self.logger.warning(f"User with ID {user_id} not found for activity logging")
                return None

            return self.log_activity(user, action, ip, details, user_agent, session_id)

        except Exception as e:
            self.logger.error(f"Failed to log activity by user ID: {e}")
            return None

    def get_user_activities(
        self,
        user_id: Optional[int] = None,
        project_id: Optional[int] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[UserActivity]:
        """
        Get user activities with filtering

        Args:
            user_id: Filter by user ID
            project_id: Filter by project ID
            action: Filter by action (partial match)
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of UserActivity instances
        """
        try:
            query = UserActivity.query

            if user_id:
                query = query.filter(UserActivity.user_id == user_id)

            if project_id:
                query = query.filter(UserActivity.project_id == project_id)

            if action:

                query = fulltext_search_filter(query, action, "search_vector")

            return query.order_by(UserActivity.created_at.desc()).offset(offset).limit(limit).all()

        except Exception as e:
            self.logger.error(f"Failed to get user activities: {e}")
            return []

    def get_activity_statistics(
        self, project_id: Optional[int] = None, days: int = 30
    ) -> Dict[str, Any]:
        """
        Get activity statistics

        Args:
            project_id: Filter by project ID
            days: Number of days to look back

        Returns:
            Dictionary with activity statistics
        """
        try:
            from datetime import timedelta

            date_from = datetime.utcnow() - timedelta(days=days)

            query = UserActivity.query.filter(UserActivity.created_at >= date_from)

            if project_id:
                query = query.filter(UserActivity.project_id == project_id)

            total_activities = query.count()

            action_stats = db.session.query(
                UserActivity.action, db.func.count(UserActivity.id)
            ).filter(UserActivity.created_at >= date_from)

            if project_id:
                action_stats = action_stats.filter(UserActivity.project_id == project_id)

            action_stats = (
                action_stats.group_by(UserActivity.action)
                .order_by(db.func.count(UserActivity.id).desc())
                .limit(10)
                .all()
            )

            country_stats = db.session.query(
                UserActivity.country, db.func.count(UserActivity.id)
            ).filter(UserActivity.created_at >= date_from, UserActivity.country.isnot(None))

            if project_id:
                country_stats = country_stats.filter(UserActivity.project_id == project_id)

            country_stats = (
                country_stats.group_by(UserActivity.country)
                .order_by(db.func.count(UserActivity.id).desc())
                .limit(10)
                .all()
            )

            unique_users = query.with_entities(UserActivity.user_id).distinct().count()

            return {
                "total_activities": total_activities,
                "unique_users": unique_users,
                "top_actions": [
                    {"action": action, "count": count} for action, count in action_stats
                ],
                "top_countries": [
                    {"country": country, "count": count} for country, count in country_stats
                ],
                "period_days": days,
            }

        except Exception as e:
            self.logger.error(f"Failed to get activity statistics: {e}")
            return {}

activity_service = ActivityService()
