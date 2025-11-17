"""
Cache Service
Provides intelligent caching for resource-intensive operations
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

from flask import current_app

from ...core.extensions import db
from ...utils.redis_client import redis_client


class CacheService:
    """Service for managing application-level caching with smart invalidation"""

    def __init__(self):
        self.default_ttl = 300  # 5 minutes default
        self.cache_prefix = "panel_cache"

        # Cache TTL configurations for different data types (optimized for instant updates)
        self.cache_ttl_config = {
            "games": 300,  # 5 minutes - longer TTL but instant invalidation
            "projects": 300,  # 5 minutes - longer TTL but instant invalidation
            "settings": 600,  # 10 minutes - settings change rarely
            "stats": 120,  # 2 minutes - stats change frequently
            "user_data": 60,  # 1 minute - user data changes frequently
            "analytics": 300,  # 5 minutes - analytics are expensive to compute
            "rbac": 600,  # 10 minutes - RBAC data changes rarely
        }

        # Cache tags for smart invalidation
        self.cache_tags = {
            "games": ["project", "game"],
            "projects": ["project", "user"],
            "settings": ["project", "user"],
            "stats": ["project", "user"],
            "user_data": ["user"],
            "analytics": ["project", "user"],
            "rbac": ["user", "role"],
        }

    def _generate_cache_key(self, cache_type: str, **kwargs) -> str:
        """Generate a unique cache key based on type and parameters"""
        # Sort kwargs to ensure consistent key generation
        sorted_kwargs = sorted(kwargs.items())
        key_data = f"{cache_type}:{':'.join(f'{k}={v}' for k, v in sorted_kwargs)}"

        # Create hash for long keys
        if len(key_data) > 200:
            key_hash = hashlib.md5(key_data.encode()).hexdigest()
            key_data = f"{cache_type}:{key_hash}"

        return f"{self.cache_prefix}:{key_data}"

    def _generate_tag_key(self, tag_type: str, tag_value: str) -> str:
        """Generate a tag key for smart invalidation"""
        return f"{self.cache_prefix}:tag:{tag_type}:{tag_value}"

    def _add_cache_tags(self, cache_key: str, cache_type: str, **kwargs) -> bool:
        """Add cache tags for smart invalidation"""
        try:
            tags = self.cache_tags.get(cache_type, [])
            for tag in tags:
                if tag in kwargs:
                    tag_key = self._generate_tag_key(tag, str(kwargs[tag]))
                    # Add cache key to tag set
                    redis_client.client.sadd(tag_key, cache_key)
                    # Set tag expiration
                    redis_client.client.expire(
                        tag_key, self.cache_ttl_config.get(cache_type, self.default_ttl)
                    )
            return True
        except Exception as e:
            logging.error(f"Error adding cache tags: {e}")
            return False

    def _invalidate_by_tags(self, tag_type: str, tag_value: str) -> int:
        """Invalidate cache entries by tag"""
        try:
            tag_key = self._generate_tag_key(tag_type, str(tag_value))
            cache_keys = redis_client.client.smembers(tag_key)

            if cache_keys:
                deleted_count = redis_client.client.delete(*cache_keys)
                # Remove the tag itself
                redis_client.client.delete(tag_key)
                logging.info(
                    f"Invalidated {deleted_count} cache entries by tag {tag_type}={tag_value}"
                )
                return deleted_count
            return 0
        except Exception as e:
            logging.error(f"Error invalidating by tag {tag_type}={tag_value}: {e}")
            return 0

    def get(self, cache_type: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Get cached data"""
        try:
            cache_key = self._generate_cache_key(cache_type, **kwargs)
            cached_data = redis_client.get_json(cache_key)

            if cached_data:
                logging.debug(f"Cache HIT for key: {cache_key}")
                return cached_data
            else:
                logging.debug(f"Cache MISS for key: {cache_key}")
                return None

        except Exception as e:
            logging.error(f"Cache GET error for type {cache_type}: {e}")
            return None

    def set(
        self, cache_type: str, data: Dict[str, Any], ttl: Optional[int] = None, **kwargs
    ) -> bool:
        """Set cached data with smart tagging"""
        try:
            cache_key = self._generate_cache_key(cache_type, **kwargs)

            # Use provided TTL or default for cache type
            if ttl is None:
                ttl = self.cache_ttl_config.get(cache_type, self.default_ttl)

            # Add metadata to cached data
            cache_data = {
                "data": data,
                "cached_at": datetime.utcnow().isoformat(),
                "ttl": ttl,
                "cache_type": cache_type,
            }

            success = redis_client.set_json(cache_key, cache_data, ex=ttl)

            if success:
                # Add cache tags for smart invalidation
                self._add_cache_tags(cache_key, cache_type, **kwargs)
                logging.debug(f"Cache SET for key: {cache_key} (TTL: {ttl}s)")
            else:
                logging.warning(f"Cache SET failed for key: {cache_key}")

            return success

        except Exception as e:
            logging.error(f"Cache SET error for type {cache_type}: {e}")
            return False

    def delete(self, cache_type: str, **kwargs) -> bool:
        """Delete cached data"""
        try:
            cache_key = self._generate_cache_key(cache_type, **kwargs)
            success = redis_client.delete(cache_key)

            if success:
                logging.debug(f"Cache DELETE for key: {cache_key}")
            else:
                logging.debug(f"Cache DELETE failed for key: {cache_key}")

            return success

        except Exception as e:
            logging.error(f"Cache DELETE error for type {cache_type}: {e}")
            return False

    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all cache keys matching a pattern"""
        try:
            full_pattern = f"{self.cache_prefix}:{pattern}*"

            # Use Redis SCAN to find matching keys
            deleted_count = 0
            cursor = 0

            while True:
                # Use SCAN to find keys matching the pattern
                result = redis_client.scan(cursor, match=full_pattern, count=100)
                cursor, keys = result

                if keys:
                    # Delete all matching keys
                    deleted_count += redis_client.delete(*keys)
                    logging.debug(
                        f"Deleted {len(keys)} cache keys matching pattern: {full_pattern}"
                    )

                # If cursor is 0, we've completed the scan
                if cursor == 0:
                    break

            logging.info(
                f"Cache invalidation completed for pattern: {full_pattern} ({deleted_count} keys deleted)"
            )
            return deleted_count

        except Exception as e:
            logging.error(f"Cache invalidation error for pattern {pattern}: {e}")
            # Fallback: try to delete common game cache keys manually
            try:
                common_keys = [
                    f"{self.cache_prefix}:games:project_id={pattern.split('project_id=')[1].split(':')[0]}:*",
                    f"{self.cache_prefix}:games:project_id={pattern.split('project_id=')[1].split(':')[0]}:type=all*",
                    f"{self.cache_prefix}:games:project_id={pattern.split('project_id=')[1].split(':')[0]}:type=multi_app*",
                    f"{self.cache_prefix}:games:project_id={pattern.split('project_id=')[1].split(':')[0]}:type=game_library*",
                ]
                deleted_count = 0
                for key_pattern in common_keys:
                    try:
                        keys = redis_client.keys(key_pattern)
                        if keys:
                            deleted_count += redis_client.delete(*keys)
                    except:
                        pass
                logging.info(
                    f"Fallback cache invalidation completed ({deleted_count} keys deleted)"
                )
                return deleted_count
            except:
                return 0

    def invalidate_project_cache(self, project_id: int) -> bool:
        """Invalidate all cache entries for a specific project"""
        try:
            # Use pattern matching to delete all cache entries for this project
            # This will match keys with any user_id
            pattern = f"panel_cache:games:project_id={project_id}:*"
            deleted_count = self.invalidate_pattern(pattern)

            # Also invalidate other project-specific cache
            patterns = [
                f"panel_cache:projects:project_id={project_id}*",
                f"panel_cache:settings:project_id={project_id}*",
                f"panel_cache:stats:project_id={project_id}*",
            ]

            for pattern in patterns:
                self.invalidate_pattern(pattern)

            logging.info(
                f"Cache invalidated for project {project_id} ({deleted_count} keys deleted)"
            )
            return True

        except Exception as e:
            logging.error(f"Cache invalidation error for project {project_id}: {e}")
            return False

    def invalidate_user_cache(self, user_id: int) -> bool:
        """Invalidate all cache entries for a specific user"""
        try:
            self.delete("user_data", user_id=user_id)
            logging.info(f"Cache invalidated for user {user_id}")
            return True

        except Exception as e:
            logging.error(f"Cache invalidation error for user {user_id}: {e}")
            return False

    def invalidate_by_tag(self, tag_type: str, tag_value: str) -> int:
        """Smart invalidation by tag - INSTANT updates without waiting for TTL"""
        try:
            deleted_count = self._invalidate_by_tags(tag_type, tag_value)
            logging.info(
                f"Smart invalidation by tag {tag_type}={tag_value}: {deleted_count} keys deleted"
            )
            return deleted_count
        except Exception as e:
            logging.error(f"Smart invalidation error for tag {tag_type}={tag_value}: {e}")
            return 0

    def invalidate_game_instantly(self, project_id: int, game_id: int = None) -> int:
        """INSTANT invalidation of game cache - no waiting for TTL"""
        try:
            total_deleted = 0

            # Invalidate by project tag
            total_deleted += self.invalidate_by_tag("project", project_id)

            # Invalidate by game tag if specific game
            if game_id:
                total_deleted += self.invalidate_by_tag("game", game_id)

            # Enhanced pattern-based invalidation for comprehensive coverage
            patterns = [
                f"games:project_id={project_id}:*",
                f"games:project_id={project_id}:type=all*",
                f"games:project_id={project_id}:type=multi_app*",
                f"games:project_id={project_id}:type=game_library*",
                f"games:project_id={project_id}:user_id=*",  # User-specific game caches
                f"games:project_id={project_id}:status=*",  # Status-specific caches
                f"games:project_id={project_id}:active=*",  # Active status caches
            ]

            # Add specific game patterns if game_id is provided
            if game_id:
                patterns.extend(
                    [
                        f"games:game_id={game_id}:*",
                        f"games:project_id={project_id}:game_id={game_id}:*",
                    ]
                )

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            # Force immediate cache refresh by setting a marker
            if game_id:
                marker_key = f"{self.cache_prefix}:game_updated:{project_id}:{game_id}"
                redis_client.set(marker_key, "updated", ex=60)  # 1 minute marker

            logging.info(
                f"INSTANT game cache invalidation: {total_deleted} keys deleted for project {project_id}, game {game_id}"
            )
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT game cache invalidation error: {e}")
            return 0

    def invalidate_project_instantly(self, project_id: int) -> int:
        """INSTANT invalidation of project cache - no waiting for TTL"""
        try:
            total_deleted = 0

            # Invalidate by project tag
            total_deleted += self.invalidate_by_tag("project", project_id)

            # Fallback to pattern-based invalidation
            patterns = [
                f"projects:project_id={project_id}*",
                f"settings:project_id={project_id}*",
                f"stats:project_id={project_id}*",
            ]

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            logging.info(f"INSTANT project cache invalidation: {total_deleted} keys deleted")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT project cache invalidation error: {e}")
            return 0

    def write_through_cache(
        self, cache_type: str, data: Dict[str, Any], write_func: Callable, **kwargs
    ) -> bool:
        """Write-through caching: write to DB first, then cache"""
        try:
            # Write to database first
            write_result = write_func(data)

            if write_result:
                # Only cache if write was successful
                self.set(cache_type, data, **kwargs)
                logging.info(f"Write-through cache: data written to DB and cached for {cache_type}")
                return True
            else:
                logging.warning(f"Write-through cache: DB write failed for {cache_type}")
                return False

        except Exception as e:
            logging.error(f"Write-through cache error for {cache_type}: {e}")
            return False

    def get_or_set(
        self, cache_type: str, fetch_func: Callable, ttl: Optional[int] = None, **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Get from cache or fetch and cache the result"""
        try:
            # Try to get from cache first
            cached_data = self.get(cache_type, **kwargs)
            if cached_data is not None:
                return cached_data.get("data")

            # Cache miss - fetch data
            logging.debug(f"Cache miss for {cache_type}, fetching data...")
            fresh_data = fetch_func()

            if fresh_data is not None:
                # Cache the fresh data
                self.set(cache_type, fresh_data, ttl=ttl, **kwargs)
                return fresh_data
            else:
                logging.warning(f"Fetch function returned None for {cache_type}")
                return None

        except Exception as e:
            logging.error(f"Cache get_or_set error for type {cache_type}: {e}")
            # Fallback to direct fetch
            try:
                return fetch_func()
            except Exception as fetch_error:
                logging.error(f"Fallback fetch also failed for {cache_type}: {fetch_error}")
                return None

    def warm_cache(self, cache_type: str, fetch_func: Callable, **kwargs) -> bool:
        """Pre-warm cache with data"""
        try:
            logging.info(f"Warming cache for {cache_type}")
            data = fetch_func()
            if data is not None:
                return self.set(cache_type, data, **kwargs)
            return False
        except Exception as e:
            logging.error(f"Cache warming error for {cache_type}: {e}")
            return False

    def cleanup_expired_cache(self) -> int:
        """Clean up expired cache entries"""
        try:
            # Get all cache keys
            pattern = f"{self.cache_prefix}:*"
            keys = redis_client.keys(pattern)

            cleaned_count = 0
            for key in keys:
                try:
                    # Check if key exists (Redis automatically removes expired keys)
                    if not redis_client.client.exists(key):
                        cleaned_count += 1
                except:
                    pass

            logging.info(f"Cache cleanup completed: {cleaned_count} expired keys removed")
            return cleaned_count

        except Exception as e:
            logging.error(f"Cache cleanup error: {e}")
            return 0

    def clear_all_cache(self) -> int:
        """Clear all cache entries"""
        try:
            pattern = f"{self.cache_prefix}:*"
            keys = redis_client.keys(pattern)

            if keys:
                deleted_count = redis_client.client.delete(*keys)
                logging.info(f"Cleared all cache: {deleted_count} keys deleted")
                return deleted_count
            else:
                logging.info("No cache keys to clear")
                return 0

        except Exception as e:
            logging.error(f"Clear all cache error: {e}")
            return 0

    def force_refresh_game_cache(self, project_id: int, game_id: int = None) -> bool:
        """Force refresh game cache by invalidating and immediately re-caching"""
        try:
            # First invalidate all related cache
            self.invalidate_game_instantly(project_id, game_id)

            # Force immediate re-cache by calling the service
            from ..games import game_service

            game_service.get_game_simple_cached(project_id)

            logging.info(f"Force refreshed game cache for project {project_id}, game {game_id}")
            return True

        except Exception as e:
            logging.error(f"Force refresh cache error: {e}")
            return False

    def force_refresh_loader_cache(self, project_id: int, loader_id: int = None) -> bool:
        """Force refresh loader cache by invalidating and immediately re-caching"""
        try:
            # First invalidate all related cache
            patterns = [f"loaders:project_id={project_id}:*"]
            if loader_id:
                patterns.append(f"loaders:loader_id={loader_id}:*")

            total_deleted = 0
            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            logging.info(
                f"Force refreshed loader cache for project {project_id}, loader {loader_id} ({total_deleted} keys deleted)"
            )
            return True

        except Exception as e:
            logging.error(f"Force refresh loader cache error: {e}")
            return False

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            # Get actual Redis stats
            pattern = f"{self.cache_prefix}:*"
            keys = redis_client.keys(pattern)

            # Calculate total memory usage
            total_memory = 0
            for key in keys:
                try:
                    memory_usage = redis_client.client.memory_usage(key)
                    total_memory += memory_usage
                except:
                    pass

            return {
                "cache_prefix": self.cache_prefix,
                "default_ttl": self.default_ttl,
                "cache_types": list(self.cache_ttl_config.keys()),
                "total_keys": len(keys),
                "total_memory_bytes": total_memory,
                "total_memory_mb": round(total_memory / 1024 / 1024, 2),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logging.error(f"Cache stats error: {e}")
            return {}


# Global instance
cache_service = CacheService()
