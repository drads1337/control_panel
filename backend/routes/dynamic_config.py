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
from flask import Blueprint, current_app, g, jsonify, request
from flask_cors import cross_origin

from ..config.config import Config
from ..core.extensions import db
from ..models.core import Project, User
from ..models.products import FeatureConfigSchema, Product
from ..models.keys import DeviceInfo, Key, KeyAnalytics
from ..models.security import BlockedFingerprint
from ..middleware import require_mtls
from ..middleware.auth import enforce_project_scope, require_project_isolation, require_role
from ..middleware.validation import validate_request
from ..utils.rbac_utils import RBACManager
from ..utils.redis_client import get_redis_client
from ..utils.role_constants import RolePermissions
from ..utils.secure_crypto import MasterKeyManager
from flask_jwt_extended import get_jwt_identity, jwt_required
from ..utils.service_helpers import get_service
from .settings import decrypt_data_with_project_key, encrypt_data_with_project_key

dynamic_config_bp = Blueprint("dynamic_config", __name__)

from ..config.config import Config

RATE_LIMIT = Config.RATE_LIMIT

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
        # Get services once at the start (DI pattern)
        dynamic_config_service = get_service('dynamic_config_service')
        heartbeat_service = get_service('heartbeat_service')
        Encrypted blob with configuration data or JSON error response
    """
    logging.debug("=== DYNAMIC CONFIG REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logging.info(f"DYNAMIC_CONFIG_REQUEST_ATTEMPT ip={ip} user_agent={user_agent}")


    if not request.is_json:
        logging.warning(f"DYNAMIC_CONFIG_NO_JSON ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Invalid request format"}), 400

    req_json = request.get_json(silent=True) or {}

    enc_data = req_json.get("blob")
    if not enc_data:
        logging.warning(f"DYNAMIC_CONFIG_NO_BLOB ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Missing encrypted data"}), 400


    project_id_param = req_json.get("project_id")
    if not project_id_param:
        logging.warning(f"DYNAMIC_CONFIG_NO_PROJECT_ID ip={ip} user_agent={user_agent}")
        return jsonify({"error": "project_id is required for decryption"}), 400

    try:
        project_id_int = int(project_id_param)
    except (ValueError, TypeError):
        logging.warning(f"DYNAMIC_CONFIG_INVALID_PROJECT_ID ip={ip} project_id={project_id_param}")
        return jsonify({"error": "Invalid project_id format"}), 400


    data = None


    try:
        import base64
        decoded = base64.b64decode(enc_data).decode("utf-8")
        data = json.loads(decoded)
        logging.debug("[DEBUG] Successfully decoded base64 dynamic config data")
    except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
        logging.debug("[DEBUG] Not base64, trying decryption with project key...")


    if data is None:
        try:
            from ..utils.secure_crypto import decrypt_data_with_project_key
            data = decrypt_data_with_project_key(enc_data, project_id_int)
            logging.debug(
                f"[DEBUG] Successfully decrypted dynamic config with project {project_id_int} key"
            )
        except Exception as decrypt_error:
            logging.warning(
                f"DYNAMIC_CONFIG_DECRYPT_FAILED ip={ip} project_id={project_id_int} "
                f"error={type(decrypt_error).__name__}: {str(decrypt_error)[:100]}"
            )
            return jsonify({
                "error": "Failed to decrypt request data",
                "message": "Please ensure you are using the correct project encryption key"
            }), 400


    user_key = data.get("user_key")
    product_name = data.get("product_name")
    data_project_id = data.get("project_id")
    session_id = data.get("session_id")


    if data_project_id and int(data_project_id) != project_id_int:
        logging.warning(
            f"DYNAMIC_CONFIG_PROJECT_ID_MISMATCH ip={ip} "
            f"request_project_id={project_id_int} data_project_id={data_project_id}"
        )
        return jsonify({"error": "Project ID mismatch"}), 400


    project_id = project_id_int

    if not all([user_key, product_name]):
        logging.warning(
            f"DYNAMIC_CONFIG_MISSING_PARAMS ip={ip} user_key={user_key} product_name={product_name} project_id={project_id}"
        )
        return jsonify({"error": "Missing required parameters: user_key and product_name"}), 400


    if session_id:
        is_valid, message, status_data = heartbeat_service.check_session_status(session_id)
        if not is_valid:
            logging.warning(
                f"DYNAMIC_CONFIG_INVALID_SESSION ip={ip} session_id={session_id} message={message}"
            )
            return jsonify({"error": f"Invalid session: {message}"}), 403


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


    product = Product.query.filter_by(name=product_name, project_id=project_id).first()
    if not product:
        logging.warning(
            f"DYNAMIC_CONFIG_PRODUCT_NOT_FOUND ip={ip} product_name={product_name} project_id={project_id}"
        )
        return jsonify({"error": "Product not found"}), 404

    if product.status != "active":
        logging.warning(
            f"DYNAMIC_CONFIG_PRODUCT_INACTIVE ip={ip} product_name={product_name} status={product.status}"
        )
        return jsonify({"error": f"Product is {product.status}"}), 403


    config_data = dynamic_config_service.generate_dynamic_config(
        user_key=user_key, product_name=product_name, project_id=project_id
    )

    logging.info(
        f"DYNAMIC_CONFIG_GENERATED ip={ip} user_key={user_key} product={product_name} project_id={project_id}"
    )

    resp = {
        "status": "success",
        "config": config_data["config"],
        "metadata": config_data["metadata"],
        "config_size": config_data["config_size"],
        "timestamp": int(time.time()),
    }


    try:
        encrypted_blob = encrypt_data_with_project_key(resp, project_id)
        logging.debug(
            f"[DEBUG] Encrypted dynamic config response with project {project_id} key"
        )
    except Exception as encrypt_error:
        logging.error(
            f"DYNAMIC_CONFIG_ENCRYPT_FAILED ip={ip} project_id={project_id} "
            f"error={type(encrypt_error).__name__}: {str(encrypt_error)}"
        )
        return jsonify({
            "error": "Failed to encrypt response",
            "message": "Please ensure project encryption key is configured"
        }), 500

    return encrypted_blob

@dynamic_config_bp.route("/config/validate", methods=["POST"])
@require_mtls
@rate_limited
def api_config_validate():
    """
    Validate dynamic configuration from client.
    This endpoint validates that the client is using the correct configuration.
    
    Returns:
        # Get services once at the start (DI pattern)
        dynamic_config_service = get_service('dynamic_config_service')
        Encrypted blob with validation result or JSON error response
    """
    logging.debug("=== DYNAMIC CONFIG VALIDATION REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logging.info(f"DYNAMIC_CONFIG_VALIDATION_ATTEMPT ip={ip} user_agent={user_agent}")


    if not request.is_json:
        logging.warning(f"DYNAMIC_CONFIG_VALIDATION_NO_JSON ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Invalid request format"}), 400

    req_json = request.get_json(silent=True) or {}

    enc_data = req_json.get("blob")
    if not enc_data:
        logging.warning(f"DYNAMIC_CONFIG_VALIDATION_NO_BLOB ip={ip} user_agent={user_agent}")
        return jsonify({"error": "Missing encrypted data"}), 400


    project_id_param = req_json.get("project_id")
    if not project_id_param:
        logging.warning(f"DYNAMIC_CONFIG_VALIDATION_NO_PROJECT_ID ip={ip} user_agent={user_agent}")
        return jsonify({"error": "project_id is required for decryption"}), 400

    try:
        project_id_int = int(project_id_param)
    except (ValueError, TypeError):
        logging.warning(f"DYNAMIC_CONFIG_VALIDATION_INVALID_PROJECT_ID ip={ip} project_id={project_id_param}")
        return jsonify({"error": "Invalid project_id format"}), 400


    data = None


    try:
        import base64
        decoded = base64.b64decode(enc_data).decode("utf-8")
        data = json.loads(decoded)
        logging.debug("[DEBUG] Successfully decoded base64 dynamic config validation data")
    except (base64.binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
        logging.debug("[DEBUG] Not base64, trying decryption with project key...")


    if data is None:
        try:
            data = decrypt_data_with_project_key(enc_data, project_id_int)
            logging.debug(
                f"[DEBUG] Successfully decrypted dynamic config validation with project {project_id_int} key"
            )
        except Exception as decrypt_error:
            logging.warning(
                f"DYNAMIC_CONFIG_VALIDATION_DECRYPT_FAILED ip={ip} project_id={project_id_int} "
                f"error={type(decrypt_error).__name__}: {str(decrypt_error)[:100]}"
            )
            return jsonify({
                "error": "Failed to decrypt request data",
                "message": "Please ensure you are using the correct project encryption key"
            }), 400

    project_id = project_id_int



    user_key = data.get("user_key")
    product_name = data.get("product_name")
    data_project_id = data.get("project_id")
    config_checksum = data.get("config_checksum")


    if data_project_id and int(data_project_id) != project_id_int:
        logging.warning(
            f"DYNAMIC_CONFIG_VALIDATION_PROJECT_ID_MISMATCH ip={ip} "
            f"request_project_id={project_id_int} data_project_id={data_project_id}"
        )
        return jsonify({"error": "Project ID mismatch"}), 400


    project_id = project_id_int

    if not all([user_key, product_name]):
        logging.warning(
            f"DYNAMIC_CONFIG_VALIDATION_MISSING_PARAMS ip={ip} user_key={user_key} product_name={product_name} project_id={project_id}"
        )
        return jsonify({"error": "Missing required parameters"}), 400


    is_valid = dynamic_config_service.validate_config_request(
        user_key=user_key,
        product_name=product_name,
        project_id=project_id,
        config_checksum=config_checksum,
    )

    if not is_valid:
        logging.warning(
            f"DYNAMIC_CONFIG_VALIDATION_FAILED ip={ip} user_key={user_key} product={product_name}"
        )
        return jsonify({"error": "Invalid configuration"}), 403

    logging.info(
        f"DYNAMIC_CONFIG_VALIDATION_SUCCESS ip={ip} user_key={user_key} product={product_name}"
    )

    resp = {
        "status": "success",
        "message": "Configuration validated successfully",
        "timestamp": int(time.time()),
    }


    try:
        encrypted_blob = encrypt_data_with_project_key(resp, project_id)
        logging.debug(
            f"[DEBUG] Encrypted dynamic config validation response with project {project_id} key"
        )
    except Exception as encrypt_error:
        logging.error(
            f"DYNAMIC_CONFIG_VALIDATION_ENCRYPT_FAILED ip={ip} project_id={project_id} "
            f"error={type(encrypt_error).__name__}: {str(encrypt_error)}"
        )
        return jsonify({
            "error": "Failed to encrypt response",
            "message": "Please ensure project encryption key is configured"
        }), 500

    return encrypted_blob

@dynamic_config_bp.route("/config/statistics", methods=["GET"])
@require_mtls
def api_config_statistics():
    """
    Get dynamic configuration statistics (admin only).
    
    Returns:
        # Get services once at the start (DI pattern)
        dynamic_config_service = get_service('dynamic_config_service')
        JSON response with configuration statistics or error
    """
    stats = dynamic_config_service.get_config_statistics()
    return jsonify({"status": "success", "statistics": stats, "timestamp": int(time.time())})





@dynamic_config_bp.route("/schemas", methods=["GET"])
@jwt_required()
@require_project_isolation
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def get_feature_schemas():
    """
    Get all feature configuration schemas for the current project.
    
    Returns:
        JSON response with list of schemas
    """
    try:
        project_id = getattr(g, "project_id", None) or request.args.get("project_id", type=int)
        if not project_id:
            return jsonify({"error": "Project ID is required"}), 400
        
        product_id = request.args.get("product_id", type=int)
        
        query = FeatureConfigSchema.query.filter_by(project_id=project_id, is_active=True)
        
        if product_id:

            query = query.filter_by(product_id=product_id)
        else:

            query = query.filter(
                (FeatureConfigSchema.product_id.is_(None))
            )
        
        schemas = query.all()
        
        return jsonify({
            "status": "success",
            "schemas": [
                {
                    "id": schema.id,
                    "name": schema.name,
                    "description": schema.description,
                    "json_schema": schema.schema_dict,
                    "default_config": schema.default_config_dict,
                    "product_id": schema.product_id,
                    "version": schema.version,
                    "is_active": schema.is_active,
                    "created_at": schema.created_at.isoformat() if schema.created_at else None,
                    "updated_at": schema.updated_at.isoformat() if schema.updated_at else None,
                }
                for schema in schemas
            ]
        })
    except Exception as e:
        logging.error(f"Error getting feature schemas: {e}", exc_info=True)
        return jsonify({"error": "Failed to get feature schemas"}), 500

@dynamic_config_bp.route("/schemas", methods=["POST"])
@jwt_required()
@require_project_isolation
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def create_feature_schema():
    """
    Create a new feature configuration schema.
    
    Request body:
        - name: Schema name (required)
        - description: Schema description (optional)
        - json_schema: JSON Schema definition (required)
        - default_config: Default configuration values (optional)
        - product_id: Product/Product ID (optional, None for project-level schema)
        - version: Schema version (optional, defaults to "1.0.0")
    
    Returns:
        JSON response with created schema
    """
    try:
        user_id = get_jwt_identity()
        project_id = getattr(g, "project_id", None) or request.json.get("project_id")
        
        if not project_id:
            return jsonify({"error": "Project ID is required"}), 400
        
        data = request.json
        name = data.get("name")
        if not name:
            return jsonify({"error": "Schema name is required"}), 400
        

        existing = FeatureConfigSchema.query.filter_by(
            name=name,
            project_id=project_id,
            is_active=True
        ).first()
        if existing:
            return jsonify({"error": f"Schema with name '{name}' already exists in this project"}), 400
        
        json_schema = data.get("json_schema")
        if not json_schema:
            return jsonify({"error": "JSON schema is required"}), 400
        

        try:
            if isinstance(json_schema, str):
                json_schema = json.loads(json_schema)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON schema format"}), 400
        

        default_config = data.get("default_config", {})
        if isinstance(default_config, str):
            try:
                default_config = json.loads(default_config)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid default_config JSON format"}), 400
        
        product_id = data.get("product_id")
        if product_id:

            product = Product.query.filter_by(id=product_id, project_id=project_id).first()
            if not product:
                return jsonify({"error": "Product not found or doesn't belong to project"}), 404
        
        schema = FeatureConfigSchema(
            name=name,
            description=data.get("description"),
            json_schema=json.dumps(json_schema),
            default_config=json.dumps(default_config) if default_config else None,
            product_id=product_id,
            project_id=project_id,
            version=data.get("version", "1.0.0"),
            is_active=True,
            created_by=user_id,
        )
        
        db.session.add(schema)
        db.session.commit()
        
        logging.info(f"FEATURE_SCHEMA_CREATED schema_id={schema.id} name={name} project_id={project_id} product_id={product_id}")
        
        return jsonify({
            "status": "success",
            "schema": {
                "id": schema.id,
                "name": schema.name,
                "description": schema.description,
                "json_schema": schema.schema_dict,
                "default_config": schema.default_config_dict,
                "product_id": schema.product_id,
                "version": schema.version,
                "is_active": schema.is_active,
                "created_at": schema.created_at.isoformat() if schema.created_at else None,
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating feature schema: {e}", exc_info=True)
        return jsonify({"error": "Failed to create feature schema"}), 500

@dynamic_config_bp.route("/schemas/<int:schema_id>", methods=["GET"])
@jwt_required()
@require_project_isolation
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def get_feature_schema(schema_id):
    """
    Get a specific feature configuration schema by ID.
    
    Returns:
        JSON response with schema details
    """
    try:
        project_id = getattr(g, "project_id", None) or request.args.get("project_id", type=int)
        
        schema = FeatureConfigSchema.query.filter_by(id=schema_id, project_id=project_id).first()
        if not schema:
            return jsonify({"error": "Schema not found"}), 404
        
        return jsonify({
            "status": "success",
            "schema": {
                "id": schema.id,
                "name": schema.name,
                "description": schema.description,
                "json_schema": schema.schema_dict,
                "default_config": schema.default_config_dict,
                "product_id": schema.product_id,
                "version": schema.version,
                "is_active": schema.is_active,
                "created_at": schema.created_at.isoformat() if schema.created_at else None,
                "updated_at": schema.updated_at.isoformat() if schema.updated_at else None,
                "created_by": schema.created_by,
            }
        })
    except Exception as e:
        logging.error(f"Error getting feature schema: {e}", exc_info=True)
        return jsonify({"error": "Failed to get feature schema"}), 500

@dynamic_config_bp.route("/schemas/<int:schema_id>", methods=["PUT"])
@jwt_required()
@require_project_isolation
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def update_feature_schema(schema_id):
    """
    Update a feature configuration schema.
    
    Request body:
        - name: Schema name (optional)
        - description: Schema description (optional)
        - json_schema: JSON Schema definition (optional)
        - default_config: Default configuration values (optional)
        - version: Schema version (optional)
        - is_active: Active status (optional)
    
    Returns:
        JSON response with updated schema
    """
    try:
        project_id = getattr(g, "project_id", None) or request.json.get("project_id")
        
        schema = FeatureConfigSchema.query.filter_by(id=schema_id, project_id=project_id).first()
        if not schema:
            return jsonify({"error": "Schema not found"}), 404
        
        data = request.json
        
        if "name" in data:

            existing = FeatureConfigSchema.query.filter_by(
                name=data["name"],
                project_id=project_id,
                is_active=True
            ).filter(FeatureConfigSchema.id != schema_id).first()
            if existing:
                return jsonify({"error": f"Schema with name '{data['name']}' already exists"}), 400
            schema.name = data["name"]
        
        if "description" in data:
            schema.description = data["description"]
        
        if "json_schema" in data:
            json_schema = data["json_schema"]
            if isinstance(json_schema, str):
                try:
                    json_schema = json.loads(json_schema)
                except json.JSONDecodeError:
                    return jsonify({"error": "Invalid JSON schema format"}), 400
            schema.json_schema = json.dumps(json_schema)
        
        if "default_config" in data:
            default_config = data["default_config"]
            if isinstance(default_config, str):
                try:
                    default_config = json.loads(default_config)
                except json.JSONDecodeError:
                    return jsonify({"error": "Invalid default_config JSON format"}), 400
            schema.default_config = json.dumps(default_config) if default_config else None
        
        if "version" in data:
            schema.version = data["version"]
        
        if "is_active" in data:
            schema.is_active = bool(data["is_active"])
        
        db.session.commit()
        
        logging.info(f"FEATURE_SCHEMA_UPDATED schema_id={schema_id} project_id={project_id}")
        
        return jsonify({
            "status": "success",
            "schema": {
                "id": schema.id,
                "name": schema.name,
                "description": schema.description,
                "json_schema": schema.schema_dict,
                "default_config": schema.default_config_dict,
                "product_id": schema.product_id,
                "version": schema.version,
                "is_active": schema.is_active,
                "updated_at": schema.updated_at.isoformat() if schema.updated_at else None,
            }
        })
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating feature schema: {e}", exc_info=True)
        return jsonify({"error": "Failed to update feature schema"}), 500

@dynamic_config_bp.route("/schemas/<int:schema_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def delete_feature_schema(schema_id):
    """
    Delete (deactivate) a feature configuration schema.
    
    Returns:
        JSON response with success status
    """
    try:
        project_id = getattr(g, "project_id", None) or request.args.get("project_id", type=int)
        
        schema = FeatureConfigSchema.query.filter_by(id=schema_id, project_id=project_id).first()
        if not schema:
            return jsonify({"error": "Schema not found"}), 404
        

        schema.is_active = False
        db.session.commit()
        
        logging.info(f"FEATURE_SCHEMA_DELETED schema_id={schema_id} project_id={project_id}")
        
        return jsonify({"status": "success", "message": "Schema deactivated successfully"})
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting feature schema: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete feature schema"}), 500
