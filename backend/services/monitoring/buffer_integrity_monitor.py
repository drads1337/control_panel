"""
Monitoring service for Analytics Buffer and Redis Integrity
Tracks buffer overflow events and Redis integrity violations for alerting
"""

import logging
import threading
from typing import Dict, Optional

from prometheus_client import Counter, Gauge, REGISTRY

logger = logging.getLogger(__name__)

# Prometheus metrics (shared across all instances)
_metrics_initialized = False
_metrics_lock = threading.Lock()

# Analytics Buffer metrics
_analytics_buffer_size = Gauge(
    'analytics_buffer_size',
    'Current size of analytics buffer (number of items)',
    ['buffer_type'],  # 'user_activity' or 'key_analytics'
    registry=REGISTRY
)

_analytics_buffer_overflow_total = Counter(
    'analytics_buffer_overflow_total',
    'Total number of analytics buffer overflow events',
    ['buffer_type'],
    registry=REGISTRY
)

_analytics_buffer_flush_total = Counter(
    'analytics_buffer_flush_total',
    'Total number of analytics buffer flushes',
    ['buffer_type', 'status'],  # status: 'success' or 'error'
    registry=REGISTRY
)

_analytics_buffer_flush_duration_seconds = Gauge(
    'analytics_buffer_flush_duration_seconds',
    'Duration of analytics buffer flush operation in seconds',
    ['buffer_type'],
    registry=REGISTRY
)

# Redis Integrity metrics
_redis_integrity_errors_total = Counter(
    'redis_integrity_errors_total',
    'Total number of Redis integrity verification failures',
    ['key_pattern'],  # e.g., 'dynamic_config', 'session', 'challenge'
    registry=REGISTRY
)

_redis_integrity_checks_total = Counter(
    'redis_integrity_checks_total',
    'Total number of Redis integrity checks performed',
    ['key_pattern', 'result'],  # result: 'valid' or 'invalid'
    registry=REGISTRY
)

_redis_integrity_unsigned_keys = Gauge(
    'redis_integrity_unsigned_keys',
    'Number of unsigned keys found in Redis (should be protected)',
    ['key_pattern'],
    registry=REGISTRY
)


class BufferIntegrityMonitor:
    """
    Monitoring service for Analytics Buffer and Redis Integrity.
    
    Tracks:
    - Analytics buffer size and overflow events
    - Redis integrity verification failures
    - Buffer flush operations and duration
    """
    
    def __init__(self):
        self._init_metrics()
    
    def _init_metrics(self):
        """Initialize Prometheus metrics (thread-safe singleton)"""
        global _metrics_initialized
        with _metrics_lock:
            if _metrics_initialized:
                return
            _metrics_initialized = True
            logger.info("BufferIntegrityMonitor: Prometheus metrics initialized")
    
    def record_buffer_size(self, buffer_type: str, size: int):
        """
        Record current analytics buffer size.
        
        Args:
            buffer_type: Type of buffer ('user_activity' or 'key_analytics')
            size: Current buffer size (number of items)
        """
        try:
            _analytics_buffer_size.labels(buffer_type=buffer_type).set(size)
        except Exception as e:
            logger.error(f"Failed to record buffer size: {e}")
    
    def record_buffer_overflow(self, buffer_type: str):
        """
        Record an analytics buffer overflow event.
        
        This should be called when the buffer size exceeds the maximum allowed size.
        
        Args:
            buffer_type: Type of buffer ('user_activity' or 'key_analytics')
        """
        try:
            _analytics_buffer_overflow_total.labels(buffer_type=buffer_type).inc()
            logger.warning(
                f"[ANALYTICS_BUFFER_OVERFLOW] Buffer type={buffer_type} exceeded maximum size. "
                "Consider increasing ANALYTICS_BUFFER_MAX_SIZE or reducing write rate."
            )
        except Exception as e:
            logger.error(f"Failed to record buffer overflow: {e}")
    
    def record_buffer_flush(self, buffer_type: str, success: bool, duration_seconds: float):
        """
        Record an analytics buffer flush operation.
        
        Args:
            buffer_type: Type of buffer ('user_activity' or 'key_analytics')
            success: Whether the flush was successful
            duration_seconds: Duration of the flush operation
        """
        try:
            status = 'success' if success else 'error'
            _analytics_buffer_flush_total.labels(
                buffer_type=buffer_type,
                status=status
            ).inc()
            
            if success:
                _analytics_buffer_flush_duration_seconds.labels(
                    buffer_type=buffer_type
                ).set(duration_seconds)
        except Exception as e:
            logger.error(f"Failed to record buffer flush: {e}")
    
    def record_redis_integrity_error(self, key_pattern: str):
        """
        Record a Redis integrity verification failure.
        
        This should be called when HMAC verification fails for a protected key.
        
        Args:
            key_pattern: Pattern of the key that failed verification
                        (e.g., 'dynamic_config', 'session', 'challenge')
        """
        try:
            _redis_integrity_errors_total.labels(key_pattern=key_pattern).inc()
            logger.error(
                f"[REDIS_INTEGRITY_ERROR] Integrity verification failed for key pattern={key_pattern}. "
                "Possible tampering detected or signing key mismatch."
            )
        except Exception as e:
            logger.error(f"Failed to record Redis integrity error: {e}")
    
    def record_redis_integrity_check(self, key_pattern: str, is_valid: bool):
        """
        Record a Redis integrity check result.
        
        Args:
            key_pattern: Pattern of the key being checked
            is_valid: Whether the integrity check passed
        """
        try:
            result = 'valid' if is_valid else 'invalid'
            _redis_integrity_checks_total.labels(
                key_pattern=key_pattern,
                result=result
            ).inc()
        except Exception as e:
            logger.error(f"Failed to record Redis integrity check: {e}")
    
    def record_unsigned_keys(self, key_pattern: str, count: int):
        """
        Record the number of unsigned keys found in Redis.
        
        Args:
            key_pattern: Pattern of the keys
            count: Number of unsigned keys found
        """
        try:
            _redis_integrity_unsigned_keys.labels(key_pattern=key_pattern).set(count)
            if count > 0:
                logger.warning(
                    f"[REDIS_INTEGRITY] Found {count} unsigned keys for pattern={key_pattern}. "
                    "These keys should be protected with HMAC signatures."
                )
        except Exception as e:
            logger.error(f"Failed to record unsigned keys: {e}")
    
    def get_metrics_summary(self) -> Dict:
        """
        Get a summary of current metrics for health checks.
        
        Returns:
            Dictionary with metrics summary
        """
        try:
            # Note: This is a simplified summary. For detailed metrics,
            # use Prometheus scraping endpoint /metrics
            return {
                "analytics_buffer_metrics_available": True,
                "redis_integrity_metrics_available": True,
                "note": "Use /metrics endpoint for detailed Prometheus metrics"
            }
        except Exception as e:
            logger.error(f"Failed to get metrics summary: {e}")
            return {
                "error": str(e)
            }


# Global instance
_buffer_integrity_monitor = None
_monitor_lock = threading.Lock()


def get_buffer_integrity_monitor() -> BufferIntegrityMonitor:
    """Get global BufferIntegrityMonitor instance (singleton)"""
    global _buffer_integrity_monitor
    with _monitor_lock:
        if _buffer_integrity_monitor is None:
            _buffer_integrity_monitor = BufferIntegrityMonitor()
        return _buffer_integrity_monitor

