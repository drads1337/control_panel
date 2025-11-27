"""
Settings Service
Provides cached access to project settings and configuration.

This service is a facade that delegates to SettingsRepository (database operations)
and SettingsManager (business logic, caching, response building).

Architecture:
- SettingsRepository: Database CRUD operations
- SettingsManager: Business logic, caching, response building
- SettingsService: Facade for backward compatibility
"""

import logging
from typing import Any, Dict, Optional

from .settings_manager import SettingsManager
from .settings_repository import SettingsRepository

try:
except ImportError:
    cache_service = None

logger = logging.getLogger(__name__)


class SettingsService:
    """
    Service for managing project settings with caching.
    
    This is a facade that delegates to SettingsRepository and SettingsManager
    for better separation of concerns.
    
    Single Responsibility: Facade for settings operations (backward compatibility).
    """

    def __init__(self, repository=None, manager=None, cache_service=None, logger=None):
        self.repository = repository or SettingsRepository()
        self.manager = manager or SettingsManager(
            repository=self.repository,
            cache_service=cache_service,
            logger=logger
        )
        self.logger = logger or logging.getLogger(__name__)

    def get_settings_cached(self, user_id: int, project_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get project settings with caching support.
        
        Delegates to SettingsManager for business logic.
        
        Args:
            user_id: User ID
            project_id: Optional project ID (passed by middleware)
            
        Returns:
            Dictionary with settings or error message
        """
        return self.manager.get_settings(user_id, project_id)

    def update_settings_cached(
        self, user_id: int, settings_data: Dict[str, Any], project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Update project settings and invalidate cache.
        
        Delegates to SettingsManager for business logic.
        
        Args:
            user_id: User ID
            settings_data: Dictionary with settings to update
            project_id: Optional project ID (passed by middleware)
            
        Returns:
            Dictionary with success status or error message
        """
        return self.manager.update_settings(user_id, settings_data, project_id)

    def invalidate_settings_cache(self, user_id: int) -> bool:
        """
        Invalidate settings cache for a user.
        
        Delegates to SettingsManager.
        """
        return self.manager.invalidate_settings_cache(user_id)


# Singleton instance for backward compatibility
# Service instance should be obtained via ServiceContainer:
#   from ...utils.service_helpers import get_service
#   service = get_service('settings_service')
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   settings_service = get_service('settings_service')
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   settings_service = get_service('settings_service')