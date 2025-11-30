# Security Documentation

This document describes security measures implemented in the application.

## Table of Contents

1. [PostgreSQL Row Level Security (RLS)](#postgresql-row-level-security-rls)
2. [Envelope Encryption](#envelope-encryption)
3. [Redis Integrity Protection](#redis-integrity-protection)
4. [Database Connection Security](#database-connection-security)
5. [Best Practices](#best-practices)

---

## PostgreSQL Row Level Security (RLS)

### Overview

PostgreSQL Row Level Security (RLS) provides database-level data isolation for multi-tenant applications. Even if application code forgets to filter by `project_id`, the database itself will prevent unauthorized data access.

### Implementation

- **Location:** `backend/utils/postgresql_rls.py`
- **Migration:** `backend/migrations/versions/add_postgresql_rls.py`

### How It Works

1. RLS policies are enabled on all project-scoped tables
2. A PostgreSQL session variable `app.current_project_id` is set for each request
3. RLS policies automatically filter queries based on this session variable
4. Even SQL injection attacks cannot bypass RLS policies

### Usage

```python
from backend.utils.postgresql_rls import set_project_context

# In middleware or route handler:
set_project_context(project_id=123)

# All subsequent queries are automatically filtered
keys = Key.query.all()  # Only returns keys for project_id=123
```

### Security Benefits

- **Defense in depth:** Even if application code has bugs, RLS prevents data leaks
- **SQL injection protection:** RLS policies apply even to raw SQL queries
- **Audit trail:** All queries are logged with project context

### Configuration

RLS is enabled by default for all tables with `project_id` column. To disable for a specific table (not recommended):

```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

---

## Envelope Encryption

### Overview

Envelope Encryption (DEK/KEK pattern) encrypts project encryption keys with a master key stored only in environment variables. This protects data even if the database is compromised.

### Implementation

- **Location:** `backend/utils/envelope_encryption.py`
- **Model:** `backend/models/core.py::ProjectEncryptionKeys`

### Architecture

```
┌─────────────────────────────────────────┐
│  KEK (from PROJECT_MASTER_KEY env)      │
│  - Only in memory/env                   │
│  - Never written to DB                  │
└─────────────────────────────────────────┘
              │
              │ encrypts
              ▼
┌─────────────────────────────────────────┐
│  DEK (encrypted project key)            │
│  - Stored in ProjectEncryptionKeys      │
│  - Encrypted with KEK                   │
└─────────────────────────────────────────┘
              │
              │ encrypts
              ▼
┌─────────────────────────────────────────┐
│  Project Data                            │
│  - Encrypted with DEK                    │
└─────────────────────────────────────────┘
```

### Configuration

Set `PROJECT_MASTER_KEY` environment variable (64 hex characters = 32 bytes):

```bash
# Generate a secure key:
python -c 'import secrets; print(secrets.token_hex(32))'

# Set in environment:
export PROJECT_MASTER_KEY=<generated_key>
```

### Security Benefits

- **Database dump protection:** Even if database is dumped, keys cannot be decrypted without KEK
- **Key rotation:** Can rotate KEK without re-encrypting all data (re-encrypt only DEKs)
- **Audit compliance:** Meets requirements for encryption key management

### Key Rotation

To rotate the master key:

1. Generate new `PROJECT_MASTER_KEY`
2. Re-encrypt all DEKs with new KEK
3. Update environment variable
4. Restart application

**Note:** Key rotation process is not yet automated. Manual migration script required.

---

## Redis Integrity Protection

### Overview

Redis Integrity Protection uses HMAC signatures to detect unauthorized modifications to critical Redis data (sessions, configs, challenges).

### Implementation

- **Location:** `backend/utils/redis_integrity.py`
- **Config:** `REDIS_INTEGRITY_ENABLED` (default: `false`)

### When to Enable

**Enable if:**
- Redis is not using TLS encryption
- Redis is accessible over untrusted networks
- You need additional protection beyond TLS

**Disable if:**
- Redis uses TLS (`REDIS_PERSISTENT_SSL=true`)
- Redis is inside a secure VPC with network isolation
- Performance is more important than additional integrity checks

### Automatic Detection

The system automatically disables Redis Integrity Protection if `REDIS_PERSISTENT_SSL=true` is set, as HMAC signing is redundant when TLS encryption is already in place.

### Configuration

```bash
# Enable (only if Redis doesn't use TLS):
REDIS_INTEGRITY_ENABLED=true

# Recommended: Use TLS instead:
REDIS_PERSISTENT_SSL=true
```

### Protected Keys

The following key patterns are protected when enabled:
- `dynamic_config:*` - Dynamic configuration
- `session:*` - User sessions
- `challenge:*` - Authentication challenges
- `nonce:*` - Cryptographic nonces

### Performance Impact

- **CPU overhead:** ~5-10% for HMAC operations
- **Memory overhead:** ~10-15% for signature storage
- **Recommendation:** Use TLS instead for better performance

---

## Database Connection Security

### Overview

Database connections are managed securely to prevent connection leaks and unauthorized access.

### Celery Tasks

Celery tasks use a separate database engine with connection pooling to prevent leaks:

- **Location:** `backend/utils/celery_db_session.py`
- **Context Manager:** `celery_db_session()`

### Usage

```python
from backend.utils.celery_db_session import celery_db_session

@celery_app.task
def my_task():
    with celery_db_session() as session:
        # Session is guaranteed to close even if worker crashes
        user = session.query(User).get(user_id)
        session.commit()
    # Session automatically closed here
```

### Connection Pool Settings

- **pool_size:** 10 connections
- **max_overflow:** 20 additional connections
- **pool_pre_ping:** True (verify connections before use)
- **pool_recycle:** 3600 seconds (recycle connections hourly)

### Monitoring

Connection pool statistics are available:

```python
from backend.utils.celery_db_session import get_pool_stats

stats = get_pool_stats()
# Returns: size, checked_in, checked_out, overflow, invalid
```

---

## Best Practices

### 1. Environment Variables

**Never commit secrets to version control.** Use environment variables:

```bash
# Required for production:
PROJECT_MASTER_KEY=<64-char hex string>
SECRET_KEY=<Flask secret key>
DATABASE_URL=<PostgreSQL connection string>

# Recommended:
REDIS_PERSISTENT_SSL=true
REDIS_INTEGRITY_ENABLED=false  # Disable if using TLS
```

### 2. Database Access

- Always use RLS context for project-scoped queries
- Never bypass RLS unless absolutely necessary (admin operations)
- Use parameterized queries to prevent SQL injection

### 3. Redis Security

- **Production:** Always use TLS (`REDIS_PERSISTENT_SSL=true`)
- **Development:** Can use unencrypted Redis if in secure network
- **Integrity Protection:** Only enable if not using TLS

### 4. Key Management

- Rotate `PROJECT_MASTER_KEY` periodically (annually recommended)
- Store keys in secure key management service (AWS KMS, HashiCorp Vault)
- Never log keys or include them in error messages

### 5. Monitoring

Monitor for:
- RLS policy violations (queries blocked by RLS)
- Redis integrity errors (HMAC verification failures)
- Database connection leaks (pool size growth)
- Encryption/decryption errors

### 6. Incident Response

If a security incident occurs:

1. **Rotate all keys immediately:**
   - `PROJECT_MASTER_KEY`
   - `SECRET_KEY`
   - Database passwords
   - Redis passwords

2. **Review access logs:**
   - Check for unauthorized database access
   - Review RLS policy violations
   - Analyze Redis integrity errors

3. **Notify affected users:**
   - If data was potentially accessed
   - Follow data breach notification requirements

---

## Security Checklist

Before deploying to production:

- [ ] `PROJECT_MASTER_KEY` is set and secure
- [ ] `SECRET_KEY` is set and unique
- [ ] Database uses strong passwords
- [ ] Redis uses TLS (`REDIS_PERSISTENT_SSL=true`)
- [ ] RLS is enabled on all project-scoped tables
- [ ] All environment variables are set correctly
- [ ] Connection pooling is configured
- [ ] Monitoring is set up for security events
- [ ] Backup and recovery procedures are tested
- [ ] Incident response plan is documented

---

## Additional Resources

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Envelope Encryption Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- [Redis Security Guide](https://redis.io/topics/security)

---

## Reporting Security Issues

If you discover a security vulnerability, please report it to the security team immediately. Do not create public issues for security vulnerabilities.

**Contact:** [security@example.com] (update with actual contact)

**Response Time:** We aim to respond within 24 hours and resolve critical issues within 7 days.

