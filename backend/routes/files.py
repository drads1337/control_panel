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
from ..services.files.chunked_upload_service import ChunkedUploadService

logger = logging.getLogger(__name__)

from ..middleware.auth import enforce_project_scope, require_project_isolation
from ..middleware.mtls import require_mtls, is_mtls_enabled, verify_project_certificate_from_request, get_client_certificate_cn
from ..services.connect.decryption_service import DecryptionService
from ..services.connect.request_validation_service import RequestValidationService
from ..services.connect.key_lookup_service import KeyLookupService
from ..services.keys import KeyValidator
from ..utils.service_exceptions import ValidationError, NotFoundError

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

    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
        except (ValueError, TypeError):
            pass
    

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

@files_bp.route("/bulk", methods=["POST"])
@jwt_required()
@enforce_project_scope
@validate_request(FileBulkActionSchema)
def bulk_action(validated_data=None):
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    if not user or not get_rbac_service().check_permission(user.id, "products.edit"):


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

    file_service = get_service('file_service')
    
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
        return jsonify({"error": error}), 404 if error == "User not found" else 403

    stats = file_service.get_file_stats(user)
    return jsonify(stats)

@files_bp.route("/storage-info", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_storage_info():
    file_service = get_service('file_service')
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
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
    file_service = get_service('file_service')
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
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
    logging.debug(f"[DEBUG] Request: GET /api/files/products/extra-files/{file_id}/download")

    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    auth_header = request.headers.get("Authorization")
    user_id = None
    user = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logging.debug(
            f"[DEBUG] Processing token for GET /api/files/products/extra-files/{file_id}/download"
        )

        try:
            from flask_jwt_extended import decode_token as jwt_decode_token

            decoded = jwt_decode_token(token)
            user_id = decoded["sub"]
            user = User.query.get(user_id)

            if not user:
                logging.debug(f"[DEBUG] User not found for user_id={user_id}")
                return jsonify({"error": "User not found"}), 404

            if not user.project_id:
                return jsonify({"error": "User must be assigned to a project"}), 403
            logging.debug(f"[DEBUG] JWT validation successful for user {user_id}")
        except Exception as e:
            logging.debug(f"[DEBUG] JWT verification failed: {e}")
            pass

    if not user:
        logging.debug(f"[DEBUG] Access denied - no valid user found")
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    try:
        extra_file = (
            ProductExtraFile.query.join(Product)
            .filter(ProductExtraFile.id == file_id, Product.project_id == user.project_id)
            .first()
        )
        if not extra_file:
            return jsonify({"error": "File not found"}), 404

        response, error = file_service.download_product_extra_file(extra_file)
        if error:
            return jsonify({"error": error}), 404

        return response

    except Exception as e:
        logging.error(f"Error downloading extra file: {e}")
        return jsonify({"error": f"Failed to download extra file: {str(e)}"}), 500

@files_bp.route("/products/extra-files/<int:file_id>/status", methods=["PUT"])
@jwt_required()
@enforce_project_scope
@validate_request(FileStatusUpdateSchema)
def update_file_status(file_id, validated_data=None):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user.project_id:


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

@files_bp.route("/products/configs/<int:config_id>/update", methods=["PUT"])
@jwt_required()
@enforce_project_scope
@validate_request(FileConfigUpdateSchema)
def update_product_config(config_id, validated_data=None):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:



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

@files_bp.route("/products/configs/<int:config_id>/rate", methods=["POST"])
@jwt_required()
@enforce_project_scope
@validate_request(FileRatingSchema)
def rate_product_config(config_id, validated_data=None):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:


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


        def resolve_product(product_identifier, project_id):
            """Resolve product by integer id or string unique_id"""

            if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
                try:
                    product_id_int = int(product_identifier)
                    product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
                    if product:
                        return product
                except (ValueError, TypeError):
                    pass
            

            return Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()


        def resolve_agent(agent_identifier, project_id):
            """Resolve agent by integer id or string unique_id"""

            if isinstance(agent_identifier, int) or (isinstance(agent_identifier, str) and agent_identifier.isdigit()):
                try:
                    agent_id_int = int(agent_identifier)
                    agent = Agent.query.filter_by(id=agent_id_int, project_id=project_id).first()
                    if agent:
                        return agent
                except (ValueError, TypeError):
                    pass
            

            return Agent.query.filter_by(unique_id=str(agent_identifier), project_id=project_id).first()

        if target_type == "agent":
            agent = resolve_agent(product_id_param, user.project_id)
            if not agent:
                logging.debug(
                    f"[DEBUG] get_product_files: Agent {product_id_param} not found for project_id={user.project_id}"
                )

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
                # Извлекаем имя файла из пути
                file_name = os.path.basename(agent.file) if agent.file else f"{agent.name}.exe"
                files_list.append(
                    {
                        "id": f"loader_file_{product_id}",
                        "name": file_name,
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
    file_service = get_service('file_service')
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    is_valid, error = file_service.validate_user_project(user)
    if not is_valid:
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

def _validate_blob_and_get_product(blob: str, project_id: str, ip: str):
    """
    Helper function to validate blob and extract product information
    Works like connect endpoint - decrypts blob, validates key, and returns product
    
    Returns:
        Tuple of (key_obj, product_obj, project_id_int) or (None, None, None) on error
    """
    try:
        from ..models.products import Product
        
        decryption_service = DecryptionService()
        request_validator = RequestValidationService()
        key_lookup = KeyLookupService()
        key_validator = KeyValidator()
        
        # Decrypt blob
        data, _, successful_project_id = decryption_service.decrypt_request_data(blob, project_id=project_id, ip=ip)
        if not data:
            logger.warning(f"Failed to decrypt blob for product file download: ip={ip}")
            return None, None, None
        
        # Extract fields
        fields = request_validator.extract_request_fields(data)
        user_key = fields.get("user_key")
        product_name = fields.get("product")
        
        if not user_key or not product_name:
            logger.warning(f"Missing user_key or product in blob: ip={ip}")
            return None, None, None
        
        # Find key
        try:
            key_obj, project_id_int = key_lookup.find_key_in_project(user_key, project_id)
        except (ValidationError, NotFoundError) as e:
            logger.warning(f"Key not found for product file download: user_key={user_key[:8]}..., error={e}")
            return None, None, None
        
        # Find product by name
        product_obj = Product.query.filter_by(name=product_name, project_id=project_id_int).first()
        if not product_obj:
            logger.warning(f"Product not found: product={product_name}, project_id={project_id_int}")
            return None, None, None
        
        # Validate key access to product
        is_valid, error_msg, validated_product = key_validator.validate_product_access(key_obj, product_name, project_id_int)
        if not is_valid or not validated_product:
            logger.warning(f"Product access denied for product file download: user_key={user_key[:8]}..., product={product_name}, error={error_msg}")
            return None, None, None
        
        return key_obj, product_obj, project_id_int
    except Exception as e:
        logger.error(f"Error validating blob for product file download: {str(e)}", exc_info=True)
        return None, None, None

@files_bp.route("/product-files/download", methods=["POST"])
@require_mtls
def download_product_file_blob():
    """
    Download product file using blob API (like /api/connect)
    
    Request JSON:
        {
            "blob": "encrypted_data_with_user_key_and_product_name",
            "project_id": "6117759936",
            "file_type": "logo"  // "logo", "banner", "background", "file"/"agent"
        }
    
    The blob should contain:
        - user_key (field "a" or "user_key")
        - product (field "e" or "product") - product name like "PUBG"
    """
    file_service = get_service('file_service')
    ip = request.remote_addr
    
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    req_json = request.get_json(silent=True) or {}
    blob = req_json.get("blob")
    project_id = req_json.get("project_id")
    file_type = req_json.get("file_type")
    
    if not blob or not project_id or not file_type:
        return jsonify({"error": "Missing required fields: blob, project_id, file_type"}), 400
    
    if is_mtls_enabled():
        valid, msg, cn = verify_project_certificate_from_request(project_id)
        if not valid:
            logger.warning(f"mTLS validation failed for product file download: {msg}")
            return jsonify({"error": f"mTLS validation failed: {msg}"}), 403
    
    # Validate blob and get product
    key_obj, product_obj, project_id_int = _validate_blob_and_get_product(blob, project_id, ip)
    if not key_obj or not product_obj:
        return jsonify({"error": "Invalid key or product access denied"}), 403
    
    try:
        # Convert file_type "file" to "agent" (as used in server)
        server_file_type = "agent" if file_type == "file" else file_type
        
        file_path, filename, error = file_service.get_product_file_path(product_obj, server_file_type)
        if error:
            return jsonify({"error": error}), 404
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    
    except Exception as e:
        logger.error(f"Error downloading product file via blob API: {str(e)}")
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

@files_bp.route("/product-files/config/download", methods=["POST"])
@require_mtls
def download_product_config_blob():
    """
    Download product config using blob API (like /api/connect)
    
    Request JSON:
        {
            "blob": "encrypted_data_with_user_key_and_product_name",
            "project_id": "6117759936",
            "config_id": "12345678"  // config_id or unique_id
        }
    """
    file_service = get_service('file_service')
    activity_service = get_service('activity_service')
    ip = request.remote_addr
    
    if not request.is_json:
        return jsonify({"error": "Invalid request format"}), 400
    
    req_json = request.get_json(silent=True) or {}
    blob = req_json.get("blob")
    project_id = req_json.get("project_id")
    config_id = req_json.get("config_id")
    
    if not blob or not project_id or not config_id:
        return jsonify({"error": "Missing required fields: blob, project_id, config_id"}), 400
    
    if is_mtls_enabled():
        valid, msg, cn = verify_project_certificate_from_request(project_id)
        if not valid:
            logger.warning(f"mTLS validation failed for config download: {msg}")
            return jsonify({"error": f"mTLS validation failed: {msg}"}), 403
    
    # Validate blob and get product
    key_obj, product_obj, project_id_int = _validate_blob_and_get_product(blob, project_id, ip)
    if not key_obj or not product_obj:
        return jsonify({"error": "Invalid key or product access denied"}), 403
    
    try:
        from ..models.products import ProductFileConfig
        
        # Find config by config_id or unique_id
        config = ProductFileConfig.query.filter_by(config_id=config_id, product_id=product_obj.id).first()
        if not config:
            config = ProductFileConfig.query.filter_by(unique_id=config_id, product_id=product_obj.id).first()
        
        if not config or config.product_id != product_obj.id:
            return jsonify({"error": "Config not found"}), 404
        
        # Use file_service to download config
        # Note: file_service.download_product_config expects a User object, but we have key_obj
        # We need to find user from key_obj
        from ..models.core import User
        user = User.query.get(key_obj.user_id) if key_obj.user_id else None
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        response, error = file_service.download_product_config(
            config, user, ip, request.headers.get("User-Agent")
        )
        if error:
            return jsonify({"error": error}), 404
        
        activity_service.log_activity(
            user,
            "download_product_config",
            details=f"Downloaded config {config.name} for product {product_obj.name}",
            ip=ip,
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Error downloading config via blob API: {str(e)}")
        return jsonify({"error": f"Failed to download config: {str(e)}"}), 500

@files_bp.route("/product-files/config/upload", methods=["POST"])
@require_mtls
def upload_product_config_blob():
    """
    Upload product config using blob API (like /api/connect)
    
    Request form-data:
        - blob: "encrypted_data_with_user_key_and_product_name"
        - project_id: "6117759936"
        - file: <binary_file>
        - name: "config_name" (optional)
        - description: "config_description" (optional)
        - version: "1.0.0" (optional)
        - is_public: "true"/"false" (optional, default: "true")
    """
    file_service = get_service('file_service')
    activity_service = get_service('activity_service')
    ip = request.remote_addr
    
    blob = request.form.get("blob")
    project_id = request.form.get("project_id")
    file = request.files.get("file")
    
    if not blob or not project_id or not file:
        return jsonify({"error": "Missing required fields: blob, project_id, file"}), 400
    
    if is_mtls_enabled():
        valid, msg, cn = verify_project_certificate_from_request(project_id)
        if not valid:
            logger.warning(f"mTLS validation failed for config upload: {msg}")
            return jsonify({"error": f"mTLS validation failed: {msg}"}), 403
    
    # Validate blob and get product
    key_obj, product_obj, project_id_int = _validate_blob_and_get_product(blob, project_id, ip)
    if not key_obj or not product_obj:
        return jsonify({"error": "Invalid key or product access denied"}), 403
    
    try:
        from ..models.core import User
        
        # Get user from key_obj
        user = User.query.get(key_obj.user_id) if key_obj.user_id else None
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        name = request.form.get("name", "")
        description = request.form.get("description", "")
        version = request.form.get("version", "1.0.0")
        is_public = request.form.get("is_public", "true").lower() == "true"
        
        # Upload config using file_service
        config_data, error = file_service.upload_product_config(
            user, file, product_obj, name, description, version, is_public
        )
        if error:
            return jsonify({"error": error}), 400
        
        activity_service.log_activity(
            user,
            "upload_product_config",
            details=f"Uploaded product config: {config_data['name']} ({file_service.format_file_size(config_data['size'])}) for product {product_obj.name}",
            ip=ip,
        )
        
        return jsonify({
            "message": "Product config uploaded successfully",
            "config": config_data,
        }), 201
    
    except Exception as e:
        logger.error(f"Error uploading config via blob API: {str(e)}")
        return jsonify({"error": f"Failed to upload config: {str(e)}"}), 500

@files_bp.route("/product-files-mtls/<product_identifier>/download/<file_type>", methods=["GET"])
@require_mtls
def download_product_file_mtls(product_identifier, file_type):
    """
    Download product file using mTLS authentication (without JWT)
    
    This endpoint is designed for client applications that have already
    authenticated via /api/connect and have valid mTLS certificates.
    
    Query parameters:
        project_id: Project ID (required when mTLS is enabled)
    """
    file_service = get_service('file_service')
    
    # Get project_id from query parameter
    project_id_param = request.args.get("project_id")
    
    if is_mtls_enabled():
        if not project_id_param:
            # Try to extract from certificate CN (deprecated but kept for compatibility)
            cn = get_client_certificate_cn()
            # Note: With universal certificates, CN doesn't contain project_id
            # But we keep this check for backward compatibility
            if not project_id_param:
                return jsonify({"error": "project_id required for mTLS"}), 400
        
        # Verify certificate for project
        valid, msg, cn = verify_project_certificate_from_request(project_id_param)
        if not valid:
            logger.warning(f"mTLS validation failed for product file download: {msg}, cn={cn}")
            return jsonify({"error": f"mTLS validation failed: {msg}"}), 403
        
        try:
            project_id_int = int(project_id_param)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid project_id"}), 400
    else:
        return jsonify({"error": "mTLS is required for this endpoint"}), 403
    
    try:
        from ..models.products import Product
        
        # Find product by ID or unique_id in the specified project
        product = find_product_by_id_or_unique_id(product_identifier, project_id_int)
        if not product or product.project_id != project_id_int:
            return jsonify({"error": "Product not found"}), 404
        
        file_path, filename, error = file_service.get_product_file_path(product, file_type)
        if error:
            return jsonify({"error": error}), 404
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    
    except Exception as e:
        logger.error(f"Error downloading product file via mTLS: {str(e)}")
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500

@files_bp.route("/product-files/<product_identifier>/<file_type>", methods=["DELETE"])
@jwt_required()
@enforce_project_scope
def delete_product_file(product_identifier, file_type):
    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    user_id = get_jwt_identity()
    user = file_service.get_user_by_id(user_id)

    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
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

@files_bp.route("/folders", methods=["POST"])
@jwt_required()
@enforce_project_scope
@validate_request(FolderCreateSchema)
def create_folder(validated_data=None):




    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    if validated_data is None:
        logger.error("CRITICAL: create_folder received None for validated_data - validation middleware may have failed")
        logger.error(f"Request body: {request.get_data(as_text=True)[:500]}")
        logger.error(f"Content-Type: {request.headers.get('Content-Type')}")
        logger.error(f"Request is_json: {request.is_json}")
        
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


    product = None

    if isinstance(product_id_param, int) or (isinstance(product_id_param, str) and product_id_param.isdigit()):
        try:
            product_id_int = int(product_id_param)
            product = Product.query.filter_by(id=product_id_int, project_id=user.project_id).first()
        except (ValueError, TypeError):
            pass
    

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

@files_bp.route("/product-files/config/<config_identifier>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_product_config(config_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Try to find by integer id first, then by unique_id
    config = None
    if isinstance(config_identifier, int) or (isinstance(config_identifier, str) and config_identifier.isdigit()):
        try:
            config_id_int = int(config_identifier)
            config = (
                ProductFileConfig.query.join(Product)
                .filter(ProductFileConfig.id == config_id_int, Product.project_id == user.project_id)
                .first()
            )
        except (ValueError, TypeError):
            pass
    
    # If not found by id, try unique_id
    if not config:
        config = (
            ProductFileConfig.query.join(Product)
            .filter(ProductFileConfig.unique_id == str(config_identifier), Product.project_id == user.project_id)
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

@files_bp.route("/product-files/extra/<file_identifier>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_product_extra_file(file_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    activity_service = get_service('activity_service')
    file_service = get_service('file_service')
    rbac_service = get_rbac_service()
    if not user or not rbac_service.check_permission(user.id, "products.edit"):
        return jsonify({"error": "Access denied"}), 403

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    # Try to find by integer id first, then by unique_id
    extra_file = None
    if isinstance(file_identifier, int) or (isinstance(file_identifier, str) and file_identifier.isdigit()):
        try:
            file_id_int = int(file_identifier)
            extra_file = (
                ProductExtraFile.query.join(Product)
                .filter(ProductExtraFile.id == file_id_int, Product.project_id == user.project_id)
                .first()
            )
        except (ValueError, TypeError):
            pass
    
    # If not found by id, try unique_id
    if not extra_file:
        extra_file = (
            ProductExtraFile.query.join(Product)
            .filter(ProductExtraFile.unique_id == str(file_identifier), Product.project_id == user.project_id)
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


# ============================================================================
# Chunked Upload Endpoints
# ============================================================================

@files_bp.route("/product-files/extra/chunk", methods=["POST"])
@jwt_required()
@require_project_isolation
def upload_product_extra_file_chunk():
    """
    Upload a chunk of a product extra file
    
    SECURITY: This endpoint handles chunked uploads for large files (>100MB)
    to prevent browser memory issues. Chunks are stored temporarily and
    assembled when finalize endpoint is called.
    """
    chunked_service = ChunkedUploadService()
    file_service = get_service('file_service')
    activity_service = get_service('activity_service')
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file chunk provided"}), 400

    file_chunk = request.files["file"]
    upload_id = request.form.get("upload_id")
    chunk_index = request.form.get("chunk_index")
    total_chunks = request.form.get("total_chunks")
    file_name = request.form.get("file_name")
    file_size = request.form.get("file_size")
    chunk_size = request.form.get("chunk_size")
    product_id_param = request.form.get("product_id")
    name = request.form.get("name", "")
    description = request.form.get("description", "")

    if not all([upload_id, chunk_index, total_chunks, file_name, file_size, product_id_param]):
        return jsonify({"error": "Missing required parameters"}), 400

    try:
        chunk_index = int(chunk_index)
        total_chunks = int(total_chunks)
        file_size = int(file_size)
        chunk_size = int(chunk_size) if chunk_size else len(file_chunk.read())
        file_chunk.seek(0)
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid parameter format: {str(e)}"}), 400

    # Find product
    product = find_product_by_id_or_unique_id(product_id_param, user.project_id)
    if not product:
        return jsonify({"error": "Product not found or access denied"}), 404

    # Initialize upload on first chunk
    if chunk_index == 0:
        metadata = {
            "product_id": product.id,
            "name": name,
            "description": description,
        }
        success, error = chunked_service.initialize_upload(
            upload_id=upload_id,
            filename=file_name,
            file_size=file_size,
            total_chunks=total_chunks,
            user_id=user.id,
            project_id=user.project_id,
            metadata=metadata,
        )
        if not success:
            return jsonify({"error": error}), 400

    # Save chunk
    chunk_data = file_chunk.read()
    success, error = chunked_service.save_chunk(
        upload_id=upload_id,
        chunk_index=chunk_index,
        chunk_data=chunk_data,
        chunk_size=chunk_size,
    )
    if not success:
        return jsonify({"error": error}), 400

    return jsonify({
        "message": f"Chunk {chunk_index + 1}/{total_chunks} uploaded successfully",
        "chunk_index": chunk_index,
        "total_chunks": total_chunks,
    }), 200


@files_bp.route("/product-files/extra/finalize", methods=["POST"])
@jwt_required()
@require_project_isolation
def finalize_product_extra_file_upload():
    """
    Finalize chunked upload by assembling chunks into final file
    
    SECURITY: This endpoint assembles all chunks into the final file,
    validates it, and stores it in the product's extra files directory.
    """
    chunked_service = ChunkedUploadService()
    file_service = get_service('file_service')
    activity_service = get_service('activity_service')
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    upload_id = request.form.get("upload_id")
    file_name = request.form.get("file_name")
    file_size = request.form.get("file_size")
    total_chunks = request.form.get("total_chunks")
    product_id_param = request.form.get("product_id")
    name = request.form.get("name", "")
    description = request.form.get("description", "")

    if not all([upload_id, file_name, file_size, total_chunks, product_id_param]):
        return jsonify({"error": "Missing required parameters"}), 400

    try:
        file_size = int(file_size)
        total_chunks = int(total_chunks)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid parameter format"}), 400

    # Get upload metadata
    metadata = chunked_service.get_upload_metadata(upload_id)
    if not metadata:
        return jsonify({"error": "Upload session not found or expired"}), 404

    # Verify user and project match
    if metadata["user_id"] != user.id or metadata["project_id"] != user.project_id:
        return jsonify({"error": "Unauthorized access to upload session"}), 403

    # Find product
    product = find_product_by_id_or_unique_id(product_id_param, user.project_id)
    if not product:
        return jsonify({"error": "Product not found or access denied"}), 404

    # Check storage limit
    can_upload, message = file_service.check_storage_limit(user, file_size)
    if not can_upload:
        chunked_service.cleanup_upload(upload_id)
        return jsonify({"error": message}), 400

    # Prepare final file path
    from werkzeug.utils import secure_filename
    import os
    from datetime import datetime
    
    original_filename = secure_filename(file_name)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    name_part, ext = os.path.splitext(original_filename)
    unique_filename = f"{name_part}_{timestamp}{ext}"
    
    upload_path = os.path.join(
        file_service.get_upload_path(), "products", str(product.id), "extra"
    )
    os.makedirs(upload_path, exist_ok=True)
    final_path = os.path.join(upload_path, unique_filename)

    # Assemble file from chunks
    success, error, file_info = chunked_service.assemble_file(upload_id, final_path)
    if not success:
        return jsonify({"error": error}), 400

    # Validate file signature
    ext_lower = ext.lstrip('.').lower() if ext else None
    expected_extensions = [ext_lower] if ext_lower and ext_lower in ['png', 'jpg', 'jpeg', 'gif', 'webp'] else None
    is_valid, validation_error = file_service.validate_file_signature(final_path, expected_extensions)
    if not is_valid:
        try:
            os.remove(final_path)
        except Exception:
            pass
        return jsonify({"error": validation_error or "File validation failed"}), 400

    # Get file hash and type
    file_hash = file_service.get_file_hash(final_path)
    file_type = ext_lower if ext_lower else "unknown"

    # Create database record
    try:
        extra_file = ProductExtraFile(
            product_id=product.id,
            name=name or original_filename,
            original_filename=original_filename,
            description=description,
            file_path=final_path,
            file_size=file_info["size"],
            file_type=file_type,
            content_hash=file_hash,
            uploaded_by=user.id,
            status="active",
            is_active=True,
        )
        db.session.add(extra_file)
        db.session.commit()

        file_data = {
            "id": extra_file.id,
            "name": extra_file.name,
            "filename": extra_file.original_filename,
            "size": extra_file.file_size,
            "size_human": file_service.format_file_size(extra_file.file_size),
            "description": extra_file.description,
            "uploaded_by": user.username,
            "uploaded_at": extra_file.uploaded_at.isoformat(),
        }

        activity_service.log_activity(
            user,
            "upload_product_extra_file",
            details=f"Uploaded product extra file (chunked): {file_data['name']} ({file_data['size_human']}) for product {product.id}",
            ip=request.remote_addr,
        )

        file_service.clear_storage_cache(user.project_id)

        return jsonify({
            "message": "File uploaded successfully",
            "file": file_data,
        }), 201
    except Exception as e:
        logger.error(f"Error creating product extra file record: {e}")
        try:
            os.remove(final_path)
        except Exception:
            pass
        db.session.rollback()
        return jsonify({"error": f"Failed to create file record: {str(e)}"}), 500
