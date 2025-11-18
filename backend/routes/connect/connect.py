"""
Refactored Connect Routes
Clean, thin route handlers that delegate to service layer
"""

import logging

from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import create_access_token, set_access_cookies
from flask_wtf.csrf import CSRFProtect

from ...config.config import Config
from ...middleware.rate_limiting import connect_rate_limit
from ...services.connect import connect_service

connect_bp = Blueprint("connect", __name__)

csrf = CSRFProtect()

logger = logging.getLogger(__name__)

@connect_bp.route("/challenge", methods=["POST"])
@connect_rate_limit(rate_limit=Config.RATE_LIMIT, rate_limit_burst=Config.RATE_LIMIT_BURST)
def get_challenge():
    """Generate challenge for authentication - thin route handler"""
    req_json = request.get_json(silent=True) or {}

    user_key = req_json.get("user_key")
    fingerprint = req_json.get("fingerprint")
    client_project_id = req_json.get("project_id")

    if not user_key or not fingerprint:
        return jsonify({"error": "Missing user_key or fingerprint"}), 400

    ip = request.remote_addr
    response, status_code = connect_service.handle_challenge_request(
        user_key=user_key, fingerprint=fingerprint, client_project_id=client_project_id, ip=ip
    )

    return jsonify(response), status_code

@connect_bp.route("/connect", methods=["POST"])
@connect_rate_limit(rate_limit=Config.RATE_LIMIT, rate_limit_burst=Config.RATE_LIMIT_BURST)
def api_connect():
    """
    Main connect endpoint - thin route handler

    SECURITY: Rate limiting is applied by decorator, but note that user_key is inside
    encrypted blob, so rate limiting uses IP address. Additional IP-based rate limiting
    is applied before expensive decryption operations.
    """
    logger.debug("=== CONNECT REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logger.info(f"CONNECT_ATTEMPT ip={ip} user_agent={user_agent}")

    try:
        import redis
        from ...config.config import Config

        redis_client = redis.Redis(
            host=Config.REDIS_HOST,
            port=Config.REDIS_PORT,
            db=Config.REDIS_DB,
            password=Config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )

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
            response_builder = ResponseBuilder()
            error_response = response_builder.build_error_response("Rate limit exceeded")
            encrypted_response = response_builder.encrypt_response(error_response, True)
            return encrypted_response, 429
    except Exception as e:
        logger.error(f"IP rate limiting check failed: {e}")

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
        logger.warning(f"NO_BLOB ip={ip}")
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
        enc_data=enc_data, ip=ip, user_agent=user_agent, project_id=project_id
    )

    return encrypted_response, status_code

@connect_bp.route("/classic_connect", methods=["POST"])
@connect_rate_limit(rate_limit=Config.RATE_LIMIT, rate_limit_burst=Config.RATE_LIMIT_BURST)
@csrf.exempt
def classic_connect():
    """
    Classic connect endpoint for legacy authentication - thin route handler

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
    logger.debug("=== CLASSIC CONNECT REQUEST RECEIVED ===")
    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")
    logger.info(f"CLASSIC_CONNECT_ATTEMPT ip={ip} user_agent={user_agent}")

    req_json = request.get_json(silent=True) or {}
    token = req_json.get("token")
    username = req_json.get("username")
    password = req_json.get("password")

    response_data, status_code = connect_service.handle_classic_connect_request(
        token=token, username=username, password=password, ip=ip, user_agent=user_agent
    )

    if username and password and status_code == 200:
        from flask_jwt_extended import set_access_cookies

        access_token = response_data.get("access_token")
        if access_token:
            response = make_response(jsonify(response_data))
            set_access_cookies(response, access_token)
            return response

    return jsonify(response_data), status_code
