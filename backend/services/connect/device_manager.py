"""
Device Manager
Handles device registration, tracking, and management
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from flask import request

from ...core.extensions import db
from ...models import DeviceInfo, Key


class DeviceManager:
    """Handles device registration and management"""

    def register_device(
        self,
        key_obj: Key,
        serial: str,
        device_id: str,
        device_model: str,
        device_brand: str,
        ip: str,
    ) -> Tuple[bool, str]:
        """
        Register a new device or update existing device info

        Args:
            key_obj: Key object
            serial: Device serial number
            device_id: Device ID
            device_model: Device model
            device_brand: Device brand
            ip: IP address

        Returns:
            Tuple of (success, message)
        """
        devices = key_obj.devices.split(",") if key_obj.devices else []

        if serial not in devices:
            # New device - check if we can add it
            if len(devices) < key_obj.max_devices:
                # Add device to key
                devices.append(serial)
                key_obj.devices = ",".join(devices)
                db.session.commit()

                # Create device info record
                device_info = DeviceInfo(
                    key_id=key_obj.id,
                    device_id=device_id,
                    device_model=device_model,
                    device_brand=device_brand,
                    serial=serial,
                    ip_address=ip,
                    user_agent=request.headers.get("User-Agent", ""),
                    connected_at=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                )
                db.session.add(device_info)
                db.session.commit()

                # Verify device was saved
                saved_device = DeviceInfo.query.filter_by(key_id=key_obj.id, serial=serial).first()
                if saved_device:
                    logging.info(
                        f"DEVICE_REGISTERED ip={ip} user_key={key_obj.key} serial={serial} device_id={device_id} total_devices={len(devices)} device_info_id={saved_device.id}"
                    )
                else:
                    logging.error(
                        f"DEVICE_REGISTERED_FAILED ip={ip} user_key={key_obj.key} serial={serial} device was not saved to database!"
                    )

                return True, "Device registered successfully"
            else:
                return False, "Max devices reached"
        else:
            # Existing device - update info
            self._update_existing_device(
                key_obj.id, serial, device_id, device_model, device_brand, ip
            )
            # Verify device exists in DeviceInfo
            existing_device = DeviceInfo.query.filter_by(key_id=key_obj.id, serial=serial).first()
            if existing_device:
                logging.info(
                    f"DEVICE_ALREADY_REGISTERED ip={ip} user_key={key_obj.key} serial={serial} device_id={device_id} device_info_id={existing_device.id}"
                )
            else:
                logging.warning(
                    f"DEVICE_ALREADY_REGISTERED_BUT_NOT_IN_DB ip={ip} user_key={key_obj.key} serial={serial} - device in key.devices but not in DeviceInfo table!"
                )
                # Try to create DeviceInfo record if it doesn't exist
                device_info = DeviceInfo(
                    key_id=key_obj.id,
                    device_id=device_id,
                    device_model=device_model,
                    device_brand=device_brand,
                    serial=serial,
                    ip_address=ip,
                    user_agent=request.headers.get("User-Agent", ""),
                    connected_at=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                )
                db.session.add(device_info)
                db.session.commit()
                logging.info(
                    f"DEVICE_INFO_CREATED_FOR_EXISTING ip={ip} user_key={key_obj.key} serial={serial} device_info_id={device_info.id}"
                )
            return True, "Device already registered"

    def _update_existing_device(
        self,
        key_id: int,
        serial: str,
        device_id: str,
        device_model: str,
        device_brand: str,
        ip: str,
    ) -> None:
        """
        Update existing device information

        Args:
            key_id: Key ID
            serial: Device serial
            device_id: Device ID
            device_model: Device model
            device_brand: Device brand
            ip: IP address
        """
        existing_device = DeviceInfo.query.filter_by(key_id=key_id, serial=serial).first()

        if existing_device:
            existing_device.last_seen = datetime.utcnow()
            existing_device.ip_address = ip
            existing_device.user_agent = request.headers.get("User-Agent", "")

            # Update device ID if provided and different
            if device_id and existing_device.device_id != device_id:
                existing_device.device_id = device_id

            # Set connected_at if not set
            if existing_device.connected_at is None:
                existing_device.connected_at = datetime.utcnow()

            db.session.commit()

    def get_device_info(self, key_id: int) -> list:
        """
        Get device information for a key

        Args:
            key_id: Key ID

        Returns:
            List of device info dictionaries
        """
        devices = DeviceInfo.query.filter_by(key_id=key_id).all()

        return [
            {
                "id": device.id,
                "device_id": device.device_id,
                "device_model": device.device_model,
                "device_brand": device.device_brand,
                "serial": device.serial,
                "ip_address": device.ip_address,
                "connected_at": device.connected_at.isoformat() if device.connected_at else None,
                "last_seen": device.last_seen.isoformat() if device.last_seen else None,
            }
            for device in devices
        ]

    def get_device_count(self, key_id: int) -> int:
        """
        Get number of registered devices for a key

        Args:
            key_id: Key ID

        Returns:
            Number of registered devices
        """
        return DeviceInfo.query.filter_by(key_id=key_id).count()

    def remove_device(self, key_id: int, serial: str) -> bool:
        """
        Remove a device from a key

        Args:
            key_id: Key ID
            serial: Device serial

        Returns:
            True if device was removed successfully
        """
        try:
            # Remove from key's devices list
            key_obj = Key.query.get(key_id)
            if key_obj and key_obj.devices:
                devices = key_obj.devices.split(",")
                if serial in devices:
                    devices.remove(serial)
                    key_obj.devices = ",".join(devices)
                    db.session.commit()

            # Remove device info record
            device_info = DeviceInfo.query.filter_by(key_id=key_id, serial=serial).first()
            if device_info:
                db.session.delete(device_info)
                db.session.commit()
                logging.info(f"DEVICE_REMOVED key_id={key_id} serial={serial}")
                return True

            return False

        except Exception as e:
            logging.error(f"Error removing device: {e}")
            db.session.rollback()
            return False

    def cleanup_old_devices(self, days_old: int = 30) -> int:
        """
        Clean up old device records

        Args:
            days_old: Number of days after which to consider device old

        Returns:
            Number of devices cleaned up
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)

            old_devices = DeviceInfo.query.filter(DeviceInfo.last_seen < cutoff_date).all()

            count = len(old_devices)

            for device in old_devices:
                # Remove from key's devices list
                key_obj = Key.query.get(device.key_id)
                if key_obj and key_obj.devices:
                    devices = key_obj.devices.split(",")
                    if device.serial in devices:
                        devices.remove(device.serial)
                        key_obj.devices = ",".join(devices)

                # Delete device record
                db.session.delete(device)

            db.session.commit()
            logging.info(f"CLEANED_UP_OLD_DEVICES count={count}")
            return count

        except Exception as e:
            logging.error(f"Error cleaning up old devices: {e}")
            db.session.rollback()
            return 0

    def get_device_statistics(self, project_id: int) -> dict:
        """
        Get device statistics for a project

        Args:
            project_id: Project ID

        Returns:
            Dictionary with device statistics
        """
        try:
            from ...models import Key

            # Get all keys for project
            keys = Key.query.filter_by(project_id=project_id).all()
            key_ids = [key.id for key in keys]

            if not key_ids:
                return {
                    "total_devices": 0,
                    "active_devices": 0,
                    "total_keys": 0,
                    "keys_with_devices": 0,
                }

            # Count total devices
            total_devices = DeviceInfo.query.filter(DeviceInfo.key_id.in_(key_ids)).count()

            # Count active devices (seen in last 7 days)
            active_cutoff = datetime.utcnow() - timedelta(days=7)
            active_devices = DeviceInfo.query.filter(
                DeviceInfo.key_id.in_(key_ids), DeviceInfo.last_seen >= active_cutoff
            ).count()

            # Count keys with devices
            keys_with_devices = (
                db.session.query(DeviceInfo.key_id)
                .filter(DeviceInfo.key_id.in_(key_ids))
                .distinct()
                .count()
            )

            return {
                "total_devices": total_devices,
                "active_devices": active_devices,
                "total_keys": len(keys),
                "keys_with_devices": keys_with_devices,
            }

        except Exception as e:
            logging.error(f"Error getting device statistics: {e}")
            return {
                "total_devices": 0,
                "active_devices": 0,
                "total_keys": 0,
                "keys_with_devices": 0,
            }
