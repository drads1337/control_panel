"""
Production Guard Middleware
Disables debug/test endpoints in production to reduce attack surface
"""

import logging
from functools import wraps

from flask import jsonify, request

from ..config.config import Config

logger = logging.getLogger(__name__)


def development_only(f):
    """
    Decorator to disable endpoints in production mode.
    
    SECURITY: Debug/test endpoints should not exist in production builds.
    This decorator returns 404 in production to completely hide the endpoint.
    
    Usage:
        @development_only
        @bp.route("/debug", methods=["GET"])
        def debug_endpoint():
            ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if Config.FLASK_ENV == "production":
            logger.warning(
                f"Production access attempt to development-only endpoint: {request.endpoint}",
                extra={"endpoint": request.endpoint, "path": request.path}
            )
            return jsonify({"error": "Not found"}), 404
        return f(*args, **kwargs)
    
    return decorated_function

