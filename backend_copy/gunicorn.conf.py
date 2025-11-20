
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