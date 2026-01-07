#!/bin/bash
# Project-scoped mTLS helper
# Usage:
#   ./mtls_project.sh init <project_id> [project_name]
#   ./mtls_project.sh sign <project_id> <csr_file> [client_name]
#
# - Keeps CA private key on server
# - Builds shared CA bundle for Nginx at nginx/ssl/ca-bundle.pem

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
SSL_BASE="$PROJECT_ROOT/nginx/ssl"
PROJECT_SSL_DIR="$SSL_BASE/projects"
BUNDLE_PATH="$SSL_BASE/ca-bundle.pem"
OPENSSL_BIN="${OPENSSL_BIN:-openssl}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage:"
  echo "  $0 init <project_id> [project_name]"
  echo "  $0 sign <project_id> <csr_file> [client_name]"
  exit 1
}

info() { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }

refresh_bundle() {
  mkdir -p "$SSL_BASE"
  tmp="${BUNDLE_PATH}.tmp"
  : > "$tmp"
  for ca in "$PROJECT_SSL_DIR"/*/ca/ca-cert.pem; do
    [ -f "$ca" ] && cat "$ca" >> "$tmp" && echo >> "$tmp"
  done
  mv "$tmp" "$BUNDLE_PATH"
  chmod 644 "$BUNDLE_PATH"
  info "Updated CA bundle: $BUNDLE_PATH"
}

init_project_ca() {
  local project_id="$1"
  local project_name="${2:-}"
  local project_dir="$PROJECT_SSL_DIR/$project_id"
  local ca_dir="$project_dir/ca"
  mkdir -p "$ca_dir"

  local ca_key="$ca_dir/ca-key.pem"
  local ca_cert="$ca_dir/ca-cert.pem"

  if [ ! -f "$ca_key" ]; then
    warn "Generating CA key for project $project_id"
    $OPENSSL_BIN genrsa -out "$ca_key" 4096
    chmod 600 "$ca_key"
  else
    info "CA key already exists for project $project_id"
  fi

  if [ ! -f "$ca_cert" ]; then
    warn "Generating CA cert for project $project_id"
    local subj="/C=US/ST=CA/O=Panel/OU=Project/CN=Project-${project_id} CA"
    if [ -n "$project_name" ]; then
      subj="/C=US/ST=CA/O=Panel/OU=${project_name}/CN=Project-${project_id} CA"
    fi
    $OPENSSL_BIN req -new -x509 -days 3650 -key "$ca_key" -out "$ca_cert" -subj "$subj" -extensions v3_ca
  else
    info "CA cert already exists for project $project_id"
  fi

  refresh_bundle
  info "CA ready: $ca_cert"
}

sign_csr() {
  local project_id="$1"
  local csr_file="$2"
  local client_name="${3:-client}"

  if [ ! -f "$csr_file" ]; then
    echo "CSR file not found: $csr_file"
    exit 1
  fi

  local project_dir="$PROJECT_SSL_DIR/$project_id"
  local ca_dir="$project_dir/ca"
  local ca_key="$ca_dir/ca-key.pem"
  local ca_cert="$ca_dir/ca-cert.pem"

  if [ ! -f "$ca_key" ] || [ ! -f "$ca_cert" ]; then
    echo "CA not initialized for project $project_id. Run init first."
    exit 1
  fi

  local clients_dir="$project_dir/clients/$client_name"
  mkdir -p "$clients_dir"
  local client_cert="$clients_dir/client-cert.pem"

  cat >"$clients_dir/v3_req.ext" <<EOF
[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = project-${project_id}-${client_name}
EOF

  warn "Signing CSR for project $project_id client $client_name"
  $OPENSSL_BIN x509 -req -days 365 \
    -in "$csr_file" \
    -CA "$ca_cert" \
    -CAkey "$ca_key" \
    -CAcreateserial \
    -out "$client_cert" \
    -extensions v3_req \
    -extfile "$clients_dir/v3_req.ext"

  info "Client certificate: $client_cert"
  info "CA certificate: $ca_cert"
}

main() {
  mkdir -p "$PROJECT_SSL_DIR"
  if [ $# -lt 2 ]; then usage; fi

  local action="$1"
  shift

  case "$action" in
    init)
      [ $# -lt 1 ] && usage
      init_project_ca "$@"
      ;;
    sign)
      [ $# -lt 2 ] && usage
      sign_csr "$@"
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"

