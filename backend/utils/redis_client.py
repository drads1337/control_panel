"""
Redis Client Utility
Centralized Redis connection management to eliminate code duplication.

This module provides a singleton Redis client instance that should be used
throughout the product to avoid creating multiple connections and ensure
consistent configuration.

SECURITY: Supports separate Redis databases for different data types to reduce
blast radius if one database is compromised.

RELIABILITY: Supports separate Redis instances for different data types:
- Cache instance (non-persistent): Used for cache data that can be lost
- Persistent instance: Used for sessions, queues, rate limiting, and other critical data

The module now uses Flask extensions when available (preferred), falling back
to a singleton instance when used outside Flask product context.

HIGH AVAILABILITY: 
- Automatic health checking and reconnection
- Graceful degradation when Redis is unavailable
- Support for fallback mechanisms (disk, database) for critical operations

Usage:
    from ..utils.redis_client import get_redis_client, get_redis_client_for_db, get_redis_cache_client

    # Default client (uses persistent instance - backward compatibility)
    redis_client = get_redis_client()
    redis_client.set("key", "value")
    
    # Cache client (non-persistent instance)
    cache_client = get_redis_cache_client()
    cache_client.set("cache:key", "value", ex=3600)
    
    # Client for specific database (recommended)
    # Automatically uses correct instance (cache for cache, persistent for others)
    dynamic_config_client = get_redis_client_for_db("dynamic_config")
    dynamic_config_client.set("config:key", "value")
    
    cache_db_client = get_redis_client_for_db("cache")
    cache_db_client.set("cache:key", "value")
"""

import json
import logging
import threading
import time
from typing import Any, Callable, Dict, Optional

import redis
from flask import current_app, has_app_context

from ..config.config import Config, IS_PRODUCTION

logger = logging.getLogger(__name__)

class RedisClient:
    """
    Centralized Redis client with common operations.

    This class provides a singleton Redis client instance with optimized
    connection settings for production use:
    - Connection timeouts to prevent hanging connections
    - Retry on timeout for resilience
    - Health check interval for connection monitoring
    - Connection pooling for performance
    - Support for different Redis databases for security isolation
    - Support for separate cache and persistent Redis instances
    - Automatic health checking and reconnection
    - Graceful degradation when Redis is unavailable
    """

    def __init__(self, db: Optional[int] = None, instance: str = "persistent"):
        """
        Initialize Redis client.
        
        Args:
            db: Redis database number (None uses default from Config)
            instance: Redis instance type - "cache" (non-persistent) or "persistent" (default)
        """
        self._client = None
        self._db = db
        self._instance = instance
        self._is_available = True
        self._last_health_check = 0
        self._health_check_interval = 30
        self._consecutive_failures = 0
        self._max_consecutive_failures = 3
        self._lock = threading.RLock()

    def _create_client(self, db: Optional[int] = None, instance: Optional[str] = None) -> redis.Redis:
        """
        Create a new Redis client with optimized settings.

        Args:
            db: Redis database number (None uses default from Config)
            instance: Redis instance type - "cache" or "persistent" (uses self._instance if None)

        Returns:
            Configured Redis client instance

        Raises:
            RuntimeError: If Redis connection cannot be established
        """

        instance_type = instance if instance is not None else self._instance
        
        if instance_type == "cache":
            host = Config.REDIS_CACHE_HOST
            port = Config.REDIS_CACHE_PORT
            password = Config.REDIS_CACHE_PASSWORD
            default_db = Config.REDIS_CACHE_DB
        else:
            host = Config.REDIS_PERSISTENT_HOST
            port = Config.REDIS_PERSISTENT_PORT
            password = Config.REDIS_PERSISTENT_PASSWORD
            default_db = Config.REDIS_PERSISTENT_DB
        

        db_number = db if db is not None else (self._db if self._db is not None else default_db)
        
        redis_config = {
            "host": host,
            "port": port,
            "db": db_number,
            "decode_responses": True,
            "socket_connect_timeout": 5,
            "socket_timeout": 5,
            "retry_on_timeout": True,
            "health_check_interval": 30,
            "max_connections": 20,
        }


        if password:
            redis_config["password"] = password
        else:

            if instance_type == "persistent":
                logger.warning(
                    "[REDIS_SECURITY] Redis persistent instance has no password configured. "
                    "This is a security risk in production. Set REDIS_PERSISTENT_PASSWORD environment variable."
                )



        if instance_type == "cache":
            ssl_enabled = Config.REDIS_CACHE_SSL
            ssl_cert_reqs = Config.REDIS_CACHE_SSL_CERT_REQS
            ssl_ca_certs = Config.REDIS_CACHE_SSL_CA_CERTS
        else:
            ssl_enabled = Config.REDIS_PERSISTENT_SSL
            ssl_cert_reqs = Config.REDIS_PERSISTENT_SSL_CERT_REQS
            ssl_ca_certs = Config.REDIS_PERSISTENT_SSL_CA_CERTS
        
        if ssl_enabled:

            import ssl
            cert_reqs_map = {
                "none": ssl.CERT_NONE,
                "optional": ssl.CERT_OPTIONAL,
                "required": ssl.CERT_REQUIRED,
            }
            cert_reqs = cert_reqs_map.get(ssl_cert_reqs.lower(), ssl.CERT_REQUIRED)
            
            redis_config["ssl"] = True
            redis_config["ssl_cert_reqs"] = cert_reqs
            if ssl_ca_certs:
                redis_config["ssl_ca_certs"] = ssl_ca_certs
            
            logger.info(
                f"[REDIS_SECURITY] TLS enabled for Redis {instance_type} instance "
                f"(cert_reqs={ssl_cert_reqs})"
            )
        elif instance_type == "persistent" and IS_PRODUCTION:

            logger.warning(
                "[REDIS_SECURITY] Redis persistent instance TLS is not enabled in production. "
                "This is a security risk. Set REDIS_PERSISTENT_SSL=true to enable encrypted connections. "
                "Redis contains sensitive data (sessions, tokens, encrypted configs)."
            )

        client = redis.Redis(**redis_config)

        try:
            client.ping()
            logger.debug(f"Redis client initialized successfully ({instance_type} instance, DB {db_number})")
        except Exception as e:
            logger.error(f"Redis connection verification failed ({instance_type} instance, DB {db_number}): {e}")
            raise RuntimeError(f"Redis is required but connection failed ({instance_type} instance, DB {db_number}): {e}")

        return client

    def _check_health(self) -> bool:
        """
        Check Redis health and update availability status.
        
        Returns:
            True if Redis is available, False otherwise
        """
        current_time = time.time()
        

        if current_time - self._last_health_check < self._health_check_interval:
            return self._is_available
        
        with self._lock:
            self._last_health_check = current_time
            
            if self._client is None:
                try:
                    self._client = self._create_client(self._db, self._instance)
                    self._is_available = True
                    self._consecutive_failures = 0
                    return True
                except Exception as e:
                    logger.debug(f"Redis health check failed (client creation): {e}")
                    self._is_available = False
                    self._consecutive_failures += 1
                    return False
            
            try:
                self._client.ping()
                if not self._is_available:
                    logger.info(f"Redis recovered after {self._consecutive_failures} failures")
                self._is_available = True
                self._consecutive_failures = 0
                return True
            except Exception as e:
                logger.debug(f"Redis health check failed (ping): {e}")
                self._consecutive_failures += 1
                

                if self._consecutive_failures >= self._max_consecutive_failures:
                    if self._is_available:
                        logger.warning(
                            f"Redis marked as unavailable after {self._consecutive_failures} "
                            f"consecutive failures. Instance: {self._instance}"
                        )
                    self._is_available = False

                    try:
                        self._client = None
                    except Exception:
                        pass
                
                return False

    @property
    def client(self) -> redis.Redis:
        """
        Lazy initialization of Redis client with health checking.

        Returns:
            Redis client instance (singleton)
        """

        self._check_health()
        
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = self._create_client(self._db, self._instance)
        return self._client
    
    def is_available(self) -> bool:
        """
        Check if Redis is currently available.
        
        Returns:
            True if Redis is available, False otherwise
        """
        return self._check_health()

    def get(self, key: str, fallback: Optional[Callable[[], Optional[str]]] = None) -> Optional[str]:
        """
        Get value from Redis with optional fallback.
        
        Args:
            key: Redis key
            fallback: Optional fallback function to call if Redis fails
            
        Returns:
            Value from Redis, or result of fallback function, or None
        """
        if not self.is_available():
            if fallback:
                try:
                    return fallback()
                except Exception as e:
                    logger.debug(f"Fallback function failed for key {key}: {e}")
            return None
        
        try:
            return self.client.get(key)
        except Exception as e:
            logger.debug(f"Redis GET error for key {key}: {e}")
            self._is_available = False
            self._consecutive_failures += 1
            
            if fallback:
                try:
                    return fallback()
                except Exception as e:
                    logger.debug(f"Fallback function failed for key {key}: {e}")
            return None

    def set(self, key: str, value: str, ex: Optional[int] = None, 
             fallback: Optional[Callable[[], bool]] = None) -> bool:
        """
        Set value in Redis with optional expiration and fallback.
        
        Args:
            key: Redis key
            value: Value to set
            ex: Optional expiration time in seconds
            fallback: Optional fallback function to call if Redis fails
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_available():
            if fallback:
                try:
                    return fallback()
                except Exception as e:
                    logger.debug(f"Fallback function failed for key {key}: {e}")
            return False
        
        try:
            return bool(self.client.set(key, value, ex=ex))
        except Exception as e:
            logger.debug(f"Redis SET error for key {key}: {e}")
            self._is_available = False
            self._consecutive_failures += 1
            
            if fallback:
                try:
                    return fallback()
                except Exception as e:
                    logger.debug(f"Fallback function failed for key {key}: {e}")
            return False

    def setex(self, key: str, time: int, value: str) -> bool:
        """Set value with expiration time"""
        try:
            return self.client.setex(key, time, value)
        except Exception as e:
            logger.error(f"Redis SETEX error for key {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from Redis"""
        try:
            return bool(self.client.delete(key))
        except Exception as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")
            return False

    def incr(self, key: str) -> int:
        """Increment counter in Redis"""
        try:
            result = self.client.incr(key)

            if hasattr(result, "__await__") or hasattr(result, "__iter__"):
                return 0
            return int(result) if result else 0
        except Exception as e:
            logger.error(f"Redis INCR error for key {key}: {e}")
            return 0

    def expire(self, key: str, time: int) -> bool:
        """Set expiration for key"""
        try:
            return self.client.expire(key, time)
        except Exception as e:
            logger.error(f"Redis EXPIRE error for key {key}: {e}")
            return False

    def pipeline(self):
        """Get Redis pipeline for batch operations"""
        return self.client.pipeline()

    def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """Get JSON value from Redis"""
        value = self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                logger.error(f"JSON decode error for key {key}")
        return None

    def set_json(self, key: str, value: Dict[str, Any], ex: Optional[int] = None) -> bool:
        """Set JSON value in Redis"""
        try:
            json_value = json.dumps(value)
            return self.set(key, json_value, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET JSON error for key {key}: {e}")
            return False

    def scan(
        self, cursor: int = 0, match: Optional[str] = None, count: Optional[int] = None
    ) -> tuple:
        """Scan Redis keys with pattern matching"""
        try:
            kwargs = {}
            if match:
                kwargs["match"] = match
            if count:
                kwargs["count"] = count

            result = self.client.scan(cursor, **kwargs)
            return result
        except Exception as e:
            logger.error(f"Redis SCAN error: {e}")
            return (0, [])

    def keys(self, pattern: str) -> list:
        """Get all keys matching pattern"""
        try:
            return self.client.keys(pattern)
        except Exception as e:
            logger.error(f"Redis KEYS error for pattern {pattern}: {e}")
            return []


_redis_client_instance = RedisClient(instance="persistent")

def get_redis_client() -> redis.Redis:
    """
    Get the centralized Redis client instance.

    This function provides direct access to the underlying Redis client.
    It prefers Flask extension when available, falling back to singleton instance.

    Returns:
        Redis client instance (from Flask extension if available, otherwise singleton)

    Example:
        from ..utils.redis_client import get_redis_client

        redis_client = get_redis_client()
        redis_client.pubsub()
        redis_client.ping()
    """

    if has_app_context():
        try:
            redis_extension = current_app.extensions.get("redis")
            if redis_extension:
                return redis_extension.client
        except (AttributeError, RuntimeError):

            pass


    return _redis_client_instance.client

def get_redis_wrapper() -> RedisClient:
    """
    Get the RedisClient wrapper instance.

    This function provides access to the wrapper class with convenience methods.
    It prefers Flask extension when available, falling back to singleton instance.

    Returns:
        RedisClient wrapper instance (persistent instance by default)
    """

    if has_app_context():
        try:
            redis_extension = current_app.extensions.get("redis")
            if redis_extension:

                class ExtensionWrapper(RedisClient):
                    @property
                    def client(self) -> redis.Redis:
                        return redis_extension.client

                return ExtensionWrapper()
        except (AttributeError, RuntimeError):

            pass


    return _redis_client_instance

def get_redis_cache_client() -> redis.Redis:
    """
    Get Redis client for cache instance (non-persistent).
    
    This instance is used for cache data that can be lost without impact.
    The cache instance should be configured without persistence (no AOF/RDB).
    
    Returns:
        Redis client instance for cache
        
    Example:
        from ..utils.redis_client import get_redis_cache_client
        
        cache_client = get_redis_cache_client()
        cache_client.set("cache:key", "value", ex=3600)
    """
    cache_client = RedisClient(instance="cache")
    return cache_client.client


redis_client = get_redis_wrapper()




REDIS_DB_MAPPING = {
    "sessions": {"db": Config.REDIS_DB_SESSIONS, "instance": "persistent"},
    "rate_limit": {"db": Config.REDIS_DB_RATE_LIMIT, "instance": "persistent"},
    "dynamic_config": {"db": Config.REDIS_DB_DYNAMIC_CONFIG, "instance": "persistent"},
    "analytics": {"db": Config.REDIS_DB_ANALYTICS, "instance": "persistent"},
    "cache": {"db": Config.REDIS_DB_CACHE, "instance": "cache"},
}


_db_clients: Dict[str, RedisClient] = {}

def get_redis_client_for_db(db_type: str) -> redis.Redis:
    """
    Get Redis client for a specific database type.
    
    SECURITY: This allows isolation of different data types in separate
    Redis databases, reducing blast radius if one database is compromised.
    
    Cache-related data uses the cache instance (non-persistent),
    while sessions, queues, and other critical data use the persistent instance.
    
    Args:
        db_type: Type of database ("sessions", "rate_limit", "dynamic_config", 
                 "analytics", "cache")
    
    Returns:
        Redis client instance for the specified database type
    
    Example:
        from ..utils.redis_client import get_redis_client_for_db
        
        dynamic_config_client = get_redis_client_for_db("dynamic_config")
        dynamic_config_client.set("config:key", "value")
        
        cache_client = get_redis_client_for_db("cache")
        cache_client.set("cache:key", "value")
    """
    if db_type not in REDIS_DB_MAPPING:
        logger.warning(
            f"Unknown Redis DB type: {db_type}, using default. "
            f"Available types: {list(REDIS_DB_MAPPING.keys())}"
        )
        return get_redis_client()
    

    if db_type not in _db_clients:
        db_config = REDIS_DB_MAPPING[db_type]
        _db_clients[db_type] = RedisClient(db=db_config["db"], instance=db_config["instance"])
    
    return _db_clients[db_type].client
