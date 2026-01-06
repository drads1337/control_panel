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
import os
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
        




        # Get CSP policy from environment or use default
        csp_policy = os.environ.get('CSP_POLICY')
        
        if not csp_policy:
            # Build CSP policy from individual directives (configurable)
            csp_directives = []
            
            # default-src
            default_src = os.environ.get('CSP_DEFAULT_SRC', "'self'")
            csp_directives.append(f"default-src {default_src}")
            
            # script-src
            script_src = os.environ.get('CSP_SCRIPT_SRC', "'self' 'unsafe-inline' 'unsafe-eval' https:")
            csp_directives.append(f"script-src {script_src}")
            
            # style-src
            style_src = os.environ.get('CSP_STYLE_SRC', "'self' 'unsafe-inline' https:")
            csp_directives.append(f"style-src {style_src}")
            
            # img-src
            img_src = os.environ.get('CSP_IMG_SRC', "'self' data: https: blob:")
            csp_directives.append(f"img-src {img_src}")
            
            # font-src
            font_src = os.environ.get('CSP_FONT_SRC', "'self' data: https:")
            csp_directives.append(f"font-src {font_src}")
            
            # connect-src
            connect_src = os.environ.get('CSP_CONNECT_SRC', "'self' https: wss: ws:")
            csp_directives.append(f"connect-src {connect_src}")
            
            # frame-ancestors
            frame_ancestors = os.environ.get('CSP_FRAME_ANCESTORS', "'none'")
            csp_directives.append(f"frame-ancestors {frame_ancestors}")
            
            # base-uri
            base_uri = os.environ.get('CSP_BASE_URI', "'self'")
            csp_directives.append(f"base-uri {base_uri}")
            
            # form-action
            form_action = os.environ.get('CSP_FORM_ACTION', "'self'")
            csp_directives.append(f"form-action {form_action}")
            
            # upgrade-insecure-requests (optional)
            if os.environ.get('CSP_UPGRADE_INSECURE_REQUESTS', 'true').lower() == 'true':
                csp_directives.append("upgrade-insecure-requests")
            
            # block-all-mixed-content (optional)
            if os.environ.get('CSP_BLOCK_MIXED_CONTENT', 'true').lower() == 'true':
                csp_directives.append("block-all-mixed-content")
            
            # object-src
            object_src = os.environ.get('CSP_OBJECT_SRC', "'none'")
            csp_directives.append(f"object-src {object_src}")
            
            # media-src
            media_src = os.environ.get('CSP_MEDIA_SRC', "'self' https:")
            csp_directives.append(f"media-src {media_src}")
            
            # worker-src
            worker_src = os.environ.get('CSP_WORKER_SRC', "'self' blob:")
            csp_directives.append(f"worker-src {worker_src}")
            
            # require-trusted-types-for (optional)
            if os.environ.get('CSP_REQUIRE_TRUSTED_TYPES', 'true').lower() == 'true':
                csp_directives.append("require-trusted-types-for 'script'")
            
            csp_policy = "; ".join(csp_directives)
        
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
            # Cross-Origin-Opener-Policy requires secure context (HTTPS or localhost)
            # Only set it for HTTPS requests to avoid browser warnings
            response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
        
    
        return response
    
    logger.info("Security headers configured for all responses")

