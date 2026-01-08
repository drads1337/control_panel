#!/bin/bash
# Create a single CA certificate for all mTLS clients (simplified configuration)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CA_CERT="$SSL_DIR/ca-cert.pem"
CA_KEY="$SSL_DIR/ca-key.pem"

echo "============================================================"
echo "Creating single CA certificate for all mTLS clients"
echo "============================================================"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if CA already exists
if [ -f "$CA_CERT" ] && [ -f "$CA_KEY" ]; then
    echo "✓ CA certificate already exists at: $CA_CERT"
    echo "  To regenerate, delete the existing files first."
    exit 0
fi

# Generate CA private key
echo "Generating CA private key..."
openssl genrsa -out "$CA_KEY" 4096
chmod 600 "$CA_KEY"
echo "✓ CA private key created: $CA_KEY"

# Generate CA certificate (valid for 10 years)
echo "Generating CA certificate..."
openssl req -new -x509 -days 3650 -nodes \
    -out "$CA_CERT" \
    -key "$CA_KEY" \
    -subj "/C=US/ST=CA/O=Panel/CN=Panel CA" \
    -extensions v3_ca

chmod 644 "$CA_CERT"
echo "✓ CA certificate created: $CA_CERT"

# Display certificate info
echo ""
echo "CA Certificate Information:"
openssl x509 -in "$CA_CERT" -text -noout | grep -A 2 "Subject:"
openssl x509 -in "$CA_CERT" -text -noout | grep -A 2 "Issuer:"
openssl x509 -in "$CA_CERT" -fingerprint -sha256 -noout

echo ""
echo "============================================================"
echo "✓ Single CA certificate created successfully!"
echo "============================================================"
echo "CA Certificate: $CA_CERT"
echo "CA Private Key: $CA_KEY"
echo ""
echo "All client certificates must be signed by this CA."
echo "Nginx will use this CA to verify all client certificates."
echo ""

