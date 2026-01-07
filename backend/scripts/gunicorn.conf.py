import os


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




# NOTE: mTLS is handled by Nginx, not Gunicorn
# Nginx processes SSL/TLS on port 443 and proxies to Gunicorn via HTTP on port 5001
# Client certificate validation happens at Nginx level and is passed to Flask via headers
# Gunicorn should NOT use SSL - it communicates with Nginx over HTTP inside Docker network

MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false").lower() == "true"

if MTLS_ENABLED:
    import logging
    logger = logging.getLogger("gunicorn.error")
    logger.info("mTLS enabled: SSL/TLS handled by Nginx, Gunicorn using HTTP")
    # Do NOT configure SSL here - Nginx handles it
    # Gunicorn receives requests from Nginx over HTTP with mTLS headers
else:
    pass