"""
Keys Routes Module
Modular structure for key management routes

This module replaces the monolithic keys.py file with a modular structure:
- management.py: CRUD operations (create, read, update, delete)
- bulk_operations.py: Bulk operations (bulk delete, reset, pause, etc.)
- analytics.py: Analytics and statistics
- loader.py: Loader key operations
- validation.py: Key validation and testing
"""

from flask import Blueprint

from .analytics import analytics_bp
from .bulk_operations import bulk_operations_bp
from .loader import loader_bp

# Import all sub-blueprints
from .management import management_bp
from .validation import validation_bp

# Create main blueprint
keys_bp = Blueprint("keys", __name__)

# Register sub-blueprints with appropriate URL prefixes
# All routes will be prefixed with /api/keys (set in blueprints.py)
keys_bp.register_blueprint(management_bp)
keys_bp.register_blueprint(bulk_operations_bp)
keys_bp.register_blueprint(analytics_bp)
keys_bp.register_blueprint(loader_bp)
keys_bp.register_blueprint(validation_bp)

__all__ = ["keys_bp"]
