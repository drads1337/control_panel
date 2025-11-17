"""
Key Generation Service
Handles key string generation and validation logic
"""

import secrets
import string
from typing import Optional, Union

from ..models.games import Game
from ..models.keys import Key
from ..models.loaders import Loader
from ..utils.structured_logging import get_logger


class KeyGenerationService:
    """Service for generating key strings"""

    def __init__(self):
        self.logger = get_logger("key_generation_service")

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

        Args:
            length: Length of the key
            game: Game object for prefix generation
            loader: Loader object for prefix generation
            duration_hours: Duration in hours for prefix
            project_id: Project ID for uniqueness check

        Returns:
            Generated key string
        """
        random_length = max(8, length - 20)
        characters = string.ascii_letters + string.digits

        # Use cryptographically secure random generator
        random_part = "".join(secrets.choice(characters) for _ in range(random_length))

        if game and game.login_type == "license_generation":
            prefix = self._generate_key_prefix(game, duration_hours, random_part)
        elif loader and loader.login_type == "license_generation":
            prefix = self._generate_key_prefix(loader, duration_hours, random_part)
        else:
            prefix = f"KEY-{random_part}"

        # Ensure uniqueness
        while True:
            if not Key.query.filter_by(key=prefix, project_id=project_id).first():
                return prefix
            random_part = "".join(secrets.choice(characters) for _ in range(random_length))
            if game and game.login_type == "license_generation":
                prefix = self._generate_key_prefix(game, duration_hours, random_part)
            elif loader and loader.login_type == "license_generation":
                prefix = self._generate_key_prefix(loader, duration_hours, random_part)
            else:
                prefix = f"KEY-{random_part}"

    def _generate_key_prefix(
        self, item: Union[Game, Loader], duration_hours: Optional[float], random_part: str
    ) -> str:
        """Generate key prefix based on item configuration"""
        name_to_use = item.custom_key_prefix if item.custom_key_prefix else item.name
        format_template = item.key_prefix_format or "{name}-{duration}-{custom}"

        if duration_hours:
            if duration_hours < 24:
                duration_str = f"{duration_hours}H"
            elif duration_hours < 168:
                duration_str = f"{duration_hours//24}D"
            elif duration_hours < 720:
                duration_str = f"{duration_hours//168}W"
            else:
                duration_str = f"{duration_hours//720}M"
        else:
            duration_str = "1H"

        prefix = format_template.replace("{name}", name_to_use)
        prefix = prefix.replace("{duration}", duration_str)
        prefix = prefix.replace("{custom}", random_part)

        return prefix


# Create service instance
key_generation_service = KeyGenerationService()

