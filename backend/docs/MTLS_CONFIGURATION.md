# mTLS Configuration Guide

## Overview

Mutual TLS (mTLS) provides strong authentication for agent/client connections, making it much harder to emulate requests even if challenge obfuscation is reverse-engineered.

## Critical Security Setting: MTLS_REQUIRE_WSGI_VARS

### Configuration

The `MTLS_REQUIRE_WSGI_VARS` setting controls whether the application requires WSGI environment variables for mTLS validation instead of HTTP headers.

**Default Value:** `true` (enabled by default for security)

**Environment Variable:** `MTLS_REQUIRE_WSGI_VARS`

### Why This Matters

1. **WSGI Variables (SSL_CLIENT_*)**: Set by the WSGI server (gunicorn) and are harder to spoof
2. **HTTP Headers (X-SSL-Client-*)**: Can be spoofed if Nginx is misconfigured

### Production Configuration

**CRITICAL:** In production, `MTLS_REQUIRE_WSGI_VARS` must be set to `true` to ensure security.

```bash
# Production environment variable
MTLS_REQUIRE_WSGI_VARS=true
```

### How It Works

When `MTLS_REQUIRE_WSGI_VARS=true`:

1. The application only accepts client certificate information from WSGI environment variables (`SSL_CLIENT_CERT`, `SSL_CLIENT_VERIFY`, etc.)
2. HTTP headers (`X-SSL-Client-*`) are ignored
3. If WSGI variables are not present, the request is rejected with an error

### Nginx Configuration

For mTLS to work with `MTLS_REQUIRE_WSGI_VARS=true`, Nginx must be configured to:

1. Validate client certificates
2. Pass SSL client information to the WSGI server via proxy headers
3. The WSGI server (gunicorn) must be configured to receive these headers

Example Nginx configuration:

```nginx
location / {
    proxy_pass http://backend;
    
    # Pass SSL client certificate information
    proxy_set_header X-SSL-Client-Cert $ssl_client_cert;
    proxy_set_header X-SSL-Client-Verify $ssl_client_verify;
    proxy_set_header X-SSL-Client-S-DN $ssl_client_s_dn;
}
```

### Gunicorn Configuration

Gunicorn must be configured to pass SSL client information to the WSGI application. See `backend/scripts/gunicorn.conf.py` for mTLS configuration.

### Verification

To verify that mTLS is working correctly:

1. Check application logs for `[MTLS_SECURITY]` messages
2. Ensure no warnings about "Using HTTP headers for client certificate validation"
3. Test with a valid client certificate - should succeed
4. Test without a client certificate - should fail

### Security Notes

- **Never disable** `MTLS_REQUIRE_WSGI_VARS` in production
- If you see warnings about using HTTP headers, fix your Nginx/gunicorn configuration
- Ensure Nginx strips external `X-SSL-Client-*` headers to prevent spoofing
- Regularly rotate CA certificates used for client certificate validation

## Related Files

- `backend/middleware/mtls.py` - mTLS validation middleware
- `backend/config/config.py` - Configuration (line 479)
- `backend/scripts/gunicorn.conf.py` - Gunicorn mTLS configuration
- `nginx.conf.mtls.example` - Example Nginx mTLS configuration

