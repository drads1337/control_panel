"""
Load Monitoring Service
Monitors load on critical endpoints (connect, heartbeat) and provides
warnings/alerts when load exceeds thresholds.

OPTIMIZED: Metrics are aggregated in-memory and flushed asynchronously
to Redis/Prometheus to eliminate synchronous writes from the request path.
"""

import logging
import queue
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from prometheus_client import Counter, Histogram, Gauge

from ...config.config import Config
from ...utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class LoadMonitor:
    """
    Service for monitoring load on critical endpoints.
    
    Tracks:
    - Request rate (requests per second/minute)
    - Response times (p50, p95, p99)
    - Error rates
    - Active connections
    - System resource usage
    
    OPTIMIZATION: 
    - All metrics are aggregated in-memory (lock-free where possible)
    - Metrics are flushed asynchronously via background thread
    - Prometheus metrics are updated directly (thread-safe)
    - Redis writes happen in background thread to avoid blocking requests
    """
    
    # Prometheus metrics (shared across all instances)
    _prometheus_initialized = False
    _prometheus_lock = threading.Lock()
    
    # Request counters per endpoint
    _request_counters: Dict[str, Counter] = {}
    # Error counters per endpoint
    _error_counters: Dict[str, Counter] = {}
    # Response time histograms per endpoint
    _response_time_histograms: Dict[str, Histogram] = {}
    # Active requests gauge per endpoint
    _active_requests_gauges: Dict[str, Gauge] = {}

    def __init__(self):
        self.metrics_prefix = "load_monitor"
        self.window_seconds = 60  # 1 minute window for metrics
        self.flush_interval = 5  # Flush to Redis every 5 seconds
        
        # In-memory metrics aggregation (lock-free for writes, locked for reads)
        # Structure: {endpoint: {window_start: {requests: int, errors: int, response_times: list, ip_counts: dict}}}
        self._in_memory_metrics = defaultdict(lambda: defaultdict(lambda: {
            'requests': 0,
            'errors': 0,
            'response_times': [],
            'ip_counts': defaultdict(int),
        }))
        self._metrics_lock = threading.RLock()  # Reentrant lock for nested calls
        
        # Queue for async Redis writes (non-blocking)
        self._redis_write_queue = queue.Queue(maxsize=10000)
        self._shutdown_event = threading.Event()
        
        # Background thread for async metric flushing
        self._flush_thread = None
        self._start_flush_thread()
        
        # Load thresholds (from Config)
        self.connect_warning_rps = Config.CONNECT_WARNING_RPS
        self.connect_critical_rps = Config.CONNECT_CRITICAL_RPS
        self.heartbeat_warning_rps = Config.HEARTBEAT_WARNING_RPS
        self.heartbeat_critical_rps = Config.HEARTBEAT_CRITICAL_RPS
        self.response_time_warning_ms = Config.RESPONSE_TIME_WARNING_MS
        self.response_time_critical_ms = Config.RESPONSE_TIME_CRITICAL_MS
        self.error_rate_warning_pct = Config.ERROR_RATE_WARNING_PCT
        self.error_rate_critical_pct = Config.ERROR_RATE_CRITICAL_PCT
        
        # Initialize Prometheus metrics
        self._init_prometheus_metrics()
    
    def _init_prometheus_metrics(self):
        """Initialize Prometheus metrics (thread-safe singleton)"""
        with self._prometheus_lock:
            if self._prometheus_initialized:
                return
            
            # Create shared Prometheus metrics (one instance per metric type, using labels)
            # These are shared across all endpoints
            if 'requests' not in self._request_counters:
                self._request_counters['requests'] = Counter(
                    'load_monitor_requests_total',
                    'Total number of requests',
                    ['endpoint'],
                    registry=None  # Use default registry
                )
                self._error_counters['errors'] = Counter(
                    'load_monitor_errors_total',
                    'Total number of errors',
                    ['endpoint', 'status_code'],
                    registry=None
                )
                self._response_time_histograms['response_time'] = Histogram(
                    'load_monitor_response_time_seconds',
                    'Response time in seconds',
                    ['endpoint'],
                    registry=None,
                    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
                )
                self._active_requests_gauges['active'] = Gauge(
                    'load_monitor_active_requests',
                    'Number of active requests',
                    ['endpoint'],
                    registry=None
                )
            
            self._prometheus_initialized = True
    
    def _get_prometheus_metrics(self):
        """Get Prometheus metrics (shared instances with labels)"""
        return (
            self._request_counters.get('requests'),
            self._error_counters.get('errors'),
            self._response_time_histograms.get('response_time'),
            self._active_requests_gauges.get('active')
        )
    
    def _start_flush_thread(self):
        """Start background thread for async metric flushing"""
        if self._flush_thread is None or not self._flush_thread.is_alive():
            self._shutdown_event.clear()
            self._flush_thread = threading.Thread(
                target=self._flush_worker,
                name="LoadMonitor-FlushThread",
                daemon=True
            )
            self._flush_thread.start()
            logger.info("LoadMonitor: Started background flush thread")
    
    def _flush_worker(self):
        """Background worker thread that flushes metrics periodically"""
        last_flush_time = time.time()
        
        while not self._shutdown_event.is_set():
            try:
                current_time = time.time()
                
                # Flush metrics if interval has passed
                if current_time - last_flush_time >= self.flush_interval:
                    self._flush_metrics_to_redis()
                    last_flush_time = current_time
                
                # Process Redis write queue (non-blocking, with timeout)
                try:
                    # Process up to 100 items from queue
                    for _ in range(100):
                        write_op = self._redis_write_queue.get_nowait()
                        try:
                            write_op()
                        except Exception as e:
                            logger.error(f"Failed to execute Redis write operation: {e}")
                except queue.Empty:
                    pass
                
                # Sleep briefly to avoid busy-waiting
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error in LoadMonitor flush worker: {e}", exc_info=True)
                time.sleep(1)  # Back off on error
    
    def record_request(
        self,
        endpoint: str,
        response_time_ms: float,
        status_code: int,
        ip: Optional[str] = None,
    ) -> None:
        """
        Record a request metric (in-memory only, async flush to Redis/Prometheus).
        
        This method is optimized for minimal latency:
        - In-memory aggregation (fast, lock-free for most operations)
        - Prometheus metrics updated directly (thread-safe)
        - Redis writes queued for async processing
        
        Args:
            endpoint: Endpoint name (e.g., 'connect', 'heartbeat')
            response_time_ms: Response time in milliseconds
            status_code: HTTP status code
            ip: Client IP address (optional)
        """
        try:
            current_time = int(time.time())
            window_start = current_time - (current_time % self.window_seconds)
            response_time_seconds = response_time_ms / 1000.0
            
            # Update Prometheus metrics (thread-safe, fast)
            request_counter, error_counter, response_histogram, active_gauge = \
                self._get_prometheus_metrics()
            
            if request_counter:
                request_counter.labels(endpoint=endpoint).inc()
            if response_histogram:
                response_histogram.labels(endpoint=endpoint).observe(response_time_seconds)
            
            if status_code >= 400 and error_counter:
                error_counter.labels(endpoint=endpoint, status_code=str(status_code)).inc()
            
            # Update in-memory metrics (for Redis compatibility and real-time queries)
            with self._metrics_lock:
                metrics = self._in_memory_metrics[endpoint][window_start]
                metrics['requests'] += 1
                metrics['response_times'].append(response_time_ms)
                # Keep only last 1000 response times per window to limit memory
                if len(metrics['response_times']) > 1000:
                    metrics['response_times'] = metrics['response_times'][-1000:]
                
                if status_code >= 400:
                    metrics['errors'] += 1
                
                if ip:
                    metrics['ip_counts'][ip] += 1
            
            # Queue Redis write (non-blocking, async)
            # Only queue if queue is not full (drop if overloaded to avoid blocking)
            try:
                self._redis_write_queue.put_nowait(lambda: self._write_to_redis_async(
                    endpoint, window_start, response_time_ms, status_code, ip
                ))
            except queue.Full:
                # Queue is full, skip Redis write (metrics still in Prometheus and memory)
                logger.debug(f"LoadMonitor: Redis write queue full, skipping write for {endpoint}")
                    
        except Exception as e:
            logger.error(f"Failed to record request metric: {e}", exc_info=True)
    
    def _write_to_redis_async(self, endpoint: str, window_start: int, 
                             response_time_ms: float, status_code: int, ip: Optional[str]):
        """Write a single metric to Redis (called from background thread)"""
        try:
            # Update request count
            request_key = f"{self.metrics_prefix}:{endpoint}:requests:{window_start}"
            redis_client.client.incrby(request_key, 1)
            redis_client.client.expire(request_key, self.window_seconds * 2)
            
            # Update response time (append)
            response_time_key = f"{self.metrics_prefix}:{endpoint}:response_times:{window_start}"
            redis_client.client.lpush(response_time_key, response_time_ms)
            redis_client.client.ltrim(response_time_key, 0, 999)  # Keep last 1000
            redis_client.client.expire(response_time_key, self.window_seconds * 2)
            
            # Update error count
            if status_code >= 400:
                error_key = f"{self.metrics_prefix}:{endpoint}:errors:{window_start}"
                redis_client.client.incrby(error_key, 1)
                redis_client.client.expire(error_key, self.window_seconds * 2)
            
            # Update IP count
            if ip:
                ip_key = f"{self.metrics_prefix}:{endpoint}:ip:{ip}:{window_start}"
                redis_client.client.incrby(ip_key, 1)
                redis_client.client.expire(ip_key, self.window_seconds * 2)
        except Exception as e:
            logger.debug(f"Failed to write metric to Redis (async): {e}")

    def _flush_metrics_to_redis(self) -> None:
        """
        Flush in-memory metrics to Redis (called from background thread).
        This aggregates all metrics and writes them in batches.
        """
        try:
            current_time = int(time.time())
            window_start = current_time - (current_time % self.window_seconds)
            
            # Copy metrics to avoid holding lock too long
            metrics_to_flush = {}
            with self._metrics_lock:
                for endpoint, windows in self._in_memory_metrics.items():
                    metrics_to_flush[endpoint] = {}
                    for win_start, metrics in windows.items():
                        # Only flush windows that are still active or recently closed
                        if win_start >= window_start - self.window_seconds:
                            metrics_to_flush[endpoint][win_start] = {
                                'requests': metrics['requests'],
                                'errors': metrics['errors'],
                                'response_times': metrics['response_times'].copy(),
                                'ip_counts': dict(metrics['ip_counts']),
                            }
            
            # Flush to Redis (outside lock to avoid blocking)
            for endpoint, windows in metrics_to_flush.items():
                for win_start, metrics in windows.items():
                    try:
                        # Use pipeline for batch operations
                        pipe = redis_client.client.pipeline()
                        
                        # Update request count
                        request_key = f"{self.metrics_prefix}:{endpoint}:requests:{win_start}"
                        pipe.incrby(request_key, metrics['requests'])
                        pipe.expire(request_key, self.window_seconds * 2)
                        
                        # Update response times (append all new times)
                        if metrics['response_times']:
                            response_time_key = f"{self.metrics_prefix}:{endpoint}:response_times:{win_start}"
                            for rt in metrics['response_times']:
                                pipe.lpush(response_time_key, rt)
                            pipe.ltrim(response_time_key, 0, 999)  # Keep last 1000
                            pipe.expire(response_time_key, self.window_seconds * 2)
                        
                        # Update error count
                        if metrics['errors'] > 0:
                            error_key = f"{self.metrics_prefix}:{endpoint}:errors:{win_start}"
                            pipe.incrby(error_key, metrics['errors'])
                            pipe.expire(error_key, self.window_seconds * 2)
                        
                        # Update IP counts
                        if metrics['ip_counts']:
                            for ip, count in metrics['ip_counts'].items():
                                ip_key = f"{self.metrics_prefix}:{endpoint}:ip:{ip}:{win_start}"
                                pipe.incrby(ip_key, count)
                                pipe.expire(ip_key, self.window_seconds * 2)
                        
                        pipe.execute()
                        
                        # Clear flushed metrics from memory (keep only current window)
                        with self._metrics_lock:
                            if win_start < window_start - self.window_seconds:
                                # Old window, can be removed
                                if endpoint in self._in_memory_metrics:
                                    if win_start in self._in_memory_metrics[endpoint]:
                                        del self._in_memory_metrics[endpoint][win_start]
                                    # Remove endpoint if no windows left
                                    if not self._in_memory_metrics[endpoint]:
                                        del self._in_memory_metrics[endpoint]
                    except Exception as e:
                        logger.error(f"Failed to flush metrics for {endpoint}:{win_start}: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to flush metrics to Redis: {e}", exc_info=True)

    def flush_now(self) -> None:
        """
        Force immediate flush of metrics to Redis.
        Useful for testing or graceful shutdown.
        """
        self._flush_metrics_to_redis()
        # Wait for queue to drain (with timeout)
        timeout = 5.0
        start_time = time.time()
        while not self._redis_write_queue.empty() and (time.time() - start_time) < timeout:
            time.sleep(0.1)

    def shutdown(self):
        """Gracefully shutdown the monitor (flush all metrics and stop threads)"""
        logger.info("LoadMonitor: Shutting down...")
        self._shutdown_event.set()
        self.flush_now()
        if self._flush_thread and self._flush_thread.is_alive():
            self._flush_thread.join(timeout=5.0)
        logger.info("LoadMonitor: Shutdown complete")

    def get_load_metrics(self, endpoint: str) -> Dict:
        """
        Get current load metrics for an endpoint.
        Combines Redis metrics with in-memory metrics for accurate real-time data.
        
        Args:
            endpoint: Endpoint name
            
        Returns:
            Dictionary with load metrics
        """
        try:
            current_time = int(time.time())
            window_start = current_time - (current_time % self.window_seconds)
            
            # Get request count from Redis
            request_key = f"{self.metrics_prefix}:{endpoint}:requests:{window_start}"
            request_count = int(redis_client.client.get(request_key) or 0)
            
            # Get error count from Redis
            error_key = f"{self.metrics_prefix}:{endpoint}:errors:{window_start}"
            error_count = int(redis_client.client.get(error_key) or 0)
            
            # Get response times from Redis
            response_time_key = f"{self.metrics_prefix}:{endpoint}:response_times:{window_start}"
            response_times = redis_client.client.lrange(response_time_key, 0, -1)
            response_times = [float(rt) for rt in response_times if rt] if response_times else []
            
            # Add in-memory metrics (not yet flushed to Redis)
            with self._metrics_lock:
                if endpoint in self._in_memory_metrics and window_start in self._in_memory_metrics[endpoint]:
                    in_mem = self._in_memory_metrics[endpoint][window_start]
                    request_count += in_mem['requests']
                    error_count += in_mem['errors']
                    response_times.extend(in_mem['response_times'])
            
            # Calculate RPS
            rps = request_count / self.window_seconds if self.window_seconds > 0 else 0
            error_rate = (error_count / request_count * 100) if request_count > 0 else 0
            
            # Calculate percentiles
            if response_times:
                response_times.sort()
                p50 = response_times[int(len(response_times) * 0.5)] if response_times else 0
                p95 = response_times[int(len(response_times) * 0.95)] if response_times else 0
                p99 = response_times[int(len(response_times) * 0.99)] if response_times else 0
                avg = sum(response_times) / len(response_times) if response_times else 0
            else:
                p50 = p95 = p99 = avg = 0
            
            # Determine load status
            status, severity = self._determine_load_status(endpoint, rps, avg, error_rate)
            
            return {
                "endpoint": endpoint,
                "requests_per_second": round(rps, 2),
                "total_requests": request_count,
                "error_count": error_count,
                "error_rate_percent": round(error_rate, 2),
                "response_time_ms": {
                    "avg": round(avg, 2),
                    "p50": round(p50, 2),
                    "p95": round(p95, 2),
                    "p99": round(p99, 2),
                },
                "status": status,
                "severity": severity,
                "window_seconds": self.window_seconds,
                "timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Failed to get load metrics: {e}")
            return {
                "endpoint": endpoint,
                "error": str(e),
                "status": "unknown",
            }

    def _determine_load_status(
        self, endpoint: str, rps: float, avg_response_ms: float, error_rate: float
    ) -> Tuple[str, str]:
        """
        Determine load status based on metrics.
        
        Returns:
            Tuple of (status, severity)
            status: 'normal', 'warning', 'critical'
            severity: 'low', 'medium', 'high', 'critical'
        """
        # Get thresholds for endpoint
        if endpoint == "connect":
            warning_rps = self.connect_warning_rps
            critical_rps = self.connect_critical_rps
        elif endpoint == "heartbeat":
            warning_rps = self.heartbeat_warning_rps
            critical_rps = self.heartbeat_critical_rps
        else:
            warning_rps = 100
            critical_rps = 200
        
        # Check RPS
        if rps >= critical_rps:
            return "critical", "critical"
        elif rps >= warning_rps:
            return "warning", "high"
        
        # Check response time
        if avg_response_ms >= self.response_time_critical_ms:
            return "critical", "critical"
        elif avg_response_ms >= self.response_time_warning_ms:
            return "warning", "medium"
        
        # Check error rate
        if error_rate >= self.error_rate_critical_pct:
            return "critical", "critical"
        elif error_rate >= self.error_rate_warning_pct:
            return "warning", "medium"
        
        return "normal", "low"

    def check_load(self, endpoint: str) -> Dict:
        """
        Check current load and return status with recommendations.
        
        Args:
            endpoint: Endpoint name
            
        Returns:
            Dictionary with load check results
        """
        metrics = self.get_load_metrics(endpoint)
        
        recommendations = []
        
        if metrics.get("status") == "critical":
            recommendations.append(
                "CRITICAL: Consider scaling up resources or implementing stricter rate limiting"
            )
            recommendations.append(
                "Check for DDoS attacks or abnormal traffic patterns"
            )
            recommendations.append("Review error logs for system issues")
        elif metrics.get("status") == "warning":
            recommendations.append(
                "WARNING: Monitor closely, consider preemptive scaling"
            )
            recommendations.append("Review response times and optimize slow queries")
        
        metrics["recommendations"] = recommendations
        
        return metrics

    def get_top_ips(self, endpoint: str, limit: int = 10) -> list:
        """
        Get top IP addresses by request count (for DDoS detection).
        
        Args:
            endpoint: Endpoint name
            limit: Number of top IPs to return
            
        Returns:
            List of dicts with IP and request count
        """
        try:
            current_time = int(time.time())
            window_start = current_time - (current_time % self.window_seconds)
            
            # Get all IP keys for this endpoint
            pattern = f"{self.metrics_prefix}:{endpoint}:ip:*:{window_start}"
            keys = redis_client.client.keys(pattern)
            
            ip_counts = []
            for key in keys:
                try:
                    # Extract IP from key format: load_monitor:endpoint:ip:IP:window
                    parts = key.split(":")
                    if len(parts) >= 5:
                        ip = parts[4]
                        count = int(redis_client.client.get(key) or 0)
                        if count > 0:
                            ip_counts.append({"ip": ip, "count": count})
                except Exception as e:
                    logger.debug(f"Failed to parse IP key {key}: {e}")
                    continue
            
            # Add in-memory IP counts
            with self._metrics_lock:
                if endpoint in self._in_memory_metrics and window_start in self._in_memory_metrics[endpoint]:
                    in_mem_ips = self._in_memory_metrics[endpoint][window_start]['ip_counts']
                    for ip, count in in_mem_ips.items():
                        # Add or update count
                        existing = next((x for x in ip_counts if x['ip'] == ip), None)
                        if existing:
                            existing['count'] += count
                        else:
                            ip_counts.append({"ip": ip, "count": count})
            
            # Sort by count and return top N
            ip_counts.sort(key=lambda x: x["count"], reverse=True)
            return ip_counts[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get top IPs: {e}")
            return []

    def get_all_endpoints_status(self, project_id: Optional[int] = None) -> Dict:
        """
        Get load status for all monitored endpoints.
        
        Args:
            project_id: Optional project ID to filter by (uses UserActivity for project isolation)
        
        Returns:
            Dictionary with status for all endpoints
        """
        endpoints = ["connect", "heartbeat"]
        status = {}
        
        for endpoint in endpoints:
            if project_id:
                status[endpoint] = self.check_load_by_project(endpoint, project_id)
            else:
                status[endpoint] = self.check_load(endpoint)
        
        # Overall system status
        critical_count = sum(1 for s in status.values() if s.get("status") == "critical")
        warning_count = sum(1 for s in status.values() if s.get("status") == "warning")
        
        if critical_count > 0:
            overall_status = "critical"
        elif warning_count > 0:
            overall_status = "warning"
        else:
            overall_status = "normal"
        
        return {
            "overall_status": overall_status,
            "endpoints": status,
            "project_id": project_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def check_load_by_project(self, endpoint: str, project_id: int) -> Dict:
        """
        Check load for an endpoint filtered by project_id.
        Uses UserActivity table to determine project-specific metrics.
        
        Args:
            endpoint: Endpoint name
            project_id: Project ID to filter by
            
        Returns:
            Dictionary with load check results for the project
        """
        from ...core.extensions import db
        from ...models.core import UserActivity
        
        try:
            # Get metrics from UserActivity for this project and endpoint
            # Look for activities related to connect/heartbeat in the last window
            window_start = datetime.utcnow() - timedelta(seconds=self.window_seconds)
            
            # Filter activities by project and action pattern
            if endpoint == "connect":
                action_pattern = "%connect%"
            elif endpoint == "heartbeat":
                action_pattern = "%heartbeat%"
            else:
                action_pattern = f"%{endpoint}%"
            
            activities = UserActivity.query.filter(
                UserActivity.project_id == project_id,
                UserActivity.created_at >= window_start,
                UserActivity.action.like(action_pattern),
            ).all()
            
            if not activities:
                return {
                    "endpoint": endpoint,
                    "project_id": project_id,
                    "requests_per_second": 0,
                    "total_requests": 0,
                    "error_count": 0,
                    "error_rate_percent": 0,
                    "response_time_ms": {
                        "avg": 0,
                        "p50": 0,
                        "p95": 0,
                        "p99": 0,
                    },
                    "status": "normal",
                    "severity": "low",
                    "recommendations": [],
                }
            
            # Calculate metrics
            total_requests = len(activities)
            rps = total_requests / self.window_seconds
            
            # Count errors (activities with error/failed/denied in action)
            error_count = sum(
                1
                for a in activities
                if any(
                    keyword in a.action.lower()
                    for keyword in ["error", "failed", "denied", "invalid"]
                )
            )
            error_rate = (error_count / total_requests * 100) if total_requests > 0 else 0
            
            # Estimate response times from activity details if available
            # (This is approximate since we don't store response times in UserActivity)
            response_times = []
            for activity in activities:
                if activity.details:
                    # Try to extract duration from details if present
                    # Format: "Duration: 0.123s" or similar
                    import re
                    duration_match = re.search(r"Duration:\s*([\d.]+)s", activity.details)
                    if duration_match:
                        response_times.append(float(duration_match.group(1)) * 1000)
            
            if response_times:
                response_times.sort()
                p50 = response_times[int(len(response_times) * 0.5)] if response_times else 0
                p95 = response_times[int(len(response_times) * 0.95)] if response_times else 0
                p99 = response_times[int(len(response_times) * 0.99)] if response_times else 0
                avg = sum(response_times) / len(response_times) if response_times else 0
            else:
                # Use default estimates if no duration data available
                avg = 200  # Default estimate
                p50 = p95 = p99 = avg
            
            # Determine status
            status, severity = self._determine_load_status(endpoint, rps, avg, error_rate)
            
            recommendations = []
            if status == "critical":
                recommendations.append(
                    "CRITICAL: Consider scaling up resources or implementing stricter rate limiting"
                )
                recommendations.append("Check for DDoS attacks or abnormal traffic patterns")
            elif status == "warning":
                recommendations.append("WARNING: Monitor closely, consider preemptive scaling")
            
            return {
                "endpoint": endpoint,
                "project_id": project_id,
                "requests_per_second": round(rps, 2),
                "total_requests": total_requests,
                "error_count": error_count,
                "error_rate_percent": round(error_rate, 2),
                "response_time_ms": {
                    "avg": round(avg, 2),
                    "p50": round(p50, 2),
                    "p95": round(p95, 2),
                    "p99": round(p99, 2),
                },
                "status": status,
                "severity": severity,
                "recommendations": recommendations,
                "window_seconds": self.window_seconds,
                "timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Failed to get load metrics by project: {e}")
            return {
                "endpoint": endpoint,
                "project_id": project_id,
                "error": str(e),
                "status": "unknown",
            }


load_monitor = LoadMonitor()
