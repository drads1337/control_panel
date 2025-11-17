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
        # Verify JWT token
        verify_jwt_in_request(optional=False)
        user_id = get_jwt_identity()
        
        if not user_id:
            return False, "Authentication required"
        
        # Import here to avoid circular imports
        from ..core.extensions import db
        from ..models.core import User
        from ..utils.rbac_utils import RBACManager
        
        user = User.query.get(user_id)
        if not user:
            return False, "User not found"
        
        # Check if file is an avatar (by checking file path)
        if "avatars" in file_path.lower() or filename.startswith("avatars/"):
            # For avatars, check if user owns the avatar or is admin/owner
            # Avatar filenames are in format: {user_id}_{uuid}.{ext}
            avatar_filename = Path(file_path).name
            try:
                # Extract user ID from avatar filename (format: {user_id}_{uuid}.{ext})
                avatar_user_id_str = avatar_filename.split("_")[0]
                avatar_user_id = int(avatar_user_id_str)
                
                # Allow access if:
                # 1. User owns the avatar
                # 2. User is owner/admin (via RBAC)
                if user.id == avatar_user_id or RBACManager.is_owner(user):
                    return True, ""
                else:
                    return False, "Access denied: insufficient permissions"
            except (ValueError, IndexError):
                # Invalid avatar filename format - deny access for security
                logging.warning(f"Invalid avatar filename format: {avatar_filename}")
                return False, "Invalid file format"
        
        # For other uploaded files, check project access
        if not user.project_id:
            return False, "User must be assigned to a project"
        
        # Files should be accessed through authorized endpoints in /api/files/
        # Direct access is only allowed for development
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
    
    # Health check is handled by monitoring.py

    # Test CORS endpoint
    @app.route("/test-cors", methods=["GET", "POST"])
    def test_cors():
        """Test CORS configuration"""
        # CORS is handled globally by Flask-CORS configuration
        return jsonify({"message": "CORS test successful", "origin": request.headers.get("Origin")})

    # SECURITY: File serving routes should be handled by Nginx/CDN in production
    # These routes are only enabled in development mode for convenience
    # In production, configure Nginx to serve /uploads/ directly from filesystem
    
    if Config.FLASK_ENV == "production":
        logging.warning(
            "File serving routes (/uploads/) are disabled in production mode. "
            "Configure Nginx/CDN to serve static files directly. "
            "All file access must go through authorized endpoints (/api/files/)."
        )
    else:
        # Serve uploaded files (development only)
        @app.route("/uploads/<path:filename>")
        def uploaded_file(filename):
            """
            Serve uploaded files with authorization check.
            
            SECURITY: This route requires authentication and proper authorization.
            In production, this route is disabled and files should be served by Nginx/CDN.
            For authorized file access, use /api/files/<filename> endpoints.
            """
            # Sanitize filename to prevent path traversal
            filename = secure_filename(filename)
            upload_dir = os.path.join(app.root_path, "uploads")
            file_path = os.path.join(upload_dir, filename)
            
            # Normalize path to prevent directory traversal
            file_path = os.path.normpath(file_path)
            upload_dir = os.path.normpath(upload_dir)
            
            # Ensure file is within upload directory
            if not file_path.startswith(upload_dir):
                logging.warning(f"Path traversal attempt detected: {filename}")
                return jsonify({"error": "Invalid file path"}), 403
            
            if not os.path.exists(file_path):
                return jsonify({"error": "File not found"}), 404
            
            # Check authorization
            is_authorized, error_msg = _check_file_access_authorization(filename, file_path)
            if not is_authorized:
                return jsonify({"error": error_msg}), 403
            
            return send_from_directory(upload_dir, filename)

        # Serve avatar files specifically (development only)
        @app.route("/uploads/avatars/<path:filename>")
        def uploaded_avatar(filename):
            """
            Serve avatar files with authorization check.
            
            SECURITY: This route requires authentication and verifies that the user
            owns the avatar or has admin privileges. In production, avatars should
            be served by Nginx/CDN with proper access control, or through authorized
            endpoints that verify ownership.
            """
            # Sanitize filename to prevent path traversal
            filename = secure_filename(filename)
            avatar_dir = os.path.join(app.root_path, Config.AVATARS_FOLDER)
            file_path = os.path.join(avatar_dir, filename)
            
            # Normalize path to prevent directory traversal
            file_path = os.path.normpath(file_path)
            avatar_dir = os.path.normpath(avatar_dir)
            
            # Ensure file is within avatar directory
            if not file_path.startswith(avatar_dir):
                logging.warning(f"Path traversal attempt detected for avatar: {filename}")
                return jsonify({"error": "Invalid file path"}), 403
            
            if not os.path.exists(file_path):
                return jsonify({"error": "Avatar file not found"}), 404
            
            # Check authorization - avatars are private files
            avatar_path_with_prefix = f"avatars/{filename}"
            is_authorized, error_msg = _check_file_access_authorization(
                avatar_path_with_prefix, file_path
            )
            if not is_authorized:
                return jsonify({"error": error_msg}), 403

            return send_from_directory(avatar_dir, filename)

    # Database replica health check endpoint
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
