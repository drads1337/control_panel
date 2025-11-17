"""
Analytics Service
Provides comprehensive analytics and insights for administrators
"""

import json
import logging
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, desc, func, or_

from ...core.extensions import db
from ...models.core import Project, User, UserActivity
from ...models.games import Game
from ...models.keys import DeviceInfo, Key, KeyAnalytics
from ...models.notifications import Notification
from ...models.rbac import Role, UserRole
from ...models.security import BlockedFingerprint, TwoFactorAuth


class AnalyticsService:
    """Service for providing comprehensive analytics and insights"""

    def __init__(self, logger=None, cache_service=None):
        self.default_period_days = 30
        self.max_period_days = 365
        self.logger = logger or logging.getLogger(__name__)
        self.cache_service = cache_service

    def get_dashboard_overview(
        self, project_id: Optional[int] = None, period_days: int = 30
    ) -> Dict:
        """Get comprehensive dashboard overview"""
        try:
            # Validate period
            period_days = min(max(period_days, 1), self.max_period_days)
            start_date = datetime.utcnow() - timedelta(days=period_days)

            # Base query filter
            base_filter = []
            if project_id:
                base_filter.append(Project.id == project_id)

            # Get basic statistics
            stats = self._get_basic_statistics(project_id, start_date)

            # Get sales analytics
            sales_analytics = self._get_sales_analytics(project_id, start_date)

            # Get user analytics
            user_analytics = self._get_user_analytics(project_id, start_date)

            # Get activation geography
            geography_analytics = self._get_geography_analytics(project_id, start_date)

            # Get popular products
            popular_products = self._get_popular_products(project_id, start_date)

            # Get security analytics
            security_analytics = self._get_security_analytics(project_id, start_date)

            # Get system health
            system_health = self._get_system_health(project_id)

            return {
                "period_days": period_days,
                "start_date": start_date.isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "statistics": stats,
                "sales_analytics": sales_analytics,
                "user_analytics": user_analytics,
                "geography_analytics": geography_analytics,
                "popular_products": popular_products,
                "security_analytics": security_analytics,
                "system_health": system_health,
                "generated_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_DASHBOARD_OVERVIEW_ERROR project_id={project_id} error={e}")
            return {}

    def get_system_overview(self, period_days: int = 30) -> Dict:
        """Get comprehensive system-wide overview for owner dashboard"""
        try:
            # Validate period
            period_days = min(max(period_days, 1), self.max_period_days)
            start_date = datetime.utcnow() - timedelta(days=period_days)

            # Get system-wide statistics (no project filtering)
            stats = self._get_system_statistics(start_date)

            # Get system-wide sales analytics
            sales_analytics = self._get_system_sales_analytics(start_date)

            # Get system-wide user analytics
            user_analytics = self._get_system_user_analytics(start_date)

            # Get system-wide geography analytics
            geography_analytics = self._get_system_geography_analytics(start_date)

            # Get system-wide popular products
            popular_products = self._get_system_popular_products(start_date)

            # Get system-wide security analytics
            security_analytics = self._get_system_security_analytics(start_date)

            # Get system health (no project_id needed for system-wide health)
            system_health = self._get_system_health(None)

            return {
                "period_days": period_days,
                "start_date": start_date.isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "system_overview": stats,
                "project_analytics": self._get_project_analytics(),
                "user_analytics": user_analytics,
                "revenue_analytics": sales_analytics,
                "system_health": system_health,
                "security_metrics": security_analytics,
                "generated_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_OVERVIEW_ERROR error={e}")
            return None

    def _get_basic_statistics(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get basic statistics"""
        try:
            # Total users
            user_query = User.query
            if project_id:
                user_query = user_query.filter(User.project_id == project_id)
            total_users = user_query.count()

            # New users in period
            new_users = user_query.filter(User.created_at >= start_date).count()

            # Total keys
            key_query = Key.query
            if project_id:
                key_query = key_query.filter(Key.project_id == project_id)
            total_keys = key_query.count()

            # Active keys
            active_keys = key_query.filter(Key.status == 1).count()

            # Total projects
            project_query = Project.query
            if project_id:
                project_query = project_query.filter(Project.id == project_id)
            total_projects = project_query.count()

            # Active projects
            active_projects = project_query.filter(Project.is_active == True).count()

            # Total games
            game_query = Game.query
            if project_id:
                game_query = game_query.filter(Game.project_id == project_id)
            total_games = game_query.count()

            # Active games
            active_games = game_query.filter(Game.status == "active").count()

            # Total revenue (if you have revenue tracking)
            total_revenue = 0  # Implement revenue tracking if needed

            return {
                "total_users": total_users,
                "new_users": new_users,
                "total_keys": total_keys,
                "active_keys": active_keys,
                "total_projects": total_projects,
                "active_projects": active_projects,
                "total_games": total_games,
                "active_games": active_games,
                "total_revenue": total_revenue,
                "user_growth_rate": self._calculate_growth_rate(new_users, total_users, 30),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_BASIC_STATISTICS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_sales_analytics(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get sales analytics"""
        try:
            # Daily sales data
            daily_sales = []
            current_date = start_date.date()
            end_date = datetime.utcnow().date()

            while current_date <= end_date:
                # Count keys created on this date
                key_query = Key.query.filter(func.date(Key.created_at) == current_date)
                if project_id:
                    key_query = key_query.filter(Key.project_id == project_id)

                daily_count = key_query.count()
                daily_sales.append(
                    {
                        "date": current_date.isoformat(),
                        "count": daily_count,
                        "revenue": daily_count * 10,  # Assuming $10 per key
                    }
                )

                current_date += timedelta(days=1)

            # Weekly sales data
            weekly_sales = []
            current_week = start_date.date()
            while current_week <= end_date:
                week_end = current_week + timedelta(days=6)

                key_query = Key.query.filter(
                    and_(
                        func.date(Key.created_at) >= current_week,
                        func.date(Key.created_at) <= week_end,
                    )
                )
                if project_id:
                    key_query = key_query.filter(Key.project_id == project_id)

                weekly_count = key_query.count()
                weekly_sales.append(
                    {
                        "week_start": current_week.isoformat(),
                        "week_end": week_end.isoformat(),
                        "count": weekly_count,
                        "revenue": weekly_count * 10,
                    }
                )

                current_week += timedelta(days=7)

            # Top selling games
            top_games = (
                db.session.query(Game.name, func.count(Key.id).label("key_count"))
                .join(Key, Game.id == Key.game_id)
                .filter(Key.created_at >= start_date)
            )

            if project_id:
                top_games = top_games.filter(Game.project_id == project_id)

            top_games = top_games.group_by(Game.name).order_by(desc("key_count")).limit(10).all()

            return {
                "daily_sales": daily_sales,
                "weekly_sales": weekly_sales,
                "top_games": [
                    {
                        "game_name": game.name,
                        "key_count": game.key_count,
                        "revenue": game.key_count * 10,
                    }
                    for game in top_games
                ],
                "total_period_sales": sum(day["count"] for day in daily_sales),
                "total_period_revenue": sum(day["revenue"] for day in daily_sales),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_SALES_ANALYTICS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_user_analytics(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get user analytics"""
        try:
            # User registration trends
            daily_registrations = []
            current_date = start_date.date()
            end_date = datetime.utcnow().date()

            while current_date <= end_date:
                user_query = User.query.filter(func.date(User.created_at) == current_date)
                if project_id:
                    user_query = user_query.filter(User.project_id == project_id)

                daily_count = user_query.count()
                daily_registrations.append({"date": current_date.isoformat(), "count": daily_count})

                current_date += timedelta(days=1)

            # User role distribution using RBAC
            role_query = db.session.query(
                Role.name, func.count(UserRole.user_id).label("count")
            ).join(UserRole, Role.id == UserRole.role_id)

            if project_id:
                role_query = role_query.filter(Role.project_id == project_id)

            role_distribution = role_query.group_by(Role.name).all()

            # Active users (users with recent activity)
            active_users = User.query.filter(User.last_login >= start_date)
            if project_id:
                active_users = active_users.filter(User.project_id == project_id)

            active_users_count = active_users.count()

            # User retention (users who created keys in the last 30 days)
            retained_users = User.query.filter(
                User.id.in_(
                    db.session.query(Key.user_id).filter(Key.created_at >= start_date).distinct()
                )
            )
            if project_id:
                retained_users = retained_users.filter(User.project_id == project_id)

            retained_users_count = retained_users.count()

            return {
                "daily_registrations": daily_registrations,
                "role_distribution": [
                    {
                        "role": role.role,
                        "count": role.count,
                        "percentage": round(
                            role.count / sum(r.count for r in role_distribution) * 100, 2
                        ),
                    }
                    for role in role_distribution
                ],
                "active_users": active_users_count,
                "retained_users": retained_users_count,
                "retention_rate": round(retained_users_count / max(1, active_users_count) * 100, 2),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_USER_ANALYTICS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_geography_analytics(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get activation geography analytics"""
        try:
            # Get device info with IP addresses
            device_query = DeviceInfo.query.filter(DeviceInfo.connected_at >= start_date)

            if project_id:
                device_query = device_query.join(Key).filter(Key.project_id == project_id)

            devices = device_query.all()

            # Group by country (you'll need to implement IP to country mapping)
            country_counts = {}
            for device in devices:
                # This is a simplified version - you should use a proper IP geolocation service
                country = self._get_country_from_ip(device.ip_address)
                country_counts[country] = country_counts.get(country, 0) + 1

            # Sort by count
            top_countries = sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:10]

            return {
                "top_countries": [
                    {
                        "country": country,
                        "count": count,
                        "percentage": round(count / max(1, sum(country_counts.values())) * 100, 2),
                    }
                    for country, count in top_countries
                ],
                "total_activations": sum(country_counts.values()),
                "unique_countries": len(country_counts),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_GEOGRAPHY_ANALYTICS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_popular_products(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get popular products analytics"""
        try:
            # Most popular games
            popular_games = (
                db.session.query(
                    Game.name,
                    Game.id,
                    func.count(Key.id).label("key_count"),
                    func.count(DeviceInfo.id).label("activation_count"),
                )
                .join(Key, Game.id == Key.game_id)
                .outerjoin(DeviceInfo, Key.id == DeviceInfo.key_id)
                .filter(Key.created_at >= start_date)
            )

            if project_id:
                popular_games = popular_games.filter(Game.project_id == project_id)

            popular_games = (
                popular_games.group_by(Game.id, Game.name)
                .order_by(desc("key_count"))
                .limit(10)
                .all()
            )

            # Most active users
            active_users = (
                db.session.query(User.username, User.id, func.count(Key.id).label("key_count"))
                .join(Key, User.id == Key.user_id)
                .filter(Key.created_at >= start_date)
            )

            if project_id:
                active_users = active_users.filter(User.project_id == project_id)

            active_users = (
                active_users.group_by(User.id, User.username)
                .order_by(desc("key_count"))
                .limit(10)
                .all()
            )

            return {
                "popular_games": [
                    {
                        "game_name": game.name,
                        "game_id": game.id,
                        "key_count": game.key_count,
                        "activation_count": game.activation_count,
                    }
                    for game in popular_games
                ],
                "active_users": [
                    {"username": user.username, "user_id": user.id, "key_count": user.key_count}
                    for user in active_users
                ],
            }

        except Exception as e:
            logging.error(f"ANALYTICS_POPULAR_PRODUCTS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_security_analytics(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get security analytics"""
        try:
            # Blocked fingerprints
            blocked_fingerprints = BlockedFingerprint.query.filter(
                BlockedFingerprint.created_at >= start_date
            )
            if project_id:
                blocked_fingerprints = blocked_fingerprints.filter(
                    BlockedFingerprint.project_id == project_id
                )

            blocked_count = blocked_fingerprints.count()

            # Recent security events
            security_events = UserActivity.query.filter(
                and_(
                    UserActivity.created_at >= start_date,
                    or_(
                        UserActivity.action.like("%security%"),
                        UserActivity.action.like("%block%"),
                        UserActivity.action.like("%suspicious%"),
                    ),
                )
            )
            if project_id:
                security_events = security_events.join(User).filter(User.project_id == project_id)

            security_events_count = security_events.count()

            # Failed login attempts
            failed_logins = UserActivity.query.filter(
                and_(
                    UserActivity.created_at >= start_date, UserActivity.action.like("%login_error%")
                )
            )
            if project_id:
                failed_logins = failed_logins.join(User).filter(User.project_id == project_id)

            failed_logins_count = failed_logins.count()

            return {
                "blocked_fingerprints": blocked_count,
                "security_events": security_events_count,
                "failed_logins": failed_logins_count,
                "security_score": self._calculate_security_score(
                    blocked_count, security_events_count, failed_logins_count
                ),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_SECURITY_ANALYTICS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_system_health(self, project_id: Optional[int] = None) -> Dict:
        """Get system health metrics in format expected by frontend"""
        try:
            # Database health
            db_health = self._check_database_health()
            database_status = "healthy" if db_health.get("status") == "healthy" else "error"

            # Redis health
            redis_health = self._check_redis_health()
            redis_status = "healthy" if redis_health.get("status") == "healthy" else "error"

            # Storage health
            storage_health = self._check_storage_health()
            disk_usage = 100 - storage_health.get("free_percentage", 0)

            # CPU usage
            cpu_usage = self._get_cpu_usage()

            # Memory usage
            memory_usage = self._get_memory_usage()

            # Network status
            network_status = self._check_network_status()

            # Last backup (mock for now - implement actual backup tracking)
            last_backup = datetime.utcnow().isoformat()

            return {
                "cpu_usage": round(cpu_usage, 1),
                "memory_usage": round(memory_usage, 1),
                "disk_usage": round(disk_usage, 1),
                "network_status": network_status,
                "database_status": database_status,
                "redis_status": redis_status,
                "last_backup": last_backup,
            }

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_HEALTH_ERROR project_id={project_id} error={e}")
            # Return default values on error
            return {
                "cpu_usage": 0.0,
                "memory_usage": 0.0,
                "disk_usage": 0.0,
                "network_status": "offline",
                "database_status": "error",
                "redis_status": "error",
                "last_backup": None,
            }

    def _calculate_growth_rate(self, new_count: int, total_count: int, period_days: int) -> float:
        """Calculate growth rate"""
        if total_count == 0:
            return 0.0

        # Simple growth rate calculation
        return round((new_count / total_count) * 100, 2)

    def _get_country_from_ip(self, ip_address: str) -> str:
        """Get country from IP address (simplified)"""
        # This is a simplified version - you should use a proper IP geolocation service
        # like MaxMind GeoIP2 or similar
        try:
            import requests

            response = requests.get(f"https://ipapi.co/{ip_address}/country/", timeout=2)
            if response.status_code == 200:
                return response.text.strip()
        except Exception:
            pass

        return "Unknown"

    def _calculate_security_score(
        self, blocked_count: int, security_events: int, failed_logins: int
    ) -> int:
        """Calculate security score (0-100)"""
        # Simple security score calculation
        # Lower numbers are better
        total_issues = blocked_count + security_events + failed_logins

        if total_issues == 0:
            return 100
        elif total_issues < 10:
            return 90
        elif total_issues < 50:
            return 70
        elif total_issues < 100:
            return 50
        else:
            return 30

    def _check_database_health(self) -> Dict:
        """Check database health"""
        try:
            # Test database connection
            db.session.execute("SELECT 1")

            # Check response time
            start_time = time.time()
            db.session.execute("SELECT COUNT(*) FROM user")
            response_time = time.time() - start_time

            # Calculate score based on response time
            if response_time < 0.1:
                score = 100
            elif response_time < 0.5:
                score = 80
            elif response_time < 1.0:
                score = 60
            else:
                score = 40

            return {
                "status": "healthy",
                "score": score,
                "response_time": round(response_time * 1000, 2),  # Convert to ms
                "message": "Database connection successful",
            }

        except Exception as e:
            logging.error(f"Database health check failed: {e}")
            return {
                "status": "error",
                "score": 0,
                "response_time": 0,
                "message": f"Database error: {str(e)}",
            }

    def _check_redis_health(self) -> Dict:
        """Check Redis health"""
        try:
            import redis

            from ...config.config import Config

            client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )

            # Test Redis connection
            start_time = time.time()
            client.ping()
            response_time = time.time() - start_time

            # Calculate score based on response time
            if response_time < 0.01:
                score = 100
            elif response_time < 0.05:
                score = 80
            elif response_time < 0.1:
                score = 60
            else:
                score = 40

            return {
                "status": "healthy",
                "score": score,
                "response_time": round(response_time * 1000, 2),  # Convert to ms
                "message": "Redis connection successful",
            }

        except Exception as e:
            return {
                "status": "error",
                "score": 0,
                "response_time": 0,
                "message": f"Redis error: {str(e)}",
            }

    def _check_storage_health(self) -> Dict:
        """Check storage health"""
        try:
            import os
            import shutil

            # Check available disk space
            total, used, free = shutil.disk_usage("/")
            free_percentage = (free / total) * 100

            # Calculate score based on free space
            if free_percentage > 20:
                score = 100
            elif free_percentage > 10:
                score = 80
            elif free_percentage > 5:
                score = 60
            else:
                score = 40

            return {
                "status": "healthy" if free_percentage > 10 else "warning",
                "score": score,
                "free_space_gb": round(free / (1024**3), 2),
                "free_percentage": round(free_percentage, 2),
                "message": f"{free_percentage:.1f}% free space available",
            }

        except Exception as e:
            return {
                "status": "error",
                "score": 0,
                "free_space_gb": 0,
                "free_percentage": 0,
                "message": f"Storage error: {str(e)}",
            }

    def _get_cpu_usage(self) -> float:
        """Get CPU usage percentage"""
        try:
            import psutil

            return psutil.cpu_percent(interval=0.1)
        except ImportError:
            # Fallback: try using /proc/stat on Linux (requires two snapshots)
            try:
                # First snapshot
                with open("/proc/stat", "r") as f:
                    line1 = f.readline()
                    if line1.startswith("cpu "):
                        fields1 = line1.split()
                        total1 = sum(int(f) for f in fields1[1:])
                        idle1 = int(fields1[4])

                # Wait a bit
                time.sleep(0.1)

                # Second snapshot
                with open("/proc/stat", "r") as f:
                    line2 = f.readline()
                    if line2.startswith("cpu "):
                        fields2 = line2.split()
                        total2 = sum(int(f) for f in fields2[1:])
                        idle2 = int(fields2[4])

                        # Calculate usage
                        total_delta = total2 - total1
                        idle_delta = idle2 - idle1
                        if total_delta > 0:
                            usage = 100.0 * (1.0 - (idle_delta / total_delta))
                            return max(0.0, min(100.0, usage))
            except (IOError, ValueError, IndexError, AttributeError):
                pass
            # Return a default value if we can't get CPU usage
            return 25.0  # Default reasonable value

    def _get_memory_usage(self) -> float:
        """Get memory usage percentage"""
        try:
            import psutil

            return psutil.virtual_memory().percent
        except ImportError:
            # Fallback: try using /proc/meminfo on Linux
            try:
                with open("/proc/meminfo", "r") as f:
                    meminfo = {}
                    for line in f:
                        parts = line.split()
                        if len(parts) >= 2:
                            meminfo[parts[0].rstrip(":")] = int(parts[1])

                    total = meminfo.get("MemTotal", 0)
                    available = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))

                    if total > 0:
                        used = total - available
                        usage = 100.0 * (used / total)
                        return max(0.0, min(100.0, usage))
            except (IOError, ValueError, KeyError):
                pass
            # Return a default value if we can't get memory usage
            return 45.0  # Default reasonable value

    def _check_network_status(self) -> str:
        """Check network connectivity status"""
        try:
            import socket

            # Try to connect to a reliable external DNS service (Google DNS)
            socket.setdefaulttimeout(2)
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect(("8.8.8.8", 53))
            sock.close()
            return "online"
        except (socket.error, OSError):
            # If external check fails, try to resolve a hostname
            try:
                socket.gethostbyname("google.com")
                return "online"
            except (socket.gaierror, OSError):
                # If DNS resolution fails, assume network is available if we can bind
                try:
                    test_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    test_sock.bind(("127.0.0.1", 0))
                    test_sock.close()
                    return "online"
                except (socket.error, OSError):
                    return "offline"

    def _get_system_statistics(self, start_date: datetime) -> Dict:
        """Get system-wide statistics (no project filtering)"""
        try:
            # Use injected logger instead of current_app
            # Total users across all projects
            total_users = User.query.count()
            active_users = User.query.filter(User.last_login >= start_date).count()
            new_today = User.query.filter(User.created_at >= datetime.utcnow().date()).count()
            new_week = User.query.filter(
                User.created_at >= datetime.utcnow() - timedelta(days=7)
            ).count()
            new_month = User.query.filter(
                User.created_at >= datetime.utcnow() - timedelta(days=30)
            ).count()

            # Total keys across all projects
            total_keys = Key.query.count()
            active_keys = Key.query.filter(
                Key.status == 1, Key.expires_at > datetime.utcnow()
            ).count()
            expired_keys = Key.query.filter(
                Key.status == 1, Key.expires_at <= datetime.utcnow()
            ).count()

            # Total projects
            total_projects = Project.query.count()
            active_projects = Project.query.filter(Project.is_active == True).count()

            # Total games across all projects
            total_games = Game.query.count()
            active_games = Game.query.filter(Game.status == "active").count()

            # Total servers across all projects
            from ...models.servers import Server

            total_servers = Server.query.count()
            online_servers = Server.query.filter(Server.status == "online").count()

            # System uptime (mock data - implement actual system monitoring)
            system_uptime = 99.9

            # Revenue (mock data - implement actual revenue tracking)
            total_revenue = 0
            monthly_revenue = 0

            return {
                "total_projects": total_projects,
                "active_projects": active_projects,
                "total_users": total_users,
                "active_users": active_users,
                "total_keys": total_keys,
                "active_keys": active_keys,
                "total_games": total_games,
                "total_servers": total_servers,
                "online_servers": online_servers,
                "system_uptime": system_uptime,
                "total_revenue": total_revenue,
                "monthly_revenue": monthly_revenue,
            }

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_STATISTICS_ERROR error={e}")
            return {}

    def _get_project_analytics(self) -> List[Dict]:
        """Get analytics for all projects"""
        try:
            # Use injected logger instead of current_app
            projects = Project.query.all()
            project_analytics = []

            for project in projects:
                # Count users in this project
                users_count = User.query.filter(User.project_id == project.id).count()

                # Count keys in this project
                keys_count = Key.query.filter(Key.project_id == project.id).count()

                # Count games in this project
                games_count = Game.query.filter(Game.project_id == project.id).count()

                # Count servers in this project
                from ...models.servers import Server

                servers_count = Server.query.filter(Server.project_id == project.id).count()

                project_analytics.append(
                    {
                        "project_id": project.id,
                        "project_name": project.name,
                        "users_count": users_count,
                        "keys_count": keys_count,
                        "games_count": games_count,
                        "servers_count": servers_count,
                        "status": project.status,
                        "subscription_status": project.subscription_status_display,
                        "created_at": (
                            project.created_at.isoformat() if project.created_at else None
                        ),
                        "last_activity": (
                            project.created_at.isoformat() if project.created_at else None
                        ),
                    }
                )

            return project_analytics

        except Exception as e:
            logging.error(f"ANALYTICS_PROJECT_ANALYTICS_ERROR error={e}")
            return []

    def _get_system_user_analytics(self, start_date: datetime) -> Dict:
        """Get system-wide user analytics"""
        try:
            from flask import current_app
            from sqlalchemy import func

            with current_app.app_context():
                # Users by role
                role_stats = (
                    db.session.query(Role.name, func.count(UserRole.user_id))
                    .join(UserRole, Role.id == UserRole.role_id)
                    .group_by(Role.name)
                    .all()
                )
                by_role = [{"role": role, "count": count} for role, count in role_stats]

                # Users by status (using RBAC roles, not static roles)
                # SECURITY: Never use User.is_admin - use RBAC roles only
                admin_roles = ["admin", "owner"]
                admin_role_ids = db.session.query(Role.id).filter(
                    Role.name.in_(admin_roles)
                ).subquery()
                
                admin_user_ids = db.session.query(func.distinct(UserRole.user_id)).filter(
                    UserRole.role_id.in_(admin_role_ids)
                ).subquery()
                
                admin_count = db.session.query(func.count()).select_from(admin_user_ids).scalar() or 0
                total_users = User.query.count()
                regular_count = max(0, total_users - admin_count)
                
                by_status = [
                    {"status": "admin", "count": admin_count},
                    {"status": "user", "count": regular_count}
                ]

                # New users
                new_today = User.query.filter(User.created_at >= datetime.utcnow().date()).count()
                new_week = User.query.filter(
                    User.created_at >= datetime.utcnow() - timedelta(days=7)
                ).count()
                new_month = User.query.filter(
                    User.created_at >= datetime.utcnow() - timedelta(days=30)
                ).count()

                return {
                    "by_role": by_role,
                    "by_status": by_status,
                    "new_today": new_today,
                    "new_week": new_week,
                    "new_month": new_month,
                }

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_USER_ANALYTICS_ERROR error={e}")
            return {}

    def _get_system_sales_analytics(self, start_date: datetime) -> Dict:
        """
        Get system-wide sales analytics.
        
        NOTE: This is a placeholder implementation that returns zero revenue.
        To implement actual revenue tracking, you need to:
        1. Create a revenue/payment tracking model in the database
        2. Store transaction records with amounts and timestamps
        3. Query and aggregate revenue data by date/project
        4. Replace the zero values below with actual revenue calculations
        
        Until revenue tracking is implemented, this method returns empty data structures
        with zero values to maintain API compatibility.
        """
        try:
            daily_revenue = []
            monthly_revenue = []
            by_project = []

            # Generate data structure for the last 30 days
            # TODO: Replace with actual revenue queries from payment/transaction records
            for i in range(30):
                date = start_date + timedelta(days=i)
                daily_revenue.append(
                    {
                        "date": date.strftime("%Y-%m-%d"),
                        "revenue": 0,  # TODO: Query actual revenue from payment records
                    }
                )

            # Generate data structure for monthly data
            # TODO: Replace with actual revenue aggregation from payment records
            for i in range(12):
                month = datetime.utcnow() - timedelta(days=30 * i)
                monthly_revenue.append(
                    {
                        "month": month.strftime("%Y-%m"),
                        "revenue": 0,  # TODO: Aggregate actual revenue from payment records
                    }
                )

            # Project revenue breakdown
            # TODO: Replace with actual revenue aggregation grouped by project
            projects = Project.query.all()
            for project in projects:
                by_project.append(
                    {
                        "project": project.name,
                        "revenue": 0  # TODO: Calculate actual revenue per project from payment records
                    }
                )

            return {"daily": daily_revenue, "monthly": monthly_revenue, "by_project": by_project}

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_SALES_ANALYTICS_ERROR error={e}")
            return {}

    def _get_system_geography_analytics(self, start_date: datetime) -> Dict:
        """Get system-wide geography analytics (mock data)"""
        try:
            # Mock geography data - implement actual IP geolocation
            return {"top_countries": [], "top_cities": [], "total_countries": 0}

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_GEOGRAPHY_ANALYTICS_ERROR error={e}")
            return {}

    def _get_system_popular_products(self, start_date: datetime) -> List[Dict]:
        """Get system-wide popular products"""
        try:
            from flask import current_app
            from sqlalchemy import func

            with current_app.app_context():
                # Get games with most keys across all projects
                popular_games = (
                    db.session.query(Game.name, func.count(Key.id).label("key_count"))
                    .join(Key, Game.id == Key.game_id)
                    .group_by(Game.id, Game.name)
                    .order_by(func.count(Key.id).desc())
                    .limit(10)
                    .all()
                )

                return [{"game": game, "keys": count} for game, count in popular_games]

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_POPULAR_PRODUCTS_ERROR error={e}")
            return []

    def _get_system_security_analytics(self, start_date: datetime) -> Dict:
        """Get system-wide security analytics"""
        try:
            # Use injected logger instead of current_app
            # Mock security data - implement actual security monitoring
            return {
                "failed_logins": 0,
                "blocked_ips": 0,
                "security_alerts": 0,
                "two_factor_enabled": db.session.query(TwoFactorAuth)
                .filter(TwoFactorAuth.is_enabled == True)
                .count(),
                "last_security_scan": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_SECURITY_ANALYTICS_ERROR error={e}")
            return {}


# Global instance
analytics_service = AnalyticsService()
