#!/usr/bin/env python3
"""
Simple mTLS probe for /api/challenge to debug client certificate issues.

Usage:
  python scripts/mtls_probe.py --url https://host/api/challenge \
      --cert /path/to/client-cert.pem \
      --key /path/to/client-key.pem \
      --fingerprint abc --user-key KEY --project-id 123

Exits with non-zero on transport errors. Prints status, error code, body.
"""

import argparse
import json
import sys
import ssl
from pathlib import Path

import httpx


def main():
    parser = argparse.ArgumentParser(description="Probe mTLS /api/challenge")
    parser.add_argument("--url", required=True, help="Full URL to /api/challenge")
    parser.add_argument("--cert", required=True, type=Path, help="Client certificate PEM")
    parser.add_argument("--key", required=True, type=Path, help="Client private key PEM")
    parser.add_argument("--fingerprint", required=True, help="fingerprint field")
    parser.add_argument("--user-key", required=True, help="user_key field")
    parser.add_argument("--project-id", required=True, help="project_id field")
    parser.add_argument("--insecure", action="store_true", help="Disable server verification")
    args = parser.parse_args()

    if not args.cert.exists() or not args.key.exists():
        print("Cert or key not found", file=sys.stderr)
        sys.exit(2)

    payload = {
        "fingerprint": args.fingerprint,
        "user_key": args.user_key,
        "project_id": args.project_id,
    }

    # Build client with optional insecure SSL
    verify = False if args.insecure else True

    # If insecure, still load cert/key but skip server verify
    try:
        with httpx.Client(
            http2=True,
            verify=verify,
            cert=(str(args.cert), str(args.key)),
            timeout=10.0,
        ) as client:
            resp = client.post(args.url, json=payload)
            print(f"Status: {resp.status_code}")
            # httpx surface error codes in exceptions, so here error_code is always 0
            print(f"Body: {resp.text[:500]}")
            if resp.is_error:
                sys.exit(1)
    except ssl.SSLError as e:
        print(f"SSL error: {e}", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()
