import binascii
import json
import logging
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Environment Setup
project_root = Path(__file__).parent.parent.parent
env_path = project_root / ".env"

FLASK_ENV = os.environ.get("FLASK_ENV")

if not FLASK_ENV and env_path.exists():
    from dotenv import dotenv_values
    env_vars = dotenv_values(dotenv_path=env_path)
    FLASK_ENV = env_vars.get("FLASK_ENV")

FLASK_ENV = FLASK_ENV or "production"
os.environ["FLASK_ENV"] = FLASK_ENV
IS_PRODUCTION = FLASK_ENV == "production"

if FLASK_ENV == "development":
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)
        logging.debug("Loaded .env file for development")
else:
    logging.debug("Production mode: using environment variables only (no .env file)")

# Master Key Validation
MASTER_KEY = os.environ.get("PANEL_MASTER_KEY")

if not MASTER_KEY:
    error_msg = (
        "CRITICAL SECURITY ERROR: PANEL_MASTER_KEY environment variable is not set!\n"
        "Please set PANEL_MASTER_KEY environment variable with a secure 32-byte hex key.\n"
        "Example: export PANEL_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')"
    )
    if IS_PRODUCTION:
        raise RuntimeError(f"{error_msg}\nIn production mode, the application MUST fail if secrets are missing.")
    else:
        raise RuntimeError(f"{error_msg}\nThis will cause data loss and security vulnerabilities.")

if len(MASTER_KEY) != 64:
    raise RuntimeError(
        f"CRITICAL SECURITY ERROR: PANEL_MASTER_KEY must be exactly 64 hex characters (32 bytes).\n"
        f"Current length: {len(MASTER_KEY)} characters.\n"
        f"Generate a new key with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )

logging.debug(f"✅ Using secure master key: {MASTER_KEY[:16]}...")


class Config:
    # General Security
    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is not set!\n"
            "Example: export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )
    MASTER_KEY = MASTER_KEY
    DEBUG = False
    FLASK_ENV = FLASK_ENV

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    if not SQLALCHEMY_DATABASE_URI:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: DATABASE_URL environment variable is not set!\n"
            "Example: export DATABASE_URL='postgresql://user:pass@localhost/db'"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PGBOUNCER_MODE = os.environ.get("PGBOUNCER_MODE", "false").lower() == "true"

    if PGBOUNCER_MODE:
        _default_pool_size = int(os.environ.get("DB_POOL_SIZE", 10))
        _default_max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", 10))
        _default_read_pool_size = int(os.environ.get("DB_READ_POOL_SIZE", 8))
        _default_read_max_overflow = int(os.environ.get("DB_READ_MAX_OVERFLOW", 8))
    else:
        _default_pool_size = int(os.environ.get("DB_POOL_SIZE", 30))
        _default_max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", 50))
        _default_read_pool_size = int(os.environ.get("DB_READ_POOL_SIZE", 20))
        _default_read_max_overflow = int(os.environ.get("DB_READ_MAX_OVERFLOW", 30))

    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": _default_pool_size,
        "pool_recycle": int(os.environ.get("DB_POOL_RECYCLE", 3600)),
        "pool_pre_ping": True,
        "max_overflow": _default_max_overflow,
        "pool_timeout": int(os.environ.get("DB_POOL_TIMEOUT", 10)),
        "echo": False,
        "connect_args": {
            "client_encoding": "utf8",
            "options": "-c timezone=utc -c statement_timeout=5000 -c idle_in_transaction_session_timeout=5000",
        },
    }

    SQLALCHEMY_DATABASE_READ_URI = os.environ.get("DATABASE_READ_REPLICA_URL", None)
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

    SQLALCHEMY_BINDS = {}
    if SQLALCHEMY_DATABASE_READ_URI:
        SQLALCHEMY_BINDS['read'] = SQLALCHEMY_DATABASE_READ_URI

    # JWT & Authentication
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        error_msg = "CRITICAL SECURITY ERROR: JWT_SECRET_KEY environment variable is not set!"
        if IS_PRODUCTION:
            raise RuntimeError(f"{error_msg}\nIn production mode, the application MUST fail if secrets are missing.")
        else:
            raise RuntimeError(error_msg)

    JWT_ACCESS_TOKEN_EXPIRES = 604800
    JWT_TOKEN_LOCATION = ["cookies", "headers"]
    JWT_COOKIE_SECURE = FLASK_ENV == "production"
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_ACCESS_COOKIE_NAME = "access_token_cookie"
    JWT_REFRESH_COOKIE_NAME = "refresh_token_cookie"
    JWT_COOKIE_DOMAIN = os.environ.get("JWT_COOKIE_DOMAIN", None)

    # CSRF
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600
    WTF_CSRF_SSL_STRICT = FLASK_ENV == "production"

    # Redis - Cache Instance
    REDIS_CACHE_HOST = os.environ.get("REDIS_CACHE_HOST", os.environ.get("REDIS_HOST", "127.0.0.1"))
    REDIS_CACHE_PORT = int(os.environ.get("REDIS_CACHE_PORT", os.environ.get("REDIS_PORT", 6379)))
    REDIS_CACHE_DB = int(os.environ.get("REDIS_CACHE_DB", 0))
    REDIS_CACHE_PASSWORD = os.environ.get("REDIS_CACHE_PASSWORD", os.environ.get("REDIS_PASSWORD", None))
    
    REDIS_CACHE_SSL = os.environ.get("REDIS_CACHE_SSL", "false").lower() == "true"
    REDIS_CACHE_SSL_CERT_REQS = os.environ.get("REDIS_CACHE_SSL_CERT_REQS", "required")
    REDIS_CACHE_SSL_CA_CERTS = os.environ.get("REDIS_CACHE_SSL_CA_CERTS", None)

    REDIS_CACHE_MODE = os.environ.get("REDIS_CACHE_MODE", "standalone").lower()
    REDIS_CACHE_CLUSTER_NODES = os.environ.get("REDIS_CACHE_CLUSTER_NODES", None)
    REDIS_CACHE_SENTINEL_HOSTS = os.environ.get("REDIS_CACHE_SENTINEL_HOSTS", None)
    REDIS_CACHE_SENTINEL_MASTER = os.environ.get("REDIS_CACHE_SENTINEL_MASTER", "mymaster")
    REDIS_CACHE_SENTINEL_PASSWORD = os.environ.get("REDIS_CACHE_SENTINEL_PASSWORD", None)

    # Redis - Persistent Instance
    REDIS_PERSISTENT_HOST = os.environ.get("REDIS_PERSISTENT_HOST", os.environ.get("REDIS_HOST", "127.0.0.1"))
    REDIS_PERSISTENT_PORT = int(os.environ.get("REDIS_PERSISTENT_PORT", os.environ.get("REDIS_PORT", 6379)))
    REDIS_PERSISTENT_DB = int(os.environ.get("REDIS_PERSISTENT_DB", 0))
    REDIS_PERSISTENT_PASSWORD = os.environ.get("REDIS_PERSISTENT_PASSWORD", os.environ.get("REDIS_PASSWORD", None))

    REDIS_PERSISTENT_SSL = os.environ.get("REDIS_PERSISTENT_SSL", "false").lower() == "true"
    REDIS_PERSISTENT_SSL_CERT_REQS = os.environ.get("REDIS_PERSISTENT_SSL_CERT_REQS", "required")
    REDIS_PERSISTENT_SSL_CA_CERTS = os.environ.get("REDIS_PERSISTENT_SSL_CA_CERTS", None)

    REDIS_PERSISTENT_MODE = os.environ.get("REDIS_PERSISTENT_MODE", "standalone").lower()
    REDIS_PERSISTENT_CLUSTER_NODES = os.environ.get("REDIS_PERSISTENT_CLUSTER_NODES", None)
    REDIS_PERSISTENT_SENTINEL_HOSTS = os.environ.get("REDIS_PERSISTENT_SENTINEL_HOSTS", None)
    REDIS_PERSISTENT_SENTINEL_MASTER = os.environ.get("REDIS_PERSISTENT_SENTINEL_MASTER", "mymaster")
    REDIS_PERSISTENT_SENTINEL_PASSWORD = os.environ.get("REDIS_PERSISTENT_SENTINEL_PASSWORD", None)

    REDIS_INTEGRITY_ENABLED = os.environ.get("REDIS_INTEGRITY_ENABLED", "false").lower() == "true"

    # Generic Redis (mapping to Persistent)
    REDIS_HOST = REDIS_PERSISTENT_HOST
    REDIS_PORT = REDIS_PERSISTENT_PORT
    REDIS_DB = REDIS_PERSISTENT_DB
    REDIS_PASSWORD = REDIS_PERSISTENT_PASSWORD

    # Redis DB Indexes
    REDIS_DB_SESSIONS = int(os.environ.get("REDIS_DB_SESSIONS", 0))
    REDIS_DB_RATE_LIMIT = int(os.environ.get("REDIS_DB_RATE_LIMIT", 1))
    REDIS_DB_DYNAMIC_CONFIG = int(os.environ.get("REDIS_DB_DYNAMIC_CONFIG", 2))
    REDIS_DB_ANALYTICS = int(os.environ.get("REDIS_DB_ANALYTICS", 3))
    REDIS_DB_CACHE = int(os.environ.get("REDIS_DB_CACHE", 4))

    # Rate Limiting & TTLs
    if FLASK_ENV == "development":
        RATE_LIMIT = 100
        RATE_LIMIT_BURST = 50
    else:
        RATE_LIMIT = 60
        RATE_LIMIT_BURST = 10

    CHALLENGE_TTL = 120
    NONCE_TTL = int(os.environ.get("NONCE_TTL", 30))
    CANARY_TTL = int(os.environ.get("CANARY_TTL", CHALLENGE_TTL))
    PROJECT_ID_CACHE_TTL = int(os.environ.get("PROJECT_ID_CACHE_TTL", CHALLENGE_TTL))
    SUSPICIOUS_THRESHOLD = 3
    SUSPICIOUS_WINDOW = 3600
    PROGRESSIVE_DELAY = True

    # Storage & Uploads
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
            "host": REDIS_CACHE_HOST,
            "port": REDIS_CACHE_PORT,
            "db": REDIS_CACHE_DB,
            "password": REDIS_CACHE_PASSWORD,
            "cache_ttl": int(os.environ.get("STORAGE_CACHE_TTL", 3600)),
        },
    }

    AVATARS_FOLDER = os.environ.get("AVATARS_FOLDER", "uploads/avatars")
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024 * 1024
    
    ALLOWED_AVATAR_EXTENSIONS = set(
        os.environ.get("ALLOWED_AVATAR_EXTENSIONS", "png,jpg,jpeg,gif,webp").split(",")
    )
    MAX_AVATAR_SIZE = int(os.environ.get("MAX_AVATAR_SIZE", 5 * 1024 * 1024))
    MAX_AVATAR_WIDTH = int(os.environ.get("MAX_AVATAR_WIDTH", 300))
    MAX_AVATAR_HEIGHT = int(os.environ.get("MAX_AVATAR_HEIGHT", 300))
    MAX_AVATAR_DIMENSIONS = (MAX_AVATAR_WIDTH, MAX_AVATAR_HEIGHT)

    _product_extensions_str = os.environ.get(
        "ALLOWED_PRODUCT_FILE_EXTENSIONS",
        '{"logo": "png,jpg,jpeg,gif", "banner": "png,jpg,jpeg,gif", "background": "png,jpg,jpeg,gif", "file": "exe,apk,xapk,so,dmg,deb,rpm,zip,rar,7z,tar,gz,bin,iso,msi,pkg,app,dll,jar,war,ear,py,js,html,css,json,xml,txt,md,pdf,doc,docx,xls,xlsx,ppt,pptx"}'
    )
    try:
        _product_extensions_dict = json.loads(_product_extensions_str)
        ALLOWED_PRODUCT_FILE_EXTENSIONS = {
            k: set(v.split(",")) if isinstance(v, str) else set(v)
            for k, v in _product_extensions_dict.items()
        }
    except (json.JSONDecodeError, AttributeError):
        ALLOWED_PRODUCT_FILE_EXTENSIONS = {
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

    ALLOWED_LOADER_EXTENSIONS = set(
        os.environ.get("ALLOWED_LOADER_EXTENSIONS", "png,jpg,jpeg,gif,exe,apk,so,dmg,deb,rpm,zip").split(",")
    )

    # Logging & Metrics
    ENABLE_STRUCTURED_LOGGING = os.environ.get("ENABLE_STRUCTURED_LOGGING", "false").lower() == "true"
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    ENABLE_METRICS = os.environ.get("ENABLE_METRICS", "true").lower() == "true"
    METRICS_RETENTION_HOURS = int(os.environ.get("METRICS_RETENTION_HOURS", 24))

    HEALTH_CHECK_TIMEOUT = int(os.environ.get("HEALTH_CHECK_TIMEOUT", 5))
    HEALTH_CHECK_INTERVAL = int(os.environ.get("HEALTH_CHECK_INTERVAL", 30))

    # Analytics Buffer
    ANALYTICS_BUFFER_ENABLED = os.environ.get("ANALYTICS_BUFFER_ENABLED", "true").lower() == "true"
    ANALYTICS_BUFFER_MAX_SIZE = int(os.environ.get("ANALYTICS_BUFFER_MAX_SIZE", 1000))
    ANALYTICS_BUFFER_TTL = int(os.environ.get("ANALYTICS_BUFFER_TTL", 3600))
    ANALYTICS_MEMORY_QUEUE_SIZE = int(os.environ.get("ANALYTICS_MEMORY_QUEUE_SIZE", 10000))
    ANALYTICS_BUFFER_FLUSH_INTERVAL = int(os.environ.get("ANALYTICS_BUFFER_FLUSH_INTERVAL", 30))
    ANALYTICS_BUFFER_BATCH_SIZE = int(os.environ.get("ANALYTICS_BUFFER_BATCH_SIZE", 100))

    # Thresholds & Alerts
    CONNECT_WARNING_RPS = int(os.environ.get("CONNECT_WARNING_RPS", 100))
    CONNECT_CRITICAL_RPS = int(os.environ.get("CONNECT_CRITICAL_RPS", 200))
    HEARTBEAT_WARNING_RPS = int(os.environ.get("HEARTBEAT_WARNING_RPS", 500))
    HEARTBEAT_CRITICAL_RPS = int(os.environ.get("HEARTBEAT_CRITICAL_RPS", 1000))
    RESPONSE_TIME_WARNING_MS = float(os.environ.get("RESPONSE_TIME_WARNING_MS", 1000.0))
    RESPONSE_TIME_CRITICAL_MS = float(os.environ.get("RESPONSE_TIME_CRITICAL_MS", 3000.0))
    ERROR_RATE_WARNING_PCT = float(os.environ.get("ERROR_RATE_WARNING_PCT", 5.0))
    ERROR_RATE_CRITICAL_PCT = float(os.environ.get("ERROR_RATE_CRITICAL_PCT", 10.0))

    # CORS
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:5001,http://127.0.0.1:5001,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    PRODUCTION_CORS_ORIGINS = (
        os.environ.get("PRODUCTION_CORS_ORIGINS", "").split(",")
        if os.environ.get("PRODUCTION_CORS_ORIGINS") else []
    )
    ALL_CORS_ORIGINS = CORS_ORIGINS + [
        origin.strip() for origin in PRODUCTION_CORS_ORIGINS if origin.strip()
    ]
    TRUSTED_PROXY_IPS = [ip.strip() for ip in os.environ.get("TRUSTED_PROXY_IPS", "127.0.0.1,::1").split(",") if ip.strip()]

    # Internal Secrets
    OFFLINE_TICKET_SECRET = os.environ.get("OFFLINE_TICKET_SECRET")
    if not OFFLINE_TICKET_SECRET:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: OFFLINE_TICKET_SECRET environment variable is not set!\n"
            "Example: export OFFLINE_TICKET_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )

    TOKEN_STATIC_WORD = os.environ.get("TOKEN_STATIC_WORD")
    if not TOKEN_STATIC_WORD:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: TOKEN_STATIC_WORD environment variable is not set!\n"
            "Example: export TOKEN_STATIC_WORD=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )
    
    BOT_API_KEY = os.environ.get("BOT_API_KEY") or None

    # Websockets & Celery
    WEBSOCKET_MAX_MESSAGE_SIZE = int(os.environ.get("WEBSOCKET_MAX_MESSAGE_SIZE", 1024 * 1024))
    MTLS_REQUIRE_WSGI_VARS = os.environ.get("MTLS_REQUIRE_WSGI_VARS", "true").lower() == "true"

    CELERY_WORKER_CONFIG = {
        "server_tasks": {
            "workers": int(os.environ.get("CELERY_SERVER_TASKS_WORKERS", 3)),
            "concurrency": int(os.environ.get("CELERY_SERVER_TASKS_CONCURRENCY", 4)),
            "queues": ["server_tasks"],
            "priority": "high",
            "description": "Handles server operations (SSH: start, stop, restart, status check)",
        },
        "key_tasks": {
            "workers": int(os.environ.get("CELERY_KEY_TASKS_WORKERS", 2)),
            "concurrency": int(os.environ.get("CELERY_KEY_TASKS_CONCURRENCY", 2)),
            "queues": ["key_tasks"],
            "priority": "medium",
            "description": "Handles bulk key creation operations",
        },
        "default": {
            "workers": int(os.environ.get("CELERY_DEFAULT_WORKERS", 1)),
            "concurrency": int(os.environ.get("CELERY_DEFAULT_CONCURRENCY", 4)),
            "queues": ["default"],
            "priority": "low",
            "description": "Handles general/default tasks",
        },
    }

    # Mail
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USE_SSL = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_FROM = os.environ.get("MAIL_FROM", MAIL_USERNAME)
    MAIL_FROM_NAME = os.environ.get("MAIL_FROM_NAME", "Panel")
    
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")