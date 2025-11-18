"""
Heartbeat Routes
Handles client heartbeat mechanism for maintaining active sessions
"""

import base64
import hashlib
import json
import logging
import os
import time
import types
from datetime import date, datetime, timedelta
from functools import wraps

import redis
import requests
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
from flask import Blueprint, current_app, jsonify, request
from flask_cors import cross_origin

from ..config.config import Config
from ..core.extensions import db
from ..models.core import Project, User
from ..models.games import Game
from ..models.keys import DeviceInfo, Key, KeyAnalytics
from ..models.security import BlockedFingerprint
from ..services.auth import challenge_service
from ..services.heartbeat import heartbeat_service
from ..utils.secure_crypto import MasterKeyManager
from .settings import decrypt_data_with_project_key, encrypt_data_with_project_key

heartbeat_bp = Blueprint("heartbeat", __name__)

def init_redis_client():
    try:
        client = redis.Redis(
            host=Config.REDIS_HOST,
            port=Config.REDIS_PORT,
            db=Config.REDIS_DB,
            password=Config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
            max_connections=20,
        )
        client.ping()
        logging.debug("✅ Redis client initialized successfully in heartbeat.py")
        return client
    except Exception as e:
        logging.debug(f"❌ Redis client initialization failed in heartbeat.py: {e}")
        raise RuntimeError("Redis is required but not available. Please start Redis server.")

redis_client = init_redis_client()

from ..config.config import Config

RATE_LIMIT = Config.RATE_LIMIT
NONCE_TTL = 300
from ..config.config import Config

CHALLENGE_TTL = Config.CHALLENGE_TTL

BAD_UA_KEYWORDS = ["wget", "python", "requests", "postman", "insomnia"]
BAD_HEADERS = []
SUSPICIOUS_THRESHOLD = 3
SUSPICIOUS_WINDOW = 3600

NONCE_STORE = {}

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

PLAY_INTEGRITY_API_KEY = os.environ.get("PLAY_INTEGRITY_API_KEY")

STATIC_WORD = "panel_auth_2024"

def encrypt_data(data: dict) -> str:
    try:
        raw = json.dumps(data)
        return MasterKeyManager.encrypt_with_master_key(raw, Config.MASTER_KEY)
    except Exception as e:
        raise ValueError(f"Encryption error: {str(e)}")

def decrypt_data(enc: str) -> dict:
    try:
        decrypted_raw = MasterKeyManager.decrypt_with_master_key(enc, Config.MASTER_KEY)
        return json.loads(decrypted_raw)
    except Exception as e:
        raise ValueError(f"Decryption error: {str(e)}")

def rate_limited(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        ip = request.remote_addr
        req_json = request.get_json(silent=True) or {}
        user_key = req_json.get("user_key") or ""
        key = f"rl:{user_key}:{ip}"
        count = redis_client.incr(key)
        if hasattr(count, "__await__") or isinstance(count, types.CoroutineType):
            count = 0
        else:
            try:
                count = int(count)
            except Exception:
                count = 0
        if count == 1:
            redis_client.expire(key, 60)
        if count > RATE_LIMIT:
            return jsonify({"error": "Rate limit exceeded"}), 429
        return func(*args, **kwargs)

    return wrapper

@heartbeat_bp.route("/heartbeat", methods=["POST"])
@rate_limited
def api_heartbeat():
    """
    Heartbeat endpoint for maintaining active sessions
    Clients must send periodic heartbeats to keep their session active
    """
    logging.debug("=== HEARTBEAT REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logging.info(f"HEARTBEAT_ATTEMPT ip={ip} user_agent={user_agent}")

    try:
        if not request.is_json:
            logging.warning(f"HEARTBEAT_NO_JSON ip={ip} user_agent={user_agent}")
            return jsonify({"error": "Invalid request format"}), 400

        req_json = request.get_json(silent=True) or {}

        enc_data = req_json.get("blob")
        if not enc_data:
            logging.warning(f"HEARTBEAT_NO_BLOB ip={ip} user_agent={user_agent}")
            return jsonify({"error": "Missing encrypted data"}), 400

        try:
            data = None
            used_global_key = False

            try:
                import base64

                decoded = base64.b64decode(enc_data).decode("utf-8")
                data = json.loads(decoded)
                logging.debug(f"[DEBUG] Successfully decoded base64 heartbeat data")
            except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
                logging.debug(f"[DEBUG] Not base64, trying decryption...")

                try:
                    data = decrypt_data(enc_data)
                    used_global_key = True
                    logging.debug(
                        f"[DEBUG] Successfully decrypted heartbeat with global master key"
                    )
                except Exception as global_error:
                    logging.debug(f"[DEBUG] Global master key failed: {str(global_error)[:100]}...")

                    project_id_param = req_json.get("project_id")
                    if project_id_param:
                        try:
                            from ..utils.secure_crypto import decrypt_data_with_project_key
                            data = decrypt_data_with_project_key(enc_data, int(project_id_param))
                            project_id = int(project_id_param)
                            logging.debug(
                                f"[DEBUG] Successfully decrypted heartbeat with project {project_id} master key"
                            )
                        except Exception as project_error:
                            logging.debug(
                                f"[DEBUG] Project {project_id_param} master key failed: {str(project_error)[:50]}..."
                            )
                            raise global_error
                    else:

                        raise global_error

            session_id = data.get("session_id")
            heartbeat_data = data.get("heartbeat_data", {})

            if not session_id:
                logging.warning(f"HEARTBEAT_NO_SESSION_ID ip={ip}")
                return jsonify({"error": "Session ID required"}), 400

            is_valid, message, response_data = heartbeat_service.process_heartbeat(
                session_id, heartbeat_data
            )

            if not is_valid:
                logging.warning(
                    f"HEARTBEAT_INVALID ip={ip} session_id={session_id} message={message}"
                )
                return jsonify({"error": message}), 403

            logging.info(f"HEARTBEAT_SUCCESS ip={ip} session_id={session_id}")

            resp = {
                "status": "success",
                "message": message,
                "next_heartbeat_due": response_data.get("next_heartbeat_due"),
                "session_status": response_data.get("session_status", "active"),
                "timestamp": int(time.time()),
            }

            if used_global_key:
                encrypted_blob = encrypt_data(resp)
                logging.debug(f"[DEBUG] Encrypted heartbeat response with global master key")
            elif "project_id" in locals() and project_id:
                try:
                    encrypted_blob = encrypt_data_with_project_key(resp, project_id)
                    logging.debug(
                        f"[DEBUG] Encrypted heartbeat response with project {project_id} master key"
                    )
                except Exception as e:
                    logging.debug(
                        f"Failed to encrypt heartbeat response with project key, falling back to global: {e}"
                    )
                    encrypted_blob = encrypt_data(resp)
            else:
                encrypted_blob = encrypt_data(resp)
                logging.debug(
                    f"[DEBUG] Encrypted heartbeat response with global master key (fallback)"
                )

            return encrypted_blob

        except Exception as e:
            import traceback

            logging.error(
                f"Exception in heartbeat decrypt_data: {str(e)}\n{traceback.format_exc()} ip={ip} user_agent={user_agent}"
            )
            return jsonify({"error": "Internal server error"}), 500

    except Exception as e:
        import traceback

        logging.error(
            f"Exception in api_heartbeat: {str(e)}\n{traceback.format_exc()} ip={ip} user_agent={user_agent}"
        )
        return jsonify({"error": "Internal server error"}), 500

@heartbeat_bp.route("/heartbeat/status", methods=["POST"])
@rate_limited
def api_heartbeat_status():
    """
    Check heartbeat session status
    """
    logging.debug("=== HEARTBEAT STATUS REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logging.info(f"HEARTBEAT_STATUS_ATTEMPT ip={ip} user_agent={user_agent}")

    try:
        if not request.is_json:
            logging.warning(f"HEARTBEAT_STATUS_NO_JSON ip={ip} user_agent={user_agent}")
            return jsonify({"error": "Invalid request format"}), 400

        req_json = request.get_json(silent=True) or {}

        enc_data = req_json.get("blob")
        if not enc_data:
            logging.warning(f"HEARTBEAT_STATUS_NO_BLOB ip={ip} user_agent={user_agent}")
            return jsonify({"error": "Missing encrypted data"}), 400

        try:
            data = None
            used_global_key = False

            try:
                import base64

                decoded = base64.b64decode(enc_data).decode("utf-8")
                data = json.loads(decoded)
                logging.debug(f"[DEBUG] Successfully decoded base64 heartbeat status data")
            except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
                logging.debug(f"[DEBUG] Not base64, trying decryption...")

                try:
                    data = decrypt_data(enc_data)
                    used_global_key = True
                    logging.debug(
                        f"[DEBUG] Successfully decrypted heartbeat status with global master key"
                    )
                except Exception as global_error:
                    logging.debug(f"[DEBUG] Global master key failed: {str(global_error)[:100]}...")

                    project_id_param = req_json.get("project_id")
                    if project_id_param:
                        try:
                            from ..utils.secure_crypto import decrypt_data_with_project_key
                            data = decrypt_data_with_project_key(enc_data, int(project_id_param))
                            project_id = int(project_id_param)
                            logging.debug(
                                f"[DEBUG] Successfully decrypted heartbeat status with project {project_id} master key"
                            )
                        except Exception as project_error:
                            logging.debug(
                                f"[DEBUG] Project {project_id_param} master key failed: {str(project_error)[:50]}..."
                            )
                            raise global_error
                    else:

                        raise global_error

            session_id = data.get("session_id")

            if not session_id:
                logging.warning(f"HEARTBEAT_STATUS_NO_SESSION_ID ip={ip}")
                return jsonify({"error": "Session ID required"}), 400

            is_valid, message, status_data = heartbeat_service.check_session_status(session_id)

            logging.info(
                f"HEARTBEAT_STATUS_CHECK ip={ip} session_id={session_id} is_valid={is_valid} message={message}"
            )

            resp = {
                "status": "success" if is_valid else "error",
                "message": message,
                "session_valid": is_valid,
                "data": status_data,
                "timestamp": int(time.time()),
            }

            if used_global_key:
                encrypted_blob = encrypt_data(resp)
                logging.debug(f"[DEBUG] Encrypted heartbeat status response with global master key")
            elif "project_id" in locals() and project_id:
                try:
                    encrypted_blob = encrypt_data_with_project_key(resp, project_id)
                    logging.debug(
                        f"[DEBUG] Encrypted heartbeat status response with project {project_id} master key"
                    )
                except Exception as e:
                    logging.debug(
                        f"Failed to encrypt heartbeat status response with project key, falling back to global: {e}"
                    )
                    encrypted_blob = encrypt_data(resp)
            else:
                encrypted_blob = encrypt_data(resp)
                logging.debug(
                    f"[DEBUG] Encrypted heartbeat status response with global master key (fallback)"
                )

            return encrypted_blob

        except Exception as e:
            import traceback

            logging.error(
                f"Exception in heartbeat status decrypt_data: {str(e)}\n{traceback.format_exc()} ip={ip} user_agent={user_agent}"
            )
            return jsonify({"error": "Internal server error"}), 500

    except Exception as e:
        import traceback

        from ..services.activity import activity_service

        logging.error(
            f"Exception in api_heartbeat_status: {str(e)}\n{traceback.format_exc()} ip={ip} user_agent={user_agent}"
        )
        return jsonify({"error": "Internal server error"}), 500
