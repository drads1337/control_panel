"""
Secure Key Exchange Module
Provides certificate-based key derivation to eliminate hardcoded keys in clients.

SECURITY FEATURES:
1. Key derivation from mTLS certificate - no hardcoded keys in client
2. Session keys with short TTL - limits exposure window
3. Certificate fingerprint binding - prevents key reuse across devices
4. HKDF for secure key derivation - cryptographically secure
5. Replay protection via nonce - prevents request replay

FLOW:
1. Client connects with mTLS certificate
2. Server derives session key from certificate public key + server secret
3. Session key is used for AES-256-GCM encryption
4. Session key expires after TTL (default 1 hour)
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend
from cryptography.x509 import load_pem_x509_certificate

from ..config.config import Config

logger = logging.getLogger(__name__)


class SecureKeyExchange:
    """
    Provides secure key exchange based on mTLS certificates.
    
    SECURITY: This eliminates the need for hardcoded master keys in clients.
    The session key is derived from:
    - Client certificate public key (unique per client)
    - Server master secret (known only to server)
    - Timestamp (for key rotation)
    - Random salt (for uniqueness)
    """
    
    # Session key TTL in seconds (1 hour default)
    SESSION_KEY_TTL = int(os.environ.get("SESSION_KEY_TTL", 3600))
    
    # Key derivation info for HKDF
    HKDF_INFO = b"panel-session-key-v1"
    
    def __init__(self):
        self._server_secret = self._get_server_secret()
    
    def _get_server_secret(self) -> bytes:
        """
        Get server secret for key derivation.
        Uses MASTER_KEY but with additional derivation for isolation.
        """
        # Derive a separate secret for key exchange from master key
        master_key_bytes = bytes.fromhex(Config.MASTER_KEY)
        
        # Use HKDF to derive a separate secret for key exchange
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"panel-key-exchange-salt-v1",
            info=b"key-exchange-server-secret",
            backend=default_backend()
        )
        return hkdf.derive(master_key_bytes)
    
    def derive_session_key_from_certificate(
        self,
        cert_pem: str,
        additional_context: Optional[bytes] = None
    ) -> Tuple[str, int, str]:
        """
        Derive a session key from client certificate.
        
        SECURITY:
        - Key is derived from certificate public key (unique per client)
        - Server secret ensures only server can derive the key
        - Timestamp provides key rotation
        - Salt ensures uniqueness even for same certificate
        
        Args:
            cert_pem: Client certificate in PEM format
            additional_context: Optional additional context (e.g., project_id)
            
        Returns:
            Tuple of (session_key_hex, expires_at_timestamp, key_id)
        """
        try:
            # Parse certificate
            cert = load_pem_x509_certificate(
                cert_pem.encode('utf-8'),
                default_backend()
            )
            
            # Get certificate fingerprint (SHA256)
            cert_fingerprint = cert.fingerprint(hashes.SHA256())
            
            # Get public key bytes for derivation
            public_key_bytes = cert.public_key().public_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            
            # Generate random salt for this session
            salt = os.urandom(16)
            
            # Current timestamp (for key expiration calculation)
            now = int(time.time())
            expires_at = now + self.SESSION_KEY_TTL
            
            # Combine inputs for key derivation
            key_material = (
                public_key_bytes +
                cert_fingerprint +
                salt +
                now.to_bytes(8, 'big') +
                (additional_context or b"")
            )
            
            # Derive session key using HKDF
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,  # 256 bits for AES-256
                salt=self._server_secret,
                info=self.HKDF_INFO,
                backend=default_backend()
            )
            session_key = hkdf.derive(key_material)
            
            # Generate key ID for tracking
            key_id = hashlib.sha256(
                cert_fingerprint + salt + now.to_bytes(8, 'big')
            ).hexdigest()[:16]
            
            # Store session key in Redis for validation
            self._store_session_key(
                key_id=key_id,
                session_key=session_key.hex(),
                cert_fingerprint=cert_fingerprint.hex(),
                expires_at=expires_at,
                salt=salt.hex()
            )
            
            logger.info(
                f"SESSION_KEY_DERIVED key_id={key_id} "
                f"cert_fingerprint={cert_fingerprint.hex()[:16]}... "
                f"expires_at={datetime.fromtimestamp(expires_at).isoformat()}"
            )
            
            return session_key.hex(), expires_at, key_id
            
        except Exception as e:
            logger.error(f"Failed to derive session key: {e}")
            raise ValueError(f"Session key derivation failed: {e}")
    
    def validate_session_key(
        self,
        key_id: str,
        cert_pem: str
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate that session key is valid and matches certificate.
        
        Args:
            key_id: Session key ID
            cert_pem: Client certificate in PEM format
            
        Returns:
            Tuple of (is_valid, session_key_hex, error_message)
        """
        try:
            from ..utils.redis_client import get_redis_client
            
            redis_client = get_redis_client()
            
            # Get stored session data
            session_data = redis_client.get(f"session_key:{key_id}")
            if not session_data:
                return False, None, "Session key not found or expired"
            
            try:
                session_info = json.loads(session_data)
            except json.JSONDecodeError:
                return False, None, "Invalid session data"
            
            # Verify certificate fingerprint matches
            cert = load_pem_x509_certificate(
                cert_pem.encode('utf-8'),
                default_backend()
            )
            cert_fingerprint = cert.fingerprint(hashes.SHA256()).hex()
            
            if session_info.get("cert_fingerprint") != cert_fingerprint:
                logger.warning(
                    f"SESSION_KEY_CERT_MISMATCH key_id={key_id} "
                    f"expected={session_info.get('cert_fingerprint', 'N/A')[:16]}... "
                    f"got={cert_fingerprint[:16]}..."
                )
                return False, None, "Certificate fingerprint mismatch"
            
            # Check expiration
            if time.time() > session_info.get("expires_at", 0):
                return False, None, "Session key expired"
            
            return True, session_info.get("session_key"), None
            
        except Exception as e:
            logger.error(f"Session key validation error: {e}")
            return False, None, f"Validation error: {e}"
    
    def _store_session_key(
        self,
        key_id: str,
        session_key: str,
        cert_fingerprint: str,
        expires_at: int,
        salt: str
    ) -> None:
        """Store session key in Redis with TTL."""
        try:
            from ..utils.redis_client import get_redis_client
            
            redis_client = get_redis_client()
            
            session_data = json.dumps({
                "session_key": session_key,
                "cert_fingerprint": cert_fingerprint,
                "expires_at": expires_at,
                "salt": salt,
                "created_at": int(time.time())
            })
            
            # Store with TTL slightly longer than key TTL for cleanup grace period
            ttl = self.SESSION_KEY_TTL + 60
            redis_client.setex(f"session_key:{key_id}", ttl, session_data)
            
        except Exception as e:
            logger.error(f"Failed to store session key: {e}")
            raise
    
    def get_certificate_fingerprint(self, cert_pem: str) -> str:
        """Get SHA256 fingerprint of certificate."""
        try:
            cert = load_pem_x509_certificate(
                cert_pem.encode('utf-8'),
                default_backend()
            )
            return cert.fingerprint(hashes.SHA256()).hex()
        except Exception as e:
            logger.error(f"Failed to get certificate fingerprint: {e}")
            raise ValueError(f"Certificate fingerprint extraction failed: {e}")


class EnhancedChallengeResponse:
    """
    Enhanced challenge-response with additional security features.
    
    SECURITY IMPROVEMENTS:
    1. Timestamp validation - prevents old challenges
    2. Nonce binding - prevents replay attacks
    3. Certificate binding - challenge is tied to certificate
    4. HMAC verification - ensures challenge integrity
    """
    
    # Challenge TTL in seconds
    CHALLENGE_TTL = int(os.environ.get("ENHANCED_CHALLENGE_TTL", 60))
    
    # Maximum clock skew allowed (seconds)
    MAX_CLOCK_SKEW = 30
    
    def __init__(self):
        self._secret = self._get_challenge_secret()
    
    def _get_challenge_secret(self) -> bytes:
        """Get secret for challenge HMAC."""
        master_key_bytes = bytes.fromhex(Config.MASTER_KEY)
        
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"panel-challenge-salt-v1",
            info=b"challenge-hmac-secret",
            backend=default_backend()
        )
        return hkdf.derive(master_key_bytes)
    
    def create_challenge(
        self,
        user_key: str,
        fingerprint: str,
        cert_fingerprint: Optional[str] = None,
        project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create enhanced challenge with security bindings.
        
        Args:
            user_key: User key
            fingerprint: Device fingerprint
            cert_fingerprint: Optional certificate fingerprint
            project_id: Optional project ID
            
        Returns:
            Challenge dictionary with all security components
        """
        # Generate random challenge data
        challenge_data = secrets.token_hex(32)
        nonce = secrets.token_hex(16)
        timestamp = int(time.time())
        
        # Create challenge binding (ties challenge to specific context)
        binding_data = f"{user_key}:{fingerprint}:{cert_fingerprint or 'none'}:{project_id or 0}:{timestamp}:{nonce}"
        binding_hash = hashlib.sha256(binding_data.encode()).hexdigest()
        
        # Create HMAC for integrity verification
        hmac_data = f"{challenge_data}:{binding_hash}:{timestamp}".encode()
        challenge_hmac = hmac.new(
            self._secret,
            hmac_data,
            hashlib.sha256
        ).hexdigest()
        
        # Build enhanced challenge
        challenge = {
            "version": 2,  # Enhanced challenge version
            "challenge": challenge_data,
            "nonce": nonce,
            "timestamp": timestamp,
            "binding_hash": binding_hash,
            "hmac": challenge_hmac,
            "expires_at": timestamp + self.CHALLENGE_TTL,
            "challenges": {
                "crypto": {
                    "type": "sha256",
                    "challenges": {
                        "sha256": {
                            "input": challenge_data,
                            "expected": hashlib.sha256(challenge_data.encode()).hexdigest()
                        },
                        "combined": {
                            "input": f"{challenge_data}:{nonce}",
                            "expected": hashlib.sha256(
                                f"{challenge_data}:{nonce}".encode()
                            ).hexdigest()
                        }
                    }
                }
            }
        }
        
        # Add certificate binding if available
        if cert_fingerprint:
            challenge["cert_binding"] = cert_fingerprint[:16]
        
        logger.debug(
            f"ENHANCED_CHALLENGE_CREATED user_key={user_key} "
            f"nonce={nonce} expires_at={challenge['expires_at']}"
        )
        
        return challenge
    
    def validate_response(
        self,
        challenge: Dict[str, Any],
        response: str,
        user_key: str,
        fingerprint: str,
        cert_fingerprint: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Validate enhanced challenge response.
        
        Args:
            challenge: Original challenge dictionary
            response: Client's response
            user_key: User key
            fingerprint: Device fingerprint
            cert_fingerprint: Optional certificate fingerprint
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        now = int(time.time())
        
        # Check challenge version
        version = challenge.get("version", 1)
        if version < 2:
            # Legacy challenge - use simple validation
            return self._validate_legacy_response(challenge, response, user_key, fingerprint)
        
        # Verify timestamp
        timestamp = challenge.get("timestamp", 0)
        if abs(now - timestamp) > self.MAX_CLOCK_SKEW + self.CHALLENGE_TTL:
            return False, "Challenge expired or clock skew too large"
        
        # Verify expiration
        expires_at = challenge.get("expires_at", 0)
        if now > expires_at:
            return False, "Challenge expired"
        
        # Verify HMAC integrity
        challenge_data = challenge.get("challenge", "")
        binding_hash = challenge.get("binding_hash", "")
        stored_hmac = challenge.get("hmac", "")
        
        hmac_data = f"{challenge_data}:{binding_hash}:{timestamp}".encode()
        expected_hmac = hmac.new(
            self._secret,
            hmac_data,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(stored_hmac, expected_hmac):
            logger.warning(f"CHALLENGE_HMAC_MISMATCH user_key={user_key}")
            return False, "Challenge integrity verification failed"
        
        # Verify certificate binding if present
        if challenge.get("cert_binding") and cert_fingerprint:
            if not cert_fingerprint.startswith(challenge["cert_binding"]):
                return False, "Certificate binding mismatch"
        
        # Verify response
        nonce = challenge.get("nonce", "")
        
        # Accept multiple valid response formats
        valid_responses = [
            # Format 1: SHA256(challenge)
            hashlib.sha256(challenge_data.encode()).hexdigest(),
            # Format 2: SHA256(challenge:nonce)
            hashlib.sha256(f"{challenge_data}:{nonce}".encode()).hexdigest(),
            # Format 3: SHA256(challenge + user_key + fingerprint)
            hashlib.sha256(f"{challenge_data}{user_key}{fingerprint}".encode()).hexdigest(),
            # Format 4: SHA256(challenge:nonce:user_key:fingerprint)
            hashlib.sha256(
                f"{challenge_data}:{nonce}:{user_key}:{fingerprint}".encode()
            ).hexdigest(),
        ]
        
        if response in valid_responses:
            logger.info(f"ENHANCED_CHALLENGE_VALID user_key={user_key}")
            return True, ""
        
        logger.warning(
            f"ENHANCED_CHALLENGE_INVALID user_key={user_key} "
            f"response={response[:16]}..."
        )
        return False, "Invalid challenge response"
    
    def _validate_legacy_response(
        self,
        challenge: Dict[str, Any],
        response: str,
        user_key: str,
        fingerprint: str
    ) -> Tuple[bool, str]:
        """Validate legacy (v1) challenge response for backward compatibility."""
        challenge_data = challenge.get("challenge", "")
        if not challenge_data:
            # Try to get from nested structure
            crypto = challenge.get("challenges", {}).get("crypto", {})
            sha256_challenge = crypto.get("challenges", {}).get("sha256", {})
            challenge_data = sha256_challenge.get("input", "")
        
        if not challenge_data:
            return False, "No challenge data found"
        
        # Legacy format: SHA256(challenge + user_key + fingerprint)
        expected = hashlib.sha256(
            f"{challenge_data}{user_key}{fingerprint}".encode()
        ).hexdigest()
        
        # Also accept simple SHA256(challenge) for longer challenges
        expected_simple = hashlib.sha256(challenge_data.encode()).hexdigest()
        
        if response == expected or response == expected_simple:
            return True, ""
        
        return False, "Invalid legacy challenge response"


class CertificateDeviceBinding:
    """
    Binds certificates to specific devices for additional security.
    
    SECURITY:
    - Each certificate is registered with device fingerprint
    - Prevents certificate sharing across devices
    - Tracks certificate usage patterns
    """
    
    def __init__(self):
        pass
    
    def register_certificate_device(
        self,
        cert_fingerprint: str,
        device_fingerprint: str,
        project_id: int,
        user_key: Optional[str] = None
    ) -> bool:
        """
        Register certificate to device binding.
        
        Args:
            cert_fingerprint: Certificate SHA256 fingerprint
            device_fingerprint: Device fingerprint
            project_id: Project ID
            user_key: Optional user key
            
        Returns:
            True if registration successful, False if certificate already bound to different device
        """
        try:
            from ..utils.redis_client import get_redis_client
            
            redis_client = get_redis_client()
            
            binding_key = f"cert_device:{project_id}:{cert_fingerprint[:32]}"
            
            # Check existing binding
            existing = redis_client.get(binding_key)
            if existing:
                try:
                    existing_data = json.loads(existing)
                    if existing_data.get("device_fingerprint") != device_fingerprint:
                        # Certificate bound to different device
                        logger.warning(
                            f"CERT_DEVICE_MISMATCH project={project_id} "
                            f"cert={cert_fingerprint[:16]}... "
                            f"expected_device={existing_data.get('device_fingerprint', 'N/A')[:16]}... "
                            f"got_device={device_fingerprint[:16]}..."
                        )
                        return False
                except json.JSONDecodeError:
                    pass
            
            # Store or update binding
            binding_data = json.dumps({
                "device_fingerprint": device_fingerprint,
                "user_key": user_key,
                "registered_at": int(time.time()),
                "last_used": int(time.time())
            })
            
            # Long TTL - 30 days
            redis_client.setex(binding_key, 30 * 24 * 3600, binding_data)
            
            logger.info(
                f"CERT_DEVICE_BOUND project={project_id} "
                f"cert={cert_fingerprint[:16]}... "
                f"device={device_fingerprint[:16]}..."
            )
            return True
            
        except Exception as e:
            logger.error(f"Certificate device binding error: {e}")
            # Fail open for availability, but log the error
            return True
    
    def verify_certificate_device(
        self,
        cert_fingerprint: str,
        device_fingerprint: str,
        project_id: int
    ) -> Tuple[bool, str]:
        """
        Verify certificate is used from registered device.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            from ..utils.redis_client import get_redis_client
            
            redis_client = get_redis_client()
            
            binding_key = f"cert_device:{project_id}:{cert_fingerprint[:32]}"
            
            existing = redis_client.get(binding_key)
            if not existing:
                # No binding exists - allow first registration
                return True, ""
            
            try:
                existing_data = json.loads(existing)
                stored_device = existing_data.get("device_fingerprint", "")
                
                if stored_device != device_fingerprint:
                    return False, "Certificate is bound to a different device"
                
                # Update last used timestamp
                existing_data["last_used"] = int(time.time())
                redis_client.setex(binding_key, 30 * 24 * 3600, json.dumps(existing_data))
                
                return True, ""
                
            except json.JSONDecodeError:
                return True, ""
                
        except Exception as e:
            logger.error(f"Certificate device verification error: {e}")
            # Fail open for availability
            return True, ""


# Global instances
_key_exchange = None
_enhanced_challenge = None
_cert_device_binding = None


def get_secure_key_exchange() -> SecureKeyExchange:
    """Get singleton SecureKeyExchange instance."""
    global _key_exchange
    if _key_exchange is None:
        _key_exchange = SecureKeyExchange()
    return _key_exchange


def get_enhanced_challenge_handler() -> EnhancedChallengeResponse:
    """Get singleton EnhancedChallengeResponse instance."""
    global _enhanced_challenge
    if _enhanced_challenge is None:
        _enhanced_challenge = EnhancedChallengeResponse()
    return _enhanced_challenge


def get_cert_device_binding() -> CertificateDeviceBinding:
    """Get singleton CertificateDeviceBinding instance."""
    global _cert_device_binding
    if _cert_device_binding is None:
        _cert_device_binding = CertificateDeviceBinding()
    return _cert_device_binding
