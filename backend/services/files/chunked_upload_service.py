"""
Chunked Upload Service
Handles chunked file uploads for large files to prevent browser memory issues
"""

import hashlib
import logging
import os
import shutil
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from flask import current_app
from werkzeug.utils import secure_filename

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product

logger = logging.getLogger(__name__)

# Chunk metadata stored in Redis with TTL
CHUNK_METADATA_TTL = 3600  # 1 hour
CHUNK_CLEANUP_INTERVAL = 1800  # 30 minutes


class ChunkedUploadService:
    """Service for handling chunked file uploads"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.chunk_storage_base = "chunks"
        self._redis_client = None

    def _get_redis_client(self):
        """Get Redis client for chunk metadata storage"""
        if self._redis_client is None:
            try:
                from ...core.extensions import redis_ext
                # Use redis_ext.client property to get the actual Redis client
                if redis_ext and hasattr(redis_ext, 'client'):
                    self._redis_client = redis_ext.client
                else:
                    self._redis_client = None
            except Exception as e:
                self.logger.warning(f"Redis not available for chunk metadata: {e}")
                self._redis_client = None
        return self._redis_client

    def _get_chunk_storage_path(self, upload_id: str) -> str:
        """Get storage path for chunks"""
        root_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        chunk_path = os.path.join(root_path, upload_folder, self.chunk_storage_base, upload_id)
        return chunk_path

    def _get_chunk_metadata_key(self, upload_id: str) -> str:
        """Get Redis key for chunk metadata"""
        return f"chunk_upload:{upload_id}"

    def _get_chunk_file_path(self, upload_id: str, chunk_index: int) -> str:
        """Get file path for a specific chunk"""
        chunk_path = self._get_chunk_storage_path(upload_id)
        return os.path.join(chunk_path, f"chunk_{chunk_index:06d}")

    def initialize_upload(
        self,
        upload_id: str,
        filename: str,
        file_size: int,
        total_chunks: int,
        user_id: int,
        project_id: int,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Initialize a chunked upload session

        Returns:
            Tuple of (success, error_message)
        """
        try:
            chunk_path = self._get_chunk_storage_path(upload_id)
            os.makedirs(chunk_path, exist_ok=True)

            metadata_data = {
                "upload_id": upload_id,
                "filename": secure_filename(filename),
                "file_size": file_size,
                "total_chunks": total_chunks,
                "user_id": user_id,
                "project_id": project_id,
                "chunks_received": [],
                "created_at": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            }

            # Store metadata in Redis if available
            redis_client = self._get_redis_client()
            if redis_client:
                try:
                    import json
                    metadata_key = self._get_chunk_metadata_key(upload_id)
                    redis_client.setex(
                        metadata_key,
                        CHUNK_METADATA_TTL,
                        json.dumps(metadata_data),
                    )
                except Exception as e:
                    self.logger.warning(f"Failed to store metadata in Redis: {e}")

            # Also store in file for persistence
            metadata_file = os.path.join(chunk_path, "metadata.json")
            import json
            with open(metadata_file, "w") as f:
                json.dump(metadata_data, f)

            self.logger.info(f"Initialized chunked upload: {upload_id} ({total_chunks} chunks)")
            return True, None
        except Exception as e:
            self.logger.error(f"Error initializing chunked upload {upload_id}: {e}")
            return False, f"Failed to initialize upload: {str(e)}"

    def save_chunk(
        self,
        upload_id: str,
        chunk_index: int,
        chunk_data: bytes,
        chunk_size: int,
    ) -> Tuple[bool, Optional[str]]:
        """
        Save a chunk of the file

        Returns:
            Tuple of (success, error_message)
        """
        try:
            metadata = self.get_upload_metadata(upload_id)
            if not metadata:
                return False, "Upload session not found or expired"

            if chunk_index >= metadata["total_chunks"]:
                return False, f"Invalid chunk index: {chunk_index} >= {metadata['total_chunks']}"

            chunk_path = self._get_chunk_file_path(upload_id, chunk_index)
            chunk_dir = os.path.dirname(chunk_path)
            os.makedirs(chunk_dir, exist_ok=True)

            with open(chunk_path, "wb") as f:
                f.write(chunk_data)

            # Update metadata
            if chunk_index not in metadata["chunks_received"]:
                metadata["chunks_received"].append(chunk_index)
                metadata["chunks_received"].sort()
                self._update_metadata(upload_id, metadata)

            self.logger.debug(f"Saved chunk {chunk_index} for upload {upload_id}")
            return True, None
        except Exception as e:
            self.logger.error(f"Error saving chunk {chunk_index} for upload {upload_id}: {e}")
            return False, f"Failed to save chunk: {str(e)}"

    def get_upload_metadata(self, upload_id: str) -> Optional[Dict[str, Any]]:
        """Get upload metadata"""
        try:
            # Try Redis first
            redis_client = self._get_redis_client()
            if redis_client:
                try:
                    metadata_key = self._get_chunk_metadata_key(upload_id)
                    metadata_json = redis_client.get(metadata_key)
                    
                    if metadata_json:
                        import json
                        if isinstance(metadata_json, bytes):
                            metadata_json = metadata_json.decode('utf-8')
                        return json.loads(metadata_json)
                except Exception as e:
                    self.logger.warning(f"Failed to get metadata from Redis: {e}")

            # Fallback to file
            chunk_path = self._get_chunk_storage_path(upload_id)
            metadata_file = os.path.join(chunk_path, "metadata.json")
            if os.path.exists(metadata_file):
                import json
                with open(metadata_file, "r") as f:
                    return json.load(f)

            return None
        except Exception as e:
            self.logger.error(f"Error getting upload metadata {upload_id}: {e}")
            return None

    def _update_metadata(self, upload_id: str, metadata: Dict[str, Any]) -> None:
        """Update upload metadata"""
        try:
            redis_client = self._get_redis_client()
            if redis_client:
                try:
                    metadata_key = self._get_chunk_metadata_key(upload_id)
                    import json
                    redis_client.setex(
                        metadata_key,
                        CHUNK_METADATA_TTL,
                        json.dumps(metadata),
                    )
                except Exception as e:
                    self.logger.warning(f"Failed to update metadata in Redis: {e}")

            # Also update file
            chunk_path = self._get_chunk_storage_path(upload_id)
            metadata_file = os.path.join(chunk_path, "metadata.json")
            import json
            with open(metadata_file, "w") as f:
                json.dump(metadata, f)
        except Exception as e:
            self.logger.error(f"Error updating metadata for {upload_id}: {e}")

    def is_upload_complete(self, upload_id: str) -> Tuple[bool, Optional[str]]:
        """
        Check if all chunks have been received

        Returns:
            Tuple of (is_complete, error_message)
        """
        metadata = self.get_upload_metadata(upload_id)
        if not metadata:
            return False, "Upload session not found or expired"

        expected_chunks = set(range(metadata["total_chunks"]))
        received_chunks = set(metadata["chunks_received"])

        if expected_chunks == received_chunks:
            return True, None
        else:
            missing = expected_chunks - received_chunks
            return False, f"Missing chunks: {sorted(missing)}"

    def assemble_file(
        self,
        upload_id: str,
        final_path: str,
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Assemble chunks into final file

        Returns:
            Tuple of (success, error_message, file_info)
        """
        try:
            metadata = self.get_upload_metadata(upload_id)
            if not metadata:
                return False, "Upload session not found or expired", None

            # Verify all chunks are present
            is_complete, error = self.is_upload_complete(upload_id)
            if not is_complete:
                return False, error, None

            # Create final file directory
            final_dir = os.path.dirname(final_path)
            os.makedirs(final_dir, exist_ok=True)

            # Assemble chunks
            total_size = 0
            file_hash = hashlib.sha256()

            with open(final_path, "wb") as final_file:
                for chunk_index in range(metadata["total_chunks"]):
                    chunk_path = self._get_chunk_file_path(upload_id, chunk_index)
                    if not os.path.exists(chunk_path):
                        return False, f"Chunk {chunk_index} not found", None

                    with open(chunk_path, "rb") as chunk_file:
                        chunk_data = chunk_file.read()
                        final_file.write(chunk_data)
                        file_hash.update(chunk_data)
                        total_size += len(chunk_data)

            # Verify file size
            if total_size != metadata["file_size"]:
                os.remove(final_path)
                return False, f"File size mismatch: expected {metadata['file_size']}, got {total_size}", None

            file_info = {
                "name": metadata["filename"],
                "size": total_size,
                "hash": file_hash.hexdigest(),
                "uploaded_at": datetime.utcnow().isoformat(),
            }

            # Cleanup chunks
            self.cleanup_upload(upload_id)

            self.logger.info(f"Assembled file from chunks: {upload_id} -> {final_path}")
            return True, None, file_info
        except Exception as e:
            self.logger.error(f"Error assembling file for upload {upload_id}: {e}")
            return False, f"Failed to assemble file: {str(e)}", None

    def cleanup_upload(self, upload_id: str) -> None:
        """Clean up chunk files and metadata"""
        try:
            chunk_path = self._get_chunk_storage_path(upload_id)
            if os.path.exists(chunk_path):
                shutil.rmtree(chunk_path)

            redis_client = self._get_redis_client()
            if redis_client:
                try:
                    metadata_key = self._get_chunk_metadata_key(upload_id)
                    redis_client.delete(metadata_key)
                except Exception as e:
                    self.logger.warning(f"Failed to delete metadata from Redis: {e}")

            self.logger.debug(f"Cleaned up upload {upload_id}")
        except Exception as e:
            self.logger.error(f"Error cleaning up upload {upload_id}: {e}")

    def cleanup_old_uploads(self, max_age_hours: int = 24) -> int:
        """
        Clean up old incomplete uploads

        Returns:
            Number of uploads cleaned up
        """
        cleaned = 0
        try:
            root_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
            chunks_base = os.path.join(root_path, upload_folder, self.chunk_storage_base)

            if not os.path.exists(chunks_base):
                return 0

            cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)

            for upload_id in os.listdir(chunks_base):
                upload_path = os.path.join(chunks_base, upload_id)
                if not os.path.isdir(upload_path):
                    continue

                metadata_file = os.path.join(upload_path, "metadata.json")
                if os.path.exists(metadata_file):
                    import json
                    with open(metadata_file, "r") as f:
                        metadata = json.load(f)
                        created_at = datetime.fromisoformat(metadata["created_at"])
                        if created_at < cutoff_time:
                            self.cleanup_upload(upload_id)
                            cleaned += 1

            self.logger.info(f"Cleaned up {cleaned} old upload sessions")
            return cleaned
        except Exception as e:
            self.logger.error(f"Error cleaning up old uploads: {e}")
            return cleaned

