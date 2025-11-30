"""
Activity Service - Manages user activity logging without violating architecture layers
"""

from datetime import datetime
from typing import Any, Dict, Optional

from ...core.extensions import db
from ...models.core import User, UserActivity
from ...utils.data_masking import mask_username
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.ip_utils import get_location_from_ip
from ...utils.structured_logging import get_logger

# Type hints for dependencies (imported here to avoid circular imports)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.analytics.analytics_buffer_service import AnalyticsBufferService

class ActivityService:
    """
    Service for managing user activity logging with write-behind buffering.
    
    OPTIMIZATION: By default, uses Redis buffer to reduce database write pressure.
    Direct writes are only used for critical actions or when buffer is unavailable.
    
    This prevents "blowing up" the database with activity logs under high load,
    as recommended in the technical audit.
    """

    def __init__(
        self,
        analytics_buffer_service: 'AnalyticsBufferService' = None,
        logger=None
    ):
        """
        Initialize ActivityService with explicit dependencies.
        
        Args:
            analytics_buffer_service: Service for buffering analytics writes
            logger: Optional logger instance
        """
        self.logger = logger or get_logger("activity_service")
        # OPTIMIZATION: Use buffer mode by default if enabled
        # This prevents database overload from activity logs
        self._use_buffer_by_default = True
        
        # Store dependencies explicitly
        self._analytics_buffer_service = analytics_buffer_service
    
    def _get_analytics_buffer_service(self):
        """Get analytics buffer service (lazy loading for backward compatibility)"""
        if self._analytics_buffer_service is None:
            from ...utils.service_helpers import get_service
            self._analytics_buffer_service = get_service('analytics_buffer_service')
        return self._analytics_buffer_service

    # REMOVED: _check_system_load() method
    # OPTIMIZATION: Removed adaptive load checking - use buffer by default instead.
    # This simplifies the code and prevents database overload from activity logs.
    # The buffer is already efficient and handles high load scenarios automatically.

    def log_activity(
        self,
        user: User,
        action: str,
        ip: Optional[str] = None,
        details: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        force_flush: bool = False,
        use_direct_write: bool = False,
    ) -> Optional[UserActivity]:
        """
        Log user activity using write-behind buffering by default.
        
        OPTIMIZATION: By default, uses Redis buffer to reduce database write pressure.
        This prevents "blowing up" the database with activity logs under high load.
        
        Direct writes are only used for:
        - Critical actions (when use_direct_write=True)
        - When buffer is unavailable (fallback)

        Args:
            user: User object performing the action
            action: Action description
            ip: IP address (optional)
            details: Additional details (optional)
            user_agent: User agent string (optional)
            session_id: Session ID (optional)
            force_flush: Force immediate flush even in buffer mode (optional)
            use_direct_write: Force direct write to database (for critical actions) (optional)

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

            # OPTIMIZATION: Use buffer by default (unless explicitly requested direct write)
            # This prevents database overload from activity logs
            if use_direct_write:
                # Critical action: write directly to database for immediate visibility
                self.logger.debug(f"Using direct write for critical action: {action}")
                return self._log_activity_direct(
                    user, action, ip, details, user_agent, session_id, country, city
                )

            # Default: use buffering to reduce database write pressure
            try:
                analytics_buffer_service = self._get_analytics_buffer_service()
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
                        f"(will be flushed to DB by background worker)"
                    )
                    
                    # Force flush for critical actions
                    if force_flush:
                        analytics_buffer_service._trigger_async_flush()
                    
                    # Return a mock object to maintain compatibility
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
                    # Buffer failed (e.g., Redis unavailable), fallback to direct write
                    self.logger.warning(
                        f"Buffer failed for {action}, falling back to direct write"
                    )
                    return self._log_activity_direct(
                        user, action, ip, details, user_agent, session_id, country, city
                    )
            except Exception as buffer_error:
                # Buffer error, fallback to direct write
                self.logger.warning(
                    f"Buffer error for {action}: {buffer_error}, falling back to direct write"
                )
                return self._log_activity_direct(
                    user, action, ip, details, user_agent, session_id, country, city
                )

        except Exception as e:
            self.logger.warning(f"Failed to log activity: {e}")
            import traceback

            self.logger.warning(f"log_activity traceback: {traceback.format_exc()}")

            # Final fallback to direct write on error
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

