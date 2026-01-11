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
    """Generate a secure random key (for development/testing only)."""
    return secrets.token_hex(length)

def generate_secure_string(length=32):
    """Generate a secure random string (for development/testing only)."""
    return secrets.token_urlsafe(length)

def show_environment_setup_instructions():
    """
    Show instructions for setting up environment variables in production.
    """
    logger.info("Environment setup instructions displayed", component="config_setup")

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

def show_deployment_instructions():
    """Show deployment instructions for production."""
    logger.info("Deployment instructions shown", component="config_setup")

def main():
    """Main function."""
    logger.info("Panel Configuration Validation", component="config_setup")

    if len(sys.argv) > 1 and sys.argv[1] == "validate":
        return validate_config()

    logger.info(
        "Configuration Setup and Validation Tool",
        component="config_setup",
    )
    logger.info(
        "This tool validates environment variables and shows setup instructions.",
        component="config_setup",
    )
    logger.info(
        "In production, use Secret Managers (K8s Secrets, Vault, etc.), not .env files!",
        component="config_setup",
    )

    print("\n" + "="*70)
    show_environment_setup_instructions()
    print("\n" + "="*70)
    
    response = input("\nDo you want to validate current configuration? (Y/n): ")
    if response.lower() == "n":
        logger.info("Validation skipped", component="config_setup")
        return True

    if validate_config():
        show_deployment_instructions()
        return True
    else:
        logger.error("Configuration validation failed. Please fix errors above.", component="config_setup")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
