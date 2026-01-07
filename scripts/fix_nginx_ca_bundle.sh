#!/bin/bash
# Fix Nginx CA bundle - create temporary valid CA if bundle doesn't exist
# This allows Nginx to start even before any project CAs are created

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_PATH="$PROJECT_ROOT/nginx/ssl/ca-bundle.pem"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"
TEMP_CA_DIR="$SSL_DIR/temp_ca"

echo "Setting up CA bundle for Nginx..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if bundle exists and has valid content
if [ -f "$BUNDLE_PATH" ] && grep -q "BEGIN CERTIFICATE" "$BUNDLE_PATH" 2>/dev/null; then
    echo "✓ CA bundle already exists with valid certificates: $BUNDLE_PATH"
    exit 0
fi

# Create temporary CA certificate for initial setup
echo "Creating temporary CA certificate for Nginx initialization..."

mkdir -p "$TEMP_CA_DIR"

# Generate temporary CA key
openssl genrsa -out "$TEMP_CA_DIR/temp-ca-key.pem" 2048 2>/dev/null || {
    echo "Warning: Could not generate temporary CA. Nginx will need ca-bundle.pem with valid certificates."
    echo "Solution: Create a project CA first, then uncomment ssl_client_certificate in nginx.conf"
    exit 1
}

# Generate temporary CA certificate
openssl req -new -x509 -days 365 -key "$TEMP_CA_DIR/temp-ca-key.pem" \
    -out "$TEMP_CA_DIR/temp-ca-cert.pem" \
    -subj "/C=US/ST=CA/O=Panel/CN=Temporary-CA" 2>/dev/null || {
    echo "Warning: Could not generate temporary CA certificate."
    exit 1
}

# Create bundle with temporary CA
cat "$TEMP_CA_DIR/temp-ca-cert.pem" > "$BUNDLE_PATH"
chmod 644 "$BUNDLE_PATH"

echo "✓ Created temporary CA bundle: $BUNDLE_PATH"
echo "⚠ NOTE: This is a temporary CA. Replace with real project CAs after creating them."
echo ""
echo "Next steps:"
echo "1. Nginx should now start successfully"
echo "2. Create project CAs (they will be added to bundle automatically)"
echo "3. The temporary CA will be replaced when real CAs are created"
echo ""
echo "Done!"

