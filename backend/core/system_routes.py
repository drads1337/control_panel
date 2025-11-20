"""
System routes module
Contains health checks, file serving, and other system-level endpoints

SECURITY NOTE: File serving routes are only enabled in development mode.
In production, static file serving should be handled by Nginx/CDN directly.
All file access must go through authorized endpoints with proper access control.
"""

import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from werkzeug.utils import secure_filename

from ..config.config import Config
from ..middleware.production_guard import development_only

def _check_file_access_authorization(filename: str, file_path: str) -> tuple[bool, str]:
    """
    Check if the current user has authorization to access the file.

    Args:
        filename: The filename being accessed
        file_path: Full path to the file

    Returns:
        Tuple of (is_authorized, error_message)
    """
    try:

        verify_jwt_in_request(optional=False)
        user_id = get_jwt_identity()

        if not user_id:
            return False, "Authentication required"

        from ..core.extensions import db
        from ..models.core import User
        from ..utils.rbac_utils import RBACManager

        user = User.query.get(user_id)
        if not user:
            return False, "User not found"

        if "avatars" in file_path.lower() or filename.startswith("avatars/"):

            avatar_filename = Path(file_path).name
            try:

                avatar_user_id_str = avatar_filename.split("_")[0]
                avatar_user_id = int(avatar_user_id_str)

                if user.id == avatar_user_id or RBACManager.is_owner(user):
                    return True, ""
                else:
                    return False, "Access denied: insufficient permissions"
            except (ValueError, IndexError):

                logging.warning(f"Invalid avatar filename format: {avatar_filename}")
                return False, "Invalid file format"

        if not user.project_id:
            return False, "User must be assigned to a project"

        return True, ""

    except Exception as e:
        logging.error(f"Authorization check failed: {str(e)}")
        return False, "Authentication required"

def register_system_routes(app: Flask) -> None:
    """
    Register system-level routes (health checks, file serving, etc.)

    Args:
        app: Flask application instance

    SECURITY: File serving routes are disabled in production mode.
    In production, use Nginx/CDN to serve static files directly from filesystem.
    """

    from ..middleware.production_guard import development_only

    @app.route("/test-cors", methods=["GET", "POST"])
    @development_only
    def test_cors():
        """Test CORS configuration"""

        return jsonify({"message": "CORS test successful", "origin": request.headers.get("Origin")})

    # Avatar route is always enabled (even in production) because avatars require
    # authorization checks to ensure users can only access their own avatars
    @app.route("/uploads/avatars/<path:filename>")
    def uploaded_avatar(filename):
            """
            Serve avatar files with authorization check.

            SECURITY: This route requires authentication and verifies that the user
            owns the avatar or has admin privileges. In production, avatars should
            be served by Nginx/CDN with proper access control, or through authorized
            endpoints that verify ownership.
            """

            filename = secure_filename(filename)
            
            # Use consistent absolute path resolution
            # Get project root (parent of backend directory where app.root_path typically points)
            project_root = Path(app.root_path).parent
            # Config.AVATARS_FOLDER is "uploads/avatars" (relative), so split and join properly
            avatars_folder_abs = project_root / "uploads" / "avatars"
            avatars_folder_abs_str = str(avatars_folder_abs)
        
            # Try the most likely path first (project root uploads/avatars)
            # This is where files are actually saved
            primary_path = os.path.normpath(os.path.join(avatars_folder_abs_str, filename))
            
            possible_dirs = [
                avatars_folder_abs_str,  # Primary location - checked first
                os.path.join(app.root_path, "uploads", "avatars"),
                os.path.join(os.path.dirname(app.root_path), "uploads", "avatars"),
                os.path.join(os.getcwd(), "uploads", "avatars"),
                # Fallback with Config.AVATARS_FOLDER
                os.path.join(str(project_root), Config.AVATARS_FOLDER),
            ]
            
            # Normalize all paths for comparison and remove duplicates
            possible_dirs = [os.path.normpath(os.path.abspath(d)) for d in possible_dirs]
            possible_dirs = list(dict.fromkeys(possible_dirs))  # Remove duplicates while preserving order
            
            # Quick check: if primary path exists, use it immediately
            avatar_dir = None
            file_path = None
            
            if os.path.exists(primary_path):
                real_dir = os.path.realpath(avatars_folder_abs_str)
                real_test = os.path.realpath(primary_path)
                if real_test.startswith(real_dir):
                    avatar_dir = avatars_folder_abs_str
                    file_path = primary_path
                    logging.info(f"✅ Found avatar immediately at primary path: {file_path}")
                    # Skip the loop below
                    possible_dirs = []
            
            logging.info(f"Looking for avatar: {filename}")
            logging.info(f"app.root_path: {app.root_path}")
            logging.info(f"Current working directory: {os.getcwd()}")
            logging.info(f"Checking directories: {possible_dirs}")
            
            for dir_path in possible_dirs:
                test_path = os.path.normpath(os.path.join(dir_path, filename))
                
                # Security check: ensure file path is within the directory
                # Use realpath to resolve symlinks for accurate comparison
                try:
                    real_dir = os.path.realpath(dir_path)
                    real_test = os.path.realpath(test_path)
                    if not real_test.startswith(real_dir):
                        logging.warning(f"Path traversal attempt: {test_path} not in {dir_path}")
                        continue
                except OSError:
                    # If realpath fails, fall back to string comparison
                    if not test_path.startswith(dir_path):
                        logging.warning(f"Path traversal attempt: {test_path} not in {dir_path}")
                        continue
                
                logging.info(f"Checking: {test_path} (exists: {os.path.exists(test_path)})")
                if os.path.exists(test_path):
                    avatar_dir = dir_path
                    file_path = test_path
                    logging.info(f"✅ Found avatar at: {file_path}")
                    break
            
            if not avatar_dir or not file_path:
                # Last resort: try direct path from project root
                direct_path = os.path.join(str(project_root), "uploads", "avatars", filename)
                direct_path = os.path.normpath(os.path.abspath(direct_path))
                logging.info(f"Trying direct path as last resort: {direct_path} (exists: {os.path.exists(direct_path)})")
                
                if os.path.exists(direct_path):
                    # Security check for direct path
                    real_dir = os.path.realpath(os.path.join(str(project_root), "uploads", "avatars"))
                    real_test = os.path.realpath(direct_path)
                    if real_test.startswith(real_dir):
                        avatar_dir = os.path.join(str(project_root), "uploads", "avatars")
                        file_path = direct_path
                        logging.info(f"✅ Found avatar via direct path: {file_path}")
                    else:
                        logging.warning(f"Path traversal attempt detected for direct path: {direct_path}")
                else:
                    logging.warning(f"Avatar file not found: {filename}")
                    logging.warning(f"Checked directories: {possible_dirs}")
                    logging.warning(f"app.root_path: {app.root_path}")
                    logging.warning(f"Current working directory: {os.getcwd()}")
                    logging.warning(f"Direct path also failed: {direct_path}")
                    return jsonify({"error": "Resource not found"}), 404

            avatar_path_with_prefix = f"avatars/{filename}"
            is_authorized, error_msg = _check_file_access_authorization(
                avatar_path_with_prefix, file_path
            )
            if not is_authorized:
                return jsonify({"error": error_msg}), 403

            return send_from_directory(avatar_dir, filename)

    # General uploads route - only enabled in development
    # In production, use Nginx/CDN for non-sensitive files or /api/files/ for authorized access
    if Config.FLASK_ENV != "production":
        @app.route("/uploads/<path:filename>")
        def uploaded_file(filename):
            """
            Serve uploaded files with authorization check.

            SECURITY: This route requires authentication and proper authorization.
            In production, this route is disabled and files should be served by Nginx/CDN.
            For authorized file access, use /api/files/<filename> endpoints.
            """

            filename = secure_filename(filename)
            upload_dir = os.path.join(app.root_path, "uploads")
            file_path = os.path.join(upload_dir, filename)

            file_path = os.path.normpath(file_path)
            upload_dir = os.path.normpath(upload_dir)

            if not file_path.startswith(upload_dir):
                logging.warning(f"Path traversal attempt detected: {filename}")
                return jsonify({"error": "Invalid file path"}), 403

            if not os.path.exists(file_path):
                return jsonify({"error": "File not found"}), 404

            is_authorized, error_msg = _check_file_access_authorization(filename, file_path)
            if not is_authorized:
                return jsonify({"error": error_msg}), 403

            return send_from_directory(upload_dir, filename)
    else:
        logging.info(
            "General file serving route (/uploads/) is disabled in production mode. "
            "Avatar route (/uploads/avatars/) is enabled for authorized access. "
            "For other files, use Nginx/CDN or /api/files/ endpoints."
        )

    @app.route("/api/db/replica-health", methods=["GET"])
    def replica_health():
        """Check database replica health and status"""
        try:
            from ..utils.db_replica import check_replica_health

            health_status = check_replica_health()
            return jsonify(health_status), 200
        except Exception as e:
            logging.error(f"Error checking replica health: {e}")
            return jsonify({"error": "Failed to check replica health", "message": str(e)}), 500
