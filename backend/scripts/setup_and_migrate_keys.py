#!/usr/bin/env python3
"""
Setup PROJECT_MASTER_KEY and migrate existing AES keys to Envelope Encryption

This script:
1. Checks if PROJECT_MASTER_KEY is set
2. If not, generates one and saves to .env
3. Migrates existing plain keys to encrypted format
"""
import os
import sys
import secrets
from pathlib import Path

script_dir = Path(__file__).parent
backend_dir = script_dir.parent
env_file = backend_dir / '.env'

# Check if PROJECT_MASTER_KEY is set
master_key = os.environ.get('PROJECT_MASTER_KEY')

if not master_key:
    print("⚠️  PROJECT_MASTER_KEY not set")
    print()
    
    # Check if it exists in .env file
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if line.startswith('PROJECT_MASTER_KEY='):
                    master_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    
    if not master_key:
        print("📋 Generating new PROJECT_MASTER_KEY...")
        new_key = secrets.token_hex(32)  # 64 hex characters = 32 bytes
        
        # Add to .env file
        if env_file.exists():
            # Check if PROJECT_MASTER_KEY already exists (commented out)
            with open(env_file, 'r') as f:
                content = f.read()
            
            if 'PROJECT_MASTER_KEY' in content:
                print("   ⚠️  PROJECT_MASTER_KEY found in .env but not loaded")
                print("   Please check your .env file")
            else:
                # Append to .env
                with open(env_file, 'a') as f:
                    f.write(f'\n# Envelope Encryption Master Key (KEK)\n')
                    f.write(f'PROJECT_MASTER_KEY={new_key}\n')
                print(f"   ✅ Generated and saved to .env: {new_key[:16]}...")
        else:
            # Create .env file
            with open(env_file, 'w') as f:
                f.write(f'# Envelope Encryption Master Key (KEK)\n')
                f.write(f'PROJECT_MASTER_KEY={new_key}\n')
            print(f"   ✅ Generated and saved to .env: {new_key[:16]}...")
        
        # Set in environment for this session
        os.environ['PROJECT_MASTER_KEY'] = new_key
        master_key = new_key
        print()
        print("✅ PROJECT_MASTER_KEY is now set")
    else:
        print("✅ PROJECT_MASTER_KEY found in .env file")
        os.environ['PROJECT_MASTER_KEY'] = master_key
else:
    print("✅ PROJECT_MASTER_KEY is already set in environment")

print()
print("=" * 60)
print("Running key migration...")
print("=" * 60)
print()

# Run the migration script
sys.path.insert(0, str(backend_dir.parent))
from backend.scripts.migrate_keys_to_envelope_direct import migrate_keys

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

