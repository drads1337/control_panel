# Project Master Key Rotation Guide

## Overview

This guide explains how to perform zero-downtime rotation of `PROJECT_MASTER_KEY`, which is used for Envelope Encryption of project keys.

## Architecture

The system supports zero-downtime key rotation through dual-key support:

- **PROJECT_MASTER_KEY**: Current/primary key (used for encryption)
- **PROJECT_MASTER_KEY_OLD**: Previous key (used for decryption of old data)

During rotation:
1. Old data continues to be decrypted with `PROJECT_MASTER_KEY_OLD`
2. New data is encrypted with `PROJECT_MASTER_KEY`
3. Background migration can re-encrypt old data gradually

## Prerequisites

1. Access to application environment variables
2. Database access for validation
3. Ability to restart application

## Rotation Procedure

### Step 1: Generate New Key

Generate a new 64-character hex key (32 bytes):

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Save this key securely - you'll need it in Step 3.

### Step 2: Validate Current Key

Before rotation, validate that the current key works:

```bash
python backend/scripts/rotate_project_master_key.py --validate-only
```

This will:
- Check that `PROJECT_MASTER_KEY` is set
- Verify it can decrypt existing project keys
- Report any issues

### Step 3: Test Rotation

Test the rotation process (doesn't change anything):

```bash
python backend/scripts/rotate_project_master_key.py --new-key <new_key_hex>
```

This will:
- Validate current key
- Test that both old and new keys work
- Verify encryption/decryption with new key
- Print instructions for next steps

### Step 4: Update Environment Variables

Update your deployment configuration:

**Kubernetes:**
```yaml
env:
  - name: PROJECT_MASTER_KEY_OLD
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: project-master-key-old
  - name: PROJECT_MASTER_KEY
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: project-master-key-new
```

**Docker Compose:**
```yaml
environment:
  PROJECT_MASTER_KEY_OLD: ${PROJECT_MASTER_KEY_OLD}
  PROJECT_MASTER_KEY: ${PROJECT_MASTER_KEY_NEW}
```

**Environment file:**
```bash
export PROJECT_MASTER_KEY_OLD=<old_key>
export PROJECT_MASTER_KEY=<new_key>
```

### Step 5: Restart Application

Restart the application. The system will automatically:
- Use `PROJECT_MASTER_KEY` for new encryptions
- Use `PROJECT_MASTER_KEY_OLD` for decrypting old data
- Continue operating normally

### Step 6: (Optional) Re-encrypt All Keys

After the application is running with both keys, you can gradually re-encrypt all project keys:

```bash
python backend/scripts/rotate_project_master_key.py --re-encrypt-all
```

This will:
- Decrypt each project key with old key
- Re-encrypt with new key
- Update database
- Report progress

**Note:** This step is optional. The system will continue to work with both keys indefinitely. Re-encryption improves performance (no need to try old key first) but is not required.

### Step 7: Remove Old Key (After Re-encryption)

After all keys are re-encrypted and you've verified everything works:

1. Remove `PROJECT_MASTER_KEY_OLD` from environment
2. Restart application
3. System will use only new key

## Verification

After rotation, verify:

1. **Application logs**: Check for decryption errors
2. **Key operations**: Create/read keys to verify encryption works
3. **Database**: Verify encrypted keys exist and are valid

## Troubleshooting

### "Failed to decrypt with old key"

- Verify `PROJECT_MASTER_KEY_OLD` is set correctly
- Check that old key matches the one used for encryption
- Review application logs for specific errors

### "Failed to encrypt with new key"

- Verify `PROJECT_MASTER_KEY` is set correctly
- Check key format (must be 64 hex characters)
- Ensure key is valid hex

### Application won't start

- Check both keys are set correctly
- Verify key format (64 hex characters)
- Review startup logs for specific errors

## Security Considerations

1. **Key Storage**: Store keys in secure secret management (Kubernetes Secrets, AWS Secrets Manager, etc.)
2. **Key Backup**: Keep secure backups of both old and new keys during rotation
3. **Access Control**: Limit access to key rotation scripts and environment variables
4. **Audit**: Log all key rotation activities
5. **Testing**: Always test rotation in staging before production

## Rollback Procedure

If rotation fails:

1. **Immediate**: Restore original `PROJECT_MASTER_KEY` (remove `PROJECT_MASTER_KEY_OLD`)
2. **Restart**: Restart application
3. **Verify**: Confirm application works with original key
4. **Investigate**: Review logs to identify issue
5. **Retry**: Fix issue and retry rotation

## Best Practices

1. **Schedule**: Rotate keys regularly (e.g., every 90 days)
2. **Testing**: Always test in staging first
3. **Monitoring**: Monitor application after rotation
4. **Documentation**: Document rotation date and new key version
5. **Backup**: Keep secure backups of all keys

## Related Documentation

- [Envelope Encryption Implementation](../utils/envelope_encryption.py)
- [Security Best Practices](./SECURITY.md)

