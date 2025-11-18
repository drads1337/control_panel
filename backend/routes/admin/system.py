import json
import logging
import os
import subprocess
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import require_project_isolation, require_project_with_grace_period
from ...models import SystemSettings, User, UserActivity
from ...services.rbac import rbac_service

system_bp = Blueprint("system", __name__)

def require_owner_role(f):
    """Декоратор для проверки разрешения system.manage_all_projects"""
    from functools import wraps

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        if not rbac_service.check_permission(user.id, "system.manage_all_projects"):
            return (
                jsonify(
                    {"error": "Access denied - system.manage_all_projects permission required"}
                ),
                403,
            )

        return f(*args, **kwargs)

    return decorated_function

@system_bp.route("/settings", methods=["GET"])
@jwt_required()
@require_owner_role
def get_system_settings():
    """Получить системные настройки"""
    try:
        settings = SystemSettings.query.all()

        settings_dict = {}
        for setting in settings:
            try:

                if setting.setting_value and (
                    setting.setting_value.startswith("{") or setting.setting_value.startswith("[")
                ):
                    settings_dict[setting.setting_key] = json.loads(setting.setting_value)
                else:
                    settings_dict[setting.setting_key] = setting.setting_value
            except (json.JSONDecodeError, AttributeError):

                settings_dict[setting.setting_key] = setting.setting_value

        return jsonify({"settings": settings_dict, "timestamp": datetime.utcnow().isoformat()})

    except Exception as e:
        logging.error(f"Error getting system settings: {str(e)}")
        return jsonify({"error": "Failed to retrieve system settings"}), 500

@system_bp.route("/settings/<setting_type>", methods=["PUT"])
@jwt_required()
@require_owner_role
def update_system_settings(setting_type):
    """Обновить системные настройки"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        cleaned_settings = _validate_and_clean_settings(data)

        for key, value in cleaned_settings.items():
            setting = SystemSettings.query.filter_by(setting_key=key).first()

            if setting:

                if isinstance(value, (dict, list)):
                    setting.setting_value = json.dumps(value)
                else:
                    setting.setting_value = str(value)
                setting.updated_at = datetime.utcnow()
            else:

                new_setting = SystemSettings(
                    setting_key=key,
                    setting_value=(
                        json.dumps(value) if isinstance(value, (dict, list)) else str(value)
                    ),
                    setting_type=setting_type,
                    category="general",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.session.add(new_setting)

        db.session.commit()

        user_id = get_jwt_identity()
        activity = UserActivity(
            user_id=user_id,
            project_id=None,
            action="system_settings_updated",
            details=f"Updated {setting_type} settings",
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )
        db.session.add(activity)
        db.session.commit()

        return jsonify({"message": "System settings updated successfully"})

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating system settings: {str(e)}")
        return jsonify({"error": "Failed to update system settings"}), 500

@system_bp.route("/info", methods=["GET"])
@jwt_required()
@require_owner_role
def get_system_info():
    """Получить информацию о системе"""
    try:
        import platform

        import psutil

        system_info = {
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total,
            "memory_available": psutil.virtual_memory().available,
            "disk_usage": psutil.disk_usage("/").percent,
            "uptime": psutil.boot_time(),
        }

        db_info = {
            "engine": str(db.engine.url),
            "pool_size": db.engine.pool.size(),
            "checked_in": db.engine.pool.checkedin(),
            "checked_out": db.engine.pool.checkedout(),
            "overflow": db.engine.pool.overflow(),
        }

        return jsonify(
            {"system": system_info, "database": db_info, "timestamp": datetime.utcnow().isoformat()}
        )

    except Exception as e:
        logging.error(f"Error getting system info: {str(e)}")
        return jsonify({"error": "Failed to retrieve system information"}), 500

@system_bp.route("/backup", methods=["GET"])
@jwt_required()
@require_owner_role
def get_backups():
    """Получить список резервных копий"""
    try:
        backup_dir = os.path.join(os.getcwd(), "backups")

        if not os.path.exists(backup_dir):
            return jsonify({"backups": []})

        backups = []
        for filename in os.listdir(backup_dir):
            if filename.endswith(".sql") or filename.endswith(".db"):
                filepath = os.path.join(backup_dir, filename)
                stat = os.stat(filepath)
                backups.append(
                    {
                        "filename": filename,
                        "size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    }
                )

        backups.sort(key=lambda x: x["created_at"], reverse=True)

        return jsonify({"backups": backups})

    except Exception as e:
        logging.error(f"Error getting backups: {str(e)}")
        return jsonify({"error": "Failed to retrieve backups"}), 500

@system_bp.route("/backup", methods=["POST"])
@jwt_required()
@require_owner_role
def create_backup():
    """Создать резервную копию"""
    try:
        backup_dir = os.path.join(os.getcwd(), "backups")
        os.makedirs(backup_dir, exist_ok=True)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{timestamp}.sql"
        backup_path = os.path.join(backup_dir, backup_filename)

        db_url = str(db.engine.url)

        if "postgresql" in db_url:

            result = subprocess.run(["pg_dump", db_url], capture_output=True, text=True)

            if result.returncode == 0:
                with open(backup_path, "w") as f:
                    f.write(result.stdout)
            else:
                return jsonify({"error": "Failed to create backup"}), 500
        else:

            import shutil

            shutil.copy2(db_url.replace("sqlite:///", ""), backup_path)

        user_id = get_jwt_identity()
        activity = UserActivity(
            user_id=user_id,
            project_id=None,
            action="backup_created",
            details=f"Created backup: {backup_filename}",
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )
        db.session.add(activity)
        db.session.commit()

        return jsonify({"message": "Backup created successfully", "filename": backup_filename})

    except Exception as e:
        logging.error(f"Error creating backup: {str(e)}")
        return jsonify({"error": "Failed to create backup"}), 500

def _validate_and_clean_settings(settings_dict):
    """Валидация и очистка настроек"""
    cleaned = {}

    for key, value in settings_dict.items():

        if not isinstance(key, str) or not key.strip():
            continue

        if isinstance(value, str):
            cleaned[key] = value.strip()
        elif isinstance(value, (int, float, bool)):
            cleaned[key] = value
        elif isinstance(value, (dict, list)):
            cleaned[key] = value
        else:
            cleaned[key] = str(value)

    return cleaned

def _safe_log(level, message):
    """Безопасное логирование"""
    try:
        if level == "debug":
            logging.debug(message)
        elif level == "info":
            logging.info(message)
        elif level == "warning":
            logging.warning(message)
        elif level == "error":
            logging.error(message)
    except Exception:
        pass

def _validate_critical_settings(settings_dict):
    """Валидация критических настроек"""
    critical_keys = ["database_url", "secret_key", "jwt_secret_key"]

    for key in critical_keys:
        if key in settings_dict:
            value = settings_dict[key]
            if not value or (isinstance(value, str) and not value.strip()):
                raise ValueError(f"Critical setting '{key}' cannot be empty")

    return True
