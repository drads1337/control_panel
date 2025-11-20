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
    """Service for managing user activity logging with adaptive buffering"""

    def __init__(self):
        self.logger = get_logger("activity_service")
        self._buffer_mode = False  # Start in direct write mode
        self._load_check_interval = 5  # Check load every 5 seconds
        self._last_load_check = 0
        self._high_load_threshold_rps = 50  # Switch to buffer mode if > 50 req/s
        self._low_load_threshold_rps = 20  # Switch back to direct mode if < 20 req/s

    def _check_system_load(self) -> bool:
        """
        Check if system is under high load and should use buffering.
        
        Returns:
            True if system is under high load (should buffer), False otherwise
        """
        try:
            import time
            current_time = time.time()
            
            # Only check load every N seconds to avoid overhead
            if current_time - self._last_load_check < self._load_check_interval:
                return self._buffer_mode
            
            self._last_load_check = current_time
            
            # Try to get load metrics from LoadMonitor
            try:
                from ...services.monitoring.load_monitor import load_monitor
                import psutil
                
                # Check CPU usage
                cpu_percent = psutil.cpu_percent(interval=0.1)
                
                # Check memory usage
                memory = psutil.virtual_memory()
                
                # Check request rate (approximate from Redis)
                from ...utils.redis_client import redis_client
                current_second = int(current_time)
                request_key = f"load_monitor:total:requests:{current_second}"
                recent_requests = redis_client.client.get(request_key) or 0
                try:
                    recent_requests = int(recent_requests)
                except (ValueError, TypeError):
                    recent_requests = 0
                
                # Switch to buffer mode if:
                # - CPU > 70% OR
                # - Memory > 80% OR
                # - Request rate > threshold
                high_load = (
                    cpu_percent > 70 or
                    memory.percent > 80 or
                    recent_requests > self._high_load_threshold_rps
                )
                
                # Switch back to direct mode if:
                # - CPU < 50% AND
                # - Memory < 70% AND
                # - Request rate < low threshold
                low_load = (
                    cpu_percent < 50 and
                    memory.percent < 70 and
                    recent_requests < self._low_load_threshold_rps
                )
                
                if high_load and not self._buffer_mode:
                    self.logger.info(
                        f"Switching to buffer mode due to high load: "
                        f"CPU={cpu_percent:.1f}%, Memory={memory.percent:.1f}%, "
                        f"RPS={recent_requests}"
                    )
                    self._buffer_mode = True
                elif low_load and self._buffer_mode:
                    self.logger.info(
                        f"Switching back to direct write mode: "
                        f"CPU={cpu_percent:.1f}%, Memory={memory.percent:.1f}%, "
                        f"RPS={recent_requests}"
                    )
                    self._buffer_mode = False
                    # Flush any remaining buffered activities
                    analytics_buffer_service._trigger_async_flush()
                
                return self._buffer_mode
                
            except ImportError:
                # LoadMonitor not available, use simple heuristic
                try:
                    import psutil
                    cpu_percent = psutil.cpu_percent(interval=0.1)
                    memory = psutil.virtual_memory()
                    
                    high_load = cpu_percent > 70 or memory.percent > 80
                    low_load = cpu_percent < 50 and memory.percent < 70
                    
                    if high_load and not self._buffer_mode:
                        self.logger.info(f"Switching to buffer mode: CPU={cpu_percent:.1f}%, Memory={memory.percent:.1f}%")
                        self._buffer_mode = True
                    elif low_load and self._buffer_mode:
                        self.logger.info(f"Switching to direct mode: CPU={cpu_percent:.1f}%, Memory={memory.percent:.1f}%")
                        self._buffer_mode = False
                        analytics_buffer_service._trigger_async_flush()
                    
                    return self._buffer_mode
                except Exception:
                    # If we can't check load, default to direct mode
                    return False
                    
        except Exception as e:
            self.logger.warning(f"Failed to check system load: {e}")
            # On error, default to direct write mode
            return False

    def log_activity(
        self,
        user: User,
        action: str,
        ip: Optional[str] = None,
        details: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        force_flush: bool = False,
    ) -> Optional[UserActivity]:
        """
        Log user activity with adaptive buffering.
        
        By default, writes directly to database for immediate visibility.
        Automatically switches to buffering mode when system is under high load
        to reduce database pressure.

        Args:
            user: User object performing the action
            action: Action description
            ip: IP address (optional)
            details: Additional details (optional)
            user_agent: User agent string (optional)
            session_id: Session ID (optional)
            force_flush: Force immediate flush even in buffer mode (optional)

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

            # Check system load and decide on write mode
            use_buffer = self._check_system_load()

            if use_buffer:
                # High load: use buffering
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
                        f"Buffered activity (high load mode): {action} for user {masked_username}"
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
                    # Buffer failed, fallback to direct write
                    self.logger.warning(
                        f"Buffer failed, falling back to direct write for {action}"
                    )
                    return self._log_activity_direct(
                        user, action, ip, details, user_agent, session_id, country, city
                    )
            else:
                # Normal load: write directly to database (immediate visibility)
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
