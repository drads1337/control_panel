"""
Redis Client Utility
Centralized Redis connection management to eliminate code duplication.

This module provides a singleton Redis client instance that should be used
throughout the application to avoid creating multiple connections and ensure
consistent configuration.

Usage:
    from ..utils.redis_client import get_redis_client

    redis_client = get_redis_client()
    redis_client.set("key", "value")
    value = redis_client.get("key")
"""

import json
import logging
from typing import Any, Dict, Optional

import redis

from ..config.config import Config

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
    """

    def __init__(self):
        self._client = None

    def _create_client(self) -> redis.Redis:
        """
        Create a new Redis client with optimized settings.

        Returns:
            Configured Redis client instance

        Raises:
            RuntimeError: If Redis connection cannot be established
        """
        redis_config = {
            "host": Config.REDIS_HOST,
            "port": Config.REDIS_PORT,
            "db": Config.REDIS_DB,
            "decode_responses": True,
            "socket_connect_timeout": 5,
            "socket_timeout": 5,
            "retry_on_timeout": True,
            "health_check_interval": 30,
            "max_connections": 20,
        }

        if Config.REDIS_PASSWORD:
            redis_config["password"] = Config.REDIS_PASSWORD

        client = redis.Redis(**redis_config)

        try:
            client.ping()
            logger.debug("Redis client initialized successfully")
        except Exception as e:
            logger.error(f"Redis connection verification failed: {e}")
            raise RuntimeError(f"Redis is required but connection failed: {e}")

        return client

    @property
    def client(self) -> redis.Redis:
        """
        Lazy initialization of Redis client.

        Returns:
            Redis client instance (singleton)
        """
        if self._client is None:
            self._client = self._create_client()
        return self._client

    def get(self, key: str) -> Optional[str]:
        """Get value from Redis"""
        try:
            return self.client.get(key)
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None

    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set value in Redis with optional expiration"""
        try:
            return self.client.set(key, value, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")
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

_redis_client_instance = RedisClient()

def get_redis_client() -> redis.Redis:
    """
    Get the centralized Redis client instance.

    This function provides direct access to the underlying Redis client
    for cases where the wrapper methods are not sufficient.

    Returns:
        Redis client instance (singleton, shared across the application)

    Example:
        from ..utils.redis_client import get_redis_client

        redis_client = get_redis_client()
        redis_client.pubsub()
        redis_client.ping()
    """
    return _redis_client_instance.client

redis_client = _redis_client_instance
