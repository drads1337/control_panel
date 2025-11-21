"""
Heartbeat Service
Manages client heartbeat mechanism to prevent offline execution
"""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

from flask import current_app

from ...core.extensions import db
from ...models.core import User
from ...models.keys import Key
from ...utils.redis_client import get_redis_client

class HeartbeatService:
    """Service for managing client heartbeat mechanism"""

    def __init__(self):
        self.heartbeat_interval = 300
        self.heartbeat_tolerance = 60
        self.max_missed_heartbeats = 3
        self.session_ttl = 3600

        self.redis_client = get_redis_client()

    def create_session(
        self, user_key: str, fingerprint: str, product: str, serial: str, ip_address: str
    ) -> Dict:
        """Create a new heartbeat session"""
        session_id = self._generate_session_id(user_key, fingerprint, serial)
        current_time = int(time.time())

        session_data = {
            "session_id": session_id,
            "user_key": user_key,
            "fingerprint": fingerprint,
            "product": product,
            "serial": serial,
            "ip_address": ip_address,
            "created_at": current_time,
            "last_heartbeat": current_time,
            "missed_heartbeats": 0,
            "is_active": True,
            "heartbeat_interval": self.heartbeat_interval,
            "next_heartbeat_due": current_time + self.heartbeat_interval,
        }

        session_key = f"heartbeat_session:{session_id}"
        self.redis_client.setex(session_key, self.session_ttl, json.dumps(session_data))

        lookup_key = f"heartbeat_lookup:{user_key}:{fingerprint}:{serial}"
        self.redis_client.setex(lookup_key, self.session_ttl, session_id)

        logging.info(
            f"HEARTBEAT_SESSION_CREATED session_id={session_id} user_key={user_key} fingerprint={fingerprint}"
        )

        return {
            "session_id": session_id,
            "heartbeat_interval": self.heartbeat_interval,
            "next_heartbeat_due": session_data["next_heartbeat_due"],
            "tolerance": self.heartbeat_tolerance,
        }

    def process_heartbeat(self, session_id: str, heartbeat_data: Dict) -> Tuple[bool, str, Dict]:
        """Process a heartbeat from client"""
        try:
            session_key = f"heartbeat_session:{session_id}"
            session_json = self.redis_client.get(session_key)

            if not session_json:
                return False, "Session not found or expired", {}

            session_data = json.loads(session_json)
            current_time = int(time.time())

            if not session_data.get("is_active", False):
                return False, "Session is not active", {}

            if not self._validate_heartbeat_data(session_data, heartbeat_data):
                return False, "Invalid heartbeat data", {}

            session_data["last_heartbeat"] = current_time
            session_data["missed_heartbeats"] = 0
            session_data["next_heartbeat_due"] = current_time + self.heartbeat_interval

            self.redis_client.setex(session_key, self.session_ttl, json.dumps(session_data))

            logging.info(
                f"HEARTBEAT_PROCESSED session_id={session_id} user_key={session_data.get('user_key')}"
            )

            return (
                True,
                "Heartbeat processed successfully",
                {
                    "next_heartbeat_due": session_data["next_heartbeat_due"],
                    "session_status": "active",
                },
            )

        except Exception as e:
            logging.error(f"HEARTBEAT_PROCESSING_ERROR session_id={session_id} error={e}")
            return False, f"Heartbeat processing error: {str(e)}", {}

    def check_session_status(self, session_id: str) -> Tuple[bool, str, Dict]:
        """Check if a session is still valid"""
        try:
            session_key = f"heartbeat_session:{session_id}"
            session_json = self.redis_client.get(session_key)

            if not session_json:
                return False, "Session not found or expired", {}

            session_data = json.loads(session_json)
            current_time = int(time.time())

            if not session_data.get("is_active", False):
                return False, "Session is not active", {}

            last_heartbeat = session_data.get("last_heartbeat", 0)
            next_heartbeat_due = session_data.get("next_heartbeat_due", 0)

            if current_time > next_heartbeat_due + self.heartbeat_tolerance:

                session_data["missed_heartbeats"] = session_data.get("missed_heartbeats", 0) + 1

                if session_data["missed_heartbeats"] >= self.max_missed_heartbeats:

                    session_data["is_active"] = False
                    session_data["deactivated_at"] = current_time
                    session_data["deactivation_reason"] = "max_missed_heartbeats"

                    logging.warning(
                        f"HEARTBEAT_SESSION_DEACTIVATED session_id={session_id} reason=max_missed_heartbeats"
                    )

                    self.redis_client.setex(session_key, self.session_ttl, json.dumps(session_data))

                    return False, "Session deactivated due to missed heartbeats", {}
                else:

                    self.redis_client.setex(session_key, self.session_ttl, json.dumps(session_data))

                    return (
                        True,
                        "Session active but heartbeat overdue",
                        {
                            "missed_heartbeats": session_data["missed_heartbeats"],
                            "max_missed_heartbeats": self.max_missed_heartbeats,
                            "next_heartbeat_due": next_heartbeat_due,
                        },
                    )

            return (
                True,
                "Session is active",
                {
                    "next_heartbeat_due": next_heartbeat_due,
                    "missed_heartbeats": session_data.get("missed_heartbeats", 0),
                },
            )

        except Exception as e:
            logging.error(f"HEARTBEAT_SESSION_CHECK_ERROR session_id={session_id} error={e}")
            return False, f"Session check error: {str(e)}", {}

    def deactivate_session(self, session_id: str, reason: str = "manual") -> bool:
        """Deactivate a heartbeat session"""
        try:
            session_key = f"heartbeat_session:{session_id}"
            session_json = self.redis_client.get(session_key)

            if not session_json:
                return False

            session_data = json.loads(session_json)
            session_data["is_active"] = False
            session_data["deactivated_at"] = int(time.time())
            session_data["deactivation_reason"] = reason

            self.redis_client.setex(session_key, self.session_ttl, json.dumps(session_data))

            logging.info(f"HEARTBEAT_SESSION_DEACTIVATED session_id={session_id} reason={reason}")
            return True

        except Exception as e:
            logging.error(f"HEARTBEAT_SESSION_DEACTIVATION_ERROR session_id={session_id} error={e}")
            return False

    def get_session_by_lookup(self, user_key: str, fingerprint: str, serial: str) -> Optional[str]:
        """Get session ID by user key, fingerprint, and serial"""
        try:
            lookup_key = f"heartbeat_lookup:{user_key}:{fingerprint}:{serial}"
            session_id = self.redis_client.get(lookup_key)
            return session_id
        except Exception as e:
            logging.error(f"HEARTBEAT_SESSION_LOOKUP_ERROR user_key={user_key} error={e}")
            return None

    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions (called by background task)"""
        try:

            session_keys = self.redis_client.keys("heartbeat_session:*")
            cleaned_count = 0

            for session_key in session_keys:
                try:
                    session_json = self.redis_client.get(session_key)
                    if session_json:
                        session_data = json.loads(session_json)
                        current_time = int(time.time())

                        created_at = session_data.get("created_at", 0)
                        if current_time - created_at > self.session_ttl:

                            session_id = session_data.get("session_id")
                            if session_id:

                                user_key = session_data.get("user_key")
                                fingerprint = session_data.get("fingerprint")
                                serial = session_data.get("serial")
                                if user_key and fingerprint and serial:
                                    lookup_key = (
                                        f"heartbeat_lookup:{user_key}:{fingerprint}:{serial}"
                                    )
                                    self.redis_client.delete(lookup_key)

                                self.redis_client.delete(session_key)
                                cleaned_count += 1

                                logging.info(
                                    f"HEARTBEAT_SESSION_CLEANED_UP session_id={session_id}"
                                )

                except Exception as e:
                    logging.error(
                        f"HEARTBEAT_SESSION_CLEANUP_ERROR session_key={session_key} error={e}"
                    )
                    continue

            if cleaned_count > 0:
                logging.info(f"HEARTBEAT_CLEANUP_COMPLETED cleaned_count={cleaned_count}")

            return cleaned_count

        except Exception as e:
            logging.error(f"HEARTBEAT_CLEANUP_ERROR: {e}")
            return 0

    def _generate_session_id(self, user_key: str, fingerprint: str, serial: str) -> str:
        """Generate a unique session ID"""
        data = f"{user_key}:{fingerprint}:{serial}:{int(time.time())}:{os.urandom(8).hex()}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]

    def _validate_heartbeat_data(self, session_data: Dict, heartbeat_data: Dict) -> bool:
        """Validate heartbeat data from client"""
        try:

            if not isinstance(heartbeat_data, dict):
                return False

            required_fields = ["timestamp", "client_id"]
            for field in required_fields:
                if field not in heartbeat_data:
                    return False

            client_timestamp = heartbeat_data.get("timestamp", 0)
            current_time = int(time.time())

            if abs(current_time - client_timestamp) > 300:
                return False

            expected_client_id = f"{session_data.get('user_key')}:{session_data.get('serial')}"
            if heartbeat_data.get("client_id") != expected_client_id:
                return False

            return True

        except Exception as e:
            logging.error(f"HEARTBEAT_VALIDATION_ERROR: {e}")
            return False

    def get_session_statistics(self) -> Dict:
        """Get heartbeat session statistics"""
        try:
            session_keys = self.redis_client.keys("heartbeat_session:*")
            total_sessions = len(session_keys)
            active_sessions = 0
            inactive_sessions = 0
            overdue_sessions = 0

            current_time = int(time.time())

            for session_key in session_keys:
                try:
                    session_json = self.redis_client.get(session_key)
                    if session_json:
                        session_data = json.loads(session_json)

                        if session_data.get("is_active", False):
                            active_sessions += 1

                            next_heartbeat_due = session_data.get("next_heartbeat_due", 0)
                            if current_time > next_heartbeat_due + self.heartbeat_tolerance:
                                overdue_sessions += 1
                        else:
                            inactive_sessions += 1

                except Exception as e:
                    logging.error(f"HEARTBEAT_STATS_ERROR session_key={session_key} error={e}")
                    continue

            return {
                "total_sessions": total_sessions,
                "active_sessions": active_sessions,
                "inactive_sessions": inactive_sessions,
                "overdue_sessions": overdue_sessions,
                "heartbeat_interval": self.heartbeat_interval,
                "heartbeat_tolerance": self.heartbeat_tolerance,
                "max_missed_heartbeats": self.max_missed_heartbeats,
            }

        except Exception as e:
            logging.error(f"HEARTBEAT_STATISTICS_ERROR: {e}")
            return {}

heartbeat_service = HeartbeatService()
