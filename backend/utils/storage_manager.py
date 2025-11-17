"""
Distributed File Storage Manager
Supports multiple storage backends for horizontal scalability.
"""

import hashlib
import json
import mimetypes
import os
import time
from abc import ABC, abstractmethod
from typing import Any, BinaryIO, Dict, Optional, Tuple

import boto3
import redis
from botocore.exceptions import ClientError, NoCredentialsError
from flask import current_app
from werkzeug.utils import secure_filename

from ..utils.structured_logging import get_logger, log_performance

logger = get_logger(__name__)


class StorageBackend(ABC):
    """Abstract base class for storage backends"""

    @abstractmethod
    def upload_file(
        self, file_data: bytes, file_path: str, content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Upload file to storage backend"""
        pass

    @abstractmethod
    def download_file(self, file_path: str) -> bytes:
        """Download file from storage backend"""
        pass

    @abstractmethod
    def delete_file(self, file_path: str) -> bool:
        """Delete file from storage backend"""
        pass

    @abstractmethod
    def file_exists(self, file_path: str) -> bool:
        """Check if file exists in storage backend"""
        pass

    @abstractmethod
    def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get file metadata"""
        pass

    @abstractmethod
    def list_files(self, prefix: str = "") -> list:
        """List files with optional prefix"""
        pass


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend"""

    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)

    @log_performance("local_file_upload")
    def upload_file(
        self, file_data: bytes, file_path: str, content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        full_path = os.path.join(self.base_path, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, "wb") as f:
            f.write(file_data)

        file_hash = hashlib.sha256(file_data).hexdigest()
        file_size = len(file_data)

        return {
            "path": file_path,
            "size": file_size,
            "hash": file_hash,
            "content_type": content_type,
            "backend": "local",
        }

    @log_performance("local_file_download")
    def download_file(self, file_path: str) -> bytes:
        full_path = os.path.join(self.base_path, file_path)
        with open(full_path, "rb") as f:
            return f.read()

    def delete_file(self, file_path: str) -> bool:
        try:
            full_path = os.path.join(self.base_path, file_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete local file {file_path}: {e}")
            return False

    def file_exists(self, file_path: str) -> bool:
        full_path = os.path.join(self.base_path, file_path)
        return os.path.exists(full_path)

    def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        try:
            full_path = os.path.join(self.base_path, file_path)
            if not os.path.exists(full_path):
                return None

            stat = os.stat(full_path)
            return {
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "content_type": mimetypes.guess_type(full_path)[0],
                "backend": "local",
            }
        except Exception as e:
            logger.error(f"Failed to get file info for {file_path}: {e}")
            return None

    def list_files(self, prefix: str = "") -> list:
        try:
            search_path = os.path.join(self.base_path, prefix)
            files = []
            for root, dirs, filenames in os.walk(search_path):
                for filename in filenames:
                    rel_path = os.path.relpath(os.path.join(root, filename), self.base_path)
                    files.append(rel_path)
            return files
        except Exception as e:
            logger.error(f"Failed to list files with prefix {prefix}: {e}")
            return []


class S3StorageBackend(StorageBackend):
    """AWS S3 storage backend"""

    def __init__(
        self,
        bucket_name: str,
        region: str = "us-east-1",
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
    ):
        self.bucket_name = bucket_name
        self.region = region

        # Initialize S3 client
        if access_key and secret_key:
            self.s3_client = boto3.client(
                "s3",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
        else:
            # Use default credentials (IAM role, environment variables, etc.)
            self.s3_client = boto3.client("s3", region_name=region)

    @log_performance("s3_file_upload")
    def upload_file(
        self, file_data: bytes, file_path: str, content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            # Generate content type if not provided
            if not content_type:
                content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_path,
                Body=file_data,
                ContentType=content_type,
                ServerSideEncryption="AES256",
            )

            file_hash = hashlib.sha256(file_data).hexdigest()
            file_size = len(file_data)

            return {
                "path": file_path,
                "size": file_size,
                "hash": file_hash,
                "content_type": content_type,
                "backend": "s3",
                "bucket": self.bucket_name,
            }
        except Exception as e:
            logger.error(f"Failed to upload file to S3 {file_path}: {e}")
            raise

    @log_performance("s3_file_download")
    def download_file(self, file_path: str) -> bytes:
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=file_path)
            return response["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File {file_path} not found in S3")
            raise

    def delete_file(self, file_path: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=file_path)
            return True
        except Exception as e:
            logger.error(f"Failed to delete S3 file {file_path}: {e}")
            return False

    def file_exists(self, file_path: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=file_path)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise

    def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=file_path)
            return {
                "size": response["ContentLength"],
                "modified": response["LastModified"].timestamp(),
                "content_type": response.get("ContentType"),
                "backend": "s3",
                "bucket": self.bucket_name,
                "etag": response.get("ETag", "").strip('"'),
            }
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return None
            logger.error(f"Failed to get S3 file info for {file_path}: {e}")
            return None

    def list_files(self, prefix: str = "") -> list:
        try:
            response = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            return [obj["Key"] for obj in response.get("Contents", [])]
        except Exception as e:
            logger.error(f"Failed to list S3 files with prefix {prefix}: {e}")
            return []


class RedisCacheBackend:
    """Redis-based caching layer for file metadata"""

    def __init__(self, redis_client: redis.Redis, ttl: int = 3600):
        self.redis = redis_client
        self.ttl = ttl

    def get_file_metadata(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get cached file metadata"""
        try:
            key = f"file_metadata:{file_path}"
            data = self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Failed to get cached metadata for {file_path}: {e}")
            return None

    def set_file_metadata(self, file_path: str, metadata: Dict[str, Any]):
        """Cache file metadata"""
        try:
            key = f"file_metadata:{file_path}"
            self.redis.setex(key, self.ttl, json.dumps(metadata))
        except Exception as e:
            logger.error(f"Failed to cache metadata for {file_path}: {e}")

    def invalidate_file_metadata(self, file_path: str):
        """Invalidate cached file metadata"""
        try:
            key = f"file_metadata:{file_path}"
            self.redis.delete(key)
        except Exception as e:
            logger.error(f"Failed to invalidate metadata for {file_path}: {e}")


class StorageManager:
    """Main storage manager with multiple backend support"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.backends: Dict[str, StorageBackend] = {}
        self.default_backend = config.get("default_backend", "local")
        self.cache_backend = None

        # Initialize backends
        self._init_backends()

        # Initialize cache if Redis is available
        self._init_cache()

    def _init_backends(self):
        """Initialize storage backends based on configuration"""

        # Local storage
        if "local" in self.config.get("backends", {}):
            local_config = self.config["backends"]["local"]
            self.backends["local"] = LocalStorageBackend(base_path=local_config["base_path"])

        # S3 storage
        if "s3" in self.config.get("backends", {}):
            s3_config = self.config["backends"]["s3"]
            try:
                self.backends["s3"] = S3StorageBackend(
                    bucket_name=s3_config["bucket_name"],
                    region=s3_config.get("region", "us-east-1"),
                    access_key=s3_config.get("access_key"),
                    secret_key=s3_config.get("secret_key"),
                )
                logger.info("S3 storage backend initialized", bucket=s3_config["bucket_name"])
            except Exception as e:
                logger.error(f"Failed to initialize S3 backend: {e}")

    def _init_cache(self):
        """Initialize Redis cache backend"""
        try:
            redis_config = self.config.get("redis", {})
            if redis_config:
                redis_client = redis.Redis(
                    host=redis_config.get("host", "localhost"),
                    port=redis_config.get("port", 6379),
                    db=redis_config.get("db", 0),
                    password=redis_config.get("password"),
                    decode_responses=False,  # Keep binary for metadata
                )
                self.cache_backend = RedisCacheBackend(
                    redis_client=redis_client, ttl=redis_config.get("cache_ttl", 3600)
                )
                logger.info("Redis cache backend initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis cache: {e}")

    def get_backend(self, backend_name: Optional[str] = None) -> StorageBackend:
        """Get storage backend by name"""
        backend_name = backend_name or self.default_backend
        if backend_name not in self.backends:
            raise ValueError(f"Storage backend '{backend_name}' not configured")
        return self.backends[backend_name]

    @log_performance("file_upload")
    def upload_file(
        self,
        file_data: bytes,
        file_path: str,
        content_type: Optional[str] = None,
        backend: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upload file to specified backend"""

        # Sanitize file path
        file_path = secure_filename(file_path)

        # Get backend
        storage_backend = self.get_backend(backend)

        # Upload file
        result = storage_backend.upload_file(file_data, file_path, content_type)

        # Cache metadata
        if self.cache_backend:
            self.cache_backend.set_file_metadata(file_path, result)

        logger.info(
            "File uploaded successfully",
            file_path=file_path,
            backend=result["backend"],
            size=result["size"],
        )

        return result

    @log_performance("file_download")
    def download_file(self, file_path: str, backend: Optional[str] = None) -> bytes:
        """Download file from specified backend"""

        # Try cache first
        if self.cache_backend:
            metadata = self.cache_backend.get_file_metadata(file_path)
            if metadata and "backend" in metadata:
                backend = metadata["backend"]

        # Get backend
        storage_backend = self.get_backend(backend)

        # Download file
        return storage_backend.download_file(file_path)

    def delete_file(self, file_path: str, backend: Optional[str] = None) -> bool:
        """Delete file from specified backend"""

        # Try cache first
        if self.cache_backend:
            metadata = self.cache_backend.get_file_metadata(file_path)
            if metadata and "backend" in metadata:
                backend = metadata["backend"]

        # Get backend
        storage_backend = self.get_backend(backend)

        # Delete file
        success = storage_backend.delete_file(file_path)

        # Invalidate cache
        if self.cache_backend:
            self.cache_backend.invalidate_file_metadata(file_path)

        if success:
            logger.info("File deleted successfully", file_path=file_path)

        return success

    def file_exists(self, file_path: str, backend: Optional[str] = None) -> bool:
        """Check if file exists in specified backend"""

        # Try cache first
        if self.cache_backend:
            metadata = self.cache_backend.get_file_metadata(file_path)
            if metadata:
                return True

        # Get backend
        storage_backend = self.get_backend(backend)

        # Check existence
        return storage_backend.file_exists(file_path)

    def get_file_info(
        self, file_path: str, backend: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get file metadata"""

        # Try cache first
        if self.cache_backend:
            metadata = self.cache_backend.get_file_metadata(file_path)
            if metadata:
                return metadata

        # Get backend
        storage_backend = self.get_backend(backend)

        # Get file info
        info = storage_backend.get_file_info(file_path)

        # Cache result
        if info and self.cache_backend:
            self.cache_backend.set_file_metadata(file_path, info)

        return info

    def list_files(self, prefix: str = "", backend: Optional[str] = None) -> list:
        """List files with optional prefix"""
        storage_backend = self.get_backend(backend)
        return storage_backend.list_files(prefix)

    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        stats = {
            "backends": list(self.backends.keys()),
            "default_backend": self.default_backend,
            "cache_enabled": self.cache_backend is not None,
        }

        # Add backend-specific stats
        for name, backend in self.backends.items():
            try:
                if hasattr(backend, "get_stats"):
                    stats[f"{name}_stats"] = backend.get_stats()
            except Exception as e:
                logger.error(f"Failed to get stats for backend {name}: {e}")

        return stats


# Global storage manager instance
storage_manager: Optional[StorageManager] = None


def init_storage_manager(config: Dict[str, Any]):
    """Initialize global storage manager"""
    global storage_manager
    storage_manager = StorageManager(config)
    logger.info(
        "Storage manager initialized",
        backends=list(storage_manager.backends.keys()),
        default_backend=storage_manager.default_backend,
    )


def get_storage_manager() -> StorageManager:
    """Get global storage manager instance"""
    if storage_manager is None:
        raise RuntimeError("Storage manager not initialized")
    return storage_manager
