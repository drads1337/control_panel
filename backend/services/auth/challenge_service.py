"""
Advanced Challenge-Response Service
Provides complex challenge generation with bytecode and JS scripts
"""

import base64
import hashlib
import json
import logging
import os
import random
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from flask import current_app

from ...core.extensions import db
from ...models.core import User
from ...models.keys import Key
from ...services.activity import activity_service

class ChallengeService:
    """Service for generating and validating complex challenges"""

    def __init__(self):
        self.challenge_ttl = 300
        self.max_attempts = 3
        self.complexity_levels = {"basic": 1, "standard": 2, "advanced": 3, "maximum": 4}

    # REMOVED: generate_bytecode_challenge() - deprecated, used custom crypto (false security)
    # REMOVED: generate_js_challenge() - deprecated, used JS obfuscation (false security)
    # REMOVED: _obfuscate_js() - deprecated, used JS obfuscation (false security)
    #
    # These methods were removed to follow KISS principle and eliminate "Security through Obscurity".
    # Real security comes from:
    # - Standard cryptographic algorithms (SHA-256, HMAC, PBKDF2) - already in generate_crypto_challenge()
    # - Proper authentication (mTLS - already implemented)
    # - Infrastructure-level protection (rate limiting, monitoring - already implemented)

    def generate_crypto_challenge(self, user_key: str, fingerprint: str) -> Dict:
        """Generate a cryptographic challenge using secure algorithms only"""
        import hashlib
        import secrets

        salt = secrets.token_hex(32)
        nonce = secrets.token_hex(16)
        timestamp = int(time.time())

        challenge_data = {
            "user_key": user_key,
            "fingerprint": fingerprint,
            "salt": salt,
            "timestamp": timestamp,
            "nonce": nonce,
        }

        challenges = {}

        sha256_input = f"{user_key}{fingerprint}{salt}{nonce}"
        challenges["sha256"] = {
            "input": sha256_input,
            "expected": hashlib.sha256(sha256_input.encode()).hexdigest(),
        }

        sha512_input = f"{fingerprint}{user_key}{salt}{nonce}"
        challenges["sha512"] = {
            "input": sha512_input,
            "expected": hashlib.sha512(sha512_input.encode()).hexdigest(),
        }

        try:
            sha3_input = f"{salt}{user_key}{fingerprint}{nonce}"
            challenges["sha3_256"] = {
                "input": sha3_input,
                "expected": hashlib.sha3_256(sha3_input.encode()).hexdigest(),
            }
        except AttributeError:

            pass

        try:
            blake2b_input = f"{user_key}{fingerprint}{salt}{nonce}{timestamp}"
            challenges["blake2b"] = {
                "input": blake2b_input,
                "expected": hashlib.blake2b(blake2b_input.encode()).hexdigest(),
            }
        except AttributeError:

            pass

        combined_input = f"{user_key}{fingerprint}{salt}{timestamp}"
        hmac_key = hashlib.sha256(f"{user_key}{fingerprint}".encode()).digest()
        import hmac

        challenges["hmac_sha256"] = {
            "input": combined_input,
            "key": hmac_key.hex(),
            "expected": hmac.new(hmac_key, combined_input.encode(), hashlib.sha256).hexdigest(),
        }

        pbkdf2_salt = secrets.token_hex(16)
        challenges["pbkdf2"] = {
            "input": f"{user_key}{fingerprint}",
            "salt": pbkdf2_salt,
            "iterations": 10000,
            "expected": hashlib.pbkdf2_hmac(
                "sha256", f"{user_key}{fingerprint}".encode(), bytes.fromhex(pbkdf2_salt), 10000
            ).hex(),
        }

        return {
            "challenges": challenges,
            "salt": salt,
            "timestamp": timestamp,
            "nonce": nonce,
            "challenge_id": secrets.token_hex(8),
        }

    def generate_memory_challenge(self) -> Dict:
        """Generate a memory-based challenge requiring client to store and retrieve data"""

        memory_blocks = {}
        for i in range(5):
            block_id = f"block_{i}"
            data = os.urandom(16).hex()
            memory_blocks[block_id] = data

        operations = [
            {"type": "store", "block_id": "block_0", "data": memory_blocks["block_0"]},
            {"type": "store", "block_id": "block_1", "data": memory_blocks["block_1"]},
            {"type": "xor", "block_a": "block_0", "block_b": "block_1", "result_block": "block_2"},
            {"type": "hash", "block_id": "block_2", "result_block": "block_3"},
            {"type": "retrieve", "block_id": "block_3"},
        ]

        block_0 = int(memory_blocks["block_0"], 16)
        block_1 = int(memory_blocks["block_1"], 16)
        xor_result = block_0 ^ block_1
        hash_result = hashlib.sha256(hex(xor_result).encode()).hexdigest()

        return {
            "operations": operations,
            "expected_result": hash_result,
            "memory_blocks": memory_blocks,
        }

    def generate_anti_debug_challenge(self) -> Dict:
        """Generate a challenge that detects debugging attempts with enhanced security"""
        import secrets

        start_time = time.time()

        base_duration = 0.05 + (secrets.randbelow(20) / 1000)
        tolerance = 0.01
        random_delay = secrets.randbelow(10) / 1000

        operations = []
        total_expected_time = 0

        loop_count = 500 + secrets.randbelow(500)
        operations.append(
            {
                "type": "loop",
                "count": loop_count,
                "expected_time": 0.02 + (secrets.randbelow(10) / 1000),
            }
        )
        total_expected_time += 0.02 + (secrets.randbelow(10) / 1000)

        hash_data = secrets.token_hex(32)
        operations.append(
            {
                "type": "hash",
                "data": hash_data,
                "expected_time": 0.01 + (secrets.randbelow(5) / 1000),
            }
        )
        total_expected_time += 0.01 + (secrets.randbelow(5) / 1000)

        sleep_duration = 0.02 + (secrets.randbelow(10) / 1000)
        operations.append({"type": "sleep", "duration": sleep_duration})
        total_expected_time += sleep_duration

        operations.append(
            {
                "type": "anti_debug",
                "checks": ["performance.now()", "console.time", "debugger", "devtools"],
            }
        )

        challenge = {
            "type": "timing",
            "start_time": start_time,
            "expected_duration": total_expected_time + random_delay,
            "tolerance": tolerance,
            "random_delay": random_delay,
            "operations": operations,
            "challenge_id": secrets.token_hex(8),
            "timestamp": int(time.time()),
        }

        return challenge

    def validate_challenge_response(
        self, challenge_data: Dict, response: Dict, user_key: str, fingerprint: str
    ) -> Tuple[bool, str]:
        """Validate a challenge response"""
        try:

            if "challenges" in challenge_data:
                return self._validate_enhanced_challenge(
                    challenge_data, response, user_key, fingerprint
                )

            challenge_type = challenge_data.get("type", "basic")

            # Removed bytecode and javascript challenge types (deprecated)
            if challenge_type == "crypto":
                return self._validate_crypto_response(
                    challenge_data, response, user_key, fingerprint
                )
            elif challenge_type == "memory":
                return self._validate_memory_response(challenge_data, response)
            elif challenge_type == "timing":
                return self._validate_timing_response(challenge_data, response)
            else:
                return False, "Unknown challenge type"

        except Exception as e:
            return False, f"Validation error: {str(e)}"

    def _validate_enhanced_challenge(
        self, challenge_data: Dict, response: Dict, user_key: str, fingerprint: str
    ) -> Tuple[bool, str]:
        """Validate enhanced challenge response containing multiple challenge types with replay protection"""
        try:

            challenge_id = challenge_data.get("challenge_id")
            timestamp = challenge_data.get("timestamp")
            signature = challenge_data.get("signature")

            if not challenge_id or not timestamp or not signature:
                return False, "Missing challenge security data"

            if self._is_challenge_replay(challenge_id):
                return False, "Challenge replay attack detected"

            expected_signature = self._sign_challenge(
                user_key, fingerprint, challenge_id, timestamp
            )
            if signature != expected_signature:
                return False, "Challenge signature validation failed"

            current_time = int(time.time())
            if current_time - timestamp > 300:
                return False, "Challenge expired"

            challenges = challenge_data.get("challenges", {})
            responses = response.get("responses", {})

            for challenge_name, challenge_config in challenges.items():
                if challenge_name == "crypto":

                    is_valid, message = self._validate_crypto_response(
                        challenge_config, response, user_key, fingerprint
                    )
                    if not is_valid:
                        return False, f"Crypto challenge failed: {message}"

                # Removed bytecode and javascript challenge validation (deprecated)
                elif challenge_name == "memory":

                    is_valid, message = self._validate_memory_response(challenge_config, response)
                    if not is_valid:
                        return False, f"Memory challenge failed: {message}"

                elif challenge_name == "anti_debug":

                    is_valid, message = self._validate_timing_response(challenge_config, response)
                    if not is_valid:
                        return False, f"Anti-debug challenge failed: {message}"

            return True, "All enhanced challenges passed"

        except Exception as e:
            return False, f"Enhanced challenge validation error: {str(e)}"

    # REMOVED: _validate_bytecode_response() - deprecated, used custom crypto (false security)
    # REMOVED: _validate_js_response() - deprecated, used JS obfuscation (false security)

    def _validate_crypto_response(
        self, challenge_data: Dict, response: Dict, user_key: str, fingerprint: str
    ) -> Tuple[bool, str]:
        """Validate cryptographic challenge response with enhanced security"""
        challenges = challenge_data.get("challenges", {})
        responses = response.get("responses", {})
        challenge_id = challenge_data.get("challenge_id")
        timestamp = challenge_data.get("timestamp")

        if challenge_id is None or timestamp is None:
            return False, "Missing challenge security data"

        current_time = int(time.time())
        if current_time - timestamp > 300:
            return False, "Challenge expired"

        logging.debug(f"CRYPTO_VALIDATION challenges={list(challenges.keys())}")
        logging.debug(f"CRYPTO_VALIDATION responses={list(responses.keys())}")

        for challenge_name, challenge in challenges.items():
            expected = challenge.get("expected")
            actual = responses.get(challenge_name)

            logging.debug(
                f"CRYPTO_VALIDATION {challenge_name}: expected={expected[:16] if expected else None}..., actual={actual[:16] if actual else None}..."
            )

            if expected is None or actual is None:
                return False, f"Missing response for {challenge_name}"

            if challenge_name == "hmac_sha256":

                key = challenge.get("key")
                if not key:
                    return False, f"Missing key for HMAC challenge"

            elif challenge_name == "pbkdf2":

                iterations = challenge.get("iterations")
                if iterations != 10000:
                    return False, f"Invalid PBKDF2 iterations: {iterations}"

            if not self._constant_time_compare(actual, expected):
                return False, f"Crypto challenge {challenge_name} failed"

        return True, "All crypto challenges passed"

    def _constant_time_compare(self, a: str, b: str) -> bool:
        """Constant-time string comparison to prevent timing attacks"""
        if len(a) != len(b):
            return False

        result = 0
        for x, y in zip(a, b):
            result |= ord(x) ^ ord(y)

        return result == 0

    def _validate_memory_response(self, challenge_data: Dict, response: Dict) -> Tuple[bool, str]:
        """Validate memory challenge response"""
        expected = challenge_data.get("expected_result")
        actual = response.get("result")

        if expected is None or actual is None:
            return False, "Missing expected or actual result"

        if actual == expected:
            return True, "Memory challenge passed"
        else:
            return False, f"Memory challenge failed: expected {expected}, got {actual}"

    def _validate_timing_response(self, challenge_data: Dict, response: Dict) -> Tuple[bool, str]:
        """Validate timing challenge response with enhanced security checks"""
        start_time = challenge_data.get("start_time")
        end_time = response.get("end_time")
        expected_duration = challenge_data.get("expected_duration", 0.1)
        tolerance = challenge_data.get("tolerance", 0.01)
        challenge_id = challenge_data.get("challenge_id")
        timestamp = challenge_data.get("timestamp")

        if start_time is None or end_time is None:
            return False, "Missing timing data"

        if challenge_id is None or timestamp is None:
            return False, "Missing challenge security data"

        current_time = int(time.time())
        if current_time - timestamp > 300:
            return False, "Challenge expired"

        actual_duration = end_time - start_time
        min_duration = expected_duration - tolerance
        max_duration = expected_duration + tolerance

        if actual_duration < 0:
            return False, "Invalid timing data (negative duration)"

        if actual_duration > 1.0:
            return False, "Timing challenge took too long (possible debugging)"

        if abs(actual_duration - expected_duration) < 0.001:
            return False, "Suspicious exact timing match"

        if min_duration <= actual_duration <= max_duration:
            return True, "Timing challenge passed"
        else:
            return (
                False,
                f"Timing challenge failed: expected {expected_duration}±{tolerance}s, got {actual_duration:.4f}s",
            )

    def get_challenge_complexity(self, user_key: str, fingerprint: str) -> str:
        """Determine appropriate challenge complexity based on user history"""

        return "standard"

    def create_enhanced_challenge(self, user_key: str, fingerprint: str) -> Dict:
        """Create an enhanced challenge combining multiple techniques with replay protection"""
        import secrets

        complexity = self.get_challenge_complexity(user_key, fingerprint)

        challenge_id = secrets.token_hex(16)
        timestamp = int(time.time())

        challenges = {}

        challenges["crypto"] = self.generate_crypto_challenge(user_key, fingerprint)

        # Note: Removed deprecated bytecode and JS obfuscation challenges.
        # Real security comes from standard cryptographic algorithms (SHA-256, HMAC, PBKDF2),
        # mTLS authentication, and infrastructure-level protection (rate limiting, monitoring).
        # If additional challenge complexity is needed, extend generate_crypto_challenge()
        # with more standard algorithms (e.g., Argon2, scrypt) instead of custom obfuscation.

        if complexity == "maximum":
            challenges["memory"] = self.generate_memory_challenge()
            challenges["anti_debug"] = self.generate_anti_debug_challenge()

        challenge_package = {
            "challenges": challenges,
            "complexity": complexity,
            "timestamp": timestamp,
            "ttl": self.challenge_ttl,
            "user_key": user_key,
            "fingerprint": fingerprint,
            "challenge_id": challenge_id,
            "nonce": secrets.token_hex(16),
            "signature": self._sign_challenge(user_key, fingerprint, challenge_id, timestamp),
        }

        self._store_challenge_id(challenge_id, user_key, fingerprint)

        return challenge_package

    def _sign_challenge(
        self, user_key: str, fingerprint: str, challenge_id: str, timestamp: int
    ) -> str:
        """Create a cryptographic signature for the challenge"""
        import hashlib
        import hmac

        secret_key = hashlib.sha256(f"{user_key}{fingerprint}".encode()).digest()

        signature_data = f"{challenge_id}{timestamp}{user_key}{fingerprint}"

        signature = hmac.new(secret_key, signature_data.encode(), hashlib.sha256).hexdigest()

        return signature

    def _store_challenge_id(self, challenge_id: str, user_key: str, fingerprint: str):
        """Store challenge ID in Redis for replay protection"""
        import redis

        from ...config.config import Config

        try:
            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )

            redis_client.ping()

            key = f"challenge_id:{challenge_id}"
            redis_client.setex(key, self.challenge_ttl, f"{user_key}:{fingerprint}")
            logging.debug(f"Challenge ID stored: {challenge_id}")

        except Exception as e:
            logging.error(f"Error storing challenge ID: {e}")
            import traceback

            logging.error(f"Challenge ID storage traceback: {traceback.format_exc()}")

    def _is_challenge_replay(self, challenge_id: str) -> bool:
        """Check if challenge ID has been used before (replay attack)"""
        import redis

        from ...config.config import Config

        try:
            redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
            )

            key = f"challenge_id:{challenge_id}"
            exists = redis_client.exists(key)

            if exists:

                redis_client.delete(key)
                return True

            return False

        except Exception as e:
            logging.error(f"Error checking challenge replay: {e}")
            return True

challenge_service = ChallengeService()
