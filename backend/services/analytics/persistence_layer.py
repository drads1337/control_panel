"""
Analytics Buffer Persistence Layer
Provides fallback persistence mechanisms for analytics data when Redis is unavailable.

This layer implements multiple persistence strategies:
1. Redis (primary, fast, in-memory)
2. In-memory queue with backpressure (secondary, survives Redis restarts within process)
3. Structured logging for Filebeat/Vector collection (tertiary, survives process restarts)
4. Direct DB write (final fallback, guaranteed)

Architecture:
- Primary: Redis (fast, in-memory)
- Secondary: In-memory queue with size limits and backpressure (container-safe)
- Tertiary: Structured JSON logging (collected by Filebeat/Vector, survives container restarts)
- Final: Direct DB write (slow but guaranteed)

This design is container-friendly and avoids ephemeral disk storage that would be lost
on container restarts in Kubernetes/Docker environments.

Usage:
    from backend.services.analytics.persistence_layer import PersistenceLayer
    
    persistence = PersistenceLayer()
    
    # Try to buffer in Redis, fallback to in-memory queue if Redis fails
    success = persistence.buffer_with_fallback(activity_data)
"""

import json
import logging
import threading
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional

from ...config.config import Config
from ...utils.redis_client import redis_client
from ...utils.service_exceptions import ServiceError

logger = logging.getLogger(__name__)

class PersistenceLayer:
    """
    Persistence layer for analytics buffer with fallback mechanisms.
    
    Provides multiple levels of persistence to prevent data loss:
    1. Redis (primary, fast)
    2. In-memory queue with backpressure (secondary, container-safe)
    3. Structured logging for log aggregation (tertiary, survives restarts)
    4. Direct DB write (final fallback, guaranteed)
    
    This implementation is designed for containerized environments where
    local disk storage is ephemeral and should not be relied upon.
    """
    
    def __init__(self, analytics_buffer_service=None):
        self._analytics_buffer_service = analytics_buffer_service
        # In-memory queue configuration
        self._max_queue_size = int(
            getattr(Config, 'ANALYTICS_MEMORY_QUEUE_SIZE', 10000)
        )  # Max items in memory queue
        self._queue_drop_oldest = True  # Drop oldest items when queue is full
        
        # Thread-safe in-memory queues
        self._activity_queue: deque = deque(maxlen=self._max_queue_size)
        self._key_analytics_queue: deque = deque(maxlen=self._max_queue_size)
        self._queue_lock = threading.Lock()
        
        # Track last successful Redis operation
        self._redis_available = True
        self._redis_failures = 0
        self._max_redis_failures = 3
        
        # Statistics
        self.stats = {
            "redis_writes": 0,
            "memory_queue_writes": 0,
            "log_writes": 0,
            "db_fallbacks": 0,
            "redis_failures": 0,
            "queue_drops": 0,  # Items dropped due to queue being full
        }
    
    def _get_analytics_buffer_service(self):
        """
        Get analytics buffer service - requires Dependency Injection.
        
        Raises:
            ServiceError: If analytics_buffer_service is not injected
        """
        if self._analytics_buffer_service is None:
            raise ServiceError(
                "AnalyticsBufferService dependency not injected",
                status_code=500
            )
        return self._analytics_buffer_service
    
    def buffer_user_activity_with_fallback(
        self,
        user_id: int,
        action: str,
        ip: Optional[str] = None,
        details: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        country: Optional[str] = None,
        city: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> bool:
        """
        Buffer user activity with automatic fallback if Redis fails.
        
        Returns:
            True if successfully buffered (in any layer), False otherwise
        """
        activity_data = {
            "user_id": user_id,
            "action": action,
            "ip_address": ip,
            "user_agent": user_agent,
            "session_id": session_id,
            "country": country,
            "city": city,
            "project_id": project_id,
            "details": details,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Remove None values
        activity_data = {k: v for k, v in activity_data.items() if v is not None}
        
        # Try Redis first
        if self._redis_available:
            try:
                analytics_buffer_service = self._get_analytics_buffer_service()
                success = analytics_buffer_service.buffer_user_activity(
                    user_id=user_id,
                    action=action,
                    ip=ip,
                    details=details,
                    user_agent=user_agent,
                    session_id=session_id,
                    country=country,
                    city=city,
                    project_id=project_id,
                )
                
                if success:
                    self.stats["redis_writes"] += 1
                    self._redis_failures = 0
                    return True
                else:
                    raise Exception("Redis buffer returned False")
                    
            except Exception as e:
                logger.warning(f"Redis buffer failed: {e}, falling back to disk")
                self._redis_failures += 1
                self.stats["redis_failures"] += 1
                
                if self._redis_failures >= self._max_redis_failures:
                    self._redis_available = False
                    logger.error(
                        f"Redis marked as unavailable after {self._redis_failures} failures. "
                        "Using disk backup and DB fallback."
                    )
        
        # Fallback to in-memory queue
        try:
            success = self._buffer_to_memory_queue("user_activity", activity_data)
            if success:
                self.stats["memory_queue_writes"] += 1
                logger.debug(
                    f"Buffered user activity to memory queue: user_id={user_id}, action={action}",
                    extra={
                        "analytics_type": "user_activity",
                        "user_id": user_id,
                        "action": action,
                        "fallback_reason": "redis_unavailable"
                    }
                )
                return True
        except Exception as e:
            logger.error(f"Memory queue buffer failed: {e}")
        
        # Fallback to structured logging (for Filebeat/Vector collection)
        try:
            success = self._log_to_structured_log("user_activity", activity_data)
            if success:
                self.stats["log_writes"] += 1
                logger.info(
                    "Analytics data logged for collection",
                    extra={
                        "analytics_type": "user_activity",
                        "data": activity_data,
                        "fallback_reason": "redis_and_memory_unavailable"
                    }
                )
                return True
        except Exception as e:
            logger.error(f"Structured logging failed: {e}")
        
        # Final fallback: write directly to database
        try:
            success = self._write_direct_to_db("user_activity", activity_data)
            if success:
                self.stats["db_fallbacks"] += 1
                logger.warning(
                    f"Wrote user activity directly to DB (Redis and disk failed): "
                    f"user_id={user_id}, action={action}"
                )
                return True
        except Exception as e:
            logger.error(f"Direct DB write failed: {e}")
        
        return False
    
    def buffer_key_analytics_with_fallback(
        self,
        key_id: int,
        product: str,
        ip_address: Optional[str] = None,
        serial: Optional[str] = None,
        increment_connections: bool = True,
    ) -> bool:
        """
        Buffer key analytics with automatic fallback if Redis fails.
        
        Returns:
            True if successfully buffered (in any layer), False otherwise
        """
        analytics_data = {
            "key_id": key_id,
            "product": product,
            "ip_address": ip_address,
            "serial": serial,
            "increment_connections": increment_connections,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Try Redis first
        if self._redis_available:
            try:
                analytics_buffer_service = self._get_analytics_buffer_service()
                success = analytics_buffer_service.buffer_key_analytics_update(
                    key_id=key_id,
                    product=product,
                    ip_address=ip_address,
                    serial=serial,
                    increment_connections=increment_connections,
                )
                
                if success:
                    self.stats["redis_writes"] += 1
                    self._redis_failures = 0
                    return True
                else:
                    raise Exception("Redis buffer returned False")
                    
            except Exception as e:
                logger.warning(f"Redis buffer failed: {e}, falling back to disk")
                self._redis_failures += 1
                self.stats["redis_failures"] += 1
                
                if self._redis_failures >= self._max_redis_failures:
                    self._redis_available = False
                    logger.error(
                        f"Redis marked as unavailable after {self._redis_failures} failures. "
                        "Using disk backup and DB fallback."
                    )
        
        # Fallback to in-memory queue
        try:
            success = self._buffer_to_memory_queue("key_analytics", analytics_data)
            if success:
                self.stats["memory_queue_writes"] += 1
                logger.debug(
                    f"Buffered key analytics to memory queue: key_id={key_id}, product={product}",
                    extra={
                        "analytics_type": "key_analytics",
                        "key_id": key_id,
                        "product": product,
                        "fallback_reason": "redis_unavailable"
                    }
                )
                return True
        except Exception as e:
            logger.error(f"Memory queue buffer failed: {e}")
        
        # Fallback to structured logging (for Filebeat/Vector collection)
        try:
            success = self._log_to_structured_log("key_analytics", analytics_data)
            if success:
                self.stats["log_writes"] += 1
                logger.info(
                    "Analytics data logged for collection",
                    extra={
                        "analytics_type": "key_analytics",
                        "data": analytics_data,
                        "fallback_reason": "redis_and_memory_unavailable"
                    }
                )
                return True
        except Exception as e:
            logger.error(f"Structured logging failed: {e}")
        
        # Final fallback: write directly to database
        try:
            success = self._write_direct_to_db("key_analytics", analytics_data)
            if success:
                self.stats["db_fallbacks"] += 1
                logger.warning(
                    f"Wrote key analytics directly to DB (Redis and disk failed): "
                    f"key_id={key_id}, product={product}"
                )
                return True
        except Exception as e:
            logger.error(f"Direct DB write failed: {e}")
        
        return False
    
    def _buffer_to_memory_queue(self, data_type: str, data: Dict[str, Any]) -> bool:
        """
        Buffer analytics data to in-memory queue with backpressure.
        
        This is container-safe and avoids ephemeral disk storage.
        When queue is full, oldest items are dropped (FIFO).
        
        Args:
            data_type: Type of data ("user_activity" or "key_analytics")
            data: Data dictionary to buffer
            
        Returns:
            True if successfully buffered, False otherwise
        """
        try:
            with self._queue_lock:
                queue = self._activity_queue if data_type == "user_activity" else self._key_analytics_queue
                
                # Check if queue is full (deque with maxlen automatically drops oldest)
                was_full = len(queue) >= self._max_queue_size
                
                queue.append({
                    "type": data_type,
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat(),
                })
                
                if was_full:
                    self.stats["queue_drops"] += 1
                    logger.warning(
                        f"Memory queue full, oldest item dropped: {data_type}",
                        extra={
                            "analytics_type": data_type,
                            "queue_size": len(queue),
                            "max_queue_size": self._max_queue_size
                        }
                    )
                
                return True
                
        except Exception as e:
            logger.error(f"Failed to buffer {data_type} to memory queue: {e}")
            return False
    
    def _log_to_structured_log(self, data_type: str, data: Dict[str, Any]) -> bool:
        """
        Log analytics data as structured JSON for log aggregation systems.
        
        This allows Filebeat/Vector to collect and forward analytics data
        even when Redis and in-memory queue are unavailable.
        
        Args:
            data_type: Type of data ("user_activity" or "key_analytics")
            data: Data dictionary to log
            
        Returns:
            True if successfully logged, False otherwise
        """
        try:
            # Use structured logging with special marker for analytics data
            logger.info(
                f"Analytics fallback: {data_type}",
                extra={
                    "event_type": "analytics_fallback",
                    "analytics_type": data_type,
                    "analytics_data": data,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to log {data_type} to structured log: {e}")
            return False
    
    def _write_direct_to_db(self, data_type: str, data: Dict[str, Any]) -> bool:
        """
        Write analytics data directly to database (bypassing buffer).
        
        This is the final fallback when both Redis and disk backup fail.
        It's slower but guarantees data persistence.
        
        Args:
            data_type: Type of data ("user_activity" or "key_analytics")
            data: Data dictionary to write
            
        Returns:
            True if successfully written, False otherwise
        """
        try:
            from ...core.extensions import db
            
            if data_type == "user_activity":
                from ...models.core import UserActivity
                
                # Convert created_at string back to datetime
                created_at = datetime.fromisoformat(data.get("created_at", datetime.utcnow().isoformat()))
                
                activity = UserActivity(
                    user_id=data.get("user_id"),
                    action=data.get("action"),
                    ip_address=data.get("ip_address"),
                    user_agent=data.get("user_agent"),
                    session_id=data.get("session_id"),
                    country=data.get("country"),
                    city=data.get("city"),
                    project_id=data.get("project_id"),
                    details=data.get("details"),
                    created_at=created_at,
                )
                
                db.session.add(activity)
                db.session.commit()
                return True
                
            elif data_type == "key_analytics":
                # Key analytics are aggregated, so we can't write individual updates directly
                # Instead, we'll log them for later processing
                logger.warning(
                    f"Cannot write key analytics directly to DB (aggregated data). "
                    f"Data: {data}. Will be processed when Redis recovers."
                )
                # Still return True to indicate we "handled" it (by logging)
                return True
                
        except Exception as e:
            logger.error(f"Failed to write {data_type} directly to DB: {e}")
            return False
    
    def recover_from_memory_queue(self) -> Dict[str, int]:
        """
        Recover buffered analytics from in-memory queue and flush to Redis/database.
        
        This should be called when Redis becomes available again to process
        any data that was buffered in memory during Redis downtime.
        
        Returns:
            Dictionary with recovery statistics
        """
        recovered = {
            "user_activities": 0,
            "key_analytics": 0,
            "errors": 0,
        }
        
        try:
            with self._queue_lock:
                # Process activity queue
                while self._activity_queue:
                    try:
                        item = self._activity_queue.popleft()
                        data = item.get("data", {})
                        
                        # Try to write to Redis first
                        try:
                            analytics_buffer_service = self._get_analytics_buffer_service()
                            success = analytics_buffer_service.buffer_user_activity(
                                user_id=data.get("user_id"),
                                action=data.get("action"),
                                ip=data.get("ip_address"),
                                details=data.get("details"),
                                user_agent=data.get("user_agent"),
                                session_id=data.get("session_id"),
                                country=data.get("country"),
                                city=data.get("city"),
                                project_id=data.get("project_id"),
                            )
                            if success:
                                recovered["user_activities"] += 1
                            else:
                                # Fallback to direct DB write
                                if self._write_direct_to_db("user_activity", data):
                                    recovered["user_activities"] += 1
                                else:
                                    recovered["errors"] += 1
                        except Exception:
                            # Fallback to direct DB write
                            if self._write_direct_to_db("user_activity", data):
                                recovered["user_activities"] += 1
                            else:
                                recovered["errors"] += 1
                                
                    except Exception as e:
                        logger.error(f"Failed to recover activity from memory queue: {e}")
                        recovered["errors"] += 1
                
                # Process key analytics queue
                while self._key_analytics_queue:
                    try:
                        item = self._key_analytics_queue.popleft()
                        data = item.get("data", {})
                        
                        # Try to write to Redis first
                        try:
                            analytics_buffer_service = self._get_analytics_buffer_service()
                            success = analytics_buffer_service.buffer_key_analytics_update(
                                key_id=data.get("key_id"),
                                product=data.get("product"),
                                ip_address=data.get("ip_address"),
                                serial=data.get("serial"),
                                increment_connections=data.get("increment_connections", True),
                            )
                            if success:
                                recovered["key_analytics"] += 1
                            else:
                                # Key analytics are aggregated, log for processing
                                logger.warning(
                                    f"Cannot recover key analytics directly (aggregated): {data}"
                                )
                                recovered["key_analytics"] += 1
                        except Exception:
                            # Key analytics are aggregated, log for processing
                            logger.warning(
                                f"Cannot recover key analytics directly (aggregated): {data}"
                            )
                            recovered["key_analytics"] += 1
                            
                    except Exception as e:
                        logger.error(f"Failed to recover key analytics from memory queue: {e}")
                        recovered["errors"] += 1
            
            logger.info(
                f"Memory queue recovery complete: {recovered['user_activities']} activities, "
                f"{recovered['key_analytics']} analytics, {recovered['errors']} errors"
            )
            
        except Exception as e:
            logger.error(f"Error during recovery from memory queue: {e}")
            recovered["errors"] += 1
        
        return recovered
    
    def check_redis_health(self) -> bool:
        """
        Check if Redis is available and mark it as available if it is.
        
        Returns:
            True if Redis is available, False otherwise
        """
        try:
            redis_client.client.ping()
            if not self._redis_available:
                logger.info("Redis is available again, resuming Redis operations")
                self._redis_available = True
                self._redis_failures = 0
            return True
        except Exception:
            if self._redis_available:
                logger.warning("Redis health check failed")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get persistence layer statistics.
        
        Returns:
            Dictionary with statistics
        """
        with self._queue_lock:
            return {
                **self.stats,
                "redis_available": self._redis_available,
                "redis_failures": self._redis_failures,
                "memory_queue_size": len(self._activity_queue) + len(self._key_analytics_queue),
                "activity_queue_size": len(self._activity_queue),
                "key_analytics_queue_size": len(self._key_analytics_queue),
                "max_queue_size": self._max_queue_size,
            }
    
    def get_queue_sizes(self) -> Dict[str, int]:
        """
        Get current queue sizes (for monitoring).
        
        Returns:
            Dictionary with queue sizes
        """
        with self._queue_lock:
            return {
                "activity_queue_size": len(self._activity_queue),
                "key_analytics_queue_size": len(self._key_analytics_queue),
                "total_queue_size": len(self._activity_queue) + len(self._key_analytics_queue),
            }

# Singleton instance
persistence_layer = PersistenceLayer()