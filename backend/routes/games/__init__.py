"""
Games Routes Module
Modular structure for game management routes

This module replaces the monolithic games.py file with a modular structure:
- management.py: CRUD operations (create, read, update, delete)
- prices.py: Price management operations
- files.py: File upload and management
- bulk_operations.py: Bulk operations (bulk delete, bulk status update)

Note: Changelog functionality is implemented in routes/changelog.py
"""

from flask import Blueprint

from .bulk_operations import bulk_operations_bp
from .files import files_bp

from .management import management_bp
from .prices import prices_bp

games_bp = Blueprint("games", __name__)

games_bp.register_blueprint(management_bp)
games_bp.register_blueprint(prices_bp)
games_bp.register_blueprint(files_bp)
games_bp.register_blueprint(bulk_operations_bp)

__all__ = ["games_bp"]
