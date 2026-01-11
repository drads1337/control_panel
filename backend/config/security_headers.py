"""
Security Headers Configuration
Adds security headers to all Flask responses for defense-in-depth.

SECURITY: This module adds security headers that complement nginx configuration.
Even if nginx is misconfigured, these headers provide protection.

Headers added:
- Content-Security-Policy (CSP): Prevents XSS attacks
- X-Content-Type-Options: Prevents MIME type sniffing
- X-Frame-Options: Prevents clickjacking
- X-XSS-Protection: Legacy XSS protection
- Referrer-Policy: Controls referrer information
- Permissions-Policy: Controls browser features
- Strict-Transport-Security (HSTS): Forces HTTPS
"""

import logging
import os
from flask import Flask, request

logger = logging.getLogger(__name__)


def setup_security_headers(app: Flask) -> None:
    """
    Configure security headers for all Flask responses.

    This function pre-calculates the CSP policy and adds an after_request 
    handler to apply security headers globally.
    """

    csp_policy = os.environ.get('CSP_POLICY')

    if not csp_policy:
        # Define defaults and fetch overrides from environment
        directives = [
            f"default-src {os.environ.get('CSP_DEFAULT_SRC', \"'self'\")}",
            f"script-src {os.environ.get('CSP_SCRIPT_SRC', \"'self' 'unsafe-inline' 'unsafe-eval' https:\")}",
            f"style-src {os.environ.get('CSP_STYLE_SRC', \"'self' 'unsafe-inline' https:\")}",
            f"img-src {os.environ.get('CSP_IMG_SRC', \"'self' data: https: blob:\")}",
            f"font-src {os.environ.get('CSP_FONT_SRC', \"'self' data: https:\")}",
            f"connect-src {os.environ.get('CSP_CONNECT_SRC', \"'self' https: wss: ws:\")}",
            f"frame-ancestors {os.environ.get('CSP_FRAME_ANCESTORS', \"'none'\")}",
            f"base-uri {os.environ.get('CSP_BASE_URI', \"'self'\")}",
            f"form-action {os.environ.get('CSP_FORM_ACTION', \"'self'\")}",
            f"object-src {os.environ.get('CSP_OBJECT_SRC', \"'none'\")}",
            f"media-src {os.environ.get('CSP_MEDIA_SRC', \"'self' https:\")}",
            f"worker-src {os.environ.get('CSP_WORKER_SRC', \"'self' blob:\")}",
        ]

        # Optional boolean flags
        if os.environ.get('CSP_UPGRADE_INSECURE_REQUESTS', 'true').lower() == 'true':
            directives.append("upgrade-insecure-requests")

        if os.environ.get('CSP_BLOCK_MIXED_CONTENT', 'true').lower() == 'true':
            directives.append("block-all-mixed-content")

        if os.environ.get('CSP_REQUIRE_TRUSTED_TYPES', 'true').lower() == 'true':
            directives.append("require-trusted-types-for 'script'")

        csp_policy = "; ".join(directives)

    @app.after_request
    def add_security_headers(response):
        """
        Add security headers to all responses.
        """
        # Standard Security Headers
        response.headers['Content-Security-Policy'] = csp_policy
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        # HSTS & Secure Context Headers (Only over HTTPS)
        if request.is_secure or request.headers.get('X-Forwarded-Proto') == 'https':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
            response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'

        return response

    logger.info("Security headers configured for all responses")