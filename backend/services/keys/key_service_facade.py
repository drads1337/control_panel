"""
Key Service Facade
Provides backward compatibility by delegating to specialized services.

This facade maintains the original KeyService interface while delegating
to the new specialized services. This allows gradual migration without
breaking existing code.
"""

from typing import Any, Dict, List, Optional, Tuple

from ...models.core import User
from ...models.keys import Key
from .key_bulk_operations_service import key_bulk_operations_service
from .key_crud_service import key_crud_service
from .key_export_service import key_export_service
from .key_statistics_service import key_statistics_service
from .key_status_service import key_status_service


class KeyServiceFacade:
    """
    Facade for KeyService that delegates to specialized services.
    
    This maintains backward compatibility with the original KeyService
    interface while using the new refactored services internally.
    """

    def __init__(self):
        # Delegate to specialized services
        self.crud_service = key_crud_service
        self.bulk_service = key_bulk_operations_service
        self.status_service = key_status_service
        self.export_service = key_export_service
        self.statistics_service = key_statistics_service

    # CRUD operations - delegate to KeyCRUDService
    def create_key(
        self, user: User, key_data: Dict[str, Any]
    ) -> Tuple[Optional[Key], Optional[str]]:
        """Create a single key"""
        return self.crud_service.create_key(user, key_data)

    def get_keys(self, user: User, filters: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], int]:
        """Get keys with filters and pagination"""
        return self.crud_service.get_keys(user, filters)

    def get_key_details(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get detailed information about a key"""
        return self.crud_service.get_key_details(user, key_id)

    def update_key(
        self, user: User, key_id: int, data: Dict[str, Any]
    ) -> Tuple[Optional[Key], Optional[str]]:
        """Update a key"""
        return self.crud_service.update_key(user, key_id, data)

    def delete_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Delete a key"""
        return self.crud_service.delete_key(user, key_id)

    def reset_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Reset a key (clear devices and activation info)"""
        return self.crud_service.reset_key(user, key_id)

    # Status operations - delegate to KeyStatusService
    def pause_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Pause a key (set status to 0 - inactive)"""
        return self.status_service.pause_key(user, key_id)

    def resume_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Resume a key (set status to 1)"""
        return self.status_service.resume_key(user, key_id)

    def block_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Block a key (set status to 2)"""
        return self.status_service.block_key(user, key_id)

    def unblock_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Unblock a key (set status to 1)"""
        return self.status_service.unblock_key(user, key_id)

    def archive_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Archive a key (set status to 4)"""
        return self.status_service.archive_key(user, key_id)

    def restore_key(self, user: User, key_id: int) -> Tuple[bool, Optional[str]]:
        """Restore an archived key (set status to 1)"""
        return self.status_service.restore_key(user, key_id)

    def extend_key(
        self, user: User, key_id: int, hours: float
    ) -> Tuple[bool, Optional[str]]:
        """Extend a key's expiration time"""
        return self.status_service.extend_key(user, key_id, hours)

    # Bulk operations - delegate to KeyBulkOperationsService
    def create_keys_bulk(
        self, user: User, keys_data: List[Dict[str, Any]]
    ) -> Tuple[int, List[str]]:
        """Create multiple keys in bulk"""
        return self.bulk_service.create_keys_bulk(user, keys_data)

    def bulk_create_keys(
        self,
        user: User,
        count: int,
        product_id: int,
        duration_hours: float,
        max_devices: int,
    ) -> Tuple[int, Optional[str], Optional[List[Key]]]:
        """Bulk create keys synchronously"""
        return self.bulk_service.bulk_create_keys(
            user, count, product_id, duration_hours, max_devices
        )

    def bulk_pause_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Pause multiple keys"""
        return self.bulk_service.bulk_pause_keys(user, key_ids)

    def bulk_resume_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Resume multiple keys"""
        return self.bulk_service.bulk_resume_keys(user, key_ids)

    def bulk_delete_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Delete multiple keys"""
        return self.bulk_service.bulk_delete_keys(user, key_ids)

    def bulk_reset_keys(self, user: User, key_ids: List[int]) -> Tuple[int, Optional[str]]:
        """Reset multiple keys"""
        return self.bulk_service.bulk_reset_keys(user, key_ids)

    def bulk_extend_keys(
        self, user: User, key_ids: List[int], hours: float
    ) -> Tuple[int, Optional[str]]:
        """Extend multiple keys"""
        return self.bulk_service.bulk_extend_keys(user, key_ids, hours)

    def bulk_delete_keys_by_filters(
        self, user: User, filters: Dict[str, Any]
    ) -> Tuple[int, Optional[str]]:
        """Delete keys by filters"""
        return self.bulk_service.bulk_delete_keys_by_filters(user, filters)

    def bulk_reset_keys_by_filters(
        self, user: User, filters: Dict[str, Any]
    ) -> Tuple[int, Optional[str]]:
        """Reset keys by filters"""
        return self.bulk_service.bulk_reset_keys_by_filters(user, filters)

    def bulk_extend_keys_by_filters(
        self, user: User, filters: Dict[str, Any], hours: float
    ) -> Tuple[int, Optional[str]]:
        """Extend keys by filters"""
        return self.bulk_service.bulk_extend_keys_by_filters(user, filters, hours)

    def bulk_pause_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk pause keys by product"""
        return self.bulk_service.bulk_pause_keys_by_product(user, product_id)

    def bulk_resume_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk resume keys by product"""
        return self.bulk_service.bulk_resume_keys_by_product(user, product_id)

    def bulk_reset_keys_by_product(
        self, user: User, product_id: int
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk reset keys by product"""
        return self.bulk_service.bulk_reset_keys_by_product(user, product_id)

    def bulk_add_hours_by_product(
        self, user: User, product_id: int, hours: float
    ) -> Tuple[int, Optional[str], Optional[str]]:
        """Bulk add hours to keys by product"""
        return self.bulk_service.bulk_add_hours_by_product(user, product_id, hours)

    def bulk_delete_unused_loader_keys(
        self, user: User, agent_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete unused agent keys"""
        return self.bulk_service.bulk_delete_unused_loader_keys(user, agent_id)

    def bulk_delete_expired_loader_keys(
        self, user: User, agent_id: int
    ) -> Tuple[int, Optional[str]]:
        """Delete expired agent keys"""
        return self.bulk_service.bulk_delete_expired_loader_keys(user, agent_id)

    # Export operations - delegate to KeyExportService
    def export_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Export a single key"""
        return self.export_service.export_key(user, key_id)

    def download_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Get key data for download (with security checks)"""
        return self.export_service.download_key(user, key_id)

    def reveal_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Reveal full license key (with security checks)"""
        return self.export_service.reveal_key(user, key_id)

    # Statistics - delegate to KeyStatisticsService
    def get_key_stats(self, user: User) -> Dict[str, Any]:
        """Get key statistics for user's project"""
        return self.statistics_service.get_key_stats(user)

    # Additional methods that may be needed for compatibility
    def duplicate_key(
        self, user: User, key_id: int
    ) -> Tuple[Optional[Key], Optional[str]]:
        """
        Duplicate a key
        Note: This method is kept in facade as it combines CRUD operations
        """
        try:
            key_details, error = self.crud_service.get_key_details(user, key_id)
            if error or not key_details:
                return None, error or "Key not found"

            key_data = key_details.get("key", {})
            if not key_data:
                return None, "Key data not found"

            # Create new key with same data
            new_key_data = {
                "product_id": key_data.get("product_id"),
                "duration_hours": key_data.get("duration_hours"),
                "max_devices": key_data.get("max_devices"),
                "key_metadata": key_data.get("key_metadata"),
            }

            return self.crud_service.create_key(user, new_key_data)

        except Exception as e:
            return None, f"Failed to duplicate key: {str(e)}"

    def move_key(
        self, user: User, key_id: int, new_user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Move a key to another user
        Note: This method is kept in facade as it combines CRUD operations
        """
        try:
            from ...core.extensions import db
            from ...models.core import User as UserModel

            key = self.crud_service.get_key_details(user, key_id)
            if not key or key[1]:
                return False, key[1] if key else "Key not found"

            new_user = UserModel.query.filter_by(
                id=new_user_id, project_id=user.project_id
            ).first()
            if not new_user:
                return False, "Target user not found"

            # Get actual key object
            from ...models.keys import Key as KeyModel
            key_obj = KeyModel.query.filter_by(id=key_id, project_id=user.project_id).first()
            if not key_obj:
                return False, "Key not found"

            key_obj.user_id = new_user_id
            db.session.commit()
            return True, None

        except Exception as e:
            from ...core.extensions import db
            db.session.rollback()
            return False, f"Failed to move key: {str(e)}"

    def generate_key_string(
        self,
        length: int = 32,
        product=None,
        agent=None,
        duration_hours: Optional[float] = None,
        project_id: Optional[int] = None,
    ) -> str:
        """
        Generate a cryptographically secure key string
        Delegates to KeyGenerationService
        """
        from ...services.key_generation_service import key_generation_service
        return key_generation_service.generate_key_string(
            length=length,
            product=product,
            agent=agent,
            duration_hours=duration_hours,
            project_id=project_id,
        )


# Create singleton instance for backward compatibility
key_service = KeyServiceFacade()

