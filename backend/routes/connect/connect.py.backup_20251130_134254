"""
Refactored Connect Routes
Clean, thin route handlers that delegate to service layer
"""

import logging

from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import create_access_token, set_access_cookies
from flask_wtf.csrf import CSRFProtect

from ...config.config import Config
from ...middleware import require_mtls
from ...middleware.rate_limiting import connect_rate_limit
from ...utils.service_helpers import get_service

connect_bp = Blueprint("connect", __name__)

csrf = CSRFProtect()

logger = logging.getLogger(__name__)

@connect_bp.route("/challenge", methods=["POST"])
@require_mtls
@connect_rate_limit(rate_limit=Config.RATE_LIMIT, rate_limit_burst=Config.RATE_LIMIT_BURST)
def get_challenge():
    """Generate challenge for authentication"""
    # Get services once at the start (DI pattern)
    connect_service = get_service('connect_service')
    
    req_json = request.get_json(silent=True) or {}

    user_key = req_json.get("user_key")
    fingerprint = req_json.get("fingerprint")
    client_project_id = req_json.get("project_id")

    if not user_key or not fingerprint:
        return jsonify({"error": "Missing user_key or fingerprint"}), 400

    ip = request.remote_addr
    response, status_code = connect_service.handle_challenge_request(
        user_key=user_key,
        fingerprint=fingerprint,
        client_project_id=client_project_id,
        ip=ip
    )

    return jsonify(response), status_code

@connect_bp.route("/connect", methods=["POST"])
@require_mtls
@connect_rate_limit(rate_limit=Config.RATE_LIMIT, rate_limit_burst=Config.RATE_LIMIT_BURST)
def api_connect():
    """
    Main connect endpoint

    SECURITY: Rate limiting is applied by decorator, but note that user_key is inside
    encrypted blob, so rate limiting uses IP address. Additional IP-based rate limiting
    is applied before expensive decryption operations.
    """
    # Get services once at the start (DI pattern)
    connect_service = get_service('connect_service')
    security_service = get_service('security_service')
    
    logger.debug("=== CONNECT REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logger.info(f"CONNECT_ATTEMPT ip={ip} user_agent={user_agent}")

    # SECURITY: IP-based rate limiting with fail-close behavior
    # This is a critical security endpoint - if Redis fails, block the request
    try:
        import redis
        from ...config.config import Config
        from ...utils.redis_client import get_redis_client

        # Use persistent Redis instance for rate limiting
        redis_client = get_redis_client()
        
        # SECURITY: Fail-close - if Redis is unavailable, block the request
        if not redis_client.is_available():
            logger.error(f"SECURITY: Redis unavailable for IP rate limiting. Blocking request from {ip}")
            from ...services.connect import ResponseBuilder
            response_builder = ResponseBuilder()
            error_response = response_builder.build_error_response(
                "Rate limiting service unavailable. Request blocked for security."
            )
            encrypted_response = response_builder.encrypt_response(error_response, True)
            return encrypted_response, 503  # Service Unavailable

        ip_rate_key = f"rl_connect_ip:{ip}"
        ip_rate_count = redis_client.incr(ip_rate_key)
        if ip_rate_count == 1:
            redis_client.expire(ip_rate_key, 60)

        MAX_REQUESTS_PER_MINUTE_BY_IP = 30
        if ip_rate_count > MAX_REQUESTS_PER_MINUTE_BY_IP:
            logger.warning(f"IP_RATE_LIMIT_EXCEEDED ip={ip} count={ip_rate_count}")
            from ...services.connect import ResponseBuilder, SecurityChecker

            security_checker = SecurityChecker()
            security_checker.log_suspicious_activity(ip, "IP_RATE_LIMIT_CONNECT", "")
            
            # Update trigger count for Rate Limiting Protection rule
            try:
                # Try to get project_id from request if available
                # Note: project_id might not be available yet at this point
                # This is best-effort update
                if project_id:
                    security_service._update_rule_trigger("Rate Limiting Protection", project_id)
            except Exception as e:
                logger.debug(f"Could not update rate limit rule trigger: {e}")
            
            response_builder = ResponseBuilder()
            error_response = response_builder.build_error_response("Rate limit exceeded")
            encrypted_response = response_builder.encrypt_response(error_response, True)
            return encrypted_response, 429
    except (redis.ConnectionError, redis.TimeoutError) as e:
        # SECURITY: Fail-close for critical security endpoint
        # If Redis fails, block the request instead of allowing it
        logger.error(f"SECURITY: Redis connection error for IP rate limiting. Blocking request from {ip}: {e}")
        from ...services.connect import ResponseBuilder
        response_builder = ResponseBuilder()
        error_response = response_builder.build_error_response(
            "Rate limiting service unavailable. Request blocked for security."
        )
        encrypted_response = response_builder.encrypt_response(error_response, True)
        return encrypted_response, 503  # Service Unavailable
    except redis.RedisError as e:
        # SECURITY: Fail-close for critical security endpoint
        logger.error(f"SECURITY: Redis error for IP rate limiting. Blocking request from {ip}: {e}")
        from ...services.connect import ResponseBuilder
        response_builder = ResponseBuilder()
        error_response = response_builder.build_error_response(
            "Rate limiting service unavailable. Request blocked for security."
        )
        encrypted_response = response_builder.encrypt_response(error_response, True)
        return encrypted_response, 503  # Service Unavailable
    except Exception as e:
        # SECURITY: Fail-close for unexpected errors
        logger.error(f"SECURITY: Unexpected error in IP rate limiting. Blocking request from {ip}: {e}", exc_info=True)
        from ...services.connect import ResponseBuilder
        response_builder = ResponseBuilder()
        error_response = response_builder.build_error_response(
            "Rate limiting service unavailable. Request blocked for security."
        )
        encrypted_response = response_builder.encrypt_response(error_response, True)
        return encrypted_response, 503  # Service Unavailable

    if not request.is_json:
        logger.warning(f"NO_JSON ip={ip}")
        from ...services.connect import ResponseBuilder

        response_builder = ResponseBuilder()
        error_response = response_builder.build_error_response("Invalid request format")
        encrypted_response = response_builder.encrypt_response(error_response, True)
        return encrypted_response, 400

    req_json = request.get_json(silent=True) or {}
    enc_data = req_json.get("blob")
    project_id = req_json.get("project_id")

    if not enc_data:
        # Log more context for debugging
        request_keys = list(req_json.keys()) if req_json else []
        logger.warning(
            f"NO_BLOB ip={ip} user_agent={user_agent} "
            f"project_id={project_id} request_keys={request_keys}"
        )
        from ...services.connect import ResponseBuilder

        response_builder = ResponseBuilder()
        error_response = response_builder.build_error_response("Missing encrypted data")
        encrypted_response = response_builder.encrypt_response(error_response, True)
        return encrypted_response, 400

    MAX_ENCRYPTED_DATA_SIZE = 1024 * 1024
    if len(enc_data) > MAX_ENCRYPTED_DATA_SIZE:
        logger.warning(f"ENCRYPTED_DATA_TOO_LARGE ip={ip} size={len(enc_data)}")
        from ...services.connect import ResponseBuilder

        response_builder = ResponseBuilder()
        error_response = response_builder.build_error_response("Request data too large")
        encrypted_response = response_builder.encrypt_response(error_response, True)
        return encrypted_response, 400

    encrypted_response, status_code = connect_service.handle_connect_request(
        enc_data=enc_data,
        ip=ip,
        user_agent=user_agent,
        project_id=project_id
    )

    return encrypted_response, status_code

@connect_bp.route("/classic_connect", methods=["POST"])
@require_mtls
@connect_rate_limit(rate_limit=Config.RATE_LIMIT, rate_limit_burst=Config.RATE_LIMIT_BURST)
@csrf.exempt
def classic_connect():
    """
    Classic connect endpoint for legacy authentication

    SECURITY: For username/password authentication, this endpoint now uses process_simple_login()
    which provides full security protections:
    - ✅ Rate limiting via @connect_rate_limit decorator
    - ✅ Brute-force protection via record_login_attempt()
    - ✅ IP blocking checks via check_project_security()
    - ✅ Session limit checks
    - ✅ Project active status checks
    - ✅ Suspicious activity logging via log_suspicious()
    - ✅ Webhook triggering for login events
    - ✅ User login info updates (last_login, last_ip, location)

    For token authentication, security is handled via token validation and expiration checks.
    """
    # Get services once at the start (DI pattern)
    connect_service = get_service('connect_service')
    
    logger.debug("=== CLASSIC CONNECT REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logger.info(f"CLASSIC_CONNECT_ATTEMPT ip={ip} user_agent={user_agent}")

    req_json = request.get_json(silent=True) or {}
    token = req_json.get("token")
    username = req_json.get("username")
    password = req_json.get("password")
    response_data, status_code = connect_service.handle_classic_connect_request(
        token=token,
        username=username,
        password=password,
        ip=ip,
        user_agent=user_agent
    )

    if username and password and status_code == 200:
        from flask_jwt_extended import set_access_cookies

        access_token = response_data.get("access_token")
        if access_token:
            response = make_response(jsonify(response_data))
            set_access_cookies(response, access_token)
            return response

    return jsonify(response_data), status_code
