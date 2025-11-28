"""Migrate existing AES keys to Envelope Encryption

Revision ID: migrate_keys_envelope
Revises: rls_001
Create Date: 2024-11-28

This migration migrates existing plain-text aes_key to encrypted format (aes_key_encrypted).
It requires PROJECT_MASTER_KEY to be set in environment.
"""
from alembic import op
import sqlalchemy as sa
import os
import sys
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir.parent))

# revision identifiers, used by Alembic.
revision = 'migrate_keys_envelope'
down_revision = 'rls_001'
branch_labels = None
depends_on = None


def upgrade():
    """
    Migrate existing plain-text aes_key to encrypted format.
    
    Steps:
    1. Check if PROJECT_MASTER_KEY is set
    2. Get all ProjectEncryptionKeys with aes_key but no aes_key_encrypted
    3. Encrypt each key using EnvelopeKeyManager
    4. Save encrypted key to aes_key_encrypted
    5. Keep aes_key for backward compatibility (can be removed later)
    """
    
    # Check if PROJECT_MASTER_KEY is set
    master_key = os.environ.get('PROJECT_MASTER_KEY')
    if not master_key:
        print("⚠️  PROJECT_MASTER_KEY not set in environment.")
        print("   Skipping key migration. Keys will remain in plain format.")
        print("   Set PROJECT_MASTER_KEY to enable Envelope Encryption migration.")
        return
    
    print("✅ PROJECT_MASTER_KEY found. Starting key migration...")
    print()
    
    try:
        # Import EnvelopeKeyManager
        from backend.utils.envelope_encryption import EnvelopeKeyManager
        
        # Validate KEK
        if not EnvelopeKeyManager.validate_kek_set():
            print("❌ PROJECT_MASTER_KEY is invalid or cannot be derived.")
            print("   Skipping key migration.")
            return
        
        print("✅ KEK validated successfully")
        print()
        
        # Get database connection
        connection = op.get_bind()
        
        # Find all keys that need migration
        # Keys with aes_key but no aes_key_encrypted
        result = connection.execute(
            sa.text("""
                SELECT id, project_id, aes_key 
                FROM project_encryption_keys 
                WHERE aes_key IS NOT NULL 
                AND (aes_key_encrypted IS NULL OR aes_key_encrypted = '')
            """)
        )
        
        rows = result.fetchall()
        total_keys = len(rows)
        
        if total_keys == 0:
            print("✅ No keys to migrate. All keys are already encrypted or don't exist.")
            return
        
        print(f"📋 Found {total_keys} keys to migrate")
        print()
        
        migrated_count = 0
        failed_count = 0
        skipped_count = 0
        
        for row in rows:
            key_id = row[0]
            project_id = row[1]
            plain_key = row[2]
            
            try:
                # Validate key format
                if not plain_key:
                    skipped_count += 1
                    print(f"   ⚠️  Key {key_id} (project {project_id}): Empty key, skipping")
                    continue
                
                # Check if key is valid hex (64 chars for 32 bytes = 256 bits)
                if len(plain_key) != 64:
                    # Try to use as-is (might be base64 or other format)
                    try:
                        # Convert to bytes if it's hex
                        key_bytes = bytes.fromhex(plain_key)
                    except ValueError:
                        # Not hex, try to use directly
                        key_bytes = plain_key.encode('utf-8')
                else:
                    # Valid hex key
                    key_bytes = bytes.fromhex(plain_key)
                
                # Encrypt the key using EnvelopeKeyManager
                encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
                
                # Update the record
                connection.execute(
                    sa.text("""
                        UPDATE project_encryption_keys 
                        SET aes_key_encrypted = :encrypted_key 
                        WHERE id = :id
                    """),
                    {"encrypted_key": encrypted_key, "id": key_id}
                )
                
                migrated_count += 1
                if migrated_count % 10 == 0:
                    print(f"   ✅ Migrated {migrated_count}/{total_keys} keys...")
                
            except Exception as e:
                failed_count += 1
                print(f"   ❌ Failed to migrate key {key_id} (project {project_id}): {e}")
                # Continue with other keys
                continue
        
        # Commit all changes
        connection.commit()
        
        print()
        print("=" * 60)
        print("Migration Summary:")
        print("=" * 60)
        print(f"✅ Successfully migrated: {migrated_count}")
        if skipped_count > 0:
            print(f"⚠️  Skipped: {skipped_count}")
        if failed_count > 0:
            print(f"❌ Failed: {failed_count}")
        print("=" * 60)
        print()
        
        if migrated_count > 0:
            print("✅ Keys migrated successfully!")
            print("   Encrypted keys are now stored in aes_key_encrypted column.")
            print("   Plain keys (aes_key) are kept for backward compatibility.")
            print("   You can remove aes_key column later after verifying everything works.")
        else:
            print("⚠️  No keys were migrated. Check logs above for details.")
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Make sure backend.utils.envelope_encryption is available")
        print("   Skipping key migration.")
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        print()
        print("⚠️  Migration failed. Keys remain in plain format.")
        print("   You can run this migration again after fixing the issue.")


def downgrade():
    """
    Downgrade: Remove encrypted keys (decrypt first if needed).
    
    WARNING: This does NOT decrypt keys. You must decrypt them manually
    before downgrading if you want to keep plain keys.
    """
    connection = op.get_bind()
    
    # Clear encrypted keys
    result = connection.execute(
        sa.text("""
            UPDATE project_encryption_keys 
            SET aes_key_encrypted = NULL 
            WHERE aes_key_encrypted IS NOT NULL
        """)
    )
    
    cleared_count = result.rowcount
    connection.commit()
    
    print(f"⚠️  Cleared {cleared_count} encrypted keys.")
    print("   WARNING: Keys were NOT decrypted. They are lost if aes_key was removed.")
    print("   Make sure to decrypt keys before downgrading if you need them.")

