"""
CORS Configuration Module
Centralizes CORS setup and eliminates duplication.

SECURITY NOTE:
==============
This module is the SINGLE SOURCE OF TRUTH for CORS configuration.
- Prevents inconsistent policies.
- Prevents potential security vulnerabilities.
- Explicit origin whitelist (no wildcards in production).

IMPORTANT:
- DO NOT add custom CORS headers in route handlers.
- DO NOT use @app.after_request for CORS.
"""

import logging
import os
import socket
from typing import List

from flask import Flask
from flask_cors import CORS

from .config import Config

# Initialize logger
logger = logging.getLogger(__name__)


def setup_cors(app: Flask) -> None:
    """
    Configure CORS for the application.

    Arguments:
        app: Flask application instance
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

    logger.info(
        f"CORS configured with {len(allowed_origins)} origins. "
        f"Sample: {allowed_origins[:3] if len(allowed_origins) > 3 else allowed_origins}"
    )


def _get_allowed_origins() -> List[str]:
    """
    Get allowed CORS origins based on environment.

    Security:
    - Development: Allows localhost, specific LAN IPs, and dynamic local IP.
    - Production: Only allows explicitly configured origins from Config.
    """
    env = os.environ.get("FLASK_ENV", "development")
    
    # Normalizing env check
    if env not in ["production", "staging"]:
        env = "development"

    if env == "development":
        # Base development origins
        dev_origins = [
            # Localhost variants
            "http://localhost:3000", "http://localhost:3001", 
            "http://localhost:5001", "http://localhost:5173",
            "http://127.0.0.1:3000", "http://127.0.0.1:3001", 
            "http://127.0.0.1:5001", "http://127.0.0.1:5173",
            
            # Hardcoded LAN IPs (Specific to dev environment)
            "http://192.168.1.58:3000", "http://192.168.1.58:3001",
            "http://192.168.1.58:5001", "http://192.168.1.58:5173",
            "http://192.168.1.30:3000", "http://192.168.1.30:3001",
            "http://192.168.1.30:5001", "http://192.168.1.30:5173",
            "http://192.168.1.7:3000", "http://192.168.1.7:3001",
            "http://192.168.1.7:5001", "http://192.168.1.7:5173",
            "http://192.168.1.6:3000", "http://192.168.1.6:3001",
            "http://192.168.1.6:5001", "http://192.168.1.6:5173",
        ]

        # Dynamic Local IP Detection
        try:
            # Create a dummy socket connection to detect the interface IP used for routing
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
            logger.warning(f"Could not detect local IP for CORS: {e}")

        # Combine with Config origins and remove duplicates
        dev_origins.extend(Config.ALL_CORS_ORIGINS)
        return list(set(dev_origins))

    else:
        # Production: Strict whitelist
        return Config.ALL_CORS_ORIGINS