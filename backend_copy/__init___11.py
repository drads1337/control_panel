"""
Routes package

This package contains all route handlers organized by domain.
Each route module defines Flask blueprints that are registered in core.blueprints.

STRUCTURE STANDARDS:
===================

1. MODULAR PACKAGES (for complex modules with multiple sub-modules):
   Use directory structure when a module has multiple related functionalities:
   - routes/games/ - game management (management, prices, files, bulk_operations)
   - routes/keys/ - key management (management, bulk_operations, analytics, loader, validation)
   - routes/users/ - user management (management, profile, balance, clients, tokens, referral_codes)
   - routes/admin/ - admin operations (system, users)
   - routes/connect/ - connection handling

   Each package's __init__.py should:
   - Export only the main blueprint via __all__ (e.g., games_bp, keys_bp)
   - Import sub-blueprints and register them with the main blueprint
   - NOT re-export services or utilities (import them directly from their source modules)

2. SINGLE-FILE MODULES (for simple, focused functionality):
   Use single files for modules with focused, cohesive functionality:
   - routes/auth.py - authentication endpoints
   - routes/projects.py - project management
   - routes/settings.py - settings management
   - routes/dashboard.py - dashboard endpoints
   - routes/analytics.py - analytics endpoints
   - etc.

3. IMPORT GUIDELINES:
   - Import blueprints directly from their modules:
     from .auth import auth_bp
     from .games import games_bp

   - Import services/utilities directly from their source modules (NOT through routes):
     from ...services.connect import SecurityChecker
     from ...services.keys import KeyValidator

This structure provides clarity, maintainability, and follows Python best practices.
"""

__all__ = []
