"""
Structured Logging System for Scalability and Observability
Provides JSON-based logging with correlation IDs, metrics, and distributed tracing support.
"""

import json
import logging
import os
import threading
import time
import uuid
from contextvars import ContextVar
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional, Union

from flask import current_app, g, request

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_var: ContextVar[Optional[int]] = ContextVar("user_id", default=None)
project_id_var: ContextVar[Optional[int]] = ContextVar("project_id", default=None)
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")

# SECURITY: List of sensitive query parameters that should be filtered from logs to prevent PII leakage
SENSITIVE_QUERY_PARAMS = {
    'username', 'user_id', 'userId', 'email', 'search', 'q',  # search terms
    'token', 'api_key', 'apikey', 'password', 'pass', 'secret',
}

def sanitize_query_params(query_params: dict) -> dict:
    """
    Remove sensitive parameters from query params to prevent PII in logs.
    
    SECURITY: This function filters out parameters that may contain PII (Personally Identifiable Information)
    to comply with GDPR/CCPA requirements and prevent data leakage through server logs.
    
    Args:
        query_params: Dictionary of query parameters
        
    Returns:
        Dictionary with sensitive parameters removed (values replaced with '[FILTERED]')
    """
    sanitized = {}
    for key, value in query_params.items():
        # Check if parameter name contains any sensitive keyword (case-insensitive)
        key_lower = key.lower()
        is_sensitive = any(sensitive_key.lower() in key_lower for sensitive_key in SENSITIVE_QUERY_PARAMS)
        
        if is_sensitive:
            sanitized[key] = '[FILTERED]'
        else:
            sanitized[key] = value
    return sanitized

class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""

    def format(self, record):

        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process_id": record.process,
            # thread_id removed: threading.get_ident() is not reliable for async workers (Gunicorn+Gevent, Uvicorn)
            # Use process_id and correlation_id for request tracking instead
        }

        request_id = request_id_var.get()
        if request_id:
            log_entry["request_id"] = request_id

        user_id = user_id_var.get()
        if user_id:
            log_entry["user_id"] = user_id

        project_id = project_id_var.get()
        if project_id:
            log_entry["project_id"] = project_id

        correlation_id = correlation_id_var.get()
        if correlation_id:
            log_entry["correlation_id"] = correlation_id

        try:
            if hasattr(g, "start_time"):
                log_entry["request_duration_ms"] = int(
                    (time.time() - g.start_time.timestamp()) * 1000
                )
            if request and hasattr(request, "method"):
                log_entry["http_method"] = request.method
                log_entry["http_path"] = request.path
                log_entry["http_status"] = getattr(g, "response_status", None)
                log_entry["remote_addr"] = request.remote_addr
                log_entry["user_agent"] = request.headers.get("User-Agent", "")
                # SECURITY: Sanitize query parameters to prevent PII leakage in logs
                if hasattr(request, "args") and request.args:
                    log_entry["http_query_params"] = sanitize_query_params(dict(request.args))
        except RuntimeError:

            pass

        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info),
            }

        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "getMessage",
                "exc_info",
                "exc_text",
                "stack_info",
            ]:
                log_entry[key] = value

        return json.dumps(log_entry, ensure_ascii=False, default=str)

class MetricsCollector:
    """Collects product metrics for monitoring"""

    def __init__(self):
        self._metrics = {}
        self._lock = threading.Lock()

    def increment_counter(self, name: str, value: int = 1, labels: Optional[Dict[str, str]] = None):
        """Increment a counter metric"""
        with self._lock:
            key = f"{name}:{json.dumps(labels or {}, sort_keys=True)}"
            self._metrics[key] = self._metrics.get(key, 0) + value

    def set_gauge(
        self, name: str, value: Union[int, float], labels: Optional[Dict[str, str]] = None
    ):
        """Set a gauge metric"""
        with self._lock:
            key = f"{name}:{json.dumps(labels or {}, sort_keys=True)}"
            self._metrics[key] = value

    def observe_histogram(
        self, name: str, value: Union[int, float], labels: Optional[Dict[str, str]] = None
    ):
        """Observe a histogram metric"""
        with self._lock:
            key = f"{name}:{json.dumps(labels or {}, sort_keys=True)}"
            if key not in self._metrics:
                self._metrics[key] = []
            self._metrics[key].append(value)

    def get_metrics(self) -> Dict[str, Any]:
        """Get all collected metrics"""
        with self._lock:
            return self._metrics.copy()

    def clear_metrics(self):
        """Clear all metrics"""
        with self._lock:
            self._metrics.clear()

metrics = MetricsCollector()

class StructuredLogger:
    """Enhanced logger with structured logging capabilities"""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._setup_logger()

    def _setup_logger(self):
        """Setup logger with structured formatter"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(StructuredFormatter())
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
            self.logger.propagate = False

    def _log_with_context(self, level: str, message: str, **kwargs):
        """Log with additional context"""
        from ..config.config import Config, IS_PRODUCTION
        
        # Log sampling for info level in production to reduce log volume
        # This prevents flooding log aggregation systems (ELK/Datadog) on high-load
        if level == "info" and IS_PRODUCTION:
            import random
            # Sample rate: 10% of info logs in production (configurable via env)
            sample_rate = float(os.environ.get("LOG_SAMPLE_RATE", "0.1"))
            if random.random() > sample_rate:
                return  # Skip this log entry
        
        exc_info = kwargs.pop("exc_info", None)
        extra = {
            "request_id": request_id_var.get(),
            "user_id": user_id_var.get(),
            "project_id": project_id_var.get(),
            "correlation_id": correlation_id_var.get(),
            **kwargs,
        }
        if exc_info is not None:
            getattr(self.logger, level)(message, extra=extra, exc_info=exc_info)
        else:
            getattr(self.logger, level)(message, extra=extra)

    def debug(self, message: str, **kwargs):
        self._log_with_context("debug", message, **kwargs)

    def info(self, message: str, **kwargs):
        self._log_with_context("info", message, **kwargs)

    def warning(self, message: str, **kwargs):
        self._log_with_context("warning", message, **kwargs)

    def error(self, message: str, **kwargs):
        self._log_with_context("error", message, **kwargs)

    def critical(self, message: str, **kwargs):
        self._log_with_context("critical", message, **kwargs)

    def log_performance(self, operation: str, duration_ms: float, **kwargs):
        """Log performance metrics"""
        metrics.observe_histogram("operation_duration_ms", duration_ms, {"operation": operation})
        self.info(
            f"Performance: {operation} took {duration_ms:.2f}ms",
            operation=operation,
            duration_ms=duration_ms,
            **kwargs,
        )

    def log_business_event(self, event_type: str, **kwargs):
        """Log business events for analytics"""
        metrics.increment_counter("business_events", labels={"event_type": event_type})
        self.info(f"Business event: {event_type}", event_type=event_type, **kwargs)

    def log_security_event(self, event_type: str, severity: str = "medium", **kwargs):
        """Log security events"""
        metrics.increment_counter(
            "security_events", labels={"event_type": event_type, "severity": severity}
        )
        self.warning(
            f"Security event: {event_type}", event_type=event_type, severity=severity, **kwargs
        )

def get_logger(name: str) -> StructuredLogger:
    """Get a structured logger instance"""
    return StructuredLogger(name)

def set_request_context(
    request_id: str,
    user_id: Optional[int] = None,
    project_id: Optional[int] = None,
    correlation_id: Optional[str] = None,
):
    """Set request context for logging"""
    request_id_var.set(request_id)
    if user_id:
        user_id_var.set(user_id)
    if project_id:
        project_id_var.set(project_id)
    if correlation_id:
        correlation_id_var.set(correlation_id)

def clear_request_context():
    """Clear request context"""
    request_id_var.set("")
    user_id_var.set(None)
    project_id_var.set(None)
    correlation_id_var.set("")

def log_performance(operation: str):
    """Decorator to log function performance"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                logger = get_logger(func.__module__)
                logger.log_performance(operation or func.__name__, duration_ms)
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                logger = get_logger(func.__module__)
                logger.error(
                    f"Error in {operation or func.__name__}: {str(e)}",
                    operation=operation or func.__name__,
                    duration_ms=duration_ms,
                    error=str(e),
                )
                raise

        return wrapper

    return decorator

def log_business_event(event_type: str):
    """Decorator to log business events"""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                logger = get_logger(func.__module__)
                logger.log_business_event(event_type)
                return result
            except Exception as e:
                logger = get_logger(func.__module__)
                logger.error(
                    f"Business event failed: {event_type}", event_type=event_type, error=str(e)
                )
                raise

        return wrapper

    return decorator

default_logger = get_logger("panel")

def setup_structured_logging(app):
    """Setup structured logging for Flask app"""

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(handler)

    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)

    @app.before_request
    def setup_request_context():
        request_id = str(uuid.uuid4())
        g.request_id = request_id
        g.start_time = datetime.utcnow()
        

        correlation_id = request.headers.get('X-Correlation-ID') or str(uuid.uuid4())
        
        set_request_context(request_id, correlation_id=correlation_id)

        try:
            from flask_jwt_extended import get_jwt_identity

            user_id = get_jwt_identity()
            if user_id:
                user_id_var.set(user_id)
        except:
            pass

    @app.after_request
    def log_request(response):
        g.response_status = response.status_code
        
        # SECURITY: Store sanitized query params in Flask's g for use in logging
        # This prevents PII from appearing in access logs
        if request and hasattr(request, "args") and request.args:
            g.sanitized_query_params = sanitize_query_params(dict(request.args))

        correlation_id = correlation_id_var.get()
        if correlation_id:
            response.headers['X-Correlation-ID'] = correlation_id
        

        request_id = request_id_var.get()
        if request_id:
            response.headers['X-Request-ID'] = request_id

        excluded_paths = [
            "/api/logs",
            "/api/users",
            "/api/keys",
            "/api/products",
            "/api/panel_tools/projects",
            "/api/projects",
            "/api/sessions",
            "/api/notifications",
            "/api/files",
            "/api/me",
            "/api/chat",
            "/api/changelog",
            "/api/agents",
            "/api/servers",
            "/api/analytics",
            "/api/webhooks",
            "/api/rbac",
            "/api/dashboard",
            "/api/admin",
            "/api/connect",
        ]

        should_log = True
        for excluded_path in excluded_paths:
            if request.path.startswith(excluded_path):
                should_log = False
                break

        if should_log and hasattr(g, "start_time"):
            duration_ms = (datetime.utcnow() - g.start_time).total_seconds() * 1000
            metrics.observe_histogram(
                "http_request_duration_ms",
                duration_ms,
                {
                    "method": request.method,
                    "path": request.path,
                    "status": str(response.status_code),
                },
            )

            metrics.increment_counter(
                "http_requests_total",
                labels={
                    "method": request.method,
                    "path": request.path,
                    "status": str(response.status_code),
                },
            )

        return response

    default_logger.info("Structured logging initialized", component="logging", version="1.0.0")
