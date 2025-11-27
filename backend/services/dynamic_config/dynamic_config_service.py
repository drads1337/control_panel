"""
Dynamic Configuration Service
Manages dynamic configuration loading for clients
Turns agents into "thin clients" that require server connection

KISS Principle: Simplified implementation - removed redundant encryption layers.
Config is encrypted only in the route handler using project-specific keys.
Redis storage uses plain JSON (Redis is already protected by network isolation).
"""

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from ...core.extensions import db
from ...models.core import Project, User
from ...models.products import FeatureConfigSchema, Product
from ...models.keys import Key

class DynamicConfigService:
    """
    Service for managing dynamic configuration for clients.
    
    KISS Principle: Simplified design - no encryption in service layer.
    Encryption is handled at route level using project-specific keys.
    Redis stores plain JSON (protected by network isolation).
    """

    def __init__(self):
        self.config_ttl = 3600
        self.redis_client = self._init_redis()
        
        # Cache stampede protection settings
        self.LOCK_TIMEOUT = 10  # seconds - max time to hold lock while generating config
        self.LOCK_RETRY_DELAY = 0.1  # seconds - initial delay between retries
        self.LOCK_MAX_RETRIES = 20  # max retries when waiting for another process to generate config
        self.LOCK_WAIT_TIMEOUT = 5  # seconds - max time to wait for another process

    def _init_redis(self):
        """
        Initialize Redis client for configuration storage.
        
        KISS Principle: Simplified Redis initialization.
        Uses separate Redis database for isolation, but no encryption at this layer.
        Encryption is handled at route level using project-specific keys.
        
        FALLBACK: If Redis is unavailable, the service will still function but
        without caching (configs will be generated on-the-fly for each request).
        """
        try:
            # Use separate DB for dynamic config isolation
            from ...utils.redis_client import get_redis_client_for_db
            
            try:
                client = get_redis_client_for_db("dynamic_config")
                client.ping()
                logging.info("Dynamic Config Redis client initialized (separate DB)")
                return client
            except Exception as db_error:
                logging.warning(
                    f"Failed to connect to dynamic_config DB, falling back to default: {db_error}"
                )
                # Fallback to default DB for backward compatibility
                from ...utils.redis_client import get_redis_client
                client = get_redis_client()
                client.ping()
                return client
        except Exception as e:
            logging.error(f"Dynamic Config Redis initialization failed: {e}")
            # Don't raise exception - allow fallback to on-the-fly generation
            # This prevents Redis from being a single point of failure
            logging.warning(
                "Redis unavailable for DynamicConfig. Service will work without caching. "
                "Configs will be generated on-the-fly for each request."
            )
            return None  # Return None to indicate Redis is unavailable

    def generate_dynamic_config(self, user_key: str, product_name: str, project_id: int) -> Dict:
        """
        Generate dynamic configuration for a specific user and product.
        
        CACHE STAMPEDE PROTECTION: Uses Redis distributed locks to prevent multiple
        processes from generating the same config simultaneously when cache misses occur.
        This prevents DDoS on the database when Redis is unavailable or cache expires.
        """
        config_key = f"dynamic_config:{user_key}:{product_name}:{project_id}"
        lock_key = f"dynamic_config_lock:{user_key}:{product_name}:{project_id}"
        lock_identifier = str(uuid.uuid4())
        
        # First, try to get from cache
        if self.redis_client:
            try:
                stored_config = self.redis_client.get(config_key)
                if stored_config:
                    if isinstance(stored_config, bytes):
                        stored_config = stored_config.decode("utf-8")
                    config_data = json.loads(stored_config)
                    # Check expiration
                    expires_at = config_data.get("metadata", {}).get("expires_at", 0)
                    if time.time() < expires_at:
                        logging.debug(f"DYNAMIC_CONFIG_CACHE_HIT user_key={user_key} product={product_name}")
                        return {
                            "config": config_data,
                            "metadata": config_data.get("metadata", {}),
                            "config_size": len(stored_config),
                        }
            except Exception as e:
                logging.debug(f"DYNAMIC_CONFIG_CACHE_CHECK_ERROR: {e}")
        
        # Cache miss - need to generate config
        # Try to acquire lock to prevent cache stampede
        lock_acquired = False
        if self.redis_client:
            try:
                # Try to acquire lock
                lock_acquired = self.redis_client.set(
                    lock_key,
                    lock_identifier,
                    nx=True,
                    ex=self.LOCK_TIMEOUT
                )
                
                if not lock_acquired:
                    # Another process is generating config - wait for it
                    logging.debug(f"DYNAMIC_CONFIG_WAITING_FOR_LOCK user_key={user_key} product={product_name}")
                    wait_start = time.time()
                    for attempt in range(self.LOCK_MAX_RETRIES):
                        # Check if config appeared in cache (another process finished)
                        stored_config = self.redis_client.get(config_key)
                        if stored_config:
                            if isinstance(stored_config, bytes):
                                stored_config = stored_config.decode("utf-8")
                            config_data = json.loads(stored_config)
                            expires_at = config_data.get("metadata", {}).get("expires_at", 0)
                            if time.time() < expires_at:
                                logging.debug(f"DYNAMIC_CONFIG_CACHE_HIT_AFTER_WAIT user_key={user_key} product={product_name}")
                                return {
                                    "config": config_data,
                                    "metadata": config_data.get("metadata", {}),
                                    "config_size": len(stored_config),
                                }
                        
                        # Check if we've waited too long
                        if time.time() - wait_start > self.LOCK_WAIT_TIMEOUT:
                            logging.warning(f"DYNAMIC_CONFIG_LOCK_WAIT_TIMEOUT user_key={user_key} product={product_name}")
                            break
                        
                        # Wait before retry with exponential backoff
                        time.sleep(self.LOCK_RETRY_DELAY * (2 ** min(attempt, 5)))
                    
                    # If we still don't have config, proceed to generate (fallback)
                    logging.warning(f"DYNAMIC_CONFIG_LOCK_WAIT_FAILED user_key={user_key} product={product_name}, generating anyway")
            except Exception as e:
                logging.warning(f"DYNAMIC_CONFIG_LOCK_ERROR: {e}, proceeding without lock")
        
        # Generate config (either we have lock, or Redis is unavailable, or wait failed)
        try:
            product = Product.query.filter_by(name=product_name, project_id=project_id).first()
            if not product:
                raise ValueError(f"Product {product_name} not found in project {project_id}")

            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            key_obj = Key.query.filter_by(key=user_key, project_id=project_id).first()
            if not key_obj:
                raise ValueError(f"Key {user_key} not found in project {project_id}")

            # Get feature config schema from database (product-specific or project-level)
            schema = self._get_feature_schema(product, project_id)
            
            # Get base config from schema or create empty config
            base_config = schema.default_config_dict if schema and schema.default_config_dict else {}
            
            # If no schema found, create minimal default config
            if not base_config:
                base_config = {
                    "feature_flags": {},
                    "settings": {},
                }

            dynamic_config = self._customize_config(base_config, user_key, product, project, key_obj, schema)

            # KISS Principle: Simplified metadata structure for easier debugging
            # Removed complex versioning and checksum - these added unnecessary complexity
            # Config validation is handled by expiration time and key/product validation
            generated_at = int(time.time())
            expires_at = generated_at + self.config_ttl
            
            schema_name = schema.name if schema else None
            schema_version = schema.version if schema else None
            
            dynamic_config["metadata"] = {
                "user_key": user_key,
                "product_name": product_name,
                "project_id": project_id,
                "schema_name": schema_name,
                "schema_version": schema_version,
                "generated_at": generated_at,
                "expires_at": expires_at,
            }

            # KISS Principle: Store plain JSON in Redis (encryption happens at route level)
            config_json = json.dumps(dynamic_config, sort_keys=True)
            config_key = f"dynamic_config:{user_key}:{product_name}:{project_id}"
            
            # SECURITY: Validate and monitor DynamicConfig operations
            try:
                from ...utils.redis_security import redis_security_monitor
                if not redis_security_monitor.validate_dynamic_config_access(
                    config_key, "SETEX", expected_project_id=project_id
                ):
                    logging.warning(
                        f"[DYNAMIC_CONFIG] Security validation failed for key {config_key}, "
                        f"project_id={project_id}"
                    )
                redis_security_monitor.log_critical_operation(config_key, "SETEX")
            except Exception as e:
                logging.warning(f"[DYNAMIC_CONFIG] Security monitoring error: {e}")
            
            # KISS Principle: Simple Redis storage without additional encryption/integrity layers
            # Redis is already protected by network isolation and separate DB
            # Final encryption happens at route level using project-specific keys
            if self.redis_client:
                try:
                    self.redis_client.setex(config_key, self.config_ttl, config_json)
                    # Release lock if we acquired it
                    if lock_acquired:
                        try:
                            # Only delete if we still own the lock (prevent deleting someone else's lock)
                            current_lock = self.redis_client.get(lock_key)
                            if current_lock and current_lock.decode('utf-8') == lock_identifier:
                                self.redis_client.delete(lock_key)
                        except Exception as unlock_error:
                            logging.debug(f"DYNAMIC_CONFIG_UNLOCK_ERROR: {unlock_error}")
                except Exception as redis_error:
                    logging.warning(
                        f"[DYNAMIC_CONFIG] Failed to cache config in Redis: {redis_error}. "
                        f"Config will be generated on-the-fly for each request."
                    )
                    # Release lock on error
                    if lock_acquired and self.redis_client:
                        try:
                            current_lock = self.redis_client.get(lock_key)
                            if current_lock and current_lock.decode('utf-8') == lock_identifier:
                                self.redis_client.delete(lock_key)
                        except Exception:
                            pass
            else:
                logging.debug(
                    "[DYNAMIC_CONFIG] Redis unavailable, skipping cache. "
                    "Config will be generated on-the-fly."
                )

            logging.info(
                f"DYNAMIC_CONFIG_GENERATED user_key={user_key} product={product_name} project_id={project_id} schema={schema_name}"
            )

            # Return config dict (will be encrypted at route level)
            return {
                "config": dynamic_config,
                "metadata": dynamic_config["metadata"],
                "config_size": len(config_json),
            }

        except Exception as e:
            logging.error(
                f"DYNAMIC_CONFIG_GENERATION_ERROR user_key={user_key} product={product_name} error={e}"
            )
            raise ValueError(f"Failed to generate dynamic configuration: {str(e)}")

    def validate_config_request(
        self, user_key: str, product_name: str, project_id: int, config_checksum: Optional[str] = None
    ) -> bool:
        """
        Validate a configuration request from client
        
        KISS Principle: Simplified validation - removed checksum validation as it added
        unnecessary complexity. Config validity is ensured by:
        1. Expiration time check
        2. Key status validation
        3. Product status validation
        
        Args:
            user_key: User key
            product_name: Product name
            project_id: Project ID
            config_checksum: Optional checksum (deprecated, kept for backward compatibility)
        """
        try:
            config_key = f"dynamic_config:{user_key}:{product_name}:{project_id}"
            
            # SECURITY: Validate and monitor DynamicConfig access
            try:
                from ...utils.redis_security import redis_security_monitor
                if not redis_security_monitor.validate_dynamic_config_access(
                    config_key, "GET", expected_project_id=project_id
                ):
                    logging.warning(
                        f"[DYNAMIC_CONFIG] Security validation failed for key {config_key}, "
                        f"project_id={project_id}"
                    )
                redis_security_monitor.log_critical_operation(config_key, "GET")
            except Exception as e:
                logging.warning(f"[DYNAMIC_CONFIG] Security monitoring error: {e}")
            
            # KISS Principle: Simple Redis retrieval without integrity checks
            # Redis is already protected by network isolation
            stored_config = None
            if self.redis_client:
                try:
                    stored_config = self.redis_client.get(config_key)
                    if stored_config and isinstance(stored_config, bytes):
                        stored_config = stored_config.decode("utf-8")
                except Exception as redis_error:
                    logging.warning(
                        f"[DYNAMIC_CONFIG] Failed to get config from Redis: {redis_error}. "
                        f"Will generate config on-the-fly."
                    )
            else:
                logging.debug(
                    "[DYNAMIC_CONFIG] Redis unavailable, will generate config on-the-fly."
                )

            if not stored_config:
                return False

            # KISS Principle: Parse JSON directly (no decryption needed)
            try:
                config_data = json.loads(stored_config)
            except json.JSONDecodeError as e:
                logging.error(f"[DYNAMIC_CONFIG] Failed to parse config JSON: {e}")
                return False
            
            # KISS: Simple expiration check (removed checksum complexity)
            expires_at = config_data.get("metadata", {}).get("expires_at", 0)
            if time.time() > expires_at:
                logging.debug(f"Config expired for user_key={user_key} product={product_name}")
                return False

            # Validate key and product status
            key_obj = Key.query.filter_by(key=user_key, project_id=project_id).first()
            if not key_obj or key_obj.status != 1:
                logging.debug(f"Key invalid or inactive: user_key={user_key}")
                return False

            product = Product.query.filter_by(name=product_name, project_id=project_id).first()
            if not product or product.status != "active":
                logging.debug(f"Product invalid or inactive: product={product_name}")
                return False

            return True

        except Exception as e:
            logging.error(
                f"DYNAMIC_CONFIG_VALIDATION_ERROR user_key={user_key} product={product_name} error={e}",
                exc_info=True
            )
            return False

    def get_config_statistics(self) -> Dict:
        """Get dynamic configuration statistics"""
        try:
            # FALLBACK: If Redis is unavailable, return empty stats
            if not self.redis_client:
                return {
                "total_configs": 0,
                "active_configs": 0,
                "expired_configs": 0,
                "config_ttl": self.config_ttl,
                "redis_available": False,
            }
            
            config_keys = self.redis_client.keys("dynamic_config:*")
            total_configs = len(config_keys)
            active_configs = 0
            expired_configs = 0

            current_time = int(time.time())

            for config_key in config_keys:
                try:
                    stored_config = self.redis_client.get(config_key)
                    if stored_config:
                        if isinstance(stored_config, bytes):
                            stored_config = stored_config.decode("utf-8")
                        config_data = json.loads(stored_config)
                        expires_at = config_data.get("metadata", {}).get("expires_at", 0)

                        if current_time < expires_at:
                            active_configs += 1
                        else:
                            expired_configs += 1

                except Exception as e:
                    logging.error(f"DYNAMIC_CONFIG_STATS_ERROR config_key={config_key} error={e}")
                    continue

            return {
                "total_configs": total_configs,
                "active_configs": active_configs,
                "expired_configs": expired_configs,
                "config_ttl": self.config_ttl,
                "redis_available": True,
            }

        except Exception as e:
            logging.error(f"DYNAMIC_CONFIG_STATISTICS_ERROR: {e}")
            return {}

    def _get_feature_schema(self, product: Product, project_id: int) -> Optional[FeatureConfigSchema]:
        """
        Get feature configuration schema for a product/product.
        
        Priority:
        1. Product-specific schema (if product_id is set)
        2. Project-level default schema (if no product-specific schema)
        3. None (will use minimal default config)
        """
        try:
            # First, try to get product-specific schema
            if product.id:
                schema = FeatureConfigSchema.query.filter_by(
                    product_id=product.id,
                    project_id=project_id,
                    is_active=True
                ).first()
                if schema:
                    return schema
            
            # Fallback to project-level default schema (product_id is None)
            schema = FeatureConfigSchema.query.filter_by(
                product_id=None,
                project_id=project_id,
                is_active=True
            ).order_by(FeatureConfigSchema.created_at.desc()).first()
            
            return schema
        except Exception as e:
            logging.error(f"Error getting feature schema for product {product.id}, project {project_id}: {e}")
            return None

    def _customize_config(
        self, base_config: Dict, user_key: str, product: Product, project: Project, key_obj: Key, schema: Optional[FeatureConfigSchema] = None
    ) -> Dict:
        """
        Customize configuration based on user, project, and product specifics.
        
        This method now works with arbitrary config structures defined by JSON schemas.
        It applies security rules and RBAC-based feature flags dynamically.
        """
        try:
            import copy

            customized_config = copy.deepcopy(base_config)

            # Apply project-level security restrictions
            if hasattr(project, "security_level"):
                if project.security_level == "high":
                    # Disable potentially dangerous features based on naming patterns
                    self._disable_features_by_pattern(customized_config, ["hack", "god", "teleport"])

            # Apply RBAC-based feature restrictions
            user = User.query.get(key_obj.user_id) if key_obj.user_id else None
            if user:
                from ...services.rbac import rbac_service

                is_owner = rbac_service.check_permission(user.id, "system.manage_all_projects")
                is_admin = rbac_service.check_permission(
                    user.id, "products.edit"
                ) or rbac_service.check_permission(user.id, "products.view")
                is_seller = rbac_service.check_permission(user.id, "products.view")
                
                if is_owner:
                    # Owner has full access - no restrictions
                    pass
                elif is_admin:
                    # Admin has most access - minimal restrictions
                    pass
                elif is_seller:
                    # Seller has limited access
                    self._disable_features_by_pattern(customized_config, ["hack", "god"])
                else:
                    # Regular user - strict restrictions
                    self._disable_features_by_pattern(customized_config, ["hack", "god", "teleport", "wallhack"])

            # Apply product status-based restrictions
            if product.status == "testing":
                # Enable all features for testing
                self._enable_all_features(customized_config)
            elif product.status == "maintenance":
                # Disable all features during maintenance
                self._disable_all_features(customized_config)

            return customized_config

        except Exception as e:
            logging.error(f"CONFIG_CUSTOMIZATION_ERROR user_key={user_key} error={e}")
            return base_config
    
    def _disable_features_by_pattern(self, config: Dict, patterns: List[str]) -> None:
        """
        Disable features matching patterns in feature_flags section.
        Works recursively to handle nested structures.
        """
        if "feature_flags" in config and isinstance(config["feature_flags"], dict):
            for feature_name, feature_value in config["feature_flags"].items():
                if isinstance(feature_value, bool):
                    feature_lower = feature_name.lower()
                    if any(pattern in feature_lower for pattern in patterns):
                        config["feature_flags"][feature_name] = False
                elif isinstance(feature_value, dict):
                    # Recursively process nested feature flags
                    self._disable_features_by_pattern({"feature_flags": feature_value}, patterns)
    
    def _enable_all_features(self, config: Dict) -> None:
        """Enable all boolean features in feature_flags section"""
        if "feature_flags" in config and isinstance(config["feature_flags"], dict):
            for feature_name, feature_value in config["feature_flags"].items():
                if isinstance(feature_value, bool):
                    config["feature_flags"][feature_name] = True
                elif isinstance(feature_value, dict):
                    self._enable_all_features({"feature_flags": feature_value})
    
    def _disable_all_features(self, config: Dict) -> None:
        """Disable all boolean features in feature_flags section"""
        if "feature_flags" in config and isinstance(config["feature_flags"], dict):
            for feature_name, feature_value in config["feature_flags"].items():
                if isinstance(feature_value, bool):
                    config["feature_flags"][feature_name] = False
                elif isinstance(feature_value, dict):
                    self._disable_all_features({"feature_flags": feature_value})


dynamic_config_service = DynamicConfigService()
