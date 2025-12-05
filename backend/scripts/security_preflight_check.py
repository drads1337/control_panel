"""
Security Pre-Flight Check
=========================

This script performs comprehensive security configuration checks before application startup.
It HARD FAILS (exits with non-zero code) if critical security settings are disabled or misconfigured
in production environment.

CRITICAL: This script must be run before starting the application in production.
It prevents running with insecure default configurations.

Usage:
    python -m backend.scripts.security_preflight_check
    
    Or as a pre-startup check:
    python -m backend.scripts.security_preflight_check && python -m backend.scripts.run

Exit Codes:
    0: All security checks passed
    1: Critical security issues found (application MUST NOT start)
"""

import sys
import os
import logging
from typing import List, Tuple

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SecurityPreflightCheck:
    """Comprehensive security configuration checker for production environments."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.is_production = False
        
    def check_all(self) -> Tuple[bool, List[str], List[str]]:
        """
        Run all security checks.
        
        Returns:
            Tuple of (passed, errors, warnings)
        """
        logger.info("=" * 80)
        logger.info("SECURITY PRE-FLIGHT CHECK")
        logger.info("=" * 80)
        
        # First, check if we're in production
        self._check_environment()
        
        # Only enforce strict checks in production
        if not self.is_production:
            logger.warning("⚠️  Running in non-production mode. Some checks are relaxed.")
            logger.warning("   For production, set FLASK_ENV=production")
        
        # Critical checks (fail hard in production)
        self._check_critical_secrets()
        self._check_encryption_keys()
        self._check_rls_enforcement()
        self._check_redis_security()
        self._check_jwt_security()
        self._check_encryption_functionality()
        
        # Warning checks (informational in production)
        self._check_mtls_configuration()
        self._check_cors_configuration()
        
        passed = len(self.errors) == 0
        
        logger.info("=" * 80)
        if passed:
            logger.info("✅ ALL SECURITY CHECKS PASSED")
            if self.warnings:
                logger.warning(f"⚠️  {len(self.warnings)} warnings (non-critical):")
                for warning in self.warnings:
                    logger.warning(f"   - {warning}")
        else:
            logger.error(f"❌ {len(self.errors)} CRITICAL SECURITY ISSUES FOUND:")
            for error in self.errors:
                logger.error(f"   - {error}")
            logger.error("")
            logger.error("🚫 APPLICATION MUST NOT START IN THIS CONFIGURATION")
            logger.error("   Fix the issues above before starting the application.")
        logger.info("=" * 80)
        
        return passed, self.errors, self.warnings
    
    def _check_environment(self):
        """Check if running in production environment."""
        flask_env = os.environ.get("FLASK_ENV", "production")
        self.is_production = flask_env == "production"
        
        if self.is_production:
            logger.info("✓ Running in PRODUCTION mode")
        else:
            logger.info(f"✓ Running in {flask_env.upper()} mode")
    
    def _check_critical_secrets(self):
        """Check that all critical secrets are set."""
        logger.info("\n[1/8] Checking critical secrets...")
        
        required_secrets = {
            "PANEL_MASTER_KEY": {
                "description": "Master key for application encryption",
                "min_length": 64,
                "validate_hex": True,
            },
            "SECRET_KEY": {
                "description": "Flask secret key for session management",
                "min_length": 32,
                "validate_hex": False,
            },
            "JWT_SECRET_KEY": {
                "description": "JWT token signing key",
                "min_length": 32,
                "validate_hex": False,
            },
            "OFFLINE_TICKET_SECRET": {
                "description": "Secret for offline ticket validation",
                "min_length": 32,
                "validate_hex": False,
            },
            "TOKEN_STATIC_WORD": {
                "description": "Static word for token generation",
                "min_length": 16,
                "validate_hex": False,
            },
        }
        
        for secret_name, config in required_secrets.items():
            value = os.environ.get(secret_name)
            
            if not value:
                error_msg = (
                    f"{secret_name} is not set. "
                    f"{config['description']}. "
                    f"This is REQUIRED in production."
                )
                self.errors.append(error_msg)
                logger.error(f"  ❌ {secret_name}: NOT SET")
                continue
            
            if len(value) < config["min_length"]:
                error_msg = (
                    f"{secret_name} is too short (minimum {config['min_length']} characters). "
                    f"Current length: {len(value)}"
                )
                self.errors.append(error_msg)
                logger.error(f"  ❌ {secret_name}: TOO SHORT ({len(value)} < {config['min_length']})")
                continue
            
            if config.get("validate_hex") and not all(c in "0123456789abcdefABCDEF" for c in value):
                error_msg = (
                    f"{secret_name} must be a valid hex string (64 hex characters). "
                    f"Generate with: python -c 'import secrets; print(secrets.token_hex(32))'"
                )
                self.errors.append(error_msg)
                logger.error(f"  ❌ {secret_name}: INVALID HEX FORMAT")
                continue
            
            logger.info(f"  ✓ {secret_name}: Set (length: {len(value)})")
    
    def _check_encryption_keys(self):
        """Check that encryption keys are properly configured."""
        logger.info("\n[2/8] Checking encryption keys...")
        
        # Check PROJECT_MASTER_KEY (for envelope encryption)
        project_master_key = os.environ.get("PROJECT_MASTER_KEY")
        
        if not project_master_key:
            error_msg = (
                "PROJECT_MASTER_KEY is not set. "
                "This key is used for Envelope Encryption of project keys. "
                "REQUIRED in production. "
                "Generate with: python -c 'import secrets; print(secrets.token_hex(32))'"
            )
            self.errors.append(error_msg)
            logger.error("  ❌ PROJECT_MASTER_KEY: NOT SET")
            return
        
        if len(project_master_key) != 64:
            error_msg = (
                f"PROJECT_MASTER_KEY must be exactly 64 hex characters (32 bytes). "
                f"Current length: {len(project_master_key)}"
            )
            self.errors.append(error_msg)
            logger.error(f"  ❌ PROJECT_MASTER_KEY: INVALID LENGTH ({len(project_master_key)} != 64)")
            return
        
        if not all(c in "0123456789abcdefABCDEF" for c in project_master_key):
            error_msg = (
                "PROJECT_MASTER_KEY must be a valid hex string. "
                "Generate with: python -c 'import secrets; print(secrets.token_hex(32))'"
            )
            self.errors.append(error_msg)
            logger.error("  ❌ PROJECT_MASTER_KEY: INVALID HEX FORMAT")
            return
        
        logger.info("  ✓ PROJECT_MASTER_KEY: Valid format")
        
        # Check if old key is set (during rotation)
        project_master_key_old = os.environ.get("PROJECT_MASTER_KEY_OLD")
        if project_master_key_old:
            logger.info("  ℹ️  PROJECT_MASTER_KEY_OLD: Set (key rotation in progress)")
            if len(project_master_key_old) != 64:
                warning_msg = (
                    "PROJECT_MASTER_KEY_OLD has invalid length. "
                    "Key rotation may fail."
                )
                self.warnings.append(warning_msg)
                logger.warning(f"  ⚠️  PROJECT_MASTER_KEY_OLD: INVALID LENGTH ({len(project_master_key_old)})")
    
    def _check_rls_enforcement(self):
        """Check that PostgreSQL RLS is enabled and working."""
        logger.info("\n[3/8] Checking PostgreSQL RLS enforcement...")
        
        if not self.is_production:
            logger.info("  ℹ️  Skipping RLS check in non-production mode")
            return
        
        try:
            from backend.core.app import create_app
            from backend.core.extensions import db
            from backend.utils.postgresql_rls import set_project_context, get_current_project_id_from_db, clear_project_context
            from sqlalchemy import text
            
            app = create_app()
            with app.app_context():
                # Check if RLS functions exist
                with db.engine.connect() as conn:
                    result = conn.execute(text("""
                        SELECT EXISTS (
                            SELECT 1 FROM pg_proc 
                            WHERE proname = 'set_project_context'
                        )
                    """))
                    functions_exist = result.scalar()
                    
                    if not functions_exist:
                        error_msg = (
                            "PostgreSQL RLS functions not found. "
                            "RLS migration may not have been applied. "
                            "This is CRITICAL for data isolation in production."
                        )
                        self.errors.append(error_msg)
                        logger.error("  ❌ RLS functions: NOT FOUND")
                        return
                    
                    logger.info("  ✓ RLS functions: Exist")
                
                # Check if RLS is enabled on critical tables
                critical_tables = ['key', 'user', 'product', 'project', 'project_encryption_keys']
                with db.engine.connect() as conn:
                    for table_name in critical_tables:
                        result = conn.execute(text("""
                            SELECT rowsecurity 
                            FROM pg_tables 
                            WHERE schemaname = 'public' AND tablename = :table_name
                        """), {"table_name": table_name})
                        
                        row = result.first()
                        if not row:
                            warning_msg = f"Table '{table_name}' not found (may be expected)"
                            self.warnings.append(warning_msg)
                            logger.warning(f"  ⚠️  Table '{table_name}': NOT FOUND")
                            continue
                        
                        rls_enabled = row[0]
                        if not rls_enabled:
                            error_msg = (
                                f"RLS is not enabled on table '{table_name}'. "
                                "This is CRITICAL for data isolation in production."
                            )
                            self.errors.append(error_msg)
                            logger.error(f"  ❌ Table '{table_name}': RLS DISABLED")
                        else:
                            logger.info(f"  ✓ Table '{table_name}': RLS enabled")
                
                # Test RLS context setting
                test_project_id = 999999
                try:
                    set_project_context(test_project_id)
                    retrieved_id = get_current_project_id_from_db()
                    
                    if retrieved_id != test_project_id:
                        error_msg = (
                            f"RLS context setting failed: set {test_project_id}, got {retrieved_id}. "
                            "RLS may not be working correctly."
                        )
                        self.errors.append(error_msg)
                        logger.error(f"  ❌ RLS context: FAILED (set {test_project_id}, got {retrieved_id})")
                    else:
                        logger.info("  ✓ RLS context: Working correctly")
                    
                    clear_project_context()
                except Exception as e:
                    error_msg = (
                        f"RLS context test failed: {e}. "
                        "RLS may not be properly configured."
                    )
                    self.errors.append(error_msg)
                    logger.error(f"  ❌ RLS context test: FAILED ({e})")
                    
        except Exception as e:
            error_msg = (
                f"Failed to check RLS enforcement: {e}. "
                "This check is CRITICAL in production."
            )
            self.errors.append(error_msg)
            logger.error(f"  ❌ RLS check: FAILED ({e})")
    
    def _check_redis_security(self):
        """Check that Redis has security protections enabled."""
        logger.info("\n[4/8] Checking Redis security...")
        
        if not self.is_production:
            logger.info("  ℹ️  Skipping strict Redis security check in non-production mode")
            return
        
        redis_ssl = os.environ.get("REDIS_PERSISTENT_SSL", "false").lower() == "true"
        redis_integrity = os.environ.get("REDIS_INTEGRITY_ENABLED", "false").lower() == "true"
        
        # At least one protection must be enabled
        if not redis_ssl and not redis_integrity:
            error_msg = (
                "Redis security protection is not enabled. "
                "Either REDIS_PERSISTENT_SSL=true or REDIS_INTEGRITY_ENABLED=true must be set. "
                "This is REQUIRED in production to protect session data and rate limiting."
            )
            self.errors.append(error_msg)
            logger.error("  ❌ Redis security: NO PROTECTION ENABLED")
            logger.error("     Set REDIS_PERSISTENT_SSL=true OR REDIS_INTEGRITY_ENABLED=true")
        else:
            if redis_ssl:
                logger.info("  ✓ Redis SSL/TLS: Enabled")
            if redis_integrity:
                logger.info("  ✓ Redis Integrity Protection: Enabled")
        
        # Check Redis password
        redis_password = os.environ.get("REDIS_PERSISTENT_PASSWORD") or os.environ.get("REDIS_PASSWORD")
        if not redis_password:
            warning_msg = (
                "Redis password is not set. "
                "Consider setting REDIS_PERSISTENT_PASSWORD for production."
            )
            self.warnings.append(warning_msg)
            logger.warning("  ⚠️  Redis password: NOT SET")
        else:
            logger.info("  ✓ Redis password: Set")
    
    def _check_jwt_security(self):
        """Check JWT security configuration."""
        logger.info("\n[5/8] Checking JWT security...")
        
        flask_env = os.environ.get("FLASK_ENV", "production")
        
        # In production, JWT cookies must be secure
        if self.is_production:
            # This is checked at runtime in config.py, but we verify the environment
            logger.info("  ✓ JWT_COOKIE_SECURE: Will be enabled in production (checked at runtime)")
        
        # Check JWT secret key (already checked in _check_critical_secrets)
        jwt_secret = os.environ.get("JWT_SECRET_KEY")
        if jwt_secret and len(jwt_secret) >= 32:
            logger.info("  ✓ JWT_SECRET_KEY: Valid")
        else:
            # Already logged in _check_critical_secrets
            pass
    
    def _check_encryption_functionality(self):
        """Test that encryption/decryption actually works."""
        logger.info("\n[6/8] Testing encryption functionality...")
        
        try:
            from backend.utils.envelope_encryption import EnvelopeKeyManager
            
            # Test encryption/decryption
            test_data = b"test_encryption_data_12345"
            
            # Get KEK
            try:
                kek = EnvelopeKeyManager._get_kek_from_env(use_old=False)
                if not kek:
                    error_msg = (
                        "Failed to get KEK from PROJECT_MASTER_KEY. "
                        "Encryption will not work."
                    )
                    self.errors.append(error_msg)
                    logger.error("  ❌ Encryption: FAILED TO GET KEK")
                    return
            except Exception as e:
                error_msg = (
                    f"Failed to initialize encryption: {e}. "
                    "PROJECT_MASTER_KEY may be invalid."
                )
                self.errors.append(error_msg)
                logger.error(f"  ❌ Encryption initialization: FAILED ({e})")
                return
            
            # Test encryption
            try:
                encrypted = EnvelopeKeyManager.encrypt(test_data)
                if not encrypted:
                    error_msg = "Encryption test failed: encryption returned None"
                    self.errors.append(error_msg)
                    logger.error("  ❌ Encryption test: FAILED (returned None)")
                    return
            except Exception as e:
                error_msg = f"Encryption test failed: {e}"
                self.errors.append(error_msg)
                logger.error(f"  ❌ Encryption test: FAILED ({e})")
                return
            
            # Test decryption
            try:
                decrypted = EnvelopeKeyManager.decrypt(encrypted)
                if decrypted != test_data:
                    error_msg = (
                        f"Decryption test failed: data mismatch. "
                        "Encryption/decryption may not be working correctly."
                    )
                    self.errors.append(error_msg)
                    logger.error("  ❌ Decryption test: FAILED (data mismatch)")
                    return
            except Exception as e:
                error_msg = f"Decryption test failed: {e}"
                self.errors.append(error_msg)
                logger.error(f"  ❌ Decryption test: FAILED ({e})")
                return
            
            logger.info("  ✓ Encryption/Decryption: Working correctly")
            
        except ImportError as e:
            error_msg = (
                f"Failed to import encryption module: {e}. "
                "Encryption functionality may not be available."
            )
            self.errors.append(error_msg)
            logger.error(f"  ❌ Encryption import: FAILED ({e})")
        except Exception as e:
            error_msg = f"Encryption functionality check failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"  ❌ Encryption check: FAILED ({e})")
    
    def _check_mtls_configuration(self):
        """Check mTLS configuration (warning only)."""
        logger.info("\n[7/8] Checking mTLS configuration...")
        
        mtls_required = os.environ.get("MTLS_REQUIRE_WSGI_VARS", "true").lower() == "true"
        
        if mtls_required:
            logger.info("  ✓ MTLS requirement: Enabled")
        else:
            warning_msg = (
                "MTLS_REQUIRE_WSGI_VARS is disabled. "
                "If mTLS is used in your infrastructure, this should be enabled."
            )
            self.warnings.append(warning_msg)
            logger.warning("  ⚠️  MTLS requirement: Disabled")
    
    def _check_cors_configuration(self):
        """Check CORS configuration (warning only)."""
        logger.info("\n[8/8] Checking CORS configuration...")
        
        if self.is_production:
            cors_origins = os.environ.get("PRODUCTION_CORS_ORIGINS", "")
            if not cors_origins or cors_origins.strip() == "":
                warning_msg = (
                    "PRODUCTION_CORS_ORIGINS is not set. "
                    "CORS may be too permissive. "
                    "Set PRODUCTION_CORS_ORIGINS with your production frontend URLs."
                )
                self.warnings.append(warning_msg)
                logger.warning("  ⚠️  PRODUCTION_CORS_ORIGINS: NOT SET")
            else:
                origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
                logger.info(f"  ✓ PRODUCTION_CORS_ORIGINS: Set ({len(origins)} origins)")
        else:
            logger.info("  ℹ️  CORS check skipped in non-production mode")


def main():
    """Run security pre-flight check."""
    checker = SecurityPreflightCheck()
    passed, errors, warnings = checker.check_all()
    
    if not passed:
        logger.error("\n🚫 PRE-FLIGHT CHECK FAILED")
        logger.error("   Application MUST NOT start with these security issues.")
        logger.error("   Fix the errors above and run the check again.")
        sys.exit(1)
    
    if warnings:
        logger.warning(f"\n⚠️  {len(warnings)} warnings found (non-critical)")
        logger.warning("   Review warnings above and fix if applicable.")
    
    logger.info("\n✅ PRE-FLIGHT CHECK PASSED")
    logger.info("   Application is safe to start.")
    sys.exit(0)


if __name__ == "__main__":
    main()

