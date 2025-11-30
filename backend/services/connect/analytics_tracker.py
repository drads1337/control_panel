"""
Analytics Tracker
Handles analytics tracking, notifications, and heartbeat sessions
"""

import json
import logging
from datetime import date, datetime
from typing import Dict, List, Optional

from ...core.extensions import db
from ...utils.service_helpers import get_service
from ...utils.service_exceptions import ServiceError
from ...models import DeviceInfo, KeyAnalytics, Notification, User

class AnalyticsTracker:
    """Handles analytics tracking and related functionality"""
    def __init__(self, activity_service=None, analytics_buffer_service=None, heartbeat_service=None):
        """Initialize AnalyticsTracker with dependencies"""
        self._heartbeat_service = heartbeat_service
        self._analytics_buffer_service = analytics_buffer_service
        self._activity_service = activity_service

    def update_key_analytics(
        self, key_id: int, product: str, ip_address: str, serial: Optional[str] = None
    ) -> None:
        """
        Update analytics for a key using write-behind buffer pattern.
        
        Instead of writing directly to the database, this method buffers the update
        in Redis. A background worker periodically flushes buffered updates to
        PostgreSQL in batches, significantly reducing database write pressure.
        
        Uses Redis HyperLogLog for efficient unique device counting, eliminating
        expensive COUNT(DISTINCT) queries on every update.

        Args:
            key_id: Key ID
            product: Product name
            ip_address: IP address
            serial: Device serial number (optional, used for HyperLogLog unique device counting)
        """
        try:
            # Use write-behind buffer instead of direct DB write
            # HyperLogLog is used for efficient unique device counting
            analytics_buffer_service = get_service('analytics_buffer_service')
            success = analytics_buffer_service.buffer_key_analytics_update(
                key_id=key_id,
                product=product,
                ip_address=ip_address,
                serial=serial,
                increment_connections=True,
            )
            
            if success:
                logging.debug(
                    f"ANALYTICS_BUFFERED key_id={key_id} product={product} (will be flushed to DB by background worker)"
                )
            else:
                # Fallback to direct write if buffer fails
                logging.warning(
                    f"ANALYTICS_BUFFER_FAILED key_id={key_id}, falling back to direct DB write"
                )
                self._update_key_analytics_direct(key_id, product, ip_address, serial)

        except Exception as e:
            logging.error(f"ANALYTICS_UPDATE_ERROR key_id={key_id} error={e}")
            # Fallback to direct write on error
            try:
                self._update_key_analytics_direct(key_id, product, ip_address, serial)
            except Exception as fallback_error:
                logging.error(f"ANALYTICS_FALLBACK_ERROR key_id={key_id} error={fallback_error}")

    def _update_key_analytics_direct(
        self, key_id: int, product: str, ip_address: str, serial: Optional[str] = None
    ) -> None:
        """
        Direct database update (fallback method when buffer fails).
        
        This method performs the original direct database write logic.
        It's kept as a fallback for reliability.
        """
        try:
            today = date.today()

            analytics = KeyAnalytics.query.filter_by(key_id=key_id, date=today).first()

            if not analytics:
                analytics = KeyAnalytics(
                    key_id=key_id,
                    date=today,
                    total_connections=0,
                    unique_devices=0,
                    total_connection_time=0,
                    peak_concurrent=0,
                    countries="[]",
                    products_played="[]",
                )
                db.session.add(analytics)

            analytics.total_connections += 1

            unique_devices_today = (
                db.session.query(db.func.count(db.func.distinct(DeviceInfo.serial)))
                .filter(DeviceInfo.key_id == key_id, db.func.date(DeviceInfo.last_seen) == today)
                .scalar()
            )
            analytics.unique_devices = unique_devices_today or 0

            products_list = json.loads(analytics.products_played or "[]")
            if product not in products_list:
                products_list.append(product)
            analytics.products_played = json.dumps(products_list)

            analytics.updated_at = datetime.utcnow()
            db.session.commit()

            logging.info(
                f"ANALYTICS_UPDATED_DIRECT key_id={key_id} total_connections={analytics.total_connections}"
            )

        except Exception as e:
            logging.error(f"ANALYTICS_DIRECT_UPDATE_ERROR key_id={key_id} error={e}")
            db.session.rollback()

    def get_notifications(
        self, project_id: int, user_id: Optional[int] = None, limit: int = 10
    ) -> List[Dict]:
        """
        Get notifications for a project/user

        Args:
            project_id: Project ID
            user_id: User ID (optional)
            limit: Maximum number of notifications to return

        Returns:
            List of notification dictionaries
        """
        try:
            query = Notification.query.filter_by(
                project_id=project_id, is_read=False, is_deleted=False
            )

            if user_id:
                query = query.filter(
                    (Notification.user_id.is_(None)) | (Notification.user_id == user_id)
                )

            notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

            result = []
            for notification in notifications:
                message = notification.message
                title = ""
                content = message

                if ":" in message:
                    parts = message.split(":", 1)
                    if len(parts) == 2:
                        title = parts[0].strip()
                        content = parts[1].strip()

                result.append(
                    {
                        "id": notification.id,
                        "title": title,
                        "message": content,
                        "type": notification.type,
                        "created_at": (
                            notification.created_at.isoformat() if notification.created_at else None
                        ),
                    }
                )

                notification.is_read = True

            db.session.commit()
            return result

        except Exception as e:
            logging.error(f"Error fetching notifications: {str(e)}")
            return []

    def create_heartbeat_session(
        self, user_key: str, fingerprint: str, product: str, serial: str, ip_address: str
    ) -> Optional[Dict]:
        """
        Create heartbeat session for connection

        Args:
            user_key: User key
            fingerprint: Device fingerprint
            product: Product name
            serial: Device serial
            ip_address: IP address

        Returns:
            Heartbeat session data or None if failed
        """
        try:
            heartbeat_service = get_service('heartbeat_service')
            heartbeat_session = heartbeat_service.create_session(
                user_key=user_key,
                fingerprint=fingerprint,
                product=product,
                serial=serial,
                ip_address=ip_address,
            )

            logging.info(
                f"HEARTBEAT_SESSION_CREATED session_id={heartbeat_session['session_id']} user_key={user_key}"
            )
            return heartbeat_session

        except Exception as e:
            logging.error(f"HEARTBEAT_SESSION_CREATION_FAILED user_key={user_key} error={e}")
            return None

    def log_user_activity(self, user: User, action: str, details: str, ip: str) -> None:
        """
        Log user activity

        Args:
            user: User object
            action: Action performed
            details: Additional details
            ip: IP address
        """
        try:
            activity_service = get_service('activity_service')
            activity_service.log_activity(user, action, details=details, ip=ip)
        except Exception as e:
            logging.error(f"Error logging user activity: {e}")

    def get_analytics_summary(self, key_id: int, days: int = 30) -> Dict:
        """
        Get analytics summary for a key

        Args:
            key_id: Key ID
            days: Number of days to include

        Returns:
            Analytics summary dictionary
        """
        try:
            from datetime import timedelta

            end_date = date.today()
            start_date = end_date - timedelta(days=days)

            analytics = KeyAnalytics.query.filter(
                KeyAnalytics.key_id == key_id,
                KeyAnalytics.date >= start_date,
                KeyAnalytics.date <= end_date,
            ).all()

            total_connections = sum(a.total_connections for a in analytics)
            total_unique_devices = max((a.unique_devices for a in analytics), default=0)

            all_products = set()
            for a in analytics:
                if a.products_played:
                    try:
                        products = json.loads(a.products_played)
                        all_products.update(products)
                    except:
                        pass

            return {
                "total_connections": total_connections,
                "total_unique_devices": total_unique_devices,
                "unique_products": list(all_products),
                "days_analyzed": len(analytics),
                "period": f"{start_date} to {end_date}",
            }

        except Exception as e:
            logging.error(f"Error getting analytics summary: {e}")
            return {
                "total_connections": 0,
                "total_unique_devices": 0,
                "unique_products": [],
                "days_analyzed": 0,
                "period": "Error",
            }

    def get_project_analytics(self, project_id: int, days: int = 30) -> Dict:
        """
        Get analytics summary for a project

        Args:
            project_id: Project ID
            days: Number of days to include

        Returns:
            Project analytics summary
        """
        try:
            from datetime import timedelta

            from ...models import Key

            end_date = date.today()
            start_date = end_date - timedelta(days=days)

            keys = Key.query.filter_by(project_id=project_id).all()
            key_ids = [key.id for key in keys]

            if not key_ids:
                return {
                    "total_connections": 0,
                    "total_keys": 0,
                    "active_keys": 0,
                    "unique_products": [],
                }

            analytics = KeyAnalytics.query.filter(
                KeyAnalytics.key_id.in_(key_ids),
                KeyAnalytics.date >= start_date,
                KeyAnalytics.date <= end_date,
            ).all()

            total_connections = sum(a.total_connections for a in analytics)

            active_key_ids = set(a.key_id for a in analytics)
            active_keys = len(active_key_ids)

            all_products = set()
            for a in analytics:
                if a.products_played:
                    try:
                        products = json.loads(a.products_played)
                        all_products.update(products)
                    except:
                        pass

            return {
                "total_connections": total_connections,
                "total_keys": len(keys),
                "active_keys": active_keys,
                "unique_products": list(all_products),
                "period": f"{start_date} to {end_date}",
            }

        except Exception as e:
            logging.error(f"Error getting project analytics: {e}")
            return {
                "total_connections": 0,
                "total_keys": 0,
                "active_keys": 0,
                "unique_products": [],
                "period": "Error",
            }
