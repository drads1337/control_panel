"""
CORS configuration module
Centralizes CORS setup and eliminates duplication

SECURITY NOTE:
==============
This module centralizes all CORS configuration to prevent security vulnerabilities.

HISTORICAL ISSUE (FIXED):
-------------------------
In previous versions, there was a risk of CORS configuration duplication:
- Custom @app.after_request handlers manually setting CORS headers
- Flask-CORS extension also handling CORS
- This duplication could lead to:
  * Inconsistent CORS policies
  * Potential security vulnerabilities (allowing untrusted origins)
  * Data leakage risks from misconfigured CORS

CURRENT IMPLEMENTATION:
----------------------
- Single source of truth: Only Flask-CORS is used
- Environment-based configuration (FLASK_ENV)
- Explicit origin whitelist (no wildcards in production)
- All CORS logic centralized in this module
- Custom @app.after_request handlers for CORS have been removed

IMPORTANT:
----------
- DO NOT add custom CORS headers in route handlers
- DO NOT use @app.after_request for CORS
- DO NOT manually set Access-Control-* headers
- All CORS configuration must go through this module
- OPTIONS handlers in routes should only return empty responses (Flask-CORS handles headers)
"""

from flask import Flask, request
from flask_cors import CORS

from .config import Config

def setup_cors(app: Flask) -> None:
    """
    Configure CORS for the application
    Simplified CORS configuration to eliminate duplication and security risks

    This function is the SINGLE SOURCE OF TRUTH for CORS configuration.
    All CORS headers are handled automatically by Flask-CORS.

    Security features:
    - Explicit origin whitelist (no wildcards)
    - Environment-based configuration
    - Credentials support for httpOnly cookies
    - CSRF token support

    Args:
        app: Flask application instance

    Raises:
        None (failures are logged but don't prevent app startup)
    """

    allowed_origins = _get_allowed_origins()

    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=True,
        allow_headers=[
            "Content-Type",
            "Authorization",
            "Origin",
            "Accept",
            "X-Requested-With",
            "X-CSRFToken",
            "x-csrftoken",
        ],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        expose_headers=[
            "Content-Type",
            "Authorization",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
            "X-CSRFToken",
        ],
        max_age=3600,
        automatic_options=True,
        send_wildcard=False,
    )

    import logging

    logger = logging.getLogger(__name__)
    logger.info(
        f"CORS configured with {len(allowed_origins)} origins: {allowed_origins[:3] if len(allowed_origins) > 3 else allowed_origins}"
    )

def _get_allowed_origins():
    """
    Get allowed CORS origins based on environment
    More restrictive origin validation with dynamic IP detection

    SECURITY:
    - Development: Allows localhost and local network IPs
    - Production: Only allows explicitly configured origins from environment
    - No wildcards are used (send_wildcard=False)
    - Prevents unauthorized cross-origin access

    Returns:
        list: List of allowed origin strings
    """
    import os
    import socket

    env = os.environ.get("FLASK_ENV", "development")

    if env not in ["production", "staging"]:
        env = "development"

    if env == "development":

        dev_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5001",
            "http://127.0.0.1:5173",
            "http://192.168.1.58:3000",
            "http://192.168.1.58:3001",
            "http://192.168.1.58:5001",
            "http://192.168.1.58:5173",
            "http://192.168.1.30:3000",
            "http://192.168.1.30:3001",
            "http://192.168.1.30:5001",
            "http://192.168.1.30:5173",
            "http://192.168.1.7:3000",
            "http://192.168.1.7:3001",
            "http://192.168.1.7:5001",
            "http://192.168.1.7:5173",
        ]

        try:

            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()

            dynamic_origins = [
                f"http://{local_ip}:3000",
                f"http://{local_ip}:3001",
                f"http://{local_ip}:5001",
                f"http://{local_ip}:5173",
            ]
            dev_origins.extend(dynamic_origins)
        except Exception as e:
            import logging

            logging.warning(f"Could not detect local IP for CORS: {e}")

        dev_origins.extend(Config.ALL_CORS_ORIGINS)

        return list(set(dev_origins))
    else:

        return Config.ALL_CORS_ORIGINS
