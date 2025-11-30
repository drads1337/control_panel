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




MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false").lower() == "true"

if MTLS_ENABLED:

    keyfile = os.environ.get("MTLS_SERVER_KEY", "/etc/ssl/private/server.key")
    certfile = os.environ.get("MTLS_SERVER_CERT", "/etc/ssl/certs/server.crt")
    

    ca_certs = os.environ.get("MTLS_CA_CERT_PATH", "/etc/ssl/certs/ca-cert.pem")
    



    cert_reqs = 2
    



    

    import logging
    logger = logging.getLogger("gunicorn.error")
    logger.info(f"mTLS enabled: server_cert={certfile}, ca_cert={ca_certs}")
else:




    pass