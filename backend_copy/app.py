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

from ..config.config import Config
from ..config.cors_config import setup_cors
from ..config.rate_limit_config import RateLimitConfig

from ..middleware import ActivityLoggerMiddleware
from ..utils.db_replica import init_replica_binds
from ..utils.monitoring import setup_monitoring_endpoints
from ..utils.slow_query_monitor import setup_slow_query_monitoring
from ..utils.storage_manager import init_storage_manager
from ..utils.structured_logging import get_logger, setup_structured_logging

from .blueprints import register_blueprints
from .error_handlers import register_error_handlers, register_jwt_error_handlers
from .extensions import db, jwt, redis_ext
from .system_routes import register_system_routes

logger = get_logger(__name__)

def check_redis_connection():
    """Check Redis connection at startup"""
    try:
        from ..config.config import Config

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
    # Initialize Redis extension
    redis_ext.init_app(app)

    redis_password_part = f":{Config.REDIS_PASSWORD}@" if Config.REDIS_PASSWORD else ""
    storage_uri = (
        f"redis://{redis_password_part}{Config.REDIS_HOST}:{Config.REDIS_PORT}/{Config.REDIS_DB}"
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
    from ..routes.games import games_bp
    from ..routes.keys import keys_bp
    from ..routes.logs import logs_bp
    from ..routes.projects import projects_bp
    from ..routes.settings import settings_bp
    from ..routes.users import users_bp

    limiter.limit(rate_limits["connect"])(connect_bp)
    limiter.limit(rate_limits["auth"])(auth_bp)
    limiter.limit(rate_limits["keys"])(keys_bp)
    limiter.limit(rate_limits["projects"])(projects_bp)
    limiter.limit(rate_limits["users"])(users_bp)
    limiter.limit(rate_limits["games"])(games_bp)
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

    app.limiter = limiter

    logger.info(
        "Rate limiting configured",
        environment=Config.FLASK_ENV,
        global_limit=rate_limits["global"],
        auth_limit=rate_limits["auth"],
        connect_limit=rate_limits["connect"],
        projects_limit=rate_limits["projects"],
        users_limit=rate_limits["users"],
        games_limit=rate_limits["games"],
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

    if Config.ENABLE_SLOW_QUERY_MONITORING:
        setup_slow_query_monitoring(app)
        logger.info("Slow query monitoring initialized")

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

    app.config["JWT_SECRET_KEY"] = Config.JWT_SECRET_KEY
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
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
    setup_storage_and_monitoring(app)
    setup_migrations(app)

    register_blueprints(app)
    register_error_handlers(app)
    register_jwt_error_handlers(app)
    register_system_routes(app)

    ActivityLoggerMiddleware(app)

    with app.app_context():
        init_replica_binds(app)

    try:
        from .celery_app import CELERY_AVAILABLE, make_celery

        if CELERY_AVAILABLE:
            celery_instance = make_celery(app)
            if celery_instance:

                try:
                    from ..tasks import server_tasks
                    from ..tasks import key_tasks

                    logger.info("Celery tasks loaded successfully")
                except ImportError as e:
                    logger.warning(
                        f"Could not import Celery tasks: {e}. Tasks may not be available."
                    )
            else:
                logger.warning(
                    "Celery initialization returned None. Task queue will use fallback mode."
                )
        else:
            logger.info("Celery not installed. Task queue will use fallback Redis queue mode.")
    except ImportError as e:
        logger.warning(f"Celery not available: {e}. Task queue will use fallback mode.")

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5001)
