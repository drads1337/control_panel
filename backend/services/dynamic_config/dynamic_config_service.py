"""
Dynamic Configuration Service
Manages dynamic configuration loading for clients
Turns loaders into "thin clients" that require server connection
"""

import base64
import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import redis
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from flask import current_app

from ...core.extensions import db
from ...models.core import Project, User
from ...models.games import Game
from ...models.keys import Key

class DynamicConfigService:
    """Service for managing dynamic configuration for clients"""

    def __init__(self):
        self.config_ttl = 3600
        self.encryption_key = self._get_encryption_key()
        self.redis_client = self._init_redis()

        self.config_templates = {
            "fps": {
                "memory_addresses": {
                    "player_health": "0x12345678",
                    "player_armor": "0x12345679",
                    "player_ammo": "0x1234567A",
                    "enemy_positions": "0x1234567B",
                },
                "decryption_keys": {
                    "main_key": "0xABCDEF1234567890",
                    "secondary_key": "0x9876543210FEDCBA",
                },
                "feature_flags": {
                    "aimbot_enabled": True,
                    "esp_enabled": True,
                    "wallhack_enabled": False,
                    "speedhack_enabled": False,
                },
                "limits": {
                    "max_aimbot_fov": 90,
                    "max_aimbot_smooth": 10,
                    "max_speed_multiplier": 2.0,
                },
            },
            "mmo": {
                "memory_addresses": {
                    "player_level": "0x23456789",
                    "player_gold": "0x2345678A",
                    "player_inventory": "0x2345678B",
                    "npc_data": "0x2345678C",
                },
                "decryption_keys": {
                    "inventory_key": "0xBCDEF12345678901",
                    "character_key": "0x876543210FEDCBA9",
                },
                "feature_flags": {
                    "auto_loot_enabled": True,
                    "auto_quest_enabled": True,
                    "teleport_enabled": False,
                    "god_mode_enabled": False,
                },
                "limits": {
                    "max_teleport_distance": 1000,
                    "max_loot_speed": 5.0,
                    "max_quest_speed": 3.0,
                },
            },
            "moba": {
                "memory_addresses": {
                    "champion_health": "0x34567890",
                    "champion_mana": "0x34567891",
                    "minion_positions": "0x34567892",
                    "tower_health": "0x34567893",
                },
                "decryption_keys": {
                    "champion_key": "0xCDEF123456789012",
                    "minion_key": "0x76543210FEDCBA98",
                },
                "feature_flags": {
                    "skill_shot_aim": True,
                    "auto_last_hit": True,
                    "auto_skill_usage": False,
                    "map_hack_enabled": False,
                },
                "limits": {
                    "max_skill_shot_accuracy": 95,
                    "max_last_hit_speed": 2.0,
                    "max_skill_delay": 100,
                },
            },
        }

    def _init_redis(self):
        """Initialize Redis client for configuration storage"""
        try:
            from ...config.config import Config

            redis_config = {
                "host": Config.REDIS_HOST,
                "port": Config.REDIS_PORT,
                "db": Config.REDIS_DB,
                "decode_responses": True,
                "socket_connect_timeout": 5,
                "socket_timeout": 5,
                "retry_on_timeout": True,
                "health_check_interval": 30,
                "max_connections": 20,
            }

            if Config.REDIS_PASSWORD:
                redis_config["password"] = Config.REDIS_PASSWORD

            client = redis.Redis(**redis_config)
            client.ping()
            return client
        except Exception as e:
            logging.error(f"Dynamic Config Redis initialization failed: {e}")
            raise RuntimeError("Redis is required for dynamic config service")

    def _get_encryption_key(self) -> bytes:
        """Get encryption key for configuration data (32 bytes for AES-256)"""
        try:
            from ...config.config import Config

            key_source = f"{Config.MASTER_KEY}_dynamic_config_salt"
            return hashlib.sha256(key_source.encode()).digest()
        except Exception:

            return hashlib.sha256(
                "default_dynamic_config_key".encode()
            ).digest()

    def _encrypt_config(self, config_data: Dict) -> str:
        """Encrypt configuration data using AES-256-GCM"""
        try:

            json_data = json.dumps(config_data, sort_keys=True)

            iv = os.urandom(12)

            cipher = Cipher(
                algorithms.AES(self.encryption_key), modes.GCM(iv), backend=default_backend()
            )
            encryptor = cipher.encryptor()

            encrypted_data = encryptor.update(json_data.encode("utf-8")) + encryptor.finalize()

            tag = encryptor.tag

            combined = iv + encrypted_data + tag

            return base64.b64encode(combined).decode("utf-8")

        except Exception as e:
            logging.error(f"Config encryption error: {e}")
            raise ValueError(f"Failed to encrypt configuration: {str(e)}")

    def _decrypt_config(self, encrypted_config: str) -> Dict:
        """Decrypt configuration data using AES-256-GCM"""
        try:

            combined = base64.b64decode(encrypted_config.encode("utf-8"))

            if len(combined) < 28:
                raise ValueError(f"Encrypted config too short: {len(combined)} bytes (minimum 28)")

            iv = combined[:12]
            tag = combined[-16:]
            encrypted_data = combined[12:-16]

            cipher = Cipher(
                algorithms.AES(self.encryption_key), modes.GCM(iv, tag), backend=default_backend()
            )
            decryptor = cipher.decryptor()

            decrypted_data = decryptor.update(encrypted_data) + decryptor.finalize()

            return json.loads(decrypted_data.decode("utf-8"))

        except Exception as e:
            logging.error(f"Config decryption error: {e}")
            raise ValueError(f"Failed to decrypt configuration: {str(e)}")

    def generate_dynamic_config(self, user_key: str, game_name: str, project_id: int) -> Dict:
        """Generate dynamic configuration for a specific user and game"""
        try:

            game = Game.query.filter_by(name=game_name, project_id=project_id).first()
            if not game:
                raise ValueError(f"Game {game_name} not found in project {project_id}")

            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            key_obj = Key.query.filter_by(key=user_key, project_id=project_id).first()
            if not key_obj:
                raise ValueError(f"Key {user_key} not found in project {project_id}")

            game_type = self._determine_game_type(game_name, game)

            base_config = self.config_templates.get(game_type, self.config_templates["fps"])

            dynamic_config = self._customize_config(base_config, user_key, game, project, key_obj)

            dynamic_config["metadata"] = {
                "user_key": user_key,
                "game_name": game_name,
                "project_id": project_id,
                "game_type": game_type,
                "generated_at": int(time.time()),
                "expires_at": int(time.time()) + self.config_ttl,
                "version": "1.0.0",
                "checksum": self._calculate_checksum(dynamic_config),
            }

            encrypted_config = self._encrypt_config(dynamic_config)

            config_key = f"dynamic_config:{user_key}:{game_name}:{project_id}"
            self.redis_client.setex(config_key, self.config_ttl, encrypted_config)

            logging.info(
                f"DYNAMIC_CONFIG_GENERATED user_key={user_key} game={game_name} project_id={project_id} game_type={game_type}"
            )

            return {
                "config": encrypted_config,
                "metadata": dynamic_config["metadata"],
                "config_size": len(encrypted_config),
            }

        except Exception as e:
            logging.error(
                f"DYNAMIC_CONFIG_GENERATION_ERROR user_key={user_key} game={game_name} error={e}"
            )
            raise ValueError(f"Failed to generate dynamic configuration: {str(e)}")

    def validate_config_request(
        self, user_key: str, game_name: str, project_id: int, config_checksum: str
    ) -> bool:
        """Validate a configuration request from client"""
        try:

            config_key = f"dynamic_config:{user_key}:{game_name}:{project_id}"
            stored_config = self.redis_client.get(config_key)

            if not stored_config:
                return False

            config_data = self._decrypt_config(stored_config)

            if config_data.get("metadata", {}).get("checksum") != config_checksum:
                return False

            expires_at = config_data.get("metadata", {}).get("expires_at", 0)
            if time.time() > expires_at:
                return False

            key_obj = Key.query.filter_by(key=user_key, project_id=project_id).first()
            if not key_obj or key_obj.status != 1:
                return False

            game = Game.query.filter_by(name=game_name, project_id=project_id).first()
            if not game or game.status != "active":
                return False

            return True

        except Exception as e:
            logging.error(f"DYNAMIC_CONFIG_VALIDATION_ERROR user_key={user_key} error={e}")
            return False

    def get_config_statistics(self) -> Dict:
        """Get dynamic configuration statistics"""
        try:
            config_keys = self.redis_client.keys("dynamic_config:*")
            total_configs = len(config_keys)
            active_configs = 0
            expired_configs = 0

            current_time = int(time.time())

            for config_key in config_keys:
                try:
                    stored_config = self.redis_client.get(config_key)
                    if stored_config:
                        config_data = self._decrypt_config(stored_config)
                        expires_at = config_data.get("metadata", {}).get("expires_at", 0)

                        if current_time < expires_at:
                            active_configs += 1
                        else:
                            expired_configs += 1

                except Exception as e:
                    logging.error(f"DYNAMIC_CONFIG_STATS_ERROR config_key={config_key} error={e}")
                    continue

            return {
                "total_configs": total_configs,
                "active_configs": active_configs,
                "expired_configs": expired_configs,
                "config_ttl": self.config_ttl,
                "supported_game_types": list(self.config_templates.keys()),
            }

        except Exception as e:
            logging.error(f"DYNAMIC_CONFIG_STATISTICS_ERROR: {e}")
            return {}

    def _determine_game_type(self, game_name: str, game: Game) -> str:
        """Determine game type based on game name and properties"""
        game_name_lower = game_name.lower()

        fps_keywords = ["fps", "shooter", "counter", "cs", "valorant", "apex", "fortnite"]
        if any(keyword in game_name_lower for keyword in fps_keywords):
            return "fps"

        mmo_keywords = ["mmo", "rpg", "world", "warcraft", "final fantasy", "guild wars"]
        if any(keyword in game_name_lower for keyword in mmo_keywords):
            return "mmo"

        moba_keywords = ["moba", "league", "dota", "heroes", "battle", "arena"]
        if any(keyword in game_name_lower for keyword in moba_keywords):
            return "moba"

        return "fps"

    def _customize_config(
        self, base_config: Dict, user_key: str, game: Game, project: Project, key_obj: Key
    ) -> Dict:
        """Customize configuration based on user, project, and game specifics"""
        try:

            import copy

            customized_config = copy.deepcopy(base_config)

            if hasattr(project, "security_level"):
                if project.security_level == "high":

                    for feature in customized_config.get("feature_flags", {}):
                        if "hack" in feature or "god" in feature or "teleport" in feature:
                            customized_config["feature_flags"][feature] = False

            user = User.query.get(key_obj.user_id) if key_obj.user_id else None
            if user:
                from ...services.rbac import rbac_service

                is_owner = rbac_service.check_permission(user.id, "system.manage_all_projects")
                is_admin = rbac_service.check_permission(
                    user.id, "games.edit"
                ) or rbac_service.check_permission(user.id, "games.view")
                is_seller = rbac_service.check_permission(user.id, "games.view")
                if is_owner:

                    pass
                elif is_admin:

                    pass
                elif is_seller:

                    for feature in customized_config.get("feature_flags", {}):
                        if "hack" in feature or "god" in feature:
                            customized_config["feature_flags"][feature] = False
                else:

                    for feature in customized_config.get("feature_flags", {}):
                        if (
                            "hack" in feature
                            or "god" in feature
                            or "teleport" in feature
                            or "wallhack" in feature
                        ):
                            customized_config["feature_flags"][feature] = False

            if game.status == "testing":

                for feature in customized_config.get("feature_flags", {}):
                    customized_config["feature_flags"][feature] = True
            elif game.status == "maintenance":

                for feature in customized_config.get("feature_flags", {}):
                    customized_config["feature_flags"][feature] = False

            customized_config = self._randomize_memory_addresses(customized_config, user_key)

            customized_config = self._randomize_decryption_keys(customized_config, user_key)

            return customized_config

        except Exception as e:
            logging.error(f"CONFIG_CUSTOMIZATION_ERROR user_key={user_key} error={e}")
            return base_config

    def _randomize_memory_addresses(self, config: Dict, user_key: str) -> Dict:
        """Randomize memory addresses based on user key"""
        try:
            if "memory_addresses" not in config:
                return config

            seed = int(hashlib.md5(user_key.encode()).hexdigest()[:8], 16)

            for address_name, address in config["memory_addresses"].items():

                base_address = int(address, 16)
                random_offset = (seed % 0x1000) * 4
                new_address = base_address + random_offset
                config["memory_addresses"][address_name] = f"0x{new_address:08X}"

            return config

        except Exception as e:
            logging.error(f"MEMORY_ADDRESS_RANDOMIZATION_ERROR user_key={user_key} error={e}")
            return config

    def _randomize_decryption_keys(self, config: Dict, user_key: str) -> Dict:
        """Randomize decryption keys based on user key"""
        try:
            if "decryption_keys" not in config:
                return config

            seed = int(hashlib.md5(user_key.encode()).hexdigest()[:8], 16)

            for key_name, key in config["decryption_keys"].items():

                base_key = int(key, 16)
                random_offset = (seed % 0x100) * 0x1000000
                new_key = base_key + random_offset
                config["decryption_keys"][key_name] = f"0x{new_key:016X}"

            return config

        except Exception as e:
            logging.error(f"DECRYPTION_KEY_RANDOMIZATION_ERROR user_key={user_key} error={e}")
            return config

    def _calculate_checksum(self, config: Dict) -> str:
        """Calculate checksum for configuration"""
        try:

            config_copy = config.copy()
            config_copy.pop("metadata", None)

            json_data = json.dumps(config_copy, sort_keys=True)
            return hashlib.sha256(json_data.encode()).hexdigest()[:16]

        except Exception as e:
            logging.error(f"CHECKSUM_CALCULATION_ERROR: {e}")
            return "0000000000000000"

dynamic_config_service = DynamicConfigService()
