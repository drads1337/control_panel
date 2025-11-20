#!/bin/bash
# Script to generate mTLS certificates for Panel
# This script creates CA, server, and client certificates

set -e

# Configuration
CERT_DIR="${CERT_DIR:-/etc/ssl/panel}"
CA_NAME="${CA_NAME:-Panel CA}"
ORGANIZATION="${ORGANIZATION:-Your Organization}"
DAYS_VALID="${DAYS_VALID:-365}"

echo "=== Panel mTLS Certificate Setup ==="
echo "Certificate directory: $CERT_DIR"
echo "CA Name: $CA_NAME"
echo "Organization: $ORGANIZATION"
echo "Validity: $DAYS_VALID days"
echo ""

# Create certificate directory
mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

# Generate CA private key
echo "1. Generating CA private key..."
openssl genrsa -out ca-key.pem 4096
chmod 600 ca-key.pem

# Generate CA certificate
echo "2. Generating CA certificate..."
openssl req -new -x509 -days $DAYS_VALID -key ca-key.pem -out ca-cert.pem \
    -subj "/CN=$CA_NAME/O=$ORGANIZATION" \
    -extensions v3_ca

# Generate server private key
echo "3. Generating server private key..."
openssl genrsa -out server-key.pem 4096
chmod 600 server-key.pem

# Generate server certificate signing request
echo "4. Generating server certificate signing request..."
read -p "Enter server hostname or IP (e.g., api.example.com): " SERVER_NAME
SERVER_NAME=${SERVER_NAME:-api.example.com}

openssl req -new -key server-key.pem -out server.csr \
    -subj "/CN=$SERVER_NAME/O=$ORGANIZATION"

# Sign server certificate with CA
echo "5. Signing server certificate..."
openssl x509 -req -days $DAYS_VALID -in server.csr -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out server-cert.pem \
    -extensions v3_server

# Generate client private key
echo "6. Generating client private key..."
openssl genrsa -out client-key.pem 4096
chmod 600 client-key.pem

# Generate client certificate signing request
echo "7. Generating client certificate signing request..."
read -p "Enter client Common Name (e.g., loader-001): " CLIENT_CN
CLIENT_CN=${CLIENT_CN:-loader-001}

openssl req -new -key client-key.pem -out client.csr \
    -subj "/CN=$CLIENT_CN/O=$ORGANIZATION"

# Sign client certificate with CA
echo "8. Signing client certificate..."
openssl x509 -req -days $DAYS_VALID -in client.csr -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out client-cert.pem \
    -extensions v3_client

# Clean up signing requests
rm -f server.csr client.csr

# Create certificate bundle for convenience
cat server-cert.pem ca-cert.pem > server-chain.pem
cat client-cert.pem ca-cert.pem > client-chain.pem

echo ""
echo "=== Certificate Generation Complete ==="
echo ""
echo "Generated files:"
echo "  CA Certificate:     $CERT_DIR/ca-cert.pem"
echo "  CA Private Key:      $CERT_DIR/ca-key.pem (KEEP SECRET!)"
echo "  Server Certificate: $CERT_DIR/server-cert.pem"
echo "  Server Private Key: $CERT_DIR/server-key.pem (KEEP SECRET!)"
echo "  Client Certificate: $CERT_DIR/client-cert.pem"
echo "  Client Private Key: $CERT_DIR/client-key.pem (KEEP SECRET!)"
echo ""
echo "Certificate chains:"
echo "  Server Chain: $CERT_DIR/server-chain.pem"
echo "  Client Chain: $CERT_DIR/client-chain.pem"
echo ""
echo "=== Configuration ==="
echo ""
echo "For Gunicorn (gunicorn.conf.py):"
echo "  MTLS_SERVER_KEY=$CERT_DIR/server-key.pem"
echo "  MTLS_SERVER_CERT=$CERT_DIR/server-cert.pem"
echo "  MTLS_CA_CERT_PATH=$CERT_DIR/ca-cert.pem"
echo ""
echo "For Nginx (nginx.conf):"
echo "  ssl_certificate $CERT_DIR/server-cert.pem;"
echo "  ssl_certificate_key $CERT_DIR/server-key.pem;"
echo "  ssl_client_certificate $CERT_DIR/ca-cert.pem;"
echo ""
echo "Environment variables:"
echo "  export MTLS_ENABLED=true"
echo "  export MTLS_CA_CERT_PATH=$CERT_DIR/ca-cert.pem"
echo "  export MTLS_REQUIRED_CN=$CLIENT_CN"
echo ""
echo "=== Security Notes ==="
echo "1. Keep private keys (ca-key.pem, server-key.pem, client-key.pem) SECRET"
echo "2. Distribute client certificates securely to authorized clients only"
echo "3. Use strong file permissions: chmod 600 *-key.pem"
echo "4. Consider using a Hardware Security Module (HSM) for CA key in production"
echo "5. Implement certificate rotation policy"
echo ""

