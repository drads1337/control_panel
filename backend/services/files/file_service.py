"""
File Service
Handles file management operations and all file-related business logic
"""

import hashlib
import logging
import mimetypes
import os
import shutil
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from flask import current_app, send_file
from werkzeug.utils import secure_filename

from ...core.extensions import db
from ...models.core import Project, User
from ...models.products import Product, ProductExtraFile, ProductFileConfig, ProductFileDownload
from ...models.agents import Agent

class FileService:
    """Service for handling file management operations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.upload_folder = "uploads"
        self._storage_cache = {}
        self._storage_cache_ttl = 30

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        try:
            return User.query.get(user_id)
        except Exception as e:
            self.logger.error(f"Error getting user by ID {user_id}: {str(e)}")
            return None

    def validate_user_project(self, user: User) -> Tuple[bool, Optional[str]]:
        """
        Validate that user has a project assigned

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not user:
            return False, "User not found"
        if not user.project_id:
            return False, "User must be assigned to a project"
        return True, None

    def get_cached_storage_info(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Get cached storage info for a project"""
        now = time.time()
        if project_id in self._storage_cache:
            cache_time, cache_data = self._storage_cache[project_id]
            if now - cache_time < self._storage_cache_ttl:
                return cache_data
        return None

    def set_cached_storage_info(self, project_id: int, data: Dict[str, Any]) -> None:
        """Set cached storage info for a project"""
        self._storage_cache[project_id] = (time.time(), data)

    def clear_storage_cache(self, project_id: int) -> None:
        """Clear cached storage info for a project"""
        if project_id in self._storage_cache:
            del self._storage_cache[project_id]
            self.logger.debug(f"Cleared storage cache for project {project_id}")

    def allowed_file(self, filename: str) -> bool:
        """Check if file type is allowed for upload - allows all file types"""
        return bool(filename)

    def validate_file_signature(self, file_path: str, expected_extensions: Optional[List[str]] = None) -> Tuple[bool, Optional[str]]:
        """
        Validate file signature (magic bytes) to prevent file type spoofing.
        
        SECURITY: This function checks the actual file content (magic bytes) rather than
        just the file extension. This prevents attackers from uploading executable files
        with image extensions (e.g., malware.exe renamed to malware.png).
        
        Args:
            file_path: Path to the file to validate
            expected_extensions: Optional list of expected file extensions (e.g., ['png', 'jpg', 'jpeg'])
                                If None, only dangerous executable signatures are checked.
        
        Returns:
            Tuple of (is_valid, error_message)
        """


        dangerous_signatures = [
            (b'MZ', 'Windows executable (PE)'),
            (b'\x7fELF', 'Linux/Unix executable'),
            (b'\xfe\xed\xfa\xce', 'Mach-O binary (32-bit)'),
            (b'\xfe\xed\xfa\xcf', 'Mach-O binary (64-bit)'),
            (b'\xce\xfa\xed\xfe', 'Mach-O binary (32-bit, swapped)'),
            (b'\xcf\xfa\xed\xfe', 'Mach-O binary (64-bit, swapped)'),
            (b'PK\x03\x04', 'ZIP archive (could be JAR/WAR/EAR)'),
            (b'PK\x05\x06', 'ZIP archive (empty)'),
            (b'PK\x07\x08', 'ZIP archive (spanned)'),
        ]
        
        image_signatures = {
            b'\x89PNG\r\n\x1a\n': ['png'],
            b'\xff\xd8\xff': ['jpg', 'jpeg'],
            b'GIF87a': ['gif'],
            b'GIF89a': ['gif'],
            b'RIFF': ['webp'],
        }
        
        try:
            with open(file_path, 'rb') as f:

                header = f.read(12)
                
                if len(header) < 2:
                    return True, None
                

                for signature, description in dangerous_signatures:
                    if header.startswith(signature):
                        return False, f"File signature indicates {description}. This file type is not allowed for security reasons."
                

                if expected_extensions:

                    normalized_exts = [ext.lstrip('.').lower() for ext in expected_extensions]
                    

                    signature_matched = False
                    for sig_bytes, valid_exts in image_signatures.items():
                        if header.startswith(sig_bytes):

                            if sig_bytes == b'RIFF':
                                f.seek(0)
                                webp_header = f.read(12)
                                if len(webp_header) >= 12 and webp_header[8:12] == b'WEBP':
                                    signature_matched = True
                                    break
                            else:
                                signature_matched = True
                                break
                    

                    if any(ext in ['png', 'jpg', 'jpeg', 'gif', 'webp'] for ext in normalized_exts):
                        if not signature_matched:
                            return False, f"File extension suggests image file, but file signature does not match. Possible file type spoofing."

                        for sig_bytes, valid_exts in image_signatures.items():
                            if header.startswith(sig_bytes):
                                if not any(ext in valid_exts for ext in normalized_exts):
                                    return False, f"File signature indicates {valid_exts[0]} file, but extension does not match."
                                break
                
                return True, None
        except Exception as e:
            self.logger.warning(f"Error validating file signature for {file_path}: {e}")


            return True, None

    def get_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of a file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()

    def format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format"""
        if size_bytes == 0:
            return "0B"

        size_names = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1

        return f"{size_bytes:.1f}{size_names[i]}"

    def get_project_storage_usage(self, project_id: int) -> int:
        """Calculate storage usage for a specific project in bytes"""
        if not project_id:
            return 0

        try:

            try:
                upload_folder = current_app.config.get("UPLOAD_FOLDER", self.upload_folder)
                root_path = current_app.root_path
            except RuntimeError:

                upload_folder = self.upload_folder
                root_path = os.getcwd()

            project_products_path = os.path.join(root_path, upload_folder, "products", str(project_id))

            total_size = 0

            if os.path.exists(project_products_path):
                for root, dirs, files in os.walk(project_products_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if os.path.isfile(file_path):
                            total_size += os.path.getsize(file_path)

            try:
                configs_size = (
                    db.session.query(db.func.sum(ProductFileConfig.file_size))
                    .join(Product)
                    .filter(Product.project_id == project_id)
                    .scalar()
                    or 0
                )
                extra_files_size = (
                    db.session.query(db.func.sum(ProductExtraFile.file_size))
                    .join(Product)
                    .filter(Product.project_id == project_id)
                    .scalar()
                    or 0
                )
                total_size = max(total_size, configs_size + extra_files_size)
            except Exception as e:
                self.logger.debug(f"Error calculating storage from database: {e}")

            return total_size
        except Exception as e:
            self.logger.error(f"Error calculating project storage usage: {e}")
            return 0

    def check_storage_limit(self, user: User, file_size: int) -> Tuple[bool, str]:
        """
        Check if file can be uploaded based on project storage limits

        Returns:
            Tuple of (can_upload, message)
        """
        if not user.project_id:
            return False, "User not associated with any project"

        project = Project.query.get(user.project_id)
        if not project:
            return False, "Project not found"

        current_usage = self.get_project_storage_usage(user.project_id)
        available_space = project.storage_limit - current_usage

        if file_size > available_space:
            return (
                False,
                f"Insufficient storage space. Available: {self.format_file_size(available_space)}, Required: {self.format_file_size(file_size)}",
            )

        return True, "Storage limit check passed"

    def get_upload_path(self) -> str:
        """Get the base upload path"""
        try:
            upload_folder = current_app.config.get("UPLOAD_FOLDER", self.upload_folder)
            root_path = current_app.root_path
        except RuntimeError:
            upload_folder = self.upload_folder
            root_path = os.getcwd()
        return os.path.join(root_path, upload_folder)

    def list_files(
        self,
        user: User,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        file_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List files with pagination and filtering"""
        upload_path = self.get_upload_path()

        if not os.path.exists(upload_path):
            os.makedirs(upload_path)

        files_list = []
        for filename in os.listdir(upload_path):
            file_path = os.path.join(upload_path, filename)

            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                file_size = stat.st_size
                modified_time = datetime.fromtimestamp(stat.st_mtime)

                mime_type, _ = mimetypes.guess_type(filename)

                if file_type:
                    if mime_type and not mime_type.startswith(file_type):
                        continue

                if search and search.lower() not in filename.lower():
                    continue

                files_list.append(
                    {
                        "name": filename,
                        "size": file_size,
                        "size_human": self.format_file_size(file_size),
                        "modified": modified_time.isoformat(),
                        "type": mime_type or "product/octet-stream",
                        "extension": filename.rsplit(".", 1)[1].lower() if "." in filename else "",
                        "path": file_path,
                    }
                )

        files_list.sort(key=lambda x: x["modified"], reverse=True)

        total = len(files_list)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_files = files_list[start:end]

        return {
            "files": paginated_files,
            "total": total,
            "pages": (total + per_page - 1) // per_page,
            "current_page": page,
            "per_page": per_page,
        }

    def upload_file(
        self, user: User, file, filename: Optional[str] = None
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Upload a file

        Returns:
            Tuple of (file_data, error_message)
        """
        if not self.allowed_file(file.filename):
            return None, "File type not allowed"

        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)

        storage_check, storage_message = self.check_storage_limit(user, file_size)
        if not storage_check:
            return None, storage_message

        try:
            original_filename = secure_filename(file.filename)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            name, ext = os.path.splitext(original_filename)
            filename = filename or f"{name}_{timestamp}{ext}"

            upload_path = self.get_upload_path()
            if not os.path.exists(upload_path):
                os.makedirs(upload_path)

            file_path = os.path.join(upload_path, filename)
            file.save(file_path)



            ext_lower = ext.lstrip('.').lower() if ext else None
            expected_extensions = [ext_lower] if ext_lower and ext_lower in ['png', 'jpg', 'jpeg', 'gif', 'webp'] else None
            is_valid, validation_error = self.validate_file_signature(file_path, expected_extensions)
            if not is_valid:

                try:
                    os.remove(file_path)
                except Exception:
                    pass
                return None, validation_error or "File validation failed"

            file_hash = self.get_file_hash(file_path)
            stat = os.stat(file_path)
            mime_type, _ = mimetypes.guess_type(filename)

            self.clear_storage_cache(user.project_id)

            return (
                {
                    "name": filename,
                    "size": file_size,
                    "size_human": self.format_file_size(file_size),
                    "hash": file_hash,
                    "type": mime_type or "product/octet-stream",
                    "uploaded_at": datetime.utcnow().isoformat(),
                },
                None,
            )
        except Exception as e:
            self.logger.error(f"Error uploading file: {e}")
            return None, f"Failed to upload file: {str(e)}"

    def delete_file(self, user: User, filename: str) -> Tuple[bool, Optional[str]]:
        """Delete a file"""
        upload_path = self.get_upload_path()
        file_path = os.path.join(upload_path, secure_filename(filename))

        if not os.path.exists(file_path):
            return False, "File not found"

        try:
            stat = os.stat(file_path)
            file_size = stat.st_size
            os.remove(file_path)
            self.clear_storage_cache(user.project_id)
            return True, None
        except Exception as e:
            self.logger.error(f"Error deleting file: {e}")
            return False, f"Failed to delete file: {str(e)}"

    def get_file_stats(self, user: User) -> Dict[str, Any]:
        """Get file statistics"""
        upload_path = self.get_upload_path()

        if not os.path.exists(upload_path):
            return {
                "overview": {"total_files": 0, "total_size": 0, "total_size_human": "0B"},
                "type_stats": [],
                "size_stats": {"small": 0, "medium": 0, "large": 0},
            }

        total_files = 0
        total_size = 0
        type_stats = {}
        size_stats = {"small": 0, "medium": 0, "large": 0}

        for filename in os.listdir(upload_path):
            file_path = os.path.join(upload_path, filename)

            if os.path.isfile(file_path):
                total_files += 1
                file_size = os.path.getsize(file_path)
                total_size += file_size

                mime_type, _ = mimetypes.guess_type(filename)
                if mime_type:
                    main_type = mime_type.split("/")[0]
                    type_stats[main_type] = type_stats.get(main_type, 0) + 1

                if file_size < 1024 * 1024:
                    size_stats["small"] += 1
                elif file_size < 10 * 1024 * 1024:
                    size_stats["medium"] += 1
                else:
                    size_stats["large"] += 1

        storage_limit = None
        storage_usage_percent = 0
        available_space = 0

        if user.project_id:
            project = Project.query.filter_by(id=user.project_id).first()
            if project:
                storage_limit = project.storage_limit
                available_space = max(0, storage_limit - total_size)
                storage_usage_percent = (
                    round((total_size / storage_limit) * 100, 2) if storage_limit > 0 else 0
                )

        return {
            "overview": {
                "total_files": total_files,
                "total_size": total_size,
                "total_size_human": self.format_file_size(total_size),
            },
            "storage_info": {
                "storage_limit": storage_limit,
                "storage_limit_human": self.format_file_size(storage_limit) if storage_limit else None,
                "available_space": available_space,
                "available_space_human": (
                    self.format_file_size(available_space) if available_space else None
                ),
                "usage_percent": storage_usage_percent,
            },
            "type_stats": [{"type": t, "count": c} for t, c in type_stats.items()],
            "size_stats": size_stats,
        }

    def get_storage_info(self, user: User) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get storage information for user's project"""
        if not user.project_id:
            return (
                None,
                "User not associated with any project",
            )

        project = Project.query.filter_by(id=user.project_id).first()
        if not project:
            return None, "Project not found"

        cached_data = self.get_cached_storage_info(user.project_id)
        if cached_data:
            self.logger.debug(f"Returning cached storage info for project {user.project_id}")
            return cached_data, None

        try:
            current_usage = self.get_project_storage_usage(user.project_id)
            available_space = max(0, project.storage_limit - current_usage)
            usage_percent = (
                round((current_usage / project.storage_limit) * 100, 2)
                if project.storage_limit > 0
                else 0
            )

            response_data = {
                "project_name": project.name,
                "storage_limit": project.storage_limit,
                "storage_limit_gb": project.storage_limit_gb,
                "storage_limit_mb": project.storage_limit_mb,
                "current_usage": current_usage,
                "current_usage_gb": round(current_usage / (1024**3), 2),
                "current_usage_mb": round(current_usage / (1024**2), 2),
                "available_space": available_space,
                "available_space_gb": round(available_space / (1024**3), 2),
                "available_space_mb": round(available_space / (1024**2), 2),
                "usage_percent": usage_percent,
                "is_near_limit": usage_percent >= 80,
                "is_at_limit": usage_percent >= 95,
            }

            self.set_cached_storage_info(user.project_id, response_data)
            self.logger.debug(f"Cached storage info for project {user.project_id}")

            return response_data, None
        except Exception as e:
            self.logger.error(f"Failed to calculate storage info for project {user.project_id}: {str(e)}")
            return None, f"Failed to calculate storage information: {str(e)}"

    def preview_file(self, user: User, filename: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Preview a file"""
        upload_path = self.get_upload_path()
        file_path = os.path.join(upload_path, secure_filename(filename))

        if not os.path.exists(file_path):
            return None, "File not found"

        try:
            mime_type, _ = mimetypes.guess_type(filename)

            if mime_type and mime_type.startswith("text/"):
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read(1000)

                return (
                    {"type": "text", "content": content, "filename": filename, "mime_type": mime_type},
                    None,
                )

            elif mime_type and mime_type.startswith("image/"):
                stat = os.stat(file_path)

                return (
                    {
                        "type": "image",
                        "filename": filename,
                        "mime_type": mime_type,
                        "size": stat.st_size,
                        "size_human": self.format_file_size(stat.st_size),
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    },
                    None,
                )

            else:
                stat = os.stat(file_path)

                return (
                    {
                        "type": "other",
                        "filename": filename,
                        "mime_type": mime_type or "product/octet-stream",
                        "size": stat.st_size,
                        "size_human": self.format_file_size(stat.st_size),
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    },
                    None,
                )

        except Exception as e:
            self.logger.error(f"Error previewing file: {e}")
            return None, f"Failed to preview file: {str(e)}"

    def bulk_delete_files(self, user: User, filenames: List[str]) -> Tuple[int, Optional[str]]:
        """Delete multiple files"""
        upload_path = self.get_upload_path()
        deleted_count = 0

        for filename in filenames:
            file_path = os.path.join(upload_path, secure_filename(filename))

            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    deleted_count += 1
                except Exception as e:
                    self.logger.debug(f"Failed to delete {filename}: {str(e)}")

        self.clear_storage_cache(user.project_id)
        return deleted_count, None

    def get_product_configs(
        self, user: User, product_id: int
    ) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        """Get product configs"""
        try:
            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product or product.project_id != user.project_id:
                return None, "Product not found"

            configs = ProductFileConfig.query.filter_by(product_id=product_id, is_active=True).all()

            configs_data = []
            for config in configs:
                uploader = User.query.filter_by(
                    id=config.uploaded_by, project_id=user.project_id
                ).first()
                configs_data.append(
                    {
                        "id": config.id,
                        "config_id": config.config_id,
                        "name": config.name,
                        "description": config.description,
                        "file_type": config.file_type,
                        "size": config.file_size,
                        "version": config.version,
                        "uploaded_by": uploader.username if uploader else "Unknown",
                        "download_count": config.download_count,
                        "rating": config.rating,
                        "rating_count": config.rating_count,
                        "uploaded_at": config.uploaded_at.isoformat(),
                        "content_hash": config.content_hash,
                    }
                )

            return configs_data, None
        except Exception as e:
            self.logger.error(f"Error getting product configs: {e}")
            return None, f"Failed to fetch configs: {str(e)}"

    def get_product_extra_files(
        self, user: User, product_id: int
    ) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        """Get product extra files"""
        try:
            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product or product.project_id != user.project_id:
                return None, "Product not found"

            extra_files = ProductExtraFile.query.filter_by(product_id=product_id, is_active=True).all()

            files_data = []
            for file in extra_files:
                uploader = User.query.filter_by(id=file.uploaded_by, project_id=user.project_id).first()
                files_data.append(
                    {
                        "id": file.id,
                        "name": file.name,
                        "description": file.description,
                        "file_type": file.file_type,
                        "size": file.file_size,
                        "status": file.status,
                        "download_count": file.download_count,
                        "uploaded_by": uploader.username if uploader else "Unknown",
                        "uploaded_at": file.uploaded_at.isoformat(),
                        "content_hash": file.content_hash,
                    }
                )

            return files_data, None
        except Exception as e:
            self.logger.error(f"Error getting product extra files: {e}")
            return None, f"Failed to fetch extra files: {str(e)}"

    def get_product_storage_info(
        self, user: User, product_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get storage info for a specific product"""
        try:
            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product or product.project_id != user.project_id:
                return None, "Product not found"

            configs_size = (
                db.session.query(db.func.sum(ProductFileConfig.file_size))
                .filter_by(product_id=product_id)
                .scalar()
                or 0
            )
            extra_files_size = (
                db.session.query(db.func.sum(ProductExtraFile.file_size))
                .filter_by(product_id=product_id)
                .scalar()
                or 0
            )
            total_size = configs_size + extra_files_size

            configs_count = ProductFileConfig.query.filter_by(product_id=product_id).count()
            extra_files_count = ProductExtraFile.query.filter_by(product_id=product_id).count()
            total_files = configs_count + extra_files_count

            return (
                {
                    "product_id": product_id,
                    "product_name": product.name,
                    "total_files": total_files,
                    "configs_count": configs_count,
                    "extra_files_count": extra_files_count,
                    "total_size": total_size,
                    "total_size_human": self.format_file_size(total_size),
                    "configs_size": configs_size,
                    "configs_size_human": self.format_file_size(configs_size),
                    "extra_files_size": extra_files_size,
                    "extra_files_size_human": self.format_file_size(extra_files_size),
                },
                None,
            )
        except Exception as e:
            self.logger.error(f"Error getting product storage info: {e}")
            return None, f"Failed to get storage info: {str(e)}"

    def get_file_path_for_download(self, filename: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Get file path for download

        Returns:
            Tuple of (file_path, error_message)
        """
        upload_path = self.get_upload_path()
        file_path = os.path.join(upload_path, secure_filename(filename))

        if not os.path.exists(file_path):
            return None, "File not found"

        return file_path, None

    def get_file_size(self, file_path: str) -> int:
        """
        Get file size in bytes

        Returns:
            File size in bytes, or 0 if file doesn't exist
        """
        if file_path and os.path.exists(file_path):
            try:
                return os.stat(file_path).st_size
            except Exception:
                return 0
        return 0

    def get_product_file_path(self, product: Product, file_type: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Get product file path (logo, banner, agent, background)

        Returns:
            Tuple of (file_path, filename, error_message)
        """
        if file_type == "logo" and product.logo:
            file_path = os.path.join(self.get_upload_path(), product.logo)
            filename = f"{product.name}_logo.png"
        elif file_type == "banner" and product.banner:
            file_path = os.path.join(self.get_upload_path(), product.banner)
            filename = f"{product.name}_banner.png"
        elif file_type == "agent" and product.loader_file:
            file_path = os.path.join(self.get_upload_path(), product.loader_file)
            filename = f"{product.name}_loader.exe"
        elif file_type == "background" and product.backgrounds:

            try:
                import json
                backgrounds_list = json.loads(product.backgrounds)
                if isinstance(backgrounds_list, list) and len(backgrounds_list) > 0:
                    background_file = backgrounds_list[0] if isinstance(backgrounds_list[0], str) else str(backgrounds_list[0])
                    file_path = os.path.join(self.get_upload_path(), background_file)
                    filename = f"{product.name}_background.png"
                else:
                    return None, None, "File not found"
            except:

                file_path = os.path.join(self.get_upload_path(), product.backgrounds)
                filename = f"{product.name}_background.png"
        else:
            return None, None, "File not found"

        if not os.path.exists(file_path):
            return None, None, "File not found on disk"

        return file_path, filename, None

    def delete_product_file(self, product: Product, file_type: str) -> Tuple[bool, Optional[str]]:
        """
        Delete product file (logo, banner, agent)

        Returns:
            Tuple of (success, error_message)
        """
        file_path, _, error = self.get_product_file_path(product, file_type)
        if error:
            return False, error

        field_to_clear = None
        if file_type == "logo":
            field_to_clear = "logo"
        elif file_type == "banner":
            field_to_clear = "banner"
        elif file_type == "agent":
            field_to_clear = "loader_file"

        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)

            if field_to_clear:
                setattr(product, field_to_clear, None)
                db.session.commit()

            self.clear_storage_cache(product.project_id)
            return True, None
        except Exception as e:
            self.logger.error(f"Error deleting product file: {e}")
            return False, f"Failed to delete file: {str(e)}"

    def create_folder(self, folder_name: str, parent_path: str = "/", product_id: Optional[int] = None) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Create a folder

        Returns:
            Tuple of (success, error_message, folder_data)
        """
        if not folder_name:
            return False, "Folder name is required", None

        base_path = self.get_upload_path()
        if product_id:
            base_path = os.path.join(base_path, "products", str(product_id))

        folder_path = os.path.join(base_path, parent_path.lstrip("/"), folder_name)

        try:
            os.makedirs(folder_path, exist_ok=True)
            return True, None, {
                "name": folder_name,
                "path": folder_path,
                "created_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            self.logger.error(f"Error creating folder: {e}")
            return False, f"Failed to create folder: {str(e)}", None

    def delete_folder(self, folder_path: str) -> Tuple[bool, Optional[str]]:
        """
        Delete a folder

        Returns:
            Tuple of (success, error_message)
        """
        base_path = self.get_upload_path()
        full_folder_path = os.path.join(base_path, secure_filename(folder_path))

        if not os.path.exists(full_folder_path):
            return False, "Folder not found"

        if not os.path.isdir(full_folder_path):
            return False, "Path is not a directory"

        try:
            shutil.rmtree(full_folder_path)
            return True, None
        except Exception as e:
            self.logger.error(f"Error deleting folder: {e}")
            return False, f"Failed to delete folder: {str(e)}"

    def download_product_config(self, config: ProductFileConfig, user: User, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Tuple[Optional[Any], Optional[str]]:
        """
        Download product config file

        Returns:
            Tuple of (send_file_response, error_message)
        """
        if not os.path.exists(config.file_path):
            return None, "File not found on disk"

        try:
            config.download_count += 1

            download_log = ProductFileDownload(
                file_id=config.id,
                file_type="config",
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.session.add(download_log)
            db.session.commit()

            return send_file(config.file_path, as_attachment=True, download_name=config.name), None
        except Exception as e:
            self.logger.error(f"Error downloading product config: {e}")
            return None, f"Failed to download config: {str(e)}"

    def download_product_extra_file(self, extra_file: ProductExtraFile) -> Tuple[Optional[Any], Optional[str]]:
        """
        Download product extra file

        Returns:
            Tuple of (send_file_response, error_message)
        """
        if not os.path.exists(extra_file.file_path):
            return None, "File not found on disk"

        try:
            extra_file.download_count += 1
            db.session.commit()

            return send_file(
                extra_file.file_path, as_attachment=True, download_name=extra_file.original_filename
            ), None
        except Exception as e:
            self.logger.error(f"Error downloading product extra file: {e}")
            return None, f"Failed to download file: {str(e)}"

    def upload_product_config(
        self,
        user: User,
        file,
        product: Product,
        name: str,
        description: str,
        version: str,
        is_public: bool,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Upload product config file

        Returns:
            Tuple of (config_data, error_message)
        """
        if file.filename == "":
            return None, "No file selected"

        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)

        can_upload, message = self.check_storage_limit(user, file_size)
        if not can_upload:
            return None, message

        try:
            timestamp = int(time.time())
            filename = secure_filename(file.filename)
            name_part, ext = os.path.splitext(filename)
            filename = f"{name_part}_{timestamp}{ext}"

            upload_path = os.path.join(
                self.get_upload_path(), "products", str(product.id), "configs"
            )
            if not os.path.exists(upload_path):
                os.makedirs(upload_path)

            file_path = os.path.join(upload_path, filename)
            file.save(file_path)



            is_valid, validation_error = self.validate_file_signature(file_path, None)
            if not is_valid:

                try:
                    os.remove(file_path)
                except Exception:
                    pass
                return None, validation_error or "File validation failed: executable files are not allowed as config files"

            file_hash = self.get_file_hash(file_path)
            file_type = ext.lstrip(".").lower()

            from ...models.utils import generate_config_id
            config_id = generate_config_id()

            display_name = name if name else file.filename

            config = ProductFileConfig(
                config_id=config_id,
                product_id=product.id,
                name=display_name,
                description=description,
                file_path=file_path,
                file_size=file_size,
                file_type=file_type,
                content_hash=file_hash,
                uploaded_by=user.id,
                version=version,
                is_public=is_public,
            )

            db.session.add(config)
            db.session.commit()

            self.clear_storage_cache(user.project_id)

            return {
                "id": config.id,
                "config_id": config.config_id,
                "name": config.name,
                "size": config.file_size,
                "hash": config.content_hash,
                "type": config.file_type,
                "uploaded_at": config.uploaded_at.isoformat(),
            }, None
        except Exception as e:
            self.logger.error(f"Error uploading product config: {e}")
            return None, f"Failed to upload product config: {str(e)}"

    def upload_product_extra_file(
        self,
        user: User,
        file,
        product: Product,
        name: str,
        description: str,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Upload product extra file

        Returns:
            Tuple of (file_data, error_message)
        """
        if file.filename == "":
            return None, "No file selected"

        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)

        can_upload, message = self.check_storage_limit(user, file_size)
        if not can_upload:
            return None, message

        try:
            original_filename = file.filename

            timestamp = int(time.time())
            filename = secure_filename(file.filename)
            name_part, ext = os.path.splitext(filename)
            unique_filename = f"{name_part}_{timestamp}{ext}"

            upload_path = os.path.join(
                self.get_upload_path(), "products", str(product.id), "extra"
            )
            if not os.path.exists(upload_path):
                os.makedirs(upload_path)

            file_path = os.path.join(upload_path, unique_filename)
            file.save(file_path)



            is_valid, validation_error = self.validate_file_signature(file_path, None)
            if not is_valid:

                try:
                    os.remove(file_path)
                except Exception:
                    pass
                return None, validation_error or "File validation failed: executable files are not allowed as extra files"

            file_hash = self.get_file_hash(file_path)
            file_type = ext.lstrip(".").lower()

            extra_file = ProductExtraFile(
                product_id=product.id,
                name=name or original_filename,
                original_filename=original_filename,
                description=description,
                file_path=file_path,
                file_size=file_size,
                file_type=file_type,
                content_hash=file_hash,
                uploaded_by=user.id,
                status="active",
                is_active=True,
            )

            db.session.add(extra_file)
            db.session.commit()

            self.clear_storage_cache(user.project_id)

            return {
                "id": extra_file.id,
                "name": extra_file.name,
                "size": extra_file.file_size,
                "hash": extra_file.content_hash,
                "type": extra_file.file_type,
                "uploaded_at": extra_file.uploaded_at.isoformat(),
            }, None
        except Exception as e:
            self.logger.error(f"Error uploading product extra file: {e}")
            return None, f"Failed to upload product extra file: {str(e)}"

    def delete_product_config(self, config: ProductFileConfig, user: User) -> Tuple[bool, Optional[str]]:
        """
        Delete product config

        Returns:
            Tuple of (success, error_message)
        """
        try:
            if os.path.exists(config.file_path):
                os.remove(config.file_path)

            db.session.delete(config)
            db.session.commit()

            self.clear_storage_cache(user.project_id)
            return True, None
        except Exception as e:
            self.logger.error(f"Error deleting product config: {e}")
            return False, f"Failed to delete product config: {str(e)}"

    def delete_product_extra_file(self, extra_file: ProductExtraFile, user: User) -> Tuple[bool, Optional[str]]:
        """
        Delete product extra file

        Returns:
            Tuple of (success, error_message)
        """
        try:
            if os.path.exists(extra_file.file_path):
                os.remove(extra_file.file_path)

            db.session.delete(extra_file)
            db.session.commit()

            self.clear_storage_cache(user.project_id)
            return True, None
        except Exception as e:
            self.logger.error(f"Error deleting product extra file: {e}")
            return False, f"Failed to delete product extra file: {str(e)}"

