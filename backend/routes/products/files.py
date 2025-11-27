"""
Product Files Routes
Handles file upload and management for products
"""

import logging
import os
import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ...core.extensions import db
from ...middleware.auth import require_project_with_grace_period
from ...models import Product, User
from ...config.config import Config
from ...utils.service_helpers import get_service

files_bp = Blueprint("products_files", __name__)

ALLOWED_EXTENSIONS = Config.ALLOWED_PRODUCT_FILE_EXTENSIONS

def allowed_file(filename, file_type):
    has_extension = "." in filename
    if has_extension:
        extension = filename.rsplit(".", 1)[1].lower()
        allowed_extensions = ALLOWED_EXTENSIONS.get(file_type, set())
        is_allowed = extension in allowed_extensions
        logging.debug(
            f"File {filename}: extension={extension}, type={file_type}, allowed_extensions={allowed_extensions}, is_allowed={is_allowed}"
        )
        return is_allowed
    else:
        logging.debug(f"File {filename}: no extension found")
        return False

def get_upload_path(file_type, project_id):
    from flask import current_app

    base_path = os.path.join(current_app.config["UPLOAD_FOLDER"], "products", str(project_id))

    if file_type == "logo":
        return os.path.join(base_path, "logos")
    elif file_type == "banner":
        return os.path.join(base_path, "banners")
    elif file_type == "background":
        return os.path.join(base_path, "backgrounds")
    elif file_type == "file":
        return os.path.join(base_path, "agents")

    return base_path
