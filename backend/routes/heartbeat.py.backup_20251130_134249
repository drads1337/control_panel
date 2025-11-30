"""
Heartbeat Routes
Handles client heartbeat mechanism for maintaining active sessions
Async support for improved performance
"""

import asyncio
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
from ..models.products import Product
from ..models.keys import DeviceInfo, Key, KeyAnalytics
from ..models.security import BlockedFingerprint
from ..middleware import require_mtls
from ..utils.redis_client import get_redis_client
from ..utils.secure_crypto import MasterKeyManager
from ..utils.service_helpers import get_service
from .settings import decrypt_data_with_project_key, encrypt_data_with_project_key

heartbeat_bp = Blueprint("heartbeat", __name__)

from ..config.config import Config

RATE_LIMIT = Config.RATE_LIMIT
# SECURITY: Use centralized NONCE_TTL from Config
NONCE_TTL = Config.NONCE_TTL
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

# SECURITY: Removed encrypt_data() and decrypt_data() functions that used global MASTER_KEY
# All client data must be encrypted/decrypted with project-specific keys only
# Use encrypt_data_with_project_key() and decrypt_data_with_project_key() instead

def rate_limited(func):
    """Rate limiting decorator that supports both sync and async functions"""
    import inspect
    
    is_async = inspect.iscoroutinefunction(func)
    
    if is_async:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            def check_rate_limit():
                redis_client = get_redis_client()
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
                return None
            
            rate_limit_result = await asyncio.to_thread(check_rate_limit)
            if rate_limit_result:
                return rate_limit_result
            return await func(*args, **kwargs)
        
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            redis_client = get_redis_client()
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
        
        return sync_wrapper

@heartbeat_bp.route("/heartbeat", methods=["POST"])
@require_mtls
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

        # SECURITY: Require project_id for decryption - no fallback to global MASTER_KEY
        project_id_param = req_json.get("project_id")
        if not project_id_param:
            logging.warning(f"HEARTBEAT_NO_PROJECT_ID ip={ip} user_agent={user_agent}")
            return jsonify({"error": "project_id is required for decryption"}), 400

        try:
            project_id = int(project_id_param)
        except (ValueError, TypeError):
            logging.warning(f"HEARTBEAT_INVALID_PROJECT_ID ip={ip} project_id={project_id_param}")
            return jsonify({"error": "Invalid project_id format"}), 400

        # Decrypt request data using project-specific key only
        data = None

        # Try base64 decode first (for backward compatibility with unencrypted data)
        try:
            import base64
            decoded = base64.b64decode(enc_data).decode("utf-8")
            data = json.loads(decoded)
            logging.debug(f"[DEBUG] Successfully decoded base64 heartbeat data")
        except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
            logging.debug(f"[DEBUG] Not base64, trying decryption with project key...")

        # Decrypt with project-specific key only (no fallback to global MASTER_KEY)
        if data is None:
            try:
                from ..utils.secure_crypto import decrypt_data_with_project_key
                data = decrypt_data_with_project_key(enc_data, project_id)
                logging.debug(
                    f"[DEBUG] Successfully decrypted heartbeat with project {project_id} key"
                )
            except Exception as decrypt_error:
                logging.warning(
                    f"HEARTBEAT_DECRYPT_FAILED ip={ip} project_id={project_id} "
                    f"error={type(decrypt_error).__name__}: {str(decrypt_error)[:100]}"
                )
                return jsonify({
                    "error": "Failed to decrypt request data",
                    "message": "Please ensure you are using the correct project encryption key"
                }), 400

            session_id = data.get("session_id")
            heartbeat_data = data.get("heartbeat_data", {})

            if not session_id:
                logging.warning(f"HEARTBEAT_NO_SESSION_ID ip={ip}")
                return jsonify({"error": "Session ID required"}), 400

            # Get heartbeat service
            heartbeat_service = get_service('heartbeat_service')

            # Run heartbeat processing
            is_valid, message, response_data = heartbeat_service.process_heartbeat(
                session_id,
                heartbeat_data
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

            # SECURITY: Encrypt response with project-specific key only (no fallback to global MASTER_KEY)
            try:
                encrypted_blob = encrypt_data_with_project_key(resp, project_id)
                logging.debug(
                    f"[DEBUG] Encrypted heartbeat response with project {project_id} key"
                )
            except Exception as encrypt_error:
                logging.error(
                    f"HEARTBEAT_ENCRYPT_FAILED ip={ip} project_id={project_id} "
                    f"error={type(encrypt_error).__name__}: {str(encrypt_error)}"
                )
                return jsonify({
                    "error": "Failed to encrypt response",
                    "message": "Please ensure project encryption key is configured"
                }), 500

            return encrypted_blob

    except Exception as e:
        import traceback

        logging.error(
            f"Exception in api_heartbeat: {str(e)}\n{traceback.format_exc()} ip={ip} user_agent={user_agent}"
        )
        return jsonify({"error": "Internal server error"}), 500

@heartbeat_bp.route("/heartbeat/status", methods=["POST"])
@require_mtls
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

        # SECURITY: Require project_id for decryption - no fallback to global MASTER_KEY
        project_id_param = req_json.get("project_id")
        if not project_id_param:
            logging.warning(f"HEARTBEAT_STATUS_NO_PROJECT_ID ip={ip} user_agent={user_agent}")
            return jsonify({"error": "project_id is required for decryption"}), 400

        try:
            project_id = int(project_id_param)
        except (ValueError, TypeError):
            logging.warning(f"HEARTBEAT_STATUS_INVALID_PROJECT_ID ip={ip} project_id={project_id_param}")
            return jsonify({"error": "Invalid project_id format"}), 400

        # Decrypt request data using project-specific key only
        data = None

        # Try base64 decode first (for backward compatibility with unencrypted data)
        try:
            import base64
            decoded = base64.b64decode(enc_data).decode("utf-8")
            data = json.loads(decoded)
            logging.debug(f"[DEBUG] Successfully decoded base64 heartbeat status data")
        except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
            logging.debug(f"[DEBUG] Not base64, trying decryption with project key...")

        # Decrypt with project-specific key only (no fallback to global MASTER_KEY)
        if data is None:
            try:
                from ..utils.secure_crypto import decrypt_data_with_project_key
                data = decrypt_data_with_project_key(enc_data, project_id)
                logging.debug(
                    f"[DEBUG] Successfully decrypted heartbeat status with project {project_id} key"
                )
            except Exception as decrypt_error:
                logging.warning(
                    f"HEARTBEAT_STATUS_DECRYPT_FAILED ip={ip} project_id={project_id} "
                    f"error={type(decrypt_error).__name__}: {str(decrypt_error)[:100]}"
                )
                return jsonify({
                    "error": "Failed to decrypt request data",
                    "message": "Please ensure you are using the correct project encryption key"
                }), 400

            session_id = data.get("session_id")

            if not session_id:
                logging.warning(f"HEARTBEAT_STATUS_NO_SESSION_ID ip={ip}")
                return jsonify({"error": "Session ID required"}), 400

            # Get heartbeat service
            heartbeat_service = get_service('heartbeat_service')

            # Run session status check
            is_valid, message, status_data = heartbeat_service.check_session_status(
                session_id
            )

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

            # SECURITY: Encrypt response with project-specific key only (no fallback to global MASTER_KEY)
            try:
                encrypted_blob = encrypt_data_with_project_key(resp, project_id)
                logging.debug(
                    f"[DEBUG] Encrypted heartbeat status response with project {project_id} key"
                )
            except Exception as encrypt_error:
                logging.error(
                    f"HEARTBEAT_STATUS_ENCRYPT_FAILED ip={ip} project_id={project_id} "
                    f"error={type(encrypt_error).__name__}: {str(encrypt_error)}"
                )
                return jsonify({
                    "error": "Failed to encrypt response",
                    "message": "Please ensure project encryption key is configured"
                }), 500

            return encrypted_blob

    except Exception as e:
        import traceback


        logging.error(
            f"Exception in api_heartbeat_status: {str(e)}\n{traceback.format_exc()} ip={ip} user_agent={user_agent}"
        )
        return jsonify({"error": "Internal server error"}), 500
