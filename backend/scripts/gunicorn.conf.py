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
# This requires client certificates for agent/client connections
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false").lower() == "true"

if MTLS_ENABLED:
    # Server certificate and key (required for HTTPS)
    keyfile = os.environ.get("MTLS_SERVER_KEY", "/etc/ssl/private/server.key")
    certfile = os.environ.get("MTLS_SERVER_CERT", "/etc/ssl/certs/server.crt")
    
    # CA certificate for validating client certificates (required for mTLS)
    ca_certs = os.environ.get("MTLS_CA_CERT_PATH", "/etc/ssl/certs/ca-cert.pem")
    
    # Require client certificate verification
    # SSL_VERIFY_PEER = 2 (require and verify client certificate)
    # SSL_VERIFY_NONE = 0 (no verification - insecure, not recommended)
    cert_reqs = 2  # SSL_VERIFY_PEER - require client certificate
    
    # Optional: Set depth for certificate chain validation
    # ssl_version = 2  # TLSv1.2
    # ssl_ciphers = "HIGH:!aNULL:!MD5"
    
    # Log mTLS configuration
    import logging
    logger = logging.getLogger("gunicorn.error")
    logger.info(f"mTLS enabled: server_cert={certfile}, ca_cert={ca_certs}")
else:
    # If mTLS is disabled, you can still use HTTPS without client certificates
    # Uncomment and configure these if you want HTTPS without mTLS:
    # keyfile = os.environ.get("SSL_KEY", "/etc/ssl/private/server.key")
    # certfile = os.environ.get("SSL_CERT", "/etc/ssl/certs/server.crt")
    pass