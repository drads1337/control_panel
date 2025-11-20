"""
Analytics Buffer Service
Implements write-behind caching pattern for analytics writes to reduce database load.

This service buffers analytics writes in Redis and periodically flushes them to PostgreSQL
in batches. This significantly reduces database write pressure under high load.

Pattern: Write-Behind (Write-Back) Caching
- Writes go to Redis first (fast)
- Background worker flushes to PostgreSQL in batches (efficient)
- Handles both UserActivity and KeyAnalytics writes
"""

import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from ...config.config import Config
from ...utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class AnalyticsBufferService:
    """
    Service for buffering analytics writes using Redis write-behind pattern.
    
    This service accumulates analytics writes in Redis and flushes them to the database
    in batches, significantly reducing database write pressure under high load.
    """

    def __init__(self):
        self.buffer_prefix = "analytics_buffer"
        self.buffer_max_size = Config.ANALYTICS_BUFFER_MAX_SIZE
        self.buffer_ttl = Config.ANALYTICS_BUFFER_TTL
        self.enabled = Config.ANALYTICS_BUFFER_ENABLED
        
        # Separate buffers for different analytics types
        self.activity_buffer_key = f"{self.buffer_prefix}:user_activity"
        self.key_analytics_buffer_key = f"{self.buffer_prefix}:key_analytics"
        
        # Counter keys for monitoring
        self.activity_counter_key = f"{self.buffer_prefix}:user_activity:count"
        self.key_analytics_counter_key = f"{self.buffer_prefix}:key_analytics:count"

    def buffer_user_activity(
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
        Buffer a user activity write in Redis instead of writing directly to DB.
        
        Args:
            user_id: User ID
            action: Action description
            ip: IP address
            details: Additional details
            user_agent: User agent string
            session_id: Session ID
            country: Country code
            city: City name
            project_id: Project ID
            
        Returns:
            True if successfully buffered, False otherwise
        """
        if not self.enabled:
            return False
            
        try:
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
            
            # Remove None values to save space
            activity_data = {k: v for k, v in activity_data.items() if v is not None}
            
            # Use Redis list to buffer activities
            activity_json = json.dumps(activity_data)
            redis_client.client.rpush(self.activity_buffer_key, activity_json)
            
            # Set TTL on the buffer key
            redis_client.client.expire(self.activity_buffer_key, self.buffer_ttl)
            
            # Increment counter
            redis_client.client.incr(self.activity_counter_key)
            redis_client.client.expire(self.activity_counter_key, self.buffer_ttl)
            
            logger.debug(f"Buffered user activity: user_id={user_id}, action={action}")
            
            # Check if buffer is getting large and trigger flush if needed
            buffer_size = redis_client.client.llen(self.activity_buffer_key)
            if buffer_size >= self.buffer_max_size:
                logger.warning(
                    f"Activity buffer size ({buffer_size}) reached threshold ({self.buffer_max_size}), "
                    "consider triggering flush"
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to buffer user activity: {e}")
            return False

    def buffer_key_analytics_update(
        self,
        key_id: int,
        game: str,
        ip_address: Optional[str] = None,
        increment_connections: bool = True,
    ) -> bool:
        """
        Buffer a key analytics update in Redis instead of writing directly to DB.
        
        This uses a different approach - we store incremental updates that will be
        aggregated when flushing to the database.
        
        Args:
            key_id: Key ID
            game: Game name
            ip_address: IP address
            increment_connections: Whether to increment connection count
            
        Returns:
            True if successfully buffered, False otherwise
        """
        if not self.enabled:
            return False
            
        try:
            today = date.today()
            today_str = today.isoformat()
            analytics_key = f"{self.key_analytics_buffer_key}:{key_id}:{today_str}"
            
            # Use Redis hash to store aggregated updates for each key+date
            pipeline = redis_client.client.pipeline()
            
            if increment_connections:
                pipeline.hincrby(analytics_key, "total_connections", 1)
            
            # Store game in a set (for unique games)
            if game:
                pipeline.sadd(f"{analytics_key}:games", game)
            
            # Store IP in a set (for unique devices calculation later)
            if ip_address:
                pipeline.sadd(f"{analytics_key}:ips", ip_address)
            
            # Set TTL
            pipeline.expire(analytics_key, self.buffer_ttl)
            pipeline.expire(f"{analytics_key}:games", self.buffer_ttl)
            pipeline.expire(f"{analytics_key}:ips", self.buffer_ttl)
            
            # Track this key+date combination for flushing
            pipeline.sadd(f"{self.key_analytics_buffer_key}:keys", analytics_key)
            pipeline.expire(f"{self.key_analytics_buffer_key}:keys", self.buffer_ttl)
            
            pipeline.execute()
            
            # Increment counter
            redis_client.client.incr(self.key_analytics_counter_key)
            redis_client.client.expire(self.key_analytics_counter_key, self.buffer_ttl)
            
            logger.debug(f"Buffered key analytics update: key_id={key_id}, game={game}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to buffer key analytics: {e}")
            return False

    def get_buffer_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the current buffer state.
        
        Returns:
            Dictionary with buffer statistics
        """
        try:
            activity_count = redis_client.client.llen(self.activity_buffer_key)
            activity_total = int(redis_client.client.get(self.activity_counter_key) or 0)
            
            # Count unique key analytics entries
            key_analytics_keys = redis_client.client.smembers(f"{self.key_analytics_buffer_key}:keys")
            key_analytics_count = len(key_analytics_keys) if key_analytics_keys else 0
            key_analytics_total = int(redis_client.client.get(self.key_analytics_counter_key) or 0)
            
            return {
                "user_activity": {
                    "buffered_items": activity_count,
                    "total_buffered": activity_total,
                    "buffer_key": self.activity_buffer_key,
                },
                "key_analytics": {
                    "buffered_keys": key_analytics_count,
                    "total_updates": key_analytics_total,
                    "buffer_key": self.key_analytics_buffer_key,
                },
                "buffer_max_size": self.buffer_max_size,
                "buffer_ttl": self.buffer_ttl,
            }
            
        except Exception as e:
            logger.error(f"Failed to get buffer stats: {e}")
            return {}

    def flush_user_activities(self, batch_size: int = 100) -> int:
        """
        Flush buffered user activities to the database in batches.
        
        Args:
            batch_size: Number of activities to flush in one batch
            
        Returns:
            Number of activities flushed
        """
        from ...core.extensions import db
        from ...models.core import UserActivity
        
        flushed_count = 0
        
        try:
            while True:
                # Pop batch_size items from the buffer
                activities_json = redis_client.client.lrange(
                    self.activity_buffer_key, 0, batch_size - 1
                )
                
                if not activities_json:
                    break
                
                # Parse and create UserActivity objects
                activities_to_insert = []
                for activity_json in activities_json:
                    try:
                        activity_data = json.loads(activity_json)
                        
                        # Convert created_at string back to datetime
                        if "created_at" in activity_data:
                            activity_data["created_at"] = datetime.fromisoformat(
                                activity_data["created_at"]
                            )
                        
                        activity = UserActivity(**activity_data)
                        activities_to_insert.append(activity)
                        
                    except Exception as e:
                        logger.warning(f"Failed to parse activity data: {e}, data: {activity_json}")
                        continue
                
                if not activities_to_insert:
                    break
                
                # Bulk insert to database
                try:
                    db.session.bulk_insert_mappings(UserActivity, [
                        {
                            "user_id": a.user_id,
                            "action": a.action,
                            "ip_address": a.ip_address,
                            "user_agent": a.user_agent,
                            "session_id": a.session_id,
                            "country": a.country,
                            "city": a.city,
                            "project_id": a.project_id,
                            "details": a.details,
                            "created_at": a.created_at,
                        }
                        for a in activities_to_insert
                    ])
                    db.session.commit()
                    
                    # Remove flushed items from buffer
                    redis_client.client.ltrim(
                        self.activity_buffer_key, len(activities_json), -1
                    )
                    
                    flushed_count += len(activities_to_insert)
                    logger.info(f"Flushed {len(activities_to_insert)} user activities to database")
                    
                except Exception as e:
                    logger.error(f"Failed to flush user activities to database: {e}")
                    db.session.rollback()
                    # Don't remove from buffer on error - will retry later
                    break
                    
        except Exception as e:
            logger.error(f"Error flushing user activities: {e}")
        
        return flushed_count

    def flush_key_analytics(self) -> int:
        """
        Flush buffered key analytics updates to the database.
        
        This aggregates all updates for each key+date combination and updates
        the database records accordingly.
        
        Returns:
            Number of key analytics records updated
        """
        from ...core.extensions import db
        from ...models import DeviceInfo, KeyAnalytics
        
        flushed_count = 0
        
        try:
            # Get all buffered key analytics keys
            analytics_keys = redis_client.client.smembers(
                f"{self.key_analytics_buffer_key}:keys"
            )
            
            if not analytics_keys:
                return 0
            
            for analytics_key in analytics_keys:
                try:
                    # Parse key_id and date from key format: "analytics_buffer:key_analytics:{key_id}:{date}"
                    # The key format is: analytics_buffer:key_analytics:{key_id}:{date_isoformat}
                    parts = analytics_key.split(":")
                    if len(parts) < 4:
                        continue
                    
                    key_id = int(parts[2])
                    date_str = parts[3]
                    # date_str is already in ISO format (YYYY-MM-DD) from date.today().isoformat()
                    from datetime import date as date_type
                    analytics_date = date_type.fromisoformat(date_str)
                    
                    # Get aggregated updates from Redis
                    updates = redis_client.client.hgetall(analytics_key)
                    games_set = redis_client.client.smembers(f"{analytics_key}:games")
                    
                    if not updates and not games_set:
                        # Empty entry, skip
                        redis_client.client.srem(f"{self.key_analytics_buffer_key}:keys", analytics_key)
                        continue
                    
                    # Get or create analytics record
                    analytics = KeyAnalytics.query.filter_by(
                        key_id=key_id, date=analytics_date
                    ).first()
                    
                    if not analytics:
                        analytics = KeyAnalytics(
                            key_id=key_id,
                            date=analytics_date,
                            total_connections=0,
                            unique_devices=0,
                            total_connection_time=0,
                            peak_concurrent=0,
                            countries="[]",
                            games_played="[]",
                        )
                        db.session.add(analytics)
                    
                    # Apply updates
                    if "total_connections" in updates:
                        analytics.total_connections += int(updates["total_connections"])
                    
                    # Update games list
                    if games_set:
                        existing_games = json.loads(analytics.games_played or "[]")
                        new_games = [g.decode() if isinstance(g, bytes) else g for g in games_set]
                        for game in new_games:
                            if game not in existing_games:
                                existing_games.append(game)
                        analytics.games_played = json.dumps(existing_games)
                    
                    # Recalculate unique devices for today
                    unique_devices_today = (
                        db.session.query(db.func.count(db.func.distinct(DeviceInfo.serial)))
                        .filter(
                            DeviceInfo.key_id == key_id,
                            db.func.date(DeviceInfo.last_seen) == analytics_date,
                        )
                        .scalar()
                    )
                    analytics.unique_devices = unique_devices_today or 0
                    
                    analytics.updated_at = datetime.utcnow()
                    
                    db.session.commit()
                    
                    # Clean up Redis keys
                    redis_client.client.delete(analytics_key)
                    redis_client.client.delete(f"{analytics_key}:games")
                    redis_client.client.delete(f"{analytics_key}:ips")
                    redis_client.client.srem(f"{self.key_analytics_buffer_key}:keys", analytics_key)
                    
                    flushed_count += 1
                    logger.debug(
                        f"Flushed key analytics: key_id={key_id}, date={analytics_date}"
                    )
                    
                except Exception as e:
                    logger.error(f"Failed to flush key analytics for {analytics_key}: {e}")
                    db.session.rollback()
                    continue
                    
        except Exception as e:
            logger.error(f"Error flushing key analytics: {e}")
        
        return flushed_count

    def flush_all(self, activity_batch_size: int = 100) -> Dict[str, int]:
        """
        Flush all buffered analytics to the database.
        
        Args:
            activity_batch_size: Batch size for user activities
            
        Returns:
            Dictionary with flush statistics
        """
        activity_count = self.flush_user_activities(batch_size=activity_batch_size)
        analytics_count = self.flush_key_analytics()
        
        return {
            "user_activities_flushed": activity_count,
            "key_analytics_flushed": analytics_count,
            "total_flushed": activity_count + analytics_count,
        }

    def clear_buffer(self) -> Dict[str, int]:
        """
        Clear all buffered analytics (use with caution - data will be lost).
        
        Returns:
            Dictionary with clear statistics
        """
        try:
            activity_count = redis_client.client.llen(self.activity_buffer_key)
            redis_client.client.delete(self.activity_buffer_key)
            redis_client.client.delete(self.activity_counter_key)
            
            # Clear key analytics
            analytics_keys = redis_client.client.smembers(
                f"{self.key_analytics_buffer_key}:keys"
            )
            analytics_count = len(analytics_keys) if analytics_keys else 0
            
            for key in analytics_keys:
                redis_client.client.delete(key)
                redis_client.client.delete(f"{key}:games")
                redis_client.client.delete(f"{key}:ips")
            
            redis_client.client.delete(f"{self.key_analytics_buffer_key}:keys")
            redis_client.client.delete(self.key_analytics_counter_key)
            
            logger.warning(
                f"Cleared analytics buffer: {activity_count} activities, {analytics_count} analytics"
            )
            
            return {
                "activities_cleared": activity_count,
                "analytics_cleared": analytics_count,
            }
            
        except Exception as e:
            logger.error(f"Failed to clear buffer: {e}")
            return {"activities_cleared": 0, "analytics_cleared": 0}


analytics_buffer_service = AnalyticsBufferService()

