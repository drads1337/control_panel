"""Schemas for mTLS certificate management."""

from pydantic import Field, validator

from .common import BaseSchema


class CSRSignSchema(BaseSchema):
    """Sign a CSR for a project-specific client certificate."""

    csr_pem: str = Field(..., description="PEM encoded CSR (client-generated)")
    client_name: str | None = Field(
        default=None, description="Friendly client name for bookkeeping"
    )

    @validator("csr_pem")
    def validate_csr(cls, value: str) -> str:
        if "BEGIN CERTIFICATE REQUEST" not in value:
            raise ValueError("CSR must be a PEM string")
        if len(value) > 20000:
            raise ValueError("CSR is too large")
        return value.strip()

    @validator("client_name")
    def validate_client_name(cls, value: str | None) -> str | None:
        if value and len(value) > 128:
            raise ValueError("client_name too long")
        return value


