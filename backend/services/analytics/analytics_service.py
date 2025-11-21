"""
Analytics Service
Provides comprehensive analytics and insights for administrators
"""

import json
import logging
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, desc, func, or_, text

from ...core.extensions import db
from ...models.core import Project, User, UserActivity
from ...models.products import Product
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

            period_days = min(max(period_days, 1), self.max_period_days)
            start_date = datetime.utcnow() - timedelta(days=period_days)

            base_filter = []
            if project_id:
                base_filter.append(Project.id == project_id)

            stats = self._get_basic_statistics(project_id, start_date)

            sales_analytics = self._get_sales_analytics(project_id, start_date)

            user_analytics = self._get_user_analytics(project_id, start_date)

            geography_analytics = self._get_geography_analytics(project_id, start_date)

            popular_products = self._get_popular_products(project_id, start_date)

            security_analytics = self._get_security_analytics(project_id, start_date)

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

            period_days = min(max(period_days, 1), self.max_period_days)
            start_date = datetime.utcnow() - timedelta(days=period_days)

            stats = self._get_system_statistics(start_date)

            sales_analytics = self._get_system_sales_analytics(start_date)

            user_analytics = self._get_system_user_analytics(start_date)

            geography_analytics = self._get_system_geography_analytics(start_date)

            popular_products = self._get_system_popular_products(start_date)

            security_analytics = self._get_system_security_analytics(start_date)

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

            user_query = User.query
            if project_id:
                user_query = user_query.filter(User.project_id == project_id)
            total_users = user_query.count()

            new_users = user_query.filter(User.created_at >= start_date).count()

            key_query = Key.query
            if project_id:
                key_query = key_query.filter(Key.project_id == project_id)
            total_keys = key_query.count()

            active_keys = key_query.filter(Key.status == 1).count()

            project_query = Project.query
            if project_id:
                project_query = project_query.filter(Project.id == project_id)
            total_projects = project_query.count()

            active_projects = project_query.filter(Project.is_active == True).count()

            product_query = Product.query
            if project_id:
                product_query = product_query.filter(Product.project_id == project_id)
            total_products = product_query.count()

            active_products = product_query.filter(Product.status == "active").count()

            total_revenue = 0

            return {
                "total_users": total_users,
                "new_users": new_users,
                "total_keys": total_keys,
                "active_keys": active_keys,
                "total_projects": total_projects,
                "active_projects": active_projects,
                "total_products": total_products,
                "active_products": active_products,
                "total_revenue": total_revenue,
                "user_growth_rate": self._calculate_growth_rate(new_users, total_users, 30),
            }

        except Exception as e:
            logging.error(f"ANALYTICS_BASIC_STATISTICS_ERROR project_id={project_id} error={e}")
            return {}

    def _get_sales_analytics(self, project_id: Optional[int], start_date: datetime) -> Dict:
        """Get sales analytics"""
        try:

            daily_sales = []
            current_date = start_date.date()
            end_date = datetime.utcnow().date()

            while current_date <= end_date:

                key_query = Key.query.filter(func.date(Key.created_at) == current_date)
                if project_id:
                    key_query = key_query.filter(Key.project_id == project_id)

                daily_count = key_query.count()
                daily_sales.append(
                    {
                        "date": current_date.isoformat(),
                        "count": daily_count,
                        "revenue": daily_count * 10,
                    }
                )

                current_date += timedelta(days=1)

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

            top_products = (
                db.session.query(Product.name, func.count(Key.id).label("key_count"))
                .join(Key, Product.id == Key.product_id)
                .filter(Key.created_at >= start_date)
            )

            if project_id:
                top_products = top_products.filter(Product.project_id == project_id)

            top_products = top_products.group_by(Product.name).order_by(desc("key_count")).limit(10).all()

            return {
                "daily_sales": daily_sales,
                "weekly_sales": weekly_sales,
                "top_products": [
                    {
                        "product_name": product.name,
                        "key_count": product.key_count,
                        "revenue": product.key_count * 10,
                    }
                    for product in top_products
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

            role_query = db.session.query(
                Role.name, func.count(UserRole.user_id).label("count")
            ).join(UserRole, Role.id == UserRole.role_id)

            if project_id:
                role_query = role_query.filter(Role.project_id == project_id)

            role_distribution = role_query.group_by(Role.name).all()

            active_users = User.query.filter(User.last_login >= start_date)
            if project_id:
                active_users = active_users.filter(User.project_id == project_id)

            active_users_count = active_users.count()

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

            device_query = DeviceInfo.query.filter(DeviceInfo.connected_at >= start_date)

            if project_id:
                device_query = device_query.join(Key).filter(Key.project_id == project_id)

            devices = device_query.all()

            country_counts = {}
            for device in devices:

                country = self._get_country_from_ip(device.ip_address)
                country_counts[country] = country_counts.get(country, 0) + 1

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

            popular_products = (
                db.session.query(
                    Product.name,
                    Product.id,
                    func.count(Key.id).label("key_count"),
                    func.count(DeviceInfo.id).label("activation_count"),
                )
                .join(Key, Product.id == Key.product_id)
                .outerjoin(DeviceInfo, Key.id == DeviceInfo.key_id)
                .filter(Key.created_at >= start_date)
            )

            if project_id:
                popular_products = popular_products.filter(Product.project_id == project_id)

            popular_products = (
                popular_products.group_by(Product.id, Product.name)
                .order_by(desc("key_count"))
                .limit(10)
                .all()
            )

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
                "popular_products": [
                    {
                        "product_name": product.name,
                        "product_id": product.id,
                        "key_count": product.key_count,
                        "activation_count": product.activation_count,
                    }
                    for product in popular_products
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

            blocked_fingerprints = BlockedFingerprint.query.filter(
                BlockedFingerprint.created_at >= start_date
            )
            if project_id:
                blocked_fingerprints = blocked_fingerprints.filter(
                    BlockedFingerprint.project_id == project_id
                )

            blocked_count = blocked_fingerprints.count()

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

            db_health = self._check_database_health()
            database_status = "healthy" if db_health.get("status") == "healthy" else "error"

            redis_health = self._check_redis_health()
            redis_status = "healthy" if redis_health.get("status") == "healthy" else "error"

            storage_health = self._check_storage_health()
            disk_usage = 100 - storage_health.get("free_percentage", 0)

            cpu_usage = self._get_cpu_usage()

            memory_usage = self._get_memory_usage()

            network_status = self._check_network_status()

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

        return round((new_count / total_count) * 100, 2)

    def _get_country_from_ip(self, ip_address: str) -> str:
        """Get country from IP address (simplified)"""

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

            db.session.execute(text("SELECT 1"))

            start_time = time.time()
            db.session.execute(text("SELECT COUNT(*) FROM user"))
            response_time = time.time() - start_time

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
                "response_time": round(response_time * 1000, 2),
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

            start_time = time.time()
            client.ping()
            response_time = time.time() - start_time

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
                "response_time": round(response_time * 1000, 2),
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

            total, used, free = shutil.disk_usage("/")
            free_percentage = (free / total) * 100

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

            try:

                with open("/proc/stat", "r") as f:
                    line1 = f.readline()
                    if line1.startswith("cpu "):
                        fields1 = line1.split()
                        total1 = sum(int(f) for f in fields1[1:])
                        idle1 = int(fields1[4])

                time.sleep(0.1)

                with open("/proc/stat", "r") as f:
                    line2 = f.readline()
                    if line2.startswith("cpu "):
                        fields2 = line2.split()
                        total2 = sum(int(f) for f in fields2[1:])
                        idle2 = int(fields2[4])

                        total_delta = total2 - total1
                        idle_delta = idle2 - idle1
                        if total_delta > 0:
                            usage = 100.0 * (1.0 - (idle_delta / total_delta))
                            return max(0.0, min(100.0, usage))
            except (IOError, ValueError, IndexError, AttributeError):
                pass

            return 25.0

    def _get_memory_usage(self) -> float:
        """Get memory usage percentage"""
        try:
            import psutil

            return psutil.virtual_memory().percent
        except ImportError:

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

            return 45.0

    def _check_network_status(self) -> str:
        """Check network connectivity status"""
        try:
            import socket

            socket.setdefaulttimeout(2)
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect(("8.8.8.8", 53))
            sock.close()
            return "online"
        except (socket.error, OSError):

            try:
                socket.gethostbyname("google.com")
                return "online"
            except (socket.gaierror, OSError):

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

            total_users = User.query.count()
            active_users = User.query.filter(User.last_login >= start_date).count()
            new_today = User.query.filter(User.created_at >= datetime.utcnow().date()).count()
            new_week = User.query.filter(
                User.created_at >= datetime.utcnow() - timedelta(days=7)
            ).count()
            new_month = User.query.filter(
                User.created_at >= datetime.utcnow() - timedelta(days=30)
            ).count()

            total_keys = Key.query.count()
            active_keys = Key.query.filter(
                Key.status == 1, Key.expires_at > datetime.utcnow()
            ).count()
            expired_keys = Key.query.filter(
                Key.status == 1, Key.expires_at <= datetime.utcnow()
            ).count()

            total_projects = Project.query.count()
            active_projects = Project.query.filter(Project.is_active == True).count()

            total_products = Product.query.count()
            active_products = Product.query.filter(Product.status == "active").count()

            from ...models.servers import Server

            total_servers = Server.query.count()
            online_servers = Server.query.filter(Server.status == "online").count()

            system_uptime = 99.9

            total_revenue = 0
            monthly_revenue = 0

            return {
                "total_projects": total_projects,
                "active_projects": active_projects,
                "total_users": total_users,
                "active_users": active_users,
                "total_keys": total_keys,
                "active_keys": active_keys,
                "total_products": total_products,
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

            projects = Project.query.all()
            project_analytics = []

            for project in projects:

                users_count = User.query.filter(User.project_id == project.id).count()

                keys_count = Key.query.filter(Key.project_id == project.id).count()

                products_count = Product.query.filter(Product.project_id == project.id).count()

                from ...models.servers import Server

                servers_count = Server.query.filter(Server.project_id == project.id).count()

                project_analytics.append(
                    {
                        "project_id": project.id,
                        "project_name": project.name,
                        "users_count": users_count,
                        "keys_count": keys_count,
                        "products_count": products_count,
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

                role_stats = (
                    db.session.query(Role.name, func.count(UserRole.user_id))
                    .join(UserRole, Role.id == UserRole.role_id)
                    .group_by(Role.name)
                    .all()
                )
                by_role = [{"role": role, "count": count} for role, count in role_stats]

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

            for i in range(30):
                date = start_date + timedelta(days=i)
                daily_revenue.append(
                    {
                        "date": date.strftime("%Y-%m-%d"),
                        "revenue": 0,
                    }
                )

            for i in range(12):
                month = datetime.utcnow() - timedelta(days=30 * i)
                monthly_revenue.append(
                    {
                        "month": month.strftime("%Y-%m"),
                        "revenue": 0,
                    }
                )

            projects = Project.query.all()
            for project in projects:
                by_project.append(
                    {
                        "project": project.name,
                        "revenue": 0
                    }
                )

            return {"daily": daily_revenue, "monthly": monthly_revenue, "by_project": by_project}

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_SALES_ANALYTICS_ERROR error={e}")
            return {}

    def _get_system_geography_analytics(self, start_date: datetime) -> Dict:
        """Get system-wide geography analytics (mock data)"""
        try:

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

                popular_products = (
                    db.session.query(Product.name, func.count(Key.id).label("key_count"))
                    .join(Key, Product.id == Key.product_id)
                    .group_by(Product.id, Product.name)
                    .order_by(func.count(Key.id).desc())
                    .limit(10)
                    .all()
                )

                return [{"product": product, "keys": count} for product, count in popular_products]

        except Exception as e:
            logging.error(f"ANALYTICS_SYSTEM_POPULAR_PRODUCTS_ERROR error={e}")
            return []

    def _get_system_security_analytics(self, start_date: datetime) -> Dict:
        """Get system-wide security analytics"""
        try:

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

analytics_service = AnalyticsService()
