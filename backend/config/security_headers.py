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
        
        # Content Security Policy (CSP)
        # Matches nginx.conf policy for consistency
        # Production: Vite generates hashed assets, allowing stricter policy
        # Development: Requires 'unsafe-inline' and 'unsafe-eval' for HMR
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
        
        # X-Content-Type-Options: Prevent MIME type sniffing
        # Forces browser to respect declared Content-Type
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # X-Frame-Options: Prevent clickjacking (fallback for older browsers)
        # CSP frame-ancestors 'none' is preferred, but this provides compatibility
        response.headers['X-Frame-Options'] = 'DENY'
        
        # X-XSS-Protection: Legacy XSS protection (for older browsers)
        # Modern browsers ignore this, but it doesn't hurt
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer-Policy: Control referrer information
        # Only send referrer for same-origin requests, HTTPS->HTTPS, or downgrade
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions-Policy: Control browser features
        # Disable geolocation, microphone, camera by default
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        # Strict-Transport-Security (HSTS): Force HTTPS
        # Only add if request is HTTPS (to avoid issues in development)
        # 1 year with includeSubDomains and preload
        if request.is_secure or request.headers.get('X-Forwarded-Proto') == 'https':
            response.headers['Strict-Transport-Security'] = (
                'max-age=31536000; includeSubDomains; preload'
            )
        
        # Cross-Origin-Opener-Policy: Prevent cross-origin window access
        response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
        
        # Cross-Origin-Embedder-Policy: Require CORS for embedded resources
        # Commented out as it can break third-party integrations
        # Uncomment only if you need strict isolation
        # response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
        
        return response
    
    logger.info("Security headers configured for all responses")

