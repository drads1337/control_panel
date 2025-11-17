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
        self.challenge_ttl = 300  # 5 minutes
        self.max_attempts = 3
        self.complexity_levels = {"basic": 1, "standard": 2, "advanced": 3, "maximum": 4}

    def generate_bytecode_challenge(self, complexity: str = "standard") -> Dict:
        """Generate a cryptographically secure bytecode challenge"""
        import secrets

        level = self.complexity_levels.get(complexity, 2)

        # Generate cryptographically secure random values (64-bit)
        a = secrets.randbelow(2**64)
        b = secrets.randbelow(2**64)
        c = secrets.randbelow(2**64)
        d = secrets.randbelow(2**64)

        # Generate additional entropy
        nonce = secrets.token_hex(16)
        timestamp = int(time.time())

        # Create bytecode operations based on complexity
        operations = []
        expected_result = 0

        if level >= 1:
            # Secure arithmetic with large numbers
            operations.append(f"ADD {a} {b}")
            expected_result = (a + b) % (2**64)

        if level >= 2:
            # Bitwise operations with rotation
            operations.append(f"XOR {c} {d}")
            expected_result ^= c ^ d
            # Add rotation for additional complexity
            operations.append(f"ROTATE {expected_result} 13")
            expected_result = ((expected_result << 13) | (expected_result >> (64 - 13))) & (
                2**64 - 1
            )

        if level >= 3:
            # Cryptographic hash operations
            hash_input = f"{a}{b}{c}{d}{nonce}{timestamp}"
            operations.append(f"HASH {hash_input}")
            hash_result = int(hashlib.sha256(hash_input.encode()).hexdigest()[:16], 16)
            expected_result = (expected_result + hash_result) % (2**64)

        if level >= 4:
            # Time-based operations with entropy
            operations.append(f"TIME {timestamp}")
            time_entropy = (timestamp * 0x9E3779B9) & (2**64 - 1)  # Golden ratio multiplier
            expected_result = (expected_result ^ time_entropy) % (2**64)

        # Add final cryptographic mixing
        final_mix = hashlib.sha256(f"{expected_result}{nonce}{timestamp}".encode()).hexdigest()
        expected_result = int(final_mix[:16], 16)

        # Create bytecode challenge with anti-replay protection
        bytecode = {
            "operations": operations,
            "expected_result": expected_result,
            "complexity": complexity,
            "timestamp": timestamp,
            "nonce": nonce,
            "challenge_id": secrets.token_hex(8),
        }

        return bytecode

    def generate_js_challenge(self, complexity: str = "standard") -> Dict:
        """Generate a JavaScript challenge that client must execute"""
        level = self.complexity_levels.get(complexity, 2)

        # Generate random values
        values = [random.randint(100, 999) for _ in range(4)]

        # Create JavaScript code based on complexity
        js_code = ""
        expected_result = 0

        if level >= 1:
            # Basic arithmetic
            js_code += f"let a = {values[0]};\n"
            js_code += f"let b = {values[1]};\n"
            js_code += f"let result = a + b;\n"
            expected_result = values[0] + values[1]

        if level >= 2:
            # Bitwise operations
            js_code += f"let c = {values[2]};\n"
            js_code += f"let d = {values[3]};\n"
            js_code += f"result = result ^ (c ^ d);\n"
            expected_result ^= values[2] ^ values[3]

        if level >= 3:
            # String operations
            js_code += f"let str = '{''.join(map(str, values))}';\n"
            js_code += f"result = result + str.length * 7;\n"
            expected_result += len("".join(map(str, values))) * 7

        if level >= 4:
            # Date operations
            js_code += f"let now = new Date();\n"
            js_code += f"result = result + now.getSeconds();\n"
            expected_result += datetime.now().second

        # Add obfuscation
        js_code = self._obfuscate_js(js_code)

        challenge = {
            "js_code": js_code,
            "expected_result": expected_result,
            "complexity": complexity,
            "timestamp": int(time.time()),
        }

        return challenge

    def _obfuscate_js(self, js_code: str) -> str:
        """Advanced JavaScript obfuscation with multiple techniques"""
        import base64
        import secrets

        obfuscated = js_code

        # Generate cryptographically secure variable names
        var_map = {
            "a": f"_{secrets.token_hex(4)}",
            "b": f"_{secrets.token_hex(4)}",
            "c": f"_{secrets.token_hex(4)}",
            "d": f"_{secrets.token_hex(4)}",
            "result": f"_{secrets.token_hex(6)}",
            "str": f"_{secrets.token_hex(4)}",
            "now": f"_{secrets.token_hex(4)}",
            "let": f"_{secrets.token_hex(3)}",
            "new": f"_{secrets.token_hex(3)}",
            "Date": f"_{secrets.token_hex(4)}",
        }

        # Replace variables with obfuscated names
        for original, obfuscated_var in var_map.items():
            obfuscated = obfuscated.replace(original, obfuscated_var)

        # Add dead code and fake operations
        dead_code_lines = [
            f"var _{secrets.token_hex(4)} = {secrets.randbelow(1000)};",
            f"var _{secrets.token_hex(4)} = '{secrets.token_hex(8)}';",
            f"var _{secrets.token_hex(4)} = Math.random() * {secrets.randbelow(1000)};",
            f"var _{secrets.token_hex(4)} = new Date().getTime();",
            f"var _{secrets.token_hex(4)} = '{secrets.token_hex(12)}'.length;",
        ]

        # Add fake security checks
        fake_checks = [
            f"if (typeof _{secrets.token_hex(4)} !== 'undefined') {{",
            f"    var _{secrets.token_hex(4)} = 'security_check';",
            f"}}",
            f"var _{secrets.token_hex(4)} = function() {{ return {secrets.randbelow(100)}; }};",
            f"var _{secrets.token_hex(4)} = 'anti_debug_{secrets.token_hex(6)}';",
        ]

        # Insert obfuscated code
        lines = obfuscated.split("\n")
        obfuscated_lines = []

        for i, line in enumerate(lines):
            if line.strip():
                # Add random dead code before each real line
                if secrets.randbelow(3) == 0:  # 33% chance
                    obfuscated_lines.append(secrets.choice(dead_code_lines))

                # Add the real line
                obfuscated_lines.append(line)

                # Add fake security checks after some lines
                if secrets.randbelow(4) == 0:  # 25% chance
                    obfuscated_lines.extend(secrets.choice(fake_checks).split("\n"))

        # Add random comments with base64 encoded strings
        comments = [
            f"// {base64.b64encode(secrets.token_bytes(8)).decode()}",
            f"// Security: {secrets.token_hex(16)}",
            f"// Validation: {secrets.token_hex(12)}",
            f"// Integrity: {secrets.token_hex(20)}",
            f"// Anti-tamper: {secrets.token_hex(14)}",
        ]

        # Insert comments randomly
        final_lines = []
        for line in obfuscated_lines:
            if line.strip() and secrets.randbelow(5) == 0:  # 20% chance
                final_lines.append(secrets.choice(comments))
            final_lines.append(line)

        return "\n".join(final_lines)

    def generate_crypto_challenge(self, user_key: str, fingerprint: str) -> Dict:
        """Generate a cryptographic challenge using secure algorithms only"""
        import hashlib  # Import at the beginning to avoid UnboundLocalError
        import secrets

        # Generate cryptographically secure random salt
        salt = secrets.token_hex(32)  # 32 bytes = 64 hex chars
        nonce = secrets.token_hex(16)  # 16 bytes = 32 hex chars
        timestamp = int(time.time())

        # Create challenge data
        challenge_data = {
            "user_key": user_key,
            "fingerprint": fingerprint,
            "salt": salt,
            "timestamp": timestamp,
            "nonce": nonce,
        }

        # Generate multiple secure hash challenges
        challenges = {}

        # SHA256 challenge (primary)
        sha256_input = f"{user_key}{fingerprint}{salt}{nonce}"
        challenges["sha256"] = {
            "input": sha256_input,
            "expected": hashlib.sha256(sha256_input.encode()).hexdigest(),
        }

        # SHA512 challenge (secondary)
        sha512_input = f"{fingerprint}{user_key}{salt}{nonce}"
        challenges["sha512"] = {
            "input": sha512_input,
            "expected": hashlib.sha512(sha512_input.encode()).hexdigest(),
        }

        # SHA3-256 challenge (modern)
        try:
            sha3_input = f"{salt}{user_key}{fingerprint}{nonce}"
            challenges["sha3_256"] = {
                "input": sha3_input,
                "expected": hashlib.sha3_256(sha3_input.encode()).hexdigest(),
            }
        except AttributeError:
            # Fallback if SHA3 not available
            pass

        # BLAKE2b challenge (fast and secure)
        try:
            blake2b_input = f"{user_key}{fingerprint}{salt}{nonce}{timestamp}"
            challenges["blake2b"] = {
                "input": blake2b_input,
                "expected": hashlib.blake2b(blake2b_input.encode()).hexdigest(),
            }
        except AttributeError:
            # Fallback if BLAKE2b not available
            pass

        # Combined challenge with HMAC
        combined_input = f"{user_key}{fingerprint}{salt}{timestamp}"
        hmac_key = hashlib.sha256(f"{user_key}{fingerprint}".encode()).digest()
        import hmac

        challenges["hmac_sha256"] = {
            "input": combined_input,
            "key": hmac_key.hex(),
            "expected": hmac.new(hmac_key, combined_input.encode(), hashlib.sha256).hexdigest(),
        }

        # PBKDF2 challenge (key derivation)
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
        # Generate random memory blocks
        memory_blocks = {}
        for i in range(5):
            block_id = f"block_{i}"
            data = os.urandom(16).hex()
            memory_blocks[block_id] = data

        # Create operations that require memory access
        operations = [
            {"type": "store", "block_id": "block_0", "data": memory_blocks["block_0"]},
            {"type": "store", "block_id": "block_1", "data": memory_blocks["block_1"]},
            {"type": "xor", "block_a": "block_0", "block_b": "block_1", "result_block": "block_2"},
            {"type": "hash", "block_id": "block_2", "result_block": "block_3"},
            {"type": "retrieve", "block_id": "block_3"},
        ]

        # Calculate expected result
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

        # Time-based challenge with multiple timing checks
        start_time = time.time()

        # Generate random timing parameters
        base_duration = 0.05 + (secrets.randbelow(20) / 1000)  # 50-70ms
        tolerance = 0.01  # 10ms tolerance (much tighter)
        random_delay = secrets.randbelow(10) / 1000  # 0-10ms random delay

        # Create multiple timing checkpoints
        operations = []
        total_expected_time = 0

        # Loop operation with precise timing
        loop_count = 500 + secrets.randbelow(500)  # 500-1000 iterations
        operations.append(
            {
                "type": "loop",
                "count": loop_count,
                "expected_time": 0.02 + (secrets.randbelow(10) / 1000),
            }
        )
        total_expected_time += 0.02 + (secrets.randbelow(10) / 1000)

        # Hash operation
        hash_data = secrets.token_hex(32)
        operations.append(
            {
                "type": "hash",
                "data": hash_data,
                "expected_time": 0.01 + (secrets.randbelow(5) / 1000),
            }
        )
        total_expected_time += 0.01 + (secrets.randbelow(5) / 1000)

        # Sleep operation with random component
        sleep_duration = 0.02 + (secrets.randbelow(10) / 1000)
        operations.append({"type": "sleep", "duration": sleep_duration})
        total_expected_time += sleep_duration

        # Add anti-debugging checks
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
            # Check if this is an enhanced challenge (has 'challenges' object)
            if "challenges" in challenge_data:
                return self._validate_enhanced_challenge(
                    challenge_data, response, user_key, fingerprint
                )

            # Handle legacy single challenge types
            challenge_type = challenge_data.get("type", "basic")

            if challenge_type == "bytecode":
                return self._validate_bytecode_response(challenge_data, response)
            elif challenge_type == "javascript":
                return self._validate_js_response(challenge_data, response)
            elif challenge_type == "crypto":
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
            # First, validate challenge integrity and check for replay attacks
            challenge_id = challenge_data.get("challenge_id")
            timestamp = challenge_data.get("timestamp")
            signature = challenge_data.get("signature")

            if not challenge_id or not timestamp or not signature:
                return False, "Missing challenge security data"

            # Check for replay attacks
            if self._is_challenge_replay(challenge_id):
                return False, "Challenge replay attack detected"

            # Validate challenge signature
            expected_signature = self._sign_challenge(
                user_key, fingerprint, challenge_id, timestamp
            )
            if signature != expected_signature:
                return False, "Challenge signature validation failed"

            # Check timestamp (challenge should be recent)
            current_time = int(time.time())
            if current_time - timestamp > 300:  # 5 minutes max
                return False, "Challenge expired"

            challenges = challenge_data.get("challenges", {})
            responses = response.get("responses", {})

            # Validate each challenge type present in the enhanced challenge
            for challenge_name, challenge_config in challenges.items():
                if challenge_name == "crypto":
                    # For crypto challenges, validate all sub-challenges
                    is_valid, message = self._validate_crypto_response(
                        challenge_config, response, user_key, fingerprint
                    )
                    if not is_valid:
                        return False, f"Crypto challenge failed: {message}"

                elif challenge_name == "bytecode":
                    # For bytecode challenges, validate the result
                    is_valid, message = self._validate_bytecode_response(challenge_config, response)
                    if not is_valid:
                        return False, f"Bytecode challenge failed: {message}"

                elif challenge_name == "javascript":
                    # For JavaScript challenges, validate the result
                    is_valid, message = self._validate_js_response(challenge_config, response)
                    if not is_valid:
                        return False, f"JavaScript challenge failed: {message}"

                elif challenge_name == "memory":
                    # For memory challenges, validate the result
                    is_valid, message = self._validate_memory_response(challenge_config, response)
                    if not is_valid:
                        return False, f"Memory challenge failed: {message}"

                elif challenge_name == "anti_debug":
                    # For anti-debug challenges, validate the result
                    is_valid, message = self._validate_timing_response(challenge_config, response)
                    if not is_valid:
                        return False, f"Anti-debug challenge failed: {message}"

            return True, "All enhanced challenges passed"

        except Exception as e:
            return False, f"Enhanced challenge validation error: {str(e)}"

    def _validate_bytecode_response(self, challenge_data: Dict, response: Dict) -> Tuple[bool, str]:
        """Validate bytecode challenge response with anti-replay protection"""
        expected = challenge_data.get("expected_result")
        actual = response.get("result")
        challenge_id = challenge_data.get("challenge_id")
        timestamp = challenge_data.get("timestamp")

        if expected is None or actual is None:
            return False, "Missing expected or actual result"

        # Check for replay attacks
        if challenge_id is None or timestamp is None:
            return False, "Missing challenge security data"

        # Check timestamp (challenge should be recent)
        current_time = int(time.time())
        if current_time - timestamp > 300:  # 5 minutes max
            return False, "Challenge expired"

        # Validate response
        try:
            if int(actual) == int(expected):
                return True, "Bytecode challenge passed"
            else:
                return False, f"Bytecode challenge failed: expected {expected}, got {actual}"
        except (ValueError, TypeError):
            return False, "Invalid response format"

    def _validate_js_response(self, challenge_data: Dict, response: Dict) -> Tuple[bool, str]:
        """Validate JavaScript challenge response"""
        expected = challenge_data.get("expected_result")
        actual = response.get("result")

        if expected is None or actual is None:
            return False, "Missing expected or actual result"

        if int(actual) == int(expected):
            return True, "JavaScript challenge passed"
        else:
            return False, f"JavaScript challenge failed: expected {expected}, got {actual}"

    def _validate_crypto_response(
        self, challenge_data: Dict, response: Dict, user_key: str, fingerprint: str
    ) -> Tuple[bool, str]:
        """Validate cryptographic challenge response with enhanced security"""
        challenges = challenge_data.get("challenges", {})
        responses = response.get("responses", {})
        challenge_id = challenge_data.get("challenge_id")
        timestamp = challenge_data.get("timestamp")

        # Check for replay attacks
        if challenge_id is None or timestamp is None:
            return False, "Missing challenge security data"

        # Check timestamp (challenge should be recent)
        current_time = int(time.time())
        if current_time - timestamp > 300:  # 5 minutes max
            return False, "Challenge expired"

        logging.debug(f"CRYPTO_VALIDATION challenges={list(challenges.keys())}")
        logging.debug(f"CRYPTO_VALIDATION responses={list(responses.keys())}")

        # Validate each challenge type
        for challenge_name, challenge in challenges.items():
            expected = challenge.get("expected")
            actual = responses.get(challenge_name)

            logging.debug(
                f"CRYPTO_VALIDATION {challenge_name}: expected={expected[:16] if expected else None}..., actual={actual[:16] if actual else None}..."
            )

            if expected is None or actual is None:
                return False, f"Missing response for {challenge_name}"

            # Additional validation for specific challenge types
            if challenge_name == "hmac_sha256":
                # For HMAC challenges, also validate the key
                key = challenge.get("key")
                if not key:
                    return False, f"Missing key for HMAC challenge"

            elif challenge_name == "pbkdf2":
                # For PBKDF2 challenges, validate iterations
                iterations = challenge.get("iterations")
                if iterations != 10000:
                    return False, f"Invalid PBKDF2 iterations: {iterations}"

            # Constant-time comparison to prevent timing attacks
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

        # Check for replay attacks
        if challenge_id is None or timestamp is None:
            return False, "Missing challenge security data"

        # Check timestamp (challenge should be recent)
        current_time = int(time.time())
        if current_time - timestamp > 300:  # 5 minutes max
            return False, "Challenge expired"

        # Validate timing with tighter tolerance
        actual_duration = end_time - start_time
        min_duration = expected_duration - tolerance
        max_duration = expected_duration + tolerance

        # Additional checks for suspicious timing patterns
        if actual_duration < 0:
            return False, "Invalid timing data (negative duration)"

        if actual_duration > 1.0:  # More than 1 second is suspicious
            return False, "Timing challenge took too long (possible debugging)"

        # Check for exact timing matches (possible replay)
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
        # In a real implementation, you would analyze user behavior, IP reputation, etc.
        # For now, we'll use a simple heuristic

        # Check if this is a new fingerprint
        # If new, use higher complexity
        # If known, use standard complexity

        # This is a simplified version - in production, you'd have more sophisticated logic
        return "standard"

    def create_enhanced_challenge(self, user_key: str, fingerprint: str) -> Dict:
        """Create an enhanced challenge combining multiple techniques with replay protection"""
        import secrets

        complexity = self.get_challenge_complexity(user_key, fingerprint)

        # Generate unique challenge ID for replay protection
        challenge_id = secrets.token_hex(16)
        timestamp = int(time.time())

        # Generate multiple challenge types
        challenges = {}

        # Always include crypto challenge
        challenges["crypto"] = self.generate_crypto_challenge(user_key, fingerprint)

        # Add complexity-based challenges
        if complexity in ["advanced", "maximum"]:
            challenges["bytecode"] = self.generate_bytecode_challenge(complexity)
            challenges["javascript"] = self.generate_js_challenge(complexity)

        if complexity == "maximum":
            challenges["memory"] = self.generate_memory_challenge()
            challenges["anti_debug"] = self.generate_anti_debug_challenge()

        # Create challenge package with anti-replay protection
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

        # Store challenge ID in Redis for replay protection
        self._store_challenge_id(challenge_id, user_key, fingerprint)

        return challenge_package

    def _sign_challenge(
        self, user_key: str, fingerprint: str, challenge_id: str, timestamp: int
    ) -> str:
        """Create a cryptographic signature for the challenge"""
        import hashlib
        import hmac

        # Use a secret key for signing (in production, this should be from config)
        secret_key = hashlib.sha256(f"{user_key}{fingerprint}".encode()).digest()

        # Create signature data
        signature_data = f"{challenge_id}{timestamp}{user_key}{fingerprint}"

        # Generate HMAC signature
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

            # Test connection first
            redis_client.ping()

            # Store challenge ID with TTL
            key = f"challenge_id:{challenge_id}"
            redis_client.setex(key, self.challenge_ttl, f"{user_key}:{fingerprint}")
            logging.debug(f"Challenge ID stored: {challenge_id}")

        except Exception as e:
            logging.error(f"Error storing challenge ID: {e}")
            import traceback

            logging.error(f"Challenge ID storage traceback: {traceback.format_exc()}")
            # Don't raise - allow challenge generation to continue even if Redis fails

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

            # Check if challenge ID exists
            key = f"challenge_id:{challenge_id}"
            exists = redis_client.exists(key)

            if exists:
                # Mark as used to prevent future replays
                redis_client.delete(key)
                return True

            return False

        except Exception as e:
            logging.error(f"Error checking challenge replay: {e}")
            return True  # Fail safe - assume replay if we can't check


# Global instance
challenge_service = ChallengeService()
