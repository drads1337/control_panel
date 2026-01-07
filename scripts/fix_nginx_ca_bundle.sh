#!/bin/bash
# Fix Nginx CA bundle - create empty file if it doesn't exist
# This allows Nginx to start even before any project CAs are created

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_PATH="$PROJECT_ROOT/nginx/ssl/ca-bundle.pem"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"

echo "Creating CA bundle directory and empty file if needed..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Create empty CA bundle file if it doesn't exist
if [ ! -f "$BUNDLE_PATH" ]; then
    echo "# Empty CA bundle - will be populated when project CAs are created" > "$BUNDLE_PATH"
    echo "" >> "$BUNDLE_PATH"
    chmod 644 "$BUNDLE_PATH"
    echo "✓ Created empty CA bundle: $BUNDLE_PATH"
else
    echo "✓ CA bundle already exists: $BUNDLE_PATH"
fi

echo "Done! Nginx should now be able to start."

