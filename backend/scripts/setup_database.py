
"""
Database Setup Script

This script helps set up PostgreSQL database for the panel application.
It will:
1. Check if PostgreSQL is running
2. Create the database user if it doesn't exist
3. Create the database if it doesn't exist
4. Test the connection
5. Optionally run migrations
"""

import os
import sys
import subprocess
import secrets
from pathlib import Path


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

def check_postgres_running():
    """Check if PostgreSQL is running"""
    print_step(1, "Checking if PostgreSQL is running...")
    
    try:

        result = subprocess.run(
            ["psql", "--version"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"✅ PostgreSQL client found: {result.stdout.strip()}")
        else:
            print("⚠️  PostgreSQL client (psql) not found in PATH")
            print("   You may need to install PostgreSQL client tools")
    except FileNotFoundError:
        print("⚠️  PostgreSQL client (psql) not found")
        print("   Install PostgreSQL: https://www.postgresql.org/download/")
        return False
    


    import getpass
    current_user = getpass.getuser()
    

    try:
        result = subprocess.run(
            ["psql", "-h", "localhost", "-U", current_user, "-d", "postgres", "-c", "SELECT 1"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print(f"✅ PostgreSQL server is running and accessible (as user '{current_user}')")
            return True
    except:
        pass
    

    try:
        result = subprocess.run(
            ["psql", "-h", "localhost", "-U", "postgres", "-c", "SELECT 1"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print("✅ PostgreSQL server is running and accessible (as user 'postgres')")
            return True
        else:
            print("❌ Cannot connect to PostgreSQL server")
            print(f"   Error: {result.stderr.strip()}")
            print(f"   Tried users: '{current_user}', 'postgres'")
            return False
    except subprocess.TimeoutExpired:
        print("❌ Connection to PostgreSQL timed out")
        return False
    except Exception as e:
        print(f"❌ Error checking PostgreSQL: {e}")
        return False

def get_db_config():
    """Get database configuration from user or environment"""
    print_step(2, "Database Configuration")
    

    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        print(f"📋 Found existing DATABASE_URL: {db_url.split('@')[-1] if '@' in db_url else 'hidden'}")
        use_existing = input("Use existing DATABASE_URL? (Y/n): ").strip().lower()
        if use_existing != 'n':
            return db_url
    
    print("\nEnter PostgreSQL connection details:")
    print("(Press Enter to use defaults)")
    
    db_host = input("Host [localhost]: ").strip() or "localhost"
    db_port = input("Port [5432]: ").strip() or "5432"
    db_name = input("Database name [panel]: ").strip() or "panel"
    db_user = input("Database user [panel_user]: ").strip() or "panel_user"
    
    print("\nEnter PostgreSQL superuser credentials (for creating user/database):")
    import getpass
    default_user = getpass.getuser()
    superuser = input(f"Superuser [{default_user}]: ").strip() or default_user
    

    superuser_pass = os.environ.get("PGPASSWORD")
    if not superuser_pass:
        import getpass
        superuser_pass = getpass.getpass(f"Password for {superuser}: ")
    
    return {
        "host": db_host,
        "port": db_port,
        "database": db_name,
        "user": db_user,
        "superuser": superuser,
        "superuser_pass": superuser_pass
    }

def create_database_user(config):
    """Create the database user if it doesn't exist"""
    print_step(3, f"Creating database user '{config['user']}'...")
    
    try:

        check_user_cmd = [
            "psql",
            "-h", config["host"],
            "-p", config["port"],
            "-U", config["superuser"],
            "-tAc",
            f"SELECT 1 FROM pg_roles WHERE rolname='{config['user']}'"
        ]
        
        env = os.environ.copy()
        env["PGPASSWORD"] = config["superuser_pass"]
        
        result = subprocess.run(
            check_user_cmd,
            capture_output=True,
            text=True,
            env=env,
            timeout=10
        )
        
        if result.returncode == 0 and result.stdout.strip() == "1":
            print(f"✅ User '{config['user']}' already exists")
            return True
        

        password = secrets.token_urlsafe(16)
        print(f"🔑 Generated password for user '{config['user']}': {password}")
        print("   (Save this password - you'll need it for DATABASE_URL)")
        

        create_user_cmd = [
            "psql",
            "-h", config["host"],
            "-p", config["port"],
            "-U", config["superuser"],
            "-c",
            f"CREATE USER {config['user']} WITH PASSWORD '{password}';"
        ]
        
        result = subprocess.run(
            create_user_cmd,
            capture_output=True,
            text=True,
            env=env,
            timeout=10
        )
        
        if result.returncode == 0:
            print(f"✅ User '{config['user']}' created successfully")
            

            grant_cmd = [
                "psql",
                "-h", config["host"],
                "-p", config["port"],
                "-U", config["superuser"],
                "-c",
                f"ALTER USER {config['user']} CREATEDB;"
            ]
            
            subprocess.run(
                grant_cmd,
                capture_output=True,
                text=True,
                env=env,
                timeout=10
            )
            
            config["password"] = password
            return True
        else:
            print(f"❌ Failed to create user: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return False

def create_database(config):
    """Create the database if it doesn't exist"""
    print_step(4, f"Creating database '{config['database']}'...")
    
    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = config.get("superuser_pass") or config.get("password", "")
        

        check_db_cmd = [
            "psql",
            "-h", config["host"],
            "-p", config["port"],
            "-U", config["superuser"],
            "-tAc",
            f"SELECT 1 FROM pg_database WHERE datname='{config['database']}'"
        ]
        
        result = subprocess.run(
            check_db_cmd,
            capture_output=True,
            text=True,
            env=env,
            timeout=10
        )
        
        if result.returncode == 0 and result.stdout.strip() == "1":
            print(f"✅ Database '{config['database']}' already exists")
            return True
        

        create_db_cmd = [
            "psql",
            "-h", config["host"],
            "-p", config["port"],
            "-U", config["superuser"],
            "-c",
            f"CREATE DATABASE {config['database']} OWNER {config['user']};"
        ]
        
        result = subprocess.run(
            create_db_cmd,
            capture_output=True,
            text=True,
            env=env,
            timeout=10
        )
        
        if result.returncode == 0:
            print(f"✅ Database '{config['database']}' created successfully")
            return True
        else:
            print(f"❌ Failed to create database: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False

def generate_database_url(config):
    """Generate DATABASE_URL from config"""
    if isinstance(config, str):
        return config
    
    password = config.get("password", "")
    if not password:
        password = input(f"Enter password for user '{config['user']}': ").strip()
    
    db_url = (
        f"postgresql://{config['user']}:{password}@"
        f"{config['host']}:{config['port']}/{config['database']}"
    )
    return db_url

def test_connection(db_url):
    """Test database connection"""
    print_step(5, "Testing database connection...")
    
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

def save_env_file(db_url):
    """Save DATABASE_URL to .env file"""
    print_step(6, "Saving configuration...")
    
    env_file = project_root / ".env"
    backend_env_file = backend_dir / ".env"
    

    target_file = None
    if env_file.exists():
        target_file = env_file
    elif backend_env_file.exists():
        target_file = backend_env_file
    else:

        target_file = env_file
    

    existing_content = ""
    if target_file.exists():
        with open(target_file, "r") as f:
            existing_content = f.read()
    

    if "DATABASE_URL=" in existing_content:
        print(f"⚠️  DATABASE_URL already exists in {target_file}")
        replace = input("Replace existing DATABASE_URL? (y/N): ").strip().lower()
        if replace == 'y':

            lines = existing_content.split("\n")
            new_lines = []
            for line in lines:
                if line.startswith("DATABASE_URL="):
                    new_lines.append(f'DATABASE_URL="{db_url}"')
                else:
                    new_lines.append(line)
            existing_content = "\n".join(new_lines)
        else:
            print(f"📋 Add this to your {target_file}:")
            print(f'   DATABASE_URL="{db_url}"')
            return
    else:

        if existing_content and not existing_content.endswith("\n"):
            existing_content += "\n"
        existing_content += f'DATABASE_URL="{db_url}"\n'
    

    with open(target_file, "w") as f:
        f.write(existing_content)
    
    print(f"✅ Configuration saved to {target_file}")

def main():
    """Main function"""
    print_header("PostgreSQL Database Setup")
    
    print("This script will help you set up PostgreSQL for the panel application.")
    print("It will:")
    print("  1. Check if PostgreSQL is running")
    print("  2. Create database user (if needed)")
    print("  3. Create database (if needed)")
    print("  4. Test connection")
    print("  5. Save configuration to .env file")
    print()
    

    if not check_postgres_running():
        print("\n❌ PostgreSQL is not running or not accessible.")
        print("   Please start PostgreSQL and try again.")
        print("\n   On macOS: brew services start postgresql")
        print("   On Linux: sudo systemctl start postgresql")
        print("   On Windows: Start PostgreSQL service from Services")
        return False
    

    config = get_db_config()
    
    if isinstance(config, str):

        db_url = config
        print(f"\n✅ Using existing DATABASE_URL")
    else:


        if not create_database_user(config):
            print("\n❌ Failed to create database user")
            return False
        

        if not create_database(config):
            print("\n❌ Failed to create database")
            return False
        

        db_url = generate_database_url(config)
    

    if not test_connection(db_url):
        print("\n❌ Connection test failed")
        print("   Please check your database credentials and try again")
        return False
    

    save_env_file(db_url)
    
    print_header("Setup Complete!")
    print("✅ Database setup completed successfully!")
    print()
    print("Next steps:")
    print("  1. Set other required environment variables (see README.md)")
    print("  2. Run migrations: python backend/scripts/full_reset_and_migrate.py")
    print("  3. Create an owner: python backend/scripts/create_owner.py")
    print()
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
