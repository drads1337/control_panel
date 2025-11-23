"""
Settings services package
Contains business logic for settings management

Architecture:
- SettingsRepository: Database CRUD operations
- SettingsManager: Business logic, caching, response building
- SettingsService: Facade for backward compatibility
"""

from .settings_repository import SettingsRepository
from .settings_manager import SettingsManager
from .settings_service import SettingsService, settings_service

__all__ = [
    "SettingsRepository",
    "SettingsManager",
    "SettingsService",
    "settings_service",
]
