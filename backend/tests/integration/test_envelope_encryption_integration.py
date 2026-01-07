"""
Integration tests for Envelope Encryption with database

Tests the full integration of Envelope Encryption with ProjectEncryptionKeys model.
"""
import os
import secrets
import pytest
from flask import Flask

from backend.models.core import ProjectEncryptionKeys, Project
from backend.utils.envelope_encryption import EnvelopeKeyManager


@pytest.mark.integration
@pytest.mark.security
class TestEnvelopeEncryptionIntegration:
    """Integration tests for Envelope Encryption"""
    
    @pytest.fixture(autouse=True)
    def setup_env(self):
        """Setup test environment with valid PROJECT_MASTER_KEY"""
        test_key = secrets.token_hex(32)
        os.environ['PROJECT_MASTER_KEY'] = test_key
        
        # Clear cache
        EnvelopeKeyManager._kek = None
        EnvelopeKeyManager._fernet = None
        
        yield
        
        # Cleanup
        if 'PROJECT_MASTER_KEY' in os.environ:
            del os.environ['PROJECT_MASTER_KEY']
        EnvelopeKeyManager._kek = None
        EnvelopeKeyManager._fernet = None
    
    def test_project_encryption_keys_get_aes_key_encrypted(self, db_session):
        """Test getting AES key from encrypted format"""
        # Create a project
        project = Project(name="Test Project", unique_id="test123")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with encrypted key
        original_key_hex = secrets.token_hex(32)
        key_bytes = bytes.fromhex(original_key_hex)
        encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
        
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key_encrypted=encrypted_key,
            private_key_encrypted=""
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Get key using model method
        retrieved_key = encryption_keys.get_aes_key()
        
        assert retrieved_key == original_key_hex
    
    def test_project_encryption_keys_get_aes_key_plain_fallback(self, db_session):
        """Test getting AES key with plain key fallback"""
        # Create a project
        project = Project(name="Test Project 2", unique_id="test456")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with only plain key
        plain_key = secrets.token_hex(32)
        
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=plain_key,
            private_key_encrypted=""
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Get key using model method (should use plain key)
        retrieved_key = encryption_keys.get_aes_key()
        
        assert retrieved_key == plain_key
    
    def test_project_encryption_keys_set_aes_key(self, db_session):
        """Test setting AES key (encrypts automatically)"""
        # Create a project
        project = Project(name="Test Project 3", unique_id="test789")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            private_key_encrypted=""
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Set key using model method
        new_key = secrets.token_hex(32)
        encryption_keys.set_aes_key(new_key)
        db_session.commit()
        
        # Verify encrypted key was set
        assert encryption_keys.aes_key_encrypted is not None
        assert encryption_keys.aes_key_encrypted != new_key
        
        # Verify we can retrieve it
        retrieved_key = encryption_keys.get_aes_key()
        assert retrieved_key == new_key
    
    def test_project_encryption_keys_encrypted_takes_precedence(self, db_session):
        """Test that encrypted key takes precedence over plain key"""
        # Create a project
        project = Project(name="Test Project 4", unique_id="test101")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with both plain and encrypted
        plain_key = secrets.token_hex(32)
        encrypted_key_hex = secrets.token_hex(32)
        key_bytes = bytes.fromhex(encrypted_key_hex)
        encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
        
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=plain_key,
            aes_key_encrypted=encrypted_key,
            private_key_encrypted=""
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Get key (should use encrypted, not plain)
        retrieved_key = encryption_keys.get_aes_key()
        
        assert retrieved_key == encrypted_key_hex
        assert retrieved_key != plain_key
    
    def test_project_encryption_keys_migration_scenario(self, db_session):
        """Test migration scenario: plain key -> encrypted key"""
        # Create a project
        project = Project(name="Test Project 5", unique_id="test202")
        db_session.add(project)
        db_session.commit()
        
        # Start with plain key (legacy)
        plain_key = secrets.token_hex(32)
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=plain_key,
            private_key_encrypted=""
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Migrate to encrypted (simulate migration)
        key_bytes = bytes.fromhex(plain_key)
        encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
        encryption_keys.aes_key_encrypted = encrypted_key
        db_session.commit()
        
        # Verify both work
        retrieved_key = encryption_keys.get_aes_key()
        assert retrieved_key == plain_key
        
        # Now remove plain key (post-migration cleanup)
        encryption_keys.aes_key = None
        db_session.commit()
        
        # Should still work with encrypted only
        retrieved_key = encryption_keys.get_aes_key()
        assert retrieved_key == plain_key

