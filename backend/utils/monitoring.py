"""
Comprehensive Monitoring and Health Check System
Provides detailed health checks, metrics collection, and observability features.
"""

import json
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import psutil
import redis
from flask import Response, current_app, jsonify, request
from prometheus_client import CollectorRegistry, Gauge, generate_latest, REGISTRY
from sqlalchemy import text

from ..core.extensions import db
from ..utils.storage_manager import get_storage_manager
from ..utils.structured_logging import get_logger, metrics

logger = get_logger(__name__)


# System resource metrics (CPU, RAM, Disk) removed.
# Use Kubernetes/Docker/Prometheus Node Exporter for system resource monitoring.


_redis_available = Gauge(
    'redis_available',
    'Redis availability (1 = available, 0 = unavailable)',
    ['instance'],
    registry=REGISTRY
)
_redis_connection_time_ms = Gauge(
    'redis_connection_time_ms',
    'Redis connection time in milliseconds',
    ['instance'],
    registry=REGISTRY
)
_redis_operations_total = Gauge(
    'redis_operations_total',
    'Total Redis operations',
    ['instance', 'operation', 'status'],
    registry=REGISTRY
)


_database_available = Gauge(
    'database_available',
    'Database availability (1 = available, 0 = unavailable)',
    registry=REGISTRY
)
_database_connection_time_ms = Gauge(
    'database_connection_time_ms',
    'Database connection time in milliseconds',
    registry=REGISTRY
)

class HealthCheck:
    """Individual health check component"""

    def __init__(
        self,
        name: str,
        check_func: Callable[[], Dict[str, Any]],
        critical: bool = True,
        timeout: int = 5,
    ):
        self.name = name
        self.check_func = check_func
        self.critical = critical
        self.timeout = timeout
        self.last_check = None
        self.last_result = None

    def run_check(self) -> Dict[str, Any]:
        """Run the health check"""
        start_time = time.time()

        try:

            result = self.check_func()
            duration = time.time() - start_time

            result.update(
                {
                    "name": self.name,
                    "status": "healthy" if result.get("healthy", True) else "unhealthy",
                    "duration_ms": round(duration * 1000, 2),
                    "timestamp": datetime.utcnow().isoformat(),
                    "critical": self.critical,
                }
            )

            self.last_check = datetime.utcnow()
            self.last_result = result

            metrics.observe_histogram(
                "health_check_duration_ms",
                duration * 1000,
                {"check_name": self.name, "status": result["status"]},
            )

            metrics.increment_counter(
                "health_checks_total", labels={"check_name": self.name, "status": result["status"]}
            )

            return result

        except Exception as e:
            duration = time.time() - start_time
            error_result = {
                "name": self.name,
                "status": "error",
                "healthy": False,
                "error": str(e),
                "duration_ms": round(duration * 1000, 2),
                "timestamp": datetime.utcnow().isoformat(),
                "critical": self.critical,
            }

            self.last_check = datetime.utcnow()
            self.last_result = error_result

            logger.error(f"Health check failed: {self.name}", check_name=self.name, error=str(e))

            return error_result

class DatabaseHealthCheck:
    """Database connectivity and performance health check"""

    @staticmethod
    def check_connection():
        """Check database connection

        SECURITY: Uses hardcoded constant query with no user input. Safe from SQL injection.
        """
        try:
            start_time = time.time()

            db.session.execute(text("SELECT 1"))
            duration = time.time() - start_time

            return {
                "healthy": True,
                "connection_time_ms": round(duration * 1000, 2),
                "details": "Database connection successful",
            }
        except Exception as e:
            return {"healthy": False, "error": str(e), "details": "Database connection failed"}

    @staticmethod
    def check_performance():
        """Check database performance

        SECURITY: Uses hardcoded constant queries with no user input. Safe from SQL injection.
        """
        try:
            start_time = time.time()

            result = db.session.execute(
                text(
                    """
                SELECT COUNT(*) as user_count FROM users;
                SELECT COUNT(*) as project_count FROM projects;
                SELECT COUNT(*) as activity_count FROM user_activities 
                WHERE created_at > NOW() - INTERVAL '1 hour';
            """
                )
            )

            duration = time.time() - start_time

            is_healthy = duration < 1.0

            return {
                "healthy": is_healthy,
                "query_time_ms": round(duration * 1000, 2),
                "details": f"Database queries completed in {duration:.2f}s",
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e),
                "details": "Database performance check failed",
            }

class RedisHealthCheck:
    """Redis connectivity and performance health check"""

    @staticmethod
    def check_connection():
        """Check Redis connection"""
        try:
            from ..config.config import Config

            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                socket_connect_timeout=2,
                socket_timeout=2,
            )

            start_time = time.time()
            redis_client.ping()
            duration = time.time() - start_time

            info = redis_client.info()

            return {
                "healthy": True,
                "connection_time_ms": round(duration * 1000, 2),
                "redis_version": info.get("redis_version"),
                "used_memory_human": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "details": "Redis connection successful",
            }
        except Exception as e:
            return {"healthy": False, "error": str(e), "details": "Redis connection failed"}

class StorageHealthCheck:
    """Storage system health check"""

    @staticmethod
    def check_storage():
        """Check storage system health"""
        try:
            storage_manager = get_storage_manager()
            stats = storage_manager.get_storage_stats()

            test_file_path = f"health_check_{int(time.time())}.txt"
            test_content = b"Health check test file"

            upload_result = storage_manager.upload_file(test_content, test_file_path, "text/plain")

            downloaded_content = storage_manager.download_file(test_file_path)

            storage_manager.delete_file(test_file_path)

            return {
                "healthy": downloaded_content == test_content,
                "backends": stats["backends"],
                "default_backend": stats["default_backend"],
                "cache_enabled": stats["cache_enabled"],
                "details": "Storage system operational",
            }
        except Exception as e:
            return {"healthy": False, "error": str(e), "details": "Storage system check failed"}

# SystemHealthCheck removed.
# System resource monitoring should be handled by Kubernetes/Docker/Prometheus Node Exporter.

class ProductHealthCheck:
    """Product-specific health checks"""

    @staticmethod
    def check_product():
        """Check product health"""
        try:

            app_healthy = current_app is not None

            from models.core import UserActivity

            recent_activities = UserActivity.query.filter(
                UserActivity.created_at > datetime.utcnow() - timedelta(minutes=5)
            ).count()

            return {
                "healthy": app_healthy,
                "app_running": app_healthy,
                "recent_activities": recent_activities,
                "details": "Product is running normally",
            }
        except Exception as e:
            return {"healthy": False, "error": str(e), "details": "Product health check failed"}

# System resource metrics update removed.
# Use Kubernetes/Docker/Prometheus Node Exporter for system resource monitoring.


def _update_redis_health_metrics():
    """Update Prometheus Redis health metrics"""
    try:
        from ..config.config import Config
        from ..utils.redis_client import get_redis_client, get_redis_cache_client
        

        try:
            start_time = time.time()
            redis_client = get_redis_client()
            redis_client.ping()
            connection_time = (time.time() - start_time) * 1000
            
            _redis_available.labels(instance='persistent').set(1)
            _redis_connection_time_ms.labels(instance='persistent').set(connection_time)
        except Exception as e:
            logger.debug(f"Redis persistent instance unavailable: {e}")
            _redis_available.labels(instance='persistent').set(0)
            _redis_connection_time_ms.labels(instance='persistent').set(0)
        

        try:
            if (Config.REDIS_CACHE_HOST != Config.REDIS_PERSISTENT_HOST or 
                Config.REDIS_CACHE_PORT != Config.REDIS_PERSISTENT_PORT):
                start_time = time.time()
                cache_client = get_redis_cache_client()
                cache_client.ping()
                connection_time = (time.time() - start_time) * 1000
                
                _redis_available.labels(instance='cache').set(1)
                _redis_connection_time_ms.labels(instance='cache').set(connection_time)
            else:

                start_time = time.time()
                redis_client.ping()
                connection_time = (time.time() - start_time) * 1000
                _redis_available.labels(instance='cache').set(1)
                _redis_connection_time_ms.labels(instance='cache').set(connection_time)
        except Exception as e:
            logger.debug(f"Redis cache instance unavailable: {e}")
            _redis_available.labels(instance='cache').set(0)
            _redis_connection_time_ms.labels(instance='cache').set(0)
    except Exception as e:
        logger.debug(f"Error updating Redis health metrics: {e}")


def _update_database_health_metrics():
    """Update Prometheus database health metrics"""
    try:
        start_time = time.time()
        db.session.execute(text("SELECT 1"))
        connection_time = (time.time() - start_time) * 1000
        
        _database_available.set(1)
        _database_connection_time_ms.set(connection_time)
    except Exception as e:
        logger.debug(f"Database unavailable: {e}")
        _database_available.set(0)
        _database_connection_time_ms.set(0)


class MonitoringSystem:
    """Main monitoring system"""

    def __init__(self):
        self.health_checks: Dict[str, HealthCheck] = {}
        self._init_health_checks()

    def _init_health_checks(self):
        """Initialize all health checks"""

        self.add_health_check(
            "database_connection", DatabaseHealthCheck.check_connection, critical=True
        )
        self.add_health_check(
            "database_performance", DatabaseHealthCheck.check_performance, critical=False
        )

        self.add_health_check("redis_connection", RedisHealthCheck.check_connection, critical=True)

        self.add_health_check("storage_system", StorageHealthCheck.check_storage, critical=True)

        # System resource health check removed.
        # Use Kubernetes/Docker/Prometheus Node Exporter for system resource monitoring.

        self.add_health_check(
            "product", ProductHealthCheck.check_product, critical=True
        )

    def add_health_check(
        self,
        name: str,
        check_func: Callable[[], Dict[str, Any]],
        critical: bool = True,
        timeout: int = 5,
    ):
        """Add a new health check"""
        self.health_checks[name] = HealthCheck(name, check_func, critical, timeout)

    def run_all_checks(self) -> Dict[str, Any]:
        """Run all health checks"""
        results = {}
        overall_healthy = True
        critical_failures = []

        for name, health_check in self.health_checks.items():
            try:
                result = health_check.run_check()
                results[name] = result

                if not result.get("healthy", False):
                    if health_check.critical:
                        critical_failures.append(name)
                        overall_healthy = False
            except Exception as e:
                logger.error(f"Health check {name} failed with exception: {e}")
                results[name] = {
                    "name": name,
                    "status": "error",
                    "healthy": False,
                    "error": str(e),
                    "critical": health_check.critical,
                }
                if health_check.critical:
                    critical_failures.append(name)
                    overall_healthy = False

        return {
            "overall_status": "healthy" if overall_healthy else "unhealthy",
            "overall_healthy": overall_healthy,
            "critical_failures": critical_failures,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": results,
        }

    def run_single_check(self, name: str) -> Dict[str, Any]:
        """Run a single health check"""
        if name not in self.health_checks:
            return {
                "error": f'Health check "{name}" not found',
                "available_checks": list(self.health_checks.keys()),
            }

        return self.health_checks[name].run_check()

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get metrics summary for monitoring"""
        try:
            from models.core import Project, User, UserActivity

            total_users = User.query.count()
            total_projects = Project.query.count()
            recent_activities = UserActivity.query.filter(
                UserActivity.created_at > datetime.utcnow() - timedelta(hours=1)
            ).count()

            return {
                "timestamp": datetime.utcnow().isoformat(),
                "product": {
                    "total_users": total_users,
                    "total_projects": total_projects,
                    "recent_activities": recent_activities,
                },
                "custom_metrics": metrics.get_metrics(),
            }
        except Exception as e:
            logger.error(f"Failed to get metrics summary: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}

monitoring_system = MonitoringSystem()

def setup_monitoring_endpoints(app):
    """Setup monitoring endpoints for Flask app"""

    @app.route("/api/health", methods=["GET"])
    def health_check():
        """Comprehensive health check endpoint"""
        return jsonify(monitoring_system.run_all_checks())

    @app.route("/api/health/<check_name>", methods=["GET"])
    def single_health_check(check_name):
        """Single health check endpoint"""
        return jsonify(monitoring_system.run_single_check(check_name))

    @app.route("/api/health/live", methods=["GET"])
    def liveness_probe():
        """
        Kubernetes liveness probe endpoint.
        
        Liveness probe checks if the application is running.
        This is a lightweight check that should always succeed if the process is alive.
        Kubernetes will restart the container if this fails.
        
        Returns:
            200: Application is alive
            500: Application is dead (should trigger restart)
        """
        try:

            return jsonify({
                "status": "alive",
                "timestamp": datetime.utcnow().isoformat()
            }), 200
        except Exception as e:
            logger.error(f"Liveness probe failed: {e}")
            return jsonify({
                "status": "dead",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }), 500

    @app.route("/api/health/ready", methods=["GET"])
    def readiness_probe():
        """
        Kubernetes readiness probe endpoint.
        
        Readiness probe checks if the application is ready to accept traffic.
        This checks critical dependencies (DB, Redis) that are required for the app to function.
        Kubernetes will stop sending traffic if this fails, but won't restart the container.
        
        Returns:
            200: Application is ready to accept traffic
            503: Application is not ready (critical dependencies unavailable)
        """
        try:

            db_check = DatabaseHealthCheck.check_connection()
            redis_check = RedisHealthCheck.check_connection()
            

            db_healthy = db_check.get("healthy", False)
            redis_healthy = redis_check.get("healthy", False)
            
            if db_healthy and redis_healthy:
                return jsonify({
                    "status": "ready",
                    "database": "healthy",
                    "redis": "healthy",
                    "timestamp": datetime.utcnow().isoformat()
                }), 200
            else:

                return jsonify({
                    "status": "not_ready",
                    "database": "healthy" if db_healthy else "unhealthy",
                    "redis": "healthy" if redis_healthy else "unhealthy",
                    "database_error": db_check.get("error") if not db_healthy else None,
                    "redis_error": redis_check.get("error") if not redis_healthy else None,
                    "timestamp": datetime.utcnow().isoformat()
                }), 503
        except Exception as e:
            logger.error(f"Readiness probe failed: {e}")
            return jsonify({
                "status": "not_ready",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }), 503

    @app.route("/api/metrics", methods=["GET"])
    def get_metrics():
        """Metrics endpoint for Prometheus scraping (JSON format for backward compatibility)"""
        return jsonify(monitoring_system.get_metrics_summary())

    @app.route("/api/status", methods=["GET"])
    def status():
        """Simple status endpoint

        SECURITY: Uses hardcoded constant query with no user input. Safe from SQL injection.
        """
        try:

            db.session.execute(text("SELECT 1"))
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"

        return jsonify(
            {
                "status": "ok",
                "timestamp": datetime.utcnow().isoformat(),
                "database": db_status,
                "version": "1.0.0",
            }
        )

    # Slow query monitoring endpoints removed.
    # Use APM tools (Datadog, NewRelic) or PostgreSQL's pg_stat_statements
    # for query performance monitoring instead of application-level monitoring.

    logger.info(
        "Monitoring endpoints initialized",
        endpoints=[
            "/api/health",
            "/api/metrics",
            "/metrics",
            "/api/status",
            "/api/monitoring/slow-queries",
            "/api/monitoring/query-stats",
            "/api/monitoring/query-patterns",
            "/api/monitoring/top-slow-patterns",
            "/api/monitoring/table-stats",
        ],
    )

def get_monitoring_system() -> MonitoringSystem:
    """Get global monitoring system instance"""
    return monitoring_system