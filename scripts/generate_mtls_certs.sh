#!/bin/bash
# Script to generate CA certificate and client certificates for mTLS
# Usage: ./scripts/generate_mtls_certs.sh [client_name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_DIR/nginx/ssl"
CA_DIR="$SSL_DIR/ca"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== mTLS Certificate Generation ===${NC}"

# Create directories
mkdir -p "$CA_DIR"
mkdir -p "$SSL_DIR"

# Generate CA private key
if [ ! -f "$CA_DIR/ca-key.pem" ]; then
    echo -e "${YELLOW}Generating CA private key...${NC}"
    openssl genrsa -out "$CA_DIR/ca-key.pem" 4096
    chmod 600 "$CA_DIR/ca-key.pem"
    echo -e "${GREEN}✓ CA private key generated${NC}"
else
    echo -e "${GREEN}✓ CA private key already exists${NC}"
fi

# Generate CA certificate
if [ ! -f "$CA_DIR/ca-cert.pem" ]; then
    echo -e "${YELLOW}Generating CA certificate...${NC}"
    openssl req -new -x509 -days 3650 -key "$CA_DIR/ca-key.pem" \
        -out "$CA_DIR/ca-cert.pem" \
        -subj "/C=US/ST=CA/L=San Francisco/O=Panel/CN=Panel CA" \
        -extensions v3_ca
    echo -e "${GREEN}✓ CA certificate generated${NC}"
else
    echo -e "${GREEN}✓ CA certificate already exists${NC}"
fi

# Copy CA certificate to nginx/ssl for nginx to use
cp "$CA_DIR/ca-cert.pem" "$SSL_DIR/ca-cert.pem"
chmod 644 "$SSL_DIR/ca-cert.pem"
echo -e "${GREEN}✓ CA certificate copied to $SSL_DIR/ca-cert.pem${NC}"

# Generate client certificate if client name provided
if [ -n "$1" ]; then
    CLIENT_NAME="$1"
    CLIENT_DIR="$SSL_DIR/clients/$CLIENT_NAME"
    mkdir -p "$CLIENT_DIR"
    
    echo -e "${YELLOW}Generating client certificate for: $CLIENT_NAME${NC}"
    
    # Generate client private key
    openssl genrsa -out "$CLIENT_DIR/client-key.pem" 2048
    chmod 600 "$CLIENT_DIR/client-key.pem"
    
    # Generate client certificate signing request
    openssl req -new -key "$CLIENT_DIR/client-key.pem" \
        -out "$CLIENT_DIR/client.csr" \
        -subj "/C=US/ST=CA/L=San Francisco/O=Panel/CN=$CLIENT_NAME"
    
    # Sign client certificate with CA
    openssl x509 -req -days 365 -in "$CLIENT_DIR/client.csr" \
        -CA "$CA_DIR/ca-cert.pem" \
        -CAkey "$CA_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$CLIENT_DIR/client-cert.pem" \
        -extensions v3_req \
        -extfile <(echo "[v3_req]"; echo "keyUsage = digitalSignature, keyEncipherment"; echo "extendedKeyUsage = clientAuth")
    
    # Create PKCS#12 bundle (for easy import to clients)
    openssl pkcs12 -export -out "$CLIENT_DIR/client.p12" \
        -inkey "$CLIENT_DIR/client-key.pem" \
        -in "$CLIENT_DIR/client-cert.pem" \
        -certfile "$CA_DIR/ca-cert.pem" \
        -passout pass:  # Empty password (change if needed)
    
    # Clean up CSR
    rm "$CLIENT_DIR/client.csr"
    
    echo -e "${GREEN}✓ Client certificate generated:${NC}"
    echo -e "  - Private key: $CLIENT_DIR/client-key.pem"
    echo -e "  - Certificate: $CLIENT_DIR/client-cert.pem"
    echo -e "  - PKCS#12 bundle: $CLIENT_DIR/client.p12"
    echo ""
    echo -e "${YELLOW}To use this certificate in your client:${NC}"
    echo -e "  1. Copy both client-key.pem and client-cert.pem to your client"
    echo -e "  2. Or use client.p12 for easier import"
    echo -e "  3. Configure your client to use these certificates for mTLS"
fi

echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo -e "CA Certificate: $SSL_DIR/ca-cert.pem"
echo -e "CA Private Key: $CA_DIR/ca-key.pem (keep secure!)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Set environment variables:"
echo -e "   export MTLS_ENABLED=true"
echo -e "   export MTLS_CA_CERT_PATH=/etc/nginx/ssl/ca-cert.pem"
echo ""
echo -e "2. Restart nginx:"
echo -e "   docker-compose restart nginx"
echo ""
echo -e "3. Generate client certificates:"
echo -e "   ./scripts/generate_mtls_certs.sh client-name"

