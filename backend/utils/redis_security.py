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

    # Critical key patterns that should be monitored
    CRITICAL_KEY_PATTERNS = {
        "dynamic_config": "dynamic_config:*",
        "rate_limit": "limiter:*",
        "session": "session:*",
        "challenge": "challenge:*",
        "nonce": "nonce:*",
        "analytics_buffer": "analytics_buffer:*",
    }

    # Operations that should be logged
    CRITICAL_OPERATIONS = {
        "SET", "SETEX", "DEL", "INCR", "DECR", "HSET", "HDEL", "SADD", "SREM"
    }

    def __init__(self):
        self.redis_client = None
        self.monitoring_enabled = True
        self.alert_threshold = 10  # Alert after N suspicious operations
        
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
            
        # Log all DynamicConfig access
        logger.info(
            f"[REDIS_SECURITY] DynamicConfig access: key={key}, operation={operation}, "
            f"expected_project_id={expected_project_id}"
        )
        
        # Extract project_id from key if possible
        # Format: dynamic_config:{user_key}:{game_name}:{project_id}
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
            
        # Alert on DELETE operations (should be rare)
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
            
        # Alert on suspicious rate limit modifications
        if operation in ("SET", "SETEX", "DEL", "INCR", "DECR"):
            logger.warning(
                f"[REDIS_SECURITY] Rate limit modification detected: "
                f"key={key}, operation={operation}, value={value}"
            )
            
            # Check if value is being reset to 0 (potential bypass attempt)
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
            # Get all keys matching pattern
            keys = redis_client.keys(key_pattern)
            
            for key in keys:
                # Check if key has been modified recently
                ttl = redis_client.ttl(key)
                
                # If key has no TTL and matches critical pattern, it might be suspicious
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
                
                # Check for suspicious values in rate limit keys
                if "rate_limit" in key or "limiter" in key:
                    try:
                        value = redis_client.get(key)
                        if value:
                            # Check if rate limit is set to 0 (potential bypass)
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
        
        # Monitor each critical key pattern
        for pattern_type, pattern in self.CRITICAL_KEY_PATTERNS.items():
            try:
                suspicious = self.detect_unauthorized_changes(pattern)
                if suspicious:
                    all_suspicious.extend(suspicious)
                    # Log critical findings immediately
                    for change in suspicious:
                        if change.get("severity") == "critical":
                            logger.error(
                                f"[REDIS_SECURITY] CRITICAL: {change['reason']} - key={change['key']}"
                            )
            except Exception as e:
                logger.error(f"Error monitoring {pattern_type}: {e}")
        
        # Alert if too many suspicious changes
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
            
        # Check if key matches any critical pattern
        is_critical = False
        key_type = None
        
        for pattern_type, pattern in self.CRITICAL_KEY_PATTERNS.items():
            if pattern.replace("*", "") in key or key.startswith(pattern.replace("*", "").split(":")[0]):
                is_critical = True
                key_type = pattern_type
                break
                
        if is_critical and operation in self.CRITICAL_OPERATIONS:
            # Log critical operation
            log_data = {
                "key": key,
                "operation": operation,
                "key_type": key_type,
                "timestamp": time.time(),
            }
            
            if value is not None:
                # Don't log full values (might be sensitive), just length/type
                if isinstance(value, (str, bytes)):
                    log_data["value_length"] = len(value)
                    log_data["value_type"] = type(value).__name__
                else:
                    log_data["value"] = str(value)[:100]  # Truncate long values
                    
            logger.info(
                f"[REDIS_SECURITY] Critical operation: {json.dumps(log_data)}"
            )

    def check_redis_security_config(self) -> Dict[str, Any]:
        """
        Check Redis security configuration.
        
        Returns:
            Dictionary with security check results
        """
        redis_client = self._get_redis_client()
        if not redis_client:
            return {
                "status": "error",
                "message": "Cannot connect to Redis",
                "checks": {}
            }
            
        checks = {}
        
        try:
            # Check if authentication is required
            # Note: This requires CONFIG command access, which might be disabled
            try:
                requirepass = redis_client.config_get("requirepass")
                checks["authentication"] = {
                    "status": "ok" if requirepass.get("requirepass") else "warning",
                    "message": "Password required" if requirepass.get("requirepass") else "No password configured"
                }
            except Exception:
                checks["authentication"] = {
                    "status": "unknown",
                    "message": "Cannot check authentication (CONFIG command may be disabled)"
                }
                
            # Check protected mode
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
                
            # Check bind address
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
                
        except Exception as e:
            logger.error(f"Error checking Redis security config: {e}")
            return {
                "status": "error",
                "message": str(e),
                "checks": checks
            }
            
        # Determine overall status
        has_warnings = any(
            check.get("status") == "warning" 
            for check in checks.values()
        )
        
        return {
            "status": "warning" if has_warnings else "ok",
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
            # Count keys by pattern
            for pattern_type, pattern in self.CRITICAL_KEY_PATTERNS.items():
                keys = redis_client.keys(pattern)
                stats["critical_keys_count"][pattern_type] = len(keys)
                
            # Get total key count (approximate)
            info = redis_client.info("keyspace")
            total_keys = 0
            for db_info in info.values():
                if isinstance(db_info, dict) and "keys" in db_info:
                    total_keys += db_info["keys"]
            stats["total_keys"] = total_keys
            
        except Exception as e:
            logger.error(f"Error getting security statistics: {e}")
            
        return stats


# Global instance
redis_security_monitor = RedisSecurityMonitor()

