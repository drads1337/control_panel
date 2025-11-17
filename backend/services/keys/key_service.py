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
from ...models.games import Game
from ...models.keys import DeviceInfo, Key, KeyAnalytics, TokenTransaction
from ...models.loaders import Loader
from ...services.key_generation_service import key_generation_service
from ...services.key_validation_service import key_validation_service
from ...services.rbac import rbac_service
from ...utils.data_masking import mask_license_key
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from ...utils.structured_logging import get_logger


class KeyService:
    """Service for handling key management operations"""

    def __init__(self):
        self.logger = get_logger("key_service")
        self.max_bulk_operations = 1000  # Limit for bulk operations to prevent DoS
        self.generation_service = key_generation_service
        self.validation_service = key_validation_service

    def generate_key_string(
        self,
        length: int = 32,
        game: Optional[Game] = None,
        loader: Optional[Loader] = None,
        duration_hours: Optional[float] = None,
        project_id: Optional[int] = None,
    ) -> str:
        """
        Generate a cryptographically secure key string
        Delegates to KeyGenerationService

        Args:
            length: Length of the key
            game: Game object for prefix generation
            loader: Loader object for prefix generation
            duration_hours: Duration in hours for prefix
            project_id: Project ID for uniqueness check

        Returns:
            Generated key string
        """
        return self.generation_service.generate_key_string(
            length=length,
            game=game,
            loader=loader,
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
                # Flush to get the ID and ensure it's in the database
                db.session.flush()
                key_id = key.id

                # Save key attributes before commit (in case object becomes detached)
                key_attrs = {
                    "id": key_id,
                    "key": key.key,
                    "game_id": key.game_id,
                    "loader_id": key.loader_id,
                    "expires_at": key.expires_at,
                    "max_devices": key.max_devices,
                    "duration_hours": key.duration_hours,
                    "created_at": key.created_at,
                    "status": key.status,
                    "project_id": key.project_id,
                    "user_id": key.user_id,
                    "key_metadata": key.key_metadata,
                }

                # Commit the transaction
                db.session.commit()

                # After commit, the key object may be expired but still in session
                # Try to refresh it in-place, or just return it and let caller handle it
                try:
                    # Try to refresh the key object to ensure it's up-to-date
                    # This will reload it from DB if needed
                    db.session.refresh(key)
                    self.logger.debug(f"Successfully refreshed key {key_id} after commit")
                    return key, None
                except Exception as refresh_error:
                    # Refresh failed - object may be detached
                    # Try to get it from session or query it
                    self.logger.debug(
                        f"Refresh failed for key {key_id}, trying session.get(): {str(refresh_error)}"
                    )
                    try:
                        # Use session.get() - it should find the key we just committed
                        reloaded_key = db.session.get(Key, key_id)
                        if reloaded_key:
                            self.logger.debug(f"Successfully got key {key_id} using session.get()")
                            return reloaded_key, None
                        else:
                            # Key exists but session can't find it - return the key object anyway
                            # The caller will need to reload it, but at least we have the ID
                            self.logger.warning(
                                f"session.get() returned None for key {key_id}, but key exists. Returning key object anyway."
                            )
                            # Return the key object - even if detached, caller can use the ID to reload
                            return key, None
                    except Exception as get_error:
                        # Everything failed - but key WAS created
                        self.logger.warning(
                            f"All reload attempts failed for key {key_id}, but key exists. Returning key object: {str(get_error)}"
                        )
                        # Return the key object anyway - it has the ID, caller can reload if needed
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
        # Validate key data using KeyValidationService
        is_valid, error_msg = self.validation_service.validate_key_data(user, key_data)
        if not is_valid:
            return None, error_msg

        # Get game/loader objects for key generation
        game = None
        loader = None

        if key_data.get("game_id"):
            game = Game.query.filter_by(id=key_data["game_id"], project_id=user.project_id).first()
            if not game:
                return None, "Game not found or access denied"

        if key_data.get("loader_id"):
            loader = Loader.query.filter_by(
                id=key_data["loader_id"], project_id=user.project_id
            ).first()
            if not loader:
                return None, "Loader not found or access denied"

        duration_hours = key_data.get("duration_hours", 24)
        max_devices = key_data.get("max_devices", 1)

        # Generate key string using KeyGenerationService
        key_string = self.generation_service.generate_key_string(
            length=key_data.get("length", 32),
            game=game,
            loader=loader,
            duration_hours=duration_hours,
            project_id=user.project_id,
        )

        # Calculate expiration
        expires_at = None
        if duration_hours:
            expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

        # Create key
        key = Key(
            key=key_string,
            user_id=user.id,
            game_id=key_data.get("game_id"),
            loader_id=key_data.get("loader_id"),
            expires_at=expires_at,
            max_devices=max_devices,
            duration_hours=duration_hours,
            status=1,
            project_id=user.project_id,
            key_metadata=key_data.get("key_metadata"),
        )

        db.session.add(key)
        # Flush to get the key ID without committing
        db.session.flush()
        
        # Update user key counters (key is active with status=1)
        from ...utils.key_counters import increment_user_key_counters
        increment_user_key_counters(user.id, is_active=True)

        # Trigger webhook for key creation (asynchronously to avoid blocking response)
        # Do this after transaction commit to ensure it doesn't block the response
        try:
            from .webhook_service import get_webhook_service

            webhook_service = get_webhook_service()

            # Prepare webhook data
            webhook_data = {
                "key_id": key.id,
                "key_value": key.key,
                "user_id": user.id,
                "username": user.username,
                "game_id": key.game_id,
                "game_name": game.name if game else None,
                "duration_hours": key.duration_hours,
                "max_devices": key.max_devices,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "created_at": key.created_at.isoformat(),
            }

            # Trigger webhook asynchronously (don't wait for it)
            # This prevents webhook delays from blocking the API response
            try:
                webhook_service.trigger_webhook("key.created", webhook_data, user.project_id)
                self.logger.info(f"Triggered webhook for key creation: {key.id}")
            except Exception as webhook_error:
                # Don't fail key creation if webhook fails
                self.logger.warning(f"Webhook trigger failed (non-critical): {str(webhook_error)}")

        except Exception as e:
            # Don't fail key creation if webhook system fails
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
        # Validate bulk operation count using KeyValidationService
        is_valid, error_msg = self.validation_service.validate_bulk_operation(
            len(keys_data), self.max_bulk_operations
        )
        if not is_valid:
            return 0, [error_msg]

        created_count = 0
        errors = []

        # Create keys one at a time, each in its own transaction
        # This ensures that failures don't affect other keys
        for i, key_data in enumerate(keys_data):
            try:
                # Create key in its own transaction
                key, error = self._create_key_individually(user, key_data)
                if key:
                    created_count += 1
                else:
                    errors.append(f"Key {i+1}: {error}")
            except Exception as e:
                # Ensure transaction is rolled back on exception
                try:
                    db.session.rollback()
                except Exception:
                    pass  # Already rolled back or connection lost
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

            # Build query with joinedload to avoid N+1 problem
            query = Key.query.options(joinedload(Key.game)).filter_by(project_id=user.project_id)

            # Check if filtering by my_keys only
            my_keys_only = filters.get("my_keys", False)

            # Filter by user_id based on permissions and my_keys filter
            # Owner/admin and users with keys.view permission can see all keys in project
            # Other users see only their own keys
            if not RBACManager.is_owner(user) and not RBACManager.is_admin(user):
                has_keys_view = rbac_service.check_permission(user.id, "keys.view")
                if not has_keys_view:
                    # User without view permission always sees only their own keys
                    query = query.filter_by(user_id=user.id)
                    self.logger.info(
                        f"🔒 Filtering keys by user_id={user.id} (user doesn't have keys.view permission)"
                    )
                elif my_keys_only:
                    # User with view permission but filtering for my keys only
                    query = query.filter_by(user_id=user.id)
                    self.logger.info(
                        f"🔒 Filtering keys by user_id={user.id} (my_keys filter enabled)"
                    )
                else:
                    self.logger.info(
                        f"👁️ User {user.id} has keys.view permission - showing all keys in project"
                    )
            elif my_keys_only:
                # Owner/admin filtering for their own keys
                query = query.filter_by(user_id=user.id)
                self.logger.info(
                    f"🔒 Filtering keys by user_id={user.id} (my_keys filter enabled for owner/admin)"
                )

            # Log initial query count
            initial_count = query.count()
            self.logger.info(f"📊 Initial query count (all keys in project): {initial_count}")

            # Apply filters
            query = self._apply_filters(query, filters)

            # Log filtered query count
            filtered_count = query.count()
            self.logger.info(f"🔧 Filtered query count: {filtered_count}")

            # Get pagination info
            page = filters.get("page", 1)
            per_page = min(filters.get("per_page", 20), 100)  # Max 100 per page

            # Get total count before pagination
            total_count = query.count()
            self.logger.info(f"📄 Total count for pagination: {total_count}")

            # Apply pagination
            pagination = query.order_by(Key.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            self.logger.info(
                f"📋 Pagination: page={page}, per_page={per_page}, items={len(pagination.items)}"
            )

            # Build response
            keys = []
            for key in pagination.items:
                # No additional DB query needed due to joinedload
                game_name = key.game.name if key.game else None

                is_expired = key.expires_at and key.expires_at <= datetime.utcnow()
                is_active = key.status == 1 and (not key.expires_at or not is_expired)

                self.logger.info(
                    f"🔑 Key {key.id}: status={key.status}, expires_at={key.expires_at}, is_active={is_active}, game_name={game_name}"
                )

                # Calculate device_count from devices string
                # Devices can be stored as:
                # 1. Comma-separated string: "serial1,serial2,serial3"
                # 2. JSON array: '["serial1","serial2"]'
                device_count = 0
                if key.devices:
                    try:
                        # Try parsing as JSON first
                        devices_list = (
                            json.loads(key.devices) if isinstance(key.devices, str) else key.devices
                        )
                        if isinstance(devices_list, list):
                            device_count = len(devices_list)
                        else:
                            # Fallback: treat as comma-separated string
                            devices_list = [d.strip() for d in key.devices.split(",") if d.strip()]
                            device_count = len(devices_list)
                    except (json.JSONDecodeError, AttributeError):
                        # Not JSON, treat as comma-separated string
                        devices_list = [d.strip() for d in key.devices.split(",") if d.strip()]
                        device_count = len(devices_list)

                # SECURITY: Mask keys in list endpoints - full keys only in /details or during creation
                # This prevents mass data leakage if list endpoint is compromised
                keys.append(
                    {
                        "id": key.id,
                        "key": mask_license_key(key.key),  # Masked key - full key only in /details
                        "user_id": key.user_id,
                        "game_id": key.game_id,
                        "game_name": game_name,
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
        """Apply filters to query"""
        self.logger.info(f"🔧 Applying filters: {filters}")

        # Game/Loader filters
        if filters.get("game_id"):
            self.logger.info(f"🎮 Filtering by game_id: {filters['game_id']}")
            query = query.filter_by(game_id=filters["game_id"])
        elif filters.get("loader_id") and filters.get("game_ids"):
            self.logger.info(
                f"📦 Filtering by loader_id: {filters['loader_id']}, game_ids: {filters['game_ids']}"
            )
            query = query.filter(Key.game_id.in_(filters["game_ids"]))

        # Status filters
        if filters.get("status") and filters["status"] != "all":
            status = filters["status"]
            self.logger.info(f"📊 Filtering by status: {status}")
            if status == "active":
                # Active keys: status=1 AND (no expiration OR not expired)
                self.logger.info(
                    "✅ Applying active status filter: status=1 AND (expires_at IS NULL OR expires_at > now)"
                )
                query = query.filter(
                    Key.status == 1,
                    or_(Key.expires_at.is_(None), Key.expires_at > datetime.utcnow()),
                )
            elif status == "expired":
                self.logger.info("⏰ Applying expired status filter: expires_at <= now")
                query = query.filter(Key.expires_at <= datetime.utcnow())
            elif status == "inactive":
                self.logger.info("❌ Applying inactive status filter: status=0")
                query = query.filter(Key.status == 0)
            else:
                self.logger.info(f"🔢 Applying numeric status filter: status={int(status)}")
                query = query.filter_by(status=int(status))
        else:
            self.logger.info("📊 No status filter applied (status='all' or not provided)")

        # Activation status filters
        if filters.get("activation_status") and filters["activation_status"] != "all":
            if filters["activation_status"] == "activated":
                query = query.filter(Key.activated_at.isnot(None))
            elif filters["activation_status"] == "not_activated":
                query = query.filter(Key.activated_at.is_(None))

        # Date filters
        if filters.get("date_from"):
            date_from = datetime.fromisoformat(filters["date_from"].replace("Z", "+00:00"))
            query = query.filter(Key.created_at >= date_from)

        if filters.get("date_to"):
            date_to = datetime.fromisoformat(filters["date_to"].replace("Z", "+00:00"))
            query = query.filter(Key.created_at <= date_to)

        # Device usage filters
        if filters.get("device_usage") and filters["device_usage"] != "all":
            if filters["device_usage"] == "used":
                query = query.filter(Key.devices != "")
            elif filters["device_usage"] == "unused":
                query = query.filter(or_(Key.devices == "", Key.devices.is_(None)))

        # Max devices filters
        if filters.get("max_devices") and filters["max_devices"] != "all":
            if filters["max_devices"] == "single":
                query = query.filter(Key.max_devices == 1)
            elif filters["max_devices"] == "multiple":
                query = query.filter(Key.max_devices > 1)

        # Search filter - using PostgreSQL tsvector for efficient full-text search
        if filters.get("search"):
            query = fulltext_search_filter(query, filters["search"], "search_vector")

        return query

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
                    # Update user key counters
                    from ...utils.key_counters import update_user_key_counters_on_status_change
                    update_user_key_counters_on_status_change(key.user_id, old_status, 0)
                    affected_count += 1
                elif action == "resume":
                    old_status = key.status
                    key.status = 1
                    # Update user key counters
                    from ...utils.key_counters import update_user_key_counters_on_status_change
                    update_user_key_counters_on_status_change(key.user_id, old_status, 1)
                    affected_count += 1
                elif action == "delete":
                    # Store key info before deletion for counter update
                    user_id = key.user_id
                    was_active = key.status == 1
                    
                    db.session.delete(key)
                    
                    # Update user key counters
                    from ...utils.key_counters import decrement_user_key_counters
                    decrement_user_key_counters(user_id, was_active=was_active)
                    
                    affected_count += 1
                elif action == "reset":
                    key.devices = ""
                    key.activated_at = None
                    key.fingerprint = None
                    # Delete associated device info
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
        game_id: int,
        duration_hours: float,
        max_devices: int,
    ) -> Tuple[int, Optional[str], Optional[List[Key]]]:
        """
        Bulk create keys synchronously

        Args:
            user: User creating the keys
            count: Number of keys to create
            game_id: ID of the game
            duration_hours: Duration in hours
            max_devices: Maximum devices per key

        Returns:
            Tuple of (created_count, error_message, list of created keys)
        """
        try:
            # Validate game access
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                return 0, "Game not found or access denied", None

            # Determine generation type based on game's login_type
            is_access_code = game.login_type == "classic_login"
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
                        length=32, game=game, duration_hours=duration_hours, project_id=user.project_id
                    )

                    # Get user role for metadata
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
                        game_id=game_id,
                        expires_at=expires_at,
                        max_devices=max_devices,
                        duration_hours=duration_hours,
                        status=1,
                        project_id=user.project_id,
                        key_metadata=json.dumps(key_metadata),
                    )

                    db.session.add(key)
                    db.session.flush()

                    # Update user key counters (key is active with status=1)
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

            # Limit bulk operations
            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            # Collect affected user IDs for counter recalculation
            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                db.session.delete(key)

            db.session.commit()
            
            # Recalculate key counters for affected users
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

            # Limit bulk operations
            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to reset. Maximum: {self.max_bulk_operations}"

            key_ids = [key.id for key in keys]

            for key in keys:
                key.devices = ""
                key.activated_at = None
                key.fingerprint = None

            # Delete associated device info
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

            # Limit bulk operations
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

    def bulk_pause_keys_by_game(
        self, user: User, game_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk pause keys by game
        
        Args:
            user: User performing the operation
            game_id: Game ID
            
        Returns:
            Tuple of (affected_count, error_message, game_name)
        """
        try:
            # Validate game access
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                return 0, "Game not found or access denied", None

            keys = Key.query.filter_by(game_id=game_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, game.name

            # Collect affected user IDs for counter recalculation
            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                key.status = 0

            db.session.commit()
            
            # Recalculate key counters for affected users
            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk paused {len(keys)} keys for game {game_id} by user {user.id}")
            return len(keys), None, game.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk pause keys by game: {str(e)}")
            return 0, f"Failed to pause keys: {str(e)}", None

    def bulk_resume_keys_by_game(
        self, user: User, game_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk resume keys by game
        
        Args:
            user: User performing the operation
            game_id: Game ID
            
        Returns:
            Tuple of (affected_count, error_message, game_name)
        """
        try:
            # Validate game access
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                return 0, "Game not found or access denied", None

            keys = Key.query.filter_by(game_id=game_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, game.name

            # Collect affected user IDs for counter recalculation
            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                key.status = 1

            db.session.commit()
            
            # Recalculate key counters for affected users
            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()

            self.logger.info(f"Bulk resumed {len(keys)} keys for game {game_id} by user {user.id}")
            return len(keys), None, game.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk resume keys by game: {str(e)}")
            return 0, f"Failed to resume keys: {str(e)}", None

    def bulk_reset_keys_by_game(
        self, user: User, game_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk reset keys by game
        
        Args:
            user: User performing the operation
            game_id: Game ID
            
        Returns:
            Tuple of (affected_count, error_message, game_name)
        """
        try:
            # Validate game access
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                return 0, "Game not found or access denied", None

            keys = Key.query.filter_by(game_id=game_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, game.name

            key_ids = [key.id for key in keys]

            for key in keys:
                key.devices = ""
                key.fingerprint = None
                key.activated_at = None

            # Delete associated device info
            DeviceInfo.query.filter(DeviceInfo.key_id.in_(key_ids)).delete()

            db.session.commit()

            self.logger.info(f"Bulk reset {len(keys)} keys for game {game_id} by user {user.id}")
            return len(keys), None, game.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk reset keys by game: {str(e)}")
            return 0, f"Failed to reset keys: {str(e)}", None

    def bulk_add_hours_by_game(
        self, user: User, game_id: int, hours: float
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """
        Bulk add hours to keys by game
        
        Args:
            user: User performing the operation
            game_id: Game ID
            hours: Hours to add
            
        Returns:
            Tuple of (affected_count, error_message, game_name)
        """
        try:
            # Validate game access
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()
            if not game:
                return 0, "Game not found or access denied", None

            keys = Key.query.filter_by(game_id=game_id, project_id=user.project_id).all()

            if not keys:
                return 0, None, game.name

            for key in keys:
                if key.expires_at:
                    key.expires_at += timedelta(hours=hours)
                else:
                    key.expires_at = datetime.utcnow() + timedelta(hours=hours)

            db.session.commit()

            self.logger.info(
                f"Bulk added {hours} hours to {len(keys)} keys for game {game_id} by user {user.id}"
            )
            return len(keys), None, game.name

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk add hours by game: {str(e)}")
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

            # Get keys by game
            keys_by_game = (
                db.session.query(Game.name, func.count(Key.id).label("count"))
                .join(Key, Game.id == Key.game_id)
                .filter(Key.project_id == user.project_id)
                .group_by(Game.id, Game.name)
                .all()
            )

            return {
                "total_keys": total_keys,
                "active_keys": active_keys,
                "expired_keys": expired_keys,
                "inactive_keys": inactive_keys,
                "keys_by_game": [
                    {"game_name": name, "count": count} for name, count in keys_by_game
                ],
            }

        except Exception as e:
            self.logger.error(f"Failed to get key stats: {str(e)}")
            return {
                "total_keys": 0,
                "active_keys": 0,
                "expired_keys": 0,
                "inactive_keys": 0,
                "keys_by_game": [],
            }

    def bulk_delete_unused_loader_keys(
        self, user: User, loader_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete unused loader keys"""
        try:
            keys = Key.query.filter(
                Key.loader_id == loader_id,
                Key.project_id == user.project_id,
                or_(Key.devices == "", Key.devices.is_(None)),
            ).all()

            if not keys:
                return 0, "No unused loader keys found"

            # Limit bulk operations
            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            # Collect affected user IDs for counter recalculation
            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                db.session.delete(key)

            db.session.commit()
            
            # Recalculate key counters for affected users
            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()
            
            self.logger.info(f"Bulk deleted {len(keys)} unused loader keys for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk delete unused loader keys: {str(e)}")
            return 0, f"Failed to bulk delete unused loader keys: {str(e)}"

    def bulk_delete_expired_loader_keys(
        self, user: User, loader_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete expired loader keys"""
        try:
            keys = Key.query.filter(
                Key.loader_id == loader_id,
                Key.project_id == user.project_id,
                Key.expires_at <= datetime.utcnow(),
            ).all()

            if not keys:
                return 0, "No expired loader keys found"

            # Limit bulk operations
            if len(keys) > self.max_bulk_operations:
                return 0, f"Too many keys to delete. Maximum: {self.max_bulk_operations}"

            # Collect affected user IDs for counter recalculation
            affected_user_ids = set()
            for key in keys:
                if key.user_id:
                    affected_user_ids.add(key.user_id)
                db.session.delete(key)

            db.session.commit()
            
            # Recalculate key counters for affected users
            from ...utils.key_counters import update_user_key_counters
            for user_id in affected_user_ids:
                update_user_key_counters(user_id, project_id=user.project_id)
            db.session.commit()
            
            self.logger.info(f"Bulk deleted {len(keys)} expired loader keys for user {user.id}")
            return len(keys), None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to bulk delete expired loader keys: {str(e)}")
            return 0, f"Failed to bulk delete expired loader keys: {str(e)}"

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

            # Store key info before deletion for counter update
            user_id = key.user_id
            project_id = key.project_id
            was_active = key.status == 1

            db.session.delete(key)

            # Update user key counters
            from ...utils.key_counters import decrement_user_key_counters
            decrement_user_key_counters(user_id, was_active=was_active)

            # Update project key counters
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
            key.status = 0  # INACTIVE/PAUSED status (consistent with bulk_pause_keys)

            # Update user key counters
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 0)

            # Update project key counters
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
            key.status = 1  # ACTIVE status

            # Update user key counters
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)

            # Update project key counters
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
            key.status = 2  # BLOCKED status

            # Update user key counters
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 2)

            # Update project key counters
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
            key.status = 1  # ACTIVE status

            # Update user key counters
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)

            # Update project key counters
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
            key.status = 4  # ARCHIVED status

            # Update user key counters
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 4)

            # Update project key counters
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
            key.status = 1  # ACTIVE status

            # Update user key counters
            from ...utils.key_counters import update_user_key_counters_on_status_change
            update_user_key_counters_on_status_change(key.user_id, old_status, 1)

            # Update project key counters
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

            game = Game.query.get(key.game_id) if key.game_id else None
            if not game:
                return None, "Game not found"

            # Generate new key string
            new_key_string = self.generate_key_string(
                length=32, game=game, duration_hours=key.duration_hours, project_id=user.project_id
            )

            # Create duplicate key
            duplicate_key = Key(
                key=new_key_string,
                user_id=key.user_id,
                game_id=key.game_id,
                expires_at=key.expires_at,
                max_devices=key.max_devices,
                duration_hours=key.duration_hours,
                status=key.status,
                project_id=key.project_id,
                key_metadata=key.key_metadata,
            )

            db.session.add(duplicate_key)
            db.session.flush()

            # Update user key counters (if key is active)
            if duplicate_key.status == 1:
                from ...utils.key_counters import increment_user_key_counters
                increment_user_key_counters(duplicate_key.user_id, is_active=True)

                # Update project key counters
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

            game = (
                Game.query.filter_by(id=key.game_id, project_id=user.project_id).first()
                if key.game_id
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

            # SECURITY: Check if user can view full key
            can_view_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            # Regular users need keys.view permission
            if not can_view_full_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_view_full_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_view_full_key = rbac_service.check_permission(user.id, "keys.view")

            # Mask key if user doesn't have permission to view full key
            key_value = key.key if can_view_full_key else mask_license_key(key.key)

            key_data = {
                "id": key.id,
                "key": key_value,
                "key_masked": not can_view_full_key,
                "game_id": key.game_id,
                "game_name": game.name if game else None,
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

            game = (
                Game.query.filter_by(id=key.game_id, project_id=user.project_id).first()
                if key.game_id
                else None
            )

            export_data = {
                "key_id": key.id,
                "key": key.key,
                "game_id": key.game_id,
                "game_name": game.name if game else None,
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

            # SECURITY: Check if user can download full key
            can_download_full_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            # Regular users need keys.view permission
            if not can_download_full_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_download_full_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_download_full_key = rbac_service.check_permission(user.id, "keys.view")

            # Mask key if user doesn't have permission
            key_value = key.key if can_download_full_key else mask_license_key(key.key)

            game = (
                Game.query.filter_by(id=key.game_id, project_id=user.project_id).first()
                if key.game_id
                else None
            )

            export_data = {
                "key_id": key.id,
                "key": key_value,
                "key_masked": not can_download_full_key,
                "game_id": key.game_id,
                "game_name": game.name if game else None,
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

            # SECURITY: Check if user can reveal full key
            can_reveal_key = RBACManager.is_owner(user) or RBACManager.is_admin(user)

            # Regular users need keys.view permission
            if not can_reveal_key:
                is_own_key = key.user_id == user.id
                if is_own_key:
                    can_reveal_key = rbac_service.check_permission(user.id, "keys.view")
                else:
                    can_reveal_key = rbac_service.check_permission(user.id, "keys.view")

            if not can_reveal_key:
                # Log unauthorized attempt
                self.logger.warning(
                    f"🚫 Unauthorized key reveal attempt: user_id={user.id}, key_id={key_id}, "
                    f"key_owner={key.user_id}, has_keys_view={rbac_service.check_permission(user.id, 'keys.view')}"
                )
                return {
                    "key": mask_license_key(key.key),
                    "key_masked": True,
                    "error": "Insufficient permissions to reveal key"
                }, "Insufficient permissions to reveal key"

            # Log successful reveal for audit purposes
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


# Create service instance
key_service = KeyService()
