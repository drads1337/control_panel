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
from ...utils.redis_client import get_redis_cache_client, RedisClient

class CacheService:
    """Service for managing application-level caching with smart invalidation"""

    def __init__(self):
        self.default_ttl = 60
        self.cache_prefix = "panel_cache"
        self._cache_wrapper = None

        self.cache_ttl_config = {
            "products": 60,
            "projects": 60,
            "settings": 300,
            "stats": 30,
            "user_data": 30,
            "analytics": 120,
            "rbac": 60,
            "rbac:roles": 60,
            "rbac:user_roles": 60,
            "rbac:user_permissions": 60,
            "rbac:permissions": 60,
        }

        self.smart_cache_enabled = True

        self.stale_while_revalidate = True

        self.cache_tags = {
            "products": ["project", "product"],
            "projects": ["project", "user"],
            "settings": ["project", "user"],
            "stats": ["project", "user"],
            "user_data": ["user"],
            "analytics": ["project", "user"],
            "rbac": ["user", "role"],
        }

    def _get_cache_client(self) -> RedisClient:
        """Get cache Redis client (lazy initialization)"""
        if self._cache_wrapper is None:
            self._cache_wrapper = RedisClient(instance="cache")
        return self._cache_wrapper

    def _generate_cache_key(self, cache_type: str, **kwargs) -> str:
        """Generate a unique cache key based on type and parameters"""

        sorted_kwargs = sorted(kwargs.items())
        key_data = f"{cache_type}:{':'.join(f'{k}={v}' for k, v in sorted_kwargs)}"

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

                    cache_client = get_redis_cache_client()
                    cache_client.sadd(tag_key, cache_key)

                    cache_client.expire(
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
            cache_client = get_redis_cache_client()
            cache_keys = cache_client.smembers(tag_key)

            if cache_keys:
                deleted_count = cache_client.delete(*cache_keys)

                cache_client.delete(tag_key)
                logging.info(
                    f"Invalidated {deleted_count} cache entries by tag {tag_type}={tag_value}"
                )
                return deleted_count
            return 0
        except Exception as e:
            logging.error(f"Error invalidating by tag {tag_type}={tag_value}: {e}")
            return 0

    def _check_update_markers(self, cache_type: str, **kwargs) -> bool:
        """Check if there are recent update markers that should bypass cache"""
        try:

            cache_client = self._get_cache_client()
            
            if "project_id" in kwargs:
                project_id = kwargs["project_id"]
                marker_pattern = f"{self.cache_prefix}:product_updated:{project_id}:*"
                markers = cache_client.keys(marker_pattern)

                if markers:

                    for marker_key in markers:
                        marker_value = cache_client.get(marker_key)
                        if marker_value:
                            logging.debug(f"Update marker found: {marker_key}, bypassing cache")
                            return True

                project_marker = f"{self.cache_prefix}:project_updated:{project_id}"
                if cache_client.get(project_marker):
                    logging.debug(f"Project update marker found: {project_marker}, bypassing cache")
                    return True

            if "product_id" in kwargs:
                product_id = kwargs["product_id"]
                if "project_id" in kwargs:
                    project_id = kwargs["project_id"]
                    product_marker = f"{self.cache_prefix}:product_updated:{project_id}:{product_id}"
                    if cache_client.get(product_marker):
                        logging.debug(f"Product update marker found: {product_marker}, bypassing cache")
                        return True

            if cache_type.startswith("rbac"):

                if "user_id" in kwargs:
                    user_id = kwargs["user_id"]
                    rbac_user_marker = f"{self.cache_prefix}:rbac_updated:user:{user_id}"
                    if cache_client.get(rbac_user_marker):
                        logging.debug(f"RBAC user update marker found: {rbac_user_marker}, bypassing cache")
                        return True

                if "role_id" in kwargs:
                    role_id = kwargs["role_id"]
                    rbac_role_marker = f"{self.cache_prefix}:rbac_updated:role:{role_id}"
                    if cache_client.get(rbac_role_marker):
                        logging.debug(f"RBAC role update marker found: {rbac_role_marker}, bypassing cache")
                        return True

                if "permission_id" in kwargs:
                    permission_id = kwargs["permission_id"]
                    rbac_perm_marker = f"{self.cache_prefix}:rbac_updated:permission:{permission_id}"
                    if cache_client.get(rbac_perm_marker):
                        logging.debug(f"RBAC permission update marker found: {rbac_perm_marker}, bypassing cache")
                        return True

                if "project_id" in kwargs:
                    project_id = kwargs["project_id"]
                    rbac_project_marker = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
                    if cache_client.get(rbac_project_marker):
                        logging.debug(f"RBAC project update marker found: {rbac_project_marker}, bypassing cache")
                        return True

            return False
        except Exception as e:
            logging.debug(f"Error checking update markers: {e}")
            return False

    def get(self, cache_type: str, force_refresh: bool = False, **kwargs) -> Optional[Dict[str, Any]]:
        """Get cached data with smart update marker checking"""
        try:

            if force_refresh:
                logging.debug(f"Force refresh requested, skipping cache")
                return None

            if self._check_update_markers(cache_type, **kwargs):
                logging.debug(f"Update markers detected, bypassing cache for {cache_type}")
                return None

            cache_key = self._generate_cache_key(cache_type, **kwargs)
            cache_wrapper = self._get_cache_client()
            cached_data = cache_wrapper.get_json(cache_key)

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

            if ttl is None:
                ttl = self.cache_ttl_config.get(cache_type, self.default_ttl)

            cache_data = {
                "data": data,
                "cached_at": datetime.utcnow().isoformat(),
                "ttl": ttl,
                "cache_type": cache_type,
            }

            cache_wrapper = self._get_cache_client()
            success = cache_wrapper.set_json(cache_key, cache_data, ex=ttl)

            if success:

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
            cache_wrapper = self._get_cache_client()
            success = cache_wrapper.delete(cache_key)

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

            deleted_count = 0
            cursor = 0

            cache_wrapper = self._get_cache_client()
            while True:

                result = cache_wrapper.scan(cursor, match=full_pattern, count=100)
                cursor, keys = result

                if keys:

                    deleted_count += cache_wrapper.delete(*keys)
                    logging.debug(
                        f"Deleted {len(keys)} cache keys matching pattern: {full_pattern}"
                    )

                if cursor == 0:
                    break

            logging.info(
                f"Cache invalidation completed for pattern: {full_pattern} ({deleted_count} keys deleted)"
            )
            return deleted_count

        except Exception as e:
            logging.error(f"Cache invalidation error for pattern {pattern}: {e}")

            try:
                common_keys = [
                    f"{self.cache_prefix}:products:project_id={pattern.split('project_id=')[1].split(':')[0]}:*",
                    f"{self.cache_prefix}:products:project_id={pattern.split('project_id=')[1].split(':')[0]}:type=all*",
                    f"{self.cache_prefix}:products:project_id={pattern.split('project_id=')[1].split(':')[0]}:type=multi_app*",
                    f"{self.cache_prefix}:products:project_id={pattern.split('project_id=')[1].split(':')[0]}:type=product_library*",
                ]
                deleted_count = 0
                cache_wrapper = self._get_cache_client()
                for key_pattern in common_keys:
                    try:
                        keys = cache_wrapper.keys(key_pattern)
                        if keys:
                            deleted_count += cache_wrapper.delete(*keys)
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

            pattern = f"panel_cache:products:project_id={project_id}:*"
            deleted_count = self.invalidate_pattern(pattern)

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

    def invalidate_product_instantly(self, project_id: int, product_id: int = None) -> int:
        """INSTANT invalidation of product cache - no waiting for TTL"""
        try:
            total_deleted = 0

            total_deleted += self.invalidate_by_tag("project", project_id)

            if product_id:
                total_deleted += self.invalidate_by_tag("product", product_id)

            patterns = [
                f"products:project_id={project_id}:*",
                f"products:project_id={project_id}:type=all*",
                f"products:project_id={project_id}:type=multi_app*",
                f"products:project_id={project_id}:type=product_library*",
                f"products:project_id={project_id}:user_id=*",
                f"products:project_id={project_id}:status=*",
                f"products:project_id={project_id}:active=*",
            ]

            if product_id:
                patterns.extend(
                    [
                        f"products:product_id={product_id}:*",
                        f"products:project_id={project_id}:product_id={product_id}:*",
                    ]
                )

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            cache_wrapper = self._get_cache_client()
            if product_id:
                marker_key = f"{self.cache_prefix}:product_updated:{project_id}:{product_id}"
                cache_wrapper.set(marker_key, "updated", ex=120)
            else:

                project_marker = f"{self.cache_prefix}:project_updated:{project_id}"
                cache_wrapper.set(project_marker, "updated", ex=120)

            logging.info(
                f"INSTANT product cache invalidation: {total_deleted} keys deleted for project {project_id}, product {product_id}"
            )
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT product cache invalidation error: {e}")
            return 0

    def invalidate_project_instantly(self, project_id: int) -> int:
        """INSTANT invalidation of project cache - no waiting for TTL"""
        try:
            total_deleted = 0

            total_deleted += self.invalidate_by_tag("project", project_id)

            patterns = [
                f"projects:project_id={project_id}*",
                f"settings:project_id={project_id}*",
                f"stats:project_id={project_id}*",
            ]

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            cache_wrapper = self._get_cache_client()
            project_marker = f"{self.cache_prefix}:project_updated:{project_id}"
            cache_wrapper.set(project_marker, "updated", ex=120)

            logging.info(f"INSTANT project cache invalidation: {total_deleted} keys deleted")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT project cache invalidation error: {e}")
            return 0

    def invalidate_rbac_user_instantly(self, user_id: int) -> int:
        """INSTANT invalidation of RBAC cache for a specific user"""
        try:
            total_deleted = 0

            patterns = [
                f"rbac:user_roles:user_id={user_id}*",
                f"rbac:user_permissions:user_id={user_id}*",
                f"rbac:user_id={user_id}*",
            ]

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            cache_wrapper = self._get_cache_client()
            rbac_user_marker = f"{self.cache_prefix}:rbac_updated:user:{user_id}"
            cache_wrapper.set(rbac_user_marker, "updated", ex=120)

            logging.info(f"INSTANT RBAC user cache invalidation: {total_deleted} keys deleted for user {user_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC user cache invalidation error: {e}")
            return 0

    def invalidate_rbac_role_instantly(self, role_id: int, project_id: Optional[int] = None) -> int:
        """INSTANT invalidation of RBAC cache for a specific role"""
        try:
            total_deleted = 0

            patterns = [f"rbac:roles:role_id={role_id}*"]
            if project_id:
                patterns.append(f"rbac:roles:project_id={project_id}*")

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            cache_wrapper = self._get_cache_client()
            rbac_role_marker = f"{self.cache_prefix}:rbac_updated:role:{role_id}"
            cache_wrapper.set(rbac_role_marker, "updated", ex=120)

            if project_id:
                rbac_project_marker = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
                cache_wrapper.set(rbac_project_marker, "updated", ex=120)

            logging.info(f"INSTANT RBAC role cache invalidation: {total_deleted} keys deleted for role {role_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC role cache invalidation error: {e}")
            return 0

    def invalidate_rbac_permission_instantly(self, permission_id: int, project_id: Optional[int] = None) -> int:
        """INSTANT invalidation of RBAC cache for a specific permission"""
        try:
            total_deleted = 0

            patterns = [f"rbac:permissions:permission_id={permission_id}*"]
            if project_id:
                patterns.append(f"rbac:permissions:project_id={project_id}*")

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            cache_wrapper = self._get_cache_client()
            rbac_perm_marker = f"{self.cache_prefix}:rbac_updated:permission:{permission_id}"
            cache_wrapper.set(rbac_perm_marker, "updated", ex=120)

            if project_id:
                rbac_project_marker = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
                cache_wrapper.set(rbac_project_marker, "updated", ex=120)

            logging.info(f"INSTANT RBAC permission cache invalidation: {total_deleted} keys deleted for permission {permission_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC permission cache invalidation error: {e}")
            return 0

    def invalidate_rbac_project_instantly(self, project_id: int) -> int:
        """INSTANT invalidation of all RBAC cache for a project"""
        try:
            total_deleted = 0

            patterns = [
                f"rbac:roles:project_id={project_id}*",
                f"rbac:permissions:project_id={project_id}*",
                f"rbac:project_id={project_id}*",
            ]

            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            cache_wrapper = self._get_cache_client()
            rbac_project_marker = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
            cache_wrapper.set(rbac_project_marker, "updated", ex=120)

            logging.info(f"INSTANT RBAC project cache invalidation: {total_deleted} keys deleted for project {project_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC project cache invalidation error: {e}")
            return 0

    def write_through_cache(
        self, cache_type: str, data: Dict[str, Any], write_func: Callable, **kwargs
    ) -> bool:
        """Write-through caching: write to DB first, then cache"""
        try:

            write_result = write_func(data)

            if write_result:

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
        self, cache_type: str, fetch_func: Callable, ttl: Optional[int] = None, force_refresh: bool = False, **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Get from cache or fetch and cache the result with smart update detection"""
        try:

            cached_data = self.get(cache_type, force_refresh=force_refresh, **kwargs)
            if cached_data is not None:
                data = cached_data.get("data")

                if self.stale_while_revalidate and data:
                    cached_at_str = cached_data.get("cached_at")
                    if cached_at_str:
                        try:
                            cached_at = datetime.fromisoformat(cached_at_str)
                            age_seconds = (datetime.utcnow() - cached_at).total_seconds()
                            ttl_value = cached_data.get("ttl", self.default_ttl)

                            if age_seconds > (ttl_value * 0.7):
                                logging.debug(f"Cache is stale ({age_seconds}s old), will refresh in background")

                        except Exception:
                            pass
                return data

            logging.debug(f"Cache miss or update detected for {cache_type}, fetching fresh data...")
            fresh_data = fetch_func()

            if fresh_data is not None:

                self.set(cache_type, fresh_data, ttl=ttl, **kwargs)
                return fresh_data
            else:
                logging.warning(f"Fetch function returned None for {cache_type}")
                return None

        except Exception as e:
            logging.error(f"Cache get_or_set error for type {cache_type}: {e}")

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

            pattern = f"{self.cache_prefix}:*"
            cache_wrapper = self._get_cache_client()
            keys = cache_wrapper.keys(pattern)

            cleaned_count = 0
            for key in keys:
                try:

                    if not cache_wrapper.client.exists(key):
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
            cache_wrapper = self._get_cache_client()
            keys = cache_wrapper.keys(pattern)

            if keys:
                deleted_count = cache_wrapper.client.delete(*keys)
                logging.info(f"Cleared all cache: {deleted_count} keys deleted")
                return deleted_count
            else:
                logging.info("No cache keys to clear")
                return 0

        except Exception as e:
            logging.error(f"Clear all cache error: {e}")
            return 0

    def force_refresh_product_cache(self, project_id: int, product_id: int = None) -> bool:
        """Force refresh product cache by invalidating and immediately re-caching"""
        try:

            self.invalidate_product_instantly(project_id, product_id)

            from ..products import product_service

            product_service.get_product_simple_cached(project_id)

            logging.info(f"Force refreshed product cache for project {project_id}, product {product_id}")
            return True

        except Exception as e:
            logging.error(f"Force refresh cache error: {e}")
            return False

    def force_refresh_loader_cache(self, project_id: int, agent_id: int = None) -> bool:
        """Force refresh agent cache by invalidating and immediately re-caching"""
        try:

            patterns = [f"agents:project_id={project_id}:*"]
            if agent_id:
                patterns.append(f"agents:agent_id={agent_id}:*")

            total_deleted = 0
            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)

            logging.info(
                f"Force refreshed agent cache for project {project_id}, agent {agent_id} ({total_deleted} keys deleted)"
            )
            return True

        except Exception as e:
            logging.error(f"Force refresh agent cache error: {e}")
            return False

    def should_cache(self, cache_type: str, operation_cost: str = "normal") -> bool:
        """
        Determine if caching should be used based on operation cost and smart cache settings.

        Args:
            cache_type: Type of cache operation
            operation_cost: "light", "normal", or "heavy" - only cache heavy operations by default

        Returns:
            True if caching should be used, False otherwise
        """
        if not self.smart_cache_enabled:
            return True

        if operation_cost == "heavy":
            return True
        elif operation_cost == "normal":

            frequently_accessed = ["products", "projects", "analytics"]
            return cache_type in frequently_accessed
        else:

            return False

    def get_or_set_smart(
        self,
        cache_type: str,
        fetch_func: Callable,
        operation_cost: str = "normal",
        ttl: Optional[int] = None,
        force_refresh: bool = False,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Smart get_or_set that only caches expensive operations.

        Args:
            cache_type: Type of cache
            fetch_func: Function to fetch data if cache miss
            operation_cost: "light", "normal", or "heavy" - determines if caching is used
            ttl: Optional TTL override
            force_refresh: Force refresh even if cache exists
            **kwargs: Cache key parameters

        Returns:
            Cached or fresh data
        """

        if not self.should_cache(cache_type, operation_cost):
            logging.debug(f"Skipping cache for {cache_type} (operation_cost: {operation_cost})")
            return fetch_func()

        return self.get_or_set(cache_type, fetch_func, ttl=ttl, force_refresh=force_refresh, **kwargs)

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:

            pattern = f"{self.cache_prefix}:*"
            cache_wrapper = self._get_cache_client()
            keys = cache_wrapper.keys(pattern)

            total_memory = 0
            for key in keys:
                try:
                    memory_usage = cache_wrapper.client.memory_usage(key)
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
                "smart_cache_enabled": self.smart_cache_enabled,
                "stale_while_revalidate": self.stale_while_revalidate,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logging.error(f"Cache stats error: {e}")
            return {}

cache_service = CacheService()
