import logging
import os
import traceback

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request

from ..core.extensions import db
from ..models.core import User
from ..models.products import Product, ProductExtraFile, ProductFileConfig, ProductFileDownload
from ..middleware.validation import validate_request
from ..utils.service_helpers import get_service, get_rbac_service
from ..schemas.file import (
    FileBulkActionSchema,
    FileStatusUpdateSchema,
    FileConfigUpdateSchema,
    FileRatingSchema,
    FolderCreateSchema,
)

logger = logging.getLogger(__name__)

from ..middleware.auth import enforce_project_scope, require_project_isolation

files_bp = Blueprint("files", __name__)

def find_product_by_id_or_unique_id(product_identifier, project_id):
    """
    Helper function to find a product by either id (int) or unique_id (string)
    
    Args:
        product_identifier: Either an integer id or string unique_id
        project_id: Project ID to filter by
    
    Returns:
        Product object or None if not found
    """
    # Try as integer id (primary key) first
    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
        except (ValueError, TypeError):
            pass
    
    # Try as unique_id (string)
    product = Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()
    return product

@files_bp.route("", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_files():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)
    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search")
    file_type = request.args.get("type")

    result = file_service.list_files(user, page=page, per_page=per_page, search=search, file_type=file_type)
    return jsonify(result)

@files_bp.route("/upload", methods=["POST"])
@jwt_required()
@enforce_project_scope
def upload_file():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    file_data, error = file_service.upload_file(user, file)
    if error:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        user,
        "upload_file",
        details=f"Uploaded file: {file_data['name']} ({file_data['size_human']})",
        ip=request.remote_addr,
    )

    return jsonify({"message": "File uploaded successfully", "file": file_data}), 201

@files_bp.route("/<filename>", methods=["GET"])
@jwt_required()
@enforce_project_scope
def download_file(filename):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    file_path, error = file_service.get_file_path_for_download(filename)
    if error:
        return jsonify({"error": error}), 404

    try:
        activity_service.log_activity(
            user, "download_file", details=f"Downloaded file: {filename}", ip=request.remote_addr
        )

        return send_file(file_path, as_attachment=True, download_name=filename)

    except Exception as e:
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

@files_bp.route("/<filename>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_file(filename):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    if not user or not get_rbac_service().check_permission(user.id, "products.edit"):
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": "Access denied"}), 403

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 403

    file_path, _ = file_service.get_file_path_for_download(filename)
    file_size = file_service.get_file_size(file_path) if file_path else 0

    success, error = file_service.delete_file(user, filename)
    if not success:
        return jsonify({"error": error}), 404 if error == "File not found" else 500

    activity_service.log_activity(
        user,
        "delete_file",
        details=f"Deleted file: {filename} ({file_service.format_file_size(file_size)})",
        ip=request.remote_addr,
    )

    return jsonify({"message": "File deleted successfully"})

@validate_request(FileBulkActionSchema)
@files_bp.route("/bulk", methods=["POST"])
@jwt_required()
@enforce_project_scope
def bulk_action(validated_data=None):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    if not user or not get_rbac_service().check_permission(user.id, "products.edit"):
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": "Access denied"}), 403

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 403

    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    action = validated_data.action
    filenames = validated_data.filenames

    if action == "delete":
        deleted_count, error = file_service.bulk_delete_files(user, filenames)
        if error:
            return jsonify({"error": error}), 500

        activity_service.log_activity(
            user,
            "bulk_delete_files",
            details=f"Deleted {deleted_count} files",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": f"Successfully deleted {deleted_count} files",
                "deleted_count": deleted_count,
            }
        )

    return jsonify({"error": "Invalid action"}), 400

@files_bp.route("/stats", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_file_stats():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    stats = file_service.get_file_stats(user)
    return jsonify(stats)

@files_bp.route("/storage-info", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_storage_info():
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        if error == "User not found":
            return jsonify({"error": error}), 404
        return (
            jsonify(
                {
                    "error": error,
                    "code": "NO_PROJECT",
                    "message": "Please contact an administrator to assign you to a project",
                    "user_id": user.id if user else None,
                    "username": user.username if user else None,
                }
            ),
            400,
        )

    storage_info, error = file_service.get_storage_info(user)
    if error:
        if "not found" in error.lower():
            return (
                jsonify(
                    {
                        "error": error,
                        "code": "PROJECT_NOT_FOUND",
                        "message": "The project you are assigned to no longer exists",
                        "user_id": user.id,
                        "username": user.username,
                        "project_id": user.project_id,
                    }
                ),
                404,
            )
        return (
            jsonify(
                {
                    "error": "Failed to calculate storage information",
                    "code": "STORAGE_CALCULATION_ERROR",
                    "message": error,
                }
            ),
            500,
        )

    return jsonify(storage_info)

@files_bp.route("/preview/<filename>", methods=["GET"])
@jwt_required()
@enforce_project_scope
def preview_file(filename):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    preview_data, error = file_service.preview_file(user, filename)
    if error:
        return jsonify({"error": error}), 404 if error == "File not found" else 500

    return jsonify(preview_data)

@files_bp.route("/products", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_products():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        product_service = get_service('product_service')
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "User not associated with any project"}), 400

    try:
        result = product_service.get_products_cached(
            project_id=user.project_id, product_type="all", user_id=user_id
        )

        if not result.get("success"):
            return (
                jsonify(
                    {"error": f'Failed to fetch products: {result.get("error", "Unknown error")}'}
                ),
                500,
            )

        products_data = []
        for product in result.get("products", []):
            configs_count = ProductFileConfig.query.filter_by(
                product_id=product["id"], is_active=True
            ).count()
            extra_files_count = ProductExtraFile.query.filter_by(
                product_id=product["id"], is_active=True
            ).count()

            products_data.append(
                {
                    "id": product["id"],
                    "unique_id": product.get("unique_id", ""),
                    "name": product["name"],
                    "description": product.get("description", ""),
                    "status": product.get("status", "active"),
                    "configs_count": configs_count,
                    "extra_files_count": extra_files_count,
                    "is_active": product.get("status", "active") == "active",
                    "created_at": (
                        product.get("created_at", "").isoformat() if product.get("created_at") else ""
                    ),
                    "updated_at": (
                        product.get("updated_at", "").isoformat() if product.get("updated_at") else ""
                    ),
                }
            )

        return jsonify({"products": products_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch products: {str(e)}"}), 500

@files_bp.route("/products/<product_name>/configs", methods=["GET"])
def get_product_configs_by_name(product_name):
    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
        except Exception:

            pass

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        product = Product.query.filter_by(name=product_name, project_id=user.project_id).first()
        if not product:
            return jsonify({"error": "Product not found"}), 404

        configs = ProductFileConfig.query.filter_by(product_id=product.id, is_active=True).all()

        configs_data = []
        for config in configs:
            uploader = User.query.filter_by(
                id=config.uploaded_by, project_id=user.project_id
            ).first()
            configs_data.append(
                {
                    "id": config.unique_id,
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

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch configs: {str(e)}"}), 500

@files_bp.route("/products/<product_identifier>/configs", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_configs(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product or product.project_id != user.project_id:
            return jsonify({"error": "Product not found"}), 404

        configs = ProductFileConfig.query.filter_by(product_id=product.id, is_active=True).all()

        configs_data = []
        for config in configs:
            uploader = User.query.filter_by(
                id=config.uploaded_by, project_id=user.project_id
            ).first()
            configs_data.append(
                {
                    "id": config.unique_id,
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

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch configs: {str(e)}"}), 500

@files_bp.route("/products/<product_identifier>/extra-files", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_extra_files(product_identifier):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    files_data, error = file_service.get_product_extra_files(user, product.id)
    if error:
        return jsonify({"error": error}), 404 if error == "Product not found" else 500

    return jsonify({"extra_files": files_data})

@files_bp.route("/products/configs/<int:config_id>/download", methods=["GET"])
def download_product_config(config_id):
    logging.debug(f"[DEBUG] Request: GET /api/files/products/configs/{config_id}/download")

    # Get services once at the start (DI pattern)
    # Get services once at the start (DI pattern)
    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logging.debug(
            f"[DEBUG] Processing token for GET /api/files/products/configs/{config_id}/download"
        )

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
            logging.debug(f"[DEBUG] JWT validation successful for user {user_id}")
        except Exception as e:
            logging.debug(f"[DEBUG] JWT verification failed: {e}")

            pass

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    else:
        logging.debug(f"[DEBUG] No Authorization header found")

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    try:
        config = (
            ProductFileConfig.query.join(Product)
            .filter(ProductFileConfig.id == config_id, Product.project_id == user.project_id)
            .first()
        )
        if not config:
            return jsonify({"error": "Config not found"}), 404

        product = Product.query.get(config.product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        response, error = file_service.download_product_config(
            config, user, request.remote_addr, request.headers.get("User-Agent")
        )
        if error:
            return jsonify({"error": error}), 404

        activity_service.log_activity(
            user,
            "download_product_config",
            details=f"Downloaded config {config.name} for product {product.name}",
            ip=request.remote_addr,
        )

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download config: {str(e)}"}), 500

@files_bp.route("/products/configs/<config_id>/download", methods=["GET"])
def download_product_config_by_string_id(config_id):
    logging.debug(f"[DEBUG] Request: GET /api/files/products/configs/{config_id}/download")

    # Get services once at the start (DI pattern)
    # Get services once at the start (DI pattern)
    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logging.debug(
            f"[DEBUG] Processing token for GET /api/files/products/configs/{config_id}/download"
        )

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
            logging.debug(f"[DEBUG] JWT validation successful for user {user_id}")
        except Exception as e:
            logging.debug(f"[DEBUG] JWT verification failed: {e}")

            pass

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403
    else:
        logging.debug(f"[DEBUG] No Authorization header found")

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    try:
        config = ProductFileConfig.query.filter_by(config_id=config_id).first()
        if not config:
            return jsonify({"error": "Config not found"}), 404

        product = Product.query.filter_by(id=config.product_id, project_id=user.project_id).first()
        if not product or product.project_id != user.project_id:
            return jsonify({"error": "Access denied"}), 403

        response, error = file_service.download_product_config(
            config, user, request.remote_addr, request.headers.get("User-Agent")
        )
        if error:
            return jsonify({"error": error}), 404

        activity_service.log_activity(
            user,
            "download_product_config_by_id",
            details=f"Downloaded config {config.name} (ID: {config_id}) for product {product.name}",
            ip=request.remote_addr,
        )

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download config: {str(e)}"}), 500

@files_bp.route("/products/extra-files/<int:file_id>/download", methods=["GET"])
def download_product_extra_file(file_id):
    try:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        extra_file = ProductExtraFile.query.get(file_id)
        if not extra_file:
            return jsonify({"error": "File not found"}), 404

        response, error = file_service.download_product_extra_file(extra_file)
        if error:
            return jsonify({"error": error}), 404

        return response

    except Exception as e:
        return jsonify({"error": f"Failed to download extra file: {str(e)}"}), 500

@validate_request(FileStatusUpdateSchema)
@files_bp.route("/products/extra-files/<int:file_id>/status", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_file_status(file_id, validated_data=None):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user.project_id:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        return jsonify({"error": "User must be assigned to a project"}), 403

    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        return jsonify({"error": "Access denied"}), 403

    try:

        extra_file = (
            ProductExtraFile.query.join(Product)
            .filter(ProductExtraFile.id == file_id, Product.project_id == user.project_id)
            .first()
        )
        if not extra_file:
            return jsonify({"error": "File not found"}), 404

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        new_status = validated_data.status
        old_status = extra_file.status
        extra_file.status = new_status
        db.session.commit()

        activity_service.log_activity(
            user,
            "update_file_status",
            details=f"Updated file {extra_file.name} status from {old_status} to {new_status}",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": "Status updated successfully", "file_id": file_id, "new_status": new_status}
        )

    except Exception as e:
        return jsonify({"error": f"Failed to update status: {str(e)}"}), 500

@files_bp.route("/products/<product_identifier>/storage-info", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_storage_info(product_identifier):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    storage_info, error = file_service.get_product_storage_info(user, product.id)
    if error:
        return jsonify({"error": error}), 404 if error == "Product not found" else 500

    return jsonify(storage_info)

@files_bp.route("/products/<product_identifier>/configs/my", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_my_product_configs(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product or product.project_id != user.project_id:
            return jsonify({"error": "Product not found"}), 404

        configs = ProductFileConfig.query.filter_by(
            product_id=product.id, uploaded_by=user.id, is_active=True
        ).all()

        configs_data = []
        for config in configs:
            configs_data.append(
                {
                    "id": config.unique_id,
                    "name": config.name,
                    "description": config.description,
                    "file_type": config.file_type,
                    "size": config.file_size,
                    "version": config.version,
                    "is_public": config.is_public,
                    "download_count": config.download_count,
                    "rating": config.rating,
                    "rating_count": config.rating_count,
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "content_hash": config.content_hash,
                }
            )

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch user configs: {str(e)}"}), 500

@files_bp.route("/products/<product_identifier>/configs/public", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_public_product_configs(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product or product.project_id != user.project_id:
            return jsonify({"error": "Product not found"}), 404

        configs = (
            ProductFileConfig.query.filter_by(product_id=product.id, is_public=True, is_active=True)
            .order_by(ProductFileConfig.rating.desc())
            .all()
        )

        configs_data = []
        for config in configs:
            uploader = User.query.filter_by(
                id=config.uploaded_by, project_id=user.project_id
            ).first()
            configs_data.append(
                {
                    "id": config.unique_id,
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

        return jsonify({"configs": configs_data})

    except Exception as e:
        return jsonify({"error": f"Failed to fetch public configs: {str(e)}"}), 500

@validate_request(FileConfigUpdateSchema)
@files_bp.route("/products/configs/<int:config_id>/update", methods=["PUT"])
@jwt_required()
@enforce_project_scope
def update_product_config(config_id, validated_data=None):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        config = (
            ProductFileConfig.query.join(Product)
            .filter(ProductFileConfig.id == config_id, Product.project_id == user.project_id)
            .first()
        )
        if not config:
            return jsonify({"error": "Config not found"}), 404

        product = Product.query.get(config.product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        rbac_service = get_rbac_service()
        if config.uploaded_by != user.id and not rbac_service.check_permission(
            user.id, "products.edit"
        ):
            return jsonify({"error": "Access denied"}), 403

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        data = request.get_json() or {}

        if validated_data.name is not None:
            config.name = validated_data.name
        if validated_data.description is not None:
            config.description = validated_data.description
        # Note: version and is_public are not in schema yet, keeping for backward compatibility
        if "version" in data:
            config.version = data["version"]
        if "is_public" in data:
            config.is_public = data["is_public"]

        db.session.commit()

        activity_service.log_activity(
            user,
            "update_product_config",
            details=f"Updated config {config.name} for product {product.name}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": "Config updated successfully",
                "config": {
                    "id": config.unique_id,
                    "name": config.name,
                    "description": config.description,
                    "version": config.version,
                    "is_public": config.is_public,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to update config: {str(e)}"}), 500

@validate_request(FileRatingSchema)
@files_bp.route("/products/configs/<int:config_id>/rate", methods=["POST"])
@jwt_required()
@enforce_project_scope
def rate_product_config(config_id, validated_data=None):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        return jsonify({"error": "User not found"}), 404

    if not validated_data:
        return jsonify({"error": "No data provided"}), 400


    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        config = (
            ProductFileConfig.query.join(Product)
            .filter(ProductFileConfig.id == config_id, Product.project_id == user.project_id)
            .first()
        )
        if not config:
            return jsonify({"error": "Config not found"}), 404

        if config.uploaded_by == user.id:
            return jsonify({"error": "Cannot rate your own config"}), 400

        rating = validated_data.rating
        current_total = config.rating * config.rating_count
        config.rating_count += 1
        config.rating = (current_total + rating) / config.rating_count

        db.session.commit()

        activity_service.log_activity(
            user,
            "rate_product_config",
            details=f"Rated config {config.name} with {rating} stars",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": "Rating submitted successfully",
                "config_id": config_id,
                "new_rating": config.rating,
                "rating_count": config.rating_count,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to submit rating: {str(e)}"}), 500

@files_bp.route("/product-files", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_files():
    try:
        logging.debug(
            f"[DEBUG] get_product_files route hit - URL: {request.url}, method: {request.method}"
        )
        logging.debug(f"[DEBUG] get_product_files - Headers: {dict(request.headers)}")
        logging.debug(f"[DEBUG] get_product_files - Args: {dict(request.args)}")

        user_id = get_jwt_identity()
        logging.debug(f"[DEBUG] get_product_files - user_id from JWT: {user_id}")

        if not user_id:
            logging.warning(f"[WARN] get_product_files: No user_id from JWT")
            return jsonify({"error": "Invalid token", "message": "No user ID in token"}), 401

        user = User.query.get(user_id)

        if not user:
            logging.debug(f"[DEBUG] get_product_files: User not found for user_id={user_id}")
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            logging.debug(f"[DEBUG] get_product_files: User {user_id} has no project_id")
            return jsonify({"error": "User must be assigned to a project"}), 403

        product_id_param = request.args.get("product_id")
        target_type = request.args.get("target_type", "auto")
        category = request.args.get("category", "all")
        status = request.args.get("status", "all")
        search = request.args.get("search", "")

        logging.debug(
            f"[DEBUG] get_product_files: product_id={product_id_param}, target_type={target_type}, category={category}, status={status}, search={search}, user_id={user_id}, project_id={user.project_id}"
        )

        if not product_id_param:
            logging.debug(f"[DEBUG] get_product_files: No product_id provided")
            return jsonify({"error": "Product ID is required"}), 400

        from ..models.products import Product
        from ..models.agents import Agent

        product = None
        agent = None
        is_loader = False

        # Helper function to resolve product by id or unique_id
        def resolve_product(product_identifier, project_id):
            """Resolve product by integer id or string unique_id"""
            # Try as integer ID first
            if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
                try:
                    product_id_int = int(product_identifier)
                    product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
                    if product:
                        return product
                except (ValueError, TypeError):
                    pass
            
            # Try as unique_id (string)
            return Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()

        # Helper function to resolve agent by id or unique_id
        def resolve_agent(agent_identifier, project_id):
            """Resolve agent by integer id or string unique_id"""
            # Try as integer ID first
            if isinstance(agent_identifier, int) or (isinstance(agent_identifier, str) and agent_identifier.isdigit()):
                try:
                    agent_id_int = int(agent_identifier)
                    agent = Agent.query.filter_by(id=agent_id_int, project_id=project_id).first()
                    if agent:
                        return agent
                except (ValueError, TypeError):
                    pass
            
            # Try as unique_id (string)
            return Agent.query.filter_by(unique_id=str(agent_identifier), project_id=project_id).first()

        if target_type == "agent":
            agent = resolve_agent(product_id_param, user.project_id)
            if not agent:
                logging.debug(
                    f"[DEBUG] get_product_files: Agent {product_id_param} not found for project_id={user.project_id}"
                )
                # Check if agent exists in different project
                agent_exists = None
                if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
                    try:
                        agent_exists = Agent.query.filter_by(id=int(product_id_param)).first()
                    except (ValueError, TypeError):
                        pass
                if not agent_exists:
                    agent_exists = Agent.query.filter_by(unique_id=str(product_id_param)).first()
                    
                if agent_exists:
                    logging.debug(
                        f"[DEBUG] get_product_files: Agent {product_id_param} exists but belongs to project_id={agent_exists.project_id}, not {user.project_id}"
                    )
                else:
                    logging.debug(f"[DEBUG] get_product_files: Agent {product_id_param} does not exist at all")
                return jsonify({"error": "Agent not found"}), 404
            is_loader = True
        elif target_type == "product":
            product = resolve_product(product_id_param, user.project_id)
            if not product:
                logging.debug(
                    f"[DEBUG] get_product_files: Product {product_id_param} not found for project_id={user.project_id}"
                )
                # Check if product exists in different project
                product_exists = None
                if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
                    try:
                        product_exists = Product.query.filter_by(id=int(product_id_param)).first()
                    except (ValueError, TypeError):
                        pass
                if not product_exists:
                    product_exists = Product.query.filter_by(unique_id=str(product_id_param)).first()
                    
                if product_exists:
                    logging.debug(
                        f"[DEBUG] get_product_files: Product {product_id_param} exists but belongs to project_id={product_exists.project_id}, not {user.project_id}"
                    )
                else:
                    logging.debug(f"[DEBUG] get_product_files: Product {product_id_param} does not exist at all")
                return jsonify({"error": "Product not found"}), 404
        else:
            product = resolve_product(product_id_param, user.project_id)
            if not product:
                logging.debug(f"[DEBUG] get_product_files: Product {product_id_param} not found, trying agent...")
                agent = resolve_agent(product_id_param, user.project_id)
                    
                if agent:
                    logging.debug(f"[DEBUG] get_product_files: Found Agent {product_id_param} instead of Product")
                    is_loader = True
                else:
                    logging.debug(
                        f"[DEBUG] get_product_files: Neither Product nor Agent {product_id_param} found for project_id={user.project_id}"
                    )

                    # Check if exists in different project
                    product_exists = None
                    if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
                        try:
                            product_exists = Product.query.filter_by(id=int(product_id_param)).first()
                        except (ValueError, TypeError):
                            pass
                    if not product_exists:
                        product_exists = Product.query.filter_by(unique_id=str(product_id_param)).first()
                    
                    agent_exists = None
                    if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
                        try:
                            agent_exists = Agent.query.filter_by(id=int(product_id_param)).first()
                        except (ValueError, TypeError):
                            pass
                    if not agent_exists:
                        agent_exists = Agent.query.filter_by(unique_id=str(product_id_param)).first()
                    
                    if product_exists or agent_exists:
                        logging.debug(
                            f"[DEBUG] get_product_files: {product_id_param} exists but belongs to different project"
                        )
                    else:
                        logging.debug(f"[DEBUG] get_product_files: {product_id_param} does not exist at all")
                    return jsonify({"error": "Product or Agent not found"}), 404
            else:
                logging.debug(f"[DEBUG] get_product_files: Found Product {product_id_param}")

        # Define product_id based on whether we're dealing with an agent or product
        if is_loader:
            product_id = agent.id
        else:
            product_id = product.id

        files_list = []

        if is_loader:

            logging.debug(f"[DEBUG] get_product_files: Processing Agent {product_id} files")

            if agent.logo:
                files_list.append(
                    {
                        "id": f"loader_logo_{product_id}",
                        "name": f"{agent.name} - Logo",
                        "type": "image",
                        "size": 0,
                        "path": agent.logo,
                        "modified": (
                            agent.updated_at.isoformat()
                            if agent.updated_at
                            else agent.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "logo",
                        "description": f"Logo for agent {agent.name}",
                        "download_count": 0,
                    }
                )

            if agent.banner:
                files_list.append(
                    {
                        "id": f"loader_banner_{product_id}",
                        "name": f"{agent.name} - Banner",
                        "type": "image",
                        "size": 0,
                        "path": agent.banner,
                        "modified": (
                            agent.updated_at.isoformat()
                            if agent.updated_at
                            else agent.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "banner",
                        "description": f"Banner for agent {agent.name}",
                        "download_count": 0,
                    }
                )

            if agent.background:
                files_list.append(
                    {
                        "id": f"loader_background_{product_id}",
                        "name": f"{agent.name} - Background",
                        "type": "image",
                        "size": 0,
                        "path": agent.background,
                        "modified": (
                            agent.updated_at.isoformat()
                            if agent.updated_at
                            else agent.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "background",
                        "description": f"Background for agent {agent.name}",
                        "download_count": 0,
                    }
                )

            if agent.file:
                files_list.append(
                    {
                        "id": f"loader_file_{product_id}",
                        "name": f"{agent.name} - File",
                        "type": "file",
                        "size": 0,
                        "path": agent.file,
                        "modified": (
                            agent.updated_at.isoformat()
                            if agent.updated_at
                            else agent.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "agent",
                        "description": f"File for agent {agent.name}",
                        "download_count": agent.downloads or 0,
                    }
                )
        else:

            logging.debug(f"[DEBUG] get_product_files: Processing Product {product_id} files")
            config_files = ProductFileConfig.query.filter_by(product_id=product_id, is_active=True).all()
            extra_files = ProductExtraFile.query.filter_by(product_id=product_id, is_active=True).all()

            logging.debug(
                f"[DEBUG] Found {len(config_files)} config files and {len(extra_files)} extra files for product {product_id}"
            )
            for extra in extra_files:
                logging.debug(
                    f"[DEBUG] Extra file: id={extra.id}, name={extra.name}, is_active={extra.is_active}, status={extra.status}"
                )

            if product.logo:
                files_list.append(
                    {
                        "id": f"product_logo_{product_id}",
                        "name": f"{product.name} - Logo",
                        "type": "image",
                        "size": 0,
                        "path": product.logo,
                        "modified": (
                            product.updated_at.isoformat()
                            if product.updated_at
                            else product.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "logo",
                        "description": f"Logo for product {product.name}",
                        "download_count": 0,
                    }
                )

            if product.banner:
                files_list.append(
                    {
                        "id": f"product_banner_{product_id}",
                        "name": f"{product.name} - Banner",
                        "type": "image",
                        "size": 0,
                        "path": product.banner,
                        "modified": (
                            product.updated_at.isoformat()
                            if product.updated_at
                            else product.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "banner",
                        "description": f"Banner for product {product.name}",
                        "download_count": 0,
                    }
                )

            if product.loader_file:
                files_list.append(
                    {
                        "id": f"product_loader_{product_id}",
                        "name": f"{product.name} - Agent",
                        "type": "file",
                        "size": 0,
                        "path": product.loader_file,
                        "modified": (
                            product.updated_at.isoformat()
                            if product.updated_at
                            else product.created_at.isoformat()
                        ),
                        "status": "active",
                        "productId": product_id,
                        "category": "agent",
                        "description": f"Agent for product {product.name}",
                        "download_count": 0,
                    }
                )

            for config in config_files:
                if status != "all" and config.is_active != (status == "active"):
                    continue

                if search and search.lower() not in config.name.lower():
                    continue

                files_list.append(
                    {
                        "id": f"config_{config.unique_id}",
                        "config_id": config.config_id,
                        "name": config.name,
                        "type": "file",
                        "size": config.file_size,
                        "path": config.file_path,
                        "modified": config.uploaded_at.isoformat(),
                        "status": "active" if config.is_active else "inactive",
                        "productId": product_id,
                        "category": "config",
                        "description": config.description,
                        "version": config.version,
                        "download_count": config.download_count,
                        "rating": config.rating,
                    }
                )

            for extra in extra_files:
                if status != "all" and extra.status != status:
                    continue

                if search and search.lower() not in extra.name.lower():
                    continue

                files_list.append(
                    {
                        "id": f"extra_{extra.unique_id}",
                        "name": extra.name,
                        "original_filename": extra.original_filename,
                        "type": "file",
                        "size": extra.file_size,
                        "path": extra.file_path,
                        "modified": extra.uploaded_at.isoformat(),
                        "status": extra.status,
                        "productId": product_id,
                        "category": "resource",
                        "description": extra.description,
                        "download_count": extra.download_count,
                    }
                )

        if category != "all":
            files_list = [f for f in files_list if f["category"] == category]

        files_list.sort(key=lambda x: x["modified"], reverse=True)

        target_name = agent.name if is_loader else product.name
        logging.debug(
            f"[DEBUG] get_product_files: Returning {len(files_list)} files for {target_type} {product_id} ({target_name})"
        )

        return jsonify(
            {
                "files": files_list,
                "total": len(files_list),
                "target_type": "agent" if is_loader else "product",
                "target_name": target_name,
            }
        )
    except Exception as e:
        logging.error(f"[ERROR] get_product_files: Exception: {str(e)}")
        logging.error(f"[ERROR] get_product_files: Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to fetch product files: {str(e)}"}), 500

@files_bp.route("/product-files/<product_identifier>/download/<file_type>", methods=["GET"])
@jwt_required()
@enforce_project_scope
def download_product_file(product_identifier, file_type):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    try:
        from ..models.products import Product

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product or product.project_id != user.project_id:
            return jsonify({"error": "Product not found"}), 404

        file_path, filename, error = file_service.get_product_file_path(product, file_type)
        if error:
            return jsonify({"error": error}), 404

        return send_file(file_path, as_attachment=True, download_name=filename)

    except Exception as e:
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

@files_bp.route("/product-files/<product_identifier>/<file_type>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_product_file(product_identifier, file_type):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": "Access denied"}), 403

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 403

    try:
        from ..models.products import Product

        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product or product.project_id != user.project_id:
            return jsonify({"error": "Product not found"}), 404

        success, error = file_service.delete_product_file(product, file_type)
        if not success:
            return jsonify({"error": error}), 404

        activity_service.log_activity(
            user,
            "delete_product_file",
            details=f"Deleted product {file_type} file for {product.name}",
            ip=request.remote_addr,
        )

        return jsonify({"message": f"Product {file_type} file deleted successfully"})

    except Exception as e:
        return jsonify({"error": f"Failed to delete product file: {str(e)}"}), 500

@validate_request(FolderCreateSchema)
@files_bp.route("/folders", methods=["POST"])
@jwt_required()
@enforce_project_scope
def create_folder(validated_data=None):
    # CRITICAL: This should never be None if validation middleware ran correctly
    # If it's None, the validation middleware failed to catch an error condition
    # Get services once at the start (DI pattern)
    # Get services once at the start (DI pattern)
    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    if validated_data is None:
        logger.error("CRITICAL: create_folder received None for validated_data - validation middleware may have failed")
        logger.error(f"Request body: {request.get_data(as_text=True)[:500]}")
        logger.error(f"Content-Type: {request.headers.get('Content-Type')}")
        logger.error(f"Request is_json: {request.is_json}")
        
        # Try to parse JSON manually to see what's wrong
        try:
            raw_body = request.get_data(as_text=True)
            if raw_body:
                import json
                parsed = json.loads(raw_body)
                logger.error(f"Manually parsed JSON: {parsed}")
        except Exception as e:
            logger.error(f"Failed to parse JSON manually: {str(e)}")
        
        return jsonify({
            "error": "VALIDATION_ERROR", 
            "message": "Request validation failed - invalid or missing request data",
            "debug_info": {
                "content_type": request.headers.get('Content-Type'),
                "has_body": bool(request.get_data()),
                "body_preview": request.get_data(as_text=True)[:100] if request.get_data() else None
            }
        }), 400
    
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    # Check if validated_data is empty dict (should have been caught by validation)
    if not validated_data or not isinstance(validated_data, dict):
        logger.warning(f"create_folder: Invalid validated_data - {validated_data}, type: {type(validated_data)}")
        return jsonify({
            "error": "VALIDATION_ERROR", 
            "message": "Request validation failed - invalid data format"
        }), 400

    folder_name = validated_data.get("name")
    if not folder_name:
        return jsonify({"error": "Folder name is required"}), 400
    
    parent_path = validated_data.get("parent_path", "/")
    product_id_param = validated_data.get("product_id")

    # Convert product_id (which might be unique_id string or database id) to database id
    product_id = None
    if product_id_param is not None:
        from ..models.products import Product
        product = find_product_by_id_or_unique_id(product_id_param, user.project_id)
        if product:
            product_id = product.id
        else:
            return jsonify({"error": "Product not found"}), 404

    success, error, folder_data = file_service.create_folder(folder_name, parent_path, product_id)
    if not success:
        return jsonify({"error": error}), 400

    activity_service.log_activity(
        user,
        "create_folder",
        details=f"Created folder: {folder_name} in {parent_path}",
        ip=request.remote_addr,
    )

    return (
        jsonify(
            {
                "message": "Folder created successfully",
                "folder": folder_data,
            }
        ),
        201,
    )

@files_bp.route("/folders/<path:folder_path>", methods=["DELETE"])
@jwt_required()
def delete_folder(folder_path):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        return jsonify({"error": "Access denied"}), 403

    success, error = file_service.delete_folder(folder_path)
    if not success:
        status_code = 404 if error == "Folder not found" else 400
        return jsonify({"error": error}), status_code

    activity_service.log_activity(
        user, "delete_folder", details=f"Deleted folder: {folder_path}", ip=request.remote_addr
    )

    return jsonify({"message": "Folder deleted successfully"})

@files_bp.route("/product-files/config", methods=["POST"])
def upload_product_config():
    logging.debug(f"[DEBUG] Request: POST /api/files/product-files/config")
    # Get services once at the start (DI pattern)
    # Get services once at the start (DI pattern)
    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    logging.debug(f"[DEBUG] Cookies: {list(request.cookies.keys()) if request.cookies else 'none'}")

    user_id = None
    user = None

    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        if user_id:
            user = User.query.get(user_id)
            logging.debug(f"[DEBUG] JWT from cookies validated successfully for user {user_id}")
    except Exception as e:
        logging.debug(f"[DEBUG] JWT from cookies not available: {e}")

        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            logging.debug(f"[DEBUG] Processing Bearer token from Authorization header")

            try:
                from flask_jwt_extended import decode_token as jwt_decode_token

                decoded = jwt_decode_token(token)
                user_id = decoded["sub"]
                user = User.query.get(user_id)

                if user and not user.project_id:
                    return jsonify({"error": "User must be assigned to a project"}), 403
                logging.debug(
                    f"[DEBUG] JWT validation from Bearer token successful for user {user_id}"
                )
            except Exception as e:
                logging.debug(f"[DEBUG] JWT verification from Bearer token failed: {e}")

                pass

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    product_name = request.form.get("product_name", "")
    name = request.form.get("name", "")
    description = request.form.get("description", "")
    version = request.form.get("version", "1.0.0")
    is_public = request.form.get("is_public", "true").lower() == "true"

    if not product_name:
        return jsonify({"error": "Product name is required"}), 400

    from ..models.products import Product

    product = Product.query.filter_by(name=product_name, project_id=user.project_id).first()
    if not product:
        logging.debug(
            f"[DEBUG] Product with name '{product_name}' not found in project {user.project_id}"
        )
        return jsonify({"error": f'Product with name "{product_name}" not found'}), 404
    else:
        logging.debug(f"[DEBUG] Found product: {product.name} (ID: {product.id})")
        product_id = product.id

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    can_upload, message = file_service.check_storage_limit(user, file_size)
    if not can_upload:
        return jsonify({"error": message}), 400

    try:
        config_data, error = file_service.upload_product_config(
            user, file, product, name, description, version, is_public
        )
        if error:
            return jsonify({"error": error}), 400

        activity_service.log_activity(
            user,
            "upload_product_config",
            details=f"Uploaded product config: {config_data['name']} ({file_service.format_file_size(config_data['size'])}) for product {product_id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": "Product config uploaded successfully",
                    "config": config_data,
                }
            ),
            201,
        )

    except Exception as e:
        return jsonify({"error": f"Failed to upload product config: {str(e)}"}), 500

@files_bp.route("/product-files/extra", methods=["POST"])
@jwt_required()
@require_project_isolation
def upload_product_extra_file():
    logging.debug(f"[DEBUG] upload_product_extra_file called - endpoint: /api/files/product-files/extra")
    # Get services once at the start (DI pattern)
    # Get services once at the start (DI pattern)
    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    product_id_param = request.form.get("product_id")
    name = request.form.get("name", "")
    description = request.form.get("description", "")

    if not product_id_param:
        return jsonify({"error": "Product ID is required"}), 400

    from ..models.products import Product

    # Resolve product by id or unique_id
    product = None
    # Try as integer ID first
    if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
        try:
            product_id_int = int(product_id_param)
            product = Product.query.filter_by(id=product_id_int, project_id=user.project_id).first()
        except (ValueError, TypeError):
            pass
    
    # If not found, try as unique_id (string)
    if not product:
        product = Product.query.filter_by(unique_id=str(product_id_param), project_id=user.project_id).first()
    
    if not product:
        return jsonify({"error": "Product not found or access denied"}), 404
    
    product_id = product.id

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        file_data, error = file_service.upload_product_extra_file(user, file, product, name, description)
        if error:
            return jsonify({"error": error}), 400

        activity_service.log_activity(
            user,
            "upload_product_extra_file",
            details=f"Uploaded product extra file: {file_data['name']} ({file_service.format_file_size(file_data['size'])}) for product {product_id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "message": "Product extra file uploaded successfully",
                    "file": file_data,
                }
            ),
            201,
        )

    except Exception as e:
        return jsonify({"error": f"Failed to upload product extra file: {str(e)}"}), 500

@files_bp.route("/product-files/config/<int:config_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_product_config(config_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    config = (
        ProductFileConfig.query.join(Product)
        .filter(ProductFileConfig.id == config_id, Product.project_id == user.project_id)
        .first()
    )
    if not config:
        return jsonify({"error": "Config not found"}), 404

    try:
        success, error = file_service.delete_product_config(config, user)
        if not success:
            return jsonify({"error": error}), 500

        activity_service.log_activity(
            user,
            "delete_product_config",
            details=f"Deleted product config: {config.name}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Product config deleted successfully"})

    except Exception as e:
        return jsonify({"error": f"Failed to delete product config: {str(e)}"}), 500

@files_bp.route("/product-files/extra/<int:file_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_product_extra_file(file_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        activity_service = get_service('activity_service')
        file_service = get_service('file_service')
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    extra_file = (
        ProductExtraFile.query.join(Product)
        .filter(ProductExtraFile.id == file_id, Product.project_id == user.project_id)
        .first()
    )
    if not extra_file:
        return jsonify({"error": "File not found"}), 404

    try:
        success, error = file_service.delete_product_extra_file(extra_file, user)
        if not success:
            return jsonify({"error": error}), 500

        activity_service.log_activity(
            user,
            "delete_product_extra_file",
            details=f"Deleted product extra file: {extra_file.name}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Product extra file deleted successfully"})

    except Exception as e:
        return jsonify({"error": f"Failed to delete product extra file: {str(e)}"}), 500

@files_bp.route("/stats/product/<product_identifier>", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_product_file_stats(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        # Get services once at the start (DI pattern)
        # Get services once at the start (DI pattern)
        file_service = get_service('file_service')
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    configs = ProductFileConfig.query.filter_by(product_id=product.id).all()
    extra_files = ProductExtraFile.query.filter_by(product_id=product.id).all()

    total_configs = len(configs)
    total_extra_files = len(extra_files)
    total_size = sum(c.file_size for c in configs) + sum(e.file_size for e in extra_files)

    config_types = {}
    extra_types = {}

    for config in configs:
        file_type = config.file_type
        config_types[file_type] = config_types.get(file_type, 0) + 1

    for extra in extra_files:
        file_type = extra.file_type
        extra_types[file_type] = extra_types.get(file_type, 0) + 1

    return jsonify(
        {
            "overview": {
                "total_configs": total_configs,
                "total_extra_files": total_extra_files,
                "total_files": total_configs + total_extra_files,
                "total_size": total_size,
                "total_size_human": get_service('file_service').format_file_size(total_size),
            },
            "config_types": config_types,
            "extra_types": extra_types,
            "recent_uploads": [
                {
                    "name": config.name,
                    "type": "config",
                    "uploaded_at": config.uploaded_at.isoformat(),
                    "size": config.file_size,
                }
                for config in sorted(configs, key=lambda x: x.uploaded_at, reverse=True)[:5]
            ]
            + [
                {
                    "name": extra.name,
                    "type": "extra",
                    "uploaded_at": extra.uploaded_at.isoformat(),
                    "size": extra.file_size,
                }
                for extra in sorted(extra_files, key=lambda x: x.uploaded_at, reverse=True)[:5]
            ],
        }
    )
