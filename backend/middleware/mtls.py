"""
Mutual TLS (mTLS) Middleware
Validates client certificates for agent/client connections to prevent request emulation
"""

import logging
import os
from functools import wraps
from typing import Optional

from flask import jsonify, request

from ..config.config import Config

logger = logging.getLogger(__name__)


class MTLSValidator:
    """
    Validates client certificates for mTLS connections.
    
    SECURITY: mTLS provides strong authentication for agent connections,
    making it much harder to emulate requests even if challenge obfuscation
    is reverse-engineered.
    """
    
    def __init__(self):
        self.enabled = os.environ.get("MTLS_ENABLED", "false").lower() == "true"
        self.ca_cert_path = os.environ.get("MTLS_CA_CERT_PATH")
        self.required_cn = os.environ.get("MTLS_REQUIRED_CN")  # Common Name pattern
        
        if self.enabled and not self.ca_cert_path:
            logger.warning(
                "MTLS_ENABLED is true but MTLS_CA_CERT_PATH is not set. "
                "mTLS validation will be disabled."
            )
            self.enabled = False
    
    def validate_client_certificate(self) -> tuple[bool, Optional[str]]:
        """
        Validate client certificate from request.
        
        SECURITY: This method validates client certificates passed from Nginx/WSGI server.
        Critical security considerations:
        1. Headers can be spoofed if Nginx is misconfigured
        2. Always prefer request.environ (WSGI) over HTTP headers
        3. Validate that verification status is "SUCCESS" (not "NONE" or "FAILED")
        4. Log suspicious patterns (e.g., verification status without certificate)
        5. Verify that request comes from trusted proxy (prevents header spoofing)
        6. Strictly require WSGI variables if configured (MTLS_REQUIRE_WSGI_VARS)
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.enabled:
            return True, None
        
        # SECURITY: Verify that request comes from trusted proxy
        # This prevents attackers from directly connecting to the application
        # and spoofing mTLS headers
        if not self._is_trusted_proxy():
            logger.error(
                f"[MTLS_SECURITY] Request from untrusted proxy: {request.remote_addr}. "
                f"Path: {request.path}. "
                "mTLS validation requires requests to come through trusted reverse proxy (Nginx)."
            )
            return False, "Request must come through trusted reverse proxy"
        
        # SECURITY: Prefer WSGI environment variables over HTTP headers
        # WSGI variables (SSL_CLIENT_*) are set by the WSGI server and are harder to spoof
        # HTTP headers (X-SSL-Client-*) are set by reverse proxy and can be spoofed if misconfigured
        client_cert = request.environ.get("SSL_CLIENT_CERT")
        client_verify = request.environ.get("SSL_CLIENT_VERIFY")
        client_dn = request.environ.get("SSL_CLIENT_S_DN")  # Distinguished Name
        
        # SECURITY: Check if WSGI variables are required (MTLS_REQUIRE_WSGI_VARS)
        # If required and not present, reject the request
        if Config.MTLS_REQUIRE_WSGI_VARS and not client_cert:
            logger.error(
                "[MTLS_SECURITY] WSGI variables required but not found. "
                "MTLS_REQUIRE_WSGI_VARS=true requires SSL_CLIENT_* WSGI variables. "
                "Ensure WSGI server (gunicorn) is configured to pass SSL_CLIENT_* variables. "
                f"IP: {request.remote_addr}, Path: {request.path}"
            )
            return False, "WSGI SSL variables required but not available"
        
        # SECURITY: Only fall back to HTTP headers if WSGI variables are not available
        # This is a security risk if Nginx is not properly configured to strip external headers
        if not client_cert:
            # Check alternative locations (depends on WSGI server configuration)
            client_cert = request.environ.get("HTTP_X_SSL_CLIENT_CERT")
            client_verify = request.environ.get("HTTP_X_SSL_CLIENT_VERIFY")
            client_dn = request.environ.get("HTTP_X_SSL_CLIENT_S_DN")
            
            # SECURITY: Log warning if using HTTP headers (potential spoofing risk)
            if client_cert:
                logger.warning(
                    "[MTLS_SECURITY] Using HTTP headers for client certificate validation. "
                    "This is less secure than WSGI environment variables. "
                    "Ensure Nginx is configured to strip external X-SSL-Client-* headers. "
                    "Consider setting MTLS_REQUIRE_WSGI_VARS=true for stricter security. "
                    f"IP: {request.remote_addr}, Path: {request.path}"
                )
        
        # SECURITY: Check for suspicious patterns
        # If verification status exists but certificate is missing, this is suspicious
        if client_verify and not client_cert:
            logger.error(
                "[MTLS_SECURITY] Suspicious pattern detected: verification status present "
                f"but certificate missing. Verify: {client_verify}, IP: {request.remote_addr}"
            )
            return False, "Invalid certificate configuration detected"
        
        if not client_cert:
            return False, "Client certificate not provided"
        
        # SECURITY: Strict validation of verification status
        # Only "SUCCESS" is acceptable. "NONE", "FAILED", or any other value is rejected.
        if client_verify != "SUCCESS":
            logger.warning(
                f"[MTLS_SECURITY] Client certificate verification failed: {client_verify}. "
                f"IP: {request.remote_addr}, Path: {request.path}"
            )
            return False, f"Client certificate verification failed: {client_verify}"
        
        # SECURITY: Validate Common Name if required
        # This provides additional layer of authentication beyond certificate validity
        if self.required_cn and client_dn:
            # Extract CN from DN (format: CN=value,OU=...,O=...)
            cn = self._extract_cn_from_dn(client_dn)
            if not cn or not self._matches_cn_pattern(cn, self.required_cn):
                logger.warning(
                    f"[MTLS_SECURITY] Client certificate CN does not match required pattern. "
                    f"CN: {cn}, Required: {self.required_cn}, IP: {request.remote_addr}"
                )
                return False, f"Client certificate CN does not match required pattern: {self.required_cn}"
        
        logger.debug(f"mTLS validation successful for client: {client_dn}")
        return True, None
    
    def _is_trusted_proxy(self) -> bool:
        """
        Check if request comes from trusted proxy.
        
        SECURITY: This prevents attackers from directly connecting to the application
        and spoofing mTLS headers. Only requests from configured trusted proxy IPs
        (e.g., Nginx) are allowed.
        
        Returns:
            True if request comes from trusted proxy, False otherwise
        """
        client_ip = request.remote_addr
        
        # Check if client IP is in trusted proxy list
        if client_ip in Config.TRUSTED_PROXY_IPS:
            return True
        
        # Also check X-Real-IP header (set by Nginx) if present
        # But only if the direct connection is from trusted proxy
        # This handles the case where Nginx forwards the real client IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            # The direct connection should still be from trusted proxy
            # X-Real-IP contains the original client IP
            # We trust it only if the direct connection is from trusted proxy
            if client_ip in Config.TRUSTED_PROXY_IPS:
                return True
        
        return False
    
    def _extract_cn_from_dn(self, dn: str) -> Optional[str]:
        """Extract Common Name from Distinguished Name string."""
        try:
            # DN format: CN=value,OU=...,O=...
            parts = dn.split(",")
            for part in parts:
                if part.strip().startswith("CN="):
                    return part.strip()[3:]  # Remove "CN=" prefix
        except Exception as e:
            logger.warning(f"Failed to extract CN from DN '{dn}': {e}")
        return None
    
    def _matches_cn_pattern(self, cn: str, pattern: str) -> bool:
        """
        Check if CN matches pattern (supports wildcards).
        
        Examples:
            - "agent-*" matches "agent-001", "agent-dev"
            - "client-*.example.com" matches "client-1.example.com"
        """
        if pattern == cn:
            return True
        
        # Simple wildcard matching
        if "*" in pattern:
            import re
            # Convert pattern to regex: "agent-*" -> "agent-.*"
            regex_pattern = pattern.replace("*", ".*")
            return bool(re.match(f"^{regex_pattern}$", cn))
        
        return False


# Global validator instance
_mtls_validator = MTLSValidator()


def require_mtls(f):
    """
    Decorator to require mTLS client certificate for endpoint.
    Supports both sync and async functions.
    
    SECURITY: This decorator validates that the client presents a valid
    client certificate, making request emulation much harder.
    
    Usage:
        @require_mtls
        @bp.route("/connect", methods=["POST"])
        async def connect():
            ...
    
    Configuration:
        - Set MTLS_ENABLED=true to enable mTLS validation
        - Set MTLS_CA_CERT_PATH to path of CA certificate (for validation)
        - Set MTLS_REQUIRED_CN to required Common Name pattern (optional)
    
    Note: mTLS must be configured at the WSGI server level (gunicorn/nginx).
    This middleware only validates the certificate presence and properties.
    """
    import inspect
    
    is_async = inspect.iscoroutinefunction(f)
    
    if is_async:
        @wraps(f)
        async def async_decorated_function(*args, **kwargs):
            is_valid, error_msg = _mtls_validator.validate_client_certificate()
            
            if not is_valid:
                logger.warning(
                    f"mTLS validation failed for {request.endpoint}: {error_msg}",
                    extra={
                        "endpoint": request.endpoint,
                        "path": request.path,
                        "ip": request.remote_addr,
                        "error": error_msg
                    }
                )
                return jsonify({"error": "Client certificate required"}), 403
            
            return await f(*args, **kwargs)
        
        return async_decorated_function
    else:
        @wraps(f)
        def sync_decorated_function(*args, **kwargs):
            is_valid, error_msg = _mtls_validator.validate_client_certificate()
            
            if not is_valid:
                logger.warning(
                    f"mTLS validation failed for {request.endpoint}: {error_msg}",
                    extra={
                        "endpoint": request.endpoint,
                        "path": request.path,
                        "ip": request.remote_addr,
                        "error": error_msg
                    }
                )
                return jsonify({"error": "Client certificate required"}), 403
            
            return f(*args, **kwargs)
        
        return sync_decorated_function


def is_mtls_enabled() -> bool:
    """Check if mTLS validation is enabled."""
    return _mtls_validator.enabled

