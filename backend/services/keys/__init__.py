"""
Keys services package
Contains business logic for key management and validation
"""

# Import key service facade for backward compatibility
# The facade delegates to specialized services while maintaining the original interface
from .key_service_facade import KeyServiceFacade, key_service

# Also export specialized services for direct use if needed
from .key_crud_service import KeyCRUDService, key_crud_service
from .key_bulk_operations_service import KeyBulkOperationsService, key_bulk_operations_service
from .key_status_service import KeyStatusService, key_status_service
from .key_export_service import KeyExportService, key_export_service
from .key_statistics_service import KeyStatisticsService, key_statistics_service

# Legacy imports (kept for backward compatibility)
from .key_service import KeyService  # Original service class (deprecated, use KeyServiceFacade)
from .key_validator import KeyValidator, key_validator

import sys
_current_module = sys.modules[__name__]
__all__ = sorted([
    name for name in dir(_current_module)
    if not name.startswith('_') and name not in ('sys', '_current_module')
])
del sys, _current_module
