import binascii
import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

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

if len(MASTER_KEY) != 64:
    raise RuntimeError(
        f"CRITICAL SECURITY ERROR: PANEL_MASTER_KEY must be exactly 64 hex characters (32 bytes).\n"
        f"Current length: {len(MASTER_KEY)} characters.\n"
        f"Generate a new key with: python -c 'import secrets; print(secrets.token_hex(32))')"
    )

logging.debug(f"✅ Using secure master key: {MASTER_KEY[:16]}...")

class Config:

    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY environment variable is not set!\n"
            "Please set SECRET_KEY with a secure random string.\n"
            "Example: export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        )

    MASTER_KEY = MASTER_KEY

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    if not SQLALCHEMY_DATABASE_URI:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: DATABASE_URL environment variable is not set!\n"
            "Please set DATABASE_URL with your PostgreSQL connection string.\n"
            "Example: export DATABASE_URL='postgresql://username:password@localhost/database'"
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
        "pool_recycle": int(
            os.environ.get("DB_POOL_RECYCLE", 3600)
        ),
        "pool_pre_ping": True,
        "max_overflow": _default_max_overflow,
        "pool_timeout": int(
            os.environ.get("DB_POOL_TIMEOUT", 10)
        ),
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
    DEBUG = False
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024 * 1024
    JWT_ACCESS_TOKEN_EXPIRES = 604800

    JWT_TOKEN_LOCATION = ["cookies"]

    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    JWT_COOKIE_SECURE = FLASK_ENV == "production"

    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_HTTPONLY = True

    JWT_COOKIE_SAMESITE = "Lax"
    JWT_ACCESS_COOKIE_NAME = "access_token_cookie"
    JWT_REFRESH_COOKIE_NAME = "refresh_token_cookie"
    JWT_COOKIE_DOMAIN = os.environ.get("JWT_COOKIE_DOMAIN", None)

    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600

    WTF_CSRF_SSL_STRICT = FLASK_ENV == "production"

    REDIS_HOST = os.environ.get("REDIS_HOST", "127.0.0.1")
    REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
    REDIS_DB = int(os.environ.get("REDIS_DB", 0))
    REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)

    FLASK_ENV = os.environ.get("FLASK_ENV", "production")
    if FLASK_ENV == "development":
        RATE_LIMIT = 100
        RATE_LIMIT_BURST = 50
    else:
        RATE_LIMIT = 60
        RATE_LIMIT_BURST = 10

    CHALLENGE_TTL = 120
    SUSPICIOUS_THRESHOLD = 3
    SUSPICIOUS_WINDOW = 3600
    PROGRESSIVE_DELAY = True

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

    ENABLE_STRUCTURED_LOGGING = (
        os.environ.get("ENABLE_STRUCTURED_LOGGING", "false").lower() == "true"
    )
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    ENABLE_METRICS = os.environ.get("ENABLE_METRICS", "true").lower() == "true"
    METRICS_RETENTION_HOURS = int(os.environ.get("METRICS_RETENTION_HOURS", 24))

    HEALTH_CHECK_TIMEOUT = int(os.environ.get("HEALTH_CHECK_TIMEOUT", 5))
    HEALTH_CHECK_INTERVAL = int(os.environ.get("HEALTH_CHECK_INTERVAL", 30))

    SLOW_QUERY_THRESHOLD_MS = float(
        os.environ.get("SLOW_QUERY_THRESHOLD_MS", 1000.0)
    )
    ENABLE_SLOW_QUERY_MONITORING = (
        os.environ.get("ENABLE_SLOW_QUERY_MONITORING", "true").lower() == "true"
    )

    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:5001,http://127.0.0.1:5001,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")

    PRODUCTION_CORS_ORIGINS = (
        os.environ.get("PRODUCTION_CORS_ORIGINS", "").split(",")
        if os.environ.get("PRODUCTION_CORS_ORIGINS")
        else []
    )

    ALL_CORS_ORIGINS = CORS_ORIGINS + [
        origin.strip() for origin in PRODUCTION_CORS_ORIGINS if origin.strip()
    ]

    OFFLINE_TICKET_SECRET = os.environ.get("OFFLINE_TICKET_SECRET")
    if not OFFLINE_TICKET_SECRET:

        flask_env_check = os.environ.get("FLASK_ENV", "development")
        if flask_env_check == "production":
            raise RuntimeError(
                "CRITICAL SECURITY ERROR: OFFLINE_TICKET_SECRET environment variable is not set!\n"
                "In production, this must be set explicitly to prevent ticket invalidation on application restart.\n"
                "Please set OFFLINE_TICKET_SECRET with a secure random string.\n"
                "Example: export OFFLINE_TICKET_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
            )
        else:

            import secrets
            OFFLINE_TICKET_SECRET = secrets.token_urlsafe(32)
            logging.warning(
                "OFFLINE_TICKET_SECRET not set in environment. Using auto-generated secret. "
                "This is not secure for production! Please set OFFLINE_TICKET_SECRET in .env"
            )

    ALLOWED_AVATAR_EXTENSIONS = set(
        os.environ.get("ALLOWED_AVATAR_EXTENSIONS", "png,jpg,jpeg,gif,webp").split(",")
    )

    MAX_AVATAR_SIZE = int(os.environ.get("MAX_AVATAR_SIZE", 5 * 1024 * 1024))

    MAX_AVATAR_WIDTH = int(os.environ.get("MAX_AVATAR_WIDTH", 300))
    MAX_AVATAR_HEIGHT = int(os.environ.get("MAX_AVATAR_HEIGHT", 300))
    MAX_AVATAR_DIMENSIONS = (MAX_AVATAR_WIDTH, MAX_AVATAR_HEIGHT)

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

    ALLOWED_LOADER_EXTENSIONS = set(
        os.environ.get("ALLOWED_LOADER_EXTENSIONS", "png,jpg,jpeg,gif,exe,apk,so,dmg,deb,rpm").split(",")
    )

    WEBSOCKET_MAX_MESSAGE_SIZE = int(os.environ.get("WEBSOCKET_MAX_MESSAGE_SIZE", 1024 * 1024))

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
