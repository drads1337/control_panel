"""
Profile Management Routes
Handles user profile operations, avatar management, and personal settings
"""

import io
import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from PIL import Image
from sqlalchemy import case, func
from werkzeug.utils import secure_filename

from ..core.extensions import db
from ..models.core import User, UserActivity
from ..models.keys import Key

from ..utils.service_helpers import get_user_profile_service, get_service
from ..middleware.auth import (
    require_project_assignment,
    require_project_isolation,
    require_user,
)
from ..middleware.serialization import serialize_response
from ..utils.rbac_utils import RBACManager
from ..config.config import Config
from ..schemas.user import UserPrivateResponse

profile_bp = Blueprint("profile", __name__)



_project_root = Path(__file__).parent.parent.parent
UPLOAD_FOLDER = os.path.join(_project_root, "uploads", "avatars")
ALLOWED_EXTENSIONS = Config.ALLOWED_AVATAR_EXTENSIONS
MAX_SIZE = Config.MAX_AVATAR_DIMENSIONS

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def process_image(file_stream, crop_data=None):
    """Process and optimize uploaded image with security improvements
    
    Note: If image is already cropped on frontend (512x512), crop_data is ignored.
    Image is always resized to MAX_SIZE (300x300) maintaining square aspect ratio.
    """
    try:
        image = Image.open(file_stream)
        

        if image.mode != "RGBA":
            image = image.convert("RGBA")



        if crop_data:
            try:
                x = float(crop_data.get("x", 0))
                y = float(crop_data.get("y", 0))
                width = float(crop_data.get("width", image.width))
                height = float(crop_data.get("height", image.height))

                if width > 0 and height > 0:

                    x = max(0, min(x, image.width))
                    y = max(0, min(y, image.height))
                    width = max(1, min(width, image.width - x))
                    height = max(1, min(height, image.height - y))
                    image = image.crop((x, y, x + width, y + height))
            except Exception as e:
                logging.debug(f"Error during cropping: {str(e)}")


        width, height = image.size
        

        target_size = MAX_SIZE[0]
        



        if width != target_size or height != target_size:

            if width == height:

                image = image.resize((target_size, target_size), Image.Resampling.LANCZOS)
            else:

                scale = min(target_size / width, target_size / height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                

                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                

                if new_width != target_size or new_height != target_size:
                    left = max(0, (new_width - target_size) // 2)
                    top = max(0, (new_height - target_size) // 2)
                    right = min(new_width, left + target_size)
                    bottom = min(new_height, top + target_size)
                    image = image.crop((left, top, right, bottom))
                    

                    if image.size[0] != target_size or image.size[1] != target_size:
                        image = image.resize((target_size, target_size), Image.Resampling.LANCZOS)


        new_image = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
        new_image.paste(image, (0, 0), image)


        buffer = io.BytesIO()
        new_image.save(buffer, format="PNG", optimize=True)
        buffer.seek(0)
        return buffer
    except Exception as e:
        logging.error(f"Error processing image: {str(e)}", exc_info=True)
        return None

@profile_bp.route("/me", methods=["GET"])
@jwt_required()
@require_user
@require_project_assignment
@serialize_response(UserPrivateResponse)
def get_me(current_user):
    """Get current user profile with optimized queries"""

    user = current_user

    key_stats = (
        db.session.query(
            func.count(Key.id).label("total_keys"),
            func.sum(case((Key.status == 1, 1), else_=0)).label("active_keys"),
        )
        .filter(Key.user_id == user.id)
        .first()
    )

    keys_count = key_stats.total_keys if key_stats else 0
    active_keys = key_stats.active_keys if key_stats else 0

    user_roles = RBACManager.get_user_role_names(user)
    primary_role = user_roles[0] if user_roles else "client"

    user_permissions = []
    try:


        rbac_service = get_service('rbac_service')
        permissions_set = rbac_service.get_user_permissions(user.id)
        user_permissions = list(permissions_set) if permissions_set else []
        logging.debug(
            f"PROFILE_ME_PERMISSIONS user_id={user.id} permissions_count={len(user_permissions)} roles={user_roles}"
        )
    except Exception as e:
        logging.error(f"Failed to get user permissions for user {user.id}: {e}", exc_info=True)
        user_permissions = []

    setattr(user, "role", primary_role)
    setattr(user, "roles", user_roles)
    setattr(user, "permissions", user_permissions)
    setattr(user, "keys_count", keys_count)
    setattr(user, "active_keys", active_keys)
    setattr(user, "is_admin", RBACManager.is_admin(user))
    setattr(user, "needs_project_assignment", False)

    return user

@profile_bp.route("/update", methods=["PUT"])
@jwt_required()
@require_user
@require_project_assignment
def update_profile(current_user):
    """Update user profile information"""

    user = current_user
    data = request.get_json()

    if not data:


        activity_service = get_service('activity_service')
        return jsonify({"error": "No data provided"}), 400


    user_profile_service = get_user_profile_service()
    success, error = user_profile_service.update_user_profile(user, data)

    if not success:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        user,
        "profile_update",
        ip=request.remote_addr,
        details="Profile updated",
        user_agent=request.headers.get("User-Agent"),
        session_id=request.headers.get("X-Session-ID"),
    )

    return jsonify(
        {
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "bio": user.bio,
                "email": user.email,
            },
        }
    )

@profile_bp.route("/change_password", methods=["POST"])
@jwt_required()
@require_user
@require_project_assignment
def change_password(current_user):
    """Change user password with security validation"""

    user = current_user
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        return jsonify({"error": "Current password and new password are required"}), 400

    try:
        from .settings import get_or_create_project_settings

        if user.project_id:
            settings = get_or_create_project_settings(user.project_id)
            min_length = settings.min_password_length
            complexity_required = settings.password_complexity_required
        else:
            min_length = 6
            complexity_required = False
    except ImportError:
        min_length = 6
        complexity_required = False

    from ..utils.validators import AuthValidator

    is_valid, error_msg = AuthValidator.validate_password(
        new_password, min_length=min_length, complexity_required=complexity_required
    )

    if not is_valid:
        return jsonify({"error": error_msg}), 400


    user_profile_service = get_user_profile_service()
    success, error = user_profile_service.change_password(user, current_password, new_password)

    if not success:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        user,
        "password_change",
        ip=request.remote_addr,
        details="Password successfully changed",
        user_agent=request.headers.get("User-Agent"),
        session_id=request.headers.get("X-Session-ID"),
    )

    return jsonify({"message": "Password changed successfully"})

@profile_bp.route("/avatar", methods=["POST"])
@jwt_required()
@require_user
@require_project_assignment
def upload_avatar(current_user):
    """Upload user avatar with enhanced security"""

    user = current_user

    if "avatar" not in request.files:


        file_service = get_service('file_service')
        return jsonify({"error": "No file provided"}), 400

    file = request.files["avatar"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    if file_size > Config.MAX_AVATAR_SIZE:
        max_size_mb = Config.MAX_AVATAR_SIZE / (1024 * 1024)
        return jsonify({"error": f"File too large. Maximum size is {max_size_mb}MB"}), 400

    try:


        

        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            file.seek(0)
            temp_file.write(file.read())
            temp_file_path = temp_file.name
        
        try:

            expected_extensions = [ext.lstrip('.').lower() for ext in ALLOWED_EXTENSIONS]
            is_valid, validation_error = file_service.validate_file_signature(temp_file_path, expected_extensions)
            
            if not is_valid:
                os.unlink(temp_file_path)
                return jsonify({"error": validation_error or "Invalid file type: file signature validation failed"}), 400
            

            file.seek(0)
        except Exception as validation_exception:
            os.unlink(temp_file_path)
            logging.error(f"File signature validation error: {str(validation_exception)}")
            return jsonify({"error": "File validation failed"}), 400
        finally:

            try:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
            except Exception:
                pass
        
        crop_data = request.form.get("crop_data")
        if crop_data:
            import json

            crop_data = json.loads(crop_data)

        processed_image = process_image(file.stream, crop_data)
        if not processed_image:
            return jsonify({"error": "Failed to process image"}), 500

        filename = f"{user.id}_{uuid.uuid4().hex}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)


        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        with open(filepath, "wb") as f:
            f.write(processed_image.getvalue())

        old_avatar = user.avatar
        user.avatar = filename
        db.session.commit()

        if old_avatar:
            old_filepath = os.path.join(UPLOAD_FOLDER, old_avatar)
            if os.path.exists(old_filepath):
                os.remove(old_filepath)

        activity_service.log_activity(
            user,
            "avatar_upload",
            ip=request.remote_addr,
            details="Avatar successfully uploaded",
            user_agent=request.headers.get("User-Agent"),
            session_id=request.headers.get("X-Session-ID"),
        )

        return jsonify({"message": "Avatar uploaded successfully", "avatar": filename})

    except Exception as e:
        logging.error(f"Avatar upload error: {str(e)}")
        return jsonify({"error": f"Failed to upload avatar: {str(e)}"}), 500

@profile_bp.route("/avatar", methods=["DELETE"])
@jwt_required()
@require_user
@require_project_assignment
def remove_avatar(current_user):
    """Remove user avatar"""

    user = current_user

    if user.avatar:
        filepath = os.path.join(UPLOAD_FOLDER, user.avatar)
        if os.path.exists(filepath):
            os.remove(filepath)

        user.avatar = None
        db.session.commit()

        activity_service.log_activity(user, "remove_avatar", ip=request.remote_addr)
        return jsonify({"message": "Avatar removed successfully"})

    return jsonify({"message": "No avatar to remove"})

@profile_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_user
@require_project_assignment
@require_project_isolation
def get_my_stats(current_user):
    """Get current user statistics with optimized queries"""

    user = current_user

    key_stats = (
        db.session.query(
            func.count(Key.id).label("total_keys"),
            func.sum(case((Key.status == 1, 1), else_=0)).label("active_keys"),
        )
        .filter(Key.user_id == user.id)
        .first()
    )

    total_keys = key_stats.total_keys if key_stats else 0
    active_keys = key_stats.active_keys if key_stats else 0

    active_users = (
        db.session.query(Key.fingerprint)
        .filter(Key.user_id == user.id, Key.fingerprint.isnot(None), Key.fingerprint != "")
        .distinct()
        .count()
    )

    activated_keys = Key.query.filter(Key.user_id == user.id, Key.activated_at.isnot(None)).count()

    expired_keys = Key.query.filter(
        Key.user_id == user.id, Key.expires_at <= datetime.utcnow()
    ).count()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    keys_30d = Key.query.filter(Key.user_id == user.id, Key.created_at >= thirty_days_ago).count()

    activity_count = UserActivity.query.filter_by(user_id=user.id).count()
    recent_activity = UserActivity.query.filter(
        UserActivity.user_id == user.id, UserActivity.created_at >= thirty_days_ago
    ).count()

    from ..models.core import DeveloperProductPermission, UserProductPermission

    product_permissions = UserProductPermission.query.filter_by(user_id=user.id).count()
    developer_permissions = DeveloperProductPermission.query.filter_by(user_id=user.id).count()

    user_roles = RBACManager.get_user_role_names(user)
    primary_role = user_roles[0] if user_roles else "client"

    return jsonify(
        {
            "user": {
                "id": user.unique_id,
                "username": user.username,
                "role": primary_role,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            "keys": {
                "total": total_keys,
                "active_users": active_users,
                "activated_keys": activated_keys,
                "expired": expired_keys,
                "last_30_days": keys_30d,
            },
            "activity": {"total": activity_count, "last_30_days": recent_activity},
            "permissions": {"products": product_permissions, "developer_products": developer_permissions},
            "balance": {"tokens": user.token_balance},
        }
    )

@profile_bp.route("/activity", methods=["GET"])
@jwt_required()
@require_user
@require_project_assignment
@require_project_isolation
def get_user_activity(current_user):
    """Get user activity with pagination"""

    user = current_user

    try:
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)

        query = UserActivity.query.filter_by(user_id=user.id)
        query = query.order_by(UserActivity.created_at.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        activities = [activity.to_dict() for activity in pagination.items]

        return jsonify(
            {
                "activities": activities,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch user activity: {str(e)}"}), 500

@profile_bp.route("/activity/stats", methods=["GET"])
@jwt_required()
@require_user
@require_project_assignment
@require_project_isolation
def get_user_activity_stats(current_user):
    """Get user activity statistics"""

    user = current_user

    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)

        total_activities = UserActivity.query.filter_by(user_id=user.id).count()

        today_activities = UserActivity.query.filter(
            UserActivity.user_id == user.id, UserActivity.created_at >= today_start
        ).count()

        week_activities = UserActivity.query.filter(
            UserActivity.user_id == user.id, UserActivity.created_at >= week_start
        ).count()

        month_activities = UserActivity.query.filter(
            UserActivity.user_id == user.id, UserActivity.created_at >= month_start
        ).count()

        unique_ips = (
            db.session.query(func.count(func.distinct(UserActivity.ip_address)))
            .filter(UserActivity.user_id == user.id, UserActivity.ip_address.isnot(None))
            .scalar()
            or 0
        )

        unique_locations = (
            db.session.query(
                func.count(func.distinct(func.concat(UserActivity.country, "-", UserActivity.city)))
            )
            .filter(UserActivity.user_id == user.id, UserActivity.country.isnot(None))
            .scalar()
            or 0
        )

        last_activity = (
            UserActivity.query.filter_by(user_id=user.id)
            .order_by(UserActivity.created_at.desc())
            .first()
        )

        last_activity_time = last_activity.created_at.isoformat() if last_activity else None

        return jsonify(
            {
                "total_activities": total_activities,
                "today_activities": today_activities,
                "week_activities": week_activities,
                "month_activities": month_activities,
                "unique_ips": unique_ips,
                "unique_locations": unique_locations,
                "last_activity": last_activity_time,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch user activity stats: {str(e)}"}), 500

@profile_bp.route("/activity/export", methods=["GET"])
@jwt_required()
@require_user
@require_project_assignment
@require_project_isolation
def export_user_activity(current_user):
    """Export user activity to CSV"""

    user = current_user

    try:
        import csv
        from io import StringIO

        from flask import Response

        days = request.args.get("days", 30, type=int)
        if days > 365:
            days = 365

        start_date = datetime.utcnow() - timedelta(days=days)

        activities = (
            UserActivity.query.filter(
                UserActivity.user_id == user.id, UserActivity.created_at >= start_date
            )
            .order_by(UserActivity.created_at.desc())
            .all()
        )

        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            ["Date", "Action", "IP Address", "Country", "City", "Browser", "Details", "Session ID"]
        )

        for activity in activities:
            writer.writerow(
                [
                    (
                        activity.created_at.strftime("%Y-%m-%d %H:%M:%S")
                        if activity.created_at
                        else ""
                    ),
                    activity.action or "",
                    activity.ip_address or "",
                    activity.country or "",
                    activity.city or "",
                    activity.user_agent or "",
                    activity.details or "",
                    activity.session_id or "",
                ]
            )

        output.seek(0)

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename=user_activity_{user.username}_{datetime.utcnow().strftime("%Y%m%d")}.csv'
            },
        )

    except Exception as e:
        return jsonify({"error": f"Failed to export user activity: {str(e)}"}), 500
