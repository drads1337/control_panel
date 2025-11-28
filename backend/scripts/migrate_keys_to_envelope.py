#!/usr/bin/env python3
"""
Migrate existing AES keys to Envelope Encryption format

This script:
1. Checks if PROJECT_MASTER_KEY is set
2. Finds all ProjectEncryptionKeys with plain aes_key
3. Encrypts them using EnvelopeKeyManager
4. Saves to aes_key_encrypted column
"""
import os
import sys
from pathlib import Path

# Add project root to path
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

os.chdir(backend_dir)

try:
    from backend.utils.envelope_encryption import EnvelopeKeyManager
    from backend.config.config import Config
    from backend.core.extensions import db
    from backend.models.core import ProjectEncryptionKeys
    from flask import Flask
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure you're in the correct environment with dependencies installed")
    sys.exit(1)

def migrate_keys():
    """Migrate existing keys to Envelope Encryption format"""
    
    print("=" * 60)
    print("Migrate AES Keys to Envelope Encryption")
    print("=" * 60)
    print()
    
    # Check if PROJECT_MASTER_KEY is set
    master_key = os.environ.get('PROJECT_MASTER_KEY')
    if not master_key:
        print("❌ PROJECT_MASTER_KEY not set in environment")
        print()
        print("   To enable Envelope Encryption, set PROJECT_MASTER_KEY:")
        print("   export PROJECT_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')")
        print()
        print("   Or add to .env file:")
        print("   PROJECT_MASTER_KEY=your_64_character_hex_key")
        print()
        sys.exit(1)
    
    print("✅ PROJECT_MASTER_KEY found")
    
    # Validate KEK
    try:
        if not EnvelopeKeyManager.validate_kek_set():
            print("❌ PROJECT_MASTER_KEY is invalid")
            print("   Key must be 64 hex characters (32 bytes)")
            sys.exit(1)
        print("✅ KEK validated successfully")
    except Exception as e:
        print(f"❌ Error validating KEK: {e}")
        sys.exit(1)
    
    print()
    
    # Create Flask app context
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        # Find keys that need migration
        keys_to_migrate = ProjectEncryptionKeys.query.filter(
            ProjectEncryptionKeys.aes_key.isnot(None),
            (ProjectEncryptionKeys.aes_key_encrypted.is_(None) | 
             (ProjectEncryptionKeys.aes_key_encrypted == ''))
        ).all()
        
        total_keys = len(keys_to_migrate)
        
        if total_keys == 0:
            print("✅ No keys to migrate")
            print("   All keys are already encrypted or don't have plain keys")
            return 0
        
        print(f"📋 Found {total_keys} keys to migrate")
        print()
        
        migrated_count = 0
        failed_count = 0
        skipped_count = 0
        
        for key_record in keys_to_migrate:
            try:
                plain_key = key_record.aes_key
                
                if not plain_key:
                    skipped_count += 1
                    print(f"   ⚠️  Key {key_record.id} (project {key_record.project_id}): Empty key, skipping")
                    continue
                
                # Convert plain key to bytes
                try:
                    # Try hex format first (64 chars = 32 bytes)
                    if len(plain_key) == 64:
                        key_bytes = bytes.fromhex(plain_key)
                    else:
                        # Try as hex anyway, or use as UTF-8
                        try:
                            key_bytes = bytes.fromhex(plain_key)
                        except ValueError:
                            key_bytes = plain_key.encode('utf-8')
                except Exception as e:
                    print(f"   ⚠️  Key {key_record.id} (project {key_record.project_id}): Invalid format, skipping: {e}")
                    skipped_count += 1
                    continue
                
                # Encrypt the key
                try:
                    encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
                    
                    # Update the record
                    key_record.aes_key_encrypted = encrypted_key
                    db.session.commit()
                    
                    migrated_count += 1
                    if migrated_count % 10 == 0:
                        print(f"   ✅ Migrated {migrated_count}/{total_keys} keys...")
                        
                except Exception as e:
                    db.session.rollback()
                    failed_count += 1
                    print(f"   ❌ Failed to encrypt key {key_record.id} (project {key_record.project_id}): {e}")
                    continue
                    
            except Exception as e:
                db.session.rollback()
                failed_count += 1
                print(f"   ❌ Error processing key {key_record.id}: {e}")
                continue
        
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
            print()
            print("   Next steps:")
            print("   1. Verify that encryption/decryption works correctly")
            print("   2. After verification, you can remove aes_key column in a future migration")
            return 0
        else:
            print("⚠️  No keys were migrated")
            if failed_count > 0:
                return 1
            return 0

if __name__ == "__main__":
    try:
        exit_code = migrate_keys()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n⚠️  Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

