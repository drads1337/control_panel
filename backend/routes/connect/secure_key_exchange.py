"""
Secure Key Exchange API Routes
Provides certificate-based session key derivation for enhanced security.

SECURITY FEATURES:
1. Eliminates hardcoded master keys in clients
2. Session keys derived from mTLS certificate
3. Short-lived keys with automatic rotation
4. Certificate fingerprint binding

FLOW:
1. Client connects with mTLS certificate
2. Client requests session key via /api/session-key
3. Server derives key from certificate and returns encrypted response
4. Client uses session key for all subsequent requests
5. Session key expires after TTL, client requests new one
"""

import logging
from flask import Blueprint, jsonify, request

from ...middleware import require_mtls, is_mtls_enabled
from ...middleware.mtls import get_client_certificate_cn, verify_project_certificate_from_request
from ...middleware.rate_limiting import connect_rate_limit
from ...config.config import Config
from ...utils.secure_key_exchange import (
    get_secure_key_exchange,
    get_enhanced_challenge_handler,
    get_cert_device_binding
)

secure_key_bp = Blueprint("secure_key", __name__)

logger = logging.getLogger(__name__)


@secure_key_bp.route("/session-key", methods=["POST"])
@require_mtls
@connect_rate_limit(rate_limit=10, rate_limit_burst=5)  # Stricter rate limit for key exchange
def get_session_key():
    """
    Get session encryption key derived from client certificate.
    
    SECURITY: This endpoint eliminates the need for hardcoded master keys in clients.
    The session key is:
    - Derived from client's mTLS certificate
    - Valid for limited time (default 1 hour)
    - Bound to certificate fingerprint
    - Cannot be reused with different certificate
    
    Request JSON:
        {
            "project_id": "1234567890",
            "device_fingerprint": "sha256_hash",
            "client_version": "1.0.0" (optional)
        }
    
    Response JSON:
        {
            "session_key": "hex_encoded_key",
            "key_id": "short_key_identifier",
            "expires_at": 1234567890,
            "expires_in_seconds": 3600,
            "cert_fingerprint": "first_16_chars_of_fingerprint"
        }
    """
    from ...middleware.mtls import _mtls_validator
    
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    
    logger.info(f"SESSION_KEY_REQUEST ip={ip} user_agent={user_agent}")
    
    # Get client certificate
    cert_pem = _mtls_validator.get_client_certificate_pem()
    if not cert_pem:
        logger.warning(f"SESSION_KEY_NO_CERT ip={ip}")
        return jsonify({"error": "Client certificate required"}), 403
    
    # Parse request
    req_json = request.get_json(silent=True) or {}
    project_id = req_json.get("project_id")
    device_fingerprint = req_json.get("device_fingerprint")
    
    if not project_id:
        return jsonify({"error": "project_id required"}), 400
    
    if not device_fingerprint:
        return jsonify({"error": "device_fingerprint required"}), 400
    
    # Verify certificate for project
    if is_mtls_enabled():
        valid, msg, cn = verify_project_certificate_from_request(project_id)
        if not valid:
            logger.warning(f"SESSION_KEY_CERT_INVALID ip={ip} project={project_id} error={msg}")
            return jsonify({"error": f"Certificate validation failed: {msg}"}), 403
    
    try:
        key_exchange = get_secure_key_exchange()
        cert_device = get_cert_device_binding()
        
        # Get certificate fingerprint
        cert_fingerprint = key_exchange.get_certificate_fingerprint(cert_pem)
        
        # Verify/register certificate-device binding
        binding_valid = cert_device.register_certificate_device(
            cert_fingerprint=cert_fingerprint,
            device_fingerprint=device_fingerprint,
            project_id=int(project_id) if project_id.isdigit() else 0
        )
        
        if not binding_valid:
            logger.warning(
                f"SESSION_KEY_DEVICE_MISMATCH ip={ip} project={project_id} "
                f"cert={cert_fingerprint[:16]}..."
            )
            return jsonify({
                "error": "Certificate is bound to a different device",
                "code": "CERT_DEVICE_MISMATCH"
            }), 403
        
        # Derive session key
        additional_context = f"{project_id}:{device_fingerprint}".encode()
        session_key, expires_at, key_id = key_exchange.derive_session_key_from_certificate(
            cert_pem=cert_pem,
            additional_context=additional_context
        )
        
        import time
        expires_in = expires_at - int(time.time())
        
        logger.info(
            f"SESSION_KEY_ISSUED ip={ip} project={project_id} "
            f"key_id={key_id} expires_in={expires_in}s"
        )
        
        return jsonify({
            "session_key": session_key,
            "key_id": key_id,
            "expires_at": expires_at,
            "expires_in_seconds": expires_in,
            "cert_fingerprint": cert_fingerprint[:16]
        }), 200
        
    except Exception as e:
        logger.error(f"SESSION_KEY_ERROR ip={ip} error={e}")
        return jsonify({"error": "Failed to generate session key"}), 500


@secure_key_bp.route("/validate-session", methods=["POST"])
@require_mtls
@connect_rate_limit(rate_limit=30, rate_limit_burst=10)
def validate_session():
    """
    Validate that session key is still valid and matches certificate.
    
    Request JSON:
        {
            "key_id": "session_key_id"
        }
    
    Response JSON:
        {
            "valid": true/false,
            "expires_at": 1234567890,
            "expires_in_seconds": 3600
        }
    """
    from ...middleware.mtls import _mtls_validator
    
    ip = request.remote_addr
    
    # Get client certificate
    cert_pem = _mtls_validator.get_client_certificate_pem()
    if not cert_pem:
        return jsonify({"error": "Client certificate required"}), 403
    
    # Parse request
    req_json = request.get_json(silent=True) or {}
    key_id = req_json.get("key_id")
    
    if not key_id:
        return jsonify({"error": "key_id required"}), 400
    
    try:
        key_exchange = get_secure_key_exchange()
        
        is_valid, session_key, error = key_exchange.validate_session_key(
            key_id=key_id,
            cert_pem=cert_pem
        )
        
        if not is_valid:
            return jsonify({
                "valid": False,
                "error": error
            }), 200
        
        # Get expiration info from Redis
        from ...utils.redis_client import get_redis_client
        import json
        import time
        
        redis_client = get_redis_client()
        session_data = redis_client.get(f"session_key:{key_id}")
        
        expires_at = 0
        if session_data:
            try:
                data = json.loads(session_data)
                expires_at = data.get("expires_at", 0)
            except:
                pass
        
        expires_in = max(0, expires_at - int(time.time()))
        
        return jsonify({
            "valid": True,
            "expires_at": expires_at,
            "expires_in_seconds": expires_in
        }), 200
        
    except Exception as e:
        logger.error(f"SESSION_VALIDATE_ERROR ip={ip} error={e}")
        return jsonify({"error": "Validation failed"}), 500


@secure_key_bp.route("/certificate-info", methods=["GET"])
@require_mtls
def get_certificate_info():
    """
    Get information about the presented client certificate.
    Useful for debugging and client verification.
    
    Response JSON:
        {
            "cn": "client-name",
            "fingerprint": "sha256_fingerprint",
            "valid_for_project": true/false,
            "bound_to_device": true/false
        }
    """
    from ...middleware.mtls import _mtls_validator
    
    ip = request.remote_addr
    
    cert_pem = _mtls_validator.get_client_certificate_pem()
    if not cert_pem:
        return jsonify({"error": "Client certificate not provided"}), 403
    
    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import hashes
        
        cert = x509.load_pem_x509_certificate(
            cert_pem.encode('utf-8'),
            default_backend()
        )
        
        # Get CN
        cn = None
        for attr in cert.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME):
            cn = attr.value
            break
        
        # Get fingerprint
        fingerprint = cert.fingerprint(hashes.SHA256()).hex()
        
        # Get validity dates
        not_before = cert.not_valid_before_utc.isoformat() if hasattr(cert, 'not_valid_before_utc') else cert.not_valid_before.isoformat()
        not_after = cert.not_valid_after_utc.isoformat() if hasattr(cert, 'not_valid_after_utc') else cert.not_valid_after.isoformat()
        
        # Get issuer
        issuer_cn = None
        for attr in cert.issuer.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME):
            issuer_cn = attr.value
            break
        
        return jsonify({
            "cn": cn,
            "fingerprint": fingerprint,
            "fingerprint_short": fingerprint[:16],
            "issuer_cn": issuer_cn,
            "not_valid_before": not_before,
            "not_valid_after": not_after,
            "serial_number": str(cert.serial_number)
        }), 200
        
    except Exception as e:
        logger.error(f"CERT_INFO_ERROR ip={ip} error={e}")
        return jsonify({"error": "Failed to parse certificate"}), 500
