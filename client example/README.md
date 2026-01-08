# Android Client Setup for mTLS

## Overview

This Android client uses Mutual TLS (mTLS) to authenticate with the server. The server now uses a **single CA certificate** for all clients (simplified configuration).

## Setup Instructions

### 1. Update Package Name

In `main.cpp`, replace `com.yourpackage.app` with your actual Android package name:

```cpp
constexpr const char* CLIENT_CERT_PATH = "/data/data/com.yourpackage.app/files/client-cert.pem";
constexpr const char* CLIENT_KEY_PATH = "/data/data/com.yourpackage.app/files/client-key.pem";
```

### 2. Get Client Certificates

You have two options:

#### Option A: Automatic via API (Recommended)

The client can automatically request certificates from the server:

1. Client generates a CSR (Certificate Signing Request) with CN: `project-<project_id>-<client_name>`
2. Client sends CSR to: `POST /api/projects/<project_id>/mtls/csr-sign-public`
3. Server signs CSR with single CA and returns certificate
4. Client saves certificate and key securely

**Note:** This requires a valid `user_key` to authenticate the CSR signing request.

#### Option B: Manual Generation on Server

On the server, generate certificates:

```bash
cd /var/www/panel
python3 check_license.py
# OR use the API endpoint to sign a CSR
```

Certificates will be at:
- `nginx/ssl/projects/<project_id>/clients/<client_name>/client-cert.pem`
- `nginx/ssl/projects/<project_id>/clients/<client_name>/client-key.pem`

### 3. Install Certificates in Android App

Copy certificates to your app's internal storage:

```cpp
// In your Android Java/Kotlin code:
File certFile = new File(getFilesDir(), "client-cert.pem");
File keyFile = new File(getFilesDir(), "client-key.pem");

// Copy from assets or download from server
// IMPORTANT: Keep private key secure! Use Android Keystore if possible.
```

Or load from assets:

```java
// Copy from assets to internal storage on first run
InputStream certStream = getAssets().open("client-cert.pem");
// ... save to internal storage
```

### 4. Certificate Requirements

- **CN (Common Name)** must start with: `project-<project_id>-<client_name>`
  - Example: `project-9516412833-myclient`
- Certificate must be signed by the single CA certificate
- Certificate format: PEM
- Private key format: PEM (unencrypted for simplicity, use Keystore in production)

### 5. CA Fingerprint (Optional)

For CA pinning (additional security), you can:

1. **Hardcode the CA fingerprint** in `main.cpp`:
   ```cpp
   // Get fingerprint from server:
   // openssl x509 -in nginx/ssl/ca-cert.pem -fingerprint -sha256 -noout
   static std::string g_ProjectCaFingerprint = "DAE31C0D190F9C6D77..."; // Uppercase, no colons
   ```

2. **Fetch dynamically** (requires authentication):
   ```cpp
   // This requires JWT authentication, so it may not work until client is authenticated
   ApiClient::getProjectCaFingerprint(projectId);
   ```

### 6. Testing

1. Build and install the app
2. Ensure certificates are in the correct paths
3. Check logcat for mTLS connection messages:
   ```
   logcat | grep -i mtls
   logcat | grep -i certificate
   ```

## Troubleshooting

### Error: "Client certificate required" (403)

- **Problem:** Certificates not found or not readable
- **Solution:** 
  - Check file paths match your package name
  - Ensure files have correct permissions (readable by app)
  - Verify certificates are PEM format

### Error: Certificate verification failed

- **Problem:** Certificate not signed by server CA
- **Solution:**
  - Ensure certificate was signed by the single CA
  - Check CN format: `project-<project_id>-<client_name>`
  - Regenerate certificate if needed

### Error: Connection refused / SSL handshake failed

- **Problem:** Server configuration issue
- **Solution:**
  - Verify server has mTLS enabled: `MTLS_ENABLED=true`
  - Check CA certificate exists: `nginx/ssl/ca-cert.pem`
  - Verify nginx configuration includes CA bundle

## Security Notes

1. **Private Key Protection:**
   - In production, use Android Keystore to store private key
   - Never hardcode private keys in source code
   - Use encrypted storage for certificate files

2. **Certificate Updates:**
   - Certificates expire after 1 year (default)
   - Implement automatic renewal via API
   - Handle certificate expiration gracefully

3. **CA Pinning:**
   - CA pinning provides additional MITM protection
   - Hardcode CA fingerprint for offline pinning
   - Update fingerprint when CA is renewed

## Single CA Configuration

The server now uses a **single CA certificate** for all clients:

- **CA Location:** `nginx/ssl/ca-cert.pem`
- **CA Key:** `nginx/ssl/ca-key.pem`
- **All clients** use this same CA
- **Simplified management** - no per-project CA certificates

This simplifies certificate management while maintaining security.

