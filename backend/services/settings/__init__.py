"""
Settings services package
Contains business logic for settings management
"""

from .settings_service import SettingsService, settings_service

# Auto-generate __all__ from imports to avoid duplication
import sys
_current_module = sys.modules[__name__]
__all__ = sorted([
    name for name in dir(_current_module)
    if not name.startswith('_') and name not in ('sys', '_current_module')
])
del sys, _current_module
