"""
Library Hash Service
Сервис для проверки SHA-256 хэшей сборок библиотек для Product и Agent
"""

import logging
from typing import Optional, Tuple

from ...models.keys import Key
from ...models.library_hash import (
    AgentLibraryBuildHash,
    AgentLibraryHashSettings,
    ProductLibraryBuildHash,
    ProductLibraryHashSettings,
)

logger = logging.getLogger(__name__)


class LibraryHashService:
    """Сервис для проверки SHA-256 хэшей библиотек"""

    def validate_library_hash(
        self, key_obj: Key, hash_sha256: Optional[str]
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Проверяет, разрешен ли SHA-256 хэш для Product или Agent из Key

        Args:
            key_obj: Объект Key (содержит product_id или agent_id)
            hash_sha256: SHA-256 хэш библиотеки от клиента (в hex формате, может быть None)

        Returns:
            Tuple[is_valid, error_message, entity_type]
            entity_type: 'product', 'agent' или None
        """
        hash_provided = bool(hash_sha256 and hash_sha256.strip())
        
        # Нормализовать хэш (lowercase, убрать пробелы) если передан
        if hash_provided:
            hash_sha256 = hash_sha256.lower().strip()

        # Проверить для Agent (если используется loader)
        if key_obj and key_obj.agent_id:
            is_valid, error_msg = self._validate_agent_hash(key_obj.agent_id, hash_sha256 if hash_provided else None)
            if not is_valid:
                return False, error_msg, "agent"
            # Если проверка прошла успешно
            if error_msg == "":  # Проверка была включена и прошла успешно
                return True, "", "agent"

        # Проверить для Product
        if key_obj and key_obj.product_id:
            is_valid, error_msg = self._validate_product_hash(
                key_obj.product_id, hash_sha256 if hash_provided else None
            )
            if not is_valid:
                return False, error_msg, "product"
            # Если проверка прошла успешно
            if error_msg == "":  # Проверка была включена и прошла успешно
                return True, "", "product"

        # Если проверка не включена или нет product_id/agent_id - разрешить
        return True, "", None

    def _validate_agent_hash(
        self, agent_id: int, hash_sha256: Optional[str]
    ) -> Tuple[bool, str]:
        """
        Проверяет хэш для Agent

        Args:
            agent_id: ID агента
            hash_sha256: SHA-256 хэш (может быть None)

        Returns:
            Tuple[is_valid, error_message]
        """
        settings = AgentLibraryHashSettings.query.filter_by(
            agent_id=agent_id
        ).first()

        # Если проверка отключена - разрешить
        if not settings or not settings.library_hash_check_enabled:
            return True, "check_disabled"

        # Если проверка включена, но хеш не передан и блокировка включена - отклонить
        if not hash_sha256 or (isinstance(hash_sha256, str) and not hash_sha256.strip()):
            if settings.mismatch_action == 'block':
                error_msg = "Agent library hash is required but not provided"
                logger.warning(
                    f"AGENT_LIBRARY_HASH_MISSING agent_id={agent_id} "
                    f"mismatch_action={settings.mismatch_action}"
                )
                return False, error_msg
            # Если mismatch_action == 'warn', разрешаем (для совместимости)
            return True, "check_disabled"

        # Проверка формата SHA-256 (64 hex символа)
        if len(hash_sha256) != 64 or not all(c in "0123456789abcdef" for c in hash_sha256):
            logger.warning(
                f"INVALID_AGENT_LIBRARY_HASH_FORMAT hash_length={len(hash_sha256)} agent_id={agent_id}"
            )
            if settings.mismatch_action == 'block':
                return False, "Invalid library hash format"
            return True, "check_disabled"

        # Проверить наличие хэша в белом списке
        allowed_hash = AgentLibraryBuildHash.query.filter_by(
            agent_id=agent_id, hash_sha256=hash_sha256, is_active=True
        ).first()

        if not allowed_hash:
            error_msg = f"Agent library hash not allowed: {hash_sha256[:16]}..."
            logger.warning(
                f"AGENT_LIBRARY_HASH_MISMATCH agent_id={agent_id} hash={hash_sha256[:16]}..."
            )
            if settings.mismatch_action == 'block':
                return False, error_msg
            # Если mismatch_action == 'warn', разрешаем (для совместимости)
            return True, "check_disabled"

        logger.debug(
            f"AGENT_LIBRARY_HASH_VALIDATED agent_id={agent_id} hash={hash_sha256[:16]}..."
        )
        return True, ""

    def _validate_product_hash(
        self, product_id: int, hash_sha256: Optional[str]
    ) -> Tuple[bool, str]:
        """
        Проверяет хэш для Product

        Args:
            product_id: ID продукта
            hash_sha256: SHA-256 хэш (может быть None)

        Returns:
            Tuple[is_valid, error_message]
        """
        settings = ProductLibraryHashSettings.query.filter_by(
            product_id=product_id
        ).first()

        # Если проверка отключена - разрешить
        if not settings or not settings.library_hash_check_enabled:
            return True, "check_disabled"

        # Если проверка включена, но хеш не передан и блокировка включена - отклонить
        if not hash_sha256 or (isinstance(hash_sha256, str) and not hash_sha256.strip()):
            if settings.mismatch_action == 'block':
                error_msg = "Product library hash is required but not provided"
                logger.warning(
                    f"PRODUCT_LIBRARY_HASH_MISSING product_id={product_id} "
                    f"mismatch_action={settings.mismatch_action}"
                )
                return False, error_msg
            # Если mismatch_action == 'warn', разрешаем (для совместимости)
            return True, "check_disabled"

        # Проверка формата SHA-256 (64 hex символа)
        if len(hash_sha256) != 64 or not all(c in "0123456789abcdef" for c in hash_sha256):
            logger.warning(
                f"INVALID_PRODUCT_LIBRARY_HASH_FORMAT hash_length={len(hash_sha256)} product_id={product_id}"
            )
            if settings.mismatch_action == 'block':
                return False, "Invalid library hash format"
            return True, "check_disabled"

        # Проверить наличие хэша в белом списке
        allowed_hash = ProductLibraryBuildHash.query.filter_by(
            product_id=product_id, hash_sha256=hash_sha256, is_active=True
        ).first()

        if not allowed_hash:
            error_msg = f"Product library hash not allowed: {hash_sha256[:16]}..."
            logger.warning(
                f"PRODUCT_LIBRARY_HASH_MISMATCH product_id={product_id} hash={hash_sha256[:16]}..."
            )
            if settings.mismatch_action == 'block':
                return False, error_msg
            # Если mismatch_action == 'warn', разрешаем (для совместимости)
            return True, "check_disabled"

        logger.debug(
            f"PRODUCT_LIBRARY_HASH_VALIDATED product_id={product_id} hash={hash_sha256[:16]}..."
        )
        return True, ""
