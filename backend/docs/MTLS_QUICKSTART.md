# mTLS Quick Start Guide

This guide will help you quickly set up mTLS for Panel in production.

## Prerequisites

- OpenSSL installed
- Gunicorn or Nginx configured
- Access to server for certificate deployment

## Step 1: Generate Certificates

Run the automated script:

```bash
cd backend/scripts
./setup_mtls_certs.sh
```

Follow the prompts to enter:
- Server hostname (e.g., `api.example.com`)
- Client Common Name (e.g., `loader-001`)

The script will generate all necessary certificates in `/etc/ssl/panel/` (or `$CERT_DIR`).

## Step 2: Configure Environment Variables

```bash
export MTLS_ENABLED=true
export MTLS_CA_CERT_PATH=/etc/ssl/panel/ca-cert.pem
export MTLS_REQUIRED_CN=loader-*  # Optional: restrict to specific CN pattern
```

## Step 3: Configure Gunicorn

The `gunicorn.conf.py` already supports mTLS. Just set the environment variables:

```bash
export MTLS_SERVER_KEY=/etc/ssl/panel/server-key.pem
export MTLS_SERVER_CERT=/etc/ssl/panel/server-cert.pem
```

Restart Gunicorn to apply changes.

## Step 4: Configure Nginx (if using reverse proxy)

1. Edit `nginx.conf`
2. Uncomment mTLS configuration:
   ```nginx
   ssl_client_certificate /etc/ssl/panel/ca-cert.pem;
   ssl_verify_client on;
   ssl_verify_depth 2;
   ```
3. Uncomment proxy headers in `/api/` location:
   ```nginx
   proxy_set_header X-SSL-Client-Cert $ssl_client_cert;
   proxy_set_header X-SSL-Client-Verify $ssl_client_verify;
   proxy_set_header X-SSL-Client-S-DN $ssl_client_s_dn;
   ```
4. Reload Nginx: `nginx -s reload`

## Step 5: Distribute Client Certificates

Securely distribute client certificates to authorized loaders/clients:

```bash
# Copy to client (use secure method: SCP, encrypted email, etc.)
scp /etc/ssl/panel/client-cert.pem user@client:/path/to/
scp /etc/ssl/panel/client-key.pem user@client:/path/to/
scp /etc/ssl/panel/ca-cert.pem user@client:/path/to/
```

## Step 6: Test Connection

Test with curl:

```bash
curl -X POST https://api.example.com/api/connect \
    --cert /path/to/client-cert.pem \
    --key /path/to/client-key.pem \
    --cacert /path/to/ca-cert.pem \
    -H "Content-Type: application/json" \
    -d '{"blob": "..."}'
```

## Verification

1. Check Gunicorn logs for mTLS enabled message
2. Test without certificate (should fail with 403)
3. Test with certificate (should succeed)
4. Monitor Flask logs for mTLS validation messages

## Troubleshooting

### "Client certificate not provided"
- Check WSGI server is configured to request certificates
- Verify reverse proxy (if used) is passing certificate headers
- Ensure client is sending certificate in TLS handshake

### "Client certificate verification failed"
- Verify client certificate is signed by the CA
- Check certificate expiration dates
- Ensure certificate chain is complete

### "CN does not match required pattern"
- Check `MTLS_REQUIRED_CN` environment variable
- Verify client certificate CN matches the pattern
- Wildcard patterns: `loader-*` matches `loader-001`, `loader-dev`

## Security Checklist

- [ ] CA private key stored securely (chmod 600)
- [ ] Server private key stored securely (chmod 600)
- [ ] Client certificates distributed securely
- [ ] Certificate expiration dates monitored
- [ ] Certificate revocation process in place
- [ ] mTLS validation tested in staging
- [ ] Monitoring alerts configured for mTLS failures

## Next Steps

- See `MTLS_SETUP.md` for detailed configuration
- Review certificate rotation policy
- Set up certificate expiration monitoring
- Configure security alerts for failed mTLS attempts

