"""
Load Monitoring Service
Monitors load on critical endpoints (connect, heartbeat) and provides
warnings/alerts when load exceeds thresholds.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

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
    """

    def __init__(self):
        self.metrics_prefix = "load_monitor"
        self.window_seconds = 60  # 1 minute window for metrics
        
        # Load thresholds (from Config)
        self.connect_warning_rps = Config.CONNECT_WARNING_RPS
        self.connect_critical_rps = Config.CONNECT_CRITICAL_RPS
        self.heartbeat_warning_rps = Config.HEARTBEAT_WARNING_RPS
        self.heartbeat_critical_rps = Config.HEARTBEAT_CRITICAL_RPS
        self.response_time_warning_ms = Config.RESPONSE_TIME_WARNING_MS
        self.response_time_critical_ms = Config.RESPONSE_TIME_CRITICAL_MS
        self.error_rate_warning_pct = Config.ERROR_RATE_WARNING_PCT
        self.error_rate_critical_pct = Config.ERROR_RATE_CRITICAL_PCT

    def record_request(
        self,
        endpoint: str,
        response_time_ms: float,
        status_code: int,
        ip: Optional[str] = None,
    ) -> None:
        """
        Record a request metric.
        
        Args:
            endpoint: Endpoint name (e.g., 'connect', 'heartbeat')
            response_time_ms: Response time in milliseconds
            status_code: HTTP status code
            ip: Client IP address (optional)
        """
        try:
            current_time = int(time.time())
            window_start = current_time - (current_time % self.window_seconds)
            
            # Record request count
            request_key = f"{self.metrics_prefix}:{endpoint}:requests:{window_start}"
            redis_client.client.incr(request_key)
            redis_client.client.expire(request_key, self.window_seconds * 2)
            
            # Record response time (for percentile calculation)
            response_time_key = f"{self.metrics_prefix}:{endpoint}:response_times:{window_start}"
            redis_client.client.lpush(response_time_key, response_time_ms)
            redis_client.client.ltrim(response_time_key, 0, 999)  # Keep last 1000
            redis_client.client.expire(response_time_key, self.window_seconds * 2)
            
            # Record error if status >= 400
            if status_code >= 400:
                error_key = f"{self.metrics_prefix}:{endpoint}:errors:{window_start}"
                redis_client.client.incr(error_key)
                redis_client.client.expire(error_key, self.window_seconds * 2)
            
            # Track by IP if provided (for detecting DDoS patterns)
            if ip:
                ip_key = f"{self.metrics_prefix}:{endpoint}:ip:{ip}:{window_start}"
                redis_client.client.incr(ip_key)
                redis_client.client.expire(ip_key, self.window_seconds * 2)
                
        except Exception as e:
            logger.error(f"Failed to record request metric: {e}")

    def get_load_metrics(self, endpoint: str) -> Dict:
        """
        Get current load metrics for an endpoint.
        
        Args:
            endpoint: Endpoint name
            
        Returns:
            Dictionary with load metrics
        """
        try:
            current_time = int(time.time())
            window_start = current_time - (current_time % self.window_seconds)
            
            # Get request count
            request_key = f"{self.metrics_prefix}:{endpoint}:requests:{window_start}"
            request_count = int(redis_client.client.get(request_key) or 0)
            rps = request_count / self.window_seconds
            
            # Get error count
            error_key = f"{self.metrics_prefix}:{endpoint}:errors:{window_start}"
            error_count = int(redis_client.client.get(error_key) or 0)
            error_rate = (error_count / request_count * 100) if request_count > 0 else 0
            
            # Get response times
            response_time_key = f"{self.metrics_prefix}:{endpoint}:response_times:{window_start}"
            response_times = redis_client.client.lrange(response_time_key, 0, -1)
            
            if response_times:
                response_times = [float(rt) for rt in response_times if rt]
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

