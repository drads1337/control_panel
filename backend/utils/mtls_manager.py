"""
Utilities for mTLS certificate management using a single CA for all clients.

Responsibilities:
- Use single CA certificate for all clients (simplified configuration).
- Sign client CSRs (private keys stay with client).
- Verify presented client cert against single CA and CN prefix.
"""

import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Tuple

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

PROJECT_ROOT = Path(__file__).parent.parent.parent


class MTLSProjectManager:
    def __init__(self):
        base_dir = os.environ.get(
            "MTLS_PROJECT_SSL_DIR", PROJECT_ROOT / "nginx" / "ssl" / "projects"
        )
        self.base_dir = Path(base_dir)
        # Single CA certificate for all clients (simplified configuration)
        default_ca_path = os.environ.get(
            "MTLS_CA_CERT_PATH", PROJECT_ROOT / "nginx" / "ssl" / "ca-cert.pem"
        )
        self.ca_cert_path = Path(default_ca_path)
        self.ca_key_path = self.ca_cert_path.parent / "ca-key.pem"
        self.openssl_bin = os.environ.get("OPENSSL_BIN", "openssl")

    # ---------- public API ----------
    def get_ca_cert(self, project_id: str) -> tuple[str, str]:
        """
        Get single CA certificate for all clients (simplified configuration).
        
        Returns:
            (ca_cert_pem, fingerprint_sha256)
        """
        if not self.ca_cert_path.exists():
            raise RuntimeError(
                f"CA certificate not found at {self.ca_cert_path}. "
                "Please create it using scripts/create_single_ca.sh"
            )
        
        cert_pem = self.ca_cert_path.read_text()
        return cert_pem, self._fingerprint(cert_pem)

    def sign_csr(
        self,
        project_id: str,
        csr_pem: str,
        client_name: str | None = None,
        days_valid: int = 365,
    ) -> tuple[str, str, str]:
        """
        Sign a client CSR with the single CA certificate (simplified configuration).

        Returns:
            (client_cert_pem, ca_cert_pem, fingerprint_sha256)
        """
        # Use single CA for all clients
        if not self.ca_cert_path.exists():
            raise RuntimeError(
                f"CA certificate not found at {self.ca_cert_path}. "
                "Please create it using scripts/create_single_ca.sh"
            )
        
        if not self.ca_key_path.exists():
            raise RuntimeError(
                f"CA private key not found at {self.ca_key_path}. "
                "Please create it using scripts/create_single_ca.sh"
            )
        
        ca_cert_pem, _ = self.get_ca_cert(project_id)
        project_dir = self._project_dir(project_id)
        clients_dir = project_dir / "clients"
        clients_dir.mkdir(parents=True, exist_ok=True)

        safe_client = self._sanitize_name(client_name or "client")
        client_dir = clients_dir / safe_client
        client_dir.mkdir(parents=True, exist_ok=True)

        normalized_csr = self._normalize_pem(csr_pem)

        # NOTE: With single CA, CN can be any value - no project_id prefix required
        # CN is only used for identification, not validation
        # Project validation is done via request data (project_id field) or other methods

        # Use temporary files for CSR, certificate, and extfile to avoid permission issues
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csr", delete=False) as csr_file:
            csr_file.write(normalized_csr)
            csr_file_path = csr_file.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False) as cert_file:
            cert_file_path = cert_file.name

        with tempfile.NamedTemporaryFile(mode="w", delete=False) as extfile:
            extfile.write(
                "[v3_req]\n"
                "keyUsage = digitalSignature, keyEncipherment\n"
                "extendedKeyUsage = clientAuth\n"
            )
            extfile_path = extfile.name

        try:
            # Use single CA certificate and key
            self._run(
                [
                    self.openssl_bin,
                    "x509",
                    "-req",
                    "-days",
                    str(days_valid),
                    "-in",
                    csr_file_path,
                    "-CA",
                    str(self.ca_cert_path),
                    "-CAkey",
                    str(self.ca_key_path),
                    "-CAcreateserial",
                    "-out",
                    cert_file_path,
                    "-extensions",
                    "v3_req",
                    "-extfile",
                    extfile_path,
                ],
                "sign client CSR",
            )
            
            # Read the signed certificate from temporary file
            with open(cert_file_path, "r") as f:
                cert_pem = f.read()
            
            # Try to save a copy to client_dir if possible (for reference, but don't fail if it doesn't work)
            try:
                client_dir.mkdir(parents=True, exist_ok=True)
                client_cert = client_dir / "client-cert.pem"
                client_cert.write_text(cert_pem)
                os.chmod(client_cert, 0o644)
            except (OSError, PermissionError):
                # Ignore permission errors when saving to client_dir - it's optional
                pass
        finally:
            # Clean up temporary files
            try:
                os.unlink(csr_file_path)
            except OSError:
                pass
            try:
                os.unlink(cert_file_path)
            except OSError:
                pass
            try:
                os.unlink(extfile_path)
            except OSError:
                pass

        return cert_pem, ca_cert_pem, self._fingerprint(cert_pem)

    def verify_certificate_for_project(
        self, project_id: str, client_cert_pem: str
    ) -> tuple[bool, str, Optional[str]]:
        """
        Verify presented client certificate:
        - Signed by single CA certificate (simplified configuration)
        - CN can be any value (universal certificates - no project_id prefix required)

        NOTE: With single CA, certificates are universal and work for all projects.
        Project validation is done via request data (project_id field) or other methods,
        not via certificate CN.

        Returns:
            (is_valid, message, cn)
        """
        # Use single CA for all clients
        if not self.ca_cert_path.exists():
            return False, "CA certificate not found. Please create it using scripts/create_single_ca.sh", None

        try:
            ca_cert = x509.load_pem_x509_certificate(
                self.ca_cert_path.read_bytes(), default_backend()
            )
            client_cert = x509.load_pem_x509_certificate(
                self._normalize_pem(client_cert_pem).encode(), default_backend()
            )
        except Exception as exc:
            return False, f"Failed to parse certificates: {exc}", None

        try:
            ca_cert.public_key().verify(
                client_cert.signature,
                client_cert.tbs_certificate_bytes,
                padding.PKCS1v15(),
                client_cert.signature_hash_algorithm,
            )
        except Exception as exc:  # signature invalid
            return False, f"Certificate not signed by CA: {exc}", None

        # Extract CN for reference (no validation required)
        cn = self._extract_cn(client_cert)
        
        # NOTE: With universal certificates, CN can be any value
        # No project_id prefix validation required
        # Project validation is done via request data, not certificate CN

        return True, "ok", cn

    # ---------- helpers ----------
    def _project_dir(self, project_id: str) -> Path:
        return self.base_dir / str(project_id)

    def _run(self, cmd: list[str], what: str) -> None:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(
                f"Failed to {what}: {result.stderr or result.stdout}"
            )

    # CA bundle refresh no longer needed - using single CA certificate

    def _fingerprint(self, pem: str) -> str:
        cert = x509.load_pem_x509_certificate(
            self._normalize_pem(pem).encode(), default_backend()
        )
        return cert.fingerprint(hashes.SHA256()).hex().upper()

    def _normalize_pem(self, pem: str) -> str:
        cleaned = pem.strip().replace("\\n", "\n")
        return cleaned

    def _extract_cn(self, cert: x509.Certificate) -> Optional[str]:
        try:
            attrs = cert.subject.get_attributes_for_oid(
                x509.oid.NameOID.COMMON_NAME
            )
            return attrs[0].value if attrs else None
        except Exception:
            return None

    def _extract_cn_from_csr(self, csr_pem: str) -> Optional[str]:
        try:
            csr = x509.load_pem_x509_csr(csr_pem.encode(), default_backend())
            attrs = csr.subject.get_attributes_for_oid(
                x509.oid.NameOID.COMMON_NAME
            )
            return attrs[0].value if attrs else None
        except Exception:
            return None

    def _sanitize_name(self, name: str) -> str:
        return re.sub(r"[^A-Za-z0-9_.-]", "_", name)[:128] or "client"

    def _sanitize_cn(self, name: str) -> str:
        return re.sub(r"[^A-Za-z0-9 ._-]", "_", name)[:64]


