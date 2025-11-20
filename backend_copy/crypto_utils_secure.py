"""
SECURITY FIX: Secure cryptographic utilities using AES-256-GCM
Replaces dangerous custom crypto implementations with proven, secure methods.

This module provides secure alternatives to the dangerous custom cryptography
found in crypto_utils.py. All functions use industry-standard libraries and
follow security best practices.

CRITICAL SECURITY FIXES:
1. Uses AES-256-GCM (industry standard for authenticated encryption)
2. Provides both confidentiality and integrity
3. Uses proper key derivation with PBKDF2
4. All operations are authenticated and tamper-proof
5. Compatible with C++, Java, C# implementations
"""

import base64
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.x509 import CertificateBuilder, Name, NameAttribute, SubjectAlternativeName
from cryptography.x509.oid import NameOID

class SecureCryptoManager:
    """
    SECURITY FIX: Secure cryptographic operations manager.
    Replaces all dangerous custom crypto implementations.
    """

    @staticmethod
    def generate_secure_aes_key() -> str:
        """
        SECURITY FIX: Generate a secure 256-bit key for AES-256-GCM.
        Returns hex-encoded key (64 characters).
        """
        key = os.urandom(32)
        return key.hex()

    @staticmethod
    def generate_secure_rsa_key_pair() -> Tuple[str, str]:
        """
        SECURITY FIX: Generate RSA key pair using secure parameters.
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
        SECURITY FIX: Generate self-signed certificate with secure parameters.
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
        SECURITY FIX: Encrypt private key using AES-256-GCM.
        Replaces dangerous custom AES implementation.
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
        SECURITY FIX: Decrypt private key using AES-256-GCM.
        Replaces dangerous custom AES implementation.
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
    def encrypt_data_secure(data: str, aes_key_hex: str) -> str:
        """
        SECURITY FIX: Encrypt data using AES-256-GCM.
        Replaces dangerous custom AES implementation.
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
        SECURITY FIX: Decrypt data using AES-256-GCM.
        Replaces dangerous custom AES implementation.
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
    def sign_data_secure(data: str, encrypted_private_key: str, project_password: str) -> str:
        """
        SECURITY FIX: Sign data using RSA with secure padding.
        """
        try:
            private_key_pem = SecureCryptoManager.decrypt_private_key_secure(
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
        SECURITY FIX: Verify signature using RSA with secure padding.
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

def generate_project_keys_secure(project_name: str) -> Dict[str, Any]:
    """
    SECURITY FIX: Generate all encryption keys for a project using secure methods.
    Replaces dangerous custom implementations.
    """

    aes_key = SecureCryptoManager.generate_secure_aes_key()

    private_key_pem, public_key_pem = SecureCryptoManager.generate_secure_rsa_key_pair()

    certificate = SecureCryptoManager.generate_secure_self_signed_certificate(
        project_name, private_key_pem
    )

    project_password = f"{project_name}_{secrets.token_hex(16)}"

    encrypted_private_key = SecureCryptoManager.encrypt_private_key_secure(
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

def generate_aes_key():
    """
    DEPRECATED: Use SecureCryptoManager.generate_secure_aes_key() instead.
    This function is kept for backward compatibility but uses secure implementation.
    """
    logging.warning(
        "DEPRECATED: generate_aes_key() is deprecated. Use SecureCryptoManager.generate_secure_aes_key()"
    )
    return SecureCryptoManager.generate_secure_aes_key()

def generate_rsa_key_pair():
    """
    DEPRECATED: Use SecureCryptoManager.generate_secure_rsa_key_pair() instead.
    This function is kept for backward compatibility but uses secure implementation.
    """
    logging.warning(
        "DEPRECATED: generate_rsa_key_pair() is deprecated. Use SecureCryptoManager.generate_secure_rsa_key_pair()"
    )
    return SecureCryptoManager.generate_secure_rsa_key_pair()

def encrypt_data_with_project_aes(data, aes_key):
    """
    DEPRECATED: Use SecureCryptoManager.encrypt_data_secure() instead.
    This function is kept for backward compatibility but uses secure implementation.
    Key can be hex string (64 chars) or base64 encoded.
    """
    logging.warning(
        "DEPRECATED: encrypt_data_with_project_aes() is deprecated. Use SecureCryptoManager.encrypt_data_secure()"
    )
    return SecureCryptoManager.encrypt_data_secure(data, aes_key)

def decrypt_data_with_project_aes(encrypted_data_b64, aes_key):
    """
    DEPRECATED: Use SecureCryptoManager.decrypt_data_secure() instead.
    This function is kept for backward compatibility but uses secure implementation.
    Key can be hex string (64 chars) or base64 encoded.
    """
    logging.warning(
        "DEPRECATED: decrypt_data_with_project_aes() is deprecated. Use SecureCryptoManager.decrypt_data_secure()"
    )
    return SecureCryptoManager.decrypt_data_secure(encrypted_data_b64, aes_key)

def generate_project_keys(project_name):
    """
    DEPRECATED: Use generate_project_keys_secure() instead.
    This function is kept for backward compatibility but uses secure implementation.
    """
    logging.warning(
        "DEPRECATED: generate_project_keys() is deprecated. Use generate_project_keys_secure()"
    )
    return generate_project_keys_secure(project_name)
