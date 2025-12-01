#!/usr/bin/env python3
"""
Database Connection Diagnostic Script

This script helps diagnose and fix PostgreSQL connection issues.
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Add project root to path
script_dir = Path(__file__).parent.absolute()
backend_dir = script_dir.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")

def check_database_url():
    """Check if DATABASE_URL is set and parse it"""
    print_header("Checking DATABASE_URL Configuration")
    
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL environment variable is not set!")
        print("\nTo fix this, set DATABASE_URL with your PostgreSQL connection string:")
        print("  export DATABASE_URL='postgresql://username:password@localhost:5432/database'")
        print("\nOr create a .env file in the project root with:")
        print("  DATABASE_URL='postgresql://username:password@localhost:5432/database'")
        return None
    
    try:
        parsed = urlparse(db_url)
        print(f"✅ DATABASE_URL is set")
        print(f"   Host: {parsed.hostname or 'localhost'}")
        print(f"   Port: {parsed.port or 5432}")
        print(f"   Database: {parsed.path.lstrip('/') if parsed.path else 'N/A'}")
        print(f"   User: {parsed.username or 'N/A'}")
        print(f"   Password: {'***' if parsed.password else 'NOT SET'}")
        
        return parsed
    except Exception as e:
        print(f"❌ Error parsing DATABASE_URL: {e}")
        print(f"   Current value: {db_url[:50]}...")
        return None

def test_connection(parsed_url):
    """Test the database connection"""
    print_header("Testing Database Connection")
    
    if not parsed_url:
        print("❌ Cannot test connection - DATABASE_URL is invalid")
        return False
    
    try:
        import psycopg2
        
        conn_params = {
            'host': parsed_url.hostname or 'localhost',
            'port': parsed_url.port or 5432,
            'database': parsed_url.path.lstrip('/') if parsed_url.path else 'postgres',
            'user': parsed_url.username,
            'password': parsed_url.password
        }
        
        print(f"Attempting to connect to PostgreSQL...")
        print(f"  Host: {conn_params['host']}")
        print(f"  Port: {conn_params['port']}")
        print(f"  Database: {conn_params['database']}")
        print(f"  User: {conn_params['user']}")
        
        conn = psycopg2.connect(**conn_params)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        print(f"✅ Connection successful!")
        print(f"   PostgreSQL version: {version.split(',')[0]}")
        return True
        
    except psycopg2.OperationalError as e:
        error_msg = str(e)
        print(f"❌ Connection failed: {error_msg}")
        
        if "password authentication failed" in error_msg:
            print("\n🔧 Possible fixes:")
            print("1. Reset the PostgreSQL password for the user:")
            print(f"   psql -U postgres -c \"ALTER USER {parsed_url.username} WITH PASSWORD 'your_new_password';\"")
            print(f"   Then update DATABASE_URL with the new password")
            print("\n2. Or create the user if it doesn't exist:")
            print(f"   psql -U postgres -c \"CREATE USER {parsed_url.username} WITH PASSWORD 'your_password';\"")
            print(f"   psql -U postgres -c \"CREATE DATABASE {parsed_url.path.lstrip('/')} OWNER {parsed_url.username};\"")
            print(f"   psql -U postgres -c \"GRANT ALL PRIVILEGES ON DATABASE {parsed_url.path.lstrip('/')} TO {parsed_url.username};\"")
        
        elif "could not connect to server" in error_msg:
            print("\n🔧 Possible fixes:")
            print("1. Make sure PostgreSQL is running:")
            print("   - macOS: brew services start postgresql")
            print("   - Linux: sudo systemctl start postgresql")
            print("   - Docker: docker-compose up -d postgres")
            print("\n2. Check if PostgreSQL is listening on the correct port:")
            print(f"   netstat -an | grep {parsed_url.port or 5432}")
        
        return False
        
    except ImportError:
        print("❌ psycopg2 is not installed")
        print("   Install it with: pip install psycopg2-binary")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def check_postgres_running():
    """Check if PostgreSQL server is running"""
    print_header("Checking PostgreSQL Server Status")
    
    import subprocess
    
    try:
        result = subprocess.run(
            ["pg_isready", "-h", "localhost", "-p", "5432"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            print("✅ PostgreSQL server is running and accepting connections")
            return True
        else:
            print("❌ PostgreSQL server is not responding")
            print(f"   Error: {result.stderr.strip()}")
            return False
            
    except FileNotFoundError:
        print("⚠️  pg_isready command not found (PostgreSQL client tools may not be installed)")
        return None
        
    except subprocess.TimeoutExpired:
        print("❌ Connection to PostgreSQL timed out")
        return False
        
    except Exception as e:
        print(f"⚠️  Could not check PostgreSQL status: {e}")
        return None

def main():
    """Main diagnostic function"""
    print_header("PostgreSQL Connection Diagnostic Tool")
    
    # Check if PostgreSQL is running
    pg_running = check_postgres_running()
    
    # Check DATABASE_URL
    parsed_url = check_database_url()
    
    # Test connection
    if parsed_url:
        connection_ok = test_connection(parsed_url)
        
        if connection_ok:
            print("\n" + "=" * 80)
            print("✅ All checks passed! Your database connection is working.")
            print("=" * 80 + "\n")
            return 0
        else:
            print("\n" + "=" * 80)
            print("❌ Connection test failed. Please fix the issues above.")
            print("=" * 80 + "\n")
            return 1
    else:
        print("\n" + "=" * 80)
        print("❌ DATABASE_URL is not properly configured.")
        print("=" * 80 + "\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())

