"""Add Envelope Encryption support for project keys

Revision ID: add_envelope_encryption
Revises: 85667c704001
Create Date: 2025-01-XX XX:XX:XX

This migration adds support for Envelope Encryption (DEK/KEK pattern):
- Adds aes_key_encrypted column to store encrypted DEK
- Makes aes_key nullable (for backward compatibility during migration)
- Migrates existing plain keys to encrypted format if PROJECT_MASTER_KEY is set
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_envelope_encryption'
down_revision = '85667c704001'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add Envelope Encryption support.
    
    Steps:
    1. Add aes_key_encrypted column (nullable for backward compatibility)
    2. Make aes_key nullable (for gradual migration)
    3. Migrate existing keys to encrypted format if KEK is available
    """
    # Add encrypted key column
    op.add_column('project_encryption_keys', 
                  sa.Column('aes_key_encrypted', sa.Text(), nullable=True))
    
    # Make aes_key nullable (for backward compatibility during migration)
    # Note: This is safe because we keep existing keys during migration
    op.alter_column('project_encryption_keys', 'aes_key',
                    existing_type=sa.Text(),
                    nullable=True,
                    existing_nullable=False)
    
    # Migrate existing keys to encrypted format
    # This is done in Python code to access EnvelopeKeyManager
    # The migration will be run with Flask app context
    try:
        from flask import current_app
        from backend.utils.envelope_encryption import EnvelopeKeyManager
        
        # Check if KEK is available
        if EnvelopeKeyManager.validate_kek_set():
            # Get connection
            connection = op.get_bind()
            
            # Get all project encryption keys
            result = connection.execute(
                sa.text("SELECT id, project_id, aes_key FROM project_encryption_keys WHERE aes_key IS NOT NULL")
            )
            
            migrated_count = 0
            for row in result:
                project_id = row[1]
                plain_key = row[2]
                
                if plain_key and len(plain_key) == 64:  # Valid hex key
                    try:
                        # Encrypt the key
                        encrypted_key = EnvelopeKeyManager.encrypt_dek_string(plain_key)
                        
                        # Update the record
                        connection.execute(
                            sa.text("""
                                UPDATE project_encryption_keys 
                                SET aes_key_encrypted = :encrypted_key 
                                WHERE id = :id
                            """),
                            {"encrypted_key": encrypted_key, "id": row[0]}
                        )
                        migrated_count += 1
                    except Exception as e:
                        # Log error but continue migration
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(
                            f"Failed to encrypt key for project {project_id}: {e}. "
                            f"Key will remain in plain format."
                        )
            
            if migrated_count > 0:
                connection.commit()
                print(f"✅ Migrated {migrated_count} project keys to Envelope Encryption format")
        else:
            print("⚠️  PROJECT_MASTER_KEY not set. Keys will remain in plain format.")
            print("   Set PROJECT_MASTER_KEY environment variable to enable Envelope Encryption.")
    except Exception as e:
        # Migration continues even if key migration fails
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Key migration step failed (non-critical): {e}")
        print(f"⚠️  Key migration step failed: {e}")
        print("   Keys will remain in plain format. You can migrate them later.")


def downgrade():
    """
    Remove Envelope Encryption support.
    
    Note: This will NOT decrypt keys - they must be decrypted before downgrade.
    """
    # Remove encrypted key column
    op.drop_column('project_encryption_keys', 'aes_key_encrypted')
    
    # Make aes_key non-nullable again (if all keys are migrated back)
    # Note: This might fail if there are NULL values
    try:
        op.alter_column('project_encryption_keys', 'aes_key',
                        existing_type=sa.Text(),
                        nullable=False,
                        existing_nullable=True)
    except Exception:
        # If there are NULL values, we can't make it non-nullable
        print("⚠️  Warning: Could not make aes_key non-nullable. Some keys may be missing.")
        pass

