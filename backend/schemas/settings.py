"""
Settings Pydantic schemas
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from .common import BaseSchema


class SettingsUpdateSchema(BaseSchema):
    """Schema for updating project settings"""
    

    min_password_length: Optional[int] = Field(default=None, ge=4, le=128, description="Minimum password length")
    max_login_attempts: Optional[int] = Field(default=None, ge=1, le=20, description="Maximum login attempts")
    ip_block_duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440, description="IP block duration in minutes")
    max_sessions_per_user: Optional[int] = Field(default=None, ge=1, le=50, description="Maximum sessions per user")
    two_factor_auth_required: Optional[bool] = Field(default=None, description="Require 2FA")
    password_complexity_required: Optional[bool] = Field(default=None, description="Require password complexity")
    session_fingerprinting: Optional[bool] = Field(default=None, description="Enable session fingerprinting")
    ip_whitelist_enabled: Optional[bool] = Field(default=None, description="Enable IP whitelist")
    ip_whitelist: Optional[str] = Field(default=None, description="IP whitelist (comma-separated)")
    

    log_retention_days: Optional[int] = Field(default=None, ge=1, le=3650, description="Log retention in days")
    security_log_level: Optional[str] = Field(default=None, description="Security log level")
    max_connections: Optional[int] = Field(default=None, ge=1, le=10000, description="Maximum connections")
    session_timeout_minutes: Optional[int] = Field(default=None, ge=1, le=1440, description="Session timeout in minutes")
    log_file_size_mb: Optional[int] = Field(default=None, ge=1, le=10000, description="Log file size in MB")
    system_log_level: Optional[str] = Field(default=None, description="System log level")
    auto_save_enabled: Optional[bool] = Field(default=None, description="Enable auto-save")
    analytics_enabled: Optional[bool] = Field(default=None, description="Enable analytics")
    system_notifications_enabled: Optional[bool] = Field(default=None, description="Enable system notifications")
    

    additional_settings: Optional[Dict[str, Any]] = Field(default=None, description="Additional settings")

    @field_validator("security_log_level", "system_log_level")
    @classmethod
    def validate_log_level(cls, v: Optional[str]) -> Optional[str]:
        """Validate log level"""
        if v is None:
            return v
        allowed_levels = ["debug", "info", "warning", "error", "critical"]
        if v.lower() not in allowed_levels:
            raise ValueError(f"Log level must be one of {allowed_levels}")
        return v.lower()


class EncryptionKeysUpdateSchema(BaseSchema):
    """Schema for updating encryption keys"""
    
    aes_key: Optional[str] = Field(default=None, description="AES key (64 hex characters)")

    @field_validator("aes_key")
    @classmethod
    def validate_aes_key(cls, v: Optional[str]) -> Optional[str]:
        """Validate AES key format"""
        if v is None:
            return v
        v = v.strip()
        if len(v) != 64:
            raise ValueError("AES key must be exactly 64 characters long (32 bytes)")
        try:
            int(v, 16)
        except ValueError:
            raise ValueError("AES key must be valid hexadecimal")
        return v


class RegenerateKeysActionSchema(BaseSchema):
    """Schema for regenerating keys action"""
    
    action: str = Field(default="aes", description="Action: 'aes' (RSA keys removed)")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        """Validate action"""
        allowed_actions = ["aes"]
        if v not in allowed_actions:
            raise ValueError(f"Action must be one of {allowed_actions}")
        return v


class BlockFingerprintSchema(BaseSchema):
    """Schema for blocking a fingerprint"""
    
    fingerprint: str = Field(..., min_length=1, description="Fingerprint to block")
    reason: str = Field(default="Manual block", description="Block reason")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration datetime")


class BlockIPSchema(BaseSchema):
    """Schema for blocking an IP address"""
    
    ip_address: str = Field(..., description="IP address to block")
    reason: str = Field(default="Manual block", description="Block reason")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration datetime")
    block_type: str = Field(default="manual", description="Block type")
    category: str = Field(default="general", description="Block category")
    severity: str = Field(default="medium", description="Severity level")
    threat_score: int = Field(default=0, ge=0, le=100, description="Threat score")

    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, v: str) -> str:
        """Validate IP address format"""
        import ipaddress
        try:
            ipaddress.ip_address(v)
            return v
        except ValueError:
            raise ValueError("Invalid IP address format")

    @field_validator("block_type")
    @classmethod
    def validate_block_type(cls, v: str) -> str:
        """Validate block type"""
        allowed_types = ["manual", "automatic", "behavioral", "rate_limit"]
        if v not in allowed_types:
            raise ValueError(f"Block type must be one of {allowed_types}")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        """Validate severity level"""
        allowed_severities = ["low", "medium", "high", "critical"]
        if v not in allowed_severities:
            raise ValueError(f"Severity must be one of {allowed_severities}")
        return v


class BlockHWIDSchema(BaseSchema):
    """Schema for blocking a HWID"""
    
    hwid: str = Field(..., min_length=1, description="Hardware ID to block")
    reason: str = Field(default="Manual block", description="Block reason")
    expires_at: Optional[datetime] = Field(default=None, description="Expiration datetime")
    block_type: str = Field(default="manual", description="Block type")
    category: str = Field(default="general", description="Block category")
    severity: str = Field(default="medium", description="Severity level")
    threat_score: int = Field(default=0, ge=0, le=100, description="Threat score")

    @field_validator("block_type")
    @classmethod
    def validate_block_type(cls, v: str) -> str:
        """Validate block type"""
        allowed_types = ["manual", "automatic", "behavioral", "rate_limit"]
        if v not in allowed_types:
            raise ValueError(f"Block type must be one of {allowed_types}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate category"""
        allowed_categories = ["general", "spam", "abuse", "fraud", "malware", "suspicious", "violation", "rate_limit"]
        if v not in allowed_categories:
            raise ValueError(f"Category must be one of {allowed_categories}")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        """Validate severity level"""
        allowed_severities = ["low", "medium", "high", "critical"]
        if v not in allowed_severities:
            raise ValueError(f"Severity must be one of {allowed_severities}")
        return v


class SecurityRuleCreateSchema(BaseSchema):
    """Schema for creating a security rule"""
    
    name: str = Field(..., min_length=1, max_length=255, description="Rule name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Rule description")
    rule_type: str = Field(..., description="Rule type")
    conditions: Dict[str, Any] = Field(..., description="Rule conditions")
    action_type: str = Field(..., description="Action type")
    action_params: Optional[Dict[str, Any]] = Field(default=None, description="Action parameters")
    is_active: bool = Field(default=True, description="Whether rule is active")
    priority: int = Field(default=100, ge=0, le=1000, description="Rule priority")
    cooldown_minutes: int = Field(default=60, ge=0, le=1440, description="Cooldown in minutes")


class SecurityRuleUpdateSchema(BaseSchema):
    """Schema for updating a security rule"""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Rule name")
    description: Optional[str] = Field(default=None, max_length=1000, description="Rule description")
    rule_type: Optional[str] = Field(default=None, description="Rule type")
    conditions: Optional[Dict[str, Any]] = Field(default=None, description="Rule conditions")
    action_type: Optional[str] = Field(default=None, description="Action type")
    action_params: Optional[Dict[str, Any]] = Field(default=None, description="Action parameters")
    is_active: Optional[bool] = Field(default=None, description="Whether rule is active")
    priority: Optional[int] = Field(default=None, ge=0, le=1000, description="Rule priority")
    cooldown_minutes: Optional[int] = Field(default=None, ge=0, le=1440, description="Cooldown in minutes")

