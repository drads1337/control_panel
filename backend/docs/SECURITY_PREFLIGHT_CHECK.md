# Security Pre-Flight Check

## Overview

The Security Pre-Flight Check is a comprehensive script that validates all critical security configurations before the application starts in production. It **HARD FAILS** (exits with non-zero code) if critical security settings are disabled or misconfigured.

**CRITICAL**: This script must be run before starting the application in production to prevent running with insecure default configurations.

## Purpose

This script addresses the security audit concern about configuration complexity:

> "Множество переключателей безопасности (MTLS_REQUIRE_WSGI_VARS, REDIS_INTEGRITY_ENABLED и т.д.). Ошибка в конфигурации может незаметно отключить критическую защиту. Нужен скрипт 'pre-flight check', который жестко падает, если в проде отключен, например, RLS или шифрование."

## What It Checks

### Critical Checks (Fail Hard in Production)

1. **Critical Secrets**
   - `PANEL_MASTER_KEY` - Must be set, 64 hex characters
   - `SECRET_KEY` - Must be set, minimum 32 characters
   - `JWT_SECRET_KEY` - Must be set, minimum 32 characters
   - `OFFLINE_TICKET_SECRET` - Must be set, minimum 32 characters
   - `TOKEN_STATIC_WORD` - Must be set, minimum 16 characters

2. **Encryption Keys**
   - `PROJECT_MASTER_KEY` - Must be set, exactly 64 hex characters (32 bytes)
   - Validates hex format
   - Checks for key rotation state (`PROJECT_MASTER_KEY_OLD`)

3. **PostgreSQL RLS (Row Level Security)**
   - Verifies RLS functions exist (`set_project_context`, `clear_project_context`, `get_current_project_id`)
   - Checks RLS is enabled on critical tables (`key`, `user`, `product`, `project`, `project_encryption_keys`)
   - Tests RLS context setting/retrieval functionality

4. **Redis Security**
   - At least one protection must be enabled:
     - `REDIS_PERSISTENT_SSL=true` OR
     - `REDIS_INTEGRITY_ENABLED=true`
   - Checks Redis password is set (warning only)

5. **JWT Security**
   - Validates JWT secret key format
   - Ensures secure cookie settings in production

6. **Encryption Functionality**
   - Tests actual encryption/decryption with `PROJECT_MASTER_KEY`
   - Verifies Envelope Encryption is working correctly

### Warning Checks (Informational)

7. **mTLS Configuration**
   - Checks `MTLS_REQUIRE_WSGI_VARS` setting

8. **CORS Configuration**
   - Validates `PRODUCTION_CORS_ORIGINS` is set in production

## Usage

### Standalone Check

Run the check before starting the application:

```bash
# Run pre-flight check
python -m backend.scripts.security_preflight_check

# If check passes, start the application
python -m backend.scripts.run
```

### In CI/CD Pipeline

Add to your deployment pipeline:

```bash
# Pre-deployment check
python -m backend.scripts.security_preflight_check || exit 1

# Deploy application
# ... your deployment commands ...
```

### In Docker/Kubernetes

Add as a pre-startup check in your container:

```dockerfile
# In Dockerfile or entrypoint script
RUN python -m backend.scripts.security_preflight_check && \
    gunicorn -c scripts/gunicorn.conf.py scripts.wsgi:application
```

Or in Kubernetes:

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: backend
    command: ["/bin/sh", "-c"]
    args:
      - |
        python -m backend.scripts.security_preflight_check && \
        gunicorn -c scripts/gunicorn.conf.py scripts.wsgi:application
```

### As a Systemd Pre-Start Check

In your systemd service file:

```ini
[Service]
ExecStartPre=/usr/bin/python3 -m backend.scripts.security_preflight_check
ExecStart=/usr/bin/gunicorn -c scripts/gunicorn.conf.py scripts.wsgi:application
```

## Exit Codes

- `0` - All security checks passed. Application is safe to start.
- `1` - Critical security issues found. **Application MUST NOT start.**

## Example Output

### Success

```
================================================================================
SECURITY PRE-FLIGHT CHECK
================================================================================
✓ Running in PRODUCTION mode

[1/8] Checking critical secrets...
  ✓ PANEL_MASTER_KEY: Set (length: 64)
  ✓ SECRET_KEY: Set (length: 64)
  ✓ JWT_SECRET_KEY: Set (length: 64)
  ✓ OFFLINE_TICKET_SECRET: Set (length: 64)
  ✓ TOKEN_STATIC_WORD: Set (length: 32)

[2/8] Checking encryption keys...
  ✓ PROJECT_MASTER_KEY: Valid format

[3/8] Checking PostgreSQL RLS enforcement...
  ✓ RLS functions: Exist
  ✓ Table 'key': RLS enabled
  ✓ Table 'user': RLS enabled
  ✓ Table 'product': RLS enabled
  ✓ Table 'project': RLS enabled
  ✓ Table 'project_encryption_keys': RLS enabled
  ✓ RLS context: Working correctly

[4/8] Checking Redis security...
  ✓ Redis SSL/TLS: Enabled
  ✓ Redis password: Set

[5/8] Checking JWT security...
  ✓ JWT_SECRET_KEY: Valid

[6/8] Testing encryption functionality...
  ✓ Encryption/Decryption: Working correctly

[7/8] Checking mTLS configuration...
  ✓ MTLS requirement: Enabled

[8/8] Checking CORS configuration...
  ✓ PRODUCTION_CORS_ORIGINS: Set (2 origins)

================================================================================
✅ ALL SECURITY CHECKS PASSED
================================================================================

✅ PRE-FLIGHT CHECK PASSED
   Application is safe to start.
```

### Failure

```
================================================================================
SECURITY PRE-FLIGHT CHECK
================================================================================
✓ Running in PRODUCTION mode

[1/8] Checking critical secrets...
  ✓ PANEL_MASTER_KEY: Set (length: 64)
  ❌ SECRET_KEY: NOT SET

[2/8] Checking encryption keys...
  ❌ PROJECT_MASTER_KEY: NOT SET

[3/8] Checking PostgreSQL RLS enforcement...
  ❌ RLS functions: NOT FOUND

[4/8] Checking Redis security...
  ❌ Redis security: NO PROTECTION ENABLED
     Set REDIS_PERSISTENT_SSL=true OR REDIS_INTEGRITY_ENABLED=true

================================================================================
❌ 4 CRITICAL SECURITY ISSUES FOUND:
   - SECRET_KEY is not set. Flask secret key for session management. This is REQUIRED in production.
   - PROJECT_MASTER_KEY is not set. This key is used for Envelope Encryption of project keys. REQUIRED in production.
   - PostgreSQL RLS functions not found. RLS migration may not have been applied. This is CRITICAL for data isolation in production.
   - Redis security protection is not enabled. Either REDIS_PERSISTENT_SSL=true or REDIS_INTEGRITY_ENABLED=true must be set.

🚫 APPLICATION MUST NOT START IN THIS CONFIGURATION
   Fix the issues above before starting the application.
================================================================================

🚫 PRE-FLIGHT CHECK FAILED
   Application MUST NOT start with these security issues.
   Fix the errors above and run the check again.
```

## Integration with Application Startup

You can optionally integrate the check into the application startup process by setting an environment variable:

```bash
# Enable pre-flight check before app startup
export ENABLE_SECURITY_PREFLIGHT_CHECK=true
python -m backend.scripts.run
```

However, it's recommended to run the check **separately** before starting the application, as it provides clearer feedback and doesn't require importing the full application context.

## Development Mode

In non-production environments (`FLASK_ENV != "production"`), some checks are relaxed:

- RLS enforcement check is skipped (but still validates if RLS is configured)
- Redis security check is less strict
- Warnings are shown instead of errors for some non-critical settings

However, critical secrets and encryption keys are still required even in development.

## Troubleshooting

### "RLS functions not found"

This means the RLS migration hasn't been applied. Run:

```bash
python -m backend.scripts.check_rls_enforcement
```

If RLS is not set up, apply the migration that creates the RLS functions.

### "Encryption test failed"

This usually means `PROJECT_MASTER_KEY` is invalid or incorrectly formatted. Verify:

1. Key is exactly 64 hex characters
2. Key is a valid hex string (only 0-9, a-f, A-F)
3. Generate a new key if needed: `python -c 'import secrets; print(secrets.token_hex(32))'`

### "Redis security: NO PROTECTION ENABLED"

Enable at least one of:

```bash
# Option 1: Use SSL/TLS (recommended)
export REDIS_PERSISTENT_SSL=true

# Option 2: Use HMAC integrity protection
export REDIS_INTEGRITY_ENABLED=true
```

## Related Documentation

- [RLS Load Testing Guide](./RLS_LOAD_TESTING.md)
- [Key Rotation Guide](./KEY_ROTATION.md)
- [RLS Enforcement Checker](../scripts/check_rls_enforcement.py)

## Security Best Practices

1. **Always run pre-flight check in production** before starting the application
2. **Integrate into CI/CD** to catch configuration issues early
3. **Run before deployments** to prevent deploying insecure configurations
4. **Monitor warnings** and fix them even if they're non-critical
5. **Review security settings** regularly, especially after infrastructure changes

## Key Management Best Practices

### Environment Variables (Current)

Currently, keys are passed via environment variables. While functional, this has limitations:

- Keys are visible in process environment (`ps aux`, `/proc/*/environ`)
- Keys may be logged in error messages or stack traces
- Keys persist in container images if not handled carefully

### Recommended: Volume Mounts (Kubernetes)

For Kubernetes deployments, use **Secret Volume Mounts** instead of environment variables:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: panel-secrets
type: Opaque
stringData:
  PANEL_MASTER_KEY: "your-64-char-hex-key"
  PROJECT_MASTER_KEY: "your-64-char-hex-key"
  SECRET_KEY: "your-secret-key"
  JWT_SECRET_KEY: "your-jwt-secret-key"
  OFFLINE_TICKET_SECRET: "your-offline-ticket-secret"
  TOKEN_STATIC_WORD: "your-token-static-word"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: panel-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        volumeMounts:
        - name: secrets
          mountPath: /etc/panel/secrets
          readOnly: true
        env:
        - name: PANEL_MASTER_KEY
          valueFrom:
            secretKeyRef:
              name: panel-secrets
              key: PANEL_MASTER_KEY
        # ... other keys ...
      volumes:
      - name: secrets
        secret:
          secretName: panel-secrets
```

**Benefits:**
- Keys are not visible in process environment
- Keys are stored in Kubernetes Secrets (encrypted at rest)
- Keys can be rotated without rebuilding containers
- Better audit trail (who accessed secrets)

### Recommended: HashiCorp Vault Integration

For enterprise deployments, integrate with HashiCorp Vault:

```python
# Example: Load keys from Vault at startup
import hvac

def load_secrets_from_vault():
    client = hvac.Client(url=os.environ.get('VAULT_ADDR'))
    client.token = os.environ.get('VAULT_TOKEN')
    
    secrets = client.secrets.kv.v2.read_secret_version(path='panel/secrets')
    return secrets['data']['data']

# In your startup script:
if os.environ.get('USE_VAULT') == 'true':
    secrets = load_secrets_from_vault()
    os.environ.update(secrets)
```

**Benefits:**
- Centralized secret management
- Automatic key rotation
- Fine-grained access control
- Audit logging
- Integration with identity providers

### Migration Path

1. **Phase 1 (Current)**: Environment variables - works, but not ideal
2. **Phase 2 (Recommended)**: Kubernetes Secret Volume Mounts
3. **Phase 3 (Enterprise)**: HashiCorp Vault or similar secret manager

The pre-flight check works with all approaches - it only validates that keys are present and valid, regardless of how they're provided.

## Notes

- The script requires database and Redis connections to perform some checks
- Some checks may take a few seconds (RLS validation, encryption tests)
- The script is idempotent - safe to run multiple times
- All checks are read-only - no configuration is modified