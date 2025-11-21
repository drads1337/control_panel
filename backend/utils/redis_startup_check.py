"""
Redis Startup Configuration Check
Validates Redis security configuration when product starts.

This module checks critical Redis security settings and warns/errors
if configuration is insecure.
"""

import logging
from typing import Dict, List, Optional

from .redis_client import get_redis_client
from .redis_security import redis_security_monitor

logger = logging.getLogger(__name__)


class RedisStartupChecker:
    """
    Check Redis security configuration at product startup.
    
    This class validates:
    - Authentication (password required)
    - Network isolation (bind address)
    - Protected mode
    - Database separation
    """

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []

    def check_all(self) -> Dict[str, any]:
        """
        Run all security checks.
        
        Returns:
            Dictionary with check results and recommendations
        """
        self.errors.clear()
        self.warnings.clear()
        self.info.clear()
        
        # Check Redis connection
        if not self._check_connection():
            return {
                "status": "error",
                "message": "Cannot connect to Redis",
                "errors": self.errors,
                "warnings": self.warnings,
                "info": self.info,
            }
        
        # Run security checks
        self._check_authentication()
        self._check_network_isolation()
        self._check_protected_mode()
        self._check_database_separation()
        
        # Determine overall status
        if self.errors:
            status = "error"
            message = "Critical security issues found"
        elif self.warnings:
            status = "warning"
            message = "Security warnings found"
        else:
            status = "ok"
            message = "All security checks passed"
        
        return {
            "status": status,
            "message": message,
            "errors": self.errors,
            "warnings": self.warnings,
            "info": self.info,
        }

    def _check_connection(self) -> bool:
        """Check if Redis is accessible"""
        try:
            client = get_redis_client()
            client.ping()
            self.info.append("Redis connection successful")
            return True
        except Exception as e:
            self.errors.append(f"Cannot connect to Redis: {e}")
            return False

    def _check_authentication(self):
        """Check if Redis requires authentication"""
        try:
            client = get_redis_client()
            # Try to get config (requires authentication if enabled)
            try:
                config = redis_security_monitor.check_redis_security_config()
                auth_check = config.get("checks", {}).get("authentication", {})
                
                status = auth_check.get("status")
                message = auth_check.get("message", "")
                
                if status == "warning":
                    self.warnings.append(
                        "Redis authentication not configured. "
                        "Set requirepass in redis.conf for production."
                    )
                elif status == "ok":
                    # Check if message indicates CONFIG is disabled (expected in managed services)
                    if "CONFIG command disabled" in message:
                        self.info.append(
                            "Redis authentication check: CONFIG command disabled "
                            "(expected in protected environments like AWS ElastiCache)"
                        )
                    else:
                        self.info.append("Redis authentication is configured")
                elif status == "info":
                    # Info status means CONFIG disabled but acceptable
                    self.info.append(f"Redis authentication: {message}")
                else:
                    self.warnings.append(
                        f"Cannot verify Redis authentication: {message or 'unknown'}"
                    )
            except Exception as e:
                # If we can't check config, it might be disabled (which is acceptable in managed services)
                from ..config.config import IS_PRODUCTION
                if IS_PRODUCTION:
                    self.info.append(
                        f"Redis authentication check: CONFIG command may be disabled "
                        "(expected in protected production environments like AWS ElastiCache). "
                        f"Error: {type(e).__name__}"
                    )
                else:
                    self.warnings.append(
                        f"Cannot check Redis authentication configuration: {e}. "
                        "CONFIG command may be disabled (good for security) or Redis may not require password."
                    )
        except Exception as e:
            self.warnings.append(f"Failed to check authentication: {e}")

    def _check_network_isolation(self):
        """Check if Redis is bound to localhost/internal network"""
        try:
            config = redis_security_monitor.check_redis_security_config()
            bind_check = config.get("checks", {}).get("bind_address", {})
            
            status = bind_check.get("status")
            message = bind_check.get("message", "")
            
            if status == "info":
                if "all interfaces" in message.lower():
                    self.warnings.append(
                        "Redis is bound to all interfaces. "
                        "For production, bind Redis to localhost or internal network only."
                    )
                else:
                    self.info.append(f"Redis bind address: {message}")
            elif status == "ok":
                # Check if message indicates CONFIG is disabled (expected in managed services)
                if "CONFIG command disabled" in message:
                    self.info.append(
                        "Redis network isolation: CONFIG command disabled "
                        "(network isolation handled by managed service, e.g., AWS ElastiCache VPC)"
                    )
                else:
                    self.info.append("Redis is bound to localhost (secure)")
            else:
                self.warnings.append(
                    f"Cannot verify Redis bind address: {message or 'unknown'}"
                )
        except Exception as e:
            self.warnings.append(f"Failed to check network isolation: {e}")

    def _check_protected_mode(self):
        """Check if Redis protected mode is enabled"""
        try:
            config = redis_security_monitor.check_redis_security_config()
            protected_check = config.get("checks", {}).get("protected_mode", {})
            
            status = protected_check.get("status")
            message = protected_check.get("message", "")
            
            if status == "warning":
                self.warnings.append(
                    "Redis protected mode is not enabled. "
                    "Enable protected-mode yes in redis.conf for production."
                )
            elif status == "ok":
                # Check if message indicates CONFIG is disabled (expected in managed services)
                if "CONFIG command disabled" in message:
                    self.info.append(
                        "Redis protected mode: CONFIG command disabled "
                        "(protected mode assumed enabled in managed Redis services)"
                    )
                else:
                    self.info.append("Redis protected mode is enabled")
            else:
                self.warnings.append(
                    f"Cannot verify Redis protected mode: {message or 'unknown'}"
                )
        except Exception as e:
            self.warnings.append(f"Failed to check protected mode: {e}")

    def _check_database_separation(self):
        """Check if database separation is configured"""
        try:
            from ..config.config import Config
            
            # Check if different DBs are configured
            dbs = {
                "sessions": Config.REDIS_DB_SESSIONS,
                "rate_limit": Config.REDIS_DB_RATE_LIMIT,
                "dynamic_config": Config.REDIS_DB_DYNAMIC_CONFIG,
                "analytics": Config.REDIS_DB_ANALYTICS,
                "cache": Config.REDIS_DB_CACHE,
            }
            
            # Check if all DBs are the same (not recommended)
            unique_dbs = set(dbs.values())
            if len(unique_dbs) == 1:
                self.warnings.append(
                    "All Redis data types use the same database. "
                    "Consider using separate databases for better security isolation. "
                    "Set REDIS_DB_* environment variables."
                )
            else:
                self.info.append(
                    f"Database separation configured: {len(unique_dbs)} different databases in use"
                )
                for db_type, db_num in dbs.items():
                    self.info.append(f"  - {db_type}: DB {db_num}")
        except Exception as e:
            self.warnings.append(f"Failed to check database separation: {e}")


def check_redis_security_on_startup() -> Dict[str, any]:
    """
    Check Redis security configuration at product startup.
    
    This function should be called during product initialization.
    It will log warnings/errors but not prevent product startup.
    
    Returns:
        Dictionary with check results
    """
    checker = RedisStartupChecker()
    results = checker.check_all()
    
    # Log results
    if results["status"] == "error":
        logger.error(
            f"Redis security check failed: {results['message']}\n"
            f"Errors: {results['errors']}"
        )
    elif results["status"] == "warning":
        logger.warning(
            f"Redis security warnings: {results['message']}\n"
            f"Warnings: {results['warnings']}"
        )
    else:
        logger.info(
            f"Redis security check passed: {results['message']}\n"
            f"Info: {results['info']}"
        )
    
    return results

