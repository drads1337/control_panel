"""
Product Library Hash Management Routes
Управление SHA-256 хэшами сборок библиотек для Product
"""

import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ...core.extensions import db
from ...middleware.auth import enforce_project_scope, require_project_isolation
from ...models import User
from ...models.products import Product
from ...models.library_hash import ProductLibraryBuildHash, ProductLibraryHashSettings
from ...utils.rbac_utils import RBACManager
from ...routes.products.management import find_product_by_id_or_unique_id

logger = logging.getLogger(__name__)

library_hashes_bp = Blueprint("products_library_hashes", __name__)


@library_hashes_bp.route("/<product_identifier>/library-hashes", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_library_hashes(product_identifier):
    """Получить список разрешенных SHA-256 хэшей для продукта"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.project_id:
        return jsonify({"error": "User not found or not assigned to project"}), 404

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    try:
        hashes = ProductLibraryBuildHash.query.filter_by(
            product_id=product.id
        ).order_by(ProductLibraryBuildHash.created_at.desc()).all()

        return jsonify({
            "hashes": [
                {
                    "id": h.id,
                    "hash_sha256": h.hash_sha256,
                    "version": h.version,
                    "description": h.description,
                    "is_active": h.is_active,
                    "created_at": h.created_at.isoformat(),
                    "created_by": h.created_by,
                }
                for h in hashes
            ]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching product library hashes: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch library hashes"}), 500


@library_hashes_bp.route("/<product_identifier>/library-hashes", methods=["POST"])
@jwt_required()
@require_project_isolation
def add_product_library_hash(product_identifier):
    """Добавить новый разрешенный SHA-256 хэш для продукта"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.project_id:
        return jsonify({"error": "User not found or not assigned to project"}), 404

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.edit")
    if not has_permission:
        return jsonify({"error": "Permission denied"}), 403

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json() or {}
    hash_sha256 = data.get("hash_sha256", "").strip().lower()
    version = data.get("version", "").strip()
    description = data.get("description", "").strip()

    if not hash_sha256:
        return jsonify({"error": "hash_sha256 is required"}), 400

    # Проверка формата SHA-256 (64 hex символа)
    if len(hash_sha256) != 64 or not all(c in "0123456789abcdef" for c in hash_sha256):
        return jsonify({"error": "Invalid hash format. SHA-256 must be 64 hexadecimal characters"}), 400

    try:
        # Проверить, не существует ли уже такой хэш
        existing = ProductLibraryBuildHash.query.filter_by(
            product_id=product.id, hash_sha256=hash_sha256
        ).first()

        if existing:
            return jsonify({"error": "Hash already exists for this product"}), 400

        new_hash = ProductLibraryBuildHash(
            product_id=product.id,
            hash_sha256=hash_sha256,
            version=version if version else None,
            description=description if description else None,
            created_by=user.id,
            is_active=True,
        )

        db.session.add(new_hash)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Library hash added successfully",
            "hash": {
                "id": new_hash.id,
                "hash_sha256": new_hash.hash_sha256,
                "version": new_hash.version,
                "description": new_hash.description,
                "is_active": new_hash.is_active,
                "created_at": new_hash.created_at.isoformat(),
            },
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding product library hash: {e}", exc_info=True)
        return jsonify({"error": "Failed to add library hash"}), 500


@library_hashes_bp.route("/<product_identifier>/library-hashes/<int:hash_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_product_library_hash(product_identifier, hash_id):
    """Удалить SHA-256 хэш для продукта"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.project_id:
        return jsonify({"error": "User not found or not assigned to project"}), 404

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.edit")
    if not has_permission:
        return jsonify({"error": "Permission denied"}), 403

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    try:
        hash_obj = ProductLibraryBuildHash.query.filter_by(
            id=hash_id, product_id=product.id
        ).first()

        if not hash_obj:
            return jsonify({"error": "Hash not found"}), 404

        db.session.delete(hash_obj)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Library hash deleted successfully",
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting product library hash: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete library hash"}), 500


@library_hashes_bp.route("/<product_identifier>/library-hash-settings", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_product_library_hash_settings(product_identifier):
    """Получить настройки проверки SHA-256 хэшей для продукта"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.project_id:
        return jsonify({"error": "User not found or not assigned to project"}), 404

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    try:
        settings = ProductLibraryHashSettings.query.filter_by(
            product_id=product.id
        ).first()

        if not settings:
            # Создать настройки по умолчанию
            settings = ProductLibraryHashSettings(
                product_id=product.id,
                library_hash_check_enabled=False,
                mismatch_action="block",
            )
            db.session.add(settings)
            db.session.commit()

        return jsonify({
            "library_hash_check_enabled": settings.library_hash_check_enabled,
            "mismatch_action": settings.mismatch_action,
        }), 200

    except Exception as e:
        logger.error(f"Error fetching product library hash settings: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch settings"}), 500


@library_hashes_bp.route("/<product_identifier>/library-hash-settings", methods=["PUT"])
@jwt_required()
@require_project_isolation
def update_product_library_hash_settings(product_identifier):
    """Обновить настройки проверки SHA-256 хэшей для продукта"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.project_id:
        return jsonify({"error": "User not found or not assigned to project"}), 404

    has_permission = RBACManager.has_permission(user.id, user.project_id, "products.edit")
    if not has_permission:
        return jsonify({"error": "Permission denied"}), 403

    product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json() or {}
    library_hash_check_enabled = data.get("library_hash_check_enabled", False)
    mismatch_action = data.get("mismatch_action", "block")

    if mismatch_action not in ["block", "warn"]:
        return jsonify({"error": "mismatch_action must be 'block' or 'warn'"}), 400

    try:
        settings = ProductLibraryHashSettings.query.filter_by(
            product_id=product.id
        ).first()

        if not settings:
            settings = ProductLibraryHashSettings(
                product_id=product.id,
                library_hash_check_enabled=library_hash_check_enabled,
                mismatch_action=mismatch_action,
            )
            db.session.add(settings)
        else:
            settings.library_hash_check_enabled = library_hash_check_enabled
            settings.mismatch_action = mismatch_action

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Settings updated successfully",
            "settings": {
                "library_hash_check_enabled": settings.library_hash_check_enabled,
                "mismatch_action": settings.mismatch_action,
            },
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating product library hash settings: {e}", exc_info=True)
        return jsonify({"error": "Failed to update settings"}), 500
