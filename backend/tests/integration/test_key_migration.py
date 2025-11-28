"""
Integration tests for key migration to Envelope Encryption

Tests the migration of existing plain keys to encrypted format.
"""
import os
import secrets
import pytest
from sqlalchemy import text

from backend.models.core import ProjectEncryptionKeys, Project
from backend.utils.envelope_encryption import EnvelopeKeyManager


@pytest.mark.integration
@pytest.mark.security
@pytest.mark.slow
class TestKeyMigration:
    """Tests for key migration to Envelope Encryption"""
    
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
    
    def test_migrate_plain_key_to_encrypted(self, db_session):
        """Test migrating a plain key to encrypted format"""
        # Create a project
        project = Project(name="Migration Test", unique_id="migtest1")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with plain key only
        plain_key = secrets.token_hex(32)
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=plain_key,
            public_key_cert="test_cert",
            private_key_encrypted="test_private"
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Verify plain key exists
        assert encryption_keys.aes_key == plain_key
        assert encryption_keys.aes_key_encrypted is None
        
        # Migrate: encrypt the key
        key_bytes = bytes.fromhex(plain_key)
        encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
        encryption_keys.aes_key_encrypted = encrypted_key
        db_session.commit()
        
        # Verify encrypted key was set
        assert encryption_keys.aes_key_encrypted is not None
        assert encryption_keys.aes_key_encrypted != plain_key
        
        # Verify we can still retrieve the key
        retrieved_key = encryption_keys.get_aes_key()
        assert retrieved_key == plain_key
    
    def test_migration_preserves_functionality(self, db_session):
        """Test that migration preserves key functionality"""
        # Create a project
        project = Project(name="Migration Test 2", unique_id="migtest2")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with plain key
        plain_key = secrets.token_hex(32)
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=plain_key,
            public_key_cert="test_cert",
            private_key_encrypted="test_private"
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Get key before migration (should work)
        key_before = encryption_keys.get_aes_key()
        assert key_before == plain_key
        
        # Migrate
        key_bytes = bytes.fromhex(plain_key)
        encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
        encryption_keys.aes_key_encrypted = encrypted_key
        db_session.commit()
        
        # Get key after migration (should still work)
        key_after = encryption_keys.get_aes_key()
        assert key_after == plain_key
        assert key_after == key_before
    
    def test_migration_multiple_keys(self, db_session):
        """Test migrating multiple keys"""
        # Create multiple projects
        projects = []
        for i in range(3):
            project = Project(name=f"Migration Test {i+1}", unique_id=f"migtest{i+1}")
            db_session.add(project)
            projects.append(project)
        db_session.commit()
        
        # Create encryption keys for each project
        keys_data = []
        for project in projects:
            plain_key = secrets.token_hex(32)
            encryption_keys = ProjectEncryptionKeys(
                project_id=project.id,
                aes_key=plain_key,
                public_key_cert="test_cert",
                private_key_encrypted="test_private"
            )
            db_session.add(encryption_keys)
            keys_data.append((encryption_keys, plain_key))
        db_session.commit()
        
        # Migrate all keys
        for encryption_keys, plain_key in keys_data:
            key_bytes = bytes.fromhex(plain_key)
            encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
            encryption_keys.aes_key_encrypted = encrypted_key
        db_session.commit()
        
        # Verify all keys still work
        for encryption_keys, plain_key in keys_data:
            retrieved_key = encryption_keys.get_aes_key()
            assert retrieved_key == plain_key
    
    def test_migration_encrypted_takes_precedence(self, db_session):
        """Test that after migration, encrypted key takes precedence"""
        # Create a project
        project = Project(name="Migration Test 3", unique_id="migtest3")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with plain key
        plain_key = secrets.token_hex(32)
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=plain_key,
            public_key_cert="test_cert",
            private_key_encrypted="test_private"
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Migrate
        key_bytes = bytes.fromhex(plain_key)
        encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
        encryption_keys.aes_key_encrypted = encrypted_key
        db_session.commit()
        
        # Change plain key (should not affect retrieval)
        encryption_keys.aes_key = secrets.token_hex(32)
        db_session.commit()
        
        # Should still use encrypted key
        retrieved_key = encryption_keys.get_aes_key()
        assert retrieved_key == plain_key  # Original key, not the new plain key
    
    def test_migration_handles_invalid_keys(self, db_session):
        """Test that migration handles invalid keys gracefully"""
        # Create a project
        project = Project(name="Migration Test 4", unique_id="migtest4")
        db_session.add(project)
        db_session.commit()
        
        # Create encryption keys with invalid plain key
        invalid_key = "not_a_valid_hex_key"
        encryption_keys = ProjectEncryptionKeys(
            project_id=project.id,
            aes_key=invalid_key,
            public_key_cert="test_cert",
            private_key_encrypted="test_private"
        )
        db_session.add(encryption_keys)
        db_session.commit()
        
        # Try to migrate (should handle gracefully)
        try:
            # Try to convert to bytes (might fail)
            key_bytes = bytes.fromhex(invalid_key)
            encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
            encryption_keys.aes_key_encrypted = encrypted_key
            db_session.commit()
        except ValueError:
            # Expected - invalid key format
            pass
        
        # Should still be able to get key (using plain fallback)
        retrieved_key = encryption_keys.get_aes_key()
        assert retrieved_key == invalid_key

