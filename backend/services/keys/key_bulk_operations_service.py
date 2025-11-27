"""
Key Bulk Operations Service
Handles bulk operations on keys: bulk create, delete, pause, resume, reset, extend
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product
from ...models.keys import DeviceInfo, Key
from ...models.agents import Agent
from ...utils.service_exceptions import NotFoundError, PermissionDeniedError
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from ...utils.structured_logging import get_logger
from ...utils.service_helpers import get_service
from .key_filter_specification import KeyFilterSpecification


class KeyBulkOperationsService:
    """Service for handling bulk operations on keys"""

    def __init__(self):
        self.logger = get_logger("key_bulk_operations_service")
        self.max_bulk_operations = 1000
        # Services will be obtained lazily when needed to avoid application context issues

    def _get_keys_by_ids(self, user: User, key_ids: List[int]) -> List[Key]:
        """
        Get keys by IDs with security check

        Args:
            user: User requesting keys
            key_ids: List of key IDs

        Returns:
            List of Key objects
        """
        if len(key_ids) > self.max_bulk_operations:
            raise ValueError(f"Too many IDs in one request. Maximum: {self.max_bulk_operations}")

        return Key.query.filter(Key.id.in_(key_ids), Key.project_id == user.project_id).all()

    def _get_keys_by_filters(self, user: User, filters: Dict[str, Any]) -> List[Key]:
        """
        Get keys by filters for bulk operations

        Args:
            user: User requesting keys
            filters: Filter parameters

        Returns:
            List of Key objects
        """
        query = Key.query.filter_by(project_id=user.project_id)
        filter_spec = KeyFilterSpecification(filters, logger=self.logger)
        query = filter_spec.apply(query)
        return query.all()

    def create_keys_bulk(
        self, user: User, keys_data: List[Dict[str, Any]]
    ) -> Tuple[int, List[str]]:
        """
        Create multiple keys in bulk

        Args:
            user: User creating the keys
            keys_data: List of key data dictionaries

        Returns:
            Tuple of (created_count, list_of_errors)
        """
        validation_service = get_service('key_validation_service')
        is_valid, error_msg = validation_service.validate_bulk_operation(
            len(keys_data), self.max_bulk_operations
        )
        if not is_valid:
            return 0, [error_msg]

        created_count = 0
        errors = []

        for i, key_data in enumerate(keys_data):
            try:
                # create_key now raises exceptions instead of returning tuples
                key = key_crud_service.create_key(user, key_data)
                key_crud_service = get_service('key_crud_service')
                created_count += 1
            except Exception as e:
                try:
                    db.session.rollback()
                except Exception:
                    pass
                error_msg = str(e)
                errors.append(f"Key {i+1}: {error_msg}")
                self.logger.error(f"Failed to create key {i+1} in bulk: {error_msg}")

        self.logger.info(f"Bulk created {created_count} keys for user {user.id}")
        return created_count, errors

    def bulk_create_keys(
        self,
        user: User,
        count: int,
        product_id: int,
        duration_hours: float,
        max_devices: int,
    ) -> Tuple[int, Optional[str], Optional[List[Key]]]:
        """
        Bulk create keys synchronously

        Args:
            user: User creating the keys
            count: Number of keys to create
            product_id: ID of the product
            duration_hours: Duration in hours
            max_devices: Maximum devices per key

        Returns:
            Tuple of (created_count, error_message, list of created keys)
        """
        try:
            # Use ServiceContainer to avoid circular imports
            product_service = get_service('product_service')
            # get_product now raises exceptions
            product = product_service.get_product(user, product_id)

            is_access_code = product.login_type == "classic_login"
            item_type = "access codes" if is_access_code else "license keys"

            created_keys = []
            batch_id = f'batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}'
            errors = []

            expires_at = None
            if duration_hours:
                expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

            # Deduct balance for bulk key creation (except for admin/owner) - BEFORE creating keys
            is_owner = RBACManager.is_owner(user)
            is_admin = RBACManager.is_admin(user)
            
            if not is_owner and not is_admin and product and user.project_id:
                # Use ServiceContainer to avoid circular imports
                price_calculation_service = get_service('price_calculation_service')
                balance_service = get_service('balance_service')
                
                key_price = price_calculation_service.calculate_key_price(
                    product_id=product.id,
                    duration_hours=duration_hours,
                    project_id=user.project_id
                )
                
                total_price = key_price * count
                
                if total_price > 0:
                    # Refresh user to get latest balance
                    from ...core.extensions import db
                    db.session.refresh(user)
                    
                    # Check if user has sufficient balance
                    if user.token_balance < total_price:
                        return 0, f"Insufficient balance. Required: {total_price} tokens for {count} keys, Available: {user.token_balance} tokens", None
                    
                    # Deduct balance without committing (we're inside a transaction)
                    balance_service = get_service('balance_service')
                    success, error_msg, _ = balance_service.deduct_balance(
                        current_user=user,
                        target_user_id=user.id,
                        amount=total_price,
                        reason=f"Bulk key creation: {count} keys × {duration_hours} hours for product {product.name}",
                        ip_address=None,
                        commit=False  # Don't commit, we're inside a transaction
                    )
                    
                    if not success:
                        return 0, f"Failed to deduct balance: {error_msg}", None

            key_generation_service = get_service('key_generation_service')
            for i in range(count):
                try:
                    key_string = key_generation_service.generate_key_string(
                        length=32, product=product, duration_hours=duration_hours, project_id=user.project_id
                    )

                    user_roles = RBACManager.get_user_role_names(user)
                    created_by_role = (
                        user_roles[0] if user_roles else UserRoles.CLIENT.value
                    )

                    key_metadata = {
                        "type": "production",
                        "generation_type": "access_code" if is_access_code else "license_key",
                        "created_by": user.id,
                        "created_by_role": created_by_role,
                        "batch_id": batch_id,
                    }

                    key = Key(
                        key=key_string,
                        user_id=user.id,
                        product_id=product.id,  # Use product.id instead of product_id parameter
                        expires_at=expires_at,
                        max_devices=max_devices,
                        duration_hours=duration_hours,
                        status=1,
                        project_id=user.project_id,
                        key_metadata=json.dumps(key_metadata),
                    )

                    db.session.add(key)
                    db.session.flush()

                    # Use cache invalidation instead of deprecated counter functions to avoid race conditions
                    # Note: cached_statistics_service is imported from module-level singleton
                    from ...services.statistics import cached_statistics_service
                    cached_statistics_service.invalidate_on_key_change(user.id, user.project_id)

                    created_keys.append(key)
                except Exception as key_error:
                    errors.append(f"Key {i+1}: {str(key_error)}")
                    self.logger.error(f"Failed to create key {i+1}: {str(key_error)}")

            if created_keys:
                db.session.commit()
                self.logger.info(f"Bulk created {len(created_keys)} keys")

            if errors and not created_keys:
                return 0, f"All keys failed to create: {errors}", None

            created_count = len(created_keys)
            error_message = f"Some keys failed: {errors}" if errors else None

            return created_count, error_message, created_keys

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to create bulk keys: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return 0, f"Failed to create bulk keys: {str(e)}", None

    def bulk_pause_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Pause multiple keys"""
        try:
            keys = self._get_keys_by_ids(user, key_ids)
            if not keys:
                return 0, "No keys found or access denied"

            key_status_service = get_service('key_status_service')
            affected_count = 0
            for key in keys:
                success, error = key_status_service.pause_key(user, key.id)
                if success:
                    affected_count += 1

            self.logger.info(f"Bulk paused {affected_count} keys for user {user.id}")
            return affected_count, None
        except Exception as e:
            self.logger.error(f"Failed to bulk pause keys: {str(e)}")
            return 0, f"Failed to bulk pause keys: {str(e)}"

    def bulk_resume_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Resume multiple keys"""
        try:
            keys = self._get_keys_by_ids(user, key_ids)
            if not keys:
                return 0, "No keys found or access denied"

            key_status_service = get_service('key_status_service')
            affected_count = 0
            for key in keys:
                success, error = key_status_service.resume_key(user, key.id)
                if success:
                    affected_count += 1

            self.logger.info(f"Bulk resumed {affected_count} keys for user {user.id}")
            return affected_count, None
        except Exception as e:
            self.logger.error(f"Failed to bulk resume keys: {str(e)}")
            return 0, f"Failed to bulk resume keys: {str(e)}"

    def bulk_delete_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Delete multiple keys"""
        try:
            keys = self._get_keys_by_ids(user, key_ids)
            if not keys:
                return 0, "No keys found or access denied"

            affected_count = 0
            for key in keys:
                success, error = key_crud_service.delete_key(user, key.id)
                if success:
                    affected_count += 1

            self.logger.info(f"Bulk deleted {affected_count} keys for user {user.id}")
            return affected_count, None
        except Exception as e:
            self.logger.error(f"Failed to bulk delete keys: {str(e)}")
            return 0, f"Failed to bulk delete keys: {str(e)}"

    def bulk_reset_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Reset multiple keys"""
        try:
            keys = self._get_keys_by_ids(user, key_ids)
            if not keys:
                return 0, "No keys found or access denied"

            key_ids_list = [key.id for key in keys]

            for key in keys:
                key.devices = ""
                key.activated_at = None
                key.fingerprint = None

            DeviceInfo.query.filter(DeviceInfo.key_id.in_(key_ids_list)).delete()

            db.session.commit()
            self.logger.info(f"Bulk reset {len(keys)} keys for user {user.id}")
            return len(keys), None
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk reset keys: {str(e)}")
            return 0, f"Failed to bulk reset keys: {str(e)}"

    def bulk_extend_keys(
        self, user: User, key_ids: List[int], hours: float
    ) -> Tuple[int, Optional[str]]:
        """Extend multiple keys"""
        try:
            keys = self._get_keys_by_ids(user, key_ids)
            if not keys:
                return 0, "No keys found or access denied"

            key_status_service = get_service('key_status_service')
            affected_count = 0
            for key in keys:
                success, error = key_status_service.extend_key(user, key.id, hours)
                if success:
                    affected_count += 1

            self.logger.info(f"Bulk extended {affected_count} keys for user {user.id}")
            return affected_count, None
        except Exception as e:
            self.logger.error(f"Failed to bulk extend keys: {str(e)}")
            return 0, f"Failed to bulk extend keys: {str(e)}"

    def bulk_delete_keys_by_filters(
        self, user: User, filters: Dict[str, Any]
    ) -> Tuple[int, Optional[str]]:
        """Delete keys by filters"""
        try:
            keys = self._get_keys_by_filters(user, filters)
            if not keys:
                return 0, "No keys found matching filters"

            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            key_ids = [key.id for key in keys]
            return self.bulk_delete_keys(user, key_ids)

        except Exception as e:
            self.logger.error(f"Failed to bulk delete keys by filters: {str(e)}")
            return 0, f"Failed to bulk delete keys by filters: {str(e)}"

    def bulk_reset_keys_by_filters(
        self, user: User, filters: Dict[str, Any]
    ) -> Tuple[int, Optional[str]]:
        """Reset keys by filters"""
        try:
            keys = self._get_keys_by_filters(user, filters)
            if not keys:
                return 0, "No keys found matching filters"

            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to reset. Maximum: {self.max_bulk_operations}"

            key_ids = [key.id for key in keys]
            return self.bulk_reset_keys(user, key_ids)

        except Exception as e:
            self.logger.error(f"Failed to bulk reset keys by filters: {str(e)}")
            return 0, f"Failed to bulk reset keys by filters: {str(e)}"

    def bulk_extend_keys_by_filters(
        self, user: User, filters: Dict[str, Any], hours: float
    ) -> Tuple[int, Optional[str]]:
        """Extend keys by filters"""
        try:
            keys = self._get_keys_by_filters(user, filters)
            if not keys:
                return 0, "No keys found matching filters"

            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to extend. Maximum: {self.max_bulk_operations}"

            key_ids = [key.id for key in keys]
            return self.bulk_extend_keys(user, key_ids, hours)

        except Exception as e:
            self.logger.error(f"Failed to bulk extend keys by filters: {str(e)}")
            return 0, f"Failed to bulk extend keys by filters: {str(e)}"

    def bulk_pause_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk pause keys by product"""
        try:
            # Use ServiceContainer to avoid circular imports
            product_service = get_service('product_service')
            # get_product now raises exceptions
            product = product_service.get_product(user, product_id)

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()
            if not keys:
                return 0, None, product.name

            key_ids = [key.id for key in keys]
            affected_count, error = self.bulk_pause_keys(user, key_ids)

            return affected_count, error, product.name

        except (NotFoundError, PermissionDeniedError) as e:
            # Re-raise service exceptions to be handled by caller
            raise
        except Exception as e:
            self.logger.error(f"Failed to bulk pause keys by product: {str(e)}")
            return 0, f"Failed to pause keys: {str(e)}", None

    def bulk_resume_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk resume keys by product"""
        try:
            # Use ServiceContainer to avoid circular imports
            product_service = get_service('product_service')
            # get_product now raises exceptions
            product = product_service.get_product(user, product_id)

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()
            if not keys:
                return 0, None, product.name

            key_ids = [key.id for key in keys]
            affected_count, error = self.bulk_resume_keys(user, key_ids)

            return affected_count, error, product.name

        except Exception as e:
            self.logger.error(f"Failed to bulk resume keys by product: {str(e)}")
            return 0, f"Failed to resume keys: {str(e)}", None

    def bulk_reset_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk reset keys by product"""
        try:
            # Use ServiceContainer to avoid circular imports
            product_service = get_service('product_service')
            # get_product now raises exceptions
            product = product_service.get_product(user, product_id)

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()
            if not keys:
                return 0, None, product.name

            key_ids = [key.id for key in keys]
            affected_count, error = self.bulk_reset_keys(user, key_ids)

            return affected_count, error, product.name

        except Exception as e:
            self.logger.error(f"Failed to bulk reset keys by product: {str(e)}")
            return 0, f"Failed to reset keys: {str(e)}", None

    def bulk_add_hours_by_product(
        self, user: User, product_id: int, hours: float
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk add hours to keys by product"""
        try:
            # Use ServiceContainer to avoid circular imports
            product_service = get_service('product_service')
            # get_product now raises exceptions
            product = product_service.get_product(user, product_id)

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()
            if not keys:
                return 0, None, product.name

            key_ids = [key.id for key in keys]
            affected_count, error = self.bulk_extend_keys(user, key_ids, hours)

            return affected_count, error, product.name

        except Exception as e:
            self.logger.error(f"Failed to bulk add hours by product: {str(e)}")
            return 0, f"Failed to add hours: {str(e)}", None

    def bulk_delete_unused_loader_keys(
        self, user: User, agent_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete unused agent keys"""
        try:
            from sqlalchemy import or_

            keys = Key.query.filter(
                Key.agent_id == agent_id,
                Key.project_id == user.project_id,
                or_(Key.devices == "", Key.devices.is_(None)),
            ).all()

            if not keys:
                return 0, "No unused agent keys found"

            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            key_ids = [key.id for key in keys]
            return self.bulk_delete_keys(user, key_ids)

        except Exception as e:
            self.logger.error(f"Failed to bulk delete unused agent keys: {str(e)}")
            return 0, f"Failed to bulk delete unused agent keys: {str(e)}"

    def bulk_delete_expired_loader_keys(
        self, user: User, agent_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete expired agent keys"""
        try:
            keys = Key.query.filter(
                Key.agent_id == agent_id,
                Key.project_id == user.project_id,
                Key.expires_at <= datetime.utcnow(),
            ).all()

            if not keys:
                return 0, "No expired agent keys found"

            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            key_ids = [key.id for key in keys]
            return self.bulk_delete_keys(user, key_ids)

        except Exception as e:
            self.logger.error(f"Failed to bulk delete expired agent keys: {str(e)}")
            return 0, f"Failed to bulk delete expired agent keys: {str(e)}"


# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   key_bulk_operations_service = get_service('key_bulk_operations_service')
# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   key_bulk_operations_service = get_service('key_bulk_operations_service')
