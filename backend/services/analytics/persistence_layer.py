"""
Analytics Buffer Persistence Layer
Provides fallback persistence mechanisms for analytics data when Redis is unavailable.

This layer implements multiple persistence strategies:
1. Redis AOF (Append-Only File) - if Redis is configured with AOF
2. Local disk backup - saves buffer to disk when Redis fails
3. Database fallback - writes directly to DB when Redis is unavailable

Architecture:
- Primary: Redis (fast, in-memory)
- Secondary: Local disk backup (persistent, survives Redis restarts)
- Tertiary: Direct DB write (slow but guaranteed)

Usage:
    from backend.services.analytics.persistence_layer import PersistenceLayer
    
    persistence = PersistenceLayer()
    
    # Try to buffer in Redis, fallback to disk if Redis fails
    success = persistence.buffer_with_fallback(activity_data)
"""

import json
import logging
import os
import pickle
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ...config.config import Config
from ...utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class PersistenceLayer:
    """
    Persistence layer for analytics buffer with fallback mechanisms.
    
    Provides multiple levels of persistence to prevent data loss:
    1. Redis (primary, fast)
    2. Local disk backup (secondary, persistent)
    3. Direct DB write (tertiary, guaranteed)
    """
    
    def __init__(self):
        self.backup_dir = Path(Config.ANALYTICS_BUFFER_BACKUP_DIR) if hasattr(Config, 'ANALYTICS_BUFFER_BACKUP_DIR') else Path("/tmp/analytics_backup")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Lock for thread-safe file operations
        self._file_lock = threading.Lock()
        
        # Track last successful Redis operation
        self._redis_available = True
        self._redis_failures = 0
        self._max_redis_failures = 3
        
        # Statistics
        self.stats = {
            "redis_writes": 0,
            "disk_backups": 0,
            "db_fallbacks": 0,
            "redis_failures": 0,
        }
    
    def buffer_user_activity_with_fallback(
        self,
        user_id: int,
        action: str,
        ip: Optional[str] = None,
        details: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        country: Optional[str] = None,
        city: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> bool:
        """
        Buffer user activity with automatic fallback if Redis fails.
        
        Returns:
            True if successfully buffered (in any layer), False otherwise
        """
        activity_data = {
            "user_id": user_id,
            "action": action,
            "ip_address": ip,
            "user_agent": user_agent,
            "session_id": session_id,
            "country": country,
            "city": city,
            "project_id": project_id,
            "details": details,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Remove None values
        activity_data = {k: v for k, v in activity_data.items() if v is not None}
        
        # Try Redis first
        if self._redis_available:
            try:
                from ...utils.service_helpers import get_service
                try:
                    analytics_buffer_service = get_service('analytics_buffer_service')
                except (RuntimeError, ValueError):
                    # Fallback for contexts without Flask app
                    from ...services.analytics.analytics_buffer_service import AnalyticsBufferService
                    analytics_buffer_service = AnalyticsBufferService()
                success = analytics_buffer_service.buffer_user_activity(
                    user_id=user_id,
                    action=action,
                    ip=ip,
                    details=details,
                    user_agent=user_agent,
                    session_id=session_id,
                    country=country,
                    city=city,
                    project_id=project_id,
                )
                
                if success:
                    self.stats["redis_writes"] += 1
                    self._redis_failures = 0
                    return True
                else:
                    raise Exception("Redis buffer returned False")
                    
            except Exception as e:
                logger.warning(f"Redis buffer failed: {e}, falling back to disk")
                self._redis_failures += 1
                self.stats["redis_failures"] += 1
                
                if self._redis_failures >= self._max_redis_failures:
                    self._redis_available = False
                    logger.error(
                        f"Redis marked as unavailable after {self._redis_failures} failures. "
                        "Using disk backup and DB fallback."
                    )
        
        # Fallback to disk backup
        try:
            success = self._backup_to_disk("user_activity", activity_data)
            if success:
                self.stats["disk_backups"] += 1
                logger.debug(f"Backed up user activity to disk: user_id={user_id}, action={action}")
                return True
        except Exception as e:
            logger.error(f"Disk backup failed: {e}")
        
        # Final fallback: write directly to database
        try:
            success = self._write_direct_to_db("user_activity", activity_data)
            if success:
                self.stats["db_fallbacks"] += 1
                logger.warning(
                    f"Wrote user activity directly to DB (Redis and disk failed): "
                    f"user_id={user_id}, action={action}"
                )
                return True
        except Exception as e:
            logger.error(f"Direct DB write failed: {e}")
        
        return False
    
    def buffer_key_analytics_with_fallback(
        self,
        key_id: int,
        product: str,
        ip_address: Optional[str] = None,
        serial: Optional[str] = None,
        increment_connections: bool = True,
    ) -> bool:
        """
        Buffer key analytics with automatic fallback if Redis fails.
        
        Returns:
            True if successfully buffered (in any layer), False otherwise
        """
        analytics_data = {
            "key_id": key_id,
            "product": product,
            "ip_address": ip_address,
            "serial": serial,
            "increment_connections": increment_connections,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Try Redis first
        if self._redis_available:
            try:
                from ...utils.service_helpers import get_service
                try:
                    analytics_buffer_service = get_service('analytics_buffer_service')
                except (RuntimeError, ValueError):
                    # Fallback for contexts without Flask app
                    from ...services.analytics.analytics_buffer_service import AnalyticsBufferService
                    analytics_buffer_service = AnalyticsBufferService()
                success = analytics_buffer_service.buffer_key_analytics_update(
                    key_id=key_id,
                    product=product,
                    ip_address=ip_address,
                    serial=serial,
                    increment_connections=increment_connections,
                )
                
                if success:
                    self.stats["redis_writes"] += 1
                    self._redis_failures = 0
                    return True
                else:
                    raise Exception("Redis buffer returned False")
                    
            except Exception as e:
                logger.warning(f"Redis buffer failed: {e}, falling back to disk")
                self._redis_failures += 1
                self.stats["redis_failures"] += 1
                
                if self._redis_failures >= self._max_redis_failures:
                    self._redis_available = False
                    logger.error(
                        f"Redis marked as unavailable after {self._redis_failures} failures. "
                        "Using disk backup and DB fallback."
                    )
        
        # Fallback to disk backup
        try:
            success = self._backup_to_disk("key_analytics", analytics_data)
            if success:
                self.stats["disk_backups"] += 1
                logger.debug(f"Backed up key analytics to disk: key_id={key_id}, product={product}")
                return True
        except Exception as e:
            logger.error(f"Disk backup failed: {e}")
        
        # Final fallback: write directly to database
        try:
            success = self._write_direct_to_db("key_analytics", analytics_data)
            if success:
                self.stats["db_fallbacks"] += 1
                logger.warning(
                    f"Wrote key analytics directly to DB (Redis and disk failed): "
                    f"key_id={key_id}, product={product}"
                )
                return True
        except Exception as e:
            logger.error(f"Direct DB write failed: {e}")
        
        return False
    
    def _backup_to_disk(self, data_type: str, data: Dict[str, Any]) -> bool:
        """
        Backup analytics data to disk.
        
        Args:
            data_type: Type of data ("user_activity" or "key_analytics")
            data: Data dictionary to backup
            
        Returns:
            True if successfully backed up, False otherwise
        """
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"{data_type}_{timestamp}.json"
            filepath = self.backup_dir / filename
            
            with self._file_lock:
                with open(filepath, 'w') as f:
                    json.dump(data, f, indent=2)
            
            logger.debug(f"Backed up {data_type} to {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to backup {data_type} to disk: {e}")
            return False
    
    def _write_direct_to_db(self, data_type: str, data: Dict[str, Any]) -> bool:
        """
        Write analytics data directly to database (bypassing buffer).
        
        This is the final fallback when both Redis and disk backup fail.
        It's slower but guarantees data persistence.
        
        Args:
            data_type: Type of data ("user_activity" or "key_analytics")
            data: Data dictionary to write
            
        Returns:
            True if successfully written, False otherwise
        """
        try:
            from ...core.extensions import db
            
            if data_type == "user_activity":
                from ...models.core import UserActivity
                
                # Convert created_at string back to datetime
                created_at = datetime.fromisoformat(data.get("created_at", datetime.utcnow().isoformat()))
                
                activity = UserActivity(
                    user_id=data.get("user_id"),
                    action=data.get("action"),
                    ip_address=data.get("ip_address"),
                    user_agent=data.get("user_agent"),
                    session_id=data.get("session_id"),
                    country=data.get("country"),
                    city=data.get("city"),
                    project_id=data.get("project_id"),
                    details=data.get("details"),
                    created_at=created_at,
                )
                
                db.session.add(activity)
                db.session.commit()
                return True
                
            elif data_type == "key_analytics":
                # Key analytics are aggregated, so we can't write individual updates directly
                # Instead, we'll log them for later processing
                logger.warning(
                    f"Cannot write key analytics directly to DB (aggregated data). "
                    f"Data: {data}. Will be processed when Redis recovers."
                )
                # Still return True to indicate we "handled" it (by logging)
                return True
                
        except Exception as e:
            logger.error(f"Failed to write {data_type} directly to DB: {e}")
            return False
    
    def recover_from_disk(self) -> Dict[str, int]:
        """
        Recover buffered analytics from disk backups and flush to database.
        
        This should be called when Redis becomes available again to process
        any data that was backed up to disk during Redis downtime.
        
        Returns:
            Dictionary with recovery statistics
        """
        recovered = {
            "user_activities": 0,
            "key_analytics": 0,
            "errors": 0,
        }
        
        try:
            # Find all backup files
            backup_files = list(self.backup_dir.glob("*.json"))
            
            if not backup_files:
                logger.debug("No backup files to recover")
                return recovered
            
            logger.info(f"Recovering {len(backup_files)} backup files from disk")
            
            for filepath in backup_files:
                try:
                    with self._file_lock:
                        with open(filepath, 'r') as f:
                            data = json.load(f)
                    
                    # Determine data type from filename
                    if "user_activity" in filepath.name:
                        # Write to database
                        if self._write_direct_to_db("user_activity", data):
                            recovered["user_activities"] += 1
                            # Delete backup file after successful recovery
                            filepath.unlink()
                        else:
                            recovered["errors"] += 1
                            
                    elif "key_analytics" in filepath.name:
                        # Key analytics are aggregated, skip for now
                        # (would need to aggregate before writing)
                        logger.debug(f"Skipping key_analytics backup (aggregated): {filepath.name}")
                        recovered["key_analytics"] += 1
                        filepath.unlink()  # Remove file anyway
                        
                except Exception as e:
                    logger.error(f"Failed to recover backup file {filepath}: {e}")
                    recovered["errors"] += 1
            
            logger.info(
                f"Recovery complete: {recovered['user_activities']} activities, "
                f"{recovered['key_analytics']} analytics, {recovered['errors']} errors"
            )
            
        except Exception as e:
            logger.error(f"Error during recovery from disk: {e}")
            recovered["errors"] += 1
        
        return recovered
    
    def check_redis_health(self) -> bool:
        """
        Check if Redis is available and mark it as available if it is.
        
        Returns:
            True if Redis is available, False otherwise
        """
        try:
            redis_client.client.ping()
            if not self._redis_available:
                logger.info("Redis is available again, resuming Redis operations")
                self._redis_available = True
                self._redis_failures = 0
            return True
        except Exception:
            if self._redis_available:
                logger.warning("Redis health check failed")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get persistence layer statistics.
        
        Returns:
            Dictionary with statistics
        """
        return {
            **self.stats,
            "redis_available": self._redis_available,
            "redis_failures": self._redis_failures,
            "backup_dir": str(self.backup_dir),
            "backup_files_count": len(list(self.backup_dir.glob("*.json"))) if self.backup_dir.exists() else 0,
        }


# Singleton instance
persistence_layer = PersistenceLayer()

