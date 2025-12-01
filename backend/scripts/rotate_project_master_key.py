#!/usr/bin/env python3
"""
Project Master Key Rotation Script

This script performs zero-downtime rotation of PROJECT_MASTER_KEY.

SECURITY: Key rotation is critical for security best practices. This script:
1. Validates current key is working
2. Sets PROJECT_MASTER_KEY_OLD to current key
3. Sets PROJECT_MASTER_KEY to new key
4. Verifies both keys work (old for decryption, new for encryption)
5. Optionally re-encrypts all project keys with new key (background migration)

Usage:
    # Step 1: Generate new key
    python -c "import secrets; print(secrets.token_hex(32))"
    
    # Step 2: Run rotation script
    python scripts/rotate_project_master_key.py --new-key <new_key_hex>
    
    # Step 3: Update environment variables in your deployment
    # Set PROJECT_MASTER_KEY_OLD=<old_key>
    # Set PROJECT_MASTER_KEY=<new_key>
    
    # Step 4: Restart application (will use both keys automatically)
    
    # Step 5: (Optional) Re-encrypt all keys with new key
    python scripts/rotate_project_master_key.py --re-encrypt-all
"""

import argparse
import logging
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.app import create_app
from backend.core.extensions import db
from backend.models.core import ProjectEncryptionKeys
from backend.utils.envelope_encryption import EnvelopeKeyManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def validate_current_key() -> bool:
    """Validate that current PROJECT_MASTER_KEY can decrypt existing keys"""
    logger.info("Validating current PROJECT_MASTER_KEY...")
    
    try:
        if not EnvelopeKeyManager.validate_kek_set():
            logger.error("PROJECT_MASTER_KEY is not set or invalid")
            return False
        
        # Try to decrypt a few project keys
        encrypted_keys = ProjectEncryptionKeys.query.filter(
            ProjectEncryptionKeys.aes_key_encrypted.isnot(None)
        ).limit(5).all()
        
        if not encrypted_keys:
            logger.warning("No encrypted keys found in database. Nothing to validate.")
            return True
        
        success_count = 0
        for key in encrypted_keys:
            try:
                EnvelopeKeyManager.decrypt_dek_string(key.aes_key_encrypted)
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to decrypt key for project {key.project_id}: {e}")
                return False
        
        logger.info(f"✅ Successfully validated {success_count} encrypted keys")
        return True
        
    except Exception as e:
        logger.error(f"Error validating current key: {e}")
        return False


def test_key_rotation(new_key_hex: str) -> bool:
    """Test that both old and new keys work"""
    logger.info("Testing key rotation...")
    
    try:
        # Get current key
        current_key = os.getenv('PROJECT_MASTER_KEY')
        if not current_key:
            logger.error("PROJECT_MASTER_KEY not set")
            return False
        
        # Temporarily set both keys
        os.environ['PROJECT_MASTER_KEY_OLD'] = current_key
        os.environ['PROJECT_MASTER_KEY'] = new_key_hex
        
        # Clear cached keys
        EnvelopeKeyManager._kek = None
        EnvelopeKeyManager._kek_old = None
        EnvelopeKeyManager._fernet = None
        EnvelopeKeyManager._fernet_old = None
        
        # Test decryption with old key
        encrypted_keys = ProjectEncryptionKeys.query.filter(
            ProjectEncryptionKeys.aes_key_encrypted.isnot(None)
        ).limit(3).all()
        
        if encrypted_keys:
            for key in encrypted_keys:
                try:
                    # Should decrypt with old key
                    EnvelopeKeyManager.decrypt_dek_string(key.aes_key_encrypted, use_old=True)
                    logger.info(f"✅ Successfully decrypted project {key.project_id} with old key")
                except Exception as e:
                    logger.error(f"Failed to decrypt with old key: {e}")
                    return False
        
        # Test encryption with new key
        test_dek = "a" * 64  # 32 bytes hex
        encrypted = EnvelopeKeyManager.encrypt_dek_string(test_dek)
        decrypted = EnvelopeKeyManager.decrypt_dek_string(encrypted)
        
        if decrypted != test_dek:
            logger.error("Failed to encrypt/decrypt with new key")
            return False
        
        logger.info("✅ Key rotation test successful")
        return True
        
    except Exception as e:
        logger.error(f"Error testing key rotation: {e}")
        return False
    finally:
        # Restore original key
        if 'PROJECT_MASTER_KEY_OLD' in os.environ:
            del os.environ['PROJECT_MASTER_KEY_OLD']
        os.environ['PROJECT_MASTER_KEY'] = current_key


def re_encrypt_all_keys() -> int:
    """Re-encrypt all project keys with new key (background migration)"""
    logger.info("Starting re-encryption of all project keys...")
    
    try:
        if not EnvelopeKeyManager.has_old_key():
            logger.error("PROJECT_MASTER_KEY_OLD not set. Cannot re-encrypt.")
            return 0
        
        encrypted_keys = ProjectEncryptionKeys.query.filter(
            ProjectEncryptionKeys.aes_key_encrypted.isnot(None)
        ).all()
        
        if not encrypted_keys:
            logger.info("No encrypted keys to re-encrypt")
            return 0
        
        re_encrypted_count = 0
        failed_count = 0
        
        for key in encrypted_keys:
            try:
                # Decrypt with old key
                dek = EnvelopeKeyManager.decrypt_dek_string(key.aes_key_encrypted, use_old=True)
                
                # Re-encrypt with new key
                new_encrypted = EnvelopeKeyManager.encrypt_dek_string(dek)
                
                # Update in database
                key.aes_key_encrypted = new_encrypted
                db.session.commit()
                
                re_encrypted_count += 1
                logger.info(f"✅ Re-encrypted project {key.project_id}")
                
            except Exception as e:
                logger.error(f"Failed to re-encrypt project {key.project_id}: {e}")
                failed_count += 1
                db.session.rollback()
        
        logger.info(f"Re-encryption complete: {re_encrypted_count} succeeded, {failed_count} failed")
        return re_encrypted_count
        
    except Exception as e:
        logger.error(f"Error during re-encryption: {e}")
        return 0


def main():
    parser = argparse.ArgumentParser(description='Rotate PROJECT_MASTER_KEY')
    parser.add_argument(
        '--new-key',
        type=str,
        help='New master key (64 hex characters)'
    )
    parser.add_argument(
        '--re-encrypt-all',
        action='store_true',
        help='Re-encrypt all project keys with new key'
    )
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate current key, do not rotate'
    )
    
    args = parser.parse_args()
    
    app = create_app()
    
    with app.app_context():
        if args.validate_only:
            if validate_current_key():
                logger.info("✅ Current key validation successful")
                sys.exit(0)
            else:
                logger.error("❌ Current key validation failed")
                sys.exit(1)
        
        if args.re_encrypt_all:
            count = re_encrypt_all_keys()
            if count > 0:
                logger.info(f"✅ Re-encrypted {count} project keys")
                sys.exit(0)
            else:
                logger.error("❌ Re-encryption failed or no keys to re-encrypt")
                sys.exit(1)
        
        if not args.new_key:
            parser.print_help()
            sys.exit(1)
        
        # Validate new key format
        if len(args.new_key) != 64:
            logger.error(f"New key must be 64 hex characters, got {len(args.new_key)}")
            sys.exit(1)
        
        try:
            bytes.fromhex(args.new_key)
        except ValueError:
            logger.error("New key must be valid hex")
            sys.exit(1)
        
        # Validate current key
        if not validate_current_key():
            logger.error("❌ Current key validation failed. Cannot proceed with rotation.")
            sys.exit(1)
        
        # Test rotation
        if not test_key_rotation(args.new_key):
            logger.error("❌ Key rotation test failed")
            sys.exit(1)
        
        # Print instructions
        current_key = os.getenv('PROJECT_MASTER_KEY')
        logger.info("\n" + "="*80)
        logger.info("✅ Key rotation test successful!")
        logger.info("\nNext steps:")
        logger.info("1. Update environment variables in your deployment:")
        logger.info(f"   PROJECT_MASTER_KEY_OLD={current_key}")
        logger.info(f"   PROJECT_MASTER_KEY={args.new_key}")
        logger.info("2. Restart application (will automatically use both keys)")
        logger.info("3. (Optional) Run re-encryption:")
        logger.info("   python scripts/rotate_project_master_key.py --re-encrypt-all")
        logger.info("="*80)


if __name__ == '__main__':
    main()

