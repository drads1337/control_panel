"""
Example Gunicorn configuration with mTLS enabled
Copy this to gunicorn.conf.py and configure certificate paths
"""

import os

# Basic Gunicorn configuration
bind = "0.0.0.0:5001"
workers = 9
worker_class = "gthread"
threads = 2
worker_connections = 1000
timeout = 120
graceful_timeout = 300
keepalive = 10
max_requests = 2000
max_requests_jitter = 200
preload_app = True
reload = False
accesslog = "-"
errorlog = "-"
loglevel = "info"
worker_tmp_dir = "/dev/shm"

# SECURITY: Mutual TLS (mTLS) Configuration
# Enable mTLS by setting MTLS_ENABLED=true and providing certificate paths
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false").lower() == "true"

if MTLS_ENABLED:
    # Server certificate and key (required for HTTPS)
    # These are used for the server's TLS certificate
    keyfile = os.environ.get("MTLS_SERVER_KEY", "/etc/ssl/private/server.key")
    certfile = os.environ.get("MTLS_SERVER_CERT", "/etc/ssl/certs/server.crt")
    
    # CA certificate for validating client certificates (required for mTLS)
    # This CA certificate is used to verify that client certificates are valid
    ca_certs = os.environ.get("MTLS_CA_CERT_PATH", "/etc/ssl/certs/ca-cert.pem")
    
    # Require client certificate verification
    # cert_reqs values:
    #   0 = SSL_VERIFY_NONE (no verification - insecure, not recommended)
    #   1 = SSL_VERIFY_PEER (verify client certificate if present)
    #   2 = SSL_VERIFY_PEER | SSL_VERIFY_FAIL_IF_NO_PEER_CERT (require and verify client certificate)
    cert_reqs = 2  # Require client certificate
    
    # Optional: Configure SSL/TLS version and ciphers
    # ssl_version = 2  # TLSv1.2 (default)
    # ssl_ciphers = "HIGH:!aNULL:!MD5"  # Strong ciphers only
    
    # Log mTLS configuration at startup
    import logging
    logger = logging.getLogger("gunicorn.error")
    logger.info("=" * 60)
    logger.info("mTLS ENABLED")
    logger.info(f"  Server Certificate: {certfile}")
    logger.info(f"  Server Key: {keyfile}")
    logger.info(f"  CA Certificate: {ca_certs}")
    logger.info(f"  Client Certificate Required: Yes")
    logger.info("=" * 60)
else:
    # If mTLS is disabled, you can still use HTTPS without client certificates
    # Uncomment and configure these if you want HTTPS without mTLS:
    # keyfile = os.environ.get("SSL_KEY", "/etc/ssl/private/server.key")
    # certfile = os.environ.get("SSL_CERT", "/etc/ssl/certs/server.crt")
    import logging
    logger = logging.getLogger("gunicorn.error")
    logger.info("mTLS is disabled. Set MTLS_ENABLED=true to enable.")

