"""
Utilities for per-project mTLS certificate management.

Responsibilities:
- Create project-scoped CA (keeps private key server-side).
- Sign client CSRs (private keys stay with client).
- Maintain aggregate CA bundle for Nginx mTLS verification.
- Verify presented client cert against project CA and CN prefix.
"""

import os
import re
import shutil
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
        self.bundle_path = Path(
            os.environ.get(
                "MTLS_CA_BUNDLE_PATH", PROJECT_ROOT / "nginx" / "ssl" / "ca-bundle.pem"
            )
        )
        self.openssl_bin = os.environ.get("OPENSSL_BIN", "openssl")

    # ---------- public API ----------
    def ensure_project_ca(
        self, project_id: str, project_name: str | None = None
    ) -> tuple[str, str]:
        """
        Ensure CA key/cert exist for a project.

        Returns:
            (ca_cert_pem, fingerprint_sha256)
        """
        project_dir = self._project_dir(project_id)
        ca_dir = project_dir / "ca"
        ca_dir.mkdir(parents=True, exist_ok=True)
        ca_key = ca_dir / "ca-key.pem"
        ca_cert = ca_dir / "ca-cert.pem"

        if not ca_key.exists():
            self._run(
                [self.openssl_bin, "genrsa", "-out", str(ca_key), "4096"],
                "generate project CA key",
            )
            os.chmod(ca_key, 0o600)

        if not ca_cert.exists():
            subj = f"/C=US/ST=CA/O=Panel/OU=Project/CN=Project-{project_id} CA"
            if project_name:
                subj = f"/C=US/ST=CA/O=Panel/OU={self._sanitize_cn(project_name)}/CN=Project-{project_id} CA"
            self._run(
                [
                    self.openssl_bin,
                    "req",
                    "-new",
                    "-x509",
                    "-days",
                    "3650",
                    "-key",
                    str(ca_key),
                    "-out",
                    str(ca_cert),
                    "-subj",
                    subj,
                    "-extensions",
                    "v3_ca",
                ],
                "generate project CA cert",
            )

        self._refresh_ca_bundle()
        cert_pem = ca_cert.read_text()
        return cert_pem, self._fingerprint(cert_pem)

    def get_ca_cert(self, project_id: str) -> tuple[str, str]:
        """Get CA cert (generate if missing) and fingerprint."""
        return self.ensure_project_ca(project_id)

    def sign_csr(
        self,
        project_id: str,
        csr_pem: str,
        client_name: str | None = None,
        days_valid: int = 365,
    ) -> tuple[str, str, str]:
        """
        Sign a client CSR with the project's CA.

        Returns:
            (client_cert_pem, ca_cert_pem, fingerprint_sha256)
        """
        ca_cert_pem, _ = self.ensure_project_ca(project_id)
        project_dir = self._project_dir(project_id)
        clients_dir = project_dir / "clients"
        clients_dir.mkdir(parents=True, exist_ok=True)

        safe_client = self._sanitize_name(client_name or "client")
        client_dir = clients_dir / safe_client
        client_dir.mkdir(parents=True, exist_ok=True)

        ca_dir = project_dir / "ca"
        ca_key = ca_dir / "ca-key.pem"
        ca_cert = ca_dir / "ca-cert.pem"
        client_cert = client_dir / "client-cert.pem"

        normalized_csr = self._normalize_pem(csr_pem)

        # Enforce CN prefix in CSR
        csr_cn = self._extract_cn_from_csr(normalized_csr)
        expected_prefix = f"project-{project_id}".lower()
        if csr_cn and not csr_cn.lower().startswith(expected_prefix):
            raise ValueError(
                f"CSR CN must start with '{expected_prefix}' (got '{csr_cn}')"
            )

        # Use temporary files for CSR and extfile to avoid permission issues
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csr", delete=False) as csr_file:
            csr_file.write(normalized_csr)
            csr_file_path = csr_file.name

        with tempfile.NamedTemporaryFile(mode="w", delete=False) as extfile:
            extfile.write(
                "[v3_req]\n"
                "keyUsage = digitalSignature, keyEncipherment\n"
                "extendedKeyUsage = clientAuth\n"
            )
            extfile_path = extfile.name

        # Ensure client_dir exists for certificate output
        client_dir.mkdir(parents=True, exist_ok=True)

        try:
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
                    str(ca_cert),
                    "-CAkey",
                    str(ca_key),
                    "-CAcreateserial",
                    "-out",
                    str(client_cert),
                    "-extensions",
                    "v3_req",
                    "-extfile",
                    extfile_path,
                ],
                "sign client CSR",
            )
        finally:
            # Clean up temporary files
            try:
                os.unlink(csr_file_path)
            except OSError:
                pass
            try:
                os.unlink(extfile_path)
            except OSError:
                pass

        cert_pem = client_cert.read_text()
        return cert_pem, ca_cert_pem, self._fingerprint(cert_pem)

    def verify_certificate_for_project(
        self, project_id: str, client_cert_pem: str
    ) -> tuple[bool, str, Optional[str]]:
        """
        Verify presented client certificate:
        - Signed by project CA
        - CN starts with project-{project_id}

        Returns:
            (is_valid, message, cn)
        """
        project_dir = self._project_dir(project_id)
        ca_cert_path = project_dir / "ca" / "ca-cert.pem"
        if not ca_cert_path.exists():
            return False, "Project CA not initialized", None

        try:
            ca_cert = x509.load_pem_x509_certificate(
                ca_cert_path.read_bytes(), default_backend()
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
            return False, f"Certificate not signed by project CA: {exc}", None

        cn = self._extract_cn(client_cert)
        prefix = f"project-{project_id}"
        if not cn or not cn.lower().startswith(prefix.lower()):
            return (
                False,
                f"Certificate CN must start with {prefix}",
                cn,
            )

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

    def _refresh_ca_bundle(self) -> None:
        """Concatenate all project CA certs into a single bundle for Nginx."""
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.bundle_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.bundle_path.with_suffix(".tmp")
        with tmp_path.open("w") as tmp:
            for ca_cert in sorted(self.base_dir.glob("*/ca/ca-cert.pem")):
                try:
                    tmp.write(ca_cert.read_text())
                    tmp.write("\n")
                except Exception:
                    continue
        shutil.move(tmp_path, self.bundle_path)
        os.chmod(self.bundle_path, 0o644)

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


