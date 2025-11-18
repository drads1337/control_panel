
"""
SECURITY FIX: Configuration Setup Script
This script helps set up secure environment variables for the panel application.
"""

import os
import secrets
import sys
from pathlib import Path

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)

def generate_secure_key(length=32):
    """Generate a secure random key."""
    return secrets.token_hex(length)

def generate_secure_string(length=32):
    """Generate a secure random string."""
    return secrets.token_urlsafe(length)

def create_env_file():
    """Create a .env file with secure configuration."""
    env_path = Path(".env")

    if env_path.exists():
        logger.warning(".env file already exists", component="config_setup")
        response = input("Do you want to overwrite it? (y/N): ")
        if response.lower() != "y":
            logger.info("Aborted", component="config_setup")
            return False

    master_key = generate_secure_key(32)
    secret_key = generate_secure_string(32)
    jwt_secret = generate_secure_string(32)

    logger.info("Database Configuration", component="config_setup")
    db_host = input("Database host [localhost]: ").strip() or "localhost"
    db_port = input("Database port [5432]: ").strip() or "5432"
    db_name = input("Database name [panel]: ").strip() or "panel"
    db_user = input("Database username [panel]: ").strip() or "panel"
    db_password = input("Database password: ").strip()

    if not db_password:
        logger.error("Database password is required", component="config_setup")
        return False

    logger.info("Redis Configuration", component="config_setup")
    redis_host = input("Redis host [127.0.0.1]: ").strip() or "127.0.0.1"
    redis_port = input("Redis port [6379]: ").strip() or "6379"
    redis_password = input("Redis password (optional): ").strip()

    env_content = f"""# SECURITY FIX: Secure Configuration

PANEL_MASTER_KEY={master_key}

SECRET_KEY={secret_key}

JWT_SECRET_KEY={jwt_secret}

DATABASE_URL=postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}

REDIS_HOST={redis_host}
REDIS_PORT={redis_port}
REDIS_PASSWORD={redis_password or ''}
REDIS_DB=0

"""

    try:
        with open(env_path, "w") as f:
            f.write(env_content)

        logger.info(
            "Secure configuration created",
            component="config_setup",
            env_path=str(env_path.absolute()),
            master_key_prefix=master_key[:16],
            secret_key_prefix=secret_key[:16],
            jwt_secret_prefix=jwt_secret[:16],
        )

        return True

    except Exception as e:
        logger.error("Failed to create .env file", component="config_setup", error=str(e))
        return False

def validate_config():
    """Validate the current configuration."""
    logger.info("Validating Configuration", component="config_setup")

    required_vars = ["PANEL_MASTER_KEY", "SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL"]

    missing_vars = []
    invalid_vars = []

    for var in required_vars:
        value = os.environ.get(var)
        if not value:
            missing_vars.append(var)
        else:

            if var == "PANEL_MASTER_KEY":
                if len(value) != 64:
                    invalid_vars.append(f"{var} (must be 64 hex characters)")
                try:
                    bytes.fromhex(value)
                except ValueError:
                    invalid_vars.append(f"{var} (invalid hex format)")

    if missing_vars:
        logger.error(
            "Missing required environment variables",
            component="config_setup",
            missing_vars=missing_vars,
        )
        return False

    if invalid_vars:
        logger.error(
            "Invalid environment variables", component="config_setup", invalid_vars=invalid_vars
        )
        return False

    logger.info("Configuration is valid", component="config_setup")
    return True

def show_instructions():
    """Show deployment instructions."""
    instructions = """
🚀 Deployment Instructions:

1. Set up your environment variables:
   export $(cat .env | xargs)

2. Initialize the database:
   python backend/run.py --init-db

3. Start Celery workers for async task processing:
   python -m backend.scripts.celery_worker

   Or with custom options:
   celery -A backend.core.celery_app.celery_app worker --loglevel=info --concurrency=4 --queues=server_tasks,key_tasks

4. Start the main application:
   python backend/run.py

5. Verify the application is running securely:
   - Check that all endpoints require proper authentication
   - Verify multi-tenancy isolation is working
   - Test server management operations

⚠️  SECURITY REMINDERS:
- Never commit the .env file to version control
- Keep your master key secure and backed up
- Use HTTPS in production
- Regularly rotate your keys
- Monitor for security issues
"""
    print(instructions)
    logger.info("Deployment instructions shown", component="config_setup")

def main():
    """Main function."""
    logger.info("Panel Configuration Setup", component="config_setup")

    if len(sys.argv) > 1 and sys.argv[1] == "validate":
        return validate_config()

    logger.info(
        "This script will help you set up secure configuration for the panel application.",
        component="config_setup",
    )
    logger.info("It will generate secure keys and create a .env file.", component="config_setup")

    response = input("\nDo you want to continue? (Y/n): ")
    if response.lower() == "n":
        logger.info("Aborted", component="config_setup")
        return False

    if create_env_file():
        show_instructions()
        return True
    else:
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
