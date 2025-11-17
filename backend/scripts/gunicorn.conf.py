# Gunicorn configuration file
bind = "0.0.0.0:5001"

# 6 vCPU: Optimized to 9 workers for balanced performance
# Formula 2*CPU + 1 = 13 may be too high; 9 workers × 2 threads = 18 concurrent handlers
# This provides good CPU utilization without excessive context switching
workers = 9

# Threaded sync workers handle mixed I/O efficiently on limited CPU
worker_class = "gthread"
threads = 2
worker_connections = 1000

timeout = 120  # 2 minutes - reduced from 1800s to prevent DoS attacks via slow requests
graceful_timeout = 300  # 5 minutes for graceful shutdown
keepalive = 10

# Max-requests to mitigate leaks
max_requests = 2000
max_requests_jitter = 200

preload_app = True
reload = False

# Structured logging to stdout/stderr (handled by systemd)
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Use RAM for worker tmp to reduce disk I/O
worker_tmp_dir = "/dev/shm"
