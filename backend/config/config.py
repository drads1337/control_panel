import binascii
import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
# Find project root (two levels up from backend/config/config.py)
project_root = Path(__file__).parent.parent.parent
env_path = project_root / ".env"
load_dotenv(dotenv_path=env_path)

MASTER_KEY = os.environ.get("PANEL_MASTER_KEY")

if not MASTER_KEY:
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: PANEL_MASTER_KEY environment variable is not set!\n"
        "This will cause data loss and security vulnerabilities.\n"
        "Please set PANEL_MASTER_KEY environment variable with a secure 32-byte hex key.\n"
        "Example: export PANEL_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')"
    )

if len(MASTER_KEY) != 64:  # 32 bytes = 64 hex characters
    raise RuntimeError(
        f"CRITICAL SECURITY ERROR: PANEL_MASTER_KEY must be exactly 64 hex characters (32 bytes).\n"
        f"Current length: {len(MASTER_KEY)} characters.\n"
        f"Generate a new key with: python -c 'import secrets; print(secrets.token_hex(32))')"
    )

logging.debug(f"✅ Using secure master key: {MASTER_KEY[:16]}...")


class Config:
    # Require SECRET_KEY to be set explicitly
    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is not set!\n"
            "Please set SECRET_KEY with a secure random string.\n"
            "Example: export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )

    # Add MASTER_KEY as a class attribute
    MASTER_KEY = MASTER_KEY

    # Require DATABASE_URL to be set explicitly
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    if not SQLALCHEMY_DATABASE_URI:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: DATABASE_URL environment variable is not set!\n"
            "Please set DATABASE_URL with your PostgreSQL connection string.\n"
            "Example: export DATABASE_URL='postgresql://username:password@localhost/database'"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # PgBouncer configuration
    # PgBouncer is a connection pooler for PostgreSQL that can significantly improve
    # database performance by managing connection pooling at the service level
    # Enable pgbouncer mode by setting DATABASE_URL to pgbouncer connection string
    # Example: postgresql://user:password@pgbouncer-host:6432/database
    # PGBOUNCER_MODE: If True, assumes connections go through pgbouncer
    # This adjusts connection pool settings accordingly
    PGBOUNCER_MODE = os.environ.get("PGBOUNCER_MODE", "false").lower() == "true"

    # Optimized connection pool settings for high load
    # pool_size: base number of connections in the pool
    # max_overflow: maximum number of additional connections
    # pool_recycle: connection lifetime (in seconds) before recreation
    # pool_pre_ping: check connection before use (important for production)
    # pool_timeout: timeout for waiting for a free connection from the pool

    # For production with high load, it is recommended:
    # - pool_size = number of workers * 2-3
    # - max_overflow = pool_size * 1.5-2
    # - pool_recycle = 3600 (1 hour) to prevent stale connections
    
    # When using pgbouncer, we should:
    # 1. Use session pooling mode (transaction mode) - connections are pooled per transaction
    # 2. Reduce pool_size since pgbouncer handles connection pooling
    # 3. Set pool_pre_ping to True (already done) to verify connections
    # 4. Adjust pool_recycle to match pgbouncer's server_idle_timeout

    # Adjusted pool settings based on pgbouncer mode
    # When pgbouncer is used, the application should use fewer connections
    # since pgbouncer handles the connection pooling to the actual PostgreSQL server
    if PGBOUNCER_MODE:
        # In pgbouncer mode, reduce pool size since pgbouncer manages connections
        # Recommended: pool_size = (number of workers) * (threads per worker) + small buffer
        _default_pool_size = int(os.environ.get("DB_POOL_SIZE", 10))  # Reduced for pgbouncer
        _default_max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", 10))  # Reduced for pgbouncer
        _default_read_pool_size = int(os.environ.get("DB_READ_POOL_SIZE", 8))  # Reduced for pgbouncer
        _default_read_max_overflow = int(os.environ.get("DB_READ_MAX_OVERFLOW", 8))  # Reduced for pgbouncer
    else:
        # Standard pool settings for direct PostgreSQL connections
        _default_pool_size = int(os.environ.get("DB_POOL_SIZE", 30))  # Base pool size
        _default_max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", 50))  # Additional connections during peak load
        _default_read_pool_size = int(os.environ.get("DB_READ_POOL_SIZE", 20))  # Smaller for read-only connections
        _default_read_max_overflow = int(os.environ.get("DB_READ_MAX_OVERFLOW", 30))

    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": _default_pool_size,
        "pool_recycle": int(
            os.environ.get("DB_POOL_RECYCLE", 3600)
        ),  # Recreate connections every hour
        "pool_pre_ping": True,  # Critical for production - check connections before use
        "max_overflow": _default_max_overflow,
        "pool_timeout": int(
            os.environ.get("DB_POOL_TIMEOUT", 10)
        ),  # Connection wait timeout (seconds)
        "echo": False,  # Disable SQL query logging in production
        "connect_args": {
            "client_encoding": "utf8",
            "options": "-c timezone=utc -c statement_timeout=5000 -c idle_in_transaction_session_timeout=5000",
        },
    }

    # Settings for read replicas (if used)
    # DATABASE_READ_REPLICA_URL must be set in .env to activate
    SQLALCHEMY_DATABASE_READ_URI = os.environ.get("DATABASE_READ_REPLICA_URL", None)

    # Settings for read replica connection pool (usually smaller, since read-only)
    SQLALCHEMY_READ_ENGINE_OPTIONS = {
        "pool_size": _default_read_pool_size,
        "pool_recycle": int(os.environ.get("DB_READ_POOL_RECYCLE", 3600)),
        "pool_pre_ping": True,
        "max_overflow": _default_read_max_overflow,
        "pool_timeout": int(os.environ.get("DB_READ_POOL_TIMEOUT", 10)),
        "echo": False,
        "connect_args": {
            "client_encoding": "utf8",
            "options": "-c timezone=utc -c statement_timeout=5000 -c idle_in_transaction_session_timeout=5000",
        },
    }

    # Require JWT_SECRET_KEY to be set explicitly
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: JWT_SECRET_KEY environment variable is not set!\n"
            "Please set JWT_SECRET_KEY with a secure random string.\n"
            "Example: export JWT_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )
    BOT_API_KEY = os.environ.get("BOT_API_KEY", "your-bot-api-key-here")
    AVATARS_FOLDER = os.environ.get("AVATARS_FOLDER", "uploads/avatars")
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    DEBUG = False  # Disabled for production
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024 * 1024  # 2GB
    JWT_ACCESS_TOKEN_EXPIRES = 604800  # 7 days in seconds

    # JWT Cookie Configuration for Security
    JWT_TOKEN_LOCATION = ["cookies"]  # Use cookies instead of headers

    # Make cookie security environment-aware
    # In development (HTTP), use Lax SameSite policy (works for same IP)
    # In production (HTTPS), use Lax for better security
    # Note: SameSite=None requires Secure=true, which needs HTTPS
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    JWT_COOKIE_SECURE = FLASK_ENV == "production"  # Only secure in production

    # CRITICAL SECURITY: CSRF protection must be enabled when using cookie-based JWT
    # This prevents CSRF attacks, especially important if forms (application/x-www-form-urlencoded) are added
    # Frontend must include CSRF token in X-CSRFToken header for all authenticated requests
    # 
    # SECURITY WARNING: SameSite=Lax does NOT provide complete CSRF protection:
    # - It does not protect against top-level navigation attacks
    # - It does not protect against <a href="..."> links
    # - It does not protect against <form method="GET"> submissions
    # CSRF protection is REQUIRED for cookie-based authentication
    JWT_COOKIE_CSRF_PROTECT = True  # Enabled - required for cookie-based JWT security
    JWT_COOKIE_HTTPONLY = True  # Prevent XSS attacks
    # Use 'Lax' for development (works for same-origin and same-site)
    # SameSite=None would require Secure=true (HTTPS), which we don't have in dev
    JWT_COOKIE_SAMESITE = "Lax"  # Works for both dev and production
    JWT_ACCESS_COOKIE_NAME = "access_token_cookie"
    JWT_REFRESH_COOKIE_NAME = "refresh_token_cookie"
    JWT_COOKIE_DOMAIN = os.environ.get("JWT_COOKIE_DOMAIN", None)  # Set for production

    # CSRF Configuration
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600
    # Make CSRF SSL strict environment-aware
    WTF_CSRF_SSL_STRICT = FLASK_ENV == "production"  # Only strict in production

    # Redis settings for high load
    REDIS_HOST = os.environ.get("REDIS_HOST", "127.0.0.1")
    REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
    REDIS_DB = int(os.environ.get("REDIS_DB", 0))
    REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)

    # Security settings for Challenge-Response
    # NOTE: For main API rate limits, see rate_limit_config.py (RateLimitConfig)
    # These values are used for specialized rate limiting (e.g., connect endpoints)
    # Different rate limits for development vs production
    FLASK_ENV = os.environ.get("FLASK_ENV", "production")
    if FLASK_ENV == "development":
        RATE_LIMIT = 100  # More lenient for development
        RATE_LIMIT_BURST = 50  # Higher burst limit for development
    else:
        RATE_LIMIT = 60  # Constant: 60 requests per minute
        RATE_LIMIT_BURST = 10  # Maximum 10 requests in the first 10 seconds

    CHALLENGE_TTL = 120  # Reduced to 2 minutes to reduce attack window
    SUSPICIOUS_THRESHOLD = 3  # Reduced to 3 attempts
    SUSPICIOUS_WINDOW = 3600  # 1 hour block
    PROGRESSIVE_DELAY = True  # Enable progressive delay

    # Storage configuration for scalability
    STORAGE_CONFIG = {
        "default_backend": os.environ.get("STORAGE_BACKEND", "local"),
        "backends": {
            "local": {"base_path": os.environ.get("LOCAL_STORAGE_PATH", "uploads")},
            "s3": {
                "bucket_name": os.environ.get("S3_BUCKET_NAME"),
                "region": os.environ.get("S3_REGION", "us-east-1"),
                "access_key": os.environ.get("S3_ACCESS_KEY"),
                "secret_key": os.environ.get("S3_SECRET_KEY"),
            },
        },
        "redis": {
            "host": REDIS_HOST,
            "port": REDIS_PORT,
            "db": REDIS_DB,
            "password": REDIS_PASSWORD,
            "cache_ttl": int(os.environ.get("STORAGE_CACHE_TTL", 3600)),
        },
    }

    # Monitoring and observability settings
    ENABLE_STRUCTURED_LOGGING = (
        os.environ.get("ENABLE_STRUCTURED_LOGGING", "false").lower() == "true"
    )
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    ENABLE_METRICS = os.environ.get("ENABLE_METRICS", "true").lower() == "true"
    METRICS_RETENTION_HOURS = int(os.environ.get("METRICS_RETENTION_HOURS", 24))

    # Health check settings
    HEALTH_CHECK_TIMEOUT = int(os.environ.get("HEALTH_CHECK_TIMEOUT", 5))
    HEALTH_CHECK_INTERVAL = int(os.environ.get("HEALTH_CHECK_INTERVAL", 30))

    # Slow query monitoring settings
    SLOW_QUERY_THRESHOLD_MS = float(
        os.environ.get("SLOW_QUERY_THRESHOLD_MS", 1000.0)
    )  # 1 second default
    ENABLE_SLOW_QUERY_MONITORING = (
        os.environ.get("ENABLE_SLOW_QUERY_MONITORING", "true").lower() == "true"
    )

    # CORS settings from environment variables
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:5001,http://127.0.0.1:5001,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")

    # Additional CORS origins for production
    PRODUCTION_CORS_ORIGINS = (
        os.environ.get("PRODUCTION_CORS_ORIGINS", "").split(",")
        if os.environ.get("PRODUCTION_CORS_ORIGINS")
        else []
    )

    # Combine all CORS origins
    ALL_CORS_ORIGINS = CORS_ORIGINS + [
        origin.strip() for origin in PRODUCTION_CORS_ORIGINS if origin.strip()
    ]

    # Offline authentication ticket secret
    # This secret is used to sign JWT tokens for offline authentication
    # It should be different from JWT_SECRET_KEY and PANEL_MASTER_KEY
    # Generate with: python -c 'import secrets; print(secrets.token_urlsafe(32))'
    # CRITICAL: In production, this must be set explicitly to prevent ticket invalidation on restart
    OFFLINE_TICKET_SECRET = os.environ.get("OFFLINE_TICKET_SECRET")
    if not OFFLINE_TICKET_SECRET:
        # Check FLASK_ENV directly from environment to avoid using the overwritten value
        flask_env_check = os.environ.get("FLASK_ENV", "development")
        if flask_env_check == "production":
            raise RuntimeError(
                "CRITICAL SECURITY ERROR: OFFLINE_TICKET_SECRET environment variable is not set!\n"
                "In production, this must be set explicitly to prevent ticket invalidation on application restart.\n"
                "Please set OFFLINE_TICKET_SECRET with a secure random string.\n"
                "Example: export OFFLINE_TICKET_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
            )
        else:
            # Generate a default secret if not set (for development only)
            import secrets
            OFFLINE_TICKET_SECRET = secrets.token_urlsafe(32)
            logging.warning(
                "OFFLINE_TICKET_SECRET not set in environment. Using auto-generated secret. "
                "This is not secure for production! Please set OFFLINE_TICKET_SECRET in .env"
            )

    # File upload configuration
    # Allowed file extensions for different file types
    # Format: comma-separated list of extensions (e.g., "png,jpg,jpeg,gif,webp")
    ALLOWED_AVATAR_EXTENSIONS = set(
        os.environ.get("ALLOWED_AVATAR_EXTENSIONS", "png,jpg,jpeg,gif,webp").split(",")
    )
    
    # Maximum avatar file size in bytes (default: 5MB)
    MAX_AVATAR_SIZE = int(os.environ.get("MAX_AVATAR_SIZE", 5 * 1024 * 1024))
    
    # Maximum avatar dimensions (width, height) in pixels (default: 300x300)
    MAX_AVATAR_WIDTH = int(os.environ.get("MAX_AVATAR_WIDTH", 300))
    MAX_AVATAR_HEIGHT = int(os.environ.get("MAX_AVATAR_HEIGHT", 300))
    MAX_AVATAR_DIMENSIONS = (MAX_AVATAR_WIDTH, MAX_AVATAR_HEIGHT)
    
    # Allowed extensions for game files
    # Format: JSON string or comma-separated for each file type
    # Example: '{"logo": "png,jpg,jpeg,gif", "banner": "png,jpg,jpeg,gif", "file": "exe,apk,so,dmg,deb,rpm"}'
    _game_extensions_str = os.environ.get(
        "ALLOWED_GAME_FILE_EXTENSIONS",
        '{"logo": "png,jpg,jpeg,gif", "banner": "png,jpg,jpeg,gif", "background": "png,jpg,jpeg,gif", "file": "exe,apk,xapk,so,dmg,deb,rpm,zip,rar,7z,tar,gz,bin,iso,msi,pkg,app,dll,jar,war,ear,py,js,html,css,json,xml,txt,md,pdf,doc,docx,xls,xlsx,ppt,pptx"}'
    )
    try:
        import json
        _game_extensions_dict = json.loads(_game_extensions_str)
        ALLOWED_GAME_FILE_EXTENSIONS = {
            k: set(v.split(",")) if isinstance(v, str) else set(v)
            for k, v in _game_extensions_dict.items()
        }
    except (json.JSONDecodeError, AttributeError):
        # Fallback to default if parsing fails
        ALLOWED_GAME_FILE_EXTENSIONS = {
            "logo": {"png", "jpg", "jpeg", "gif"},
            "banner": {"png", "jpg", "jpeg", "gif"},
            "background": {"png", "jpg", "jpeg", "gif"},
            "file": {
                "exe", "apk", "xapk", "so", "dmg", "deb", "rpm", "zip", "rar", "7z",
                "tar", "gz", "bin", "iso", "msi", "pkg", "app", "dll", "jar", "war",
                "ear", "py", "js", "html", "css", "json", "xml", "txt", "md", "pdf",
                "doc", "docx", "xls", "xlsx", "ppt", "pptx"
            },
        }
    
    # Allowed extensions for loader files (default: "png,jpg,jpeg,gif,exe,apk,so,dmg,deb,rpm")
    ALLOWED_LOADER_EXTENSIONS = set(
        os.environ.get("ALLOWED_LOADER_EXTENSIONS", "png,jpg,jpeg,gif,exe,apk,so,dmg,deb,rpm").split(",")
    )
    
    # WebSocket message size limit (default: 1MB)
    WEBSOCKET_MAX_MESSAGE_SIZE = int(os.environ.get("WEBSOCKET_MAX_MESSAGE_SIZE", 1024 * 1024))
    
    # Celery worker configuration for production
    # Configuration for different queues and their worker counts
    # This allows fine-grained control over worker allocation per queue
    CELERY_WORKER_CONFIG = {
        # Server tasks queue configuration
        # These tasks handle SSH operations (server_start, server_stop, server_restart, server_status_check)
        # Usually require 2-4 workers depending on server count and operation frequency
        "server_tasks": {
            "workers": int(os.environ.get("CELERY_SERVER_TASKS_WORKERS", 3)),  # Default: 3 workers
            "concurrency": int(os.environ.get("CELERY_SERVER_TASKS_CONCURRENCY", 4)),  # Tasks per worker
            "queues": ["server_tasks"],
            "priority": "high",  # Server operations are usually high priority
            "description": "Handles server operations (SSH: start, stop, restart, status check)",
        },
        # Key tasks queue configuration
        # These tasks handle bulk key creation (bulk_create_keys, bulk_create_loader_keys)
        # Usually require 1-2 workers, but higher concurrency for batch operations
        "key_tasks": {
            "workers": int(os.environ.get("CELERY_KEY_TASKS_WORKERS", 2)),  # Default: 2 workers
            "concurrency": int(os.environ.get("CELERY_KEY_TASKS_CONCURRENCY", 2)),  # Tasks per worker
            "queues": ["key_tasks"],
            "priority": "medium",  # Bulk operations are medium priority
            "description": "Handles bulk key creation operations",
        },
        # Default queue configuration
        # Handles all other tasks that don't have specific routing
        "default": {
            "workers": int(os.environ.get("CELERY_DEFAULT_WORKERS", 1)),  # Default: 1 worker
            "concurrency": int(os.environ.get("CELERY_DEFAULT_CONCURRENCY", 4)),  # Tasks per worker
            "queues": ["default"],
            "priority": "low",  # General tasks are low priority
            "description": "Handles general/default tasks",
        },
    }
    