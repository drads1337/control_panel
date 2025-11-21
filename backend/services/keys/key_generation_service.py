"""
Key Generation Service
Handles key string generation and validation logic
"""

import secrets
import string
from typing import Optional, Union

from ...models.products import Product
from ...models.keys import Key
from ...models.agents import Agent
from ...utils.structured_logging import get_logger

class KeyGenerationService:
    """Service for generating key strings"""

    def __init__(self):
        self.logger = get_logger("key_generation_service")

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

        Args:
            length: Length of the key
            product: Product object for prefix generation
            agent: Agent object for prefix generation
            duration_hours: Duration in hours for prefix
            project_id: Project ID for uniqueness check

        Returns:
            Generated key string
        """
        random_length = max(8, length - 20)
        characters = string.ascii_letters + string.digits

        random_part = "".join(secrets.choice(characters) for _ in range(random_length))

        if product and product.login_type == "license_generation":
            prefix = self._generate_key_prefix(product, duration_hours, random_part)
        elif agent and agent.login_type == "license_generation":
            prefix = self._generate_key_prefix(agent, duration_hours, random_part)
        else:
            prefix = f"KEY-{random_part}"

        while True:
            if not Key.query.filter_by(key=prefix, project_id=project_id).first():
                return prefix
            random_part = "".join(secrets.choice(characters) for _ in range(random_length))
            if product and product.login_type == "license_generation":
                prefix = self._generate_key_prefix(product, duration_hours, random_part)
            elif agent and agent.login_type == "license_generation":
                prefix = self._generate_key_prefix(agent, duration_hours, random_part)
            else:
                prefix = f"KEY-{random_part}"

    def _generate_key_prefix(
        self, item: Union[Product, Agent], duration_hours: Optional[float], random_part: str
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

key_generation_service = KeyGenerationService()

