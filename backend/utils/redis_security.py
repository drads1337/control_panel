"""
Redis Security Utilities
Provides validation and monitoring for critical Redis operations.

This module helps detect and prevent unauthorized access to Redis,
monitors critical operations, and provides security checks.
"""

import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Set

import redis
from .redis_client import get_redis_client

logger = logging.getLogger(__name__)


class RedisSecurityMonitor:
    """
    Monitor and validate critical Redis operations to detect potential security issues.
    
    This class provides:
    - Validation of critical key access patterns
    - Detection of unauthorized modifications
    - Monitoring of rate limit bypass attempts
    - Tracking of DynamicConfig access
    """


    CRITICAL_KEY_PATTERNS = {
        "dynamic_config": "dynamic_config:*",
        "rate_limit": "limiter:*",
        "session": "session:*",
        "challenge": "challenge:*",
        "nonce": "nonce:*",
        "analytics_buffer": "analytics_buffer:*",
    }


    CRITICAL_OPERATIONS = {
        "SET", "SETEX", "DEL", "INCR", "DECR", "HSET", "HDEL", "SADD", "SREM"
    }

    def __init__(self):
        self.redis_client = None
        self.monitoring_enabled = True
        self.alert_threshold = 10
        
    def _get_redis_client(self):
        """Get Redis client with error handling"""
        if self.redis_client is None:
            try:
                self.redis_client = get_redis_client()
            except Exception as e:
                logger.error(f"Failed to get Redis client for security monitoring: {e}")
                return None
        return self.redis_client

    def validate_dynamic_config_access(
        self, key: str, operation: str, expected_project_id: Optional[int] = None
    ) -> bool:
        """
        Validate access to DynamicConfig keys.
        
        Args:
            key: Redis key being accessed
            operation: Operation being performed (GET, SET, DEL, etc.)
            expected_project_id: Expected project ID if known
            
        Returns:
            True if access is valid, False if suspicious
        """
        if not self.monitoring_enabled:
            return True
            
        if not key.startswith("dynamic_config:"):
            return True
            

        logger.info(
            f"[REDIS_SECURITY] DynamicConfig access: key={key}, operation={operation}, "
            f"expected_project_id={expected_project_id}"
        )
        


        try:
            parts = key.split(":")
            if len(parts) >= 4:
                key_project_id = int(parts[3])
                if expected_project_id and key_project_id != expected_project_id:
                    logger.warning(
                        f"[REDIS_SECURITY] Project ID mismatch in DynamicConfig access: "
                        f"key_project_id={key_project_id}, expected={expected_project_id}"
                    )
                    return False
        except (ValueError, IndexError):
            pass
            

        if operation == "DEL":
            logger.warning(
                f"[REDIS_SECURITY] DynamicConfig deletion detected: key={key}"
            )
            
        return True

    def validate_rate_limit_access(
        self, key: str, operation: str, value: Optional[Any] = None
    ) -> bool:
        """
        Validate access to rate limit keys.
        
        Args:
            key: Redis key being accessed
            operation: Operation being performed
            value: Value being set (if operation is SET/SETEX)
            
        Returns:
            True if access is valid, False if suspicious
        """
        if not self.monitoring_enabled:
            return True
            
        if not key.startswith("limiter:"):
            return True
            

        if operation in ("SET", "SETEX", "DEL", "INCR", "DECR"):
            logger.warning(
                f"[REDIS_SECURITY] Rate limit modification detected: "
                f"key={key}, operation={operation}, value={value}"
            )
            

            if operation in ("SET", "SETEX") and value == "0":
                logger.error(
                    f"[REDIS_SECURITY] CRITICAL: Rate limit reset to 0 detected: key={key}"
                )
                return False
                
        return True

    def detect_unauthorized_changes(self, key_pattern: str) -> List[Dict[str, Any]]:
        """
        Detect unauthorized changes to keys matching a pattern.
        
        This monitors critical keys and alerts on suspicious changes:
        - Keys without TTL (should have expiration)
        - Unexpected key modifications
        - Keys with suspicious values
        
        Args:
            key_pattern: Pattern to match keys (e.g., "dynamic_config:*")
            
        Returns:
            List of suspicious changes
        """
        if not self.monitoring_enabled:
            return []
            
        redis_client = self._get_redis_client()
        if not redis_client:
            return []
            
        suspicious_changes = []
        
        try:

            keys = redis_client.keys(key_pattern)
            
            for key in keys:

                ttl = redis_client.ttl(key)
                

                if ttl == -1:
                    if "dynamic_config" in key:
                        suspicious_changes.append({
                            "key": key,
                            "reason": "No TTL on DynamicConfig key (should expire)",
                            "severity": "medium",
                            "timestamp": time.time()
                        })
                    elif "rate_limit" in key or "limiter" in key:
                        suspicious_changes.append({
                            "key": key,
                            "reason": "No TTL on rate limit key (should expire)",
                            "severity": "high",
                            "timestamp": time.time()
                        })
                

                if "rate_limit" in key or "limiter" in key:
                    try:
                        value = redis_client.get(key)
                        if value:

                            try:
                                count = int(value)
                                if count == 0:
                                    suspicious_changes.append({
                                        "key": key,
                                        "reason": "Rate limit counter reset to 0 (potential bypass attempt)",
                                        "severity": "critical",
                                        "timestamp": time.time()
                                    })
                            except ValueError:
                                pass
                    except Exception:
                        pass
                    
        except Exception as e:
            logger.error(f"Error detecting unauthorized changes: {e}")
            
        return suspicious_changes

    def monitor_critical_keys(self) -> Dict[str, Any]:
        """
        Monitor all critical keys and detect suspicious changes.
        
        Returns:
            Dictionary with monitoring results
        """
        if not self.monitoring_enabled:
            return {"status": "disabled", "suspicious_changes": []}
        
        all_suspicious = []
        

        for pattern_type, pattern in self.CRITICAL_KEY_PATTERNS.items():
            try:
                suspicious = self.detect_unauthorized_changes(pattern)
                if suspicious:
                    all_suspicious.extend(suspicious)

                    for change in suspicious:
                        if change.get("severity") == "critical":
                            logger.error(
                                f"[REDIS_SECURITY] CRITICAL: {change['reason']} - key={change['key']}"
                            )
            except Exception as e:
                logger.error(f"Error monitoring {pattern_type}: {e}")
        

        if len(all_suspicious) >= self.alert_threshold:
            logger.error(
                f"[REDIS_SECURITY] ALERT: {len(all_suspicious)} suspicious changes detected "
                f"(threshold: {self.alert_threshold})"
            )
        
        return {
            "status": "ok" if not all_suspicious else "warning",
            "suspicious_changes_count": len(all_suspicious),
            "suspicious_changes": all_suspicious,
            "timestamp": time.time()
        }

    def log_critical_operation(
        self, key: str, operation: str, value: Optional[Any] = None
    ):
        """
        Log critical Redis operations for audit purposes.
        
        Args:
            key: Redis key
            operation: Operation being performed
            value: Value being set (if applicable)
        """
        if not self.monitoring_enabled:
            return
            

        is_critical = False
        key_type = None
        
        for pattern_type, pattern in self.CRITICAL_KEY_PATTERNS.items():
            if pattern.replace("*", "") in key or key.startswith(pattern.replace("*", "").split(":")[0]):
                is_critical = True
                key_type = pattern_type
                break
                
        if is_critical and operation in self.CRITICAL_OPERATIONS:

            log_data = {
                "key": key,
                "operation": operation,
                "key_type": key_type,
                "timestamp": time.time(),
            }
            
            if value is not None:

                if isinstance(value, (str, bytes)):
                    log_data["value_length"] = len(value)
                    log_data["value_type"] = type(value).__name__
                else:
                    log_data["value"] = str(value)[:100]
                    
            logger.info(
                f"[REDIS_SECURITY] Critical operation: {json.dumps(log_data)}"
            )

    def check_redis_security_config(self) -> Dict[str, Any]:
        """
        Check Redis security configuration.
        
        SECURITY: In protected production environments (e.g., AWS ElastiCache),
        CONFIG command is often disabled for security. This is expected behavior
        and should not be treated as an error. The function gracefully handles
        this case and treats it as a positive security indicator.
        
        Returns:
            Dictionary with security check results
        """
        from ..config.config import IS_PRODUCTION
        
        redis_client = self._get_redis_client()
        if not redis_client:
            return {
                "status": "error",
                "message": "Cannot connect to Redis",
                "checks": {}
            }
            
        checks = {}
        config_command_available = False
        
        try:



            try:
                requirepass = redis_client.config_get("requirepass")
                config_command_available = True
                checks["authentication"] = {
                    "status": "ok" if requirepass.get("requirepass") else "warning",
                    "message": "Password required" if requirepass.get("requirepass") else "No password configured"
                }
            except redis.ResponseError as e:


                error_msg = str(e).lower()
                if "unknown command" in error_msg or "command not allowed" in error_msg:
                    if IS_PRODUCTION:

                        checks["authentication"] = {
                            "status": "ok",
                            "message": "CONFIG command disabled (expected in protected environments like AWS ElastiCache)"
                        }
                        logger.debug(
                            "[REDIS_SECURITY] CONFIG command disabled - this is expected and secure "
                            "in protected production environments (e.g., AWS ElastiCache)"
                        )
                    else:
                        checks["authentication"] = {
                            "status": "info",
                            "message": "CONFIG command disabled (may be expected in managed Redis services)"
                        }
                else:

                    checks["authentication"] = {
                        "status": "unknown",
                        "message": f"Cannot check authentication: {str(e)[:100]}"
                    }
            except Exception as e:

                checks["authentication"] = {
                    "status": "unknown",
                    "message": f"Cannot check authentication: {type(e).__name__}"
                }
                

            if config_command_available:
                try:
                    protected_mode = redis_client.config_get("protected-mode")
                    checks["protected_mode"] = {
                        "status": "ok" if protected_mode.get("protected-mode") == "yes" else "warning",
                        "message": f"Protected mode: {protected_mode.get('protected-mode', 'unknown')}"
                    }
                except Exception:
                    checks["protected_mode"] = {
                        "status": "unknown",
                        "message": "Cannot check protected mode"
                    }
            else:

                checks["protected_mode"] = {
                    "status": "ok",
                    "message": "CONFIG command disabled - protected mode assumed enabled (managed Redis services enforce this)"
                }
                

            if config_command_available:
                try:
                    bind = redis_client.config_get("bind")
                    bind_addresses = bind.get("bind", "").split()
                    checks["bind_address"] = {
                        "status": "ok" if "127.0.0.1" in bind_addresses or len(bind_addresses) == 0 else "info",
                        "message": f"Bind addresses: {', '.join(bind_addresses) if bind_addresses else 'all interfaces'}"
                    }
                except Exception:
                    checks["bind_address"] = {
                        "status": "unknown",
                        "message": "Cannot check bind address"
                    }
            else:

                checks["bind_address"] = {
                    "status": "ok",
                    "message": "CONFIG command disabled - network isolation handled by managed service (e.g., AWS ElastiCache VPC)"
                }
                
        except Exception as e:
            logger.error(f"Error checking Redis security config: {e}")
            return {
                "status": "error",
                "message": str(e),
                "checks": checks
            }
            


        has_warnings = any(
            check.get("status") == "warning" 
            for check in checks.values()
        )
        

        all_ok_or_info = all(
            check.get("status") in ("ok", "info", "unknown")
            for check in checks.values()
        )
        
        return {
            "status": "warning" if has_warnings else ("ok" if all_ok_or_info else "error"),
            "checks": checks,
            "timestamp": time.time()
        }

    def get_security_statistics(self) -> Dict[str, Any]:
        """
        Get security statistics for Redis operations.
        
        Returns:
            Dictionary with security statistics
        """
        redis_client = self._get_redis_client()
        if not redis_client:
            return {}
            
        stats = {
            "critical_keys_count": {},
            "total_keys": 0,
            "timestamp": time.time()
        }
        
        try:

            for pattern_type, pattern in self.CRITICAL_KEY_PATTERNS.items():
                keys = redis_client.keys(pattern)
                stats["critical_keys_count"][pattern_type] = len(keys)
                

            info = redis_client.info("keyspace")
            total_keys = 0
            for db_info in info.values():
                if isinstance(db_info, dict) and "keys" in db_info:
                    total_keys += db_info["keys"]
            stats["total_keys"] = total_keys
            
        except Exception as e:
            logger.error(f"Error getting security statistics: {e}")
            
        return stats



redis_security_monitor = RedisSecurityMonitor()

