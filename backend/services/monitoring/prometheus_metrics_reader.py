"""
Prometheus Metrics Reader
REPLACES: Custom load_monitor aggregation logic

This service reads metrics from Prometheus instead of maintaining
custom in-memory aggregation. Metrics are collected automatically
by prometheus-flask-exporter.
"""

import logging
from typing import Dict, Optional
from prometheus_client import REGISTRY, generate_latest
from prometheus_client.parser import text_string_to_metric_families

logger = logging.getLogger(__name__)

class PrometheusMetricsReader:
    """
    Service for reading metrics from Prometheus registry.
    
    REPLACES: Custom load_monitor aggregation logic.
    Metrics are collected automatically by prometheus-flask-exporter.
    """
    
    def __init__(self):
        self.registry = REGISTRY
    
    def _get_metric_value(self, metric_name: str, labels: Optional[Dict[str, str]] = None) -> float:
        """
        Get metric value from Prometheus registry.
        
        Args:
            metric_name: Name of the metric
            labels: Optional labels to filter by
            
        Returns:
            Metric value or 0.0 if not found
        """
        try:

            metrics_text = generate_latest(self.registry).decode('utf-8')
            

            for family in text_string_to_metric_families(metrics_text):
                if family.name == metric_name:
                    for sample in family.samples:

                        if labels:
                            sample_labels = sample.labels
                            if all(sample_labels.get(k) == v for k, v in labels.items()):
                                return float(sample.value)
                        else:

                            return float(sample.value)
            
            return 0.0
        except Exception as e:
            logger.debug(f"Failed to get metric {metric_name}: {e}")
            return 0.0
    
    def get_endpoint_metrics(self, endpoint: str) -> Dict:
        """
        Get metrics for a specific endpoint.
        
        Args:
            endpoint: Endpoint name (e.g., 'connect', 'heartbeat')
            
        Returns:
            Dictionary with endpoint metrics
            
        Note: This is a simplified implementation. For detailed metrics,
        use Prometheus queries directly or scrape /metrics endpoint.
        """
        try:

            metrics_text = generate_latest(self.registry).decode('utf-8')
            
            request_count = 0
            error_count = 0
            response_times = []
            

            for family in text_string_to_metric_families(metrics_text):

                if 'http_request' in family.name.lower() and 'total' in family.name.lower():
                    for sample in family.samples:

                        path = sample.labels.get('path', '')
                        method = sample.labels.get('method', '')
                        status = sample.labels.get('status', '')
                        
                        if endpoint in path.lower() or f'/{endpoint}' in path:
                            request_count += float(sample.value)

                            if status and (status.startswith('4') or status.startswith('5')):
                                error_count += float(sample.value)
                

                if 'http_request_duration' in family.name.lower():
                    for sample in family.samples:
                        path = sample.labels.get('path', '')
                        if endpoint in path.lower() or f'/{endpoint}' in path:

                            le = sample.labels.get('le', '')
                            if le:
                                try:
                                    response_times.append(float(le))
                                except ValueError:
                                    pass
            

            rps = request_count / 60.0 if request_count > 0 else 0.0
            error_rate = (error_count / request_count * 100) if request_count > 0 else 0.0
            

            avg_response_ms = 200
            if response_times:
                response_times.sort()
                avg_response_ms = response_times[len(response_times) // 2] * 1000
            

            status, severity = self._determine_load_status(endpoint, rps, avg_response_ms, error_rate)
            
            return {
                "endpoint": endpoint,
                "requests_per_second": round(rps, 2),
                "total_requests": int(request_count),
                "error_count": int(error_count),
                "error_rate_percent": round(error_rate, 2),
                "response_time_ms": {
                    "avg": round(avg_response_ms, 2),
                    "p50": round(avg_response_ms, 2),
                    "p95": round(avg_response_ms * 1.5, 2),
                    "p99": round(avg_response_ms * 2, 2),
                },
                "status": status,
                "severity": severity,
                "note": "For detailed metrics, use Prometheus queries or /metrics endpoint",
            }
        except Exception as e:
            logger.error(f"Failed to get endpoint metrics: {e}")
            return {
                "endpoint": endpoint,
                "error": str(e),
                "status": "unknown",
                "note": "Metrics collection failed. Check Prometheus /metrics endpoint for raw metrics.",
            }
    
    def _determine_load_status(
        self, endpoint: str, rps: float, avg_response_ms: float, error_rate: float
    ) -> tuple:
        """
        Determine load status based on metrics.
        
        Returns:
            Tuple of (status, severity)
        """

        if endpoint == "connect":
            warning_rps = 50
            critical_rps = 100
        elif endpoint == "heartbeat":
            warning_rps = 100
            critical_rps = 200
        else:
            warning_rps = 50
            critical_rps = 100
        
        response_time_warning_ms = 500
        response_time_critical_ms = 1000
        error_rate_warning_pct = 5
        error_rate_critical_pct = 10
        

        if rps >= critical_rps:
            return "critical", "critical"
        elif rps >= warning_rps:
            return "warning", "high"
        

        if avg_response_ms >= response_time_critical_ms:
            return "critical", "critical"
        elif avg_response_ms >= response_time_warning_ms:
            return "warning", "medium"
        

        if error_rate >= error_rate_critical_pct:
            return "critical", "critical"
        elif error_rate >= error_rate_warning_pct:
            return "warning", "medium"
        
        return "normal", "low"
    
    def get_all_endpoints_status(self, project_id: Optional[int] = None) -> Dict:
        """
        Get load status for all monitored endpoints.
        
        Args:
            project_id: Optional project ID (not used with Prometheus, kept for compatibility)
        
        Returns:
            Dictionary with status for all endpoints
        """
        endpoints = ["connect", "heartbeat"]
        status = {}
        
        for endpoint in endpoints:
            status[endpoint] = self.get_endpoint_metrics(endpoint)
        

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
            "note": "Metrics are collected automatically by Prometheus. Use /metrics endpoint for raw metrics.",
        }


prometheus_metrics_reader = PrometheusMetricsReader()

