"""
Key Service
Handles key management, generation, and all key-related business logic
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product
from ...models.keys import DeviceInfo, Key, KeyAnalytics, TokenTransaction
from ...models.agents import Agent
from ...services.key_generation_service import key_generation_service
from ...services.key_validation_service import key_validation_service
from ...services.rbac import rbac_service
from ...utils.data_masking import mask_license_key
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from ...utils.structured_logging import get_logger
from .key_filter_specification import KeyFilterSpecification

class KeyService:
    """Service for handling key management operations"""

    def __init__(self):
        self.logger = get_logger("key_service")
        self.max_bulk_operations = 1000
        self.generation_service = key_generation_service
        self.validation_service = key_validation_service

    def generate_key_string(
        self,
        length: int = 32,
        product: Optional[Product] = None,
        agent: Optional[Agent] = None,
        duration_hours: Optional[float] = None,
        project_id: Optional[int] = None,
    ) -> str:
        """
        Generate a cryptographically secure key string
        Delegates to KeyGenerationService

        Args:
            length: Length of the key
            product: Product object for prefix generation
            agent: Agent object for prefix generation
            duration_hours: Duration in hours for prefix
            project_id: Project ID for uniqueness check

        Returns:
            Generated key string
        """
        return self.generation_service.generate_key_string(
            length=length,
            product=product,
            agent=agent,
            duration_hours=duration_hours,
            project_id=project_id,
        )

    def _create_key_individually(
        self, user: User, key_data: Dict[str, Any]
    ) -> Tuple[Optional[Key], Optional[str]]:
        """
        Create a single key in its own transaction
        Commits on success, rolls back on failure

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Returns:
            Tuple of (Key object or None, error message or None)
        """
        try:
            key, error = self._create_key_within_transaction(user, key_data)
            if key:

                db.session.flush()
                key_id = key.id

                key_attrs = {
                    "id": key_id,
                    "key": key.key,
                    "product_id": key.product_id,
                    "agent_id": key.agent_id,
                    "expires_at": key.expires_at,
                    "max_devices": key.max_devices,
                    "duration_hours": key.duration_hours,
                    "created_at": key.created_at,
                    "status": key.status,
                    "project_id": key.project_id,
                    "user_id": key.user_id,
                    "key_metadata": key.key_metadata,
                }

                db.session.commit()

                try:

                    db.session.refresh(key)
                    self.logger.debug(f"Successfully refreshed key {key_id} after commit")
                    return key, None
                except Exception as refresh_error:

                    self.logger.debug(
                        f"Refresh failed for key {key_id}, trying session.get(): {str(refresh_error)}"
                    )
                    try:

                        reloaded_key = db.session.get(Key, key_id)
                        if reloaded_key:
                            self.logger.debug(f"Successfully got key {key_id} using session.get()")
                            return reloaded_key, None
                        else:

                            self.logger.warning(
                                f"session.get() returned None for key {key_id}, but key exists. Returning key object anyway."
                            )

                            return key, None
                    except Exception as get_error:

                        self.logger.warning(
                            f"All reload attempts failed for key {key_id}, but key exists. Returning key object: {str(get_error)}"
                        )

                return key, None
            else:
                db.session.rollback()
                return None, error
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to create key individually: {str(e)}")
            import traceback

            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return None, f"Failed to create key: {str(e)}"

    def _create_key_within_transaction(
        self, user: User, key_data: Dict[str, Any]
    ) -> Tuple[Optional[Key], Optional[str]]:
        """
        Create a single key within an existing transaction (used by bulk operations)
        Does NOT commit or rollback - expects caller to handle transaction

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Returns:
            Tuple of (Key object or None, error message or None)
        """

        is_valid, error_msg = self.validation_service.validate_key_data(user, key_data)
        if not is_valid:
            return None, error_msg

        product = None
        agent = None

        if key_data.get("product_id"):
            product = Product.query.filter_by(id=key_data["product_id"], project_id=user.project_id).first()
            if not product:
                return None, "Product not found or access denied"

        if key_data.get("agent_id"):
            agent = Agent.query.filter_by(
                id=key_data["agent_id"], project_id=user.project_id
            ).first()
            if not agent:
                return None, "Agent not found or access denied"

        duration_hours = key_data.get("duration_hours", 24)
        max_devices = key_data.get("max_devices", 1)

        key_string = self.generation_service.generate_key_string(
            length=key_data.get("length", 32),
            product=product,
            agent=agent,
            duration_hours=duration_hours,
            project_id=user.project_id,
        )

        expires_at = None
        if duration_hours:
            expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

        key = Key(
            key=key_string,
            user_id=user.id,
            product_id=key_data.get("product_id"),
            agent_id=key_data.get("agent_id"),
            expires_at=expires_at,
            max_devices=max_devices,
            duration_hours=duration_hours,
            status=1,
            project_id=user.project_id,
            key_metadata=key_data.get("key_metadata"),
        )

        db.session.add(key)

        db.session.flush()

        from ...utils.key_counters import increment_user_key_counters
        increment_user_key_counters(user.id, is_active=True)

        try:
            from .webhook_service import get_webhook_service

            webhook_service = get_webhook_service()

            webhook_data = {
                "key_id": key.id,
                "key_value": key.key,
                "user_id": user.id,
                "username": user.username,
                "product_id": key.product_id,
                "product_name": product.name if product else None,
                "duration_hours": key.duration_hours,
                "max_devices": key.max_devices,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "created_at": key.created_at.isoformat(),
            }

            try:
                webhook_service.trigger_webhook("key.created", webhook_data, user.project_id)
                self.logger.info(f"Triggered webhook for key creation: {key.id}")
            except Exception as webhook_error:

                self.logger.warning(f"Webhook trigger failed (non-critical): {str(webhook_error)}")

        except Exception as e:

            self.logger.warning(f"Webhook system error (non-critical): {str(e)}")

        self.logger.info(f"Created key {key.id} for user {user.id}")
        return key, None

    def create_key(
        self, user: User, key_data: Dict[str, Any]
    ) -> Tuple[Optional[Key], Optional[str]]:
        """
        Create a single key

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Returns:
            Tuple of (Key object or None, error message or None)
        """
        return self._create_key_individually(user, key_data)

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

        is_valid, error_msg = self.validation_service.validate_bulk_operation(
            len(keys_data), self.max_bulk_operations
        )
        if not is_valid:
            return 0, [error_msg]

        created_count = 0
        errors = []

        for i, key_data in enumerate(keys_data):
            try:

                key, error = self._create_key_individually(user, key_data)
                if key:
                    created_count += 1
                else:
                    errors.append(f"Key {i+1}: {error}")
            except Exception as e:

                try:
                    db.session.rollback()
                except Exception:
                    pass
                error_msg = str(e)
                errors.append(f"Key {i+1}: Failed to create key: {error_msg}")
                self.logger.error(f"Failed to create key {i+1} in bulk: {error_msg}")

        self.logger.info(f"Bulk created {created_count} keys for user {user.id}")
        return created_count, errors

    def get_keys(self, user: User, filters: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], int]:
        """
        Get keys with filters and pagination

        Args:
            user: User requesting keys
            filters: Filter parameters

        Returns:
            Tuple of (keys_list, total_count)
        """
        try:
            self.logger.info(
                f"🔍 Getting keys for user {user.id}, project {user.project_id} with filters: {filters}"
            )

            query = Key.query.options(joinedload(Key.product)).filter_by(project_id=user.project_id)

            my_keys_only = filters.get("my_keys", False)

            if not RBACManager.is_owner(user) and not RBACManager.is_admin(user):
                has_keys_view = rbac_service.check_permission(user.id, "keys.view")
                if not has_keys_view:

                    query = query.filter_by(user_id=user.id)
                    self.logger.info(
                        f"🔒 Filtering keys by user_id={user.id} (user doesn't have keys.view permission)"
                    )
                elif my_keys_only:

                    query = query.filter_by(user_id=user.id)
                    self.logger.info(
                        f"🔒 Filtering keys by user_id={user.id} (my_keys filter enabled)"
                    )
                else:
                    self.logger.info(
                        f"👁️ User {user.id} has keys.view permission - showing all keys in project"
                    )
            elif my_keys_only:

                query = query.filter_by(user_id=user.id)
                self.logger.info(
                    f"🔒 Filtering keys by user_id={user.id} (my_keys filter enabled for owner/admin)"
                )

            initial_count = query.count()
            self.logger.info(f"📊 Initial query count (all keys in project): {initial_count}")

            # Apply filters using KeyFilterSpecification
            filter_spec = KeyFilterSpecification(filters, logger=self.logger)
            query = filter_spec.apply(query)

            filtered_count = query.count()
            self.logger.info(f"🔧 Filtered query count: {filtered_count}")

            page = filters.get("page", 1)
            per_page = min(filters.get("per_page", 20), 100)

            total_count = query.count()
            self.logger.info(f"📄 Total count for pagination: {total_count}")

            pagination = query.order_by(Key.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            self.logger.info(
                f"📋 Pagination: page={page}, per_page={per_page}, items={len(pagination.items)}"
            )

            keys = []
            for key in pagination.items:

                product_name = key.product.name if key.product else None

                is_expired = key.expires_at and key.expires_at <= datetime.utcnow()
                is_active = key.status == 1 and (not key.expires_at or not is_expired)

                self.logger.info(
                    f"🔑 Key {key.id}: status={key.status}, expires_at={key.expires_at}, is_active={is_active}, product_name={product_name}"
                )

                device_count = 0
                if key.devices:
                    try:

                        devices_list = (
                            json.loads(key.devices) if isinstance(key.devices, str) else key.devices
                        )
                        if isinstance(devices_list, list):
                            device_count = len(devices_list)
                        else:

                            devices_list = [d.strip() for d in key.devices.split(",") if d.strip()]
                            device_count = len(devices_list)
                    except (json.JSONDecodeError, AttributeError):

                        devices_list = [d.strip() for d in key.devices.split(",") if d.strip()]
                        device_count = len(devices_list)

                keys.append(
                    {
                        "id": key.id,
                        "key": mask_license_key(key.key),
                        "user_id": key.user_id,
                        "product_id": key.product_id,
                        "product_name": product_name,
                        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                        "max_devices": key.max_devices,
                        "devices": key.devices,
                        "device_count": device_count,
                        "status": key.status,
                        "is_active": is_active,
                        "is_expired": is_expired,
                        "created_at": key.created_at.isoformat(),
                        "activated_at": key.activated_at.isoformat() if key.activated_at else None,
                        "duration_hours": key.duration_hours,
                        "key_metadata": key.key_metadata,
                    }
                )

            self.logger.info(f"✅ Returning {len(keys)} keys out of {total_count} total")
            return keys, total_count

        except Exception as e:
            self.logger.error(f"Failed to get keys: {str(e)}")
            return [], 0

    def _apply_filters(self, query, filters: Dict[str, Any]):
        """
        Apply filters to query (deprecated - use KeyFilterSpecification instead)
        Kept for backward compatibility with other methods
        """
        filter_spec = KeyFilterSpecification(filters, logger=self.logger)
        return filter_spec.apply(query)

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

    def _perform_bulk_action(
        self, user: User, action: str, key_ids: List[int], **kwargs
    ) -> Tuple[int, Optional[str]]:
        """
        Perform bulk action on keys

        Args:
            user: User performing action
            action: Action to perform ('pause', 'resume', 'delete', 'reset', 'extend')
            key_ids: List of key IDs
            **kwargs: Additional parameters for specific actions

        Returns:
            Tuple of (affected_count, error_message)
        """
        try:
            keys = self._get_keys_by_ids(user, key_ids)

            if not keys:
                return 0, "No keys found or access denied"

            affected_count = 0

            for key in keys:
                if action == "pause":
                    old_status = key.status
                    key.status = 0

                    from ...utils.key_counters import update_user_key_counters_on_status_change
                    update_user_key_counters_on_status_change(key.user_id, old_status, 0)
                    affected_count += 1
                elif action == "resume":
                    old_status = key.status
                    key.status = 1

                    from ...utils.key_counters import update_user_key_counters_on_status_change
                    update_user_key_counters_on_status_change(key.user_id, old_status, 1)
                    affected_count += 1
                elif action == "delete":

                    user_id = key.user_id
                    was_active = key.status == 1

                    db.session.delete(key)

                    from ...utils.key_counters import decrement_user_key_counters
                    decrement_user_key_counters(user_id, was_active=was_active)

                    affected_count += 1
                elif action == "reset":
                    key.devices = ""
                    key.activated_at = None
                    key.fingerprint = None

                    DeviceInfo.query.filter_by(key_id=key.id).delete()
                    affected_count += 1
                elif action == "extend":
                    hours = kwargs.get("hours", 24)
                    if key.expires_at:
                        key.expires_at += timedelta(hours=hours)
                    else:
                        key.expires_at = datetime.utcnow() + timedelta(hours=hours)
                    key.duration_hours += hours
                    affected_count += 1

            db.session.commit()
            self.logger.info(f"Bulk {action} performed on {affected_count} keys for user {user.id}")
            return affected_count, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to perform bulk {action}: {str(e)}")
            return 0, f"Failed to perform bulk {action}: {str(e)}"

    def bulk_pause_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Pause multiple keys"""
        return self._perform_bulk_action(user, "pause", key_ids)

    def bulk_resume_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Resume multiple keys"""
        return self._perform_bulk_action(user, "resume", key_ids)

    def bulk_delete_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Delete multiple keys"""
        return self._perform_bulk_action(user, "delete", key_ids)

    def bulk_reset_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Reset multiple keys"""
        return self._perform_bulk_action(user, "reset", key_ids)

    def bulk_extend_keys(
        self, user: User, key_ids: List[int], hours: float
    ) -> Tuple[int, Optional[str]]:
        """Extend multiple keys"""
        return self._perform_bulk_action(user, "extend", key_ids, hours=hours)

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

            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product:
                return 0, "Product not found or access denied", None

            is_access_code = product.login_type == "classic_login"
            item_type = "access codes" if is_access_code else "license keys"

            created_keys = []
            batch_id = f'batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}'
            errors = []

            expires_at = None
            if duration_hours:
                expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

            for i in range(count):
                try:
                    key_string = self.generate_key_string(
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
                        product_id=product_id,
                        expires_at=expires_at,
                        max_devices=max_devices,
                        duration_hours=duration_hours,
                        status=1,
                        project_id=user.project_id,
                        key_metadata=json.dumps(key_metadata),
                    )

                    db.session.add(key)
                    db.session.flush()

                    from ...utils.key_counters import increment_user_key_counters
                    increment_user_key_counters(user.id, is_active=True)

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
        query = self._apply_filters(query, filters)
        return query.all()

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

            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                db.session.delete(key)

            db.session.commit()

            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk deleted {len(keys)} keys by filters for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
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

            for key in keys:
                key.devices = ""
                key.activated_at = None
                key.fingerprint = None

            DeviceInfo.query.filter(DeviceInfo.key_id.in_(key_ids)).delete()

            db.session.commit()
            self.logger.info(f"Bulk reset {len(keys)} keys by filters for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
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

            for key in keys:
                if key.expires_at:
                    key.expires_at += timedelta(hours=hours)
                else:
                    key.expires_at = datetime.utcnow() + timedelta(hours=hours)
                key.duration_hours += hours

            db.session.commit()
            self.logger.info(f"Bulk extended {len(keys)} keys by filters for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk extend keys by filters: {str(e)}")
            return 0, f"Failed to bulk extend keys by filters: {str(e)}"

    def bulk_pause_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk pause keys by product

        Args:
            user: User performing the operation
            product_id: Product ID

        Returns:
            Tuple of (affected_count, error_message, product_name)
        """
        try:

            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product:
                return 0, "Product not found or access denied", None

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, product.name

            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                key.status = 0

            db.session.commit()

            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk paused {len(keys)} keys for product {product_id} by user {user.id}")
            return len(keys), None, product.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk pause keys by product: {str(e)}")
            return 0, f"Failed to pause keys: {str(e)}", None

    def bulk_resume_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk resume keys by product

        Args:
            user: User performing the operation
            product_id: Product ID

        Returns:
            Tuple of (affected_count, error_message, product_name)
        """
        try:

            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product:
                return 0, "Product not found or access denied", None

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, product.name

            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                key.status = 1

            db.session.commit()

            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk resumed {len(keys)} keys for product {product_id} by user {user.id}")
            return len(keys), None, product.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk resume keys by product: {str(e)}")
            return 0, f"Failed to resume keys: {str(e)}", None

    def bulk_reset_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk reset keys by product

        Args:
            user: User performing the operation
            product_id: Product ID

        Returns:
            Tuple of (affected_count, error_message, product_name)
        """
        try:

            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product:
                return 0, "Product not found or access denied", None

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, product.name

            key_ids = [key.id for key in keys]

            for key in keys:
                key.devices = ""
                key.fingerprint = None
                key.activated_at = None

            DeviceInfo.query.filter(DeviceInfo.key_id.in_(key_ids)).delete()

            db.session.commit()

            self.logger.info(f"Bulk reset {len(keys)} keys for product {product_id} by user {user.id}")
            return len(keys), None, product.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk reset keys by product: {str(e)}")
            return 0, f"Failed to reset keys: {str(e)}", None

    def bulk_add_hours_by_product(
        self, user: User, product_id: int, hours: float
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk add hours to keys by product

        Args:
            user: User performing the operation
            product_id: Product ID
            hours: Hours to add

        Returns:
            Tuple of (affected_count, error_message, product_name)
        """
        try:

            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if not product:
                return 0, "Product not found or access denied", None

            keys = Key.query.filter_by(product_id=product_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, product.name

            for key in keys:
                if key.expires_at:
                    key.expires_at += timedelta(hours=hours)
                else:
                    key.expires_at = datetime.utcnow() + timedelta(hours=hours)

            db.session.commit()

            self.logger.info(
                f"Bulk added {hours} hours to {len(keys)} keys for product {product_id} by user {user.id}"
            )
            return len(keys), None, product.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk add hours by product: {str(e)}")
            return 0, f"Failed to add hours: {str(e)}", None

    def get_key_stats(self, user: User) -> Dict[str, Any]:
        """Get key statistics for user's project"""
        try:
            query = Key.query.filter_by(project_id=user.project_id)

            total_keys = query.count()
            active_keys = query.filter(
                Key.status == 1, or_(Key.expires_at.is_(None), Key.expires_at > datetime.utcnow())
            ).count()
            expired_keys = query.filter(Key.expires_at <= datetime.utcnow()).count()
            inactive_keys = query.filter(Key.status == 0).count()

            keys_by_product = (
                db.session.query(Product.name, func.count(Key.id).label("count"))
                .join(Key, Product.id == Key.product_id)
                .filter(Key.project_id == user.project_id)
                .group_by(Product.id, Product.name)
                .all()
            )

            return {
                "total_keys": total_keys,
                "active_keys": active_keys,
                "expired_keys": expired_keys,
                "inactive_keys": inactive_keys,
                "keys_by_product": [
                    {"product_name": name, "count": count} for name, count in keys_by_product
                ],
            }

        except Exception as e:
            self.logger.error(f"Failed to get key stats: {str(e)}")
            return {
                "total_keys": 0,
                "active_keys": 0,
                "expired_keys": 0,
                "inactive_keys": 0,
                "keys_by_product": [],
            }

    def bulk_delete_unused_loader_keys(
        self, user: User, agent_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete unused agent keys"""
        try:
            keys = Key.query.filter(
                Key.agent_id == agent_id,
                Key.project_id == user.project_id,
                or_(Key.devices == "", Key.devices.is_(None)),
            ).all()

            if not keys:
                return 0, "No unused agent keys found"

            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                db.session.delete(key)

            db.session.commit()

            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk deleted {len(keys)} unused agent keys for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
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

            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                db.session.delete(key)

            db.session.commit()

            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk deleted {len(keys)} expired agent keys for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk delete expired agent keys: {str(e)}")
            return 0, f"Failed to bulk delete expired agent keys: {str(e)}"

    def update_key(
        self, user: User, key_id: int, data: Dict[str, Any]
    ) -> Tuple[Optional[Key], Optional[str]]:
        """
        Update a key

        Args:
            user: User updating the key
            key_id: Key ID
            data: Update data

        Returns:
            Tuple of (Key object or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            if "max_devices" in data:
                max_devices = data["max_devices"]
                if not isinstance(max_devices, int) or max_devices < 1:
                    return None, "Max devices must be a positive integer"
                key.max_devices = max_devices

            if "duration" in data:
                duration = data["duration"]
                if not isinstance(duration, int) or duration < 1:
                    return None, "Duration must be a positive integer"

                if key.expires_at and key.expires_at > datetime.utcnow():
                    if key.created_at:
                        key.expires_at = key.created_at + timedelta(hours=duration)
                    else:
                        key.expires_at = datetime.utcnow() + timedelta(hours=duration)
                else:
                    key.expires_at = datetime.utcnow() + timedelta(hours=duration)

            db.session.commit()
            return key, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to update key: {str(e)}")
            return None, f"Failed to update key: {str(e)}"

    def delete_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Delete a key

        Args:
            user: User deleting the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            user_id = key.user_id
            project_id = key.project_id
            was_active = key.status == 1

            db.session.delete(key)

            from ...utils.key_counters import decrement_user_key_counters
            decrement_user_key_counters(user_id, was_active=was_active)

            if project_id:
                from ...utils.project_counters import decrement_project_key_counters
                decrement_project_key_counters(project_id, was_active=was_active)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to delete key: {str(e)}")
            return False, f"Failed to delete key: {str(e)}"

    def reset_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Reset a key (clear devices and activation info)

        Args:
            user: User resetting the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            key.devices = ""
            key.fingerprint = None
            key.activated_at = None

            DeviceInfo.query.filter_by(key_id=key.id).delete()

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to reset key: {str(e)}")
            return False, f"Failed to reset key: {str(e)}"

    def pause_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Pause a key (set status to 0 - inactive)

        Args:
            user: User pausing the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = 0

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 0)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 0)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to pause key: {str(e)}")
            return False, f"Failed to pause key: {str(e)}"

    def resume_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Resume a key (set status to 1)

        Args:
            user: User resuming the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = 1

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 1)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to resume key: {str(e)}")
            return False, f"Failed to resume key: {str(e)}"

    def block_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Block a key (set status to 2)

        Args:
            user: User blocking the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = 2

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 2)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 2)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to block key: {str(e)}")
            return False, f"Failed to block key: {str(e)}"

    def unblock_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Unblock a key (set status to 1)

        Args:
            user: User unblocking the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = 1

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 1)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to unblock key: {str(e)}")
            return False, f"Failed to unblock key: {str(e)}"

    def archive_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Archive a key (set status to 4)

        Args:
            user: User archiving the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = 4

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 4)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 4)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to archive key: {str(e)}")
            return False, f"Failed to archive key: {str(e)}"

    def restore_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """
        Restore an archived key (set status to 1)

        Args:
            user: User restoring the key
            key_id: Key ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            old_status = key.status
            key.status = 1

            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)

            if key.project_id:
                from ...utils.project_counters import update_project_key_counters_on_status_change
                update_project_key_counters_on_status_change(key.project_id, old_status, 1)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to restore key: {str(e)}")
            return False, f"Failed to restore key: {str(e)}"

    def extend_key(
        self, user: User, key_id: int, hours: float
    ) -> Tuple[bool, Optional[str]]:
        """
        Extend a key's expiration time

        Args:
            user: User extending the key
            key_id: Key ID
            hours: Hours to add

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            if hours <= 0:
                return False, "Hours must be positive"

            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            if key.expires_at:
                key.expires_at += timedelta(hours=hours)
            else:
                key.expires_at = datetime.utcnow() + timedelta(hours=hours)

            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to extend key: {str(e)}")
            return False, f"Failed to extend key: {str(e)}"

    def duplicate_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Key], Optional[str]]:
        """
        Duplicate a key

        Args:
            user: User duplicating the key
            key_id: Key ID

        Returns:
            Tuple of (duplicated Key object or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            product = Product.query.get(key.product_id) if key.product_id else None
            if not product:
                return None, "Product not found"

            new_key_string = self.generate_key_string(
                length=32, product=product, duration_hours=key.duration_hours, project_id=user.project_id
            )

            duplicate_key = Key(
                key=new_key_string,
                user_id=key.user_id,
                product_id=key.product_id,
                expires_at=key.expires_at,
                max_devices=key.max_devices,
                duration_hours=key.duration_hours,
                status=key.status,
                project_id=key.project_id,
                key_metadata=key.key_metadata,
            )

            db.session.add(duplicate_key)
            db.session.flush()

            if duplicate_key.status == 1:
                from ...utils.key_counters import increment_user_key_counters
                increment_user_key_counters(duplicate_key.user_id, is_active=True)

                if duplicate_key.project_id:
                    from ...utils.project_counters import increment_project_key_counters
                    increment_project_key_counters(duplicate_key.project_id, is_active=True)

            db.session.commit()
            return duplicate_key, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to duplicate key: {str(e)}")
            return None, f"Failed to duplicate key: {str(e)}"

    def move_key(
        self, user: User, key_id: int, new_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Move a key to another user

        Args:
            user: User moving the key
            key_id: Key ID
            new_user_id: Target user ID

        Returns:
            Tuple of (success, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return False, "Key not found or access denied"

            new_user = User.query.filter_by(id=new_user_id, project_id=user.project_id).first()
            if not new_user:
                return False, "Target user not found"

            key.user_id = new_user_id
            db.session.commit()
            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to move key: {str(e)}")
            return False, f"Failed to move key: {str(e)}"

    def get_key_details(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get detailed information about a key

        Args:
            user: User requesting details
            key_id: Key ID

        Returns:
            Tuple of (key details dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            product = (
                Product.query.filter_by(id=key.product_id, project_id=user.project_id).first()
                if key.product_id
                else None
            )

            devices = DeviceInfo.query.filter_by(key_id=key.id).all()
            devices_data = [
                {
                    "id": device.id,
                    "device_id": device.device_id,
                    "device_model": device.device_model,
                    "device_brand": device.device_brand,
                    "serial": device.serial,
                    "ip_address": device.ip_address,
                    "user_agent": device.user_agent,
                    "connected_at": device.connected_at.isoformat() if device.connected_at else None,
                    "last_seen": device.last_seen.isoformat() if device.last_seen else None,
                }
                for device in devices
            ]

            can_view_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            if not can_view_full_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_view_full_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_view_full_key = rbac_service.check_permission(user.id, "keys.view")

            key_value = key.key if can_view_full_key else mask_license_key(key.key)

            key_data = {
                "id": key.id,
                "key": key_value,
                "key_masked": not can_view_full_key,
                "product_id": key.product_id,
                "product_name": product.name if product else None,
                "status": key.status,
                "is_active": key.status == 1
                and (not key.expires_at or key.expires_at > datetime.utcnow()),
                "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "activated_at": key.activated_at.isoformat() if key.activated_at else None,
                "max_devices": key.max_devices,
                "device_count": (
                    len([d.strip() for d in key.devices.split(",") if d.strip()]) if key.devices else 0
                ),
                "duration_hours": key.duration_hours,
                "project_id": key.project_id,
                "fingerprint": key.fingerprint,
                "key_metadata": key.key_metadata,
            }

            return {"key": key_data, "devices": devices_data, "usage_history": []}, None

        except Exception as e:
            self.logger.error(f"Failed to get key details: {str(e)}")
            return None, f"Failed to get key details: {str(e)}"

    def export_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Export a single key

        Args:
            user: User exporting the key
            key_id: Key ID

        Returns:
            Tuple of (export data dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            product = (
                Product.query.filter_by(id=key.product_id, project_id=user.project_id).first()
                if key.product_id
                else None
            )

            export_data = {
                "key_id": key.id,
                "key": key.key,
                "product_id": key.product_id,
                "product_name": product.name if product else None,
                "status": key.status,
                "is_active": key.status == 1
                and (not key.expires_at or key.expires_at > datetime.utcnow()),
                "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "activated_at": key.activated_at.isoformat() if key.activated_at else None,
                "max_devices": key.max_devices,
                "device_count": (
                    len([d.strip() for d in key.devices.split(",") if d.strip()]) if key.devices else 0
                ),
                "duration_hours": key.duration_hours,
                "project_id": key.project_id,
                "fingerprint": key.fingerprint,
                "key_metadata": key.key_metadata,
            }

            return export_data, None

        except Exception as e:
            self.logger.error(f"Failed to export key: {str(e)}")
            return None, f"Failed to export key: {str(e)}"

    def download_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Get key data for download (with security checks)

        Args:
            user: User downloading the key
            key_id: Key ID

        Returns:
            Tuple of (key data dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            can_download_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            if not can_download_full_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_download_full_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_download_full_key = rbac_service.check_permission(user.id, "keys.view")

            key_value = key.key if can_download_full_key else mask_license_key(key.key)

            product = (
                Product.query.filter_by(id=key.product_id, project_id=user.project_id).first()
                if key.product_id
                else None
            )

            export_data = {
                "key_id": key.id,
                "key": key_value,
                "key_masked": not can_download_full_key,
                "product_id": key.product_id,
                "product_name": product.name if product else None,
                "status": key.status,
                "is_active": key.status == 1
                and (not key.expires_at or key.expires_at > datetime.utcnow()),
                "is_expired": key.expires_at and key.expires_at <= datetime.utcnow(),
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "activated_at": key.activated_at.isoformat() if key.activated_at else None,
                "max_devices": key.max_devices,
                "device_count": (
                    len([d.strip() for d in key.devices.split(",") if d.strip()]) if key.devices else 0
                ),
                "duration_hours": key.duration_hours,
                "project_id": key.project_id,
                "fingerprint": key.fingerprint,
                "key_metadata": key.key_metadata,
            }

            return export_data, None

        except Exception as e:
            self.logger.error(f"Failed to download key: {str(e)}")
            return None, f"Failed to download key: {str(e)}"

    def reveal_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Reveal full license key (with security checks)

        Args:
            user: User revealing the key
            key_id: Key ID

        Returns:
            Tuple of (key data dict or None, error message or None)
        """
        try:
            key = Key.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key:
                return None, "Key not found or access denied"

            can_reveal_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            if not can_reveal_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_reveal_key = (
                        rbac_service.check_permission(user.id, "keys.see_analytics") or
                        rbac_service.check_permission(user.id, "keys.copy")
                    )
                else:
                    can_reveal_key = (
                        rbac_service.check_permission(user.id, "keys.see_analytics") or
                        rbac_service.check_permission(user.id, "keys.copy")
                    )

            if not can_reveal_key:

                self.logger.warning(
                    f"Unauthorized key reveal attempt: user_id={user.id}, key_id={key_id}, "
                    f"key_owner={key.user_id}, has_keys_see_analytics={rbac_service.check_permission(user.id, 'keys.see_analytics')}, "
                    f"has_keys_copy={rbac_service.check_permission(user.id, 'keys.copy')}"
                )
                return {
                    "key": mask_license_key(key.key),
                    "key_masked": True,
                    "error": "Insufficient permissions to reveal key"
                }, "Insufficient permissions to reveal key"

            self.logger.info(
                f"🔓 Key revealed: user_id={user.id}, key_id={key_id}, "
                f"key_owner={key.user_id}, is_own_key={key.user_id == user.id}"
            )

            return {
                "key": key.key,
                "key_masked": False,
                "id": key.id
            }, None

        except Exception as e:
            self.logger.error(f"Failed to reveal key: {str(e)}")
            return None, f"Failed to reveal key: {str(e)}"

key_service = KeyService()
