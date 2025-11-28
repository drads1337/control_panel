"""
Unit tests for Envelope Encryption (DEK/KEK pattern)

Tests the EnvelopeKeyManager functionality without database dependencies.
"""
import os
import secrets
import pytest
from unittest.mock import patch, MagicMock

from backend.utils.envelope_encryption import EnvelopeKeyManager


@pytest.mark.unit
@pytest.mark.security
class TestEnvelopeKeyManager:
    """Tests for EnvelopeKeyManager"""
    
    @pytest.fixture(autouse=True)
    def setup_env(self):
        """Setup test environment with valid PROJECT_MASTER_KEY"""
        # Generate a valid 64-character hex key (32 bytes)
        test_key = secrets.token_hex(32)
        os.environ['PROJECT_MASTER_KEY'] = test_key
        
        # Clear cache to ensure fresh state
        EnvelopeKeyManager._kek = None
        EnvelopeKeyManager._fernet = None
        
        yield
        
        # Cleanup
        if 'PROJECT_MASTER_KEY' in os.environ:
            del os.environ['PROJECT_MASTER_KEY']
        EnvelopeKeyManager._kek = None
        EnvelopeKeyManager._fernet = None
    
    def test_get_kek_from_env_valid(self):
        """Test getting KEK from environment with valid key"""
        kek = EnvelopeKeyManager._get_kek_from_env()
        assert kek is not None
        assert len(kek) == 32  # 32 bytes = 256 bits
        assert isinstance(kek, bytes)
    
    def test_get_kek_from_env_missing(self):
        """Test getting KEK when PROJECT_MASTER_KEY is not set"""
        del os.environ['PROJECT_MASTER_KEY']
        EnvelopeKeyManager._kek = None
        
        with pytest.raises(ValueError, match="PROJECT_MASTER_KEY environment variable is required"):
            EnvelopeKeyManager._get_kek_from_env()
    
    def test_get_kek_from_env_invalid_length(self):
        """Test getting KEK with invalid length"""
        os.environ['PROJECT_MASTER_KEY'] = 'short_key'
        EnvelopeKeyManager._kek = None
        
        with pytest.raises(ValueError, match="must be 64 hex characters"):
            EnvelopeKeyManager._get_kek_from_env()
    
    def test_get_kek_from_env_invalid_format(self):
        """Test getting KEK with invalid hex format"""
        os.environ['PROJECT_MASTER_KEY'] = 'x' * 64  # Invalid hex
        EnvelopeKeyManager._kek = None
        
        with pytest.raises(ValueError, match="Invalid PROJECT_MASTER_KEY format"):
            EnvelopeKeyManager._get_kek_from_env()
    
    def test_get_kek_caching(self):
        """Test that KEK is cached after first retrieval"""
        kek1 = EnvelopeKeyManager._get_kek()
        kek2 = EnvelopeKeyManager._get_kek()
        
        assert kek1 == kek2
        assert EnvelopeKeyManager._kek is not None
    
    def test_encrypt_dek_valid(self):
        """Test encrypting a valid DEK"""
        # Generate a 32-byte DEK (AES-256 key)
        dek = secrets.token_bytes(32)
        
        encrypted = EnvelopeKeyManager.encrypt_dek(dek)
        
        assert encrypted is not None
        assert isinstance(encrypted, str)
        assert len(encrypted) > 0
        # Encrypted data should be different from original
        assert encrypted != dek.hex()
    
    def test_encrypt_dek_different_keys(self):
        """Test that encrypting different DEKs produces different results"""
        dek1 = secrets.token_bytes(32)
        dek2 = secrets.token_bytes(32)
        
        encrypted1 = EnvelopeKeyManager.encrypt_dek(dek1)
        encrypted2 = EnvelopeKeyManager.encrypt_dek(dek2)
        
        assert encrypted1 != encrypted2
    
    def test_decrypt_dek_valid(self):
        """Test decrypting a valid encrypted DEK"""
        # Generate a 32-byte DEK
        original_dek = secrets.token_bytes(32)
        
        # Encrypt
        encrypted = EnvelopeKeyManager.encrypt_dek(original_dek)
        
        # Decrypt
        decrypted = EnvelopeKeyManager.decrypt_dek(encrypted)
        
        assert decrypted == original_dek
    
    def test_decrypt_dek_round_trip(self):
        """Test encrypt/decrypt round trip with multiple keys"""
        for _ in range(5):
            original_dek = secrets.token_bytes(32)
            encrypted = EnvelopeKeyManager.encrypt_dek(original_dek)
            decrypted = EnvelopeKeyManager.decrypt_dek(encrypted)
            assert decrypted == original_dek
    
    def test_decrypt_dek_invalid(self):
        """Test decrypting invalid encrypted data"""
        invalid_encrypted = "not_a_valid_encrypted_string"
        
        with pytest.raises(Exception):  # Should raise some exception
            EnvelopeKeyManager.decrypt_dek(invalid_encrypted)
    
    def test_encrypt_dek_string_valid(self):
        """Test encrypting a DEK string (hex format)"""
        # Generate a 64-character hex string (32 bytes)
        dek_hex = secrets.token_hex(32)
        
        encrypted = EnvelopeKeyManager.encrypt_dek_string(dek_hex)
        
        assert encrypted is not None
        assert isinstance(encrypted, str)
        assert len(encrypted) > 0
    
    def test_encrypt_dek_string_invalid(self):
        """Test encrypting an invalid DEK string"""
        invalid_hex = "not_valid_hex"
        
        with pytest.raises(ValueError, match="Invalid DEK format"):
            EnvelopeKeyManager.encrypt_dek_string(invalid_hex)
    
    def test_decrypt_dek_string_valid(self):
        """Test decrypting an encrypted DEK string"""
        # Generate a 64-character hex string (32 bytes)
        original_hex = secrets.token_hex(32)
        
        # Encrypt
        encrypted = EnvelopeKeyManager.encrypt_dek_string(original_hex)
        
        # Decrypt
        decrypted_hex = EnvelopeKeyManager.decrypt_dek_string(encrypted)
        
        assert decrypted_hex == original_hex
    
    def test_validate_kek_set_valid(self):
        """Test validating KEK when it's properly set"""
        assert EnvelopeKeyManager.validate_kek_set() is True
    
    def test_validate_kek_set_missing(self):
        """Test validating KEK when it's not set"""
        del os.environ['PROJECT_MASTER_KEY']
        EnvelopeKeyManager._kek = None
        
        assert EnvelopeKeyManager.validate_kek_set() is False
    
    def test_validate_kek_set_invalid(self):
        """Test validating KEK when it's invalid"""
        os.environ['PROJECT_MASTER_KEY'] = 'invalid_key'
        EnvelopeKeyManager._kek = None
        
        assert EnvelopeKeyManager.validate_kek_set() is False
    
    def test_encrypt_dek_different_master_keys(self):
        """Test that different master keys produce different encrypted data"""
        dek = secrets.token_bytes(32)
        
        # Encrypt with first key
        encrypted1 = EnvelopeKeyManager.encrypt_dek(dek)
        
        # Change master key
        os.environ['PROJECT_MASTER_KEY'] = secrets.token_hex(32)
        EnvelopeKeyManager._kek = None
        EnvelopeKeyManager._fernet = None
        
        # Encrypt with second key
        encrypted2 = EnvelopeKeyManager.encrypt_dek(dek)
        
        # Should be different
        assert encrypted1 != encrypted2
        
        # Decrypting with wrong key should fail
        with pytest.raises(Exception):
            EnvelopeKeyManager.decrypt_dek(encrypted1)
    
    def test_encrypt_dek_various_sizes(self):
        """Test encrypting DEKs of various sizes"""
        for size in [16, 24, 32, 64]:
            dek = secrets.token_bytes(size)
            encrypted = EnvelopeKeyManager.encrypt_dek(dek)
            decrypted = EnvelopeKeyManager.decrypt_dek(encrypted)
            assert decrypted == dek
    
    def test_get_fernet_caching(self):
        """Test that Fernet instance is cached"""
        fernet1 = EnvelopeKeyManager._get_fernet()
        fernet2 = EnvelopeKeyManager._get_fernet()
        
        assert fernet1 is fernet2
        assert EnvelopeKeyManager._fernet is not None

