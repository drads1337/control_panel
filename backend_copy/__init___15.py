"""
Connect routes package

This package contains route handlers for the connect endpoint.
Provides authentication and connection management functionality.

The connect endpoint handles:
- Key validation and authentication
- Device management
- Security checks
- Analytics tracking
- Response building

Import the blueprint directly from the connect module:
- from .connect import connect_bp

For services and utilities, import directly from their source modules:
- from ...services.connect import SecurityChecker, ResponseBuilder
- from ...services.keys import KeyValidator
"""
