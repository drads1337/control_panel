"""
Key Validation Service
Handles key validation logic
"""

from typing import Any, Dict, Optional, Tuple

from ..models.core import User
from ..models.games import Game
from ..models.keys import Key
from ..models.loaders import Loader
from ..utils.structured_logging import get_logger


class KeyValidationService:
    """Service for validating key data and operations"""

    def __init__(self):
        self.logger = get_logger("key_validation_service")

    def validate_key_data(
        self, user: User, key_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate key creation data

        Args:
            user: User creating the key
            key_data: Key data dictionary

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate required fields
        if not key_data.get("game_id") and not key_data.get("loader_id"):
            return False, "Either game_id or loader_id is required"

        # Validate game/loader access
        game = None
        loader = None

        if key_data.get("game_id"):
            game = Game.query.filter_by(
                id=key_data["game_id"], project_id=user.project_id
            ).first()
            if not game:
                return False, "Game not found or access denied"

        if key_data.get("loader_id"):
            loader = Loader.query.filter_by(
                id=key_data["loader_id"], project_id=user.project_id
            ).first()
            if not loader:
                return False, "Loader not found or access denied"

        # Validate duration
        duration_hours = key_data.get("duration_hours", 24)
        if duration_hours <= 0 or duration_hours > 8760:  # Max 1 year
            return False, "Invalid duration_hours"

        # Validate max_devices
        max_devices = key_data.get("max_devices", 1)
        if max_devices <= 0 or max_devices > 1000:
            return False, "Invalid max_devices"

        return True, None

    def validate_bulk_operation(self, count: int, max_count: int = 1000) -> Tuple[bool, Optional[str]]:
        """
        Validate bulk operation count

        Args:
            count: Number of items in bulk operation
            max_count: Maximum allowed count

        Returns:
            Tuple of (is_valid, error_message)
        """
        if count > max_count:
            return False, f"Too many items in one request. Maximum: {max_count}"
        if count <= 0:
            return False, "Count must be greater than 0"
        return True, None


# Create service instance
key_validation_service = KeyValidationService()

