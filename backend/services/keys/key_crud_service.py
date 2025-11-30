"""
Key CRUD Service
Handles basic CRUD operations for keys: create, read, update, delete
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from sqlalchemy.orm import joinedload

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product
from ...models.keys import DeviceInfo, Key
from ...models.agents import Agent
from ...schemas.responses.service_responses import (
    KeyListResponse,
    KeyListItem,
    KeyDetailsResponse,
    KeyDetailsData,
    DeviceInfo as DeviceInfoSchema,
)
from ...utils.service_exceptions import ValidationError, NotFoundError, PermissionDeniedError, ServiceError
from ...utils.data_masking import mask_license_key
from ...utils.rbac_utils import RBACManager
from ...utils.structured_logging import get_logger
from ...utils.service_helpers import get_service
from .key_filter_specification import KeyFilterSpecification


from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ...services.keys.key_validation_service import KeyValidationService
    from ...services.keys.key_generation_service import KeyGenerationService
    from ...services.products.product_service import ProductService
    from ...services.products.price_calculation_service import PriceCalculationService
    from ...services.balance.balance_service import BalanceService
    from ...services.statistics.cached_statistics_service import CachedStatisticsService
    from ...services.webhooks.webhook_service import WebhookService
    from ...services.rbac.rbac_service import RBACService
    from ...services.cache.cache_service import CacheService
    from ...services.tier_limits.tier_limits_service import TierLimitsService

class KeyCRUDService:
    """Service for handling basic CRUD operations on keys"""

    def __init__(
        self,
        key_validation_service: 'KeyValidationService',
        key_generation_service: 'KeyGenerationService',
        product_service: 'ProductService',
        price_calculation_service: 'PriceCalculationService',
        balance_service: 'BalanceService',
        cached_statistics_service: 'CachedStatisticsService',
        webhook_service: 'WebhookService',
        rbac_service: 'RBACService',
        cache_service: 'CacheService',
        tier_limits_service: 'TierLimitsService',
        logger=None
    ):
        """
        Initialize KeyCRUDService with explicit dependencies.
        
        Args:
            key_validation_service: Service for validating key data
            key_generation_service: Service for generating key strings
            product_service: Service for product operations
            price_calculation_service: Service for calculating key prices
            balance_service: Service for balance operations
            cached_statistics_service: Service for invalidating statistics cache
            webhook_service: Service for triggering webhooks
            rbac_service: Service for RBAC checks
            cache_service: Service for cache operations
            tier_limits_service: Service for tier limits checks
            logger: Optional logger instance
        """
        self.logger = logger or get_logger("key_crud_service")
        

        self._key_validation_service = key_validation_service
        self._key_generation_service = key_generation_service
        self._product_service = product_service
        self._price_calculation_service = price_calculation_service
        self._balance_service = balance_service
        self._cached_statistics_service = cached_statistics_service
        self._webhook_service = webhook_service
        self._rbac_service = rbac_service
        self._cache_service = cache_service
        self._tier_limits_service = tier_limits_service
    

    def _parse_key_metadata(self, key_metadata_value):
        """
        Parse key_metadata from JSON string to dict if needed
        
        Args:
            key_metadata_value: Can be a string (JSON), dict, or None
            
        Returns:
            dict or None
        """
        if not key_metadata_value:
            return None
        
        try:
            import json
            if isinstance(key_metadata_value, str):
                return json.loads(key_metadata_value)
            elif isinstance(key_metadata_value, dict):
                return key_metadata_value
            else:
                return None
        except (json.JSONDecodeError, TypeError) as e:
            self.logger.warning(
                f"⚠️ Failed to parse key_metadata: {key_metadata_value}, error: {str(e)}"
            )
            return None

    def create_key(
        self, user: User, key_data: Dict[str, Any]
    ) -> Key:
        """
        Create a single key

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Returns:
            Key object

        Raises:
            ValidationError: If validation fails
            NotFoundError: If product or agent not found
            PermissionDeniedError: If access denied
            ServiceError: If database operation fails
        """
        try:
            key = self._create_key_within_transaction(user, key_data)
            db.session.flush()
            key_id = key.id

            try:
                db.session.refresh(key)
                self.logger.debug(f"Successfully refreshed key {key_id} after commit")
                db.session.commit()
                return key
            except Exception as refresh_error:
                self.logger.debug(
                    f"Refresh failed for key {key_id}, trying session.get(): {str(refresh_error)}"
                )
                try:
                    reloaded_key = db.session.get(Key, key_id)
                    if reloaded_key:
                        self.logger.debug(f"Successfully got key {key_id} using session.get()")
                        return reloaded_key
                    else:
                        self.logger.warning(
                            f"session.get() returned None for key {key_id}, but key exists. Returning key object anyway."
                        )
                        return key
                except Exception as get_error:
                    self.logger.warning(
                        f"All reload attempts failed for key {key_id}, but key exists. Returning key object: {str(get_error)}"
                    )
                    return key
        except (ValidationError, NotFoundError, PermissionDeniedError):
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to create key individually: {str(e)}", exc_info=True)
            raise ServiceError(f"Failed to create key: {str(e)}", status_code=500) from e

    def _create_key_within_transaction(
        self, user: User, key_data: Dict[str, Any]
    ) -> Key:
        """
        Create a single key within an existing transaction (used by bulk operations)
        Does NOT commit or rollback - expects caller to handle transaction

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Returns:
            Key object

        Raises:
            ValidationError: If validation fails
            NotFoundError: If product or agent not found
            PermissionDeniedError: If access denied
        """

        if not self._key_validation_service:
            raise ServiceError(
                "Key Validation Service dependency not injected",
                status_code=500
            )
        validation_service = self._key_validation_service
        validation_service.validate_key_data(user, key_data)

        product = None
        agent = None

        if key_data.get("product_id"):

            if not self._product_service:
                raise ServiceError(
                    "Product Service dependency not injected",
                    status_code=500
                )
            product_service = self._product_service

            product = product_service.get_product(user, key_data["product_id"])
            

            from ...models.core import Project
            
            project = Project.query.get(user.project_id)
            if project:
                if not self._tier_limits_service:
                    raise ServiceError(
                        "Tier Limits Service dependency not injected",
                        status_code=500
                    )
                tier_limits_service = self._tier_limits_service
                can_create, error_msg = tier_limits_service.check_key_limit_per_product(
                    project, key_data["product_id"]
                )
                if not can_create:
                    raise ValidationError(error_msg, field="key")

        if key_data.get("agent_id"):
            agent = Agent.query.filter_by(
                id=key_data["agent_id"], project_id=user.project_id
            ).first()
            if not agent:
                raise NotFoundError("Agent", resource_id=str(key_data["agent_id"]))

        duration_hours = key_data.get("duration_hours", 24)
        max_devices = key_data.get("max_devices", 1)


        from ...utils.rbac_utils import RBACManager
        
        is_owner = RBACManager.is_owner(user)
        is_admin = RBACManager.is_admin(user)
        
        if not is_owner and not is_admin and product and user.project_id:

            if not self._price_calculation_service:
                raise ServiceError(
                    "Price Calculation Service dependency not injected",
                    status_code=500
                )
            price_calculation_service = self._price_calculation_service
            if not self._balance_service:
                raise ServiceError(
                    "Balance Service dependency not injected",
                    status_code=500
                )
            balance_service = self._balance_service
            
            key_price = price_calculation_service.calculate_key_price(
                product_id=product.id,
                duration_hours=duration_hours,
                project_id=user.project_id
            )
            
            if key_price > 0:

                db.session.refresh(user)
                

                if user.token_balance < key_price:
                    raise ValidationError(f"Insufficient balance. Required: {key_price} tokens, Available: {user.token_balance} tokens")
                

                success, error_msg, _ = balance_service.deduct_balance(
                    current_user=user,
                    target_user_id=user.id,
                    amount=key_price,
                    reason=f"Key creation: {duration_hours} hours for product {product.name}",
                    ip_address=None,
                    commit=False
                )
                
                if not success:
                    raise ValidationError(f"Failed to deduct balance: {error_msg}")

        if not self._key_generation_service:
            raise ServiceError(
                "Key Generation Service dependency not injected",
                status_code=500
            )
        key_generation_service = self._key_generation_service
        key_string = key_generation_service.generate_key_string(
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
            product_id=product.id if product else key_data.get("product_id"),
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


        if not self._cached_statistics_service:
            raise ServiceError(
                "Cached Statistics Service dependency not injected",
                status_code=500
            )
        cached_statistics_service = self._cached_statistics_service
        cached_statistics_service.invalidate_on_key_change(user.id, user.project_id)

        try:

            if not self._webhook_service:
                raise ServiceError(
                    "Webhook Service dependency not injected",
                    status_code=500
                )
            webhook_service = self._webhook_service

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
        return key

    def get_keys(
        self, user: User, filters: Dict[str, Any]
    ) -> Union[Tuple[KeyListResponse, None], Tuple[None, str]]:
        """
        Get keys with filters and pagination

        Args:
            user: User requesting keys
            filters: Filter parameters

        Returns:
            Tuple of (KeyListResponse or None, error message or None)
            
        Note: For backward compatibility, this can also return (List[Dict], int).
        Use KeyListResponse for type safety in new code.
        """
        try:
            self.logger.info(
                f"🔍 Getting keys for user {user.id}, project {user.project_id} with filters: {filters}"
            )

            query = Key.query.options(joinedload(Key.product)).filter_by(project_id=user.project_id)

            my_keys_only = filters.get("my_keys", False)


            if not self._rbac_service:
                raise ServiceError(
                    "Rbac Service dependency not injected",
                    status_code=500
                )
            rbac_service = self._rbac_service
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



                is_expired = key.status == 1 and key.expires_at and key.expires_at <= datetime.utcnow()
                is_active = key.status == 1 and (not key.expires_at or not is_expired)

                self.logger.info(
                    f"🔑 Key {key.id}: status={key.status}, expires_at={key.expires_at}, is_active={is_active}, product_name={product_name}"
                )

                device_count = 0
                if key.devices:
                    try:
                        import json

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


                key_metadata = self._parse_key_metadata(key.key_metadata)

                keys.append(
                    KeyListItem(
                        id=key.unique_id,
                        key=mask_license_key(key.key),
                        user_id=key.user_id,
                        product_id=key.product_id,
                        product_name=product_name,
                        agent_id=key.agent_id,
                        expires_at=key.expires_at.isoformat() if key.expires_at else None,
                        max_devices=key.max_devices,
                        devices=key.devices,
                        device_count=device_count,
                        status=key.status,
                        is_active=is_active,
                        is_expired=is_expired,
                        created_at=key.created_at.isoformat(),
                        activated_at=key.activated_at.isoformat() if key.activated_at else None,
                        duration_hours=key.duration_hours,
                        key_metadata=key_metadata,
                    )
                )

            self.logger.info(f"✅ Returning {len(keys)} keys out of {total_count} total")
            return KeyListResponse(keys=keys, total=total_count), None

        except Exception as e:
            self.logger.error(f"Failed to get keys: {str(e)}")
            return None, f"Failed to get keys: {str(e)}"

    def get_key_details(
        self, user: User, key_id: int
    ) -> Tuple[Optional[KeyDetailsResponse], Optional[str]]:
        """
        Get detailed information about a key

        Args:
            user: User requesting details
            key_id: Key ID

        Returns:
            Tuple of (KeyDetailsResponse or None, error message or None)
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
                DeviceInfoSchema(
                    id=device.id,
                    device_id=device.device_id,
                    device_model=device.device_model,
                    device_brand=device.device_brand,
                    serial=device.serial,
                    ip_address=device.ip_address,
                    user_agent=device.user_agent,
                    connected_at=device.connected_at.isoformat() if device.connected_at else None,
                    last_seen=device.last_seen.isoformat() if device.last_seen else None,
                )
                for device in devices
            ]


            if not self._rbac_service:
                raise ServiceError(
                    "Rbac Service dependency not injected",
                    status_code=500
                )
            rbac_service = self._rbac_service

            can_view_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            if not can_view_full_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_view_full_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_view_full_key = rbac_service.check_permission(user.id, "keys.view")

            key_value = key.key if can_view_full_key else mask_license_key(key.key)


            key_metadata = self._parse_key_metadata(key.key_metadata)

            key_data = KeyDetailsData(
                id=key.id,
                key=key_value,
                key_masked=not can_view_full_key,
                product_id=key.product_id,
                product_name=product.name if product else None,
                agent_id=key.agent_id,
                status=key.status,
                is_active=key.status == 1
                and (not key.expires_at or key.expires_at > datetime.utcnow()),
                is_expired=key.expires_at and key.expires_at <= datetime.utcnow(),
                created_at=key.created_at.isoformat() if key.created_at else None,
                expires_at=key.expires_at.isoformat() if key.expires_at else None,
                activated_at=key.activated_at.isoformat() if key.activated_at else None,
                max_devices=key.max_devices,
                device_count=(
                    len([d.strip() for d in key.devices.split(",") if d.strip()]) if key.devices else 0
                ),
                duration_hours=key.duration_hours,
                project_id=key.project_id,
                fingerprint=key.fingerprint,
                key_metadata=key_metadata,
            )

            return KeyDetailsResponse(key=key_data, devices=devices_data, usage_history=[]), None

        except Exception as e:
            self.logger.error(f"Failed to get key details: {str(e)}")
            return None, f"Failed to get key details: {str(e)}"

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

            if "duration" in data and data["duration"] is not None:
                duration = data["duration"]

                try:
                    if isinstance(duration, str):
                        duration = int(duration)
                    elif isinstance(duration, float):
                        duration = int(duration)
                    elif not isinstance(duration, int):
                        return None, "Duration must be a positive integer"
                except (ValueError, TypeError):
                    return None, "Duration must be a positive integer"
                
                if duration < 1:
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


            if not self._cache_service:
                raise ServiceError(
                    "Cache Service dependency not injected",
                    status_code=500
                )
            cache_service = self._cache_service

            if user_id:
                cache_service.invalidate_pattern(f"stats:user_id={user_id}:*")
            if project_id:
                cache_service.invalidate_pattern(f"stats:project_id={project_id}:*")

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