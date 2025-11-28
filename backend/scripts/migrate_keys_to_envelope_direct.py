#!/usr/bin/env python3
"""
Migrate existing AES keys to Envelope Encryption format (direct DB connection)

This script bypasses Flask and connects directly to PostgreSQL to migrate keys.
"""
import os
import sys
import base64
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("❌ psycopg2 not installed. Install it with: pip install psycopg2-binary")
    sys.exit(1)

# Add backend to path for EnvelopeKeyManager
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

try:
    from backend.utils.envelope_encryption import EnvelopeKeyManager
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure backend.utils.envelope_encryption is available")
    sys.exit(1)

# Get database URL
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    # Try to load from .env file
    env_file = backend_dir / '.env'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    database_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not database_url:
    print("❌ DATABASE_URL not found")
    sys.exit(1)

# Parse database URL
if database_url.startswith('postgresql://'):
    url_parts = database_url.replace('postgresql://', '').split('@')
    if len(url_parts) == 2:
        user_pass = url_parts[0].split(':')
        host_port_db = url_parts[1].split('/')
        if len(host_port_db) == 2:
            host_port = host_port_db[0].split(':')
            dbname = host_port_db[1]
            user = user_pass[0] if len(user_pass) > 0 else 'postgres'
            password = user_pass[1] if len(user_pass) > 1 else ''
            host = host_port[0] if len(host_port) > 0 else 'localhost'
            port = int(host_port[1]) if len(host_port) > 1 else 5432
        else:
            print("❌ Invalid DATABASE_URL format")
            sys.exit(1)
    else:
        print("❌ Invalid DATABASE_URL format")
        sys.exit(1)
else:
    print("❌ DATABASE_URL must start with postgresql://")
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
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=dbname,
            user=user,
            password=password
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        print("✅ Connected to database")
        print()
        
        # Check if aes_key_encrypted column exists, create if not
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'project_encryption_keys' 
            AND column_name = 'aes_key_encrypted'
        """)
        column_exists = cur.fetchone() is not None
        
        if not column_exists:
            print("📋 Column aes_key_encrypted does not exist. Creating it...")
            cur.execute("ALTER TABLE project_encryption_keys ADD COLUMN aes_key_encrypted TEXT")
            print("   ✅ Column created")
            print()
        
        # Find keys that need migration
        cur.execute("""
            SELECT id, project_id, aes_key 
            FROM project_encryption_keys 
            WHERE aes_key IS NOT NULL 
            AND (aes_key_encrypted IS NULL OR aes_key_encrypted = '')
        """)
        
        rows = cur.fetchall()
        total_keys = len(rows)
        
        if total_keys == 0:
            print("✅ No keys to migrate")
            print("   All keys are already encrypted or don't have plain keys")
            cur.close()
            conn.close()
            return 0
        
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
                if not plain_key:
                    skipped_count += 1
                    print(f"   ⚠️  Key {key_id} (project {project_id}): Empty key, skipping")
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
                    print(f"   ⚠️  Key {key_id} (project {project_id}): Invalid format, skipping: {e}")
                    skipped_count += 1
                    continue
                
                # Encrypt the key
                try:
                    encrypted_key = EnvelopeKeyManager.encrypt_dek(key_bytes)
                    
                    # Update the record
                    cur.execute("""
                        UPDATE project_encryption_keys 
                        SET aes_key_encrypted = %s 
                        WHERE id = %s
                    """, (encrypted_key, key_id))
                    
                    migrated_count += 1
                    if migrated_count % 10 == 0:
                        print(f"   ✅ Migrated {migrated_count}/{total_keys} keys...")
                        
                except Exception as e:
                    failed_count += 1
                    print(f"   ❌ Failed to encrypt key {key_id} (project {project_id}): {e}")
                    continue
                    
            except Exception as e:
                failed_count += 1
                print(f"   ❌ Error processing key {key_id}: {e}")
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
        
        cur.close()
        conn.close()
        
        if failed_count > 0:
            return 1
        return 0
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

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

