"""
Redis Configuration Factory
Separates Redis configuration logic from client implementation.

This module provides a factory for creating Redis client configurations,
handling different deployment modes (standalone, cluster, sentinel) and
instance types (cache, persistent).

This separation follows Single Responsibility Principle - configuration
logic is separated from client operations.
"""

import logging
import ssl
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import redis
from redis.cluster import RedisCluster
from redis.sentinel import Sentinel

from ..config.config import Config, IS_PRODUCTION

logger = logging.getLogger(__name__)

@dataclass
class RedisConfig:
    """Redis connection configuration"""
    host: str
    port: int
    db: int
    password: Optional[str] = None
    mode: str = "standalone"  # standalone, cluster, sentinel
    ssl_enabled: bool = False
    ssl_cert_reqs: str = "required"
    ssl_ca_certs: Optional[str] = None
    cluster_nodes: Optional[List[Tuple[str, int]]] = None
    sentinel_hosts: Optional[List[Tuple[str, int]]] = None
    sentinel_master: Optional[str] = None
    sentinel_password: Optional[str] = None

class RedisConfigFactory:
    """
    Factory for creating Redis configurations and clients.
    
    Handles:
    - Different instance types (cache, persistent)
    - Different deployment modes (standalone, cluster, sentinel)
    - SSL/TLS configuration
    - Connection parameter optimization
    """
    
    @staticmethod
    def get_config_for_instance(instance: str = "persistent", db: Optional[int] = None) -> RedisConfig:
        """
        Get Redis configuration for a specific instance type.
        
        Args:
            instance: Instance type - "cache" or "persistent"
            db: Optional database number (uses default from Config if None)
            
        Returns:
            RedisConfig object with connection parameters
        """
        if instance == "cache":
            host = Config.REDIS_CACHE_HOST
            port = Config.REDIS_CACHE_PORT
            password = Config.REDIS_CACHE_PASSWORD
            default_db = Config.REDIS_CACHE_DB
            mode = Config.REDIS_CACHE_MODE
            cluster_nodes_str = Config.REDIS_CACHE_CLUSTER_NODES
            sentinel_hosts_str = Config.REDIS_CACHE_SENTINEL_HOSTS
            sentinel_master = Config.REDIS_CACHE_SENTINEL_MASTER
            sentinel_password = Config.REDIS_CACHE_SENTINEL_PASSWORD
            ssl_enabled = Config.REDIS_CACHE_SSL
            ssl_cert_reqs = Config.REDIS_CACHE_SSL_CERT_REQS
            ssl_ca_certs = Config.REDIS_CACHE_SSL_CA_CERTS
        else:
            host = Config.REDIS_PERSISTENT_HOST
            port = Config.REDIS_PERSISTENT_PORT
            password = Config.REDIS_PERSISTENT_PASSWORD
            default_db = Config.REDIS_PERSISTENT_DB
            mode = Config.REDIS_PERSISTENT_MODE
            cluster_nodes_str = Config.REDIS_PERSISTENT_CLUSTER_NODES
            sentinel_hosts_str = Config.REDIS_PERSISTENT_SENTINEL_HOSTS
            sentinel_master = Config.REDIS_PERSISTENT_SENTINEL_MASTER
            sentinel_password = Config.REDIS_PERSISTENT_SENTINEL_PASSWORD
            ssl_enabled = Config.REDIS_PERSISTENT_SSL
            ssl_cert_reqs = Config.REDIS_PERSISTENT_SSL_CERT_REQS
            ssl_ca_certs = Config.REDIS_PERSISTENT_SSL_CA_CERTS
        
        db_number = db if db is not None else default_db
        
        # Parse cluster nodes if provided
        cluster_nodes = None
        if cluster_nodes_str:
            cluster_nodes = RedisConfigFactory._parse_cluster_nodes(cluster_nodes_str)
        
        # Parse sentinel hosts if provided
        sentinel_hosts = None
        if sentinel_hosts_str:
            sentinel_hosts = RedisConfigFactory._parse_sentinel_hosts(sentinel_hosts_str)
        
        return RedisConfig(
            host=host,
            port=port,
            db=db_number,
            password=password,
            mode=mode,
            ssl_enabled=ssl_enabled,
            ssl_cert_reqs=ssl_cert_reqs,
            ssl_ca_certs=ssl_ca_certs,
            cluster_nodes=cluster_nodes,
            sentinel_hosts=sentinel_hosts,
            sentinel_master=sentinel_master,
            sentinel_password=sentinel_password,
        )
    
    @staticmethod
    def _parse_cluster_nodes(nodes_str: str) -> List[Tuple[str, int]]:
        """Parse cluster nodes string into list of (host, port) tuples"""
        nodes = []
        for node_str in nodes_str.split(","):
            node_str = node_str.strip()
            if ":" in node_str:
                node_host, node_port = node_str.rsplit(":", 1)
                nodes.append((node_host.strip(), int(node_port.strip())))
            else:
                raise ValueError(f"Invalid cluster node format: {node_str}. Expected host:port")
        
        if not nodes:
            raise ValueError(f"No valid cluster nodes found in {nodes_str}")
        
        return nodes
    
    @staticmethod
    def _parse_sentinel_hosts(hosts_str: str) -> List[Tuple[str, int]]:
        """Parse sentinel hosts string into list of (host, port) tuples"""
        sentinels = []
        for sentinel_str in hosts_str.split(","):
            sentinel_str = sentinel_str.strip()
            if ":" in sentinel_str:
                sentinel_host, sentinel_port = sentinel_str.rsplit(":", 1)
                sentinels.append((sentinel_host.strip(), int(sentinel_port.strip())))
            else:
                raise ValueError(f"Invalid sentinel host format: {sentinel_str}. Expected host:port")
        
        if not sentinels:
            raise ValueError(f"No valid sentinel hosts found in {hosts_str}")
        
        return sentinels
    
    @staticmethod
    def create_client(config: RedisConfig) -> redis.Redis:
        """
        Create Redis client from configuration.
        
        Args:
            config: RedisConfig object with connection parameters
            
        Returns:
            Configured Redis client instance
            
        Raises:
            RuntimeError: If Redis connection cannot be established
            ValueError: If configuration is invalid
        """
        # Common connection parameters
        common_config = {
            "decode_responses": True,
            "socket_connect_timeout": 5,
            "socket_timeout": 5,
            "retry_on_timeout": True,
            "health_check_interval": 30,
        }
        
        # SSL configuration
        ssl_config = RedisConfigFactory._build_ssl_config(config)
        
        # Create client based on mode
        if config.mode == "cluster":
            return RedisConfigFactory._create_cluster_client(config, common_config, ssl_config)
        elif config.mode == "sentinel":
            return RedisConfigFactory._create_sentinel_client(config, common_config, ssl_config)
        else:
            return RedisConfigFactory._create_standalone_client(config, common_config, ssl_config)
    
    @staticmethod
    def _build_ssl_config(config: RedisConfig) -> Dict:
        """Build SSL configuration dictionary"""
        if not config.ssl_enabled:
            return {}
        
        cert_reqs_map = {
            "none": ssl.CERT_NONE,
            "optional": ssl.CERT_OPTIONAL,
            "required": ssl.CERT_REQUIRED,
        }
        cert_reqs = cert_reqs_map.get(config.ssl_cert_reqs.lower(), ssl.CERT_REQUIRED)
        
        ssl_config = {
            "ssl": True,
            "ssl_cert_reqs": cert_reqs,
        }
        
        if config.ssl_ca_certs:
            ssl_config["ssl_ca_certs"] = config.ssl_ca_certs
        
        return ssl_config
    
    @staticmethod
    def _create_cluster_client(
        config: RedisConfig, 
        common_config: Dict, 
        ssl_config: Dict
    ) -> RedisCluster:
        """Create Redis Cluster client"""
        if not config.cluster_nodes:
            raise ValueError(
                f"Redis is configured for cluster mode but cluster nodes are not set. "
                f"Format: host1:port1,host2:port2"
            )
        
        try:
            cluster_config = {
                **common_config,
                **ssl_config,
                "password": config.password,
                "max_connections": 20,
                "skip_full_coverage_check": True,
            }
            
            client = RedisCluster(startup_nodes=config.cluster_nodes, **cluster_config)
            logger.info(
                f"Redis Cluster client initialized with {len(config.cluster_nodes)} nodes"
            )
            return client
        except ImportError:
            raise ImportError(
                "Redis Cluster support requires redis-py >= 4.0. "
                "Install with: pip install 'redis[hiredis]'"
            )
    
    @staticmethod
    def _create_sentinel_client(
        config: RedisConfig,
        common_config: Dict,
        ssl_config: Dict
    ) -> redis.Redis:
        """Create Redis Sentinel client"""
        if not config.sentinel_hosts:
            raise ValueError(
                f"Redis is configured for sentinel mode but sentinel hosts are not set. "
                f"Format: host1:port1,host2:port2"
            )
        
        if not config.sentinel_master:
            raise ValueError("Redis sentinel mode requires sentinel_master to be set")
        
        try:
            sentinel_config = {**common_config, **ssl_config}
            if config.sentinel_password:
                sentinel_config["password"] = config.sentinel_password
            
            sentinel = Sentinel(config.sentinel_hosts, **sentinel_config)
            
            # Get master connection
            master_config = {
                "db": config.db,
                "password": config.password,
            }
            if config.ssl_enabled:
                master_config.update(ssl_config)
            
            client = sentinel.master_for(config.sentinel_master, redis_class=redis.Redis, **master_config)
            logger.info(
                f"Redis Sentinel client initialized "
                f"(master={config.sentinel_master}, {len(config.sentinel_hosts)} sentinels)"
            )
            return client
        except ImportError:
            raise ImportError(
                "Redis Sentinel support requires redis-py >= 2.0. "
                "Install with: pip install 'redis[hiredis]'"
            )
    
    @staticmethod
    def _create_standalone_client(
        config: RedisConfig,
        common_config: Dict,
        ssl_config: Dict
    ) -> redis.Redis:
        """Create standalone Redis client"""
        if not config.password:
            logger.warning(
                "[REDIS_SECURITY] Redis has no password configured. "
                "This is a security risk in production. Set REDIS_*_PASSWORD environment variable."
            )
        
        redis_config = {
            "host": config.host,
            "port": config.port,
            "db": config.db,
            **common_config,
            **ssl_config,
            "max_connections": 20,
        }
        
        if config.password:
            redis_config["password"] = config.password
        
        client = redis.Redis(**redis_config)
        
        # Verify connection
        try:
            client.ping()
            logger.debug(
                f"Redis standalone client initialized successfully "
                f"(host={config.host}, port={config.port}, DB={config.db})"
            )
        except Exception as e:
            logger.error(
                f"Redis connection verification failed "
                f"(host={config.host}, port={config.port}, DB={config.db}): {e}"
            )
            raise RuntimeError(
                f"Redis is required but connection failed "
                f"(host={config.host}, port={config.port}, DB={config.db}): {e}"
            ) from e
        
        return client

