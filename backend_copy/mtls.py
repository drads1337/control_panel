"""
Mutual TLS (mTLS) Middleware
Validates client certificates for loader/client connections to prevent request emulation
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
    
    SECURITY: mTLS provides strong authentication for loader connections,
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
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.enabled:
            return True, None
        
        # In Flask/WSGI, client certificate info is available in request.environ
        # when using a reverse proxy (nginx) or WSGI server (gunicorn) with SSL
        client_cert = request.environ.get("SSL_CLIENT_CERT")
        client_verify = request.environ.get("SSL_CLIENT_VERIFY")
        client_dn = request.environ.get("SSL_CLIENT_S_DN")  # Distinguished Name
        
        if not client_cert:
            # Check alternative locations (depends on WSGI server configuration)
            client_cert = request.environ.get("HTTP_X_SSL_CLIENT_CERT")
            client_verify = request.environ.get("HTTP_X_SSL_CLIENT_VERIFY")
            client_dn = request.environ.get("HTTP_X_SSL_CLIENT_S_DN")
        
        if not client_cert:
            return False, "Client certificate not provided"
        
        if client_verify != "SUCCESS":
            return False, f"Client certificate verification failed: {client_verify}"
        
        # Validate Common Name if required
        if self.required_cn and client_dn:
            # Extract CN from DN (format: CN=value,OU=...,O=...)
            cn = self._extract_cn_from_dn(client_dn)
            if not cn or not self._matches_cn_pattern(cn, self.required_cn):
                return False, f"Client certificate CN does not match required pattern: {self.required_cn}"
        
        logger.debug(f"mTLS validation successful for client: {client_dn}")
        return True, None
    
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
            - "loader-*" matches "loader-001", "loader-dev"
            - "client-*.example.com" matches "client-1.example.com"
        """
        if pattern == cn:
            return True
        
        # Simple wildcard matching
        if "*" in pattern:
            import re
            # Convert pattern to regex: "loader-*" -> "loader-.*"
            regex_pattern = pattern.replace("*", ".*")
            return bool(re.match(f"^{regex_pattern}$", cn))
        
        return False


# Global validator instance
_mtls_validator = MTLSValidator()


def require_mtls(f):
    """
    Decorator to require mTLS client certificate for endpoint.
    
    SECURITY: This decorator validates that the client presents a valid
    client certificate, making request emulation much harder.
    
    Usage:
        @require_mtls
        @bp.route("/connect", methods=["POST"])
        def connect():
            ...
    
    Configuration:
        - Set MTLS_ENABLED=true to enable mTLS validation
        - Set MTLS_CA_CERT_PATH to path of CA certificate (for validation)
        - Set MTLS_REQUIRED_CN to required Common Name pattern (optional)
    
    Note: mTLS must be configured at the WSGI server level (gunicorn/nginx).
    This middleware only validates the certificate presence and properties.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
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
    
    return decorated_function


def is_mtls_enabled() -> bool:
    """Check if mTLS validation is enabled."""
    return _mtls_validator.enabled

