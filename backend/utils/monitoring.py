"""
Comprehensive Monitoring and Health Check System
Provides detailed health checks, metrics collection, and observability features.
"""

import json
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import psutil
import redis
from flask import current_app, jsonify, request
from sqlalchemy import text

from ..core.extensions import db
from ..utils.slow_query_monitor import get_slow_query_monitor
from ..utils.storage_manager import get_storage_manager
from ..utils.structured_logging import get_logger, metrics

logger = get_logger(__name__)

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

            slow_query_monitor = get_slow_query_monitor()
            slow_query_stats = slow_query_monitor.get_statistics()

            slow_query_ratio = 0.0
            if slow_query_stats["stats"]["total_queries"] > 0:
                slow_query_ratio = (
                    slow_query_stats["stats"]["slow_queries"]
                    / slow_query_stats["stats"]["total_queries"]
                ) * 100

            is_healthy = duration < 1.0 and slow_query_ratio < 5.0

            return {
                "healthy": is_healthy,
                "query_time_ms": round(duration * 1000, 2),
                "slow_query_ratio": round(slow_query_ratio, 2),
                "avg_query_time_ms": round(
                    slow_query_stats["stats"].get("avg_query_time_ms", 0), 2
                ),
                "max_query_time_ms": round(
                    slow_query_stats["stats"].get("max_query_time_ms", 0), 2
                ),
                "details": f"Database queries completed in {duration:.2f}s, slow query ratio: {slow_query_ratio:.2f}%",
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

class SystemHealthCheck:
    """System resource health check"""

    @staticmethod
    def check_resources():
        """Check system resources"""
        try:

            cpu_percent = psutil.cpu_percent(interval=1)

            memory = psutil.virtual_memory()

            disk = psutil.disk_usage("/")

            load_avg = psutil.getloadavg() if hasattr(psutil, "getloadavg") else None

            return {
                "healthy": cpu_percent < 90 and memory.percent < 90 and disk.percent < 90,
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "disk_percent": disk.percent,
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "load_average": load_avg,
                "details": f"CPU: {cpu_percent}%, Memory: {memory.percent}%, Disk: {disk.percent}%",
            }
        except Exception as e:
            return {"healthy": False, "error": str(e), "details": "System resource check failed"}

class ApplicationHealthCheck:
    """Application-specific health checks"""

    @staticmethod
    def check_application():
        """Check application health"""
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
                "details": "Application is running normally",
            }
        except Exception as e:
            return {"healthy": False, "error": str(e), "details": "Application health check failed"}

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

        self.add_health_check("system_resources", SystemHealthCheck.check_resources, critical=False)

        self.add_health_check(
            "application", ApplicationHealthCheck.check_application, critical=True
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

            cpu_percent = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")

            from models.core import Project, User, UserActivity

            total_users = User.query.count()
            total_projects = Project.query.count()
            recent_activities = UserActivity.query.filter(
                UserActivity.created_at > datetime.utcnow() - timedelta(hours=1)
            ).count()

            return {
                "timestamp": datetime.utcnow().isoformat(),
                "system": {
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory.percent,
                    "disk_percent": disk.percent,
                    "load_average": psutil.getloadavg() if hasattr(psutil, "getloadavg") else None,
                },
                "application": {
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

    @app.route("/api/metrics", methods=["GET"])
    def get_metrics():
        """Metrics endpoint for Prometheus scraping"""
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

    @app.route("/api/monitoring/slow-queries", methods=["GET"])
    def get_slow_queries():
        """Get recent slow queries"""
        try:
            limit = int(request.args.get("limit", 50))
            min_duration_ms = request.args.get("min_duration_ms")
            min_duration_ms = float(min_duration_ms) if min_duration_ms else None

            slow_query_monitor = get_slow_query_monitor()
            queries = slow_query_monitor.get_slow_queries(
                limit=limit, min_duration_ms=min_duration_ms
            )

            return jsonify(
                {
                    "slow_queries": queries,
                    "count": len(queries),
                    "threshold_ms": slow_query_monitor.slow_query_threshold_ms,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            logger.error(f"Error getting slow queries: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/monitoring/query-stats", methods=["GET"])
    def get_query_stats():
        """Get query statistics"""
        try:
            slow_query_monitor = get_slow_query_monitor()
            stats = slow_query_monitor.get_statistics()

            return jsonify(stats)
        except Exception as e:
            logger.error(f"Error getting query stats: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/monitoring/query-patterns", methods=["GET"])
    def get_query_patterns():
        """Get query patterns for analysis"""
        try:
            limit = int(request.args.get("limit", 20))
            min_count = int(request.args.get("min_count", 5))

            slow_query_monitor = get_slow_query_monitor()
            patterns = slow_query_monitor.get_query_patterns(limit=limit, min_count=min_count)

            return jsonify(
                {
                    "patterns": patterns,
                    "count": len(patterns),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            logger.error(f"Error getting query patterns: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/monitoring/top-slow-patterns", methods=["GET"])
    def get_top_slow_patterns():
        """Get top slowest query patterns"""
        try:
            limit = int(request.args.get("limit", 10))

            slow_query_monitor = get_slow_query_monitor()
            patterns = slow_query_monitor.get_top_slow_patterns(limit=limit)

            return jsonify(
                {
                    "patterns": patterns,
                    "count": len(patterns),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            logger.error(f"Error getting top slow patterns: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/monitoring/table-stats", methods=["GET"])
    def get_table_stats():
        """Get statistics per table"""
        try:
            slow_query_monitor = get_slow_query_monitor()
            table_stats = slow_query_monitor.get_table_statistics()

            return jsonify(
                {
                    "table_stats": table_stats,
                    "count": len(table_stats),
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            logger.error(f"Error getting table stats: {e}")
            return jsonify({"error": str(e)}), 500

    logger.info(
        "Monitoring endpoints initialized",
        endpoints=[
            "/api/health",
            "/api/metrics",
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
