"""
Core application package

This package contains core application components:
- app.py: Flask application factory
- blueprints.py: Blueprint registration
- celery_app.py: Celery application configuration
- error_handlers.py: Global error handlers
- extensions.py: Flask extensions initialization
- system_routes.py: System-level routes

Import components directly from their modules:
- from .app import create_app
- from .blueprints import register_blueprints
- etc.
"""

__all__ = []
