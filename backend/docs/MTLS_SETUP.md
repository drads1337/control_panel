# Mutual TLS (mTLS) Setup Guide

## Overview

Mutual TLS (mTLS) provides strong authentication for loader/client connections, making it much harder to emulate requests even if challenge obfuscation is reverse-engineered.

## Security Benefits

- **Strong Authentication**: Client certificates provide cryptographic proof of identity
- **Prevents Request Emulation**: Even if challenge obfuscation is reverse-engineered, attackers cannot connect without a valid client certificate
- **Defense in Depth**: Complements existing security measures (challenge obfuscation, rate limiting, etc.)

## Configuration

### Environment Variables

```bash
# Enable mTLS validation (default: false)
MTLS_ENABLED=true

# Path to CA certificate for validating client certificates (optional but recommended)
MTLS_CA_CERT_PATH=/path/to/ca-cert.pem

# Required Common Name pattern for client certificates (optional)
# Supports wildcards: "loader-*" matches "loader-001", "loader-dev"
MTLS_REQUIRED_CN=loader-*
```

### WSGI Server Configuration

mTLS must be configured at the WSGI server level. The middleware only validates certificate presence and properties.

#### Gunicorn

The `gunicorn.conf.py` file has been updated to support mTLS. Simply set environment variables:

```bash
export MTLS_ENABLED=true
export MTLS_SERVER_KEY=/path/to/server-key.pem
export MTLS_SERVER_CERT=/path/to/server-cert.pem
export MTLS_CA_CERT_PATH=/path/to/ca-cert.pem
```

Or see `backend/scripts/gunicorn.conf.mtls.example.py` for a complete example.

The configuration automatically:
- Enables mTLS when `MTLS_ENABLED=true`
- Sets `cert_reqs = 2` (require client certificate)
- Validates client certificates against the CA

#### Nginx (Reverse Proxy)

The `nginx.conf` file has been updated with mTLS configuration (commented out by default).

To enable mTLS in Nginx:

1. Uncomment the mTLS configuration in `nginx.conf`:
   ```nginx
   ssl_client_certificate /etc/nginx/ssl/ca-cert.pem;
   ssl_verify_client on;
   ssl_verify_depth 2;
   ```

2. Uncomment the proxy headers in the `/api/` location block:
   ```nginx
   proxy_set_header X-SSL-Client-Cert $ssl_client_cert;
   proxy_set_header X-SSL-Client-Verify $ssl_client_verify;
   proxy_set_header X-SSL-Client-S-DN $ssl_client_s_dn;
   ```

3. Place CA certificate at the configured path

4. Reload Nginx: `nginx -s reload`

See `nginx.conf.mtls.example` for a complete example configuration.

## Certificate Generation

### Quick Setup (Automated)

Use the provided script to generate all certificates:

```bash
cd backend/scripts
./setup_mtls_certs.sh
```

The script will:
1. Generate CA certificate and key
2. Generate server certificate and key
3. Generate client certificate and key
4. Create certificate chains
5. Display configuration instructions

### Manual Certificate Generation

#### Generate CA Certificate

```bash
# Generate CA private key
openssl genrsa -out ca-key.pem 4096

# Generate CA certificate
openssl req -new -x509 -days 3650 -key ca-key.pem -out ca-cert.pem \
    -subj "/CN=Panel CA/O=Your Organization"
```

#### Generate Server Certificate

```bash
# Generate server private key
openssl genrsa -out server-key.pem 4096

# Generate server certificate signing request
openssl req -new -key server-key.pem -out server.csr \
    -subj "/CN=api.example.com/O=Your Organization"

# Sign server certificate with CA
openssl x509 -req -days 365 -in server.csr -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out server-cert.pem
```

#### Generate Client Certificate

```bash
# Generate client private key
openssl genrsa -out client-key.pem 4096

# Generate client certificate signing request
openssl req -new -key client-key.pem -out client.csr \
    -subj "/CN=loader-001/O=Your Organization"

# Sign client certificate with CA
openssl x509 -req -days 365 -in client.csr -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out client-cert.pem
```

## Testing

### Test with curl

```bash
# Test with client certificate
curl -X POST https://api.example.com/api/connect \
    --cert client-cert.pem \
    --key client-key.pem \
    --cacert ca-cert.pem \
    -H "Content-Type: application/json" \
    -d '{"blob": "..."}'
```

### Test without client certificate (should fail)

```bash
# This should return 403 Forbidden
curl -X POST https://api.example.com/api/connect \
    --cacert ca-cert.pem \
    -H "Content-Type: application/json" \
    -d '{"blob": "..."}'
```

## Endpoints Protected by mTLS

The following endpoints require mTLS when `MTLS_ENABLED=true`:

- `/api/challenge` - Challenge generation
- `/api/connect` - Main connect endpoint
- `/api/classic_connect` - Classic connect endpoint
- `/api/heartbeat` - Heartbeat endpoint
- `/api/heartbeat/status` - Heartbeat status endpoint
- `/api/config/request` - Dynamic config request
- `/api/config/validate` - Dynamic config validation
- `/api/config/statistics` - Dynamic config statistics

## Troubleshooting

### Certificate not found

If you see "Client certificate not provided", check:

1. WSGI server is configured to request client certificates
2. Reverse proxy (if used) is passing certificate headers
3. Client is sending certificate in TLS handshake

### Certificate verification failed

If you see "Client certificate verification failed", check:

1. Client certificate is signed by the CA specified in `MTLS_CA_CERT_PATH`
2. Client certificate is not expired
3. Client certificate chain is complete

### CN pattern mismatch

If you see "Client certificate CN does not match required pattern", check:

1. `MTLS_REQUIRED_CN` pattern matches client certificate CN
2. Wildcard patterns are correctly formatted (e.g., `loader-*`)

## Security Considerations

1. **Certificate Storage**: Store CA private key securely (HSM, encrypted storage)
2. **Certificate Rotation**: Implement certificate rotation policy
3. **Revocation**: Use CRL or OCSP for certificate revocation checking
4. **Monitoring**: Monitor failed mTLS validation attempts for security alerts

