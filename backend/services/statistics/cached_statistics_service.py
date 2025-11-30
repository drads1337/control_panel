"""
Cached Statistics Service
Manages cache invalidation for statistics to avoid race conditions.

Instead of incrementing/decrementing counters (which causes race conditions),
this service invalidates cached statistics, forcing recalculation on next read.

This approach:
- Eliminates race conditions (no concurrent writes to counters)
- Ensures data consistency (counters are recalculated from source data)
- Uses cached COUNT queries for performance
"""

import logging
from typing import Optional

from ...core.extensions import db
from ...models import Key, User
from ...models.core import Project
from ...utils.service_exceptions import ServiceError

logger = logging.getLogger(__name__)

class CachedStatisticsService:
    """
    Service for managing cached statistics with cache invalidation.
    
    Instead of maintaining denormalized counters (which are prone to race conditions),
    this service invalidates cached statistics when data changes, forcing recalculation
    on the next read using COUNT queries.
    """

    def __init__(self, cache_service=None):
        self.cache_service = cache_service

    @property
    def _cache_service(self):
        """Get cache service instance via DI container"""
        if self.cache_service is not None:
            return self.cache_service


        from ...utils.service_exceptions import ServiceError
        raise ServiceError(
            "CacheService dependency not injected",
            status_code=500
        )

    def invalidate_on_key_change(self, user_id: Optional[int], project_id: Optional[int] = None):
        """
        Invalidate cached statistics when a key is created, deleted, or modified.
        
        This should be called instead of increment_user_key_counters/decrement_user_key_counters
        to avoid race conditions.
        
        Args:
            user_id: ID of the user whose keys changed
            project_id: Optional project ID for project-level statistics
        """
        try:

            if user_id:
                cache_patterns = [
                    f"stats:user:{user_id}*",
                    f"user_stats:{user_id}*",
                ]
                for pattern in cache_patterns:
                    self._cache_service.invalidate_pattern(pattern)
            

            if project_id:
                cache_patterns = [
                    f"stats:project:{project_id}*",
                    f"project_stats:{project_id}*",
                ]
                for pattern in cache_patterns:
                    self._cache_service.invalidate_pattern(pattern)
            

            if user_id:
                self._cache_service.delete("user_data", user_id=user_id)
            if project_id:
                self._cache_service.delete("projects", project_id=project_id)
            
            logger.debug(
                f"Invalidated statistics cache for user_id={user_id}, project_id={project_id}"
            )
        except Exception as e:
            logger.warning(f"Failed to invalidate statistics cache: {e}")

    def invalidate_on_user_change(self, project_id: Optional[int]):
        """
        Invalidate cached statistics when a user is created, deleted, or modified.
        
        Args:
            project_id: Project ID for project-level statistics
        """
        try:
            if project_id:
                cache_patterns = [
                    f"stats:project:{project_id}*",
                    f"project_stats:{project_id}*",
                ]
                for pattern in cache_patterns:
                    self._cache_service.invalidate_pattern(pattern)
                self._cache_service.delete("projects", project_id=project_id)
            
            logger.debug(f"Invalidated statistics cache for project_id={project_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate statistics cache: {e}")

    def invalidate_on_product_change(self, project_id: Optional[int]):
        """
        Invalidate cached statistics when a product is created, deleted, or modified.
        
        Args:
            project_id: Project ID for project-level statistics
        """
        try:
            if project_id:
                cache_patterns = [
                    f"stats:project:{project_id}*",
                    f"project_stats:{project_id}*",
                ]
                for pattern in cache_patterns:
                    self._cache_service.invalidate_pattern(pattern)
                self._cache_service.delete("projects", project_id=project_id)
                self._cache_service.delete("products", project_id=project_id)
            
            logger.debug(f"Invalidated statistics cache for project_id={project_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate statistics cache: {e}")

    def invalidate_on_server_change(self, project_id: Optional[int]):
        """
        Invalidate cached statistics when a server is created, deleted, or modified.
        
        Args:
            project_id: Project ID for project-level statistics
        """
        try:
            if project_id:
                cache_patterns = [
                    f"stats:project:{project_id}*",
                    f"project_stats:{project_id}*",
                ]
                for pattern in cache_patterns:
                    self._cache_service.invalidate_pattern(pattern)
                self._cache_service.delete("projects", project_id=project_id)
            
            logger.debug(f"Invalidated statistics cache for project_id={project_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate statistics cache: {e}")

