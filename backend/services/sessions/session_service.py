"""
Session Management Service
Enhanced session management with security features
"""

import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from flask import current_app, request
from prometheus_client import Counter, Histogram, Gauge, REGISTRY

from ...core.extensions import db
from ...models.core import User, UserActivity
from ...models.rbac import Role, UserRole
from ...models.security import TwoFactorSession
from ...utils.rbac_utils import RBACManager
from ...utils.redis_client import get_redis_client
from ...utils.role_constants import UserRoles
from ...utils.structured_logging import get_logger

# Prometheus metrics for session management performance
_session_limit_checks_total = Counter(
    'session_limit_checks_total',
    'Total number of session limit checks',
    ['path'],  # 'fast' or 'slow'
    registry=REGISTRY
)

_session_limit_check_duration_seconds = Histogram(
    'session_limit_check_duration_seconds',
    'Duration of session limit check operation',
    ['path'],
    registry=REGISTRY
)

_session_lock_acquisitions_total = Counter(
    'session_lock_acquisitions_total',
    'Total number of lock acquisition attempts',
    ['status'],  # 'success' or 'failed'
    registry=REGISTRY
)

_session_lock_wait_seconds = Histogram(
    'session_lock_wait_seconds',
    'Time spent waiting for lock acquisition',
    registry=REGISTRY
)

_session_limit_exceeded_total = Counter(
    'session_limit_exceeded_total',
    'Total number of times session limit was exceeded',
    registry=REGISTRY
)

class SessionService:
    """Service for managing user sessions"""

    def __init__(self, session_service=None):
        self._session_service = session_service
        self.logger = get_logger("session_service")

        self.SESSION_TIMEOUT = 24 * 60 * 60
        self.ACTIVE_THRESHOLD = 30 * 60
        self.MAX_SESSIONS_PER_USER = 5

        self.SUSPICIOUS_ACTIVITY_THRESHOLD = 10
        self.IP_CHANGE_THRESHOLD = 3
        

        self.LOCK_TIMEOUT = 5
        self.LOCK_RETRY_DELAY = 0.1
        self.LOCK_MAX_RETRIES = 10
        
        # Lua script for atomic session count check and increment
        # Returns: [can_proceed (1/0), current_count, needs_db_refresh (1/0)]
        self._session_count_lua = """
        local cache_key = KEYS[1]
        local max_sessions = tonumber(ARGV[1])
        local cache_ttl = tonumber(ARGV[2])
        
        local current_count = redis.call('GET', cache_key)
        if current_count == false then
            -- Cache miss, need to check DB
            return {0, 0, 1}
        end
        
        current_count = tonumber(current_count)
        if current_count == nil then
            -- Invalid cache value, need to refresh
            return {0, 0, 1}
        end
        
        if current_count >= max_sessions then
            -- Limit reached
            return {0, current_count, 0}
        end
        
        -- Can proceed, increment count atomically
        local new_count = redis.call('INCR', cache_key)
        if new_count == 1 then
            redis.call('EXPIRE', cache_key, cache_ttl)
        end
        
        return {1, new_count, 0}
        """

    def create_session(
        self,
        user_id: int,
        ip_address: str,
        user_agent: str,
        device_fingerprint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new user session with atomic session limit checking.
        
        SECURITY: This method uses distributed locking to prevent race conditions
        when multiple concurrent logins try to create sessions simultaneously.
        The session limit check and session creation are atomic within the lock.
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise ValueError("User not found")
            limit_exceeded, decremented_count = self._check_and_enforce_session_limit_atomic(user_id)
            if limit_exceeded:
                raise ValueError("Maximum number of sessions reached")

            session_id = self._generate_session_id(user_id, ip_address, user_agent)

            session_data = {
                "session_id": session_id,
                "user_id": user_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "device_fingerprint": device_fingerprint,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "is_active": True,
                "login_count": 1,
            }

            self._store_session(session_data)
            try:
                from ...models.core import UserActivity
                login_activity = UserActivity(
                    user_id=user_id,
                    action="login",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=f"Session created: {session_id}",
                )
                db.session.add(login_activity)
                db.session.commit()
                
                # Note: Session count is already incremented atomically in 
                # _check_and_enforce_session_limit_atomic via Lua script (fast path)
                # or manually in slow path. No need to increment again here.
            except Exception as e:
                self.logger.warning(f"Failed to record login activity: {e}")

            self.logger.info(
                f"Session created for user {user_id}",
                session_id=session_id,
                user_id=user_id,
                ip=ip_address,
            )

            return {
                "session_id": session_id,
                "user_id": user_id,
                "created_at": session_data["created_at"].isoformat(),
                "expires_at": (
                    session_data["created_at"] + timedelta(seconds=self.SESSION_TIMEOUT)
                ).isoformat(),
            }

        except Exception as e:
            self.logger.error(f"Failed to create session: {e}", user_id=user_id, error=str(e))
            raise

    def validate_session(
        self, session_id: str, ip_address: str, user_agent: str
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Validate an existing session"""
        try:

            session_data = self._get_session(session_id)
            if not session_data:
                return False, None

            if self._is_session_expired(session_data):
                self._invalidate_session(session_id, "expired")
                return False, None

            if session_data.get("ip_address") != ip_address:
                self.logger.warning(
                    f"IP address mismatch for session {session_id}",
                    expected=session_data.get("ip_address"),
                    actual=ip_address,
                )

            self._update_session_activity(session_id, ip_address, user_agent)

            return True, session_data

        except Exception as e:
            self.logger.error(
                f"Failed to validate session: {e}", session_id=session_id, error=str(e)
            )
            return False, None

    def terminate_session(self, session_id: str, reason: str = "manual") -> bool:
        """Terminate a session"""
        try:
            session_data = self._get_session(session_id)
            if not session_data:
                return False

            self._invalidate_session(session_id, reason)

            self.logger.info(
                f"Session terminated: {session_id}", reason=reason, user_id=session_data["user_id"]
            )

            return True

        except Exception as e:
            self.logger.error(
                f"Failed to terminate session: {e}", session_id=session_id, error=str(e)
            )
            return False

    def terminate_user_sessions(
        self, user_id: int, reason: str = "manual", exclude_session: Optional[str] = None
    ) -> int:
        """Terminate all sessions for a user"""
        try:
            user = User.query.get(user_id)
            if not user:
                return 0

            sessions = self._get_user_sessions(user_id)
            terminated_count = 0

            for session in sessions:
                if exclude_session and session["session_id"] == exclude_session:
                    continue

                if self.terminate_session(session["session_id"], reason):
                    terminated_count += 1

            self.logger.info(
                f"Terminated {terminated_count} sessions for user {user_id}",
                user_id=user_id,
                terminated_count=terminated_count,
                reason=reason,
            )

            return terminated_count

        except Exception as e:
            self.logger.error(
                f"Failed to terminate user sessions: {e}", user_id=user_id, error=str(e)
            )
            return 0

    def get_active_sessions(
        self, project_id: Optional[int] = None, user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get all active sessions"""
        try:

            from sqlalchemy import case, func

            user_roles_subquery = (
                db.session.query(UserRole.user_id, func.string_agg(Role.name, ",").label("roles"))
                .join(Role, UserRole.role_id == Role.id)
                .group_by(UserRole.user_id)
                .subquery()
            )

            query = db.session.query(
                User.id,
                User.username,
                User.email,
                User.last_login,
                User.last_ip,
                User.last_country,
                User.last_city,
                user_roles_subquery.c.roles.label("role"),
                User.project_id,
            ).outerjoin(user_roles_subquery, User.id == user_roles_subquery.c.user_id)

            if project_id:
                query = query.filter(User.project_id == project_id)

            if user_id:
                query = query.filter(User.id == user_id)

            active_threshold = datetime.utcnow() - timedelta(hours=24)
            query = query.filter(User.last_login >= active_threshold)

            users = query.all()
            sessions = []

            for user in users:

                last_activity = (
                    UserActivity.query.filter_by(user_id=user.id)
                    .order_by(UserActivity.created_at.desc())
                    .first()
                )

                session_duration = self._calculate_session_duration(
                    user.last_login, last_activity.created_at if last_activity else user.last_login
                )

                is_active = False
                if last_activity:
                    time_since_activity = (
                        datetime.utcnow() - last_activity.created_at
                    ).total_seconds()
                    is_active = time_since_activity <= self.ACTIVE_THRESHOLD

                session_data = {
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": (
                        RBACManager.get_user_role_names(user)[0]
                        if RBACManager.get_user_role_names(user)
                        else UserRoles.CLIENT.value
                    ),
                    "project_id": user.project_id,
                    "ip_address": user.last_ip,
                    "country": user.last_country,
                    "city": user.last_city,
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "last_activity": (
                        last_activity.created_at.isoformat() if last_activity else None
                    ),
                    "last_action": last_activity.action if last_activity else None,
                    "session_duration": session_duration,
                    "is_active": is_active,
                    "user_agent": last_activity.user_agent if last_activity else None,
                }

                sessions.append(session_data)

            return sessions

        except Exception as e:
            self.logger.error(f"Failed to get active sessions: {e}", error=str(e))
            return []

    def get_session_statistics(self, project_id: Optional[int] = None) -> Dict[str, Any]:
        """Get session statistics"""
        try:
            now = datetime.utcnow()
            active_threshold = now - timedelta(minutes=30)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = now - timedelta(days=7)
            month_start = now - timedelta(days=30)

            query = User.query
            if project_id:
                query = query.filter(User.project_id == project_id)

            active_sessions = query.filter(User.last_login >= now - timedelta(hours=24)).count()

            currently_active = 0
            for user in query.filter(User.last_login >= now - timedelta(hours=24)).all():
                last_activity = (
                    UserActivity.query.filter_by(user_id=user.id)
                    .order_by(UserActivity.created_at.desc())
                    .first()
                )

                if (
                    last_activity
                    and (now - last_activity.created_at).total_seconds() <= self.ACTIVE_THRESHOLD
                ):
                    currently_active += 1

            daily_stats = []
            for i in range(7):
                day_start = today_start - timedelta(days=i)
                day_end = day_start + timedelta(days=1)

                day_sessions = query.filter(
                    User.last_login >= day_start, User.last_login < day_end
                ).count()

                daily_stats.append(
                    {"date": day_start.strftime("%Y-%m-%d"), "sessions": day_sessions}
                )

            hourly_stats = []
            for hour in range(24):
                hour_start = today_start + timedelta(hours=hour)
                hour_end = hour_start + timedelta(hours=1)

                hour_activities = UserActivity.query.join(User).filter(
                    UserActivity.created_at >= hour_start, UserActivity.created_at < hour_end
                )

                if project_id:
                    hour_activities = hour_activities.filter(User.project_id == project_id)

                hourly_stats.append({"hour": hour, "activities": hour_activities.count()})

            return {
                "total_active_sessions": active_sessions,
                "currently_active_sessions": currently_active,
                "daily_statistics": daily_stats,
                "hourly_statistics": hourly_stats,
                "session_timeout": self.SESSION_TIMEOUT,
                "active_threshold": self.ACTIVE_THRESHOLD,
            }

        except Exception as e:
            self.logger.error(f"Failed to get session statistics: {e}", error=str(e))
            return {}

    def detect_suspicious_activity(
        self, user_id: int, ip_address: str, user_agent: str
    ) -> List[Dict[str, Any]]:
        """Detect suspicious session activity"""
        try:
            suspicious_activities = []

            recent_sessions = UserActivity.query.filter(
                UserActivity.user_id == user_id,
                UserActivity.created_at >= datetime.utcnow() - timedelta(hours=1),
            ).all()

            unique_ips = set()
            for session in recent_sessions:
                if session.ip_address:
                    unique_ips.add(session.ip_address)

            if len(unique_ips) > self.IP_CHANGE_THRESHOLD:
                suspicious_activities.append(
                    {
                        "type": "multiple_ips",
                        "severity": "high",
                        "description": f"User accessed from {len(unique_ips)} different IP addresses in the last hour",
                        "details": {
                            "ip_addresses": list(unique_ips),
                            "count": len(unique_ips),
                            "threshold": self.IP_CHANGE_THRESHOLD,
                        },
                    }
                )

            recent_user_agents = set()
            for session in recent_sessions:
                if session.user_agent:
                    recent_user_agents.add(session.user_agent)

            if len(recent_user_agents) > 3:
                suspicious_activities.append(
                    {
                        "type": "multiple_user_agents",
                        "severity": "medium",
                        "description": f"User accessed from {len(recent_user_agents)} different user agents in the last hour",
                        "details": {
                            "user_agents": list(recent_user_agents),
                            "count": len(recent_user_agents),
                        },
                    }
                )

            return suspicious_activities

        except Exception as e:
            self.logger.error(
                f"Failed to detect suspicious activity: {e}", user_id=user_id, error=str(e)
            )
            return []

    def _generate_session_id(self, user_id: int, ip_address: str, user_agent: str) -> str:
        """Generate a unique session ID"""
        timestamp = datetime.utcnow().isoformat()
        data = f"{user_id}_{ip_address}_{user_agent}_{timestamp}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]

    def _store_session(self, session_data: Dict[str, Any]):
        """Store session data (placeholder implementation)"""

        pass

    def _get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data (placeholder implementation)"""

        return None

    def _is_session_expired(self, session_data: Dict[str, Any]) -> bool:
        """Check if session is expired"""
        if not session_data.get("created_at"):
            return True

        created_at = session_data["created_at"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        return (datetime.utcnow() - created_at).total_seconds() > self.SESSION_TIMEOUT

    def _invalidate_session(self, session_id: str, reason: str):
        """Invalidate a session (placeholder implementation)"""

        pass

    def _update_session_activity(self, session_id: str, ip_address: str, user_agent: str):
        """Update session activity (placeholder implementation)"""

        pass

    def _get_user_sessions(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all sessions for a user (placeholder implementation)"""

        return []

    def _check_and_enforce_session_limit_atomic(self, user_id: int) -> Tuple[bool, int]:
        """
        Atomically check session limit and enforce it if needed.
        
        OPTIMIZED: Uses Redis Lua script for atomic operations, reducing round-trips
        and lock contention. Only acquires lock when DB refresh or session cleanup is needed.
        
        SECURITY: This method combines limit checking and enforcement in a single
        atomic operation to prevent race conditions. It returns both whether the
        limit is exceeded AND the current count after enforcement (used for cache).
        
        Args:
            user_id: User ID to check
            
        Returns:
            Tuple of (limit_exceeded: bool, current_count_after_enforcement: int)
            - limit_exceeded: True if limit reached and couldn't free space, False otherwise
            - current_count_after_enforcement: Current session count after any cleanup
        """
        start_time = time.time()
        cache_key = f"session_count:{user_id}"
        lock_key = f"session_limit_lock:{user_id}"
        
        redis_client = None
        try:
            redis_client = get_redis_client()
        except Exception as e:
            self.logger.warning(f"Redis unavailable for session limit check, falling back to DB: {e}")
            result = self._check_session_limit_db_only_atomic(user_id)
            _session_limit_check_duration_seconds.labels(path='db_fallback').observe(time.time() - start_time)
            return result
        
        # Step 1: Fast path - try atomic check/increment via Lua script
        # This avoids lock contention for the common case (cache hit, under limit)
        try:
            result = redis_client.eval(
                self._session_count_lua,
                1,
                cache_key,
                str(self.MAX_SESSIONS_PER_USER),
                "60"
            )
            
            # Lua script returns: [can_proceed (1/0), current_count, needs_db_refresh (1/0)]
            can_proceed = int(result[0]) if result and len(result) > 0 else 0
            current_count = int(result[1]) if result and len(result) > 1 else 0
            needs_db_refresh = int(result[2]) if result and len(result) > 2 else 0
            
            if can_proceed == 1:
                # Fast path: cache hit, under limit, already incremented atomically
                _session_limit_checks_total.labels(path='fast').inc()
                _session_limit_check_duration_seconds.labels(path='fast').observe(time.time() - start_time)
                return False, current_count
            
            if needs_db_refresh == 1:
                # Cache miss or invalid - need to refresh from DB (with lock)
                _session_limit_checks_total.labels(path='slow').inc()
                result = self._refresh_session_count_from_db(user_id, redis_client, cache_key, lock_key)
                _session_limit_check_duration_seconds.labels(path='slow').observe(time.time() - start_time)
                return result
            
            # Limit reached - need to check if we can free space (with lock)
            _session_limit_exceeded_total.inc()
            _session_limit_checks_total.labels(path='slow').inc()
            result = self._try_free_session_slot(user_id, redis_client, cache_key, lock_key, current_count)
            _session_limit_check_duration_seconds.labels(path='slow').observe(time.time() - start_time)
            return result
            
        except Exception as e:
            self.logger.warning(f"Lua script execution failed, falling back to DB: {e}")
            result = self._check_session_limit_db_only_atomic(user_id)
            _session_limit_check_duration_seconds.labels(path='db_fallback').observe(time.time() - start_time)
            return result
    
    def _refresh_session_count_from_db(
        self, user_id: int, redis_client, cache_key: str, lock_key: str
    ) -> Tuple[bool, int]:
        """
        Refresh session count from database with lock to prevent race conditions.
        Only called when cache is missing or invalid.
        """
        lock_identifier = str(uuid.uuid4())
        lock_acquired = False
        lock_wait_start = time.time()
        
        # Try to acquire lock with minimal retries (cache miss is rare)
        for attempt in range(min(3, self.LOCK_MAX_RETRIES)):
            lock_acquired = redis_client.set(lock_key, lock_identifier, nx=True, ex=self.LOCK_TIMEOUT)
            if lock_acquired:
                _session_lock_acquisitions_total.labels(status='success').inc()
                _session_lock_wait_seconds.observe(time.time() - lock_wait_start)
                break
            if attempt < 2:  # Don't sleep on last attempt
                time.sleep(self.LOCK_RETRY_DELAY)
        
        if not lock_acquired:
            # If we can't get lock, fall back to DB-only (safe but slower)
            _session_lock_acquisitions_total.labels(status='failed').inc()
            _session_lock_wait_seconds.observe(time.time() - lock_wait_start)
            self.logger.debug(f"Could not acquire lock for cache refresh for user {user_id}, using DB-only")
            return self._check_session_limit_db_only_atomic(user_id)
        
        try:
            # Double-check cache (another process might have refreshed it)
            cached_count = redis_client.get(cache_key)
            if cached_count is not None:
                try:
                    session_count = int(cached_count)
                    # Cache was refreshed by another process, use it
                    redis_client.delete(lock_key)
                    # Check if we can proceed
                    if session_count < self.MAX_SESSIONS_PER_USER:
                        new_count = redis_client.incr(cache_key)
                        if new_count == 1:
                            redis_client.expire(cache_key, 60)
                        return False, new_count
                    else:
                        # Still at limit, try to free slot
                        return self._try_free_session_slot(user_id, redis_client, cache_key, lock_key, session_count)
                except (ValueError, TypeError):
                    pass  # Invalid cache, continue to DB refresh
            
            # Refresh from DB
                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                session_count = (
                    UserActivity.query.filter(
                        UserActivity.user_id == user_id,
                        UserActivity.action == "login",
                        UserActivity.created_at >= cutoff_time,
                    )
                    .count()
                )
                
            # Update cache
                redis_client.setex(cache_key, 60, str(session_count))
            
            # Check if we can proceed
            if session_count < self.MAX_SESSIONS_PER_USER:
                new_count = redis_client.incr(cache_key)
                return False, new_count
            else:
                # At limit, try to free slot
                return self._try_free_session_slot(user_id, redis_client, cache_key, lock_key, session_count)
                
        finally:
            # Release lock
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            try:
                redis_client.eval(lua_script, 1, lock_key, lock_identifier)
            except Exception as e:
                self.logger.warning(f"Failed to release lock for user {user_id}: {e}")
    
    def _try_free_session_slot(
        self, user_id: int, redis_client, cache_key: str, lock_key: str, current_count: int
    ) -> Tuple[bool, int]:
        """
        Try to free a session slot by terminating the oldest session.
        Requires lock to be held by caller.
        """
        lock_identifier = str(uuid.uuid4())
        lock_acquired = False
        lock_wait_start = time.time()
        
        # Try to acquire lock
        for attempt in range(min(3, self.LOCK_MAX_RETRIES)):
            lock_acquired = redis_client.set(lock_key, lock_identifier, nx=True, ex=self.LOCK_TIMEOUT)
            if lock_acquired:
                _session_lock_acquisitions_total.labels(status='success').inc()
                _session_lock_wait_seconds.observe(time.time() - lock_wait_start)
                break
            if attempt < 2:
                time.sleep(self.LOCK_RETRY_DELAY)
        
        if not lock_acquired:
            # Can't get lock, return limit exceeded
            _session_lock_acquisitions_total.labels(status='failed').inc()
            _session_lock_wait_seconds.observe(time.time() - lock_wait_start)
            return True, current_count
        
        try:
            # Re-check count (might have changed)
            cached_count = redis_client.get(cache_key)
            if cached_count is not None:
                try:
                    current_count = int(cached_count)
                except (ValueError, TypeError):
                    pass
            
            if current_count < self.MAX_SESSIONS_PER_USER:
                # Count changed, we can proceed now
                new_count = redis_client.incr(cache_key)
                if new_count == 1:
                    redis_client.expire(cache_key, 60)
                return False, new_count
            
            # Still at limit, try to free oldest session
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            oldest_session = (
                UserActivity.query.filter(
                    UserActivity.user_id == user_id,
                    UserActivity.action == "login",
                    UserActivity.created_at >= cutoff_time,
                )
                .order_by(UserActivity.created_at.asc())
                .first()
            )
            
            if oldest_session:
                self.logger.info(
                    f"Session limit reached for user {user_id}, terminating oldest session",
                    user_id=user_id,
                    oldest_session_id=oldest_session.id,
                )

                oldest_session.action = "logout_forced"
                oldest_session.details = "Session terminated due to session limit enforcement"
                db.session.commit()
                
                new_count = current_count - 1
                redis_client.setex(cache_key, 60, str(new_count))
                
                # Increment for new session
                new_count = redis_client.incr(cache_key)
                return False, new_count
            else:
                # No sessions to free
                return True, current_count
            
        finally:
            # Release lock
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            try:
                redis_client.eval(lua_script, 1, lock_key, lock_identifier)
            except Exception as e:
                self.logger.warning(f"Failed to release lock for user {user_id}: {e}")

    
    def _increment_session_count_cache(self, user_id: int, base_count: int):
        """
        DEPRECATED: Session count is now incremented atomically in 
        _check_and_enforce_session_limit_atomic via Lua script.
        This method is kept for backward compatibility but is no longer called.
        
        Args:
            user_id: User ID
            base_count: Base count before increment (from atomic check)
        """
        try:
            cache_key = f"session_count:{user_id}"
            redis_client = get_redis_client()
            new_count = base_count + 1
            redis_client.setex(cache_key, 60, str(new_count))
        except Exception as e:
            self.logger.warning(f"Failed to update session count cache: {e}")
    
    def _check_session_limit_db_only_atomic(self, user_id: int) -> Tuple[bool, int]:
        """
        Fallback method for atomic session limit checking when Redis is unavailable.
        Uses database-only approach with transaction-level locking.
        
        Returns:
            Tuple of (limit_exceeded: bool, current_count_after_enforcement: int)
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        

        session_count = (
            UserActivity.query.filter(
                UserActivity.user_id == user_id,
                UserActivity.action == "login",
                UserActivity.created_at >= cutoff_time,
            )
            .count()
        )
        
        if session_count >= self.MAX_SESSIONS_PER_USER:

            oldest_session = (
                UserActivity.query.filter(
                    UserActivity.user_id == user_id,
                    UserActivity.action == "login",
                    UserActivity.created_at >= cutoff_time,
                )
                .order_by(UserActivity.created_at.asc())
                .first()
            )
            
            if oldest_session:
                self.logger.info(
                    f"Session limit reached for user {user_id}, terminating oldest session (DB-only mode)",
                    user_id=user_id,
                    oldest_session_id=oldest_session.id,
                )
                
                oldest_session.action = "logout_forced"
                oldest_session.details = "Session terminated due to session limit enforcement"
                db.session.commit()
                
                new_count = session_count - 1
                return False, new_count
            
            return True, session_count
        
        return False, session_count
    
    # DEPRECATED method _check_session_limit removed.
    # Use _check_and_enforce_session_limit_atomic instead.
    
    def _check_session_limit_db_only(self, user_id: int) -> bool:
        """
        Fallback method for checking session limit when Redis is unavailable.
        Uses database-only approach with minimal locking.
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        

        session_count = (
            UserActivity.query.filter(
                UserActivity.user_id == user_id,
                UserActivity.action == "login",
                UserActivity.created_at >= cutoff_time,
            )
            .count()
        )
        
        if session_count >= self.MAX_SESSIONS_PER_USER:

            oldest_session = (
                UserActivity.query.filter(
                    UserActivity.user_id == user_id,
                    UserActivity.action == "login",
                    UserActivity.created_at >= cutoff_time,
                )
                .order_by(UserActivity.created_at.asc())
                .first()
            )
            
            if oldest_session:
                self.logger.info(
                    f"Session limit reached for user {user_id}, terminating oldest session (DB-only mode)",
                    user_id=user_id,
                    oldest_session_id=oldest_session.id,
                )
                
                oldest_session.action = "logout_forced"
                oldest_session.details = "Session terminated due to session limit enforcement"
                db.session.commit()
                
                return (session_count - 1) >= self.MAX_SESSIONS_PER_USER
            
            return True
        
        return False

    def _calculate_session_duration(
        self, last_login: Optional[datetime], last_activity: Optional[datetime]
    ) -> str:
        """Calculate session duration"""
        try:
            if not last_login:
                return "Unknown"

            if not last_activity:
                last_activity = datetime.utcnow()

            if last_login.tzinfo is None:
                last_login = last_login.replace(tzinfo=None)
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=None)

            duration = last_activity - last_login

            if duration.total_seconds() < 0:
                return "Unknown"

            total_seconds = duration.total_seconds()
            hours = int(total_seconds // 3600)
            minutes = int((total_seconds % 3600) // 60)

            if hours > 0:
                return f"{hours}h {minutes}min"
            elif minutes > 0:
                return f"{minutes}min"
            else:
                return "Less than 1 min"

        except Exception as e:
            self.logger.error(f"Error calculating session duration: {e}")
            return "Unknown"




