"""
User Permission Service
Handles user product permissions management
"""

import json
import logging
from typing import Any, Dict, List, Optional

from ...core.extensions import db
from ...models.core import DeveloperProductPermission, UserProductPermission
from ...models.products import Product
from ...utils.structured_logging import get_logger

class UserPermissionService:
    """Service for handling user product permissions"""

    def __init__(self):
        self.logger = get_logger("user_permission_service")

    def assign_product_permissions(
        self, user_id: int, project_id: int, product_ids: List[int]
    ) -> bool:
        """
        Assign product permissions to user

        Args:
            user_id: User ID
            project_id: Project ID
            product_ids: List of product IDs

        Returns:
            True if successful, False otherwise
        """
        try:

            all_project_products = Product.query.filter_by(project_id=project_id).all()
            all_product_ids = {product.id for product in all_project_products}
            selected_product_ids = set(product_ids) if product_ids else set()

            self.logger.info(
                f"Assigning permissions: user_id={user_id}, project_id={project_id}, "
                f"project_products={len(all_product_ids)}, selected={len(selected_product_ids)}"
            )


            existing_permissions = UserProductPermission.query.filter_by(user_id=user_id).all()
            existing_product_ids = {perm.product_id for perm in existing_permissions}

            if existing_product_ids:
                self.logger.warning(
                    f"User {user_id} already has permissions for products: {existing_product_ids}"
                )
                for perm in existing_permissions:
                    db.session.delete(perm)
                db.session.flush()


            for product_id in selected_product_ids:
                if product_id in all_product_ids:
                    try:
                        permission = UserProductPermission.query.filter_by(
                            user_id=user_id, product_id=product_id
                        ).first()

                        if permission:
                            permission.has_access = True
                            permission.can_generate_keys = True
                            permission.max_keys_per_day = 100
                            permission.project_id = project_id
                            self.logger.info(
                                f"Updated permission for user {user_id}, product {product_id} to has_access=True"
                            )
                        else:
                            permission = UserProductPermission(
                                user_id=user_id,
                                product_id=product_id,
                                can_generate_keys=True,
                                max_keys_per_day=100,
                                has_access=True,
                                project_id=project_id,
                            )
                            db.session.add(permission)
                            self.logger.info(
                                f"Created permission for user {user_id}, product {product_id} with has_access=True"
                            )
                    except Exception as e:
                        self.logger.error(f"Error creating permission for product {product_id}: {e}")

            db.session.commit()
            return True

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error assigning product permissions: {str(e)}")
            return False

    def remove_product_permissions(self, user_id: int, product_ids: List[int]) -> bool:
        """
        Remove product permissions from user

        Args:
            user_id: User ID
            product_ids: List of product IDs

        Returns:
            True if successful, False otherwise
        """
        try:
            UserProductPermission.query.filter(
                UserProductPermission.user_id == user_id,
                UserProductPermission.product_id.in_(product_ids),
            ).delete(synchronize_session=False)

            db.session.commit()
            return True

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error removing product permissions: {str(e)}")
            return False

    def get_user_product_permissions(self, user_id: int) -> List[UserProductPermission]:
        """
        Get all product permissions for a user

        Args:
            user_id: User ID

        Returns:
            List of UserProductPermission objects
        """
        try:
            return UserProductPermission.query.filter_by(user_id=user_id).all()
        except Exception as e:
            self.logger.error(f"Error getting user product permissions: {str(e)}")
            return []

    def has_product_permission(self, user_id: int, product_id: int) -> bool:
        """
        Check if user has permission for a product

        Args:
            user_id: User ID
            product_id: Product ID

        Returns:
            True if user has permission, False otherwise
        """
        try:
            permission = UserProductPermission.query.filter_by(
                user_id=user_id, product_id=product_id
            ).first()
            return permission is not None and permission.has_access
        except Exception as e:
            self.logger.error(f"Error checking product permission: {str(e)}")
            return False

    def process_product_ids_from_data(self, product_ids: Any) -> List[int]:
        """
        Process product_ids from various input formats (string, list, etc.)

        Args:
            product_ids: Product IDs in various formats

        Returns:
            List of integer product IDs
        """
        processed_product_ids = []

        if isinstance(product_ids, str):
            try:
                product_ids = json.loads(product_ids)
            except:
                product_ids = []
        elif isinstance(product_ids, (list, tuple)):
            product_ids = list(product_ids)
        else:
            self.logger.warning(
                f"Unexpected product_ids type: {type(product_ids)}, value: {product_ids}"
            )
            product_ids = []

        for gid in product_ids:
            try:
                gid_int = int(gid)
                if gid_int > 0:
                    processed_product_ids.append(gid_int)
            except (ValueError, TypeError):
                self.logger.warning(f"Invalid product_id: {gid}, skipping")
                continue

        return processed_product_ids

