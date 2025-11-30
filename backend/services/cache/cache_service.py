"""
Cache Service
Provides intelligent caching for resource-intensive operations

Упрощения (KISS принцип):
- Теги опциональны (use_tags=False по умолчанию) - упрощает логику
- Update markers упрощены - убрана сложная проверка
- Методы invalidate_*_instantly унифицированы через _invalidate_by_patterns_and_marker
- Stale-while-revalidate выключен по умолчанию (stale_while_revalidate=False)
- Упрощен fallback в invalidate_pattern - убран сложный парсинг строк

Все изменения обратно совместимы - существующий код продолжает работать.
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

from flask import current_app

from ...core.extensions import db
from ...utils.redis_client import get_redis_cache_client, RedisClient
from ...utils.service_exceptions import ServiceError

class CacheService:
    """Service for managing application-level caching with smart invalidation"""

    def __init__(self, product_service=None):
        self._product_service = product_service
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
        self.stale_while_revalidate = False  # Упрощено: по умолчанию выключено
        self.use_tags = False  # Упрощено: теги опциональны, по умолчанию выключены
        self.use_markers = True  # Маркеры оставлены для обратной совместимости

        # Теги используются только если use_tags=True
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
    
    def _generate_pattern_set_key(self, pattern: str) -> str:
        """
        Generate a Redis Set key for storing cache keys matching a pattern.
        
        This allows O(1) lookup and deletion instead of O(N) SCAN operations.
        Pattern sets are used for efficient invalidation by pattern.
        """
        # Normalize pattern: remove wildcards and use as set key identifier
        normalized = pattern.replace("*", "").replace("?", "")
        # Use hash for long patterns to keep key names reasonable
        if len(normalized) > 100:
            import hashlib
            pattern_hash = hashlib.md5(normalized.encode()).hexdigest()
            return f"{self.cache_prefix}:pattern_set:{pattern_hash}"
        return f"{self.cache_prefix}:pattern_set:{normalized}"

    def _add_cache_tags(self, cache_key: str, cache_type: str, **kwargs) -> bool:
        """Add cache tags for smart invalidation (only if use_tags=True)"""
        if not self.use_tags:
            return True  # Теги выключены, просто возвращаем успех
        
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
        """Check if there are recent update markers that should bypass cache (упрощено)"""
        if not self.use_markers:
            return False
        
        try:
            cache_client = self._get_cache_client()
            
            # Упрощенная проверка маркеров - только основные случаи
            if "project_id" in kwargs:
                project_id = kwargs["project_id"]
                project_marker = f"{self.cache_prefix}:project_updated:{project_id}"
                if cache_client.get(project_marker):
                    logging.debug(f"Project update marker found, bypassing cache")
                    return True
                
                # Проверка маркеров продуктов для проекта
                if "product_id" in kwargs:
                    product_id = kwargs["product_id"]
                    product_marker = f"{self.cache_prefix}:product_updated:{project_id}:{product_id}"
                    if cache_client.get(product_marker):
                        logging.debug(f"Product update marker found, bypassing cache")
                        return True

            # Проверка RBAC маркеров
            if cache_type.startswith("rbac"):
                if "user_id" in kwargs:
                    user_id = kwargs["user_id"]
                    marker = f"{self.cache_prefix}:rbac_updated:user:{user_id}"
                    if cache_client.get(marker):
                        return True
                if "role_id" in kwargs:
                    role_id = kwargs["role_id"]
                    marker = f"{self.cache_prefix}:rbac_updated:role:{role_id}"
                    if cache_client.get(marker):
                        return True
                if "permission_id" in kwargs:
                    permission_id = kwargs["permission_id"]
                    marker = f"{self.cache_prefix}:rbac_updated:permission:{permission_id}"
                    if cache_client.get(marker):
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
        """Set cached data with smart tagging and pattern set tracking"""
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
                # Add to cache tags (if enabled)
                self._add_cache_tags(cache_key, cache_type, **kwargs)
                
                # Add to pattern sets for efficient invalidation
                # Track by cache_type and common patterns (project_id, user_id, etc.)
                pattern_sets = []
                
                # Pattern: cache_type:*
                pattern_sets.append(f"{cache_type}:*")
                
                # Pattern: cache_type:project_id=X:*
                if "project_id" in kwargs:
                    pattern_sets.append(f"{cache_type}:project_id={kwargs['project_id']}:*")
                    pattern_sets.append(f"*:project_id={kwargs['project_id']}:*")
                
                # Pattern: cache_type:user_id=X:*
                if "user_id" in kwargs:
                    pattern_sets.append(f"{cache_type}:user_id={kwargs['user_id']}:*")
                
                # Pattern: cache_type:product_id=X:*
                if "product_id" in kwargs:
                    pattern_sets.append(f"{cache_type}:product_id={kwargs['product_id']}:*")
                    pattern_sets.append(f"{cache_type}:project_id={kwargs.get('project_id', '*')}:product_id={kwargs['product_id']}:*")
                
                # Add cache key to all relevant pattern sets
                for pattern in pattern_sets:
                    pattern_set_key = self._generate_pattern_set_key(pattern)
                    try:
                        cache_wrapper.client.sadd(pattern_set_key, cache_key)
                        # Set TTL on pattern set (slightly longer than cache TTL to allow cleanup)
                        cache_wrapper.client.expire(pattern_set_key, ttl + 60)
                    except Exception as e:
                        logging.debug(f"Failed to add key to pattern set {pattern_set_key}: {e}")
                
                logging.debug(f"Cache SET for key: {cache_key} (TTL: {ttl}s)")
            else:
                logging.warning(f"Cache SET failed for key: {cache_key}")

            return success

        except Exception as e:
            logging.error(f"Cache SET error for type {cache_type}: {e}")
            return False

    def delete(self, cache_type: str, **kwargs) -> bool:
        """Delete cached data and remove from pattern sets"""
        try:
            cache_key = self._generate_cache_key(cache_type, **kwargs)
            cache_wrapper = self._get_cache_client()
            success = cache_wrapper.delete(cache_key)

            if success:
                # Remove from pattern sets (cleanup)
                # Note: We don't know which pattern sets contain this key, so we skip cleanup
                # Pattern sets will auto-expire with TTL, and invalidate_pattern handles cleanup
                logging.debug(f"Cache DELETE for key: {cache_key}")
            else:
                logging.debug(f"Cache DELETE failed for key: {cache_key}")

            return success

        except Exception as e:
            logging.error(f"Cache DELETE error for type {cache_type}: {e}")
            return False

    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all cache keys matching a pattern using Redis Sets for O(1) performance.
        
        OPTIMIZATION: Instead of SCAN (O(N) where N is total keys), we use Redis Sets
        to track keys by pattern. This provides:
        - O(1) lookup via SMEMBERS
        - O(M) deletion where M is keys matching pattern (not all keys)
        - No blocking of Redis during SCAN
        
        Falls back to SCAN if pattern set doesn't exist (backward compatibility).
        """
        try:
            # Normalize pattern
            if not pattern.startswith(self.cache_prefix):
                full_pattern = f"{self.cache_prefix}:{pattern}"
            else:
                full_pattern = pattern
            
            # Add * at end if not present
            if not full_pattern.endswith("*"):
                full_pattern = f"{full_pattern}*"

            cache_wrapper = self._get_cache_client()
            deleted_count = 0
            
            # Try fast path: use pattern set if available
            pattern_set_key = self._generate_pattern_set_key(full_pattern)
            try:
                # Get all keys from pattern set (O(1) operation)
                keys = cache_wrapper.client.smembers(pattern_set_key)
                
                if keys:
                    # Convert from bytes to strings if needed
                    keys_list = [k.decode() if isinstance(k, bytes) else k for k in keys]
                    
                    # Delete all keys at once (O(M) where M is keys in set)
                    deleted_count = cache_wrapper.delete(*keys_list)
                    
                    # Delete the pattern set itself
                    cache_wrapper.client.delete(pattern_set_key)
                    
                    logging.info(
                        f"Cache invalidation (fast path) completed for pattern: {full_pattern} "
                        f"({deleted_count} keys deleted from pattern set)"
                    )
                    return deleted_count
            except Exception as e:
                logging.debug(f"Pattern set not found or error for {pattern_set_key}: {e}, falling back to SCAN")
            
            # Fallback: use SCAN for backward compatibility (if pattern set doesn't exist)
            # This handles cases where keys were created before pattern set tracking was added
            cursor = 0
            scanned_keys = set()  # Use set to avoid duplicates
            
            while True:
                result = cache_wrapper.scan(cursor, match=full_pattern, count=100)
                cursor, keys = result

                if keys:
                    scanned_keys.update(keys)

                if cursor == 0:
                    break
            
            if scanned_keys:
                keys_list = [k.decode() if isinstance(k, bytes) else k for k in scanned_keys]
                deleted_count = cache_wrapper.delete(*keys_list)
                logging.info(
                    f"Cache invalidation (SCAN fallback) completed for pattern: {full_pattern} "
                    f"({deleted_count} keys deleted)"
                )
            else:
                logging.debug(f"No keys found matching pattern: {full_pattern}")

            return deleted_count

        except Exception as e:
            logging.error(f"Cache invalidation error for pattern {pattern}: {e}")
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

    def _invalidate_by_patterns_and_marker(
        self, 
        patterns: List[str], 
        marker_key: Optional[str] = None,
        marker_ttl: int = 120
    ) -> int:
        """
        Универсальный метод для инвалидации по паттернам и установки маркера.
        Упрощает дублирование кода в методах invalidate_*_instantly.
        
        Args:
            patterns: Список паттернов для инвалидации
            marker_key: Ключ маркера обновления (опционально)
            marker_ttl: TTL для маркера в секундах
            
        Returns:
            Количество удаленных ключей
        """
        try:
            total_deleted = 0
            
            # Инвалидация по паттернам
            for pattern in patterns:
                total_deleted += self.invalidate_pattern(pattern)
            
            # Установка маркера (если включены маркеры)
            if self.use_markers and marker_key:
                cache_wrapper = self._get_cache_client()
                cache_wrapper.set(marker_key, "updated", ex=marker_ttl)
            
            return total_deleted
        except Exception as e:
            logging.error(f"Error in _invalidate_by_patterns_and_marker: {e}")
            return 0

    def invalidate_product_instantly(self, project_id: int, product_id: int = None) -> int:
        """INSTANT invalidation of product cache - no waiting for TTL (упрощено)"""
        try:
            patterns = [
                f"products:project_id={project_id}:*",
                f"products:project_id={project_id}:type=all*",
                f"products:project_id={project_id}:type=multi_app*",
                f"products:project_id={project_id}:type=product_library*",
            ]

            if product_id:
                patterns.extend([
                    f"products:product_id={product_id}:*",
                    f"products:project_id={project_id}:product_id={product_id}:*",
                ])
                marker_key = f"{self.cache_prefix}:product_updated:{project_id}:{product_id}"
            else:
                marker_key = f"{self.cache_prefix}:project_updated:{project_id}"

            total_deleted = self._invalidate_by_patterns_and_marker(patterns, marker_key)
            
            logging.info(
                f"INSTANT product cache invalidation: {total_deleted} keys deleted for project {project_id}, product {product_id}"
            )
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT product cache invalidation error: {e}")
            return 0

    def invalidate_project_instantly(self, project_id: int) -> int:
        """INSTANT invalidation of project cache - no waiting for TTL (упрощено)"""
        try:
            patterns = [
                f"projects:project_id={project_id}*",
                f"settings:project_id={project_id}*",
                f"stats:project_id={project_id}*",
            ]
            marker_key = f"{self.cache_prefix}:project_updated:{project_id}"
            
            total_deleted = self._invalidate_by_patterns_and_marker(patterns, marker_key)
            
            logging.info(f"INSTANT project cache invalidation: {total_deleted} keys deleted")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT project cache invalidation error: {e}")
            return 0

    def invalidate_rbac_user_instantly(self, user_id: int) -> int:
        """INSTANT invalidation of RBAC cache for a specific user (упрощено)"""
        try:
            patterns = [
                f"rbac:user_roles:user_id={user_id}*",
                f"rbac:user_permissions:user_id={user_id}*",
                f"rbac:user_id={user_id}*",
            ]
            marker_key = f"{self.cache_prefix}:rbac_updated:user:{user_id}"
            
            total_deleted = self._invalidate_by_patterns_and_marker(patterns, marker_key)
            
            logging.info(f"INSTANT RBAC user cache invalidation: {total_deleted} keys deleted for user {user_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC user cache invalidation error: {e}")
            return 0

    def invalidate_rbac_role_instantly(self, role_id: int, project_id: Optional[int] = None) -> int:
        """INSTANT invalidation of RBAC cache for a specific role (упрощено)"""
        try:
            patterns = [f"rbac:roles:role_id={role_id}*"]
            if project_id:
                patterns.append(f"rbac:roles:project_id={project_id}*")

            marker_key = f"{self.cache_prefix}:rbac_updated:role:{role_id}"
            total_deleted = self._invalidate_by_patterns_and_marker(patterns, marker_key)

            if project_id and self.use_markers:
                cache_wrapper = self._get_cache_client()
                project_marker = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
                cache_wrapper.set(project_marker, "updated", ex=120)

            logging.info(f"INSTANT RBAC role cache invalidation: {total_deleted} keys deleted for role {role_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC role cache invalidation error: {e}")
            return 0

    def invalidate_rbac_permission_instantly(self, permission_id: int, project_id: Optional[int] = None) -> int:
        """INSTANT invalidation of RBAC cache for a specific permission (упрощено)"""
        try:
            patterns = [f"rbac:permissions:permission_id={permission_id}*"]
            if project_id:
                patterns.append(f"rbac:permissions:project_id={project_id}*")

            marker_key = f"{self.cache_prefix}:rbac_updated:permission:{permission_id}"
            total_deleted = self._invalidate_by_patterns_and_marker(patterns, marker_key)

            # Дополнительный маркер для проекта, если указан
            if project_id and self.use_markers:
                cache_wrapper = self._get_cache_client()
                project_marker = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
                cache_wrapper.set(project_marker, "updated", ex=120)

            logging.info(f"INSTANT RBAC permission cache invalidation: {total_deleted} keys deleted for permission {permission_id}")
            return total_deleted

        except Exception as e:
            logging.error(f"INSTANT RBAC permission cache invalidation error: {e}")
            return 0

    def invalidate_rbac_project_instantly(self, project_id: int) -> int:
        """INSTANT invalidation of all RBAC cache for a project (упрощено)"""
        try:
            patterns = [
                f"rbac:roles:project_id={project_id}*",
                f"rbac:permissions:project_id={project_id}*",
                f"rbac:project_id={project_id}*",
            ]
            marker_key = f"{self.cache_prefix}:rbac_updated:project:{project_id}"
            
            total_deleted = self._invalidate_by_patterns_and_marker(patterns, marker_key)
            
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
                
                # Упрощенная проверка stale-while-revalidate (только если включено)
                if self.stale_while_revalidate and data:
                    cached_at_str = cached_data.get("cached_at")
                    if cached_at_str:
                        try:
                            cached_at = datetime.fromisoformat(cached_at_str)
                            age_seconds = (datetime.utcnow() - cached_at).total_seconds()
                            ttl_value = cached_data.get("ttl", self.default_ttl)
                            
                            # Просто логируем, если кэш устарел (без фонового обновления для упрощения)
                            if age_seconds > (ttl_value * 0.7):
                                logging.debug(f"Cache is stale ({age_seconds}s old, TTL: {ttl_value}s)")
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
        """
        Clean up expired cache entries using SCAN (production-safe).
        
        SECURITY: Uses SCAN instead of KEYS to avoid blocking Redis.
        KEYS() blocks Redis and is not suitable for production.
        """
        try:
            pattern = f"{self.cache_prefix}:*"
            cache_wrapper = self._get_cache_client()
            
            # Use SCAN instead of KEYS to avoid blocking Redis
            cursor = 0
            scanned_keys = set()
            
            while True:
                result = cache_wrapper.scan(cursor, match=pattern, count=100)
                cursor, keys = result
                
                if keys:
                    scanned_keys.update(keys)
                
                if cursor == 0:
                    break
            
            cleaned_count = 0
            for key in scanned_keys:
                try:
                    # Check if key exists (expired keys are automatically removed by Redis)
                    # This is mainly for logging purposes
                    if not cache_wrapper.client.exists(key):
                        cleaned_count += 1
                except:
                    pass

            logging.info(f"Cache cleanup completed: {cleaned_count} expired keys removed (scanned {len(scanned_keys)} keys)")
            return cleaned_count

        except Exception as e:
            logging.error(f"Cache cleanup error: {e}")
            return 0

    def clear_all_cache(self) -> int:
        """
        Clear all cache entries using SCAN (production-safe).
        
        SECURITY: Uses SCAN instead of KEYS to avoid blocking Redis.
        KEYS() blocks Redis and is not suitable for production.
        """
        try:
            pattern = f"{self.cache_prefix}:*"
            cache_wrapper = self._get_cache_client()
            
            # Use SCAN instead of KEYS to avoid blocking Redis
            cursor = 0
            scanned_keys = set()
            
            while True:
                result = cache_wrapper.scan(cursor, match=pattern, count=100)
                cursor, keys = result
                
                if keys:
                    scanned_keys.update(keys)
                
                if cursor == 0:
                    break
            
            if scanned_keys:
                keys_list = [k.decode() if isinstance(k, bytes) else k for k in scanned_keys]
                deleted_count = cache_wrapper.delete(*keys_list)
                logging.info(f"Cleared all cache: {deleted_count} keys deleted (scanned {len(scanned_keys)} keys)")
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

            product_service = get_service('product_service')
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
        """
        Get cache statistics using SCAN (production-safe).
        
        SECURITY: Uses SCAN instead of KEYS to avoid blocking Redis.
        KEYS() blocks Redis and is not suitable for production.
        """
        try:
            pattern = f"{self.cache_prefix}:*"
            cache_wrapper = self._get_cache_client()
            
            # Use SCAN instead of KEYS to avoid blocking Redis
            cursor = 0
            scanned_keys = set()
            
            while True:
                result = cache_wrapper.scan(cursor, match=pattern, count=100)
                cursor, keys = result
                
                if keys:
                    scanned_keys.update(keys)
                
                if cursor == 0:
                    break
            
            total_memory = 0
            for key in scanned_keys:
                try:
                    key_str = key.decode() if isinstance(key, bytes) else key
                    memory_usage = cache_wrapper.client.memory_usage(key_str)
                    total_memory += memory_usage
                except:
                    pass

            return {
                "cache_prefix": self.cache_prefix,
                "default_ttl": self.default_ttl,
                "cache_types": list(self.cache_ttl_config.keys()),
                "total_keys": len(scanned_keys),
                "total_memory_bytes": total_memory,
                "total_memory_mb": round(total_memory / 1024 / 1024, 2),
                "smart_cache_enabled": self.smart_cache_enabled,
                "stale_while_revalidate": self.stale_while_revalidate,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logging.error(f"Cache stats error: {e}")
            return {}
