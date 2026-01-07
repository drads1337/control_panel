#!/bin/bash
# Script to get SHA-256 fingerprint of server SSL certificate for SSL pinning
# Usage: ./get_server_cert_fingerprint.sh [hostname] [port]
# Example: ./get_server_cert_fingerprint.sh ovrin.xyz 443

HOST="${1:-ovrin.xyz}"
PORT="${2:-443}"

echo "Getting SSL certificate fingerprint for $HOST:$PORT..."
echo ""

# Method 1: Using openssl s_client (most reliable)
echo "=== Method 1: OpenSSL s_client ==="
FINGERPRINT=$(echo | openssl s_client -connect "$HOST:$PORT" -servername "$HOST" 2>/dev/null | \
    openssl x509 -fingerprint -sha256 -noout | \
    cut -d'=' -f2 | tr -d ':')

if [ -n "$FINGERPRINT" ]; then
    echo "SHA-256 Fingerprint: $FINGERPRINT"
    echo ""
    echo "Add this to your client code:"
    echo "constexpr const char* SERVER_CERT_FINGERPRINT = \"$FINGERPRINT\";"
    echo ""
else
    echo "Failed to get fingerprint"
    exit 1
fi

# Method 2: Using openssl with timeout (alternative)
echo "=== Method 2: Alternative (with timeout) ==="
FINGERPRINT2=$(timeout 5 openssl s_client -connect "$HOST:$PORT" -servername "$HOST" </dev/null 2>/dev/null | \
    openssl x509 -fingerprint -sha256 -noout 2>/dev/null | \
    cut -d'=' -f2 | tr -d ':')

if [ -n "$FINGERPRINT2" ]; then
    echo "SHA-256 Fingerprint: $FINGERPRINT2"
    if [ "$FINGERPRINT" != "$FINGERPRINT2" ]; then
        echo "WARNING: Fingerprints don't match!"
    fi
fi

echo ""
echo "=== Certificate Details ==="
echo | openssl s_client -connect "$HOST:$PORT" -servername "$HOST" 2>/dev/null | \
    openssl x509 -noout -subject -issuer -dates

echo ""
echo "=== Security Note ==="
echo "SSL Pinning protects against:"
echo "  - MITM attacks even with valid CA certificates"
echo "  - Compromised Certificate Authorities"
echo "  - DNS hijacking attacks"
echo ""
echo "IMPORTANT: Update fingerprint when certificate is renewed!"
echo "           Certificate expiration date shown above."

