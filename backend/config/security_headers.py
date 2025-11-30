"""
Security Headers Configuration
Adds security headers to all Flask responses for defense-in-depth.

SECURITY: This module adds security headers that complement nginx configuration.
Even if nginx is misconfigured, these headers provide protection.

Headers added:
- Content-Security-Policy (CSP): Prevents XSS attacks
- X-Content-Type-Options: Prevents MIME type sniffing
- X-Frame-Options: Prevents clickjacking (redundant with CSP frame-ancestors, but provides fallback)
- X-XSS-Protection: Legacy XSS protection (for older browsers)
- Referrer-Policy: Controls referrer information
- Permissions-Policy: Controls browser features
- Strict-Transport-Security (HSTS): Forces HTTPS (only if request is HTTPS)

Note: Some headers are also set in nginx.conf, but having them in Flask provides:
1. Defense-in-depth (works even if nginx is bypassed)
2. Works in development mode (where nginx might not be used)
3. Ensures headers are always present
"""

import logging
from flask import Flask, request

logger = logging.getLogger(__name__)


def setup_security_headers(app: Flask) -> None:
    """
    Configure security headers for all Flask responses.
    
    This function adds an after_request handler that sets security headers
    on all responses. This provides defense-in-depth protection even if
    nginx is misconfigured or bypassed.
    
    Args:
        app: Flask application instance
    """
    
    @app.after_request
    def add_security_headers(response):
        """
        Add security headers to all responses.
        
        SECURITY: These headers provide protection against common web vulnerabilities:
        - XSS (Content-Security-Policy)
        - Clickjacking (X-Frame-Options, CSP frame-ancestors)
        - MIME type sniffing (X-Content-Type-Options)
        - Protocol downgrade (Strict-Transport-Security)
        """
        




        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' data: https:; "
            "connect-src 'self' https: wss: ws:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "upgrade-insecure-requests; "
            "block-all-mixed-content; "
            "object-src 'none'; "
            "media-src 'self' https:; "
            "worker-src 'self' blob:; "
            "require-trusted-types-for 'script';"
        )
        response.headers['Content-Security-Policy'] = csp_policy
        


        response.headers['X-Content-Type-Options'] = 'nosniff'
        


        response.headers['X-Frame-Options'] = 'DENY'
        


        response.headers['X-XSS-Protection'] = '1; mode=block'
        


        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        


        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        



        if request.is_secure or request.headers.get('X-Forwarded-Proto') == 'https':
            response.headers['Strict-Transport-Security'] = (
                'max-age=31536000; includeSubDomains; preload'
            )
        

        response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
        




        
        return response
    
    logger.info("Security headers configured for all responses")

