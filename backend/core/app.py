"""
Flask application factory
Clean, modular application creation following single responsibility principle
"""

import logging
import redis
from flask import Flask

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_migrate import cli as migrate_cli
from prometheus_flask_exporter import PrometheusMetrics

from ..config.config import Config
from ..config.cors_config import setup_cors
from ..config.rate_limit_config import RateLimitConfig

from ..middleware import ActivityLoggerMiddleware
from ..utils.db_replica import init_replica_binds
from ..utils.monitoring import setup_monitoring_endpoints
from ..utils.query_isolation import init_query_isolation
from ..utils.postgresql_rls import init_postgresql_rls
from ..utils.storage_manager import init_storage_manager
from ..utils.structured_logging import get_logger, setup_structured_logging

from .blueprints import register_blueprints
from .error_handlers import register_error_handlers, register_jwt_error_handlers
from .extensions import db, jwt, redis_ext
from .swagger_config import init_swagger
from .system_routes import register_system_routes

logger = get_logger(__name__)

def check_redis_connection():
    """Check Redis connection at startup"""
    try:
        redis_config = {
            "host": Config.REDIS_HOST,
            "port": Config.REDIS_PORT,
            "db": Config.REDIS_DB,
            "decode_responses": True,
        }

        if Config.REDIS_PASSWORD:
            redis_config["password"] = Config.REDIS_PASSWORD

        redis_client = redis.Redis(**redis_config)
        redis_client.ping()
        logger.debug("Redis connection successful", component="redis")
        return True
    except Exception as e:
        logger.debug("Redis connection failed", component="redis", error=str(e))
        logger.warning(
            "Application requires Redis to run. Please start Redis server",
            component="redis",
            instructions="brew install redis && brew services start redis",
        )
        return False

def check_redis_security():
    """Check Redis security configuration at startup"""
    try:
        from ..utils.redis_startup_check import check_redis_security_on_startup
        
        results = check_redis_security_on_startup()
        
        if results["status"] == "error":
            logger.error(
                "Redis security check failed. Please review configuration.",
                component="redis_security",
                errors=results["errors"]
            )
        elif results["status"] == "warning":
            logger.warning(
                "Redis security warnings found. Review recommendations.",
                component="redis_security",
                warnings=results["warnings"]
            )
        else:
            logger.info(
                "Redis security check passed",
                component="redis_security",
                info=results["info"]
            )
        
        return results["status"] != "error"
    except Exception as e:
        logger.warning(
            f"Failed to run Redis security check: {e}",
            component="redis_security"
        )
        return True

def setup_logging(app: Flask) -> None:
    """Configure application logging"""
    if Config.ENABLE_STRUCTURED_LOGGING:
        setup_structured_logging(app)
        logger.info("Application starting", component="app", version="1.0.0")
    else:

        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        logging.basicConfig(
            level=getattr(logging, Config.LOG_LEVEL), format=log_format, datefmt="%Y-%m-%d %H:%M:%S"
        )
        logging.getLogger("werkzeug").setLevel(logging.WARNING)
        logging.getLogger("werkzeug").propagate = False
        logger.info("Application starting with simple logging")

def setup_redis_and_limiter(app: Flask) -> None:
    """Setup Redis connection and rate limiting"""

    redis_ext.init_app(app)


    redis_password_part = f":{Config.REDIS_PERSISTENT_PASSWORD}@" if Config.REDIS_PERSISTENT_PASSWORD else ""
    storage_uri = (
        f"redis://{redis_password_part}{Config.REDIS_PERSISTENT_HOST}:"
        f"{Config.REDIS_PERSISTENT_PORT}/{Config.REDIS_DB_RATE_LIMIT}"
    )

    def rate_limit_key():
        from flask import request

        if request.method == "OPTIONS":
            return None
        return get_remote_address()

    rate_limits = RateLimitConfig.get_limits(Config.FLASK_ENV)

    limiter = Limiter(
        rate_limit_key,
        app=app,
        storage_uri=storage_uri,

        default_limits=[rate_limits["global"]],
    )

    from ..routes.auth import auth_bp
    from ..routes.connect.connect import connect_bp
    from ..routes.dashboard import dashboard_bp
    from ..routes.files import files_bp
    from ..routes.products import products_bp
    from ..routes.keys import keys_bp
    from ..routes.logs import logs_bp
    from ..routes.projects import projects_bp
    from ..routes.settings import settings_bp
    from ..routes.users import users_bp

    limiter.limit(rate_limits["connect"])(connect_bp)
    



    @auth_bp.before_request
    def check_redis_for_auth_rate_limiting():
        """Ensure Redis is available for rate limiting on auth endpoints"""
        from flask import jsonify, request
        from ..utils.redis_client import get_redis_wrapper
        import logging
        
        logger = logging.getLogger(__name__)
        

        if request.method == "OPTIONS":
            return None
        
        try:
            redis_wrapper = get_redis_wrapper()
            if not redis_wrapper.is_available():
                logger.error(
                    f"SECURITY: Redis unavailable for auth rate limiting on {request.endpoint}. "
                    f"Blocking request from {request.remote_addr}"
                )
                return jsonify({
                    "error": "Rate limiting service unavailable",
                    "message": "Request blocked for security. Please try again later."
                }), 503
        except Exception as e:

            logger.error(
                f"SECURITY: Cannot verify Redis availability for auth rate limiting on {request.endpoint}. "
                f"Blocking request from {request.remote_addr}: {e}"
            )
            return jsonify({
                "error": "Rate limiting service unavailable",
                "message": "Request blocked for security. Please try again later."
            }), 503
        
        return None
    
    limiter.limit(rate_limits["auth"])(auth_bp)
    limiter.limit(rate_limits["keys"])(keys_bp)
    limiter.limit(rate_limits["projects"])(projects_bp)
    limiter.limit(rate_limits["users"])(users_bp)
    limiter.limit(rate_limits["products"])(products_bp)
    limiter.limit(rate_limits["files"])(files_bp)
    limiter.limit(rate_limits["settings"])(settings_bp)
    limiter.limit(rate_limits["logs"])(logs_bp)
    limiter.limit(rate_limits["dashboard"])(dashboard_bp)

    try:
        from ..routes.keys.management import get_key_details

        limiter.exempt(get_key_details)
        limiter.limit("60 per minute")(get_key_details)
        logger.info("Applied lenient rate limit (60/min) to key details endpoint")
    except (ImportError, AttributeError) as e:
        logger.warning(f"Could not apply lenient rate limit to key details endpoint: {e}")

    try:
        from ..routes.auth import get_csrf_token

        limiter.exempt(get_csrf_token)
        limiter.limit(rate_limits["csrf"])(get_csrf_token)
        logger.info(f"Applied CSRF-specific rate limit ({rate_limits['csrf']}) to CSRF token endpoint")
    except (ImportError, AttributeError) as e:
        logger.warning(f"Could not apply CSRF-specific rate limit to CSRF token endpoint: {e}")

    try:
        from ..routes.files import upload_product_extra_file_chunk, finalize_product_extra_file_upload

        # Exempt chunked upload endpoints from default rate limit and apply higher limits
        # Chunked uploads can send many requests in quick succession (one per chunk)
        limiter.exempt(upload_product_extra_file_chunk)
        limiter.limit("500 per minute")(upload_product_extra_file_chunk)
        limiter.exempt(finalize_product_extra_file_upload)
        limiter.limit("60 per minute")(finalize_product_extra_file_upload)
        logger.info("Applied higher rate limits to chunked upload endpoints (500/min for chunks, 60/min for finalize)")
    except (ImportError, AttributeError) as e:
        logger.warning(f"Could not apply higher rate limits to chunked upload endpoints: {e}")

    app.limiter = limiter

    logger.info(
        "Rate limiting configured",
        environment=Config.FLASK_ENV,
        global_limit=rate_limits["global"],
        auth_limit=rate_limits["auth"],
        connect_limit=rate_limits["connect"],
        projects_limit=rate_limits["projects"],
        users_limit=rate_limits["users"],
        products_limit=rate_limits["products"],
        files_limit=rate_limits["files"],
        settings_limit=rate_limits["settings"],
        logs_limit=rate_limits["logs"],
        dashboard_limit=rate_limits["dashboard"],
    )

def setup_storage_and_monitoring(app: Flask) -> None:
    """Setup storage manager and monitoring systems"""

    try:
        init_storage_manager(Config.STORAGE_CONFIG)
        logger.info(
            "Storage manager initialized", default_backend=Config.STORAGE_CONFIG["default_backend"]
        )
    except Exception as e:
        logger.error(f"Failed to initialize storage manager: {e}")
        if Config.STORAGE_CONFIG["default_backend"] != "local":
            raise RuntimeError(f"Storage manager initialization failed: {e}")

    if Config.ENABLE_METRICS:
        setup_monitoring_endpoints(app)
        logger.info(
            "Monitoring system initialized",
            endpoints=["/api/health", "/api/metrics", "/api/status"],
        )


def setup_migrations(app: Flask) -> None:
    """Setup Flask-Migrate"""
    migrate = Migrate(app, db)

    app.cli.add_command(migrate_cli.init)
    app.cli.add_command(migrate_cli.revision)
    app.cli.add_command(migrate_cli.upgrade)
    app.cli.add_command(migrate_cli.migrate)
    app.cli.add_command(migrate_cli.stamp)

def create_app() -> Flask:
    """
    Application factory function
    Creates and configures the Flask application following single responsibility principle
    """

    if not check_redis_connection():
        raise RuntimeError("Redis is required but not available. Please start Redis server.")

    app = Flask(__name__)
    app.config.from_object(Config)

    if Config.FLASK_ENV == "production":

        app.static_folder = None
        app.static_url_path = None
        logger.info("Static file serving disabled in production - Nginx will serve static files directly")
    else:

        app.static_folder = "../frontend/dist"
        app.static_url_path = ""
        logger.info("Static file serving enabled in development mode")

    db.init_app(app)
    jwt.init_app(app)
    redis_ext.init_app(app)
    


    init_query_isolation(app)
    


    init_postgresql_rls(app)

    app.config["JWT_SECRET_KEY"] = Config.JWT_SECRET_KEY
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
    app.config["JWT_TOKEN_LOCATION"] = ["cookies", "headers"]
    app.config["JWT_COOKIE_SECURE"] = Config.JWT_COOKIE_SECURE

    app.config["JWT_COOKIE_CSRF_PROTECT"] = Config.JWT_COOKIE_CSRF_PROTECT
    app.config["JWT_COOKIE_HTTPONLY"] = Config.JWT_COOKIE_HTTPONLY
    app.config["JWT_COOKIE_SAMESITE"] = Config.JWT_COOKIE_SAMESITE
    app.config["JWT_COOKIE_DOMAIN"] = Config.JWT_COOKIE_DOMAIN
    app.config["JWT_ACCESS_COOKIE_NAME"] = Config.JWT_ACCESS_COOKIE_NAME
    app.config["JWT_REFRESH_COOKIE_NAME"] = Config.JWT_REFRESH_COOKIE_NAME

    app.config["JWT_CSRF_IN_COOKIES"] = False

    app.config["JWT_ACCESS_CSRF_HEADER_NAME"] = "X-CSRFToken"
    app.config["JWT_REFRESH_CSRF_HEADER_NAME"] = "X-CSRFToken"

    setup_logging(app)
    setup_cors(app)
    setup_redis_and_limiter(app)
    

    from ..config.security_headers import setup_security_headers
    setup_security_headers(app)
    
    with app.app_context():
        check_redis_security()
    
    if Config.ENABLE_METRICS:
        metrics = PrometheusMetrics(app, path='/metrics', export_defaults=True)
        app.prometheus_metrics = metrics
        logger.info("Prometheus metrics initialized", endpoint="/metrics")
    
    setup_storage_and_monitoring(app)
    setup_migrations(app)


    from .service_container import init_services
    init_services(app)
    logger.info("Service container initialized")

    register_blueprints(app)
    register_error_handlers(app)
    register_jwt_error_handlers(app)
    register_system_routes(app)
    

    if Config.FLASK_ENV != "production":
        try:
            swagger = init_swagger(app)
            logger.info("Swagger documentation initialized", endpoint="/api/docs")
        except Exception as e:
            logger.warning(f"Failed to initialize Swagger: {e}. API documentation will not be available.")


    from ..services.activity.activity_service import ActivityService
    activity_service = app.service_container.get('activity_service')
    ActivityLoggerMiddleware(app, activity_service=activity_service)

    with app.app_context():
        init_replica_binds(app)

    # Celery is required in production
    from .celery_app import CELERY_AVAILABLE, make_celery
    from ..config.config import IS_PRODUCTION

    if CELERY_AVAILABLE:
        celery_instance = make_celery(app)
        if celery_instance:
            try:
                from ..tasks import server_tasks
                from ..tasks import key_tasks
                logger.info("Celery tasks loaded successfully")
            except ImportError as e:
                if IS_PRODUCTION:
                    raise RuntimeError(
                        f"CRITICAL: Failed to import Celery tasks in production: {e}. "
                        "All task modules must be importable in production."
                    ) from e
                logger.warning(
                    f"Could not import Celery tasks: {e}. Tasks may not be available."
                )
        else:
            if IS_PRODUCTION:
                raise RuntimeError(
                    "CRITICAL: Celery initialization failed in production. "
                    "Task queue is required for production operation."
                )
            logger.warning(
                "Celery initialization returned None. Task queue will use fallback Redis queue mode (development only)."
            )
    else:
        if IS_PRODUCTION:
            raise RuntimeError(
                "CRITICAL: Celery is required in production but not available. "
                "Install with: pip install celery"
            )
        logger.info("Celery not installed. Task queue will use fallback Redis queue mode (development only).")

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5001)