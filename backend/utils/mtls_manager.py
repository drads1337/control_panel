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
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID

PROJECT_ROOT = Path(__file__).parent.parent.parent


class MTLSProjectManager:
    def __init__(self):
        base_dir = os.environ.get(
            "MTLS_PROJECT_SSL_DIR", PROJECT_ROOT / "nginx" / "ssl" / "projects"
        )
        self.base_dir = Path(base_dir)
        # Whether to persist client certs on disk (optional, can be disabled to avoid FS writes)
        self.persist_clients = (
            os.environ.get("MTLS_PERSIST_CLIENT_CERTS", "false").lower() == "true"
        )
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
        cert_pem, fingerprint = self.ensure_ca_exists()
        return cert_pem, fingerprint

    def ensure_ca_exists(self) -> tuple[str, str]:
        """
        Ensure single CA certificate + key exist; auto-generate if missing.

        Returns:
            (ca_cert_pem, fingerprint_sha256)
        """
        ca_dir = self.ca_cert_path.parent
        ca_dir.mkdir(parents=True, exist_ok=True)

        if not self.ca_cert_path.exists() or not self.ca_key_path.exists():
            # Generate CA key
            self._run(
                [
                    self.openssl_bin,
                    "genrsa",
                    "-out",
                    str(self.ca_key_path),
                    "4096",
                ],
                "generate CA private key",
            )
            try:
                os.chmod(self.ca_key_path, 0o644)
            except OSError:
                pass

            # Generate self-signed CA cert (10 years)
            self._run(
                [
                    self.openssl_bin,
                    "req",
                    "-new",
                    "-x509",
                    "-days",
                    "3650",
                    "-nodes",
                    "-out",
                    str(self.ca_cert_path),
                    "-key",
                    str(self.ca_key_path),
                    "-subj",
                    "/C=US/ST=CA/O=Panel/CN=Panel CA",
                    "-extensions",
                    "v3_ca",
                ],
                "generate CA certificate",
            )
            try:
                os.chmod(self.ca_cert_path, 0o644)
            except OSError:
                pass

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
        # Ensure single CA exists (auto-generate if missing)
        self.ensure_ca_exists()
        
        ca_cert_pem, _ = self.get_ca_cert(project_id)
        project_dir = self._project_dir(project_id)
        clients_dir = None
        client_dir = None

        if self.persist_clients:
            try:
                clients_dir = project_dir / "clients"
                clients_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                clients_dir = None

            safe_client = self._sanitize_name(client_name or "client")
            if clients_dir:
                try:
                    client_dir = clients_dir / safe_client
                    client_dir.mkdir(parents=True, exist_ok=True)
                except Exception:
                    client_dir = None

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
            serial_dir = Path(os.environ.get("MTLS_SERIAL_DIR", "/tmp/mtls_serials"))
            try:
                serial_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            ca_serial_path = serial_dir / f"{self.ca_cert_path.stem}.srl"

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
                    "-CAserial",
                    str(ca_serial_path),
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
            if client_dir and self.persist_clients:
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

    def generate_key_and_csr(
        self, client_name: str | None = None, key_size: int | None = None
    ) -> tuple[str, str]:
        """
        Generate client RSA private key and CSR in-memory.

        Returns:
            (private_key_pem, csr_pem)
        """
        size = key_size or int(os.environ.get("MTLS_CLIENT_KEY_BITS", "2048"))
        cn = self._sanitize_cn(client_name or "client")

        key = rsa.generate_private_key(public_exponent=65537, key_size=size)
        key_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()

        csr = (
            x509.CertificateSigningRequestBuilder()
            .subject_name(
                x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
            )
            .sign(key, hashes.SHA256(), default_backend())
        )
        csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode()
        return key_pem, csr_pem

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
        import logging
        logger = logging.getLogger(__name__)
        
        # Use single CA for all clients
        logger.debug(f"[VERIFY_CERT] Checking CA cert at {self.ca_cert_path}")
        if not self.ca_cert_path.exists():
            logger.error(f"[VERIFY_CERT] CA certificate not found at {self.ca_cert_path}")
            return False, f"CA certificate not found at {self.ca_cert_path}. Please create it using scripts/create_single_ca.sh", None

        try:
            logger.debug(f"[VERIFY_CERT] Loading CA cert from {self.ca_cert_path}")
            ca_cert_bytes = self.ca_cert_path.read_bytes()
            ca_cert = x509.load_pem_x509_certificate(ca_cert_bytes, default_backend())
            logger.debug(f"[VERIFY_CERT] CA cert loaded, subject={ca_cert.subject}")
            
            normalized_pem = self._normalize_pem(client_cert_pem)
            logger.debug(f"[VERIFY_CERT] Normalized client cert, length={len(normalized_pem)}")
            client_cert = x509.load_pem_x509_certificate(
                normalized_pem.encode(), default_backend()
            )
            logger.debug(f"[VERIFY_CERT] Client cert loaded, subject={client_cert.subject}, issuer={client_cert.issuer}")
        except Exception as exc:
            logger.error(f"[VERIFY_CERT] Failed to parse certificates: {exc}", exc_info=True)
            return False, f"Failed to parse certificates: {exc}", None

        try:
            logger.debug(f"[VERIFY_CERT] Verifying signature...")
            ca_cert.public_key().verify(
                client_cert.signature,
                client_cert.tbs_certificate_bytes,
                padding.PKCS1v15(),
                client_cert.signature_hash_algorithm,
            )
            logger.debug(f"[VERIFY_CERT] Signature verification successful")
        except Exception as exc:  # signature invalid
            logger.warning(f"[VERIFY_CERT] Signature verification failed: {exc}", exc_info=True)
            return False, f"Certificate not signed by CA: {exc}", None

        # Extract CN for reference (no validation required)
        cn = self._extract_cn(client_cert)
        logger.info(f"[VERIFY_CERT] Certificate verified successfully, cn={cn}")
        
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
        """
        Normalize PEM certificate string.
        Handles escape sequences from nginx headers and various formats.
        """
        if not pem:
            return ""
        
        # Handle escape sequences from nginx (ssl_client_escaped_cert)
        cleaned = pem.replace("\\n", "\n")
        cleaned = cleaned.replace("\\\\", "\\")  # Handle double backslashes
        cleaned = cleaned.strip()
        
        # Remove any leading/trailing whitespace and ensure proper format
        # Find BEGIN marker if certificate doesn't start with it
        if not cleaned.startswith("-----BEGIN"):
            begin_idx = cleaned.find("-----BEGIN")
            if begin_idx > 0:
                cleaned = cleaned[begin_idx:]
            elif begin_idx == -1:
                # No BEGIN marker found, might be URL encoded or other format
                # Try to decode if it looks like it might be encoded
                try:
                    import urllib.parse
                    decoded = urllib.parse.unquote(cleaned)
                    if "-----BEGIN" in decoded:
                        cleaned = decoded
                except:
                    pass
        
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


