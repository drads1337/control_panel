"""
Challenge Validation Service
Handles challenge validation, storage, and cleanup
Single Responsibility: Challenge lifecycle management (storage, validation, cleanup)
"""

import hashlib
import json
import logging
import os
from typing import Any, Dict, Optional, Tuple

import redis

from ...config.config import Config
from ...utils.redis_client import get_redis_client
from ...utils.service_helpers import get_service

logger = logging.getLogger(__name__)

class ChallengeValidationService:
    """Handles challenge validation"""
    def __init__(self, challenge_service=None):
        """Initialize ChallengeValidationService with dependencies"""
        self._challenge_service = challenge_service

    def validate_challenge_response(
        self, user_key: str, fingerprint: str, challenge_response: str, canary: str
    ) -> Tuple[bool, str]:
        """
        Validate challenge response

        Args:
            user_key: User key
            fingerprint: Device fingerprint
            challenge_response: Challenge response from client
            canary: Canary token

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not challenge_response or not canary:
            return False, "Challenge required"

        challenge_data = self._get_challenge_data(user_key, fingerprint)
        if not challenge_data:
            return False, "Challenge not found"

        if challenge_data.get("type") == "legacy":
            return self._validate_legacy_challenge(
                challenge_data, user_key, fingerprint, challenge_response
            )
        else:
            return self._validate_enhanced_challenge(
                challenge_data, user_key, fingerprint, challenge_response
            )

    def store_challenge(
        self, user_key: str, fingerprint: str, enhanced_challenge: Dict[str, Any], project_id: int, ip: str
    ) -> str:
        """
        Store challenge in Redis

        Args:
            user_key: User key
            fingerprint: Device fingerprint
            enhanced_challenge: Challenge data
            project_id: Project ID (for fallback decryption)
            ip: Client IP address (for fallback decryption)

        Returns:
            Canary value
        """
        redis_client = get_redis_client()

        redis_client.ping()
        logger.debug(f"REDIS_CONNECTION_SUCCESS")

        challenge_id = f"enhanced_challenge:{user_key}:{fingerprint}"
        canary = os.urandom(8).hex()

        pipe = redis_client.pipeline()
        pipe.setex(challenge_id, Config.CHALLENGE_TTL, json.dumps(enhanced_challenge))
        # SECURITY: Use centralized CANARY_TTL from Config (reduced from 300 to 120 seconds).
        # In high-load systems, canaries should expire quickly to prevent replay attacks.
        pipe.setex(f"canary:{user_key}:{fingerprint}", Config.CANARY_TTL, canary)

        # SECURITY: Use centralized PROJECT_ID_CACHE_TTL from Config (reduced from 300 to 120 seconds)
        pipe.setex(f"challenge_project_id:{ip}", Config.PROJECT_ID_CACHE_TTL, str(project_id))
        pipe.execute()

        logger.info(f"ENHANCED_CHALLENGE_SAVED user_key={user_key} fingerprint={fingerprint} project_id={project_id}")
        return canary

    def cleanup_challenge(self, user_key: str, fingerprint: str) -> None:
        """
        Clean up challenge and canary from Redis

        Args:
            user_key: User key
            fingerprint: Device fingerprint
        """
        try:
            redis_client = self._get_redis_client()
            if not redis_client:
                return

            challenge_id = f"enhanced_challenge:{user_key}:{fingerprint}"
            redis_client.delete(challenge_id)

            legacy_challenge_id = f"challenge:{user_key}:{fingerprint}"
            redis_client.delete(legacy_challenge_id)

            redis_client.delete(f"canary:{user_key}:{fingerprint}")

            logger.info(
                f"CHALLENGE_CLEANUP_COMPLETE user_key={user_key} fingerprint={fingerprint}"
            )
        except Exception as e:
            logger.error(f"Error cleaning up challenge: {e}")

    def _get_challenge_data(self, user_key: str, fingerprint: str) -> Optional[Dict]:
        """Get challenge data from Redis"""
        try:
            redis_client = self._get_redis_client()
            if not redis_client:
                return None

            challenge_id = f"enhanced_challenge:{user_key}:{fingerprint}"
            enhanced_challenge_json = redis_client.get(challenge_id)

            if enhanced_challenge_json:
                try:
                    challenge_data = json.loads(enhanced_challenge_json)
                    logger.info(
                        f"ENHANCED_CHALLENGE_READ user_key={user_key} fingerprint={fingerprint}"
                    )
                    return challenge_data
                except json.JSONDecodeError:
                    logger.error(
                        f"ENHANCED_CHALLENGE_JSON_ERROR user_key={user_key} fingerprint={fingerprint}"
                    )

            legacy_challenge_id = f"challenge:{user_key}:{fingerprint}"
            legacy_challenge = redis_client.get(legacy_challenge_id)

            if legacy_challenge:
                challenge_data = {"type": "legacy", "challenge": str(legacy_challenge)}
                logger.info(f"LEGACY_CHALLENGE_READ user_key={user_key} fingerprint={fingerprint}")
                return challenge_data

            return None

        except Exception as e:
            logger.error(f"Error getting challenge data: {e}")
            return None

    def _validate_legacy_challenge(
        self, challenge_data: Dict, user_key: str, fingerprint: str, challenge_response: str
    ) -> Tuple[bool, str]:
        """Validate legacy challenge response"""
        challenge = challenge_data.get("challenge")
        if not challenge or not user_key or not fingerprint:
            return False, "Param fail"

        expected = hashlib.sha256((challenge + user_key + fingerprint).encode()).hexdigest()
        logger.info(
            f"LEGACY_CHALLENGE_VERIFY user_key={user_key} client_response={challenge_response} expected={expected}"
        )

        if challenge_response != expected:
            return False, "Challenge failed"

        return True, ""

    def _validate_enhanced_challenge(
        self, challenge_data: Dict, user_key: str, fingerprint: str, challenge_response: str
    ) -> Tuple[bool, str]:
        """Validate enhanced challenge response"""
        try:

            if isinstance(challenge_response, str):
                try:
                    response_data = json.loads(challenge_response)
                except json.JSONDecodeError:

                    if len(challenge_response) == 64 and all(
                        c in "0123456789abcdef" for c in challenge_response.lower()
                    ):
                        logger.info(
                            f"ENHANCED_CHALLENGE_LEGACY_HASH user_key={user_key} - treating as legacy SHA256 hash"
                        )

                        crypto_challenge = challenge_data.get("challenges", {}).get("crypto", {})
                        if crypto_challenge:

                            sha256_challenge = crypto_challenge.get("challenges", {}).get(
                                "sha256", {}
                            )
                            if sha256_challenge:
                                expected_input = sha256_challenge.get("input", "")
                                expected_hash = sha256_challenge.get("expected", "")

                                actual_hash = hashlib.sha256(expected_input.encode()).hexdigest()
                                if (
                                    challenge_response == actual_hash
                                    or challenge_response == expected_hash
                                ):
                                    logger.info(
                                        f"ENHANCED_CHALLENGE_LEGACY_VALID user_key={user_key}"
                                    )
                                    return True, ""

                    response_data = {"result": challenge_response}
            else:
                response_data = challenge_response

            challenge_service = get_service('challenge_service')
            is_valid, validation_message = challenge_service.validate_challenge_response(
                challenge_data, response_data, user_key, fingerprint
            )

            logger.info(
                f"ENHANCED_CHALLENGE_VERIFY user_key={user_key} is_valid={is_valid} message={validation_message}"
            )

            if not is_valid:
                return False, f"Enhanced challenge failed: {validation_message}"

            return True, ""

        except Exception as e:
            logger.error(f"ENHANCED_CHALLENGE_VALIDATION_ERROR: {e}")
            import traceback

            logger.error(f"ENHANCED_CHALLENGE_VALIDATION_TRACEBACK: {traceback.format_exc()}")
            return False, "Challenge validation error"

    def _get_redis_client(self) -> Optional[redis.Redis]:
        """Get Redis client"""
        try:
            return redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
            )
        except Exception as e:
            logger.error(f"Error connecting to Redis: {e}")
            return None
