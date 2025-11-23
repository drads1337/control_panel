"""
SECURITY FIX: Secure cryptographic utilities using AES-256-GCM
Replaces custom crypto implementations with proven, secure methods.
AES-256-GCM is the industry standard for authenticated encryption,
providing both confidentiality and integrity.

This is the single source of truth for all cryptographic operations.
"""

import base64
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Tuple

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.x509 import CertificateBuilder, Name, NameAttribute, SubjectAlternativeName
from cryptography.x509.oid import NameOID

class SecureCrypto:
    """
    Secure cryptographic operations using AES-256-GCM.
    AES-256-GCM provides authenticated encryption (confidentiality + integrity).
    """

    @staticmethod
    def generate_key() -> bytes:
        """Generate a secure 32-byte (256-bit) key for AES-256-GCM encryption."""
        return os.urandom(32)

    @staticmethod
    def generate_secure_aes_key() -> str:
        """
        Generate a secure 256-bit key for AES-256-GCM.
        Returns hex-encoded key (64 characters).
        """
        key = os.urandom(32)
        return key.hex()

    @staticmethod
    def generate_secure_rsa_key_pair() -> Tuple[str, str]:
        """
        Generate RSA key pair using secure parameters.
        Returns (private_key_pem, public_key_pem).
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        public_key = private_key.public_key()

        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        return private_pem.decode("utf-8"), public_pem.decode("utf-8")

    @staticmethod
    def generate_secure_self_signed_certificate(project_name: str, private_key_pem: str) -> str:
        """
        Generate self-signed certificate with secure parameters.
        """
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"), password=None, backend=default_backend()
        )

        subject = issuer = Name(
            [
                NameAttribute(NameOID.COUNTRY_NAME, "US"),
                NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
                NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
                NameAttribute(NameOID.ORGANIZATION_NAME, project_name),
                NameAttribute(NameOID.COMMON_NAME, f"{project_name}.com"),
            ]
        )

        cert_builder = CertificateBuilder()
        cert_builder = cert_builder.subject_name(subject)
        cert_builder = cert_builder.issuer_name(issuer)
        cert_builder = cert_builder.public_key(private_key.public_key())
        cert_builder = cert_builder.serial_number(secrets.randbelow(2**64))
        cert_builder = cert_builder.not_valid_before(datetime.utcnow())
        cert_builder = cert_builder.not_valid_after(
            datetime.utcnow() + timedelta(days=365 * 2)
        )

        from cryptography.x509.general_name import DNSName

        cert_builder = cert_builder.add_extension(
            SubjectAlternativeName(
                [
                    DNSName(f"{project_name}.com"),
                    DNSName(f"*.{project_name}.com"),
                ]
            ),
            critical=False,
        )

        certificate = cert_builder.sign(
            private_key=private_key, algorithm=hashes.SHA256(), backend=default_backend()
        )

        return certificate.public_bytes(serialization.Encoding.PEM).decode("utf-8")

    @staticmethod
    def encrypt_private_key_secure(private_key_pem: str, project_password: str) -> str:
        """
        Encrypt private key using AES-256-GCM.
        """
        salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend(),
        )
        key = kdf.derive(project_password.encode("utf-8"))

        iv = os.urandom(12)
        cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        encrypted_data = encryptor.update(private_key_pem.encode("utf-8")) + encryptor.finalize()
        tag = encryptor.tag

        combined = salt + iv + encrypted_data + tag
        return base64.b64encode(combined).decode("utf-8")

    @staticmethod
    def decrypt_private_key_secure(encrypted_private_key: str, project_password: str) -> str:
        """
        Decrypt private key using AES-256-GCM.
        """
        try:
            combined = base64.b64decode(encrypted_private_key)

            if len(combined) < 44:
                raise ValueError("Encrypted private key too short")

            salt = combined[:16]
            iv = combined[16:28]
            tag = combined[-16:]
            encrypted_data = combined[28:-16]

            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
                backend=default_backend(),
            )
            key = kdf.derive(project_password.encode("utf-8"))

            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted_data = decryptor.update(encrypted_data) + decryptor.finalize()

            return decrypted_data.decode("utf-8")

        except Exception as e:
            raise ValueError(f"Failed to decrypt private key: {str(e)}")

    @staticmethod
    def sign_data_secure(data: str, encrypted_private_key: str, project_password: str) -> str:
        """
        Sign data using RSA with secure padding.
        """
        try:
            private_key_pem = SecureCrypto.decrypt_private_key_secure(
                encrypted_private_key, project_password
            )

            private_key = serialization.load_pem_private_key(
                private_key_pem.encode("utf-8"), password=None, backend=default_backend()
            )

            if isinstance(data, str):
                data = data.encode("utf-8")

            signature = private_key.sign(
                data,
                padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
                hashes.SHA256(),
            )

            return base64.b64encode(signature).decode("utf-8")

        except Exception as e:
            raise ValueError(f"Failed to sign data: {str(e)}")

    @staticmethod
    def verify_signature_secure(data: str, signature_b64: str, public_key_cert: str) -> bool:
        """
        Verify signature using RSA with secure padding.
        """
        try:
            certificate = serialization.load_pem_x509_certificate(
                public_key_cert.encode("utf-8"), backend=default_backend()
            )

            public_key = certificate.public_key()
            signature = base64.b64decode(signature_b64)

            if isinstance(data, str):
                data = data.encode("utf-8")

            public_key.verify(
                signature,
                data,
                padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
                hashes.SHA256(),
            )

            return True

        except Exception as e:
            logging.warning(f"Signature verification failed: {str(e)}")
            return False

    @staticmethod
    def encrypt_data_secure(data: str, aes_key_hex: str) -> str:
        """
        Encrypt data using AES-256-GCM.
        Key should be a hex string (64 characters for 32 bytes).
        """
        try:
            if len(aes_key_hex) == 64:
                key = bytes.fromhex(aes_key_hex)
            else:
                key = base64.b64decode(aes_key_hex)

            if len(key) != 32:
                raise ValueError(
                    f"Key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
                )

            if isinstance(data, str):
                data = data.encode("utf-8")
            elif not isinstance(data, bytes):
                data = json.dumps(data).encode("utf-8")

            iv = os.urandom(12)
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
            encryptor = cipher.encryptor()

            encrypted = encryptor.update(data) + encryptor.finalize()
            tag = encryptor.tag

            combined = iv + encrypted + tag
            return base64.b64encode(combined).decode("utf-8")

        except Exception as e:
            raise ValueError(f"Encryption failed: {str(e)}")

    @staticmethod
    def decrypt_data_secure(encrypted_data_b64: str, aes_key_hex: str) -> str:
        """
        Decrypt data using AES-256-GCM.
        Key should be a hex string (64 characters for 32 bytes).
        """
        try:
            if len(aes_key_hex) == 64:
                key = bytes.fromhex(aes_key_hex)
            else:
                key = base64.b64decode(aes_key_hex)

            if len(key) != 32:
                raise ValueError(
                    f"Key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
                )

            combined = base64.b64decode(encrypted_data_b64)

            if len(combined) < 28:
                raise ValueError(f"Encrypted data too short: {len(combined)} bytes (minimum 28)")

            iv = combined[:12]
            tag = combined[-16:]
            ciphertext = combined[12:-16]

            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(ciphertext) + decryptor.finalize()

            return decrypted.decode("utf-8")

        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")

    @staticmethod
    def derive_key_from_password(password: str, salt: bytes = None) -> bytes:
        """
        Derive a key from a password using PBKDF2.
        Returns 32 bytes (256 bits) for AES-256.
        """
        if salt is None:
            salt = os.urandom(16)

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend(),
        )
        return kdf.derive(password.encode("utf-8"))

    @staticmethod
    def encrypt_data(data: str, key: bytes) -> str:
        """
        Encrypt data using AES-256-GCM.
        Format: IV (12 bytes) + ciphertext + tag (16 bytes), base64 encoded.
        Returns base64-encoded encrypted data.
        """
        try:
            if isinstance(data, str):
                data = data.encode("utf-8")
            elif not isinstance(data, bytes):
                data = json.dumps(data).encode("utf-8")

            if len(key) != 32:
                raise ValueError(
                    f"Key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
                )

            iv = os.urandom(12)

            cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
            encryptor = cipher.encryptor()

            ciphertext = encryptor.update(data) + encryptor.finalize()

            tag = encryptor.tag

            combined = iv + ciphertext + tag

            return base64.b64encode(combined).decode("utf-8")

        except Exception as e:
            raise ValueError(f"Encryption failed: {str(e)}")

    @staticmethod
    def decrypt_data(encrypted_data: str, key: bytes) -> str:
        """
        Decrypt data using AES-256-GCM.
        Format: IV (12 bytes) + ciphertext + tag (16 bytes), base64 encoded.
        Returns decrypted string.
        """
        try:

            if len(key) != 32:
                raise ValueError(
                    f"Key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
                )

            combined = base64.b64decode(encrypted_data.encode("utf-8"))

            if len(combined) < 28:
                raise ValueError(f"Encrypted data too short: {len(combined)} bytes (minimum 28)")

            iv = combined[:12]
            tag = combined[-16:]
            ciphertext = combined[12:-16]

            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            decryptor = cipher.decryptor()

            plaintext = decryptor.update(ciphertext) + decryptor.finalize()

            return plaintext.decode("utf-8")

        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")

    @staticmethod
    def encrypt_json_data(data: dict, key: bytes) -> str:
        """
        Encrypt JSON data.
        Returns base64-encoded encrypted JSON.
        """
        json_str = json.dumps(data, separators=(",", ":"))
        return SecureCrypto.encrypt_data(json_str, key)

    @staticmethod
    def decrypt_json_data(encrypted_data: str, key: bytes) -> dict:
        """
        Decrypt JSON data.
        Returns parsed JSON dictionary.
        """
        json_str = SecureCrypto.decrypt_data(encrypted_data, key)
        return json.loads(json_str)

class MasterKeyManager:
    """
    Manages the master key for system-wide encryption.
    SECURITY FIX: Uses proper key derivation and validation.
    """

    @staticmethod
    def validate_master_key(master_key: str) -> bool:
        """
        Validate that master key is properly formatted.
        Must be 64 hex characters (32 bytes).
        """
        if not master_key:
            return False

        if len(master_key) != 64:
            return False

        try:
            bytes.fromhex(master_key)
            return True
        except ValueError:
            return False

    @staticmethod
    def hex_to_aes_key(hex_key: str) -> bytes:
        """
        Convert hex master key to AES-256 key bytes.
        Returns 32 bytes for AES-256.
        """
        if not MasterKeyManager.validate_master_key(hex_key):
            raise ValueError("Invalid master key format")

        return bytes.fromhex(hex_key)

    @staticmethod
    def encrypt_with_master_key(data: str, master_key: str) -> str:
        """
        Encrypt data using master key with AES-256-GCM.
        Master key is expected to be a 64-character hex string (32 bytes).
        """
        if not MasterKeyManager.validate_master_key(master_key):
            raise ValueError("Invalid master key format")

        key_bytes = bytes.fromhex(master_key)
        return SecureCrypto.encrypt_data(data, key_bytes)

    @staticmethod
    def encrypt_with_master_key_legacy(data: str, master_key: str) -> str:
        """
        Encrypt data using master key with AES-256-GCM format.
        Format: IV (12 bytes) + ciphertext + tag (16 bytes), base64 encoded.
        """
        import logging
        import os

        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

        try:
            logging.info("[ENCRYPT_GCM] Starting encryption")
            logging.info(f"[ENCRYPT_GCM] Data length: {len(data)}")

            logging.info(f"[ENCRYPT_GCM] Master key length: {len(master_key)}")
            logging.info(f"[ENCRYPT_GCM] Master key prefix (masked): {master_key[:8]}...")

            key_bytes = bytes.fromhex(master_key)
            logging.info(f"[ENCRYPT_GCM] Key bytes length: {len(key_bytes)}")

            iv = os.urandom(12)

            cipher = Cipher(algorithms.AES(key_bytes), modes.GCM(iv), backend=default_backend())
            encryptor = cipher.encryptor()

            if isinstance(data, str):
                data_bytes = data.encode("utf-8")
            else:
                data_bytes = data

            ciphertext = encryptor.update(data_bytes) + encryptor.finalize()

            tag = encryptor.tag

            combined = iv + ciphertext + tag

            encrypted_result = base64.b64encode(combined).decode("utf-8")
            logging.info(
                f"[ENCRYPT_GCM] Encryption successful, encrypted length: {len(encrypted_result)}"
            )
            logging.info(f"[ENCRYPT_GCM] Encrypted preview: {encrypted_result[:100]}...")
            return encrypted_result

        except Exception as e:
            logging.error(f"[ENCRYPT_GCM] Encryption failed: {type(e).__name__}: {str(e)}")
            logging.error(f"[ENCRYPT_GCM] Error details: {repr(e)}")
            import traceback

            logging.error(f"[ENCRYPT_GCM] Full traceback: {traceback.format_exc()}")
            raise ValueError(f"AES-256-GCM encryption failed: {str(e)}")

    @staticmethod
    def decrypt_with_master_key_legacy(encrypted_data: str, master_key: str) -> str:
        """
        Decrypt data using master key with AES-256-GCM format.
        Format: IV (12 bytes) + ciphertext + tag (16 bytes), base64 encoded.
        Handles both regular and URL-safe base64 encoding.
        """
        import logging

        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

        try:
            logging.info("[DECRYPT_GCM] Starting decryption")
            logging.info(f"[DECRYPT_GCM] Encrypted data length: {len(encrypted_data)}")

            logging.info(f"[DECRYPT_GCM] Master key length: {len(master_key)}")
            logging.info(f"[DECRYPT_GCM] Master key prefix (masked): {master_key[:8]}...")

            key_bytes = bytes.fromhex(master_key)
            logging.info(f"[DECRYPT_GCM] Key bytes length: {len(key_bytes)}")
            logging.info(
                f"[DECRYPT_GCM] Key bytes prefix (hex): {key_bytes[:16].hex() if len(key_bytes) >= 16 else 'N/A'}"
            )
            logging.info(
                f"[DECRYPT_GCM] Key bytes suffix (hex): ...{key_bytes[-16:].hex() if len(key_bytes) >= 16 else 'N/A'}"
            )

            combined = None
            decode_errors = []
            try:

                combined = base64.b64decode(encrypted_data)
            except Exception as e1:
                decode_errors.append(f"Regular: {str(e1)}")
                try:

                    combined = base64.urlsafe_b64decode(encrypted_data)
                except Exception as e2:
                    decode_errors.append(f"URL-safe: {str(e2)}")

                    try:

                        missing_padding = len(encrypted_data) % 4
                        padded_data = (
                            encrypted_data + ("=" * (4 - missing_padding))
                            if missing_padding
                            else encrypted_data
                        )
                        combined = base64.b64decode(padded_data)
                    except Exception as e3:
                        decode_errors.append(f"Padded regular: {str(e3)}")

                        try:
                            missing_padding = len(encrypted_data) % 4
                            padded_data = (
                                encrypted_data + ("=" * (4 - missing_padding))
                                if missing_padding
                                else encrypted_data
                            )
                            combined = base64.urlsafe_b64decode(padded_data)
                        except Exception as e4:
                            decode_errors.append(f"Padded URL-safe: {str(e4)}")
                            logging.error(
                                f"[DECRYPT_GCM] All base64 decode attempts failed. Errors: {'; '.join(decode_errors)}"
                            )
                            raise ValueError(f"Invalid base64 encoding: {decode_errors[0]}")

            if combined is None:
                raise ValueError("Failed to decode base64 data")

            first_byte_str = f"0x{combined[0]:02x}" if len(combined) > 0 else "N/A"
            logging.debug(
                f"[DECRYPT_GCM] Decoded length: {len(combined)}, First byte: {first_byte_str}"
            )

            if len(combined) < 28:
                raise ValueError(f"Encrypted data too short: {len(combined)} bytes (minimum 28)")

            iv = combined[:12]
            tag = combined[-16:]
            ciphertext = combined[12:-16]

            logging.debug(
                f"[DECRYPT_GCM] IV size: {len(iv)}, Ciphertext size: {len(ciphertext)}, Tag size: {len(tag)}"
            )

            logging.info(
                f"[DECRYPT_GCM] Creating cipher with key length: {len(key_bytes)}, IV length: {len(iv)}, tag length: {len(tag)}"
            )
            cipher = Cipher(
                algorithms.AES(key_bytes), modes.GCM(iv, tag), backend=default_backend()
            )
            decryptor = cipher.decryptor()

            logging.info(
                f"[DECRYPT_GCM] Starting decryption of ciphertext (length: {len(ciphertext)})"
            )

            plaintext = decryptor.update(ciphertext) + decryptor.finalize()

            logging.info(f"[DECRYPT_GCM] Decryption successful, plaintext length: {len(plaintext)}")
            logging.info(
                f"[DECRYPT_GCM] Plaintext preview: {plaintext[:200].decode('utf-8', errors='ignore') if len(plaintext) > 0 else 'EMPTY'}..."
            )
            return plaintext.decode("utf-8")

        except Exception as e:

            logging.debug(f"[DECRYPT_GCM] Decryption failed: {type(e).__name__}: {str(e)}")
            raise ValueError(f"AES-256-GCM decryption failed: {str(e)}")

    @staticmethod
    def decrypt_with_master_key(encrypted_data: str, master_key: str) -> str:
        """
        Decrypt data using master key with AES-256-GCM.
        Master key is expected to be a 64-character hex string (32 bytes).
        """
        if not MasterKeyManager.validate_master_key(master_key):
            raise ValueError("Invalid master key format")

        key_bytes = bytes.fromhex(master_key)
        return SecureCrypto.decrypt_data(encrypted_data, key_bytes)

class ProjectCrypto:
    """
    Project-specific encryption using derived keys.
    SECURITY FIX: Each project has its own encryption key.
    """

    @staticmethod
    def generate_project_key() -> str:
        """Generate a new project encryption key (32 bytes for AES-256)."""
        key = SecureCrypto.generate_key()

        return key.hex()

    @staticmethod
    def encrypt_for_project(data: str, project_key: str) -> str:
        """Encrypt data for a specific project using AES-256-GCM."""

        try:

            if len(project_key) == 64:
                key = bytes.fromhex(project_key)
            else:

                key = base64.b64decode(project_key.encode("utf-8"))
        except (ValueError, base64.binascii.Error):
            raise ValueError("Invalid project key format")

        if len(key) != 32:
            raise ValueError(
                f"Project key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
            )

        return SecureCrypto.encrypt_data(data, key)

    @staticmethod
    def decrypt_for_project(encrypted_data: str, project_key: str) -> str:
        """Decrypt data for a specific project using AES-256-GCM."""

        try:

            if len(project_key) == 64:
                key = bytes.fromhex(project_key)
            else:

                key = base64.b64decode(project_key.encode("utf-8"))
        except (ValueError, base64.binascii.Error):
            raise ValueError("Invalid project key format")

        if len(key) != 32:
            raise ValueError(
                f"Project key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
            )

        return SecureCrypto.decrypt_data(encrypted_data, key)

    @staticmethod
    def encrypt_json_for_project(data: dict, project_key: str) -> str:
        """Encrypt JSON data for a specific project using AES-256-GCM."""
        key = ProjectCrypto._get_key_bytes(project_key)
        return SecureCrypto.encrypt_json_data(data, key)

    @staticmethod
    def decrypt_json_for_project(encrypted_data: str, project_key: str) -> dict:
        """Decrypt JSON data for a specific project using AES-256-GCM."""
        key = ProjectCrypto._get_key_bytes(project_key)
        return SecureCrypto.decrypt_json_data(encrypted_data, key)

    @staticmethod
    def _get_key_bytes(project_key: str) -> bytes:
        """Helper to convert project key string to bytes."""
        try:

            if len(project_key) == 64:
                key = bytes.fromhex(project_key)
            else:

                key = base64.b64decode(project_key.encode("utf-8"))
        except (ValueError, base64.binascii.Error):
            raise ValueError("Invalid project key format")

        if len(key) != 32:
            raise ValueError(
                f"Project key must be 32 bytes (256 bits) for AES-256, got {len(key)} bytes"
            )

        return key

def encrypt_data_with_project_key(data: dict, project_id: int, use_gcm: bool = True) -> str:
    """
    Encrypt data with project-specific key using project ID.
    Always uses AES-256-GCM (use_gcm parameter is kept for backward compatibility but ignored).
    First tries AES Key from ProjectEncryptionKeys (what clients use),
    then falls back to project_master_key from ProjectEncryptionSettings.
    """
    import logging

    from ..models.core import ProjectEncryptionKeys

    try:
        encryption_keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id).first()
        if encryption_keys and encryption_keys.aes_key:
            logging.info(
                f"[ENCRYPT_PROJECT] Using AES Key from ProjectEncryptionKeys for project {project_id}"
            )

            return MasterKeyManager.encrypt_with_master_key_legacy(
                json.dumps(data), encryption_keys.aes_key
            )
    except Exception as aes_key_error:
        logging.debug(
            f"[ENCRYPT_PROJECT] AES Key from ProjectEncryptionKeys failed: {type(aes_key_error).__name__}: {str(aes_key_error)[:100]}..."
        )

    from ..utils.project_settings_migration import ProjectSettingsHelper
    
    helper = ProjectSettingsHelper(project_id)
    encryption_settings = helper.get_encryption_settings()
    if not encryption_settings.project_master_key:
        raise ValueError(f"No encryption key found for project {project_id}")

    logging.info(
        f"[ENCRYPT_PROJECT] Using project_master_key from ProjectEncryptionSettings for project {project_id}"
    )

    return MasterKeyManager.encrypt_with_master_key_legacy(
        json.dumps(data), encryption_settings.project_master_key
    )

def decrypt_data_with_project_key(
    encrypted_data: str, project_id: int, use_gcm: bool = True
) -> dict:
    """
    Decrypt data with project-specific key using project ID.
    
    SECURITY: This function uses ONLY ONE key and ONE method to prevent timing attacks.
    Multiple key attempts or method fallbacks create timing attack vectors where an attacker
    can determine which key was used based on response time differences.
    
    Strategy:
    - Prefer AES Key from ProjectEncryptionKeys (primary key for clients)
    - If not available, use project_master_key from ProjectEncryptionSettings
    - Use only the standard decryption method (no legacy fallbacks)
    - Fail immediately if decryption fails (no multiple attempts)
    
    Args:
        encrypted_data: Base64-encoded encrypted data
        project_id: Project ID
        use_gcm: Ignored (kept for backward compatibility)
        
    Returns:
        Decrypted data as dictionary
        
    Raises:
        ValueError: If key is missing, invalid, or decryption fails
    """
    import logging

    from ..models.core import ProjectEncryptionKeys

    # SECURITY: Use only ONE key source to prevent timing attacks
    # Prefer AES Key from ProjectEncryptionKeys (what clients should use)
    encryption_keys = ProjectEncryptionKeys.query.filter_by(project_id=project_id).first()
    project_key = None
    key_source = None
    
    if encryption_keys and encryption_keys.aes_key:
        aes_key = encryption_keys.aes_key.strip()
        
        # Validate AES key format (must be 64 hex characters = 32 bytes)
        if len(aes_key) != 64:
            raise ValueError(
                f"Invalid AES key format for project {project_id}: "
                f"expected 64 hex characters, got {len(aes_key)}"
            )
        
        # Validate that it's valid hex
        try:
            key_bytes_test = bytes.fromhex(aes_key)
            if len(key_bytes_test) != 32:
                raise ValueError(
                    f"Invalid AES key format for project {project_id}: "
                    f"key must decode to 32 bytes"
                )
        except ValueError as hex_error:
            raise ValueError(
                f"Invalid AES key format for project {project_id}: {str(hex_error)}"
            )
        
        project_key = aes_key
        key_source = "ProjectEncryptionKeys.aes_key"
    else:
        # Fallback to project_master_key from ProjectEncryptionSettings
        from ..utils.project_settings_migration import ProjectSettingsHelper
        
        helper = ProjectSettingsHelper(project_id)
        encryption_settings = helper.get_encryption_settings()
        if not encryption_settings.project_master_key:
            raise ValueError(
                f"No encryption key found for project {project_id}. "
                f"Please configure Cryptographic Keys (AES Key) in project settings."
            )
        
        project_master_key = encryption_settings.project_master_key.strip()
        
        # Validate project_master_key format
        if len(project_master_key) != 64:
            raise ValueError(
                f"Invalid project_master_key format for project {project_id}: "
                f"expected 64 hex characters, got {len(project_master_key)}"
            )
        
        try:
            key_bytes_test = bytes.fromhex(project_master_key)
            if len(key_bytes_test) != 32:
                raise ValueError(
                    f"Invalid project_master_key format for project {project_id}: "
                    f"key must decode to 32 bytes"
                )
        except ValueError as hex_error:
            raise ValueError(
                f"Invalid project_master_key format for project {project_id}: {str(hex_error)}"
            )
        
        project_key = project_master_key
        key_source = "ProjectSettings.project_master_key"
    
    # SECURITY: Use only ONE decryption method to prevent timing attacks
    # Multiple method attempts create timing attack vectors
    logging.info(
        f"[DECRYPT_PROJECT] Decrypting with {key_source} for project {project_id}"
    )
    
    try:
        # Use standard decryption method only (no legacy fallbacks)
        json_str = MasterKeyManager.decrypt_with_master_key(encrypted_data, project_key)
        logging.debug(f"[DECRYPT_PROJECT] Successfully decrypted with {key_source} for project {project_id}")
        return json.loads(json_str)
    except Exception as decrypt_error:
        # SECURITY: Fail immediately with generic error message
        # Don't reveal which key was used or why it failed (prevents information leakage)
        error_type = type(decrypt_error).__name__
        logging.warning(
            f"[DECRYPT_PROJECT] Decryption failed for project {project_id} using {key_source}: "
            f"{error_type}"
        )
        raise ValueError(
            f"Decryption failed for project {project_id}. "
            f"Please ensure you are using the correct encryption key from project settings."
        ) from decrypt_error

def encrypt_with_master_key(data: str, master_key: str) -> str:
    """
    Backward compatibility wrapper.
    Uses AES-256-GCM encryption (industry standard).
    """
    return MasterKeyManager.encrypt_with_master_key(data, master_key)

def decrypt_with_master_key(encrypted_data: str, master_key: str) -> str:
    """
    Backward compatibility wrapper.
    Uses AES-256-GCM decryption (industry standard).
    """
    return MasterKeyManager.decrypt_with_master_key(encrypted_data, master_key)

def generate_project_keys_secure(project_name: str) -> Dict[str, Any]:
    """
    Generate all encryption keys for a project using secure methods.
    Returns dictionary with aes_key, public_key_cert, private_key_encrypted, project_password, and metadata.
    """
    aes_key = SecureCrypto.generate_secure_aes_key()

    private_key_pem, public_key_pem = SecureCrypto.generate_secure_rsa_key_pair()

    certificate = SecureCrypto.generate_secure_self_signed_certificate(
        project_name, private_key_pem
    )

    project_password = f"{project_name}_{secrets.token_hex(16)}"

    encrypted_private_key = SecureCrypto.encrypt_private_key_secure(
        private_key_pem, project_password
    )

    metadata = {
        "algorithm": "AES-256-GCM + RSA-2048",
        "aes_key_size": 256,
        "rsa_key_size": 2048,
        "certificate_validity_days": 730,
        "encryption_method": "AES-256-GCM with PBKDF2 key derivation",
        "generated_at": datetime.utcnow().isoformat(),
        "security_level": "high",
    }

    return {
        "aes_key": aes_key,
        "public_key_cert": certificate,
        "private_key_encrypted": encrypted_private_key,
        "project_password": project_password,
        "metadata": metadata,
    }

# Backward compatibility aliases
def encrypt_data(data: str, aes_key_hex: str) -> str:
    """
    Backward compatibility wrapper for encrypt_data_secure.
    """
    return SecureCrypto.encrypt_data_secure(data, aes_key_hex)
