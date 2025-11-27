
"""
SECURITY FIX: Configuration Validation Script
This script validates secure environment variables for the panel application.

IMPORTANT: In production (Kubernetes/Docker), secrets should come from:
- Kubernetes Secrets
- Docker Secrets
- AWS Secrets Manager / GCP Secret Manager / Azure Key Vault
- HashiCorp Vault
- Environment variables set by orchestrator

NOT from .env files on disk (security risk).
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
    """Generate a secure random key (for development/testing only)."""
    return secrets.token_hex(length)

def generate_secure_string(length=32):
    """Generate a secure random string (for development/testing only)."""
    return secrets.token_urlsafe(length)

def show_environment_setup_instructions():
    """
    Show instructions for setting up environment variables in production.
    """
    instructions = """
╔══════════════════════════════════════════════════════════════════════════╗
║                    PRODUCTION CONFIGURATION SETUP                         ║
╚══════════════════════════════════════════════════════════════════════════╝

⚠️  SECURITY: Do NOT use .env files in production!
   In production (Kubernetes/Docker/Cloud), secrets MUST come from:
   - Kubernetes Secrets / Docker Secrets
   - Cloud Secret Managers (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault)
   - HashiCorp Vault
   - Environment variables set by orchestrator

📋 REQUIRED ENVIRONMENT VARIABLES:
═══════════════════════════════════════════════════════════════════════════

1. PANEL_MASTER_KEY (64 hex characters / 32 bytes)
   Generate: python -c 'import secrets; print(secrets.token_hex(32))'
   Example: export PANEL_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')

2. SECRET_KEY (secure random string)
   Generate: python -c 'import secrets; print(secrets.token_urlsafe(32))'
   Example: export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')

3. JWT_SECRET_KEY (secure random string)
   Generate: python -c 'import secrets; print(secrets.token_urlsafe(32))'
   Example: export JWT_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')

4. DATABASE_URL (PostgreSQL connection string)
   Format: postgresql://username:password@host:port/database
   Example: export DATABASE_URL='postgresql://panel:password@localhost:5432/panel'

5. REDIS_HOST (Redis host)
   Example: export REDIS_HOST='127.0.0.1'

6. REDIS_PORT (Redis port)
   Example: export REDIS_PORT='6379'

7. REDIS_PASSWORD (Redis password, optional but recommended)
   Example: export REDIS_PASSWORD='your_redis_password'

8. OFFLINE_TICKET_SECRET (secure random string)
   Generate: python -c 'import secrets; print(secrets.token_urlsafe(32))'

9. TOKEN_STATIC_WORD (secure random string)
   Generate: python -c 'import secrets; print(secrets.token_urlsafe(32))'

10. FLASK_ENV (environment mode)
    Example: export FLASK_ENV='production'

🚀 KUBERNETES EXAMPLE:
═══════════════════════════════════════════════════════════════════════════

# Create secret
kubectl create secret generic panel-secrets \\
  --from-literal=PANEL_MASTER_KEY='<generated_key>' \\
  --from-literal=SECRET_KEY='<generated_key>' \\
  --from-literal=JWT_SECRET_KEY='<generated_key>' \\
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/db' \\
  --from-literal=REDIS_PASSWORD='<redis_password>'

# Use in deployment
envFrom:
  - secretRef:
      name: panel-secrets

🐳 DOCKER COMPOSE EXAMPLE:
═══════════════════════════════════════════════════════════════════════════

services:
  panel:
    environment:
      - PANEL_MASTER_KEY=${PANEL_MASTER_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
    # Or use env_file for development only:
    # env_file: .env  # ⚠️ ONLY for development!

⚠️  DEVELOPMENT MODE:
═══════════════════════════════════════════════════════════════════════════

For local development, you can use .env file:
  1. Create .env file manually (NOT recommended for production)
  2. Set FLASK_ENV=development
  3. Run: export $(cat .env | xargs)

But remember: .env files are NEVER committed to git!
   Add .env to .gitignore

🔐 SECURITY BEST PRACTICES:
═══════════════════════════════════════════════════════════════════════════

1. ✅ Use Secret Managers in production
2. ✅ Rotate keys regularly
3. ✅ Never commit secrets to git
4. ✅ Use HTTPS in production
5. ✅ Enable Redis TLS in production
6. ✅ Use separate Redis instances for cache and persistent data
7. ✅ Monitor for security issues
8. ❌ Never use .env files in production containers
9. ❌ Never hardcode secrets in code
10. ❌ Never log secrets

📖 VALIDATION:
═══════════════════════════════════════════════════════════════════════════

Run this script with 'validate' argument to check your configuration:
   python backend/config/config_setup.py validate

"""
    print(instructions)
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
    instructions = """
╔══════════════════════════════════════════════════════════════════════════╗
║                         DEPLOYMENT STEPS                                  ║
╚══════════════════════════════════════════════════════════════════════════╝

1. ✅ Validate Configuration:
   python backend/config/config_setup.py validate

2. Initialize the database:
   python backend/run.py --init-db

3. Start Celery workers for async task processing:
   python -m backend.scripts.celery_worker
   
   Or with custom options:
   celery -A backend.core.celery_app.celery_app worker \\
     --loglevel=info \\
     --concurrency=4 \\
     --queues=server_tasks,key_tasks

4. Start the main application:
   python backend/run.py

5. Verify the application is running securely:
   - Check that all endpoints require proper authentication
   - Verify multi-tenancy isolation is working
   - Test server management operations
   - Verify HTTPS is enabled in production
   - Check Redis TLS is enabled
   - Monitor logs for security warnings

"""
    print(instructions)
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
