"""
Device Update Buffer Service
Batches DeviceInfo.last_seen updates to reduce database write pressure.

Instead of updating DeviceInfo.last_seen on every heartbeat/connection,
this service buffers updates in Redis and flushes them periodically in batches.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Set

from ...config.config import Config
from ...utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class DeviceUpdateBuffer:
    """
    Service for buffering DeviceInfo.last_seen updates.
    
    This reduces database write pressure by batching updates instead of
    writing on every heartbeat/connection event.
    """

    def __init__(self):
        self.buffer_prefix = "device_update_buffer"
        self.buffer_ttl = 3600  # 1 hour TTL
        self.enabled = Config.ANALYTICS_BUFFER_ENABLED  # Reuse same config

    def buffer_device_update(self, key_id: int, serial: str) -> bool:
        """
        Buffer a device last_seen update in Redis.
        
        Args:
            key_id: Key ID
            serial: Device serial number
            
        Returns:
            True if successfully buffered, False otherwise
        """
        if not self.enabled:
            return False

        try:
            # Use a set to track unique key_id:serial combinations
            # This automatically deduplicates multiple updates for the same device
            buffer_key = f"{self.buffer_prefix}:updates"
            device_key = f"{key_id}:{serial}"
            
            # Add to set (automatically handles duplicates)
            redis_client.client.sadd(buffer_key, device_key)
            redis_client.client.expire(buffer_key, self.buffer_ttl)
            
            logger.debug(f"Buffered device update: key_id={key_id}, serial={serial}")
            return True

        except Exception as e:
            logger.error(f"Failed to buffer device update: {e}")
            return False

    def flush_updates(self) -> int:
        """
        Flush buffered device updates to the database in batches.
        
        Returns:
            Number of devices updated
        """
        from ...core.extensions import db
        from ...models import DeviceInfo

        if not self.enabled:
            return 0

        updated_count = 0

        try:
            buffer_key = f"{self.buffer_prefix}:updates"
            
            # Get all buffered device updates
            device_keys = redis_client.client.smembers(buffer_key)
            
            if not device_keys:
                return 0

            # Group by key_id for efficient batch updates
            devices_by_key: Dict[int, Set[str]] = {}
            for device_key in device_keys:
                try:
                    # Decode if bytes
                    if isinstance(device_key, bytes):
                        device_key = device_key.decode()
                    
                    key_id_str, serial = device_key.split(":", 1)
                    key_id = int(key_id_str)
                    
                    if key_id not in devices_by_key:
                        devices_by_key[key_id] = set()
                    devices_by_key[key_id].add(serial)
                    
                except (ValueError, AttributeError) as e:
                    logger.warning(f"Invalid device key format: {device_key}, error: {e}")
                    continue

            # Batch update devices by key_id
            current_time = datetime.utcnow()
            
            for key_id, serials in devices_by_key.items():
                try:
                    # Update all devices for this key_id in one query
                    updated = (
                        db.session.query(DeviceInfo)
                        .filter(
                            DeviceInfo.key_id == key_id,
                            DeviceInfo.serial.in_(list(serials)),
                        )
                        .update(
                            {DeviceInfo.last_seen: current_time},
                            synchronize_session=False,
                        )
                    )
                    
                    updated_count += updated
                    logger.debug(
                        f"Flushed {updated} device updates for key_id={key_id}"
                    )
                    
                except Exception as e:
                    logger.error(f"Failed to flush device updates for key_id={key_id}: {e}")
                    db.session.rollback()
                    continue

            # Commit all updates
            try:
                db.session.commit()
                logger.info(f"Flushed {updated_count} device updates to database")
            except Exception as e:
                logger.error(f"Failed to commit device updates: {e}")
                db.session.rollback()
                return 0

            # Clear buffer after successful flush
            redis_client.client.delete(buffer_key)

        except Exception as e:
            logger.error(f"Error flushing device updates: {e}")
            try:
                db.session.rollback()
            except:
                pass

        return updated_count

    def get_buffer_stats(self) -> Dict:
        """
        Get statistics about buffered device updates.
        
        Returns:
            Dictionary with buffer statistics
        """
        try:
            buffer_key = f"{self.buffer_prefix}:updates"
            count = redis_client.client.scard(buffer_key)
            
            return {
                "buffered_updates": count,
                "buffer_key": buffer_key,
                "enabled": self.enabled,
            }
        except Exception as e:
            logger.error(f"Failed to get device buffer stats: {e}")
            return {"buffered_updates": 0, "enabled": self.enabled}


device_update_buffer = DeviceUpdateBuffer()

