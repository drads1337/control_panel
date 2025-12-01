#!/usr/bin/env python3
"""
Recreate Database Script

This script will:
1. Drop the existing database
2. Create a new database
3. Run migrations to set up the schema
"""

import os
import sys
import subprocess
import getpass
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

def print_step(step_num, text):
    """Print a formatted step"""
    print(f"Step {step_num}: {text}")
    print("-" * 80)

def check_docker_postgres():
    """Check if PostgreSQL is running in Docker"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=postgres", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            container_name = result.stdout.strip().split('\n')[0]
            print(f"✅ Detected PostgreSQL in Docker container: {container_name}")
            return container_name
    except:
        pass
    return None

def get_docker_postgres_password(container_name):
    """Get PostgreSQL password from Docker container environment"""
    try:
        # Try to get password from container environment
        result = subprocess.run(
            ["docker", "inspect", container_name, "--format", "{{range .Config.Env}}{{println .}}{{end}}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if line.startswith('POSTGRES_PASSWORD='):
                    return line.split('=', 1)[1]
    except:
        pass
    return None

def get_database_config():
    """Get database configuration from DATABASE_URL or use defaults"""
    db_url = os.environ.get("DATABASE_URL")
    
    if db_url:
        try:
            parsed = urlparse(db_url)
            return {
                "url": db_url,
                "host": parsed.hostname or "localhost",
                "port": parsed.port or 5432,
                "database": parsed.path.lstrip('/') if parsed.path else "panel",
                "user": parsed.username or "panel_user",
                "password": parsed.password or ""
            }
        except Exception as e:
            print(f"⚠️  Error parsing DATABASE_URL: {e}")
    
    # Check if PostgreSQL is in Docker
    docker_container = check_docker_postgres()
    
    # Use defaults if DATABASE_URL is not set
    print("DATABASE_URL not found. Using default values:")
    host = "localhost"
    port = 5432
    database = "panel"
    user = "panel_user"
    password = ""  # Try without password first (peer auth)
    
    # If Docker detected, try to get password from container
    if docker_container:
        docker_password = get_docker_postgres_password(docker_container)
        if docker_password:
            password = docker_password
            print(f"  (Detected Docker PostgreSQL, using password from container)")
        else:
            # Try default Docker Compose password
            password = os.environ.get("POSTGRES_PASSWORD", "change_me_in_production")
            print(f"  (Detected Docker PostgreSQL, using default password)")
    
    print(f"  Host: {host}")
    print(f"  Port: {port}")
    print(f"  Database: {database}")
    print(f"  User: {user}")
    if password:
        print(f"  Password: {'*' * len(password)}")
    else:
        print(f"  Password: (will try peer authentication)")
    
    # Try to get password from common environment variables
    if not password:
        password = os.environ.get("POSTGRES_PASSWORD") or os.environ.get("DB_PASSWORD") or ""
    
    if password:
        from urllib.parse import quote_plus
        encoded_password = quote_plus(password)
        db_url = f"postgresql://{user}:{encoded_password}@{host}:{port}/{database}"
    else:
        # Try without password (peer authentication)
        db_url = f"postgresql://{user}@{host}:{port}/{database}"
    
    return {
        "url": db_url,
        "host": host,
        "port": port,
        "database": database,
        "user": user,
        "password": password,
        "docker_container": docker_container
    }

def get_superuser_credentials(config):
    """Get PostgreSQL superuser credentials - try automatically"""
    print("\nTrying to connect as superuser (needed to drop/create database)...")
    
    # If Docker detected, use Docker credentials
    if config.get("docker_container"):
        docker_password = config.get("password") or "change_me_in_production"
        docker_user = os.environ.get("POSTGRES_USER", "panel_user")
        
        # Try panel_user first (might have superuser rights in Docker)
        for candidate in [docker_user, "postgres"]:
            print(f"  Trying user: {candidate}")
            try:
                from sqlalchemy import create_engine, text
                test_url = f"postgresql://{candidate}:{docker_password}@localhost:5432/postgres"
                engine = create_engine(test_url, connect_args={"connect_timeout": 2})
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                print(f"✅ Successfully connected as '{candidate}'")
                return candidate, docker_password
            except:
                continue
    
    # Try to get from environment first
    superuser = os.environ.get("POSTGRES_USER") or os.environ.get("PGUSER") or "postgres"
    superuser_pass = os.environ.get("PGPASSWORD") or os.environ.get("POSTGRES_PASSWORD") or config.get("password")
    
    # Try common superuser names
    superuser_candidates = [superuser, "postgres", getpass.getuser()]
    
    # Try each candidate
    for candidate in superuser_candidates:
        print(f"  Trying user: {candidate}")
        
        # First try with password if available
        if superuser_pass:
            try:
                from sqlalchemy import create_engine, text
                test_url = f"postgresql://{candidate}:{superuser_pass}@localhost:5432/postgres"
                engine = create_engine(test_url, connect_args={"connect_timeout": 2})
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                print(f"✅ Successfully connected as '{candidate}'")
                return candidate, superuser_pass
            except:
                pass
        
        # Try without password (peer authentication)
        try:
            from sqlalchemy import create_engine, text
            test_url = f"postgresql://{candidate}@localhost:5432/postgres"
            engine = create_engine(test_url, connect_args={"connect_timeout": 2})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"✅ Successfully connected as '{candidate}' (peer authentication)")
            return candidate, None
        except:
            continue
    
    # If all automatic attempts failed, ask user
    print("\n⚠️  Could not automatically connect. Please enter superuser credentials:")
    default_user = getpass.getuser()
    superuser = input(f"Superuser [postgres or {default_user}]: ").strip()
    
    if not superuser:
        superuser = "postgres"
    
    if not superuser_pass:
        print(f"(Leave empty if using peer authentication)")
        superuser_pass = getpass.getpass(f"Password for {superuser} (or press Enter for peer auth): ")
        if not superuser_pass:
            superuser_pass = None
    
    return superuser, superuser_pass

def drop_database(config, superuser, superuser_pass):
    """Drop the existing database"""
    print_step(1, f"Dropping database '{config['database']}'...")
    
    # Try using SQLAlchemy first (more flexible with authentication)
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.exc import OperationalError
        
        # Try to connect as superuser to postgres database
        if superuser_pass:
            superuser_url = f"postgresql://{superuser}:{superuser_pass}@{config['host']}:{config['port']}/postgres"
        else:
            # Try without password (peer authentication)
            superuser_url = f"postgresql://{superuser}@{config['host']}:{config['port']}/postgres"
        
        try:
            engine = create_engine(superuser_url, connect_args={"connect_timeout": 5})
            
            # Terminate all connections to the database first
            with engine.connect() as conn:
                # Set autocommit for DDL operations
                conn = conn.execution_options(autocommit=True)
                
                # Terminate connections
                try:
                    conn.execute(text(f"""
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = '{config['database']}' AND pid <> pg_backend_pid();
                    """))
                except:
                    pass  # Ignore errors if no connections exist
                
                # Drop database
                conn.execute(text(f"DROP DATABASE IF EXISTS {config['database']};"))
            
            print(f"✅ Database '{config['database']}' dropped successfully")
            return True
            
        except OperationalError as e:
            # If SQLAlchemy fails, try psql
            pass
    except ImportError:
        pass
    except Exception as e:
        print(f"⚠️  SQLAlchemy method failed: {e}, trying psql...")
    
    # Fallback to psql
    terminate_connections_sql = f"""
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '{config['database']}' AND pid <> pg_backend_pid();
    """
    
    env = os.environ.copy()
    if superuser_pass:
        env['PGPASSWORD'] = superuser_pass
    else:
        # Remove PGPASSWORD to allow peer authentication
        env.pop('PGPASSWORD', None)
    
    try:
        # Terminate connections
        result = subprocess.run(
            ["psql", "-h", config["host"], "-p", str(config["port"]), 
             "-U", superuser, "-d", "postgres", "-c", terminate_connections_sql],
            env=env,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Drop database
        drop_db_sql = f"DROP DATABASE IF EXISTS {config['database']};"
        result = subprocess.run(
            ["psql", "-h", config["host"], "-p", str(config["port"]), 
             "-U", superuser, "-d", "postgres", "-c", drop_db_sql],
            env=env,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print(f"✅ Database '{config['database']}' dropped successfully")
            return True
        else:
            if "does not exist" in result.stderr.lower():
                print(f"ℹ️  Database '{config['database']}' does not exist (nothing to drop)")
                return True
            print(f"❌ Failed to drop database: {result.stderr.strip()}")
            print(f"\n💡 Tip: Try using 'postgres' user or check your pg_hba.conf for peer authentication")
            return False
            
    except FileNotFoundError:
        print("❌ psql command not found. Please install PostgreSQL client tools.")
        return False
    except Exception as e:
        print(f"❌ Error dropping database: {e}")
        return False

def create_database(config, superuser, superuser_pass):
    """Create a new database"""
    print_step(2, f"Creating database '{config['database']}'...")
    
    # Try using SQLAlchemy first
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.exc import OperationalError
        
        if superuser_pass:
            superuser_url = f"postgresql://{superuser}:{superuser_pass}@{config['host']}:{config['port']}/postgres"
        else:
            superuser_url = f"postgresql://{superuser}@{config['host']}:{config['port']}/postgres"
        
        try:
            engine = create_engine(superuser_url, connect_args={"connect_timeout": 5})
            with engine.connect() as conn:
                conn = conn.execution_options(autocommit=True)
                conn.execute(text(f"CREATE DATABASE {config['database']} OWNER {config['user']};"))
            
            print(f"✅ Database '{config['database']}' created successfully")
            return True
        except OperationalError:
            pass
    except ImportError:
        pass
    except Exception as e:
        print(f"⚠️  SQLAlchemy method failed: {e}, trying psql...")
    
    # Fallback to psql
    env = os.environ.copy()
    if superuser_pass:
        env['PGPASSWORD'] = superuser_pass
    else:
        env.pop('PGPASSWORD', None)
    
    create_db_sql = f"CREATE DATABASE {config['database']} OWNER {config['user']};"
    
    try:
        result = subprocess.run(
            ["psql", "-h", config["host"], "-p", str(config["port"]), 
             "-U", superuser, "-d", "postgres", "-c", create_db_sql],
            env=env,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print(f"✅ Database '{config['database']}' created successfully")
            return True
        else:
            if "already exists" in result.stderr.lower():
                print(f"ℹ️  Database '{config['database']}' already exists")
                return True
            print(f"❌ Failed to create database: {result.stderr.strip()}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False

def test_connection(db_url):
    """Test database connection"""
    print_step(3, "Testing database connection...")
    
    try:
        from sqlalchemy import create_engine, text
        
        engine = create_engine(db_url, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Connection successful!")
            print(f"   PostgreSQL version: {version.split(',')[0]}")
            return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def run_migrations():
    """Run database migrations"""
    print_step(4, "Running database migrations...")
    
    try:
        # Change to backend directory for migrations
        os.chdir(backend_dir)
        
        # Set DATABASE_URL if not already set
        if not os.environ.get("DATABASE_URL"):
            print("❌ DATABASE_URL not set. Cannot run migrations.")
            return False
        
        # Try using Flask-Migrate
        result = subprocess.run(
            ["flask", "db", "upgrade"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print("✅ Migrations applied successfully")
            return True
        else:
            # Try using alembic directly
            print("⚠️  Flask-Migrate failed, trying Alembic directly...")
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                cwd=str(backend_dir / "migrations"),
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print("✅ Migrations applied successfully (via Alembic)")
                return True
            else:
                print(f"❌ Migration failed: {result.stderr.strip()}")
                return False
                
    except FileNotFoundError:
        print("❌ Flask or Alembic not found. Trying Python import...")
        # Try using Python directly
        try:
            from flask import Flask
            from flask_migrate import upgrade
            from backend.config.config import Config
            from backend.core.extensions import db
            
            app = Flask(__name__)
            app.config.from_object(Config)
            db.init_app(app)
            
            with app.app_context():
                upgrade(revision="head")
                print("✅ Migrations applied successfully (via Python)")
                return True
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            return False
    except Exception as e:
        print(f"❌ Error running migrations: {e}")
        return False

def try_with_db_user(config):
    """Try to drop/create database using the database user itself"""
    print("\n💡 Trying alternative method: using database user directly...")
    
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.exc import OperationalError
        
        # Connect to postgres database as the db user
        db_user_url = config['url'].replace(f"/{config['database']}", "/postgres")
        
        try:
            engine = create_engine(db_user_url, connect_args={"connect_timeout": 5})
            
            with engine.connect() as conn:
                conn = conn.execution_options(autocommit=True)
                
                # Try to drop database
                try:
                    # Terminate connections first
                    conn.execute(text(f"""
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = '{config['database']}' AND pid <> pg_backend_pid();
                    """))
                except:
                    pass
                
                # Drop database
                conn.execute(text(f"DROP DATABASE IF EXISTS {config['database']};"))
                print(f"✅ Database '{config['database']}' dropped successfully")
                
                # Create database
                conn.execute(text(f"CREATE DATABASE {config['database']} OWNER {config['user']};"))
                print(f"✅ Database '{config['database']}' created successfully")
                
                return True
        except OperationalError as e:
            error_msg = str(e).lower()
            if "permission denied" in error_msg or "must be owner" in error_msg:
                print(f"❌ User '{config['user']}' doesn't have permission to drop/create database")
                return False
            raise
    except ImportError:
        return False
    except Exception as e:
        print(f"❌ Alternative method failed: {e}")
        return False

def main():
    """Main function"""
    print_header("Recreate Database")
    
    print("⚠️  WARNING: This will DELETE all data in the database!")
    print("   Make sure you have backups if needed.")
    print()
    confirm = input("Are you sure you want to continue? (yes/no): ").strip().lower()
    
    if confirm not in ['yes', 'y']:
        print("❌ Operation cancelled")
        return 1
    
    # Get database configuration
    config = get_database_config()
    
    # First, try using the database user directly (if they have CREATEDB permission)
    if try_with_db_user(config):
        # Success! Skip superuser steps
        pass
    else:
        # Get superuser credentials
        superuser, superuser_pass = get_superuser_credentials(config)
        
        # Drop existing database
        if not drop_database(config, superuser, superuser_pass):
            print("\n❌ Failed to drop database")
            print("\n💡 Alternative: You can manually drop the database:")
            print(f"   psql -U postgres -d postgres -c \"DROP DATABASE IF EXISTS {config['database']};\"")
            return 1
        
        # Create new database
        if not create_database(config, superuser, superuser_pass):
            print("\n❌ Failed to create database")
            print("\n💡 Alternative: You can manually create the database:")
            print(f"   psql -U postgres -d postgres -c \"CREATE DATABASE {config['database']} OWNER {config['user']};\"")
            return 1
    
    # Test connection
    if not test_connection(config['url']):
        print("\n❌ Connection test failed")
        return 1
    
    # Run migrations
    # Set DATABASE_URL for migrations
    os.environ['DATABASE_URL'] = config['url']
    
    if not run_migrations():
        print("\n⚠️  Migrations failed, but database was created")
        print("   You can run migrations manually with: flask db upgrade")
        return 1
    
    print_header("Database Recreated Successfully!")
    print("✅ Database has been dropped and recreated")
    print("✅ Migrations have been applied")
    print()
    print("Next steps:")
    print("  1. Create an owner: python backend/scripts/create_owner.py")
    print("  2. Start your application")
    print()
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

