"""
Dynamic Configuration Routes
Handles dynamic configuration loading for clients
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
from ..middleware import require_mtls
from ..services.auth import challenge_service
from ..services.dynamic_config import dynamic_config_service
from ..services.heartbeat import heartbeat_service
from ..utils.redis_client import get_redis_client
from ..utils.secure_crypto import MasterKeyManager
from .settings import decrypt_data_with_project_key, encrypt_data_with_project_key

dynamic_config_bp = Blueprint("dynamic_config", __name__)

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

    return wrapper

@dynamic_config_bp.route("/config/request", methods=["POST"])
@require_mtls
@rate_limited
def api_config_request():
    """
    Request dynamic configuration for client.
    This endpoint provides encrypted configuration data that clients need to function.
    
    Returns:
        Encrypted blob with configuration data or JSON error response
    """
    logging.debug("=== DYNAMIC CONFIG REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logging.info(f"DYNAMIC_CONFIG_REQUEST_ATTEMPT ip={ip} user_agent={user_agent}")

    # Validate request format
    if not request.is_json:
        logging.warning(f"DYNAMIC_CONFIG_NO_JSON ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Invalid request format"}), 400

    req_json = request.get_json(silent=True) or {}

    enc_data = req_json.get("blob")
    if not enc_data:
        logging.warning(f"DYNAMIC_CONFIG_NO_BLOB ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Missing encrypted data"}), 400

    # Decrypt request data
    data = None
    used_global_key = False

    # Try base64 decode first
    try:
        import base64
        decoded = base64.b64decode(enc_data).decode("utf-8")
        data = json.loads(decoded)
        logging.debug("[DEBUG] Successfully decoded base64 dynamic config data")
    except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
        logging.debug("[DEBUG] Not base64, trying decryption...")

    # Try global key decryption
    if data is None:
        try:
            data = decrypt_data(enc_data)
            used_global_key = True
            logging.debug("[DEBUG] Successfully decrypted dynamic config with global master key")
        except Exception as global_error:
            logging.debug(f"[DEBUG] Global master key failed: {str(global_error)[:100]}...")

            # Try project-specific key
            project_id_param = req_json.get("project_id")
            if project_id_param:
                try:
                    from ..utils.secure_crypto import decrypt_data_with_project_key
                    data = decrypt_data_with_project_key(enc_data, int(project_id_param))
                    logging.debug(
                        f"[DEBUG] Successfully decrypted dynamic config with project {project_id_param} master key"
                    )
                except Exception:
                    logging.debug(
                        f"[DEBUG] Project {project_id_param} master key failed"
                    )
                    raise ValueError("Failed to decrypt request data") from global_error
            else:
                raise ValueError("Failed to decrypt request data") from global_error

    # Validate required parameters
    user_key = data.get("user_key")
    game_name = data.get("game_name")
    project_id = data.get("project_id")
    session_id = data.get("session_id")

    if not all([user_key, game_name, project_id]):
        logging.warning(
            f"DYNAMIC_CONFIG_MISSING_PARAMS ip={ip} user_key={user_key} game_name={game_name} project_id={project_id}"
        )
        return jsonify({"error": "Missing required parameters"}), 400

    # Validate session if provided
    if session_id:
        is_valid, message, status_data = heartbeat_service.check_session_status(session_id)
        if not is_valid:
            logging.warning(
                f"DYNAMIC_CONFIG_INVALID_SESSION ip={ip} session_id={session_id} message={message}"
            )
            return jsonify({"error": f"Invalid session: {message}"}), 403

    # Validate key
    key_obj = Key.query.filter_by(key=user_key, project_id=project_id).first()
    if not key_obj:
        logging.warning(
            f"DYNAMIC_CONFIG_KEY_NOT_FOUND ip={ip} user_key={user_key} project_id={project_id}"
        )
        return jsonify({"error": "Key not found"}), 403

    if key_obj.status != 1:
        logging.warning(
            f"DYNAMIC_CONFIG_KEY_INACTIVE ip={ip} user_key={user_key} status={key_obj.status}"
        )
        return jsonify({"error": "Key is not active"}), 403

    # Validate game
    game = Game.query.filter_by(name=game_name, project_id=project_id).first()
    if not game:
        logging.warning(
            f"DYNAMIC_CONFIG_GAME_NOT_FOUND ip={ip} game_name={game_name} project_id={project_id}"
        )
        return jsonify({"error": "Game not found"}), 404

    if game.status != "active":
        logging.warning(
            f"DYNAMIC_CONFIG_GAME_INACTIVE ip={ip} game_name={game_name} status={game.status}"
        )
        return jsonify({"error": f"Game is {game.status}"}), 403

    # Generate configuration
    config_data = dynamic_config_service.generate_dynamic_config(
        user_key=user_key, game_name=game_name, project_id=project_id
    )

    logging.info(
        f"DYNAMIC_CONFIG_GENERATED ip={ip} user_key={user_key} game={game_name} project_id={project_id}"
    )

    resp = {
        "status": "success",
        "config": config_data["config"],
        "metadata": config_data["metadata"],
        "config_size": config_data["config_size"],
        "timestamp": int(time.time()),
    }

    # Encrypt response
    if used_global_key:
        encrypted_blob = encrypt_data(resp)
        logging.debug("[DEBUG] Encrypted dynamic config response with global master key")
    elif project_id:
        try:
            encrypted_blob = encrypt_data_with_project_key(resp, project_id)
            logging.debug(
                f"[DEBUG] Encrypted dynamic config response with project {project_id} master key"
            )
        except Exception:
            logging.debug(
                "Failed to encrypt dynamic config response with project key, falling back to global"
            )
            encrypted_blob = encrypt_data(resp)
    else:
        encrypted_blob = encrypt_data(resp)
        logging.debug("[DEBUG] Encrypted dynamic config response with global master key (fallback)")

    return encrypted_blob

@dynamic_config_bp.route("/config/validate", methods=["POST"])
@require_mtls
@rate_limited
def api_config_validate():
    """
    Validate dynamic configuration from client.
    This endpoint validates that the client is using the correct configuration.
    
    Returns:
        Encrypted blob with validation result or JSON error response
    """
    logging.debug("=== DYNAMIC CONFIG VALIDATION REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logging.info(f"DYNAMIC_CONFIG_VALIDATION_ATTEMPT ip={ip} user_agent={user_agent}")

    # Validate request format
    if not request.is_json:
        logging.warning(f"DYNAMIC_CONFIG_VALIDATION_NO_JSON ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Invalid request format"}), 400

    req_json = request.get_json(silent=True) or {}

    enc_data = req_json.get("blob")
    if not enc_data:
        logging.warning(f"DYNAMIC_CONFIG_VALIDATION_NO_BLOB ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Missing encrypted data"}), 400

    # Decrypt request data
    data = None
    used_global_key = False

    # Try base64 decode first
    try:
        import base64
        decoded = base64.b64decode(enc_data).decode("utf-8")
        data = json.loads(decoded)
        logging.debug("[DEBUG] Successfully decoded base64 dynamic config validation data")
    except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
        logging.debug("[DEBUG] Not base64, trying decryption...")

    # Try global key decryption
    if data is None:
        try:
            data = decrypt_data(enc_data)
            used_global_key = True
            logging.debug("[DEBUG] Successfully decrypted dynamic config validation with global master key")
        except Exception as global_error:
            logging.debug(f"[DEBUG] Global master key failed: {str(global_error)[:100]}...")

            # Try project-specific keys
            from ..models.core import ProjectSettings
            project_settings = ProjectSettings.query.filter(
                ProjectSettings.project_master_key.isnot(None)
            ).all()

            for settings in project_settings:
                try:
                    data = decrypt_data_with_project_key(enc_data, settings.project_id)
                    project_id = settings.project_id
                    logging.debug(
                        f"[DEBUG] Successfully decrypted dynamic config validation with project {settings.project_id} master key"
                    )
                    break
                except Exception:
                    logging.debug(
                        f"[DEBUG] Project {settings.project_id} master key failed"
                    )
                    continue

            if data is None:
                raise ValueError("Failed to decrypt request data") from global_error

    # Validate required parameters
    user_key = data.get("user_key")
    game_name = data.get("game_name")
    project_id = data.get("project_id")
    config_checksum = data.get("config_checksum")

    if not all([user_key, game_name, project_id, config_checksum]):
        logging.warning(
            f"DYNAMIC_CONFIG_VALIDATION_MISSING_PARAMS ip={ip} user_key={user_key} game_name={game_name} project_id={project_id}"
        )
        return jsonify({"error": "Missing required parameters"}), 400

    # Validate configuration
    is_valid = dynamic_config_service.validate_config_request(
        user_key=user_key,
        game_name=game_name,
        project_id=project_id,
        config_checksum=config_checksum,
    )

    if not is_valid:
        logging.warning(
            f"DYNAMIC_CONFIG_VALIDATION_FAILED ip={ip} user_key={user_key} game={game_name} checksum={config_checksum}"
        )
        return jsonify({"error": "Invalid configuration"}), 403

    logging.info(
        f"DYNAMIC_CONFIG_VALIDATION_SUCCESS ip={ip} user_key={user_key} game={game_name}"
    )

    resp = {
        "status": "success",
        "message": "Configuration validated successfully",
        "timestamp": int(time.time()),
    }

    # Encrypt response
    if used_global_key:
        encrypted_blob = encrypt_data(resp)
        logging.debug("[DEBUG] Encrypted dynamic config validation response with global master key")
    elif project_id:
        try:
            encrypted_blob = encrypt_data_with_project_key(resp, project_id)
            logging.debug(
                f"[DEBUG] Encrypted dynamic config validation response with project {project_id} master key"
            )
        except Exception:
            logging.debug(
                "Failed to encrypt dynamic config validation response with project key, falling back to global"
            )
            encrypted_blob = encrypt_data(resp)
    else:
        encrypted_blob = encrypt_data(resp)
        logging.debug("[DEBUG] Encrypted dynamic config validation response with global master key (fallback)")

    return encrypted_blob

@dynamic_config_bp.route("/config/statistics", methods=["GET"])
@require_mtls
def api_config_statistics():
    """
    Get dynamic configuration statistics (admin only).
    
    Returns:
        JSON response with configuration statistics or error
    """
    stats = dynamic_config_service.get_config_statistics()
    return jsonify({"status": "success", "statistics": stats, "timestamp": int(time.time())})
