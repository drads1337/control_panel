#!/usr/bin/env python3
"""
Drop All Databases Script

This script will:
1. List all databases in PostgreSQL
2. Drop ALL databases (except system databases: template0, template1, postgres)
3. Create a new database for the project
4. Run migrations to set up the schema
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
    password = ""
    
    # If Docker detected, try to get password from container
    if docker_container:
        docker_password = get_docker_postgres_password(docker_container)
        if docker_password:
            password = docker_password
            print(f"  (Detected Docker PostgreSQL, using password from container)")
        else:
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
    
    if not password:
        password = os.environ.get("POSTGRES_PASSWORD") or os.environ.get("DB_PASSWORD") or ""
    
    if password:
        from urllib.parse import quote_plus
        encoded_password = quote_plus(password)
        db_url = f"postgresql://{user}:{encoded_password}@{host}:{port}/{database}"
    else:
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
    print("\nTrying to connect as superuser (needed to drop/create databases)...")
    
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

def list_all_databases(config, superuser, superuser_pass):
    """List all databases except system ones"""
    print_step(1, "Listing all databases...")
    
    try:
        from sqlalchemy import create_engine, text
        
        if superuser_pass:
            superuser_url = f"postgresql://{superuser}:{superuser_pass}@{config['host']}:{config['port']}/postgres"
        else:
            superuser_url = f"postgresql://{superuser}@{config['host']}:{config['port']}/postgres"
        
        engine = create_engine(superuser_url, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            # Get all databases except system ones
            result = conn.execute(text("""
                SELECT datname 
                FROM pg_database 
                WHERE datistemplate = false 
                AND datname NOT IN ('postgres', 'template0', 'template1')
                ORDER BY datname;
            """))
            databases = [row[0] for row in result]
            
            if databases:
                print(f"Found {len(databases)} database(s) to drop:")
                for db in databases:
                    print(f"  - {db}")
            else:
                print("No user databases found (only system databases exist)")
            
            return databases
    except Exception as e:
        print(f"⚠️  SQLAlchemy method failed: {e}, trying psql...")
    
    # Fallback to psql
    env = os.environ.copy()
    if superuser_pass:
        env['PGPASSWORD'] = superuser_pass
    else:
        env.pop('PGPASSWORD', None)
    
    try:
        result = subprocess.run(
            ["psql", "-h", config["host"], "-p", str(config["port"]), 
             "-U", superuser, "-d", "postgres", "-t", "-c", 
             "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'template0', 'template1') ORDER BY datname;"],
            env=env,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            databases = [db.strip() for db in result.stdout.strip().split('\n') if db.strip()]
            if databases:
                print(f"Found {len(databases)} database(s) to drop:")
                for db in databases:
                    print(f"  - {db}")
            else:
                print("No user databases found (only system databases exist)")
            return databases
        else:
            print(f"❌ Failed to list databases: {result.stderr.strip()}")
            return []
    except Exception as e:
        print(f"❌ Error listing databases: {e}")
        return []

def drop_all_databases(config, superuser, superuser_pass, databases):
    """Drop all user databases"""
    if not databases:
        print("ℹ️  No databases to drop")
        return True
    
    print_step(2, f"Dropping {len(databases)} database(s)...")
    
    try:
        from sqlalchemy import create_engine, text
        
        if superuser_pass:
            superuser_url = f"postgresql://{superuser}:{superuser_pass}@{config['host']}:{config['port']}/postgres"
        else:
            superuser_url = f"postgresql://{superuser}@{config['host']}:{config['port']}/postgres"
        
        # Use isolation_level=AUTOCOMMIT for DDL operations
        engine = create_engine(
            superuser_url, 
            connect_args={"connect_timeout": 5},
            isolation_level="AUTOCOMMIT"
        )
        
        with engine.connect() as conn:
            for db_name in databases:
                try:
                    # Terminate all connections to the database first
                    conn.execute(text(f"""
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = '{db_name}' AND pid <> pg_backend_pid();
                    """))
                except:
                    pass  # Ignore errors if no connections exist
                
                # Drop database
                try:
                    conn.execute(text(f"DROP DATABASE IF EXISTS {db_name};"))
                    print(f"✅ Dropped database: {db_name}")
                except Exception as e:
                    print(f"⚠️  Failed to drop database '{db_name}': {e}")
        
        return True
    except Exception as e:
        print(f"⚠️  SQLAlchemy method failed: {e}, trying psql...")
    
    # Fallback: try using docker exec if in Docker
    if config.get("docker_container"):
        docker_container = config["docker_container"]
        docker_password = config.get("password") or "change_me_in_production"
        docker_user = superuser
        
        success = True
        for db_name in databases:
            try:
                # Terminate connections
                terminate_sql = f"""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = '{db_name}' AND pid <> pg_backend_pid();
                """
                subprocess.run(
                    ["docker", "exec", "-e", f"PGPASSWORD={docker_password}",
                     docker_container, "psql", "-U", docker_user, "-d", "postgres", "-c", terminate_sql],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                # Drop database
                drop_sql = f"DROP DATABASE IF EXISTS {db_name};"
                result = subprocess.run(
                    ["docker", "exec", "-e", f"PGPASSWORD={docker_password}",
                     docker_container, "psql", "-U", docker_user, "-d", "postgres", "-c", drop_sql],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    print(f"✅ Dropped database: {db_name}")
                else:
                    print(f"⚠️  Failed to drop database '{db_name}': {result.stderr.strip()}")
                    success = False
            except Exception as e:
                print(f"⚠️  Error dropping database '{db_name}': {e}")
                success = False
        
        return success
    
    # Fallback to psql (if available locally)
    env = os.environ.copy()
    if superuser_pass:
        env['PGPASSWORD'] = superuser_pass
    else:
        env.pop('PGPASSWORD', None)
    
    success = True
    for db_name in databases:
        try:
            # Terminate connections
            terminate_sql = f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = '{db_name}' AND pid <> pg_backend_pid();
            """
            subprocess.run(
                ["psql", "-h", config["host"], "-p", str(config["port"]), 
                 "-U", superuser, "-d", "postgres", "-c", terminate_sql],
                env=env,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Drop database
            drop_sql = f"DROP DATABASE IF EXISTS {db_name};"
            result = subprocess.run(
                ["psql", "-h", config["host"], "-p", str(config["port"]), 
                 "-U", superuser, "-d", "postgres", "-c", drop_sql],
                env=env,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                print(f"✅ Dropped database: {db_name}")
            else:
                print(f"⚠️  Failed to drop database '{db_name}': {result.stderr.strip()}")
                success = False
        except FileNotFoundError:
            print("❌ psql command not found and Docker exec failed")
            return False
        except Exception as e:
            print(f"⚠️  Error dropping database '{db_name}': {e}")
            success = False
    
    return success

def create_database(config, superuser, superuser_pass):
    """Create a new database"""
    print_step(3, f"Creating database '{config['database']}'...")
    
    try:
        from sqlalchemy import create_engine, text
        
        if superuser_pass:
            superuser_url = f"postgresql://{superuser}:{superuser_pass}@{config['host']}:{config['port']}/postgres"
        else:
            superuser_url = f"postgresql://{superuser}@{config['host']}:{config['port']}/postgres"
        
        # Use isolation_level=AUTOCOMMIT for DDL operations
        engine = create_engine(
            superuser_url, 
            connect_args={"connect_timeout": 5},
            isolation_level="AUTOCOMMIT"
        )
        with engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE {config['database']} OWNER {config['user']};"))
        
        print(f"✅ Database '{config['database']}' created successfully")
        return True
    except Exception as e:
        print(f"⚠️  SQLAlchemy method failed: {e}, trying psql...")
    
    # Fallback: try using docker exec if in Docker
    if config.get("docker_container"):
        docker_container = config["docker_container"]
        docker_password = config.get("password") or "change_me_in_production"
        docker_user = superuser
        
        try:
            # Use docker exec to run psql inside the container
            create_db_sql = f"CREATE DATABASE {config['database']} OWNER {config['user']};"
            result = subprocess.run(
                ["docker", "exec", "-e", f"PGPASSWORD={docker_password}",
                 docker_container, "psql", "-U", docker_user, "-d", "postgres", "-c", create_db_sql],
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
            print(f"❌ Error creating database via Docker: {e}")
            return False
    
    # Fallback to psql (if available locally)
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
    except FileNotFoundError:
        print("❌ psql command not found and Docker exec failed")
        return False
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False

def test_connection(db_url):
    """Test database connection"""
    print_step(4, "Testing database connection...")
    
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
    print_step(5, "Running database migrations...")
    
    # Check if migrations directory exists
    migrations_dir = backend_dir / "migrations"
    if not migrations_dir.exists():
        print("⚠️  Migrations directory not found.")
        print("   The database has been created, but migrations cannot be applied.")
        print("   To initialize migrations, run: python backend/scripts/init_migrations.py")
        print("   Then apply migrations manually: flask db upgrade")
        return False
    
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
        print("⚠️  Flask or Alembic command not found in PATH.")
        print("   Trying to use Python module directly...")
        try:
            # Try using alembic Python API directly
            from alembic import command
            from alembic.config import Config as AlembicConfig
            
            alembic_cfg = AlembicConfig(str(backend_dir / "migrations" / "alembic.ini"))
            alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))
            
            # Set database URL in alembic config
            if os.environ.get("DATABASE_URL"):
                alembic_cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
            
            command.upgrade(alembic_cfg, "head")
            print("✅ Migrations applied successfully (via Alembic Python API)")
            return True
        except ImportError:
            print("❌ Alembic Python module not available.")
            print("   Please install dependencies: pip install -r backend/requirements.txt")
            return False
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            print("   This might be due to SQLAlchemy version conflicts.")
            print("   Try running migrations manually after fixing dependencies:")
            print("   - Activate your virtual environment")
            print("   - Run: flask db upgrade")
            print("   - Or: alembic upgrade head")
            return False
    except Exception as e:
        print(f"❌ Error running migrations: {e}")
        return False

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Drop all PostgreSQL databases and create a new one')
    parser.add_argument('--yes', '-y', action='store_true', 
                       help='Skip confirmation prompts (use with caution!)')
    args = parser.parse_args()
    
    print_header("Drop All Databases and Recreate")
    
    print("⚠️  WARNING: This will DELETE ALL DATABASES in PostgreSQL!")
    print("   Only system databases (postgres, template0, template1) will be preserved.")
    print("   All user data will be permanently lost!")
    print()
    
    if not args.yes:
        confirm = input("Are you absolutely sure you want to continue? (yes/no): ").strip().lower()
        if confirm not in ['yes', 'y']:
            print("❌ Operation cancelled")
            return 1
    else:
        print("⚠️  Auto-confirming (--yes flag used)")
    
    # Get database configuration
    config = get_database_config()
    
    # Get superuser credentials
    superuser, superuser_pass = get_superuser_credentials(config)
    
    # List all databases
    databases = list_all_databases(config, superuser, superuser_pass)
    
    if databases:
        # Confirm again with list
        print(f"\n⚠️  About to drop {len(databases)} database(s):")
        for db in databases:
            print(f"   - {db}")
        print()
        
        if not args.yes:
            final_confirm = input("Type 'DELETE ALL' to confirm: ").strip()
            if final_confirm != "DELETE ALL":
                print("❌ Operation cancelled - confirmation phrase did not match")
                return 1
        else:
            print("⚠️  Auto-confirming deletion (--yes flag used)")
    
    # Drop all databases
    if not drop_all_databases(config, superuser, superuser_pass, databases):
        print("\n⚠️  Some databases failed to drop, but continuing...")
    
    # Create new database
    if not create_database(config, superuser, superuser_pass):
        print("\n❌ Failed to create database")
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
    
    print_header("All Databases Dropped and New Database Created!")
    print("✅ All user databases have been dropped")
    print("✅ New database has been created")
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

